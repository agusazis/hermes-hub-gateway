// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, Emitter};

mod watcher;
mod mcp_bridge;
mod vault;
mod config;

#[tauri::command]
fn get_system_status() -> serde_json::Value {
    serde_json::json!({
        "status": "online",
        "hermes_server": "172.168.1.202:9125",
        "mnemosyne_server": "172.168.1.202:8080",
        "active_workspace": "simgos2",
        "total_skills": 12
    })
}

#[tauri::command]
fn trigger_manual_sync() -> serde_json::Value {
    serde_json::json!({
        "success": true,
        "message": "Aturan dan SOP sudah versi terbaru (Up-to-Date)."
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
        .invoke_handler(tauri::generate_handler![get_system_status, trigger_manual_sync])
        .run(tauri::generate_context!())
        .expect("error while running Hermes Hub Gateway application");
}
