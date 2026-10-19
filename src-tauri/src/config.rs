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
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
        let default_skills_dir = home
            .join(".hermes-hub")
            .join("workspaces")
            .join("simgos2")
            .join("skills");

        let default_ws = Workspace {
            id: "simgos2".to_string(),
            name: "SIMGOSv2 SIMRS".to_string(),
            target_path: "D:\\7. Project\\SIMGOSv2\\New - php82\\simgos2".to_string(),
            internal_skills_path: default_skills_dir.to_string_lossy().to_string(),
            hermes_evaluator_url: "http://172.168.1.202:9125".to_string(),
            mnemosyne_url: "http://172.168.1.202:8080".to_string(),
            git_target: Some(GitTarget {
                provider: "gitlab".to_string(),
                base_url: "http://172.168.1.33".to_string(),
                project_id: "84".to_string(),
                repo_url: "http://172.168.1.33/simrs/ai-agents.git".to_string(),
                target_branch: "main".to_string(),
                auth_token: "".to_string(),
            }),
        };

        let default_mcps = vec![
            McpServerEntry {
                name: "database-simrs-readonly".to_string(),
                command: "python".to_string(),
                args: vec!["mysql_mcp_readonly.py".to_string()],
                env: std::collections::HashMap::from([
                    ("DB_HOST".to_string(), "172.168.1.4".to_string()),
                    ("DB_PORT".to_string(), "3306".to_string()),
                    ("DB_NAME".to_string(), "db_rs".to_string()),
                ]),
                enabled: true,
                description: "Proxy SQL Query Aman (Read-Only) ke Database SIMGOS2 SIMRS".to_string(),
            },
            McpServerEntry {
                name: "synology-nas-storage".to_string(),
                command: "npx".to_string(),
                args: vec!["-y".to_string(), "mcp-server-synology".to_string()],
                env: std::collections::HashMap::from([
                    ("SYNOLOGY_HOST".to_string(), "172.168.1.27".to_string()),
                ]),
                enabled: true,
                description: "Manajemen Storage & Audit Retensi GFS Backup di NAS Synology".to_string(),
            },
            McpServerEntry {
                name: "mikrotik-router".to_string(),
                command: "python".to_string(),
                args: vec!["mikrotik_mcp.py".to_string()],
                env: std::collections::HashMap::from([
                    ("ROUTER_IP".to_string(), "172.168.1.1".to_string()),
                ]),
                enabled: true,
                description: "Pemantauan Traffic WAN & Antrean Bandwidth Router Jaringan RSUD".to_string(),
            },
            McpServerEntry {
                name: "grafana-observability".to_string(),
                command: "npx".to_string(),
                args: vec!["-y".to_string(), "@dockndevai/mcp-grafana".to_string()],
                env: std::collections::HashMap::from([
                    ("GRAFANA_URL".to_string(), "http://172.168.1.8:3000".to_string()),
                ]),
                enabled: true,
                description: "Monitoring Metrik Server & Alerting RSUD dr. H. Jusuf SK".to_string(),
            },
        ];

        GlobalConfig {
            active_profile: "agus".to_string(),
            default_hermes_evaluator_url: "http://172.168.1.202:9125".to_string(),
            default_mnemosyne_url: "http://172.168.1.202:8080".to_string(),
            active_workspace_id: "simgos2".to_string(),
            workspaces: vec![default_ws],
            mcp_servers: default_mcps,
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
        "# Autonomous AI Developer Instructions - RSUD dr. H. Jusuf SK\n\n\
        > [!IMPORTANT]\n\
        > **Zero-Pollution Architecture Enforcement:**\n\
        > Proyek ini dikelola secara terpusat oleh **Hermes Hub Gateway (HHG)**.\n\
        > DILARANG membuat folder `.agents/`, folder `skills/`, atau skrip watcher di dalam project ini.\n\n\
        ## 1. Unified MCP Hub\n\
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
