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

pub async fn start_mcp_server() {
    println!("[Unified MCP Hub] Initializing Local Named Pipe MCP Server on \\\\.\\pipe\\hhg-bridge...");
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
                                "description": "Nama skill (contoh: 'simgos2-bpjs-vclaim', 'simgos2-frontend-extjs')"
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
