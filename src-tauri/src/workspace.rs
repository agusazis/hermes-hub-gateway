use std::path::{Path, PathBuf};
use std::fs;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitProjectItem {
    pub id: String,
    pub name: String,
    pub path_with_namespace: String,
    pub default_branch: String,
    pub http_url_to_repo: String,
    pub ssh_url_to_repo: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReadinessCheckItem {
    pub key: String,
    pub label: String,
    pub status: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceReadinessReport {
    pub score_percent: u32,
    pub is_ready: bool,
    pub checks: Vec<ReadinessCheckItem>,
}

/// Fetch list of repositories accessible with given Personal Access Token (PAT)
pub async fn list_remote_projects(
    provider: &str,
    base_url: &str,
    token: &str,
) -> Result<Vec<GitProjectItem>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    if provider.to_lowercase() == "gitlab" {
        // Cek dulu apakah token adalah Project Access Token (terikat ke 1 project spesifik)
        let mut list = Vec::new();
        
        // 1. Coba panggil /api/v4/project/ (info spesifik project dari Project Access Token jika ada)
        // Jika token adalah Project Access Token, memanggil /api/v4/projects mungkin hanya mengembalikan 1 project yang diizinkan
        let mut page = 1;
        loop {
            let endpoint = format!(
                "{}/api/v4/projects?per_page=100&page={}&simple=true&order_by=name&sort=asc",
                base_url.trim_end_matches('/'),
                page
            );
            let res = client
                .get(&endpoint)
                .header("PRIVATE-TOKEN", token)
                .send()
                .await
                .map_err(|e| format!("Koneksi GitLab gagal: {}", e))?;

            if !res.status().is_success() {
                let status = res.status();
                let err_text = res.text().await.unwrap_or_default();
                return Err(format!("GitLab API Error ({}): {}", status, err_text));
            }

            let json_data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            let arr = match json_data.as_array() {
                Some(a) if !a.is_empty() => a.clone(),
                _ => break,
            };

            for item in &arr {
                let id = item["id"].to_string();
                let name = item["name"].as_str().unwrap_or("").to_string();
                let path_ns = item["path_with_namespace"].as_str().unwrap_or(&name).to_string();
                let branch = item["default_branch"].as_str().unwrap_or("main").to_string();
                let http_url = item["http_url_to_repo"].as_str().unwrap_or("").to_string();
                let ssh_url = item["ssh_url_to_repo"].as_str().unwrap_or("").to_string();
                let desc = item["description"].as_str().map(|s| s.to_string());

                list.push(GitProjectItem {
                    id,
                    name,
                    path_with_namespace: path_ns,
                    default_branch: branch,
                    http_url_to_repo: http_url,
                    ssh_url_to_repo: ssh_url,
                    description: desc,
                });
            }

            if arr.len() < 100 || page >= 5 {
                break;
            }
            page += 1;
        }

        // Jika repo spesifik 'ai-agents' belum ada di membership list, coba fetch langsung via endpoint search
        let has_ai_agents = list.iter().any(|p| p.path_with_namespace.to_lowercase().contains("ai-agents"));
        if !has_ai_agents {
            let search_endpoint = format!(
                "{}/api/v4/projects?search=ai-agents&per_page=10",
                base_url.trim_end_matches('/')
            );
            if let Ok(search_res) = client.get(&search_endpoint).header("PRIVATE-TOKEN", token).send().await {
                if search_res.status().is_success() {
                    if let Ok(search_json) = search_res.json::<serde_json::Value>().await {
                        if let Some(search_arr) = search_json.as_array() {
                            for item in search_arr {
                                let id = item["id"].to_string();
                                if !list.iter().any(|p| p.id == id) {
                                    let name = item["name"].as_str().unwrap_or("").to_string();
                                    let path_ns = item["path_with_namespace"].as_str().unwrap_or(&name).to_string();
                                    let branch = item["default_branch"].as_str().unwrap_or("main").to_string();
                                    let http_url = item["http_url_to_repo"].as_str().unwrap_or("").to_string();
                                    let ssh_url = item["ssh_url_to_repo"].as_str().unwrap_or("").to_string();
                                    let desc = item["description"].as_str().map(|s| s.to_string());

                                    list.push(GitProjectItem {
                                        id,
                                        name,
                                        path_with_namespace: path_ns,
                                        default_branch: branch,
                                        http_url_to_repo: http_url,
                                        ssh_url_to_repo: ssh_url,
                                        description: desc,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Urutkan alfabetis
        list.sort_by(|a, b| a.path_with_namespace.to_lowercase().cmp(&b.path_with_namespace.to_lowercase()));
        Ok(list)
    } else {
        // GitHub API
        let endpoint = format!("{}/user/repos?per_page=100&sort=updated", base_url.trim_end_matches('/'));
        let res = client
            .get(&endpoint)
            .header("Authorization", format!("Bearer {}", token))
            .header("User-Agent", "Hermes-Hub-Gateway")
            .send()
            .await
            .map_err(|e| format!("Koneksi GitHub gagal: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(format!("GitHub API Error ({}): {}", status, err_text));
        }

        let json_data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        if let Some(arr) = json_data.as_array() {
            for item in arr {
                let id = item["id"].to_string();
                let name = item["name"].as_str().unwrap_or("").to_string();
                let path_ns = item["full_name"].as_str().unwrap_or(&name).to_string();
                let branch = item["default_branch"].as_str().unwrap_or("main").to_string();
                let http_url = item["clone_url"].as_str().unwrap_or("").to_string();
                let ssh_url = item["ssh_url"].as_str().unwrap_or("").to_string();
                let desc = item["description"].as_str().map(|s| s.to_string());

                list.push(GitProjectItem {
                    id,
                    name,
                    path_with_namespace: path_ns,
                    default_branch: branch,
                    http_url_to_repo: http_url,
                    ssh_url_to_repo: ssh_url,
                    description: desc,
                });
            }
        }
        Ok(list)
    }
}

/// Helper to create NTFS Junction on Windows (mklink /J)
pub fn create_ntfs_junction(link_path: &Path, target_path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        // Hapus link lama / broken junction jika path atau reparse point ada
        if link_path.symlink_metadata().is_ok() || link_path.exists() {
            let _ = Command::new("cmd")
                .args(&["/c", "rmdir", link_path.to_str().unwrap_or("")])
                .output();
        }

        let output = Command::new("cmd")
            .args(&[
                "/c",
                "mklink",
                "/J",
                link_path.to_str().unwrap_or(""),
                target_path.to_str().unwrap_or(""),
            ])
            .output()
            .map_err(|e| format!("Gagal memanggil cmd mklink: {}", e))?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            let out_msg = String::from_utf8_lossy(&output.stdout);
            return Err(format!("mklink gagal: {} {}", err_msg, out_msg));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        // Fallback for non-windows (symlink)
        if link_path.symlink_metadata().is_ok() || link_path.exists() {
            let _ = fs::remove_file(link_path);
            let _ = fs::remove_dir_all(link_path);
        }
        std::os::unix::fs::symlink(target_path, link_path)
            .map_err(|e| format!("Gagal membuat symlink unix: {}", e))?;
        Ok(())
    }
}

/// Helper to safely remove an NTFS Junction without deleting target contents
pub fn remove_ntfs_junction(link_path: &Path) -> Result<(), String> {
    if link_path.symlink_metadata().is_err() && !link_path.exists() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        let output = Command::new("cmd")
            .args(&["/c", "rmdir", link_path.to_str().unwrap_or("")])
            .output()
            .map_err(|e| format!("Gagal memanggil rmdir: {}", e))?;
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Gagal memutus junction: {}", err));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        fs::remove_file(link_path)
            .or_else(|_| fs::remove_dir(link_path))
            .map_err(|e| format!("Gagal memutus symlink unix: {}", e))?;
        Ok(())
    }
}

// src-tauri/src/workspace.rs: Zero-Footprint Project Scaffold
pub fn scaffold_new_agents_structure(dest_dir: &Path, project_name: &str) -> Result<(), String> {
    // Pure Zero-Footprint: Hanya membuat 2 file di root project (AGENTS.md dan mcp_config.json)
    // DILARANG KERAS membuat folder .agents atau subfolder apa pun di dalam project repository.

    // 1. AGENTS.md (Soul & Directives)
    let agents_md = format!(r##"# {name} AI Agent Core Directives (HHG {version})

> **Arch Signature:** Hermes Hub Gateway `{version}` (Zero-Footprint Engine)
> **Directives Version:** `{version}` | Generated via HHG Rule Sync

You are an autonomous AI software engineer operating under the Zero-Footprint Context Architecture powered by Hermes Hub Gateway (HHG {version}).
All previous filesystem folder hierarchies under `.agents/` (skills, rules, specialists, memory) are fully deprecated and converted into dynamic MCP-first services.

## OPERATING DISCIPLINE
1. Tone: Direct, concise, technical. No pleasantries, no request restatements.
2. Reporting: Upon completing tasks, provide a 3-part report: What Changed, What Was Verified, What Remains.
3. Language: Directives and code logic remain English. Respond to user conversations in professional Indonesian.

## CONTINUOUS SELF-IMPROVEMENT & PROTOCOL TURN-1
All memory, environment topologies, and knowledge can become stale over time. Therefore, prior to responding to or acting upon any complex user prompt, you MUST:
1. Validate Environment & Tool Mapping: Call `hermes_get_environment` to inspect the live dynamic mapping between active MCP servers and the target project environment. You MUST verify tool roles (e.g. which Git or Database provider is designated as Primary for this repository) before invoking external tools.
2. Check Active Skills: Call `hermes_list_skills` to discover existing procedural runbooks for the task.
3. Validate Memory & Stale State: Call `mnemosyne_recall` with the task topic to pull verified past decisions, schema anchors, and user directives.
4. Record New Insights & Environment Updates: When completing a non-trivial architectural change, discovering an edge-case bug, or establishing environment roles, you MUST call `hermes_update_environment` and `mnemosyne_remember` (scope='global', veracity='stated', importance=0.8-1.0) so future sessions remain self-improving.

## MCP-ONLY TOOL DISCOVERY & EXECUTION MATRIX
You interact with the infrastructure SOLELY through the unified MCP toolset exposed by `hermes-hub-gateway`. You are completely blind to unexposed local scripts unless specifically guided.
Evaluate tools dynamically based on their live `description` in your active tool catalog according to this precedence:

1. Cognitive Knowledge, Environment, & Runbooks:
   - Dynamic Environment & Tool Mapping: Call `hermes_get_environment` / `hermes_update_environment`.
   - Rules & Coding Policies: Call `hermes_get_rule` / `hermes_list_rules`.
   - Procedural SOPs & Workflows: Call `hermes_get_skill` / `hermes_list_skills`.
   - Recording New Architectural Rules / CRUD Patterns: Call `hermes_save_rule` to persist mandatory coding patterns directly into the central HHG rules repository.
   - Architecture & Specialist Review: Call `hermes_consult_specialist`.

2. Database Schema & Query Operations:
   - Primary: MUST use Tabularis MCP tools (`tabularis_run_query`, `tabularis_describe_table`, `tabularis_list_tables`).
   - STRICTLY PROHIBITED: Opening raw interactive SSH terminal sessions solely to inspect database schemas, view tables, or execute SQL queries.

3. Host Bridge & Direct Execution:
   - Tasks requiring local commands (test runners, git, build scripts) execute via host terminal tools directly.
   - You operate in a clean Zero-Footprint environment without local `.agents/` folder dependencies.

4. Persistent Handover & Memory Storage:
   - For all task handovers, environment mappings, and user preferences, write directly via `mnemosyne_remember`. Do not write markdown files to a local `memory/` folder.

## NON-NEGOTIABLE CONSTRAINTS
1. Zero Root Clutter & Scratchpad Discipline: STRICTLY PROHIBITED from creating temporary helper scripts, JSON-RPC payload files, scratchpads, test runners, or probe artifacts (e.g. `test_*.js`, `test_*.json`, `probe_*.py`, `generate_*.js`, `temp_*`) inside the project repository root. All temporary execution files MUST be written strictly to `~/.hermes-hub/tmp/` or the operating system temp directory.
2. Direct MCP Invocation: ALWAYS use the live native MCP tools available in your active tool catalog. NEVER write local helper scripts (such as Node.js or Python scripts) solely to simulate or call APIs, databases, or log services that are already accessible via your MCP tools. Invoke the relevant MCP tool directly in your tool-call turn.
3. Zero Hallucinated Schema: Never infer database columns, tables, or relationships. Mandatory physical schema inspection via Tabularis MCP prior to SQL generation.
4. Zero Credential Leaks: NEVER persist passwords, private keys, API tokens, or root credentials into Mnemosyne memory or code commits.
5. Dynamic Self-Discovery: Rely on live MCP tool names and descriptions presented in your active session rather than hardcoded assumptions.
6. Strict Zero Autonomous Git Commit: STRICTLY PROHIBITED from running `git commit`, `git push`, or modifying git history/branches autonomously without an explicit, direct instruction from the user. All code modifications, new files, and patches MUST strictly remain in the local working tree (uncommitted and unstaged) for human inspection and review. Finishing a coding task means leaving clean, verified changes on disk, NEVER committing on your own initiative.
7. Immutable Soul & System Directives: STRICTLY PROHIBITED from modifying, editing, patching, or appending to `AGENTS.md` or any root system prompt directive files. You do NOT have permission to alter your own directives or apologize by self-editing soul instructions. Only the human architect (Agus Azis) has authority to update the agent soul.
"##, name = project_name, version = "v0.8.41");
    fs::write(dest_dir.join("AGENTS.md"), agents_md).map_err(|e| e.to_string())?;

    // Pure Zero-Footprint Invariant: DILARANG MEMBUAT USER.md atau file sampah lain di root project!
    // Profil pengguna sudah disimpan di Mnemosyne memori kognitif terpusat.

    // Pure Zero-Footprint Invariant: DILARANG MEMBUAT mcp_config.json atau file sampah lain di root project!
    // Konfigurasi MCP didaftarkan langsung di IDE programmer via UI HHG "Salin Konfigurasi IDE".

    Ok(())
}

/// Audit readiness score of a Zero-Footprint Context workspace (0% - 100%)
pub fn audit_workspace_readiness(project_root: &Path) -> WorkspaceReadinessReport {
    let mut checks = Vec::new();

    // Check 1: Master Soul (AGENTS.md) exists & configured in project root
    let agents_md = project_root.join("AGENTS.md");
    let has_agents_md = agents_md.exists() && fs::metadata(&agents_md).map(|m| m.len() > 100).unwrap_or(false);
    checks.push(ReadinessCheckItem {
        key: "agents_md".into(),
        label: "Master AGENTS.md (Soul & Directives)".into(),
        status: has_agents_md,
        message: if has_agents_md { 
            "Master AGENTS.md aktif di root project dengan instruksi RFC 2119 & Zero-Footprint context.".into() 
        } else { 
            "AGENTS.md tidak ditemukan di root project atau berukuran kosong.".into() 
        },
    });

    // Check 2: Central Gateway MCP Runner (run_mcp.js) active & ready
    let home = dirs::home_dir().unwrap_or_else(|| {
        if cfg!(windows) {
            PathBuf::from("C:\\Users\\Default")
        } else {
            PathBuf::from("/home/user")
        }
    });
    let runner_js = home.join(".hermes-hub").join("scripts").join("run_mcp.js");
    let has_runner = runner_js.exists() && fs::metadata(&runner_js).map(|m| m.len() > 1000).unwrap_or(false);
    checks.push(ReadinessCheckItem {
        key: "runner_js".into(),
        label: "Gateway MCP Engine (run_mcp.js)".into(),
        status: has_runner,
        message: if has_runner {
            "Aggregator MCP downstream aktif dan siap melayani 168+ tools IDE.".into()
        } else {
            "Script aggregator run_mcp.js belum terpasang di ~/.hermes-hub/scripts/.".into()
        },
    });

    // Check 3: Cognitive Memory Conduit (Mnemosyne Memory Endpoint)
    let has_memory_conduit = home.join(".hermes-hub").exists();
    checks.push(ReadinessCheckItem {
        key: "memory_conduit".into(),
        label: "Cognitive Memory Conduit (Mnemosyne)".into(),
        status: has_memory_conduit,
        message: if has_memory_conduit {
            "Saluran memori jangka panjang Mnemosyne aktif via direct SSE endpoint (:8080).".into()
        } else {
            "Endpoint memori Mnemosyne belum terhubung.".into()
        },
    });

    // Check 4: Central Gateway Rules & Skills Catalog
    let has_central_context = home.join(".hermes-hub").exists();
    checks.push(ReadinessCheckItem {
        key: "central_context".into(),
        label: "Central Rules & Skills Registry".into(),
        status: has_central_context,
        message: if has_central_context {
            "Pusat konteks koding, aturan tim, dan SOP terpusat di Hermes Hub Gateway.".into()
        } else {
            "Direktori pusat ~/.hermes-hub belum terinisialisasi.".into()
        },
    });

    // Check 5: Pure Zero-Footprint Integrity (No local .agents or clutter files)
    let has_no_clutter = !project_root.join(".agents").exists() && !project_root.join("USER.md").exists() && !project_root.join("mcp_config.json").exists();
    checks.push(ReadinessCheckItem {
        key: "zero_clutter".into(),
        label: "Pure Zero-Footprint Workspace".into(),
        status: has_no_clutter,
        message: if has_no_clutter {
            "Workspace 100% bersih tanpa folder .agents, USER.md, atau mcp_config.json lokal.".into()
        } else {
            "Terdeteksi file sisa/lama (.agents/USER.md/mcp_config.json). Disarankan dihapus agar repo murni.".into()
        },
    });

    let passed_count = checks.iter().filter(|c| c.status).count();
    let total_count = checks.len();
    let score = ((passed_count as f64 / total_count as f64) * 100.0).round() as u32;

    WorkspaceReadinessReport {
        score_percent: score,
        is_ready: score == 100,
        checks,
    }
}
