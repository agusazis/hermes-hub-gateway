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
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("C:\\Users\\Default"));
    let dir = home.join(".hermes-hub");
    let _ = fs::create_dir_all(&dir);

    // Pastikan folder scripts dan file pipe-bridge.ps1 selalu tersedia secara deterministik
    let scripts_dir = dir.join("scripts");
    let _ = fs::create_dir_all(&scripts_dir);
    let bridge_ps1 = scripts_dir.join("pipe-bridge.ps1");
    if !bridge_ps1.exists() {
        let script_content = r#"# Direct Stdio MCP Server for Hermes Hub Gateway
# Runs as an MCP server responding to IDE stdin/stdout
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$skillsDir = "D:\7. Project\ai-agents\skills"
if (-not (Test-Path $skillsDir)) {
    $skillsDir = "D:\7. Project\SIMGOSv2\New - php82\simgos2\.agents\skills"
}

function Send-McpResponse($respObj) {
    $json = $respObj | ConvertTo-Json -Compress -Depth 10
    [Console]::WriteLine($json)
}

while ($true) {
    $line = [Console]::ReadLine()
    if ($null -eq $line) { break }
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0) { continue }

    try {
        $req = $trimmed | ConvertFrom-Json
        $id = $req.id
        $method = $req.method

        switch ($method) {
            "initialize" {
                Send-McpResponse @{
                    jsonrpc = "2.0"
                    id = $id
                    result = @{
                        protocolVersion = "2024-11-05"
                        capabilities = @{ tools = @{} }
                        serverInfo = @{
                            name = "hermes-hub-gateway"
                            version = "0.8.0"
                        }
                    }
                }
            }
            "notifications/initialized" {
                # Notification, no response required
            }
            "tools/list" {
                Send-McpResponse @{
                    jsonrpc = "2.0"
                    id = $id
                    result = @{
                        tools = @(
                            @{
                                name = "hermes_list_skills"
                                description = "Melihat daftar seluruh SOP, aturan arsitektur koding, dan pedoman kerja (Skills) yang tersedia di Hermes Hub Gateway untuk workspace aktif."
                                inputSchema = @{
                                    type = "object"
                                    properties = @{}
                                }
                            },
                            @{
                                name = "hermes_get_skill"
                                description = "Membaca isi lengkap aturan SOP, checklist, dan panduan koding dari skill tertentu secara on-demand."
                                inputSchema = @{
                                    type = "object"
                                    properties = @{
                                        name = @{
                                            type = "string"
                                            description = "Nama skill atau SOP (contoh: simgos2-simrs, devops, database-best-practices)"
                                        }
                                    }
                                    required = @("name")
                                }
                            }
                        )
                    }
                }
            }
            "tools/call" {
                $toolName = $req.params.name
                $toolArgs = $req.params.arguments

                if ($toolName -eq "hermes_list_skills") {
                    $skills = @()
                    if (Test-Path $skillsDir) {
                        Get-ChildItem $skillsDir -Directory | ForEach-Object {
                            $skillFile = Join-Path $_.FullName "SKILL.md"
                            $desc = "Skill module: " + $_.Name
                            if (Test-Path $skillFile) {
                                $firstLines = Get-Content $skillFile -TotalCount 5
                                $desc = ($firstLines -join " ").Trim()
                                if ($desc.Length -gt 120) { $desc = $desc.Substring(0, 117) + "..." }
                            }
                            $skills += "- **$($_.Name)**: $desc"
                        }
                    }
                    $contentStr = if ($skills.Count -gt 0) {
                        "### Katalog SOP & Aturan Koding Aktif (Hermes Hub Gateway):`n`n" + ($skills -join "`n")
                    } else {
                        "Belum ada skill yang tersinkronisasi di direktori skills."
                    }

                    Send-McpResponse @{
                        jsonrpc = "2.0"
                        id = $id
                        result = @{
                            content = @(
                                @{
                                    type = "text"
                                    text = $contentStr
                                }
                            )
                        }
                    }
                }
                elseif ($toolName -eq "hermes_get_skill") {
                    $targetSkill = $toolArgs.name
                    $skillMd = Join-Path $skillsDir "$targetSkill\SKILL.md"
                    if (Test-Path $skillMd) {
                        $skillBody = Get-Content $skillMd -Raw
                        Send-McpResponse @{
                            jsonrpc = "2.0"
                            id = $id
                            result = @{
                                content = @(
                                    @{
                                        type = "text"
                                        text = $skillBody
                                    }
                                )
                            }
                        }
                    } else {
                        Send-McpResponse @{
                            jsonrpc = "2.0"
                            id = $id
                            result = @{
                                content = @(
                                    @{
                                        type = "text"
                                        text = "Error: Skill '$targetSkill' tidak ditemukan di direktori $skillsDir"
                                    }
                                )
                                isError = $true
                            }
                        }
                    }
                }
                else {
                    Send-McpResponse @{
                        jsonrpc = "2.0"
                        id = $id
                        error = @{
                            code = -32601
                            message = "Method or tool not found"
                        }
                    }
                }
            }
            default {
                Send-McpResponse @{
                    jsonrpc = "2.0"
                    id = $id
                    error = @{
                        code = -32601
                        message = "Method not supported"
                    }
                }
            }
        }
    } catch {
        # Silent ignore parse error
    }
}
"#;
        let _ = fs::write(bridge_ps1, script_content);
    }

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
