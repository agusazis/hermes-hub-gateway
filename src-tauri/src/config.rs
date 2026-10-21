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
    let runner_js = scripts_dir.join("mcp_server.js");
    let runner_content = r#"// Hermes Hub Gateway - Universal Multiplexer Bridge
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const skillsDir = "C:\\Users\\user\\.hermes-hub\\workspaces\\ai-agents\\skills";
const tabularisExe = "C:\\Users\\user\\AppData\\Local\\tabularis\\tabularis.exe";
const VAGRANT_CONN_ID = "25cc551a-9479-4f84-88a6-24d84365746f";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function invokeTabularis(rpcReq) {
  return new Promise((resolve) => {
    if (!fs.existsSync(tabularisExe)) {
      return resolve({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32603, message: `Tabularis not found at ${tabularisExe}` }
      });
    }

    const child = spawn(tabularisExe, ["--mcp"], { stdio: ["pipe", "pipe", "pipe"] });
    let initDone = false;
    let rlOut = readline.createInterface({ input: child.stdout, terminal: false });

    const initPayload = {
      jsonrpc: "2.0",
      id: 100,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "hhg-js-bridge", version: "0.8.1" }
      }
    };
    child.stdin.write(JSON.stringify(initPayload) + "\n");

    rlOut.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const resp = JSON.parse(trimmed);
        if (!initDone && resp.id === 100) {
          initDone = true;
          child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
          child.stdin.write(JSON.stringify(rpcReq) + "\n");
        } else if (resp.id === rpcReq.id) {
          child.kill();
          resolve(resp);
        }
      } catch (e) {}
    });

    child.on("error", (err) => {
      resolve({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32603, message: err.message }
      });
    });

    setTimeout(() => {
      try { child.kill(); } catch (e) {}
      resolve({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32603, message: "Tabularis call timed out after 10s" }
      });
    }, 10000);
  });
}

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const req = JSON.parse(trimmed);
    const id = req.id;
    const method = req.method;

    if (method === "initialize") {
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "hermes-hub-gateway", version: "0.8.1" }
        }
      });
    } else if (method === "notifications/initialized") {
      // no response
    } else if (method === "tools/list") {
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        result: {
          tools: [
            {
              name: "hermes_list_skills",
              description: "Melihat daftar seluruh SOP, aturan arsitektur koding, dan pedoman kerja (Skills) yang tersedia di Hermes Hub Gateway untuk workspace aktif.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "hermes_get_skill",
              description: "Membaca isi lengkap aturan SOP, checklist, dan panduan koding dari skill tertentu secara on-demand.",
              inputSchema: {
                type: "object",
                properties: { name: { type: "string", description: "Nama skill atau SOP" } },
                required: ["name"]
              }
            },
            {
              name: "list_connections",
              description: "[Tabularis / Database Gateway] List all saved database connections (Vagrant, Miroring, Production ReadOnly).",
              inputSchema: {
                type: "object",
                properties: {
                  output_format: { type: "string", enum: ["json", "toon"], default: "json" }
                }
              }
            },
            {
              name: "list_databases",
              description: "[Tabularis / Database Gateway] List all databases available for a connection.",
              inputSchema: {
                type: "object",
                properties: {
                  connection_id: { type: "string", description: "The ID or name of the connection (default: Vagrant)" },
                  output_format: { type: "string", enum: ["json", "toon"], default: "json" }
                }
              }
            },
            {
              name: "list_tables",
              description: "[Tabularis / Database Gateway] List all tables in a database connection.",
              inputSchema: {
                type: "object",
                properties: {
                  connection_id: { type: "string", description: "The ID or name of the connection (default: Vagrant)" },
                  schema: { type: "string", description: "Schema name (e.g. master, pelayanan, farmasi)" },
                  output_format: { type: "string", enum: ["json", "toon"], default: "json" }
                }
              }
            },
            {
              name: "describe_table",
              description: "[Tabularis / Database Gateway] Get the full schema of a table: columns, indexes, and foreign keys.",
              inputSchema: {
                type: "object",
                properties: {
                  connection_id: { type: "string", description: "The ID or name of the connection (default: Vagrant)" },
                  table_name: { type: "string", description: "The name of the table to describe" },
                  schema: { type: "string", description: "Schema name (e.g. master, farmasi)" },
                  output_format: { type: "string", enum: ["json", "toon"], default: "json" }
                },
                required: ["table_name"]
              }
            },
            {
              name: "run_query",
              description: "[Tabularis / Database Gateway] Execute a SQL query on a specific database connection (e.g. Vagrant SIMRS 192.168.137.10).",
              inputSchema: {
                type: "object",
                properties: {
                  connection_id: { type: "string", description: "The ID or name of the connection (default: Vagrant 25cc551a-9479-4f84-88a6-24d84365746f)" },
                  query: { type: "string", description: "The SQL query to execute" },
                  limit: { type: "integer", description: "Maximum number of rows to return (default: 100)" },
                  output_format: { type: "string", enum: ["json", "toon"], default: "json" }
                },
                required: ["query"]
              }
            }
          ]
        }
      });
    } else if (method === "tools/call") {
      const toolName = req.params?.name;
      const toolArgs = req.params?.arguments || {};

      if (toolName === "hermes_list_skills") {
        let skills = [];
        if (fs.existsSync(skillsDir)) {
          const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              const skillFile = path.join(skillsDir, e.name, "SKILL.md");
              let desc = "Skill module: " + e.name;
              if (fs.existsSync(skillFile)) {
                const lines = fs.readFileSync(skillFile, "utf-8").split("\n").slice(0, 5).join(" ").trim();
                desc = lines.length > 120 ? lines.substring(0, 117) + "..." : lines;
              }
              skills.push(`- **${e.name}**: ${desc}`);
            }
          }
        }
        const text = skills.length > 0 ? "### Katalog SOP & Aturan Koding Aktif (Hermes Hub Gateway):\n\n" + skills.join("\n") : "Belum ada skill yang tersinkronisasi.";
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: text }] }
        });
      } else if (toolName === "hermes_get_skill") {
        const skillName = toolArgs.name;
        const skillFile = path.join(skillsDir, skillName, "SKILL.md");
        if (fs.existsSync(skillFile)) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: fs.readFileSync(skillFile, "utf-8") }] }
          });
        } else {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Error: Skill '${skillName}' tidak ditemukan di ${skillsDir}` }], isError: true }
          });
        }
      } else if (["run_query", "describe_table", "list_tables", "list_databases", "list_connections"].includes(toolName)) {
        if (toolName !== "list_connections" && (!toolArgs.connection_id || toolArgs.connection_id.trim() === "")) {
          toolArgs.connection_id = VAGRANT_CONN_ID;
        }
        req.params.arguments = toolArgs;
        const tabResp = await invokeTabularis(req);
        sendResponse(tabResp);
      } else {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          error: { code: -32601, message: `Tool '${toolName}' tidak dikenali di Hermes Hub Gateway` }
        });
      }
    } else {
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        error: { code: -32601, message: `Method '${method}' tidak didukung` }
      });
    }
  } catch (err) {
    sendResponse({
      jsonrpc: "2.0",
      id: req?.id,
      error: { code: -32603, message: err.message }
    });
  }
});
"#;
    let _ = fs::write(runner_js, runner_content);

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
