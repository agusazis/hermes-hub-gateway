use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub result: Option<serde_json::Value>,
    pub error: Option<serde_json::Value>,
}

#[cfg(windows)]
pub async fn start_mcp_server() {
    use tokio::net::windows::named_pipe::ServerOptions;
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let pipe_name = r"\\.\pipe\hhg-bridge";
    println!("[Unified MCP Hub] Initializing Local Named Pipe MCP Server on {}...", pipe_name);

    loop {
        let server = match ServerOptions::new()
            .first_pipe_instance(false)
            .create(pipe_name)
        {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[Unified MCP Hub] Failed to create named pipe server: {}. Retrying in 3s...", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                continue;
            }
        };

        if let Err(e) = server.connect().await {
            eprintln!("[Unified MCP Hub] Client connection failed: {}", e);
            continue;
        }

        tokio::spawn(async move {
            let (reader, mut writer) = tokio::io::split(server);
            let mut buf_reader = BufReader::new(reader);
            let mut line = String::new();

            while let Ok(n) = buf_reader.read_line(&mut line).await {
                if n == 0 {
                    break;
                }

                let trimmed = line.trim();
                if trimmed.is_empty() {
                    line.clear();
                    continue;
                }

                if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(trimmed) {
                    let cfg = crate::config::load_config();
                    let raw_skills_dir = match cfg.workspaces.iter().find(|w| w.id == cfg.active_workspace_id).cloned() {
                        Some(w) => PathBuf::from(&w.internal_skills_path),
                        None => match cfg.workspaces.first().cloned() {
                            Some(first) => PathBuf::from(&first.internal_skills_path),
                            None => dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".hermes-hub").join("skills"),
                        },
                    };
                    let skills_dir = if raw_skills_dir.join("skills").is_dir() {
                        raw_skills_dir.join("skills")
                    } else {
                        raw_skills_dir
                    };

                    let res = handle_mcp_call(req, &skills_dir);
                    if let Ok(res_str) = serde_json::to_string(&res) {
                        let _ = writer.write_all(format!("{}\n", res_str).as_bytes()).await;
                        let _ = writer.flush().await;
                    }
                }
                line.clear();
            }
        });
    }
}

#[cfg(not(windows))]
pub async fn start_mcp_server() {
    println!("[Unified MCP Hub] Local Named Pipe listener active on Windows targets.");
}

pub fn handle_mcp_call(request: JsonRpcRequest, skills_dir: &PathBuf) -> JsonRpcResponse {
    let method = request.method.as_str();

    match method {
        "tools/list" => {
            let tools = serde_json::json!([
                {
                    "name": "hermes_get_skill",
                    "description": "Ambil isi aturan koding / SOP spesifik (SKILL.md) dari Hermes Hub Gateway secara on-demand tanpa mengotori direktori project target.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Nama skill (contoh: 'core-blueprint', 'git-workflow')"
                            }
                        },
                        "required": ["name"]
                    }
                },
                {
                    "name": "hermes_list_skills",
                    "description": "Daftar seluruh skill dan referensi SOP yang tersedia di workspace aktif.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {}
                    }
                }
            ]);

            JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id,
                result: Some(serde_json::json!({ "tools": tools })),
                error: None,
            }
        }
        "tools/call" => {
            let params = request.params.unwrap_or(serde_json::Value::Null);
            let name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(serde_json::json!({}));

            match name {
                "hermes_get_skill" => {
                    let skill_name = arguments.get("name").and_then(|s| s.as_str()).unwrap_or("");
                    let skill_file = skills_dir.join(skill_name).join("SKILL.md");

                    if skill_file.exists() {
                        if let Ok(content) = fs::read_to_string(&skill_file) {
                            return JsonRpcResponse {
                                jsonrpc: "2.0".to_string(),
                                id: request.id,
                                result: Some(serde_json::json!({
                                    "content": [{
                                        "type": "text",
                                        "text": content
                                    }]
                                })),
                                error: None,
                            };
                        }
                    }

                    JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id: request.id,
                        result: Some(serde_json::json!({
                            "content": [{
                                "type": "text",
                                "text": format!("Skill '{}' tidak ditemukan di direktori internal HHG: {:?}", skill_name, skills_dir)
                            }],
                            "isError": true
                        })),
                        error: None,
                    }
                }
                "hermes_list_skills" => {
                    let mut list = Vec::new();
                    if let Ok(entries) = fs::read_dir(skills_dir) {
                        for e in entries.flatten() {
                            if e.path().is_dir() {
                                if let Some(n) = e.file_name().to_str() {
                                    list.push(n.to_string());
                                }
                            }
                        }
                    }

                    JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id: request.id,
                        result: Some(serde_json::json!({
                            "content": [{
                                "type": "text",
                                "text": serde_json::to_string_pretty(&list).unwrap_or_default()
                            }]
                        })),
                        error: None,
                    }
                }
                _ => JsonRpcResponse {
                    jsonrpc: "2.0".to_string(),
                    id: request.id,
                    result: None,
                    error: Some(serde_json::json!({
                        "code": -32601,
                        "message": format!("Tool '{}' tidak dikenali di Hermes Hub Gateway", name)
                    })),
                },
            }
        }
        _ => JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: request.id,
            result: None,
            error: Some(serde_json::json!({
                "code": -32601,
                "message": format!("Method '{}' tidak didukung", method)
            })),
        },
    }
}
