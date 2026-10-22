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
* **Scaffold Invariants (Pure 2 Artifacts):**
  1. `AGENTS.md`: High-compliance system prompt adhering to RFC 2119 English directives, Turn-1 memory staleness checks, and bidirectional rule authoring.
  2. `mcp_config.json`: Standard client config mapping `hermes-hub-gateway` to `run_mcp.js` and `mnemosyne` to the SSE endpoint.
* **Zero Local Folder:** No `.agents/` folder or subdirectories are created inside the project repository.
* **Prohibited Behavior:**
  - `mklink /J` or `std::os::windows::fs::symlink_dir` MUST NOT be invoked.
  - Physical subfolders `.agents/skills`, `.agents/rules`, `.agents/memory` MUST NOT be created inside the workspace.

### B. MCP Engine (`src-tauri/src/mcp_bridge.rs` & `src-tauri/src/config.rs`)
* **Canonical Runner:** `~/.hermes-hub/scripts/run_mcp.js` (Size: ~12 KB embedded downstream aggregator).
* **Backward-Compatibility Alias:** `~/.hermes-hub/scripts/mcp_server.js` (Mirrored from `run_mcp.js`).
* **Safe-Write Contract (`config.rs`):**
  - Before writing, check if the file exists and has size > 0.
  - If locked by a running IDE process, DO NOT overwrite with 0 bytes.
  - Write bytes atomically to ensure zero-byte file corruptions never occur on startup.
* **Exposed Gateway Tools:**
  - `hermes_list_rules`, `hermes_get_rule`, `hermes_save_rule` (Dynamic rule store).
  - `hermes_list_skills`, `hermes_get_skill` (SOP inspection).
  - `hermes_consult_specialist` (Role-based operational delegation).

### C. Watcher & Git Sync Engine (`src-tauri/src/watcher.rs`)
* **Role:** Synchronizes SOPs, skills, and rules from the RSUD GitLab repository to the central gateway cache (`~/.hermes-hub/workspaces/<id>/skills/`).
* **Trigger:** Startup auto-sync + background interval loop.
* **Physical Isolation:** The sync engine writes ONLY to `~/.hermes-hub/`, never polluting individual client project folders.

---

## 3. STRICT OPERATIONAL DISCIPLINE
1. **Never Assume — Verify Physical Files First:** Inspect actual disk contents and active process locks before making architectural or code assertions.
2. **Never Patch Locally Without Repo Push:** Fixing files on a client laptop via ad-hoc commands without committing to the central repository is strictly prohibited. All fixes must originate from and be verified in git.
3. **Canonical Naming Enforcement:** Do not introduce alternate filenames (`mcp_server_v2.js`, `runner_test.js`). The stdio engine runner is and will always be `run_mcp.js`.
