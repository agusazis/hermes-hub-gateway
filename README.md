# Hermes Hub Gateway (HHG)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-cyan.svg)](https://v2.tauri.app/)
[![React 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

**Hermes Hub Gateway (HHG)** is a lightweight, cross-platform desktop application and cognitive control plane designed to bridge modern AI-assisted IDEs (Antigravity, Cursor, VS Code, Windsurf) with autonomous AI agent runbooks, distributed Model Context Protocol (MCP) servers, and continuous self-improvement evaluators.

Built with **Tauri v2 (Rust backend)** and **React 18 / Tailwind CSS (Frontend)**, HHG provides a unified developer cockpit to manage multi-workspace cognitive architectures, single named-pipe MCP bridges, and zero-copy filesystem linking.

---

## 🌟 Key Architecture & Capabilities

### 1. Unified Single MCP Pipe Bridge
Instead of spawning and configuring dozens of independent MCP servers in individual IDE configuration files, HHG multiplexes them behind a single, high-performance local IPC channel:
* **Windows:** Named Pipe `\\.\pipe\hhg-bridge`
* **Linux / macOS:** Domain Socket `/tmp/hhg-bridge.sock`
* **Multiplexed Dispatch:** Seamlessly routes JSON-RPC 2.0 tool requests to underlying MCP stacks (Databases, Git Platforms, Observability, Knowledge Graphs, Network appliances) while providing granular per-tool toggling and bulk health checks.

### 2. Zero-Copy Workspace Linking (Filesystem Junctions)
* Connects your project codebase (`<project_root>/.agents`) to a dedicated remote or local cognitive architecture repository via OS-native junctions (`mklink /J` on Windows, Symlinks on Unix).
* **Isolation of Concerns:** The IDE assistant can inspect rules, load SOP skills, and update environment state directly on disk, while all upstream Git synchronization (push/pull/merge) is managed safely in the background by HHG.

### 3. Progressive Disclosure Skill Runbooks
* Adopts progressive disclosure standards for agent context windows: instead of flooding LLM prompts with monolithic instructions, skills are dynamically structured with frontmatter triggers and loaded on demand.

### 4. Turn 1 Deterministic Handover Bootstrap
* Integrates with stateful cognitive memory servers (e.g., Mnemosyne) to retrieve canonical handover checkpoints instantly upon starting a new chat turn, eliminating stale transcript parsing overhead.

### 5. Automated Organization & Team Provisioning
* Rapid onboarding for development teams via cryptographic **Organization Setup Keys**.
* One-click provisioning automatically binds central evaluator endpoints, shared memory nodes, and broadcast telemetry channels without leaking personal Git access tokens or local MCP configurations.

---

## 🚀 Quick Start Guide

### Prerequisites
* Windows 10/11, macOS, or modern Linux desktop.
* Node.js 18+ & Rust stable toolchain (for building from source).

### Running from Source
```bash
# 1. Clone repository
git clone https://github.com/agusazis/hermes-hub-gateway.git
cd hermes-hub-gateway

# 2. Install dependencies
npm install

# 3. Run verification gates
npm run verify

# 4. Launch Desktop App in Development Mode
npm run tauri dev
```

### Production Build
```bash
npm run tauri build
```
The compiled native installer (`.msi` or `.exe` on Windows, `.dmg` on macOS, `.deb`/`.AppImage` on Linux) will be generated in `src-tauri/target/release/bundle/`.

---

## 🧭 Navigation & Workflow

1. **Profile & Gateway Hub (Primary Configuration):**
   * Configure target Evaluator and Shared Memory endpoints.
   * Apply team provisioning keys or configure broadcast alert webhooks.
2. **Workspaces & Skills Manager:**
   * Manage isolated coding projects.
   * Link existing cognitive architecture repositories or scaffold new Antigravity/Hermes structures with built-in readiness auditing.
3. **MCP Servers Hub:**
   * Monitor registered MCP server processes.
   * Enable/disable individual calling functions with one click and run batch handshake diagnostics.
4. **System Dashboard:**
   * High-level health telemetry, active bridges, and workspace statistics.
5. **Evolution Logs:**
   * Live streaming of structured JSON telemetry and agent evaluations.

---

## 🔒 Security & Credential Isolation

* **Strict Credential Privacy:** Personal Git Access Tokens (PAT) and private MCP credentials stay strictly on the local machine and are never included in shared team provisioning digests.
* **Non-Invasive Watcher Architecture:** Background telemetry monitors file modification events passively without intercepting or altering IDE runtime binaries.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
