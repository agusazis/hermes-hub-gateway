use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshHostConfig {
    pub id: String,
    pub alias: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub tier: String, // "production" | "development"
    pub key_path: String,
    pub allow_elevated: bool,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub description: Option<String>,
    pub created_at: String,
}

fn default_true() -> bool {
    true
}

pub fn get_ssh_vault_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let vault_dir = home.join(".hermes-hub").join("vault");
    let keys_dir = vault_dir.join("ssh_keys");
    let _ = fs::create_dir_all(&keys_dir);
    vault_dir
}

pub fn get_ssh_hosts_file() -> PathBuf {
    get_ssh_vault_dir().join("ssh_hosts.json")
}

pub fn load_ssh_hosts() -> Vec<SshHostConfig> {
    let file = get_ssh_hosts_file();
    if !file.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&file) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_ssh_hosts(hosts: &[SshHostConfig]) -> Result<(), String> {
    let file = get_ssh_hosts_file();
    let json = serde_json::to_string_pretty(hosts).map_err(|e| e.to_string())?;
    fs::write(&file, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_ssh_hosts() -> Result<Vec<SshHostConfig>, String> {
    Ok(load_ssh_hosts())
}

#[tauri::command]
pub fn remove_ssh_host(id: String) -> Result<Vec<SshHostConfig>, String> {
    let mut hosts = load_ssh_hosts();
    if let Some(pos) = hosts.iter().position(|h| h.id == id || h.alias == id) {
        let removed = hosts.remove(pos);
        let key_path = PathBuf::from(&removed.key_path);
        let pub_path = PathBuf::from(format!("{}.pub", &removed.key_path));
        let _ = fs::remove_file(key_path);
        let _ = fs::remove_file(pub_path);
        save_ssh_hosts(&hosts)?;
    }
    Ok(hosts)
}

#[tauri::command]
pub fn toggle_ssh_host_permission(id: String, allow_elevated: bool) -> Result<Vec<SshHostConfig>, String> {
    let mut hosts = load_ssh_hosts();
    if let Some(h) = hosts.iter_mut().find(|h| h.id == id || h.alias == id) {
        h.allow_elevated = allow_elevated;
        save_ssh_hosts(&hosts)?;
    }
    Ok(hosts)
}

#[tauri::command]
pub fn toggle_ssh_host_enabled(id: String, enabled: bool) -> Result<Vec<SshHostConfig>, String> {
    let mut hosts = load_ssh_hosts();
    if let Some(h) = hosts.iter_mut().find(|h| h.id == id || h.alias == id) {
        h.enabled = enabled;
        save_ssh_hosts(&hosts)?;
    }
    Ok(hosts)
}

#[tauri::command]
pub async fn provision_ssh_host(
    alias: String,
    host: String,
    port: Option<u16>,
    user: String,
    password_temporary: Option<String>,
    tier: Option<String>,
    allow_elevated: Option<bool>,
    description: Option<String>,
) -> Result<Vec<SshHostConfig>, String> {
    let clean_alias = alias.trim().replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
    if clean_alias.is_empty() {
        return Err("Alias host tidak boleh kosong.".into());
    }
    let host_str = host.trim().to_string();
    if host_str.is_empty() {
        return Err("Host/IP tujuan tidak boleh kosong.".into());
    }
    let user_str = user.trim().to_string();
    if user_str.is_empty() {
        return Err("Username SSH tidak boleh kosong.".into());
    }
    let ssh_port = port.unwrap_or(22);
    let host_tier = tier.unwrap_or_else(|| "development".into()).to_lowercase();
    let is_elevated = allow_elevated.unwrap_or(false);

    let vault_dir = get_ssh_vault_dir();
    let keys_dir = vault_dir.join("ssh_keys");
    let priv_key_file = keys_dir.join(format!("{}.key", clean_alias));
    let pub_key_file = keys_dir.join(format!("{}.key.pub", clean_alias));

    // 1. Generate SSH Key Pair (Ed25519) jika belum ada
    if !priv_key_file.exists() {
        let keygen_res = Command::new("ssh-keygen")
            .args([
                "-t", "ed25519",
                "-N", "",
                "-C", &format!("hhg-agent-{}@{}", clean_alias, user_str),
                "-f", priv_key_file.to_str().unwrap_or(""),
            ])
            .output();

        match keygen_res {
            Ok(out) => {
                if !out.status.success() {
                    let err = String::from_utf8_lossy(&out.stderr);
                    return Err(format!("Gagal membuat SSH key: {}", err));
                }
            }
            Err(e) => return Err(format!("ssh-keygen tidak ditemukan atau gagal dijalankan: {}", e)),
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&priv_key_file, fs::Permissions::from_mode(0o600));
        }
    }

    let pub_key_content = fs::read_to_string(&pub_key_file)
        .map_err(|e| format!("Gagal membaca public key: {}", e))?
        .trim()
        .to_string();

    // 2. Deploy public key ke server tujuan via SSH (jika temporary password diberikan)
    if let Some(pass) = password_temporary {
        let trimmed_pass = pass.trim();
        if !trimmed_pass.is_empty() {
            let install_cmd = format!(
                "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && grep -qxF '{pub}' ~/.ssh/authorized_keys || echo '{pub}' >> ~/.ssh/authorized_keys",
                pub = pub_key_content
            );

            // Gunakan library native ssh2 (Pure Rust / C libssh2) - 100% jalan di Windows & Linux tanpa butuh sshpass eksternal!
            use std::net::TcpStream;
            let target_addr = format!("{}:{}", host_str, ssh_port);
            let tcp = TcpStream::connect(&target_addr)
                .map_err(|e| format!("Gagal menghubungi host {}: {}", target_addr, e))?;
            
            let mut sess = ssh2::Session::new()
                .map_err(|e| format!("Gagal inisialisasi SSH session: {}", e))?;
            sess.set_tcp_stream(tcp);
            sess.handshake()
                .map_err(|e| format!("Gagal handshake SSH ke {}: {}", target_addr, e))?;

            sess.userauth_password(&user_str, trimmed_pass)
                .map_err(|e| format!("Autentikasi password SSH ditolak untuk user '{}': {}", user_str, e))?;

            if !sess.authenticated() {
                return Err(format!("Autentikasi gagal untuk user '{}'@{}", user_str, host_str));
            }

            let mut channel = sess.channel_session()
                .map_err(|e| format!("Gagal membuka SSH channel session: {}", e))?;
            channel.exec(&install_cmd)
                .map_err(|e| format!("Gagal eksekusi deploy authorized_keys: {}", e))?;
            
            use std::io::Read;
            let mut output = String::new();
            let _ = channel.read_to_string(&mut output);
            let _ = channel.wait_close();
            let exit_status = channel.exit_status().unwrap_or(0);
            if exit_status != 0 {
                return Err(format!("Deploy authorized_keys gagal (exit code {})", exit_status));
            }
        }
    }

    // 3. Simpan Host ke Database Vault HHG
    let mut hosts = load_ssh_hosts();
    let host_id = format!("ssh_{}", clean_alias);

    // Hapus entry lama jika alias sama
    hosts.retain(|h| h.alias != clean_alias && h.id != host_id);

    let now_str = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    hosts.push(SshHostConfig {
        id: host_id,
        alias: clean_alias,
        host: host_str,
        port: ssh_port,
        user: user_str,
        tier: host_tier,
        key_path: priv_key_file.to_string_lossy().replace('\\', "/"),
        allow_elevated: is_elevated,
        enabled: true,
        description,
        created_at: now_str,
    });

    save_ssh_hosts(&hosts)?;
    Ok(hosts)
}
