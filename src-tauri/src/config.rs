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
            active_profile: "default".to_string(),
            default_hermes_evaluator_url: "".to_string(),
            default_mnemosyne_url: "".to_string(),
            active_workspace_id: "".to_string(),
            workspaces: Vec::new(),
            mcp_servers: Vec::new(),
        }
    }
}

pub fn get_app_data_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    let dir = home.join(".hermes-hub");
    let _ = fs::create_dir_all(&dir);
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
