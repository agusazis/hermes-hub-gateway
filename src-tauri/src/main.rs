#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, Emitter, WindowEvent};
use std::path::PathBuf;

mod watcher;
mod mcp_bridge;
mod vault;
mod config;
mod workspace;

#[tauri::command]
fn get_system_config() -> config::GlobalConfig {
    config::load_config()
}

#[tauri::command]
async fn select_project_folder() -> Result<Option<String>, String> {
    #[cfg(windows)]
    {
        let output = tokio::process::Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Pilih Folder Project Target'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"
            ])
            .output()
            .await;

        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return Ok(Some(res));
            }
        }
        Ok(None)
    }
    #[cfg(not(windows))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn save_system_config(cfg: config::GlobalConfig) -> Result<(), String> {
    // ATURAN TEGAS: Server Hermes Evaluator dan Server Mnemosyne WAJIB satu host IP yang sama!
    let eval_host = cfg.default_hermes_evaluator_url.split(':').nth(1).unwrap_or("").trim_start_matches('/');
    let mnemo_host = cfg.default_mnemosyne_url.split(':').nth(1).unwrap_or("").trim_start_matches('/');
    
    if !eval_host.is_empty() && !mnemo_host.is_empty() && eval_host != mnemo_host {
        return Err(format!(
            "Pelanggaran Integritas Arsitektur: Host Hermes Evaluator ('{}') dan Host Mnemosyne ('{}') tidak sama! Otak dan Memori wajib berada di server fisik/VM yang sama.",
            eval_host, mnemo_host
        ));
    }

    config::save_config(&cfg);
    Ok(())
}

#[tauri::command]
fn update_tray_status(app: tauri::AppHandle, tooltip: String, unread_count: u32) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let display_tooltip = if unread_count > 0 {
            format!("Hermes Hub Gateway ({} update baru)\n{}", unread_count, tooltip)
        } else {
            "Hermes Hub Gateway (Active Background)".to_string()
        };
        let _ = tray.set_tooltip(Some(display_tooltip));
    }
    Ok(())
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
    if url.trim().is_empty() {
        return Ok(());
    }
    let target = url.trim().to_string();
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("cmd")
            .args(&["/c", "start", "", &target])
            .spawn()
            .map_err(|e| format!("Gagal membuka browser Windows: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Gagal membuka browser macOS: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Gagal membuka browser Linux: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn remove_workspace_junction(target_path: String) -> Result<(), String> {
    if target_path.trim().is_empty() {
        return Ok(());
    }
    let p = PathBuf::from(target_path.trim());
    let junc = p.join(".agents");
    workspace::remove_ntfs_junction(&junc)
}

#[tauri::command]
fn reset_system_config() -> Result<config::GlobalConfig, String> {
    let clean_cfg = config::GlobalConfig::default();
    config::save_config(&clean_cfg);
    Ok(clean_cfg)
}

#[tauri::command]
fn get_skill_detail(workspace_id: String, skill_name: String) -> Result<serde_json::Value, String> {
    let cfg = config::load_config();
    let ws = match cfg.workspaces.iter().find(|w| w.id == workspace_id).cloned() {
        Some(w) => w,
        None => {
            if let Some(first) = cfg.workspaces.first().cloned() {
                first
            } else {
                return Ok(serde_json::json!({
                    "name": skill_name,
                    "content": format!("# {}\n\nBelum ada workspace yang dikonfigurasi.", skill_name),
                    "references": []
                }));
            }
        }
    };
    let raw_internal = PathBuf::from(&ws.internal_skills_path);
    // Jika repositori memiliki subfolder skills/, gunakan subfolder tersebut sebagai root skills
    let internal_path = if raw_internal.join("skills").is_dir() {
        raw_internal.join("skills")
    } else {
        raw_internal
    };

    let skill_dir = internal_path.join(&skill_name);

    let skill_file = skill_dir.join("SKILL.md");
    let content = if skill_file.exists() {
        std::fs::read_to_string(&skill_file).unwrap_or_else(|_| "Gagal membaca berkas SKILL.md dari disk.".to_string())
    } else {
        format!("# Skill: {}\n\nBerkas `SKILL.md` belum tersinkronisasi atau tidak ditemukan di direktori internal:\n`{:?}`\n\nSilakan jalankan `Sync Rules Now` untuk mengunduh berkas fisik asli dari GitLab.", skill_name, skill_dir)
    };

    let mut references = Vec::new();
    let ref_dir = skill_dir.join("references");
    if ref_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(ref_dir) {
            for e in entries.flatten() {
                if let Some(n) = e.file_name().to_str() {
                    references.push(n.to_string());
                }
            }
        }
    }

    Ok(serde_json::json!({
        "name": skill_name,
        "content": content,
        "references": references,
        "path": skill_dir.to_string_lossy().to_string()
    }))
}

#[tauri::command]
fn get_skill_reference_content(workspace_id: String, skill_name: String, reference_file: String) -> Result<serde_json::Value, String> {
    let cfg = config::load_config();
    let ws = match cfg.workspaces.iter().find(|w| w.id == workspace_id).cloned() {
        Some(w) => w,
        None => match cfg.workspaces.first().cloned() {
            Some(first) => first,
            None => {
                return Ok(serde_json::json!({
                    "file_name": reference_file,
                    "content": format!("# {}\n\nWorkspace tidak ditemukan.", reference_file)
                }));
            }
        }
    };

    let raw_internal = PathBuf::from(&ws.internal_skills_path);
    let internal_path = if raw_internal.join("skills").is_dir() {
        raw_internal.join("skills")
    } else {
        raw_internal
    };

    let ref_path = internal_path
        .join(&skill_name)
        .join("references")
        .join(&reference_file);

    let content = if ref_path.exists() {
        std::fs::read_to_string(&ref_path).unwrap_or_else(|_| "Gagal membaca berkas referensi fisik dari disk.".to_string())
    } else {
        format!("# Referensi Teknis: {}\n\nBerkas referensi belum tersinkronisasi ke disk lokal:\n`{:?}`\n\nSilakan jalankan `Sync Rules Now`.", reference_file, ref_path)
    };

    Ok(serde_json::json!({
        "file_name": reference_file,
        "content": content
    }))
}

#[tauri::command]
fn create_workspace_declarative(name: String, target_path: String) -> Result<config::Workspace, String> {
    let mut cfg = config::load_config();
    let id = name.to_lowercase().replace(' ', "-");

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    let internal_skills_path = home
        .join(".hermes-hub")
        .join("workspaces")
        .join(&id)
        .join("skills");

    let _ = std::fs::create_dir_all(&internal_skills_path);

    let ws = config::Workspace {
        id: id.clone(),
        name,
        target_path: target_path.clone(),
        internal_skills_path: internal_skills_path.to_string_lossy().to_string(),
        hermes_evaluator_url: cfg.default_hermes_evaluator_url.clone(),
        mnemosyne_url: cfg.default_mnemosyne_url.clone(),
        git_target: None,
    };

    let target_dir = PathBuf::from(&target_path);
    if target_dir.exists() {
        // Fasilitasi NTFS junction ke internal_skills_path (.agents)
        let agents_junction = target_dir.join(".agents");
        let _ = workspace::create_ntfs_junction(&agents_junction, &internal_skills_path);
    }

    // Periksa apakah workspace dengan ID ini sudah ada untuk mencegah duplikasi entri
    if let Some(pos) = cfg.workspaces.iter().position(|w| w.id == id) {
        cfg.workspaces[pos] = ws.clone();
    } else {
        cfg.workspaces.push(ws.clone());
    }
    cfg.active_workspace_id = id;
    config::save_config(&cfg);

    Ok(ws)
}

#[tauri::command]
async fn trigger_manual_sync() -> serde_json::Value {
    let cfg = config::load_config();
    let ws = match cfg.workspaces.iter().find(|w| w.id == cfg.active_workspace_id).cloned() {
        Some(w) => w,
        None => {
            if let Some(first) = cfg.workspaces.first().cloned() {
                first
            } else {
                return serde_json::json!({
                    "success": false,
                    "message": "Belum ada workspace yang dikonfigurasi untuk disinkronkan."
                });
            }
        }
    };
    
    // Sinkronkan secara langsung (await) agar selesai sebelum response dikembalikan ke frontend
    watcher::sync_rules_from_git(&ws).await;

    serde_json::json!({
        "success": true,
        "message": "Sinkronisasi aturan dan SOP dari GitLab/GitHub berhasil dijalankan."
    })
}

#[tauri::command]
async fn test_telegram_broadcast(bot_token: String, chat_id: String, topic_id: Option<String>) -> Result<serde_json::Value, String> {
    if bot_token.trim().is_empty() || chat_id.trim().is_empty() {
        return Err("Bot Token dan Target Chat ID wajib diisi.".to_string());
    }

    let clean_token = bot_token.trim();
    let url = format!("https://api.telegram.org/bot{}/sendMessage", clean_token);

    let mut body = serde_json::json!({
        "chat_id": chat_id.trim(),
        "text": "🚀 [Hermes Hub Gateway] Uji koneksi notifikasi broadcast bot Telegram berhasil terhubung! Status: READY.",
        "parse_mode": "HTML"
    });

    if let Some(t_id) = topic_id {
        if !t_id.trim().is_empty() {
            if let Ok(topic_num) = t_id.trim().parse::<i64>() {
                body["message_thread_id"] = serde_json::json!(topic_num);
            }
        }
    }

    let client = reqwest::Client::new();
    let res = client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Koneksi jaringan ke Telegram gagal: {}", e))?;

    let status = res.status();
    let resp_text = res.text().await.unwrap_or_default();

    if status.is_success() {
        Ok(serde_json::json!({
            "success": true,
            "message": format!("✓ Pesan Telegram berhasil dikirim ke Chat ID {}!", chat_id)
        }))
    } else {
        Err(format!("Telegram API Error (HTTP {}): {}", status.as_u16(), resp_text))
    }
}

#[tauri::command]
fn get_skills_hierarchy(workspace_id: String) -> Result<Vec<serde_json::Value>, String> {
    let cfg = config::load_config();
    let ws = match cfg.workspaces.iter().find(|w| w.id == workspace_id).cloned() {
        Some(w) => w,
        None => {
            if let Some(first) = cfg.workspaces.first().cloned() {
                first
            } else {
                return Ok(Vec::new());
            }
        }
    };
    let raw_internal = PathBuf::from(&ws.internal_skills_path);
    // STANDAR STRUKTUR EVALUATOR:
    // Selalu gunakan subfolder skills/ jika ada atau gunakan raw_internal jika di dalamnya terdapat subfolder ber-SKILL.md
    let internal_path = if raw_internal.join("skills").is_dir() {
        raw_internal.join("skills")
    } else {
        raw_internal
    };

    let mut result = Vec::new();

    if internal_path.exists() {
        if let Ok(entries) = std::fs::read_dir(&internal_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let skill_name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_string();
                    if skill_name.starts_with(".") || skill_name == "specialists" || skill_name == "tools" || skill_name == "rules" || skill_name == "memory" || skill_name == "skills" {
                        continue;
                    }

                    let skill_md = path.join("SKILL.md");
                    if !skill_md.exists() {
                        continue;
                    }

                    let ref_dir = path.join("references");
                    let mut references = Vec::new();
                    if ref_dir.exists() {
                        if let Ok(ref_entries) = std::fs::read_dir(ref_dir) {
                            for re in ref_entries.flatten() {
                                if let Some(rn) = re.file_name().to_str() {
                                    if !rn.starts_with(".") {
                                        references.push(rn.to_string());
                                    }
                                }
                            }
                        }
                    }

                    let mut desc = format!("Aturan koding otomatis tersinkron dari repository {}", ws.name);
                    if let Ok(content) = std::fs::read_to_string(&skill_md) {
                        for line in content.lines() {
                            let trimmed = line.trim();
                            if trimmed.starts_with("# ") {
                                desc = trimmed.trim_start_matches("# ").trim().to_string();
                                break;
                            } else if trimmed.starts_with("description:") {
                                desc = trimmed.trim_start_matches("description:").trim().trim_matches('"').trim_matches('\'').to_string();
                                break;
                            }
                        }
                    }

                    result.push(serde_json::json!({
                        "name": skill_name,
                        "workspace_id": ws.id,
                        "category": "core",
                        "author": "agus",
                        "created_at": "2026-10-18",
                        "desc": desc,
                        "references": references
                    }));
                }
            }
        }
    }

    Ok(result)
}

#[tauri::command]
async fn test_gateway_connection(evaluator_url: String, mnemosyne_url: String) -> Result<serde_json::Value, String> {
    if evaluator_url.trim().is_empty() || mnemosyne_url.trim().is_empty() {
        return Err("URL Evaluator dan URL Mnemosyne wajib diisi.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(3500))
        .build()
        .map_err(|e| e.to_string())?;

    // Check Evaluator API
    let eval_url = if evaluator_url.ends_with('/') {
        format!("{}health", evaluator_url)
    } else {
        format!("{}/health", evaluator_url)
    };
    let eval_res = client.get(&eval_url).send().await;
    let eval_status = match eval_res {
        Ok(r) if r.status().is_success() => "ONLINE (HTTP 200)".to_string(),
        Ok(r) => format!("HTTP {}", r.status().as_u16()),
        Err(e) => format!("Gagal: {}", e)
    };

    // Check Mnemosyne Shared Memory Server
    let mnemo_res = client.get(&mnemosyne_url).send().await;
    let mnemo_status = match mnemo_res {
        Ok(r) if r.status().is_success() => "ONLINE (HTTP 200)".to_string(),
        Ok(r) if r.status().as_u16() == 404 => "ONLINE (Service Reachable)".to_string(),
        Ok(r) => format!("HTTP {}", r.status().as_u16()),
        Err(e) => format!("Gagal: {}", e)
    };

    Ok(serde_json::json!({
        "success": true,
        "evaluator_status": eval_status,
        "mnemosyne_status": mnemo_status,
        "message": format!("Hasil Koneksi Nyata -> Evaluator: {}, Mnemosyne: {}", eval_status, mnemo_status)
    }))
}

#[tauri::command]
async fn test_git_remote(repo_url: String, auth_token: Option<String>) -> Result<serde_json::Value, String> {
    if repo_url.trim().is_empty() {
        return Err("URL Git remote wajib diisi.".to_string());
    }

    let mut target_url = repo_url.trim().to_string();
    if let Some(token) = auth_token {
        if !token.trim().is_empty() && target_url.starts_with("http") {
            let parts: Vec<&str> = target_url.split("://").collect();
            if parts.len() == 2 {
                target_url = format!("{}://oauth2:{}@{}", parts[0], token.trim(), parts[1]);
            }
        }
    }

    let output = tokio::process::Command::new("git")
        .args(&["ls-remote", &target_url, "HEAD"])
        .output()
        .await;

    match output {
        Ok(out) => {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let head_ref = stdout.lines().next().unwrap_or("HEAD").chars().take(12).collect::<String>();
                Ok(serde_json::json!({
                    "success": true,
                    "message": format!("✓ Terhubung ke Git Remote! Commit HEAD: {}", head_ref)
                }))
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                Err(format!("Git error: {}", stderr.trim()))
            }
        },
        Err(e) => Err(format!("Gagal mengeksekusi git CLI: {}", e))
    }
}

#[tauri::command]
async fn list_git_projects(provider: String, base_url: String, token: String) -> Result<Vec<workspace::GitProjectItem>, String> {
    workspace::list_remote_projects(&provider, &base_url, &token).await
}

#[tauri::command]
fn check_workspace_readiness(project_path: String) -> workspace::WorkspaceReadinessReport {
    workspace::audit_workspace_readiness(&PathBuf::from(project_path))
}

#[tauri::command]
fn scaffold_new_agents_project(dest_path: String, project_name: String) -> Result<(), String> {
    workspace::scaffold_new_agents_structure(&PathBuf::from(dest_path), &project_name)
}

#[tauri::command]
fn link_workspace_junction(project_path: String, agents_source_path: String) -> Result<(), String> {
    let link = PathBuf::from(project_path).join(".agents");
    let target = PathBuf::from(agents_source_path);
    workspace::create_ntfs_junction(&link, &target)
}

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Saat instance kedua diluncurkan (misal user klik lagi icon di desktop):
            // Jangan exit diam-diam! Bawa jendela instance utama yang sedang jalan di tray ke layar depan!
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let app_handle = app.handle().clone();

            let show_i = MenuItem::with_id(app, "show", "Buka Dashboard", true, None::<&str>)?;
            let sync_i = MenuItem::with_id(app, "sync", "Reload & Sync Rules", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Stop & Keluar Aplikasi", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sync_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray").menu(&menu);
            if let Some(default_icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(default_icon.clone());
            }
            let _tray = tray_builder
                .show_menu_on_left_click(false)
                .tooltip("Hermes Hub Gateway (Active Background)")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "sync" => {
                        let _ = app.emit("tray-sync-clicked", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            let handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                                // Auto-sync rules dari Git repositori saat startup
                let initial_cfg = config::load_config();
                if let Some(active_ws) = initial_cfg.workspaces.iter().find(|w| w.id == initial_cfg.active_workspace_id) {
                    watcher::sync_rules_from_git(active_ws).await;
                }
                watcher::start_watcher_loop(handle_clone).await;
            });

            tauri::async_runtime::spawn(async move {
                mcp_bridge::start_mcp_server().await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_system_config,
            select_project_folder,
            save_system_config,
            reset_system_config,
            get_skill_detail,
            get_skill_reference_content,
            create_workspace_declarative,
            trigger_manual_sync,
            test_telegram_broadcast,
            get_skills_hierarchy,
            test_gateway_connection,
            test_git_remote,
            list_git_projects,
            check_workspace_readiness,
            scaffold_new_agents_project,
            link_workspace_junction,
            remove_workspace_junction,
            open_in_browser,
            update_tray_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hermes Hub Gateway application");
}
