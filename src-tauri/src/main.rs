#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, Emitter};
use std::path::PathBuf;

mod watcher;
mod mcp_bridge;
mod vault;
mod config;

#[tauri::command]
fn get_system_config() -> config::GlobalConfig {
    config::load_config()
}

#[tauri::command]
fn save_system_config(cfg: config::GlobalConfig) -> Result<(), String> {
    config::save_config(&cfg);
    Ok(())
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

    // Buat AGENTS.md deklaratif di folder project target
    let target_dir = PathBuf::from(&target_path);
    if target_dir.exists() {
        let _ = config::generate_declarative_agents_md(&target_dir, &ws);
    }

    cfg.workspaces.push(ws.clone());
    cfg.active_workspace_id = id;
    config::save_config(&cfg);

    Ok(ws)
}

#[tauri::command]
fn trigger_manual_sync() -> serde_json::Value {
    let cfg = config::load_config();
    let ws = cfg.workspaces.iter().find(|w| w.id == cfg.active_workspace_id).cloned().unwrap_or_else(|| cfg.workspaces[0].clone());
    
    tauri::async_runtime::spawn(async move {
        watcher::sync_rules_from_git(&ws).await;
    });

    serde_json::json!({
        "success": true,
        "message": "Sinkronisasi aturan dan SOP dari GitLab/GitHub berhasil dijalankan."
    })
}

#[tokio::main]
async fn main() {
    #[cfg(windows)]
    {
        use windows::core::w;
        use windows::Win32::Foundation::GetLastError;
        use windows::Win32::System::Threading::CreateMutexW;

        unsafe {
            let _ = CreateMutexW(None, true, w!("Global\\HermesHubGateway_SingleInstance"));
            if GetLastError().0 == 183 {
                eprintln!("[!] Hermes Hub Gateway already running. Exiting duplicate instance.");
                std::process::exit(0);
            }
        }
    }

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();

            let quit_i = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open Dashboard", true, None::<&str>)?;
            let sync_i = MenuItem::with_id(app, "sync", "Sync Rules Now", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sync_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "sync" => {
                        let _ = app.emit("tray-sync-clicked", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            let handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                watcher::start_watcher_loop(handle_clone).await;
            });

            tauri::async_runtime::spawn(async move {
                mcp_bridge::start_mcp_server().await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_config,
            save_system_config,
            create_workspace_declarative,
            trigger_manual_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hermes Hub Gateway application");
}
