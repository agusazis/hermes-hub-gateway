use crate::config::{load_config, GitTarget};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
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
    let brain_dir = home.join(".gemini").join("antigravity-ide").join("brain");

    println!("[Watcher] Monitoring Antigravity Brain dir: {:?}", brain_dir);

    let mut file_offsets: HashMap<PathBuf, u64> = HashMap::new();

    loop {
        tokio::time::sleep(Duration::from_millis(2500)).await;

        if !brain_dir.exists() {
            continue;
        }

        let cfg = load_config();
        if cfg.workspaces.is_empty() {
            continue;
        }

        let active_ws = match cfg.workspaces.iter().find(|w| w.id == cfg.active_workspace_id).cloned() {
            Some(w) => w,
            None => match cfg.workspaces.first().cloned() {
                Some(first) => first,
                None => continue,
            },
        };

        if let Ok(entries) = fs::read_dir(&brain_dir) {
            for entry in entries.flatten() {
                let conv_dir = entry.path();
                if conv_dir.is_dir() {
                    // Antigravity IDE menyimpan transkrip di: <uuid>/.system_generated/logs/transcript.jsonl
                    let jsonl_path = conv_dir.join(".system_generated").join("logs").join("transcript.jsonl");
                    let path = if jsonl_path.exists() {
                        jsonl_path
                    } else {
                        conv_dir.clone()
                    };

                    if path.is_file() {
                        let is_target = match path.extension().and_then(|s| s.to_str()) {
                            Some("jsonl") | Some("json") => true,
                            _ => false,
                        };
                        if !is_target {
                            continue;
                        }

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

                                let conv_id = entry.file_name().to_string_lossy().to_string();

                                let _ = app.emit("watcher-event", serde_json::json!({
                                    "status": "evaluating",
                                    "conversation_id": conv_id,
                                    "file": path.to_string_lossy()
                                }));

                            // Kirimkan ke Hermes Evaluator
                            let payload = ReviewRequestPayload {
                                client: "hermes-hub-gateway".to_string(),
                                profile_id: cfg.active_profile.clone(),
                                workspace_id: active_ws.id.clone(),
                                conversation_id: conv_id.clone(),
                                transcript_tail: tail_window.to_string(),
                                git_target: active_ws.git_target.clone(),
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
}

pub async fn sync_rules_from_git(ws: &crate::config::Workspace) {
    let internal_path = PathBuf::from(&ws.internal_skills_path);
    let _ = fs::create_dir_all(&internal_path);
    println!("[Git Sync] Synchronizing rules for workspace {} at {:?}", ws.id, internal_path);

    if let Some(git) = &ws.git_target {
        let git_dir_check = internal_path.join(".git");
        let mut git_success = false;

        if git_dir_check.exists() {
            println!("[Git Sync] Running git pull origin {}", git.target_branch);
            let res = tokio::process::Command::new("git")
                .arg("-C")
                .arg(&internal_path)
                .args(&["pull", "origin", &git.target_branch])
                .output()
                .await;
            if let Ok(out) = res {
                if out.status.success() {
                    git_success = true;
                }
            }
        } else if !git.repo_url.trim().is_empty() {
            println!("[Git Sync] Running git clone into {:?}", internal_path);
            let mut clone_url = git.repo_url.clone();
            if !git.auth_token.trim().is_empty() && clone_url.starts_with("http") {
                let parts: Vec<&str> = clone_url.split("://").collect();
                if parts.len() == 2 {
                    clone_url = format!("{}://oauth2:{}@{}", parts[0], git.auth_token.trim(), parts[1]);
                }
            }
            let res = tokio::process::Command::new("git")
                .args(&["clone", "-b", &git.target_branch, &clone_url, &internal_path.to_string_lossy()])
                .output()
                .await;
            if let Ok(out) = res {
                if out.status.success() {
                    git_success = true;
                }
            }
        }

        // OTOMASI LOCAL DEVELOPER PROFILE:
        // Jika USER.md belum ada tapi USER.md.example ada di repository, salin menjadi USER.md
        let user_md = internal_path.join("USER.md");
        let user_md_example = internal_path.join("USER.md.example");
        if !user_md.exists() && user_md_example.exists() {
            let _ = fs::copy(&user_md_example, &user_md);
            println!("[Git Sync] Automatically instantiated USER.md from USER.md.example");
        }

        // STANDAR STRUKTUR HERMES EVALUATOR:
        // Seluruh skill harus berada di subfolder `skills/<skill_name>/SKILL.md`
        let skills_root = internal_path.join("skills");
        let _ = fs::create_dir_all(&skills_root);

        // Jika git clone meletakkan skill langsung di internal_path (tanpa subfolder skills/),
        // reorganisasi otomatis agar selalu sesuai standar Evaluator:
        if let Ok(entries) = std::fs::read_dir(&internal_path) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    let dir_name = p.file_name().and_then(|n| n.to_str()).unwrap_or_default();
                    if dir_name != "skills" && dir_name != ".git" && p.join("SKILL.md").exists() {
                        let target = skills_root.join(dir_name);
                        if !target.exists() {
                            let _ = std::fs::rename(&p, &target);
                        }
                    }
                }
            }
        }

        let skill_count = std::fs::read_dir(&skills_root)
            .map(|entries| {
                entries
                    .flatten()
                    .filter(|e| e.path().is_dir() && e.path().join("SKILL.md").exists())
                    .count()
            })
            .unwrap_or(0);

        if !git_success || skill_count < 10 {
            println!("[Git Sync] Local skill count in standard skills/ is {} (< 10). Fetching via GitLab REST API...", skill_count);
            if let Ok(client) = reqwest::Client::builder().timeout(Duration::from_secs(20)).build() {
                let host = git.repo_url.split("/").take(3).collect::<Vec<&str>>().join("/");
                let project_identifier = if !git.project_id.trim().is_empty() {
                    git.project_id.clone()
                } else {
                    let parts: Vec<&str> = git.repo_url.trim_end_matches(".git").split('/').collect();
                    if parts.len() >= 2 {
                        format!("{}%2F{}", parts[parts.len()-2], parts[parts.len()-1])
                    } else {
                        "84".to_string()
                    }
                };

                let tree_url = format!("{}/api/v4/projects/{}/repository/tree?path=skills&ref={}&recursive=true&per_page=100", host, project_identifier, git.target_branch);
                let mut req = client.get(&tree_url);
                if !git.auth_token.trim().is_empty() {
                    req = req.header("PRIVATE-TOKEN", git.auth_token.trim());
                }

                if let Ok(resp) = req.send().await {
                    if let Ok(tree) = resp.json::<Vec<serde_json::Value>>().await {
                        for item in tree {
                            if item.get("type").and_then(|t| t.as_str()) == Some("blob") {
                                if let Some(path_str) = item.get("path").and_then(|p| p.as_str()) {
                                    // path_str contoh: "skills/simgos2-db-audit/SKILL.md"
                                    let rel_sub = path_str.strip_prefix("skills/").unwrap_or(path_str);
                                    let dest_file = skills_root.join(rel_sub);
                                    if let Some(parent) = dest_file.parent() {
                                        let _ = fs::create_dir_all(parent);
                                    }

                                    let encoded_file = path_str.replace('/', "%2F");
                                    let raw_url = format!("{}/api/v4/projects/{}/repository/files/{}/raw?ref={}", host, project_identifier, encoded_file, git.target_branch);
                                    let mut f_req = client.get(&raw_url);
                                    if !git.auth_token.trim().is_empty() {
                                        f_req = f_req.header("PRIVATE-TOKEN", git.auth_token.trim());
                                    }
                                    if let Ok(f_resp) = f_req.send().await {
                                        if let Ok(bytes) = f_resp.bytes().await {
                                            let _ = fs::write(&dest_file, &bytes);
                                        }
                                    }
                                }
                            }
                        }
                        println!("[Git Sync] Direct REST API sync completed into standard {:?}", skills_root);
                    }
                }
            }
        }
    }
}

