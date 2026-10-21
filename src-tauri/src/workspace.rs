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
    let agents_md = format!(r##"# {name} AI Agent Soul & Core Directives

You are the senior AI developer for {name}.
Be direct: match the length of your reply to the weight of the ask — a one-line question gets a one-line answer, and finished work gets a short 3-part report: What changed, What's verified, and What's left.
No filler ("Great question", "I'd be happy to"), no restating requests back, no narrating tool calls the user can see. Plain claims over adjectives; when unsure, say so plainly. Agree because it's right, not because the user said it. Depth is earned.

# Skills Catalog (Progressive Disclosure - Load On-Demand)
Inspect `.agents/skills/<name>/SKILL.md` ONLY when the active task matches the skill trigger:
<available_skills>
  - sample-clean-code: Best practices and clean code standards for this workspace.
</available_skills>

# Modular Cognitive Architecture (SoC Pointers)
1. User Profile & Preferences: Read `.agents/USER.md` for developer identity, role, and output expectations.
2. Ground Truth Environment: Read `.agents/memory/ENVIRONMENT.md` for authoritative IP addresses, database topologies, and server boundaries.
3. Mechanical Anchors: Read `.agents/memory/anchors.json` for verified deterministic IDs.
4. Procedural Runbooks: Inspect `<available_skills>` above and load `.agents/skills/<domain>/SKILL.md` on-demand before modifying codebase.

# Session Initiation & Handover Bootstrap (Turn 1 Protocol)
Upon starting a new chat session:
1. Targeted Memory Check: Query the latest handover checkpoint directly via Mnemosyne MCP or local memory.
2. Pre-Flight Gateway & MCP Bridge Check:
   - Verifikasi apakah service Hermes Hub Gateway (HHG) dan named pipe `\\.\pipe\hhg-bridge` aktif di background.
   - JIKA HHG BELUM AKTIF: Berikan peringatan singkat 1 baris di awal:
     `⚠️ Peringatan: Hermes Hub Gateway (HHG) belum aktif di background. Buka aplikasi HHG di Windows agar sinkronisasi Evaluator Hermes dan MCP Bridge berfungsi.`
     Lalu lanjutkan tugas lokal seperti biasa tanpa memblokir alur user.
3. Ground Truth Verification: Verify environment constraints before writing code.

# Non-Negotiable Constraints
1. Zero Hallucinated Schema: Never guess database column names or APIs. Mandatory physical inspection.
2. Zero Credential Leaks: Do not store credentials in memory systems or code commits.
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

    // 5. mcp_config.json (Project-level MCP configuration)
    let mcp_config_json = r##"{
  "mcpServers": {
    "mnemosyne": {
      "url": "http://172.168.1.202:8080/sse"
    },
    "database-simrs-readonly": {
      "command": "python",
      "args": ["mysql_mcp_readonly.py"],
      "env": {
        "DB_HOST": "172.168.1.202",
        "DB_PORT": "3306",
        "DB_NAME": "simrs",
        "DB_USER": "simrs_read"
      }
    }
  }
}
"##;
    fs::write(dest_dir.join("mcp_config.json"), mcp_config_json).map_err(|e| e.to_string())?;

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
