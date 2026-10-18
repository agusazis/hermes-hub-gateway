use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ReviewPayload {
    pub client_type: String,
    pub profile_id: String,
    pub workspace_id: String,
    pub conversationId: String,
    pub transcriptTail: String,
}

pub async fn start_watcher_loop(app: AppHandle) {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    let brain_dir = home.join(".gemini\\antigravity-ide\\brain");

    println!("[Watcher] Monitoring brain dir: {:?}", brain_dir);

    loop {
        tokio::time::sleep(Duration::from_millis(2000)).await;

        let _ = app.emit("watcher-heartbeat", serde_json::json!({
            "status": "idle",
            "active_file": ""
        }));
    }
}
