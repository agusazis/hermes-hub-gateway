# ENGINE & ARCHITECTURE SPECIFICATION
**Hermes Hub Gateway (HHG) Multi-Tier Ecosystem**
*Authoritative Documentation: Single Source of Truth*

---

## 1. ECOSYSTEM ARCHITECTURE MATRIX

| Tier | Component / Boundary | Runtime / Host | Canonical Path / Port | Primary Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Gateway Hub** | `Hermes Hub Gateway` | Tauri (Rust + React) | `~/.hermes-hub/` | Central management, UI dashboard, config store, rules repo sync. |
| **Internal MCP Hub** | `mcp_bridge.rs` | Rust (Native Tokio) | `http://127.0.0.1:9126` & `\\.\pipe\hhg-bridge` | Dynamic rules (`hermes_get_rule`, `hermes_save_rule`), workspace SOPs, specialist delegation. |
| **Downstream Aggregator** | `run_mcp.js` | Node.js (Client runtime) | `~/.hermes-hub/scripts/run_mcp.js` | **The Single Canonical MCP Stdio Runner**. Aggregates RSUD MariaDB, Synology DSM, MikroTik, Grafana, Evaluator SOPs into Antigravity IDE. |
| **Client Workspace** | Zero-Footprint Context | Antigravity IDE (VS Code fork) | `<project_root>/` | Target repository. Only contains `AGENTS.md`, `mcp_config.json`, and `.agents/tools/agent.ps1`. |
| **Cognitive Memory** | Mnemosyne Service | BEAM / SQLite / Vector | `http://172.168.1.202:8080/sse` | Central cross-session episodic & canonical memory store. |
| **Evaluator Engine** | Hermes Evaluator | FastAPI / Python | `http://172.168.1.202:9125` | Automated skill extraction, reflection, Git SOP publisher. |

---

## 2. SUBSYSTEM ENGINES & SOURCE-OF-TRUTH

### A. Workspace Engine (`src-tauri/src/workspace.rs` & `src-tauri/src/main.rs`)
* **Role:** Connects codebases to the gateway without directory clutter or OS-level junction symlinks.
* **Scaffold Invariants (Pure 1 Artifact - The True Single File):**
  1. `AGENTS.md`: High-compliance system prompt adhering to RFC 2119 English directives, Turn-1 memory staleness checks, bidirectional rule authoring, Zero-Root Clutter discipline, and Direct MCP Invocation.
* **IDE MCP Connection Pattern:**
  - IDE configuration is managed globally per IDE (via "Salin Konfigurasi IDE" in the HHG UI).
  - Writing `mcp_config.json` into the project repository root is strictly prohibited to keep git status clean.
* **Idempotent Reset on Sync:** Whenever "Sync Rules Now" is triggered, HHG automatically pulls the latest rules and re-scaffolds `AGENTS.md` in the target workspace, allowing developers to restore default directives with one click.
* **Zero Local Folder:** No `.agents/` folder, no `USER.md`, and no `mcp_config.json` are created inside the project repository.
* **Prohibited Behavior:**
  - `mklink /J` or `std::os::windows::fs::symlink_dir` MUST NOT be invoked.
  - Generating `USER.md` in root target directory is strictly prohibited.
  - Physical subfolders `.agents/skills`, `.agents/rules`, `.agents/memory` MUST NOT be created inside the workspace.

### B. MCP Engine (`src-tauri/src/mcp_bridge.rs` & `src-tauri/src/config.rs`)
* **Canonical Runner:** `~/.hermes-hub/scripts/run_mcp.js` (Size: ~12 KB embedded downstream aggregator).
* **Backward-Compatibility Alias:** `~/.hermes-hub/scripts/mcp_server.js` (Mirrored from `run_mcp.js`).
* **Safe-Write Contract (`config.rs`):**
  - Before writing, check if the file exists and has size > 0.
  - If locked by a running IDE process, DO NOT overwrite with 0 bytes.
  - Write bytes atomically to ensure zero-byte file corruptions never occur on startup.
* **Exposed Gateway Tools (Complete 6-Tool Suite):**
  - `hermes_list_skills`, `hermes_get_skill` (SOP & Runbooks inspection).
  - `hermes_list_rules`, `hermes_get_rule` (Dynamic architecture rule reader).
  - `hermes_save_rule` (Bidirectional rule writer from IDE to gateway).
  - `hermes_consult_specialist` (Role-based operational delegation).

### C. Watcher & Git Sync Engine (`src-tauri/src/watcher.rs`)
* **Role:** Synchronizes SOPs, skills, and rules from the RSUD GitLab repository to the central gateway cache (`~/.hermes-hub/workspaces/<id>/skills/`).
* **Trigger:** Startup auto-sync + background interval loop.
* **Physical Isolation:** The sync engine writes ONLY to `~/.hermes-hub/`, never polluting individual client project folders.

---

## 3. STRICT BOUNDARY SEPARATION: ENGINE VS KNOWLEDGE

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HERMES HUB GATEWAY (HHG ENGINE)                      │
│ - Menangani 100% Runtime, Binary, Stdio/SSE Transports, & Process Lifecycle│
│ - Eksekusi `run_mcp.js`, Child Process Spawning, Aggregator, Fallbacks │
│ - Scaffolding Project: Men-generate `AGENTS.md` & `mcp_config.json`   │
│ - Menolak keras pembuatan folder `.agents/` atau script engine lokal  │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                     Virtual MCP Knowledge Bridge
          (hermes_list_skills, hermes_get_skill, hermes_list_rules)
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 REPOSITORI `ai-agents` (PURE KNOWLEDGE)                │
│ - 100% PURE DOKUMENTASI, RUNBOOKS, STANDAR ARSITEKTUR, & KAIDAH         │
│ - DILARANG MEMUAT: script eksekusi (.ps1, .sh, .js, .py), binary runner│
│ - STRUKTUR RESMI HANYA:                                                │
│   ├── skills/         -> Prosedural runbooks (SKILL.md)                │
│   ├── rules/          -> Pedoman koding arsitektural (.md)             │
│   ├── checklists/     -> QA & Deployment checklists (.md)              │
│   └── architecture/   -> Spesifikasi teknis & diagram Markdown         │
└────────────────────────────────────────────────────────────────────────┘
```

* **Larangan Skrip di `ai-agents`:** Repositori `ai-agents` tidak boleh lagi memuat engine runner, file `.ps1`, `.bat`, atau script bridge. Seluruh eksekusi dan bridging microservices adalah tanggung jawab mutlak HHG.
* **Pure Context Delivery:** AI Agent di IDE mengakses SOP dan kaidah murni melalui tool call (`hermes_list_skills`, `hermes_get_skill`, `hermes_list_rules`, `hermes_get_rule`), bukan lewat filesystem lokal.

## 4. STRICT OPERATIONAL DISCIPLINE
1. **Never Assume — Verify Physical Files First:** Inspect actual disk contents and active process locks before making architectural or code assertions.
2. **Never Patch Locally Without Repo Push:** Fixing files on a client laptop via ad-hoc commands without committing to the central repository is strictly prohibited. All fixes must originate from and be verified in git.
4. **Canonical Naming Enforcement:** Do not introduce alternate filenames (`mcp_server_v2.js`, `runner_test.js`). The stdio engine runner is and will always be `run_mcp.js`.
5. **Telegram Notification Decoupling (Plugin Architecture):** Telegram broadcast notifications are exclusively handled by the centralized Hermes Evaluator backend service. The desktop HHG client does not act as a notification dispatcher. External developers must configure backend broadcast via `plugins/telegram-notifier/README.md`.
