use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    pub method: String,
    pub params: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<serde_json::Value>,
}

/// Unified MCP Hub HTTP/SSE and Named Pipe Server
pub async fn start_mcp_server() {
    let (tx, _) = broadcast::channel::<String>(100);
    let tx_arc = Arc::new(tx);

    // 1. Start HTTP/SSE Server on 127.0.0.1:9126 (Universal for all IDEs)
    let sse_tx = tx_arc.clone();
    tokio::spawn(async move {
        start_http_sse_server(sse_tx).await;
    });

    // 2. Start Windows Named Pipe listener on \\.\pipe\hhg-bridge (if on Windows)
    #[cfg(windows)]
    {
        tokio::spawn(async move {
            start_named_pipe_server().await;
        });
    }
}

async fn start_http_sse_server(tx: Arc<broadcast::Sender<String>>) {
    let addr = "127.0.0.1:9126";
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => {
            println!("[Unified MCP Hub] HTTP/SSE Server running on http://{}/sse", addr);
            l
        }
        Err(e) => {
            eprintln!("[Unified MCP Hub] Gagal bind HTTP/SSE di {}: {}", addr, e);
            return;
        }
    };

    loop {
        if let Ok((mut stream, _)) = listener.accept().await {
            let tx_clone = tx.clone();
            tokio::spawn(async move {
                handle_http_client(&mut stream, tx_clone).await;
            });
        }
    }
}

async fn handle_http_client(stream: &mut TcpStream, tx: Arc<broadcast::Sender<String>>) {
    let mut buffer = [0u8; 8192];
    let n = match stream.read(&mut buffer).await {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request_str = String::from_utf8_lossy(&buffer[..n]);
    let mut lines = request_str.lines();
    let first_line = lines.next().unwrap_or("");
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }

    let method = parts[0];
    let path = parts[1];

    if method == "GET" && (path == "/sse" || path.starts_with("/sse?")) {
        // Handle SSE endpoint
        let session_id = "default";
        let headers = "HTTP/1.1 200 OK\r\n\
Content-Type: text/event-stream\r\n\
Cache-Control: no-cache\r\n\
Connection: keep-alive\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Headers: *\r\n\r\n";
        if stream.write_all(headers.as_bytes()).await.is_err() {
            return;
        }

        // Send endpoint event as per MCP SSE spec
        let endpoint_event = format!("event: endpoint\r\ndata: /message?session_id={}\r\n\r\n", session_id);
        if stream.write_all(endpoint_event.as_bytes()).await.is_err() {
            return;
        }

        let mut rx = tx.subscribe();
        while let Ok(msg) = rx.recv().await {
            let sse_msg = format!("event: message\r\ndata: {}\r\n\r\n", msg);
            if stream.write_all(sse_msg.as_bytes()).await.is_err() {
                break;
            }
        }
    } else if method == "POST" && (path == "/message" || path.starts_with("/message?")) {
        // Handle incoming JSON-RPC POST from IDE
        let mut body = "";
        if let Some(pos) = request_str.find("\r\n\r\n") {
            body = &request_str[pos + 4..];
        }

        if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(body.trim()) {
            let res = process_jsonrpc_request(req).await;
            if let Ok(res_str) = serde_json::to_string(&res) {
                // Broadcast response via SSE stream
                let _ = tx.send(res_str.clone());

                // HTTP 202 Accepted response for POST
                let http_res = "HTTP/1.1 202 Accepted\r\n\
Content-Type: application/json\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Headers: *\r\n\
Content-Length: 0\r\n\r\n";
                let _ = stream.write_all(http_res.as_bytes()).await;
            }
        } else {
            let bad_res = "HTTP/1.1 400 Bad Request\r\n\r\n";
            let _ = stream.write_all(bad_res.as_bytes()).await;
        }
    } else if method == "OPTIONS" {
        let cors_res = "HTTP/1.1 200 OK\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
Content-Length: 0\r\n\r\n";
        let _ = stream.write_all(cors_res.as_bytes()).await;
    } else {
        let not_found = "HTTP/1.1 404 Not Found\r\n\r\n";
        let _ = stream.write_all(not_found.as_bytes()).await;
    }
}

#[cfg(windows)]
async fn start_named_pipe_server() {
    use tokio::net::windows::named_pipe::ServerOptions;

    let pipe_name = r"\\.\pipe\hhg-bridge";
    println!("[Unified MCP Hub] Initializing Named Pipe listener on {}...", pipe_name);

    loop {
        let server = match ServerOptions::new()
            .first_pipe_instance(false)
            .create(pipe_name)
        {
            Ok(s) => s,
            Err(_) => {
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                continue;
            }
        };

        if let Err(_) = server.connect().await {
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
                if !trimmed.is_empty() {
                    if let Ok(req) = serde_json::from_str::<JsonRpcRequest>(trimmed) {
                        let res = process_jsonrpc_request(req).await;
                        if let Ok(res_str) = serde_json::to_string(&res) {
                            let _ = writer.write_all(format!("{}\n", res_str).as_bytes()).await;
                            let _ = writer.flush().await;
                        }
                    }
                }
                line.clear();
            }
        });
    }
}

async fn process_jsonrpc_request(request: JsonRpcRequest) -> JsonRpcResponse {
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

    handle_mcp_call(request, &skills_dir).await
}

pub async fn handle_mcp_call(request: JsonRpcRequest, skills_dir: &PathBuf) -> JsonRpcResponse {
    let method = request.method.as_str();

    match method {
        "initialize" => {
            JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id,
                result: Some(serde_json::json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "hermes-hub-gateway",
                        "version": "0.8.0"
                    }
                })),
                error: None,
            }
        }
        "notifications/initialized" => {
            JsonRpcResponse {
                jsonrpc: "2.0".to_string(),
                id: request.id,
                result: Some(serde_json::json!({})),
                error: None,
            }
        }
        "tools/list" => {
            let tools = serde_json::json!([
                {
                    "name": "hermes_get_skill",
                    "description": "Ambil isi aturan koding / SOP spesifik (SKILL.md) dari Hermes Hub Gateway secara on-demand.",
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
                },
                {
                    "name": "execute_sql_simrs",
                    "description": "Eksekusi query SQL read-only ke Database SIMRS RSUD dr. H. Jusuf SK melalui Hermes Gateway.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "sql": {
                                "type": "string",
                                "description": "SQL query SELECT/SHOW/DESCRIBE"
                            }
                        },
                        "required": ["sql"]
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
                "execute_sql_simrs" => {
                    let sql = arguments.get("sql").and_then(|s| s.as_str()).unwrap_or("");
                    let client = reqwest::Client::new();
                    let resp = client.post("http://172.168.1.202:9125/query")
                        .json(&serde_json::json!({ "query": sql }))
                        .send()
                        .await;

                    let text_result = match resp {
                        Ok(res) => res.text().await.unwrap_or_else(|e| format!("Error response: {}", e)),
                        Err(e) => format!("Gagal menghubungi database gateway: {}", e),
                    };

                    JsonRpcResponse {
                        jsonrpc: "2.0".to_string(),
                        id: request.id,
                        result: Some(serde_json::json!({
                            "content": [{
                                "type": "text",
                                "text": text_result
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
