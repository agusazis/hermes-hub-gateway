# Changelog

All notable changes to **Hermes Hub Gateway (HHG)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.8.0] - 2026-10-21

### Added
- **Single Named Pipe MCP Bridge (`\\.\pipe\hhg-bridge`)**: Multiplexed JSON-RPC 2.0 dispatcher connecting IDEs (Antigravity, Cursor, VS Code) to full MCP suites without per-IDE config sprawl.
- **Full ai-agents Adoption via NTFS Junction (`mklink /J`)**: Zero-copy filesystem linking linking `<project>/.agents` directly to the central cognitive architecture repository.
- **Dual-Mode Workspace Wizard**:
  - **Mode A (Select Existing Repository)**: Direct GitLab/GitHub auto-discovery, pagination, search filtering, and Project Access Token (PAT) validation.
  - **Mode B (Create New Architecture)**: Automated scaffolding of `AGENTS.md`, `USER.md`, `memory/ENVIRONMENT.md`, `anchors.json`, and SOP runbooks.
- **Workspace Readiness & Health Gatekeeper**: Automated real-time verification scoring (0-100%) checking NTFS Junction health, directive contracts, developer identity, and topology boundaries.
- **One-Key Organization Provisioning**: Cryptographically hashed team onboarding key (`SIRS-JSK-AI-AGENTS-2026`) automatically configuring central Hermes Evaluator (`172.168.1.202:9125`), Mnemosyne Shared Memory (`172.168.1.202:8080`), and broadcast channels.
- **Batch MCP Server Testing**: One-click bulk handshake diagnostics (`Test Semua Server MCP`) with automatic discovery and function count aggregation across all registered servers.
- **Profile & Gateway Hub Reorganization**: Elevated the central Evaluator & Memory configuration to the primary top-level navigation menu.

### Changed
- Refactored `App.tsx` and `workspace.rs` to support standalone, enterprise-grade architecture without proprietary domain hardcoding.
- Decoupled Git remote synchronization from IDE runtime: Git push/pull is now managed exclusively by the HHG background engine.
- Replaced legacy turn 1 watcher check script hooks (`watch_transcript.ps1`, `ensure-watcher`) with deterministic Mnemosyne canonical memory retrieval.

### Fixed
- Fixed IDE prompt startup hanging caused by missing watcher shell scripts or uninitialized drive states.
- Fixed MCP tool count UI displaying 0 discovered functions prior to manual handshake execution by introducing a pre-populated comprehensive tool catalog.
- Resolved GitLab Project Access Token scoping issues by removing strict membership filtering.

---

## [v0.7.9] - 2026-10-20

### Added
- **Collapsible Navigation Sidebar**: Toggle between compact icon-only mode (`w-18`) and expanded view (`w-64`) with smooth transition animations.
- Icon-only tooltip hints and dynamic status indicators for background Evaluator telemetry.

### Fixed
- Screen real-estate constraints on standard laptop displays during split-pane workspace inspection and telemetry streaming.

---

## [v0.7.8] - 2026-10-20

### Added
- Streamlined sidebar navigation with a compact version and changelog footer indicator.

### Changed
- Reorganized menu hierarchy to prioritize core development workflows.

---

## [v0.7.7] - 2026-10-20

### Added
- Unified Workspaces & Skills Manager integrating project runbooks with SOP document viewers.
- Clean form state lifecycle resetting credentials and form fields on cancel/close.

---

## [v0.7.6] - 2026-10-19

### Added
- Dual-mode Dark / Light theme transition system with zero CSS contrast bleed.
- Built-in Disaster Recovery Center with local configuration export/import.
