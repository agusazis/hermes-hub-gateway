use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GitTarget {
    pub provider: String,
    pub base_url: String,
    pub project_id: String,
    pub repo_url: String,
    pub target_branch: String,
    pub auth_token: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct McpServerEntry {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: std::collections::HashMap<String, String>,
    pub enabled: bool,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub target_path: String,
    pub internal_skills_path: String,
    pub hermes_evaluator_url: String,
    pub mnemosyne_url: String,
    pub git_target: Option<GitTarget>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GlobalConfig {
    pub active_profile: String,
    pub default_hermes_evaluator_url: String,
    pub default_mnemosyne_url: String,
    pub active_workspace_id: String,
    pub workspaces: Vec<Workspace>,
    pub mcp_servers: Vec<McpServerEntry>,
}

impl Default for GlobalConfig {
    fn default() -> Self {
        GlobalConfig {
            active_profile: "".to_string(),
            default_hermes_evaluator_url: "".to_string(),
            default_mnemosyne_url: "".to_string(),
            active_workspace_id: "".to_string(),
            workspaces: Vec::new(),
            mcp_servers: Vec::new(),
        }
    }
}

pub fn get_app_data_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| {
        if cfg!(windows) {
            PathBuf::from("C:\\Users\\Default")
        } else {
            PathBuf::from("/home/user")
        }
    });
    let dir = home.join(".hermes-hub");
    let _ = fs::create_dir_all(&dir);

    // Pastikan folder scripts dan file pipe-bridge.ps1 selalu tersedia secara deterministik
    let scripts_dir = dir.join("scripts");
    let _ = fs::create_dir_all(&scripts_dir);
    let bridge_ps1 = scripts_dir.join("pipe-bridge.ps1");
    let runner_js = scripts_dir.join("mcp_server.js");
    let run_mcp_js = scripts_dir.join("run_mcp.js");

    const RUNNER_BYTES: &[u8] = include_bytes!("run_mcp.js");
    // Robust update: periksa apakah runner target sudah memiliki dukungan dynamic server scoping dan versi runner terbaru
    let check_needs_update = |path: &PathBuf| -> bool {
        if !path.exists() {
            return true;
        }
        if let Ok(content) = fs::read_to_string(path) {
            if !content.contains("getMikrotikTools") || content.len() != RUNNER_BYTES.len() {
                return true;
            }
        }
        false
    };

    if check_needs_update(&run_mcp_js) {
        let _ = fs::write(&run_mcp_js, RUNNER_BYTES);
    }

    if check_needs_update(&runner_js) {
        let _ = fs::write(&runner_js, RUNNER_BYTES);
    }

    let script_content = r#"# Hermes Hub Gateway - Node Dispatcher Wrapper
$ErrorActionPreference = "Stop"
$nodeScript = "C:\Users\user\.hermes-hub\scripts\mcp_server.js"
& node $nodeScript
"#;
    let _ = fs::write(bridge_ps1, script_content);

    dir
}

pub fn load_config() -> GlobalConfig {
    let config_path = get_app_data_dir().join("config.json");
    if let Ok(content) = fs::read_to_string(&config_path) {
        if let Ok(cfg) = serde_json::from_str::<GlobalConfig>(&content) {
            return cfg;
        }
    }
    let default_cfg = GlobalConfig::default();
    save_config(&default_cfg);
    default_cfg
}

pub fn save_config(cfg: &GlobalConfig) {
    let config_path = get_app_data_dir().join("config.json");
    if let Ok(content) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(config_path, content);
    }
}

pub fn generate_declarative_agents_md(target_project_dir: &Path, workspace: &Workspace) -> Result<(), String> {
    let agents_md_path = target_project_dir.join("AGENTS.md");
    let content = format!(
        "# Autonomous AI Developer Instructions\\n\\n\
        > [!IMPORTANT]\\n\
        > **Zero-Pollution Architecture Enforcement:**\\n\
        > Proyek ini dikelola secara terpusat oleh **Hermes Hub Gateway (HHG)**.\\n\
        > DILARANG membuat folder `.agents/`, folder `skills/`, atau skrip watcher di dalam project ini.\\n\\n\
        ## 1. Unified MCP Hub\\n\
        - Seluruh kemampuan tools koding, query database, memori Mnemosyne, dan SOP skills diakses melalui **Hermes Hub Gateway MCP**.\n\
        - Pipe Transport: `\\\\.\\pipe\\hhg-bridge`\n\n\
        ## 2. Dynamic Skill Retrieval\n\
        - Panggil tool `hermes_get_skill(name: \"...\")` untuk memuat SOP dan aturan koding spesifik.\n\
        - Skill registry aktif: `{}`\n\n\
        ## 3. Evaluasi & Continuous Evolution\n\
        - Setiap turn percakapan yang selesai akan dievaluasi secara otomatis oleh Hermes Evaluator di server (`{}`).\n\
        - Aturan baru hasil evaluasi akan otomatis ditarik ke dalam penyimpanan lokal HHG tanpa mengotori project ini.\n",
        workspace.name, workspace.hermes_evaluator_url
    );

    fs::write(agents_md_path, content).map_err(|e| e.to_string())
}
