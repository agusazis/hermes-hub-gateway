use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MikrotikRouterConfig {
    pub id: String,
    pub alias: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    #[serde(default)]
    pub password: Option<String>,
    pub tier: String, // "production" | "development"
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub description: Option<String>,
    pub created_at: String,
}

fn default_true() -> bool {
    true
}

pub fn get_mikrotik_vault_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let vault_dir = home.join(".hermes-hub").join("vault");
    let _ = fs::create_dir_all(&vault_dir);
    vault_dir
}

pub fn get_mikrotik_routers_file() -> PathBuf {
    get_mikrotik_vault_dir().join("mikrotik_routers.json")
}

pub fn load_mikrotik_routers() -> Vec<MikrotikRouterConfig> {
    let file = get_mikrotik_routers_file();
    if !file.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&file) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_mikrotik_routers(routers: &[MikrotikRouterConfig]) -> Result<(), String> {
    let file = get_mikrotik_routers_file();
    let json = serde_json::to_string_pretty(routers).map_err(|e| e.to_string())?;
    fs::write(&file, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_mikrotik_routers() -> Result<Vec<MikrotikRouterConfig>, String> {
    let mut routers = load_mikrotik_routers();
    for r in routers.iter_mut() {
        if r.password.is_some() {
            r.password = Some("••••••••".to_string());
        }
    }
    Ok(routers)
}

#[tauri::command]
pub fn save_mikrotik_router(mut router: MikrotikRouterConfig) -> Result<Vec<MikrotikRouterConfig>, String> {
    let mut routers = load_mikrotik_routers();
    if router.id.trim().is_empty() {
        router.id = format!("mtk_{}", chrono::Utc::now().timestamp_millis());
    }
    if router.created_at.trim().is_empty() {
        router.created_at = chrono::Utc::now().format("%Y-%m-%d %H:%M").to_string();
    }
    if let Some(pos) = routers.iter().position(|r| r.id == router.id || r.alias == router.alias) {
        if router.password.as_deref() == Some("••••••••") || router.password.as_deref().unwrap_or("").is_empty() {
            router.password = routers[pos].password.clone();
        }
        routers[pos] = router;
    } else {
        routers.push(router);
    }
    save_mikrotik_routers(&routers)?;
    list_mikrotik_routers()
}

#[tauri::command]
pub fn remove_mikrotik_router(id: String) -> Result<Vec<MikrotikRouterConfig>, String> {
    let mut routers = load_mikrotik_routers();
    if let Some(pos) = routers.iter().position(|r| r.id == id || r.alias == id) {
        routers.remove(pos);
        save_mikrotik_routers(&routers)?;
    }
    list_mikrotik_routers()
}

#[tauri::command]
pub fn toggle_mikrotik_router_enabled(id: String, enabled: bool) -> Result<Vec<MikrotikRouterConfig>, String> {
    let mut routers = load_mikrotik_routers();
    if let Some(r) = routers.iter_mut().find(|r| r.id == id || r.alias == id) {
        r.enabled = enabled;
        save_mikrotik_routers(&routers)?;
    }
    list_mikrotik_routers()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MikrotikTestResult {
    pub success: bool,
    pub message: String,
    pub latency_ms: u64,
    pub model: Option<String>,
    pub version: Option<String>,
    pub cpu_load: Option<String>,
    pub uptime: Option<String>,
}

fn encode_len(len: usize) -> Vec<u8> {
    if len < 0x80 {
        vec![len as u8]
    } else if len < 0x4000 {
        let l = len | 0x8000;
        vec![((l >> 8) & 0xFF) as u8, (l & 0xFF) as u8]
    } else {
        vec![0]
    }
}

fn send_sentence<W: Write>(w: &mut W, words: &[&str]) -> std::io::Result<()> {
    for word in words {
        let b = word.as_bytes();
        w.write_all(&encode_len(b.len()))?;
        w.write_all(b)?;
    }
    w.write_all(&[0])?;
    w.flush()?;
    Ok(())
}

fn read_sentence<R: Read>(r: &mut R) -> std::io::Result<Vec<String>> {
    let mut words = Vec::new();
    loop {
        let mut first = [0u8; 1];
        r.read_exact(&mut first)?;
        let f = first[0];
        if f == 0 {
            break;
        }
        let len = if f & 0x80 != 0 && f & 0x40 == 0 {
            let mut second = [0u8; 1];
            r.read_exact(&mut second)?;
            (((f & 0x3F) as usize) << 8) | (second[0] as usize)
        } else {
            f as usize
        };
        let mut data = vec![0u8; len];
        r.read_exact(&mut data)?;
        words.push(String::from_utf8_lossy(&data).to_string());
    }
    Ok(words)
}

#[tauri::command]
pub async fn test_mikrotik_connection(
    id: Option<String>,
    host: String,
    port: u16,
    user: String,
    password: Option<String>,
) -> Result<MikrotikTestResult, String> {
    let start_time = Instant::now();
    let target_host = host.trim().to_string();
    let target_port = if port == 0 { 8728 } else { port };
    let target_user = user.trim().to_string();

    let mut final_password = password.unwrap_or_default();
    if final_password == "••••••••" || final_password.is_empty() {
        if let Some(router_id) = id {
            let all = load_mikrotik_routers();
            if let Some(found) = all.iter().find(|r| r.id == router_id || r.alias == router_id) {
                if let Some(saved_pass) = &found.password {
                    final_password = saved_pass.clone();
                }
            }
        }
    }

    let addr_str = format!("{}:{}", target_host, target_port);
    let socket_addrs: Vec<SocketAddr> = match addr_str.to_socket_addrs() {
        Ok(addrs) => addrs.collect(),
        Err(e) => {
            return Ok(MikrotikTestResult {
                success: false,
                message: format!("Resolusi alamat {}:{} gagal: {}", target_host, target_port, e),
                latency_ms: start_time.elapsed().as_millis() as u64,
                model: None,
                version: None,
                cpu_load: None,
                uptime: None,
            });
        }
    };

    let socket_addr = match socket_addrs.first() {
        Some(a) => *a,
        None => {
            return Ok(MikrotikTestResult {
                success: false,
                message: format!("Tidak dapat menemukan alamat IP untuk {}", target_host),
                latency_ms: start_time.elapsed().as_millis() as u64,
                model: None,
                version: None,
                cpu_load: None,
                uptime: None,
            });
        }
    };

    let stream = match TcpStream::connect_timeout(&socket_addr, Duration::from_millis(4000)) {
        Ok(s) => s,
        Err(e) => {
            return Ok(MikrotikTestResult {
                success: false,
                message: format!("Koneksi TCP ke {}:{} gagal atau timeout: {}", target_host, target_port, e),
                latency_ms: start_time.elapsed().as_millis() as u64,
                model: None,
                version: None,
                cpu_load: None,
                uptime: None,
            });
        }
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(4000)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(4000)));

    let mut stream_writer = match stream.try_clone() {
        Ok(w) => w,
        Err(e) => {
            return Ok(MikrotikTestResult {
                success: false,
                message: format!("Gagal inisialisasi stream socket: {}", e),
                latency_ms: start_time.elapsed().as_millis() as u64,
                model: None,
                version: None,
                cpu_load: None,
                uptime: None,
            });
        }
    };
    let mut stream_reader = stream;

    // 1. Send /login sentence
    let login_words = [
        "/login",
        &format!("=name={}", target_user),
        &format!("=password={}", final_password),
    ];
    if let Err(e) = send_sentence(&mut stream_writer, &login_words) {
        return Ok(MikrotikTestResult {
            success: false,
            message: format!("Gagal mengirim perintah login RouterOS: {}", e),
            latency_ms: start_time.elapsed().as_millis() as u64,
            model: None,
            version: None,
            cpu_load: None,
            uptime: None,
        });
    }

    let login_resp = match read_sentence(&mut stream_reader) {
        Ok(w) => w,
        Err(e) => {
            return Ok(MikrotikTestResult {
                success: false,
                message: format!("Tidak ada respons login dari RouterOS: {}", e),
                latency_ms: start_time.elapsed().as_millis() as u64,
                model: None,
                version: None,
                cpu_load: None,
                uptime: None,
            });
        }
    };

    if !login_resp.iter().any(|w| w == "!done") {
        let err_detail = login_resp.iter().find(|w| w.starts_with("=message=")).map(|w| &w[9..]).unwrap_or("Login ditolak");
        return Ok(MikrotikTestResult {
            success: false,
            message: format!("Autentikasi RouterOS gagal (User: '{}'): {}", target_user, err_detail),
            latency_ms: start_time.elapsed().as_millis() as u64,
            model: None,
            version: None,
            cpu_load: None,
            uptime: None,
        });
    }

    // 2. Fetch /system/resource/print
    if let Err(e) = send_sentence(&mut stream_writer, &["/system/resource/print"]) {
        return Ok(MikrotikTestResult {
            success: false,
            message: format!("Login sukses tapi gagal query /system/resource: {}", e),
            latency_ms: start_time.elapsed().as_millis() as u64,
            model: None,
            version: None,
            cpu_load: None,
            uptime: None,
        });
    }

    let mut model_opt = None;
    let mut version_opt = None;
    let mut cpu_opt = None;
    let mut uptime_opt = None;

    loop {
        match read_sentence(&mut stream_reader) {
            Ok(words) => {
                if words.is_empty() || words.iter().any(|w| w == "!done") {
                    break;
                }
                if words.iter().any(|w| w == "!re") {
                    for w in words {
                        if w.starts_with("=board-name=") {
                            model_opt = Some(w[12..].to_string());
                        } else if w.starts_with("=version=") {
                            version_opt = Some(w[9..].to_string());
                        } else if w.starts_with("=cpu-load=") {
                            cpu_opt = Some(format!("{}%", &w[10..]));
                        } else if w.starts_with("=uptime=") {
                            uptime_opt = Some(w[8..].to_string());
                        }
                    }
                }
            }
            Err(_) => break,
        }
    }

    let latency = start_time.elapsed().as_millis() as u64;
    let model_str = model_opt.clone().unwrap_or_else(|| "RouterOS Device".to_string());
    let version_str = version_opt.clone().unwrap_or_default();

    Ok(MikrotikTestResult {
        success: true,
        message: format!("✓ Terhubung sukses ke {} RouterOS {} (Latency: {}ms)", model_str, version_str, latency),
        latency_ms: latency,
        model: model_opt,
        version: version_opt,
        cpu_load: cpu_opt,
        uptime: uptime_opt,
    })
}
