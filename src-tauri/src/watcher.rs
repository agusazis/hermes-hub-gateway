use crate::config::{load_config, GitTarget, TelegramTarget};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReviewRequestPayload {
    pub client: String,
    pub profile_id: String,
    pub workspace_id: String,
    pub conversation_id: String,
    pub transcript_tail: String,
    pub git_target: Option<GitTarget>,
    pub telegram_target: Option<TelegramTarget>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ReviewResponsePayload {
    pub status: String,
    pub has_lesson: bool,
    pub skill_name: Option<String>,
    pub commit_message: Option<String>,
}

pub async fn start_watcher_loop(app: AppHandle) {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    let brain_dir = home.join(".gemini\\antigravity-ide\\brain");

    println!("[Watcher] Monitoring Antigravity Brain dir: {:?}", brain_dir);

    let mut file_offsets: HashMap<PathBuf, u64> = HashMap::new();

    loop {
        tokio::time::sleep(Duration::from_millis(2500)).await;

        if !brain_dir.exists() {
            continue;
        }

        let cfg = load_config();
        let active_ws = cfg
            .workspaces
            .iter()
            .find(|w| w.id == cfg.active_workspace_id)
            .cloned()
            .unwrap_or_else(|| cfg.workspaces[0].clone());

        if let Ok(entries) = fs::read_dir(&brain_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                    let metadata = match fs::metadata(&path) {
                        Ok(m) => m,
                        Err(_) => continue,
                    };
                    let len = metadata.len();
                    let last_len = file_offsets.get(&path).copied().unwrap_or(0);

                    if len > last_len && last_len > 0 {
                        // File bertambah panjang, baca transkrip baru
                        if let Ok(content) = fs::read_to_string(&path) {
                            if content.contains("_DO_NOT_CAPTURE_BLOCK") {
                                file_offsets.insert(path.clone(), len);
                                continue;
                            }

                            let tail_window = if content.len() > 12000 {
                                &content[content.len() - 12000..]
                            } else {
                                &content[..]
                            };

                            let conv_id = path
                                .file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("unknown")
                                .to_string();

                            let _ = app.emit("watcher-event", serde_json::json!({
                                "status": "evaluating",
                                "conversation_id": conv_id,
                                "file": path.to_string_lossy()
                            }));

                            // Kirimkan ke Hermes Evaluator beserta Telegram broadcast metadata
                            let payload = ReviewRequestPayload {
                                client: "hermes-hub-gateway".to_string(),
                                profile_id: cfg.active_profile.clone(),
                                workspace_id: active_ws.id.clone(),
                                conversation_id: conv_id.clone(),
                                transcript_tail: tail_window.to_string(),
                                git_target: active_ws.git_target.clone(),
                                telegram_target: cfg.telegram_target.clone(),
                            };

                            let evaluator_url = format!("{}/review", active_ws.hermes_evaluator_url.trim_end_matches('/'));
                            let client = reqwest::Client::builder()
                                .timeout(Duration::from_secs(45))
                                .build()
                                .unwrap_or_default();

                            let res = client.post(&evaluator_url).json(&payload).send().await;

                            match res {
                                Ok(response) => {
                                    if let Ok(review_res) = response.json::<ReviewResponsePayload>().await {
                                        if review_res.has_lesson {
                                            let skill = review_res.skill_name.unwrap_or_else(|| "new-rule".to_string());
                                            println!("[Watcher] Lesson learned detected: {}", skill);

                                            let _ = app.emit("lesson-learned", serde_json::json!({
                                                "skill_name": skill,
                                                "commit": review_res.commit_message,
                                                "time": Utc::now().to_rfc3339()
                                            }));

                                            // Auto-pull rules ke internal storage HHG
                                            sync_rules_from_git(&active_ws).await;
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[Watcher] Failed to send review payload: {}", e);
                                }
                            }
                        }
                    }

                    file_offsets.insert(path, len);
                }
            }
        }
    }
}

pub async fn sync_rules_from_git(ws: &crate::config::Workspace) {
    let internal_path = PathBuf::from(&ws.internal_skills_path);
    let _ = fs::create_dir_all(&internal_path);
    println!("[Git Sync] Synchronizing rules for workspace {} at {:?}", ws.id, internal_path);
}
