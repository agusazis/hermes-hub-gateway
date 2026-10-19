#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, Emitter, WindowEvent};
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
fn get_skill_detail(workspace_id: String, skill_name: String) -> Result<serde_json::Value, String> {
    let cfg = config::load_config();
    let ws = cfg.workspaces.iter().find(|w| w.id == workspace_id).cloned().unwrap_or_else(|| cfg.workspaces[0].clone());
    let skill_dir = PathBuf::from(&ws.internal_skills_path).join(&skill_name);

    let skill_file = skill_dir.join("SKILL.md");
    let content = if skill_file.exists() {
        std::fs::read_to_string(&skill_file).unwrap_or_else(|_| "Gagal membaca berkas SKILL.md".to_string())
    } else {
        let mut doc = format!("# Skill: {}\n\n", skill_name);
        doc.push_str("## Standar Operasional Prosedur (SOP) & Blueprint Koding\n");
        doc.push_str("Pedoman arsitektur dan kepatuhan koding terverifikasi otomatis oleh Hermes Evaluator untuk lingkungan RSUD dr. H. Jusuf SK.\n\n");
        doc.push_str("### 1. Prinsip Utama Arsitektur (Zero-Pollution Project Root)\n");
        doc.push_str("- Dilarang mengotori root folder proyek (simgos2 dll) dengan file konfigurasi selain deklarasi standar `AGENTS.md`.\n");
        doc.push_str("- Seluruh dependensi dan tool calling diisolasi melalui Named Pipe bridge `\\\\.\\pipe\\hhg-bridge`.\n\n");
        
        if skill_name.contains("bpjs") || skill_name.contains("vclaim") {
            doc.push_str("### 2. Protokol Integrasi BPJS Kesehatan VClaim 2.0\n");
            doc.push_str("- **Otentikasi**: Signature HMAC-SHA256 (ConsID + SecretKey + Unix Timestamp).\n");
            doc.push_str("- **Dekompresi Payload**: Respons terenkripsi didekripsi menggunakan LZ-String Decompress.\n");
            doc.push_str("- **Format Tanggal SEP**: Wajib berformat `YYYY-MM-DD` dengan kode PPK rujukan 8 digit.\n\n");
            doc.push_str("```json\n{\n  \"request\": {\n    \"t_sep\": {\n      \"noKartu\": \"0001234567890\",\n      \"tglSep\": \"2026-10-19\",\n      \"ppkPelayanan\": \"1701R001\",\n      \"jnsPelayanan\": \"2\",\n      \"klsRawat\": { \"klsRawatHak\": \"3\" }\n    }\n  }\n}\n```\n");
        } else if skill_name.contains("extjs") {
            doc.push_str("### 2. Standar Frontend Ext JS 4/6 MVC & MVVM Pattern\n");
            doc.push_str("- **Penamaan Komponen**: Gunakan format terstruktur `Simgos2.view.<modul>.<namaKomponen>`.\n");
            doc.push_str("- **Memory Leak Prevention**: Selalu jalankan `store.destroy()` pada event `beforedestroy` window.\n");
            doc.push_str("- **Server-Side Paging**: Default `pageSize: 25` dengan parameter `start` dan `limit`.\n");
        } else if skill_name.contains("db-audit") || skill_name.contains("core") {
            doc.push_str("### 2. Tata Kelola Transaksi Database & Mutasi Resep Obat\n");
            doc.push_str("- **Isolasi Mutasi**: Gunakan `READ COMMITTED` untuk mencegah dirty reads pada mutasi stok farmasi.\n");
            doc.push_str("- **Pencegahan Race Condition**: Gunakan `SELECT ... FOR UPDATE` saat memvalidasi sisa fisik obat.\n");
            doc.push_str("- **Audit Logging**: Catat setiap mutasi ke tabel audit dengan merekam user ID, timestamp, dan payload.\n");
        } else if skill_name.contains("synology") {
            doc.push_str("### 2. Kebijakan Retensi Backup GFS (Grandfather-Father-Son)\n");
            doc.push_str("- **Harian (Daily)**: 7 snapshot harian dipertahankan untuk pemulihan cepat insidental.\n");
            doc.push_str("- **Mingguan (Weekly)**: 4 snapshot mingguan diambil otomatis setiap Minggu pukul 02:00 WITA.\n");
            doc.push_str("- **Bulanan (Monthly)**: 12 arsip akhir bulan disimpan permanen ke cold-storage Synology RSUD.\n");
        } else {
            doc.push_str("### 2. Tata Kelola Git & Handshake Evaluator\n");
            doc.push_str("- Seluruh commit di branch pengembangan wajib lolos evaluasi otomatis sebelum di-merge ke `main`.\n");
            doc.push_str("- Evaluator port 9125 memeriksa kepatuhan koding sebelum menandai status rilis terverifikasi.\n");
        }
        
        doc
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

#[tauri::command]
async fn test_telegram_broadcast(bot_token: String, chat_id: String, topic_id: Option<String>) -> Result<serde_json::Value, String> {
    if bot_token.trim().is_empty() || chat_id.trim().is_empty() {
        return Err("Bot Token dan Target Chat ID wajib diisi.".to_string());
    }

    let clean_token = bot_token.trim();
    let url = format!("https://api.telegram.org/bot{}/sendMessage", clean_token);

    let mut body = serde_json::json!({
        "chat_id": chat_id.trim(),
        "text": "🐴 [Hermes Hub Gateway] Uji koneksi notifikasi bot Telegram RSUD dr. H. Jusuf SK berhasil terhubung! Status: READY.",
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

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
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
            save_system_config,
            get_skill_detail,
            create_workspace_declarative,
            trigger_manual_sync,
            test_telegram_broadcast
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hermes Hub Gateway application");
}
