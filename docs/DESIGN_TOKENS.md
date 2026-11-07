# Hermes Hub Gateway Design System & Token Contract

> **Architecture:** Inspired by Tabularis Design Token System (`tabularisdb/tabularis`).
> **Governance:** Governed by `scripts/verify-all.mjs` (Pre-Build Gate 2/3).

Hermes Hub Gateway adopts a strict, dual-theme token architecture (Dark / Light / System Auto) that ensures maximum legibility, zero un-adapted dark containers, and a locked semantic accent palette.

## 1. Five-Tier Elevation Surfaces

All application views must derive surfaces from central tokens rather than hardcoded Tailwind palette classes:

| Token Name | Light Mode (Day) | Dark Mode (Night) | Architectural Purpose |
| :--- | :--- | :--- | :--- |
| `--color-app-bg` | `#ffffff` (Pure White) | `#020617` (Deep Obsidian / Slate 950) | Root canvas / window background |
| `--color-app-surface` | `#f8fafc` (Slate 50) | `#0f172a` (Elevated Slate 900) | Sidebar, main containers, outer panels |
| `--color-app-overlay` | `#f1f5f9` (Slate 100) | `#1e293b` (Overlay Slate 800) | Modals, dialogs, popovers, dropdowns |
| `--color-app-card` | `#ffffff` (Card Surface) | `#0b0f19` (Obsidian Card) | List item cards, child rows |
| `--color-app-border` | `#e2e8f0` (Slate 200) | `#1e293b` (Slate 800) | Standard layout boundaries & dividers |
| `--color-app-border-strong` | `#cbd5e1` (Slate 300) | `#334155` (Slate 700) | Active / hover borders |

## 2. Locked Semantic Accent Palette

Colors in HHG are driven strictly by **meaning, not arbitrary preference**:

| Semantic Intent | CSS Variable | Light Mode (Deep & Saturated) | Dark Mode (Luminous) | Usage Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Action** | `--color-accent-primary` | `#1e6ff5` (Royal Cobalt) | `#3b82f6` (Vibrant Azure) | Primary CTA buttons, active tabs, selected states |
| **Tools & AI Engine** | `--color-accent-secondary` | `#8250f5` (Deep Royal Violet) | `#9063f6` (Vibrant Violet) | Pull AGENTS.md button, MCP Hub tools, extensions |
| **Success & Active** | `--color-accent-success` | `#17843f` (Deep Forest Green) | `#22c55e` (Vibrant Emerald) | Evaluator/Mnemosyne ONLINE status, Git sync success |
| **Warning & Audit** | `--color-accent-warning` | `#a06707` (Deep Honey Amber) | `#f59e0b` (Warm Amber) | SSH audit alerts, pending workspace preparation |
| **Danger & Delete** | `--color-accent-error` | `#e51414` (Deep Crimson) | `#ef4444` (Vivid Red) | Destructive actions, connection failures, errors |
| **Telemetry & Log** | `--color-accent-info` | `#047e92` (Deep Cyan Teal) | `#06b6d4` (Cyan Teal) | Watcher telemetry, IPC Named Pipe events, metrics |

## 3. Standardized Component Atoms (`@layer components`)

Components should use these pre-composed atomic classes to eliminate style fragmentation:

- `.hhg-card-surface`: Primary content containers and panels.
- `.hhg-card-item`: Child list items with automatic hover elevation.
- `.hhg-card-item-selected`: Selected items using 12% tint of `--color-accent-primary`.
- `.hhg-btn-primary`: Primary actions with high-contrast inverse label.
- `.hhg-btn-secondary`: AI tools and secondary actions using 12% tint of `--color-accent-secondary`.
- `.hhg-badge-success` / `.hhg-badge-warning` / `.hhg-badge-error` / `.hhg-badge-info`: Status badges.
- `.hhg-input`: Standardized monospace inputs with theme-aware focus ring.
- `.hhg-code-block`: Terminal, JSON, and trace viewer containers.

## 4. Automated Pre-Build Audit Gate

The pre-build pipeline automatically verifies:
1. `tsc --noEmit` (0 errors).
2. `Theme Token & Boundary Audit`:
   - Rejects raw dark containers (`bg-slate-950/70`) without light mode support.
   - Verifies the presence of all 10 locked accent tokens in `src/index.css`.
3. Production Vite bundler verification.
