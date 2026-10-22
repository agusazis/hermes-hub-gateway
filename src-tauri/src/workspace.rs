use std::path::Path;
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

/// Scaffold a brand new .agents architecture following Antigravity + Hermes conventions
pub fn scaffold_new_agents_structure(dest_dir: &Path, project_name: &str) -> Result<(), String> {
    let memory_dir = dest_dir.join("memory");
    let rules_dir = dest_dir.join("rules");
    let specialists_dir = dest_dir.join("specialists");
    let skills_dir = dest_dir.join("skills");
    let tools_dir = dest_dir.join("tools");

    fs::create_dir_all(&memory_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&rules_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&specialists_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&skills_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;

    // 1. AGENTS.md (Soul & Directives)
    let agents_md = format!(r##"# {name} AI Agent Core Directives

You are the senior autonomous AI software engineer for RSUD dr. H. Jusuf SK.
You operate strictly under the Zero-Footprint Context Architecture powered by Hermes Hub Gateway (HHG).
All previous filesystem folder hierarchies under `.agents/` (skills, rules, specialists, memory) are fully deprecated and converted into dynamic MCP-first services.

## OPERATING DISCIPLINE
1. Tone: Direct, concise, technical. No pleasantries, no request restatements.
2. Reporting: Upon completing tasks, provide a 3-part report: What Changed, What Was Verified, What Remains.
3. Language: Directives and code logic remain English. Respond to user conversations in professional Indonesian.

## CONTINUOUS SELF-IMPROVEMENT & PROTOCOL TURN-1
All memory and knowledge can become stale over time. Therefore, prior to responding to or acting upon any complex user prompt, you MUST:
1. Check Active Skills: Call `hermes_list_skills` to discover existing procedural runbooks for the task.
2. Validate Memory & Stale State: Call `mnemosyne_recall` with the task topic to pull verified past decisions, schema anchors, and user directives.
3. Record New Insights: When completing a non-trivial architectural change, discovering an edge-case bug, or receiving explicit environment updates from the user, you MUST call `mnemosyne_remember` (scope='global', veracity='stated', importance=0.8-1.0) so future sessions remain self-improving.

## MCP-ONLY TOOL DISCOVERY & EXECUTION MATRIX
You interact with the infrastructure SOLELY through the unified MCP toolset exposed by `hermes-hub-gateway`. You are completely blind to unexposed local scripts unless specifically guided.
Evaluate tools dynamically based on their live `description` in your active tool catalog according to this precedence:

1. Cognitive Knowledge & Runbooks:
   - Rules & Coding Policies (ExtJS, PHP 8.2, Query Policies): Call `hermes_get_rule` / `hermes_list_rules`.
   - Procedural SOPs & Workflows: Call `hermes_get_skill` / `hermes_list_skills`.
   - Architecture & Specialist Review: Call `hermes_consult_specialist`.

2. Database Schema & Query Operations:
   - Primary: MUST use Tabularis MCP tools (`tabularis_run_query`, `tabularis_describe_table`, `tabularis_list_tables`).
   - STRICTLY PROHIBITED: Opening raw interactive SSH terminal sessions solely to inspect database schemas, view tables, or execute SQL queries.

3. Host Bridge & Local Tool Mitigation (Bridge via Host Shell):
   - You do NOT have direct local terminal visibility into `.agents/tools/` scripts (such as VM SSH wrappers).
   - If a task explicitly demands VM lifecycle management, service restarts, or host compilation that is NOT covered by any MCP tool:
     Execute the pre-configured host wrapper script via shell command:
     `powershell -ExecutionPolicy Bypass -File .agents/tools/agent.ps1 <subcommand>`
   - Direct interactive SSH into the VM is an absolute last-resort fallback, permitted ONLY when low-level OS kernel diagnostics or network socket troubleshooting cannot be achieved via host tools or MCP.

4. Persistent Handover & Memory Storage:
   - For all task handovers, environment mappings, and user preferences, write directly via `mnemosyne_remember`. Do not write markdown files to a local `memory/` folder.

## NON-NEGOTIABLE CONSTRAINTS
1. Zero Hallucinated Schema: Never infer database columns, tables, or relationships. Mandatory physical schema inspection via Tabularis MCP prior to SQL generation.
2. Zero Credential Leaks: NEVER persist passwords, private keys, API tokens, or root credentials into Mnemosyne memory or code commits.
3. Dynamic Self-Discovery: Rely on live MCP tool names and descriptions presented in your active session rather than hardcoded assumptions.
"##, name = project_name);
    fs::write(dest_dir.join("AGENTS.md"), agents_md).map_err(|e| e.to_string())?;

    // 2. USER.md (Template)
    let user_md = r##"# Developer Identity & Output Preferences

- **Name**: [Nama Pengembang]
- **Role**: Fullstack Developer
- **Preferred Language**: Bahasa Indonesia (teknis santun)
- **Output Preferences**:
  - Direct & concise (tanpa filler kata manis).
  - Tulis unit-test sebelum menyimpulkan kode selesai.
  - Setiap perubahan schema wajib menyertakan DDL audit.
"##;
    fs::write(dest_dir.join("USER.md"), user_md).map_err(|e| e.to_string())?;

    // 3. memory/ENVIRONMENT.md
    let env_md = r##"# Authoritative Environment & Infrastructure Boundaries

## Servers & Networks
- **Development Server**: `http://127.0.0.1:8000`
- **Database Host**: `127.0.0.1:3306` (MariaDB/MySQL)
- **Hermes Evaluator**: `http://172.168.1.202:9125`
- **Mnemosyne Memory**: `http://172.168.1.202:8080`

## Operational Constraints
- Dilarang menjalankan query `DROP TABLE` tanpa konfirmasi eksplisit.
- Seluruh endpoint API internal terlindung di jaringan intranet.
"##;
    fs::write(memory_dir.join("ENVIRONMENT.md"), env_md).map_err(|e| e.to_string())?;

    // 4. memory/anchors.json
    let anchors_json = format!(
        "{{\n  \"project_name\": \"{}\",\n  \"gitlab_project_id\": null,\n  \"created_at\": \"2026-10-20\"\n}}",
        project_name
    );
    fs::write(memory_dir.join("anchors.json"), anchors_json).map_err(|e| e.to_string())?;

    // 5. mcp_config.json (Cross-Platform Dynamic Path)
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    #[cfg(windows)]
    let node_cmd = home.join("AppData").join("Local").join("hermes").join("node").join("node.exe");
    #[cfg(not(windows))]
    let node_cmd = PathBuf::from("node");

    let run_mcp_script = home.join(".hermes-hub").join("scripts").join("run_mcp.js");

    let mcp_config_json = serde_json::json!({
        "mcpServers": {
            "mnemosyne": {
                "serverUrl": "http://172.168.1.202:8080/sse"
            },
            "hermes-hub-gateway": {
                "command": node_cmd.to_string_lossy().replace('\\', "/"),
                "args": [
                    run_mcp_script.to_string_lossy().replace('\\', "/")
                ]
            }
        }
    });
    fs::write(dest_dir.join("mcp_config.json"), serde_json::to_string_pretty(&mcp_config_json).unwrap_or_default()).map_err(|e| e.to_string())?;

    // 6. Sample skill
    let sample_skill_dir = skills_dir.join("sample-clean-code");
    fs::create_dir_all(&sample_skill_dir).map_err(|e| e.to_string())?;
    let sample_skill = r##"---
name: sample-clean-code
description: Panduan penulisan clean code dan arsitektur modular.
---

# Clean Code Guidelines

1. Gunakan nama variabel dan fungsi yang mencerminkan intent bisnis.
2. Hindari fungsi yang melebihi 50 baris kode (Separation of Concerns).
3. Selalu tangani exception secara terisolasi tanpa membiarkan crash fatal.
"##;
    fs::write(sample_skill_dir.join("SKILL.md"), sample_skill).map_err(|e| e.to_string())?;

    Ok(())
}

/// Audit readiness score of a workspace (0% - 100%)
pub fn audit_workspace_readiness(project_root: &Path) -> WorkspaceReadinessReport {
    let mut checks = Vec::new();
    let agents_dir = project_root.join(".agents");

    // Check 1: .agents exists
    let has_agents = agents_dir.exists();
    checks.push(ReadinessCheckItem {
        key: "agents_dir".into(),
        label: "NTFS Junction / Direktori .agents".into(),
        status: has_agents,
        message: if has_agents { "Direktori .agents terpasang dengan baik.".into() } else { "Direktori .agents tidak ditemukan di root project.".into() },
    });

    // Check 2: AGENTS.md exists & not empty
    let agents_md = if has_agents { agents_dir.join("AGENTS.md") } else { project_root.join("AGENTS.md") };
    let has_agents_md = agents_md.exists() && fs::metadata(&agents_md).map(|m| m.len() > 100).unwrap_or(false);
    checks.push(ReadinessCheckItem {
        key: "agents_md".into(),
        label: "Master AGENTS.md (Soul & Directives)".into(),
        status: has_agents_md,
        message: if has_agents_md { "Master AGENTS.md aktif dan berisi aturan lengkap.".into() } else { "AGENTS.md tidak ada atau berukuran kosong.".into() },
    });

    // Check 3: USER.md configured (not default placeholder)
    let user_md = agents_dir.join("USER.md");
    let user_configured = if user_md.exists() {
        if let Ok(content) = fs::read_to_string(&user_md) {
            !content.contains("[Nama Pengembang]") && 
            !content.contains("[Unit Kerja]") && 
            content.trim().len() > 30
        } else {
            false
        }
    } else {
        false
    };
    checks.push(ReadinessCheckItem {
        key: "user_md".into(),
        label: "Identitas Pengembang (USER.md)".into(),
        status: user_configured,
        message: if user_configured { "USER.md telah dikonfigurasi dengan profil developer riil.".into() } else { "USER.md belum diisi atau masih menggunakan placeholder default.".into() },
    });

    // Check 4: memory/ENVIRONMENT.md configured
    let env_md = agents_dir.join("memory").join("ENVIRONMENT.md");
    let env_configured = if env_md.exists() {
        if let Ok(content) = fs::read_to_string(&env_md) {
            content.contains("http") || content.contains("172.") || content.contains("192.") || content.contains("10.") || content.contains("127.0.0.1")
        } else {
            false
        }
    } else {
        false
    };
    checks.push(ReadinessCheckItem {
        key: "environment_md".into(),
        label: "Ground Truth Topologi (ENVIRONMENT.md)".into(),
        status: env_configured,
        message: if env_configured { "Topologi server & boundary environment valid.".into() } else { "ENVIRONMENT.md belum memuat endpoint server valid.".into() },
    });

    // Check 5: skills directory has at least 1 valid skill
    let skills_dir = agents_dir.join("skills");
    let has_skills = skills_dir.exists() && fs::read_dir(&skills_dir).map(|mut d| d.next().is_some()).unwrap_or(false);
    checks.push(ReadinessCheckItem {
        key: "skills".into(),
        label: "SOP & Skills Runbook Catalog".into(),
        status: has_skills,
        message: if has_skills { "Katalog skill SOP terdeteksi dan siap digunakan on-demand.".into() } else { "Folder skills kosong atau belum terisi.".into() },
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
