# Hermes Hub Gateway (HHG) - Architectural Blueprint & Quality Contracts

> **Status:** RATIFIED & MANDATORY
> **Target Runtime:** Tauri v2 (Rust Backend + React 18 / Tailwind CSS Frontend)
> **Distribution:** Windows x64 (NSIS `.exe` & WiX `.msi`)

---

## 1. Zero-State (Clean Slate) Resilience Contract
Semua layer aplikasi (Frontend UI, Backend Rust, Daemon Watcher, dan Bridge) **WAJIB** mampu berjalan tanpa error dalam kondisi *zero-state* (tanpa data awal).

* **Backend Rust Rules:**
  * DILARANG KERAS mengakses indeks array secara langsung (`cfg.workspaces[0]`).
  * Gunakan pattern matching aman: `if let Some(ws) = cfg.workspaces.first()` atau `match cfg.workspaces.iter().find(...)`.
  * Background watcher WAJIB melewati siklus (`continue`) jika `workspaces.is_empty()`.
* **Frontend React Rules:**
  * Komponen metrik WAJIB memvalidasi keberadaan data (`config.mcp_servers.length === 0` -> 0 Fungsi).
  * State mock discovery bawaan DILARANG memuat data fiktif institusi tertentu.

---

## 2. Security & Operational Boundaries
Aplikasi ini beroperasi di lingkungan komputer pengguna/developer. Aspek keamanan operasional mengikat secara mutlak.

* **No Public Dangerous Actions:**
  * DILARANG meletakkan tombol destruktif global (seperti *Factory Reset*) di antarmuka publik tanpa autentikasi/izin administratif bertingkat.
  * Pembersihan instalasi dan data residual hanya diizinkan melalui jalur resmi OS (Uninstaller Hook dengan konfirmasi UAC).
* **Credential Isolation:**
  * Kredensial sensitif organisasi tidak boleh disimpan mentah di kode sumber publik.
  * Otentikasi konfigurasi organisasi WAJIB menggunakan verifikasi satu arah (*Cryptographic SHA-256 Hash*).
  * File kredensial lokal disimpan di home user dengan izin berkas ketat `chmod 600`.

---

## 3. Global Design System & Theme Boundary Contract
Antarmuka HHG harus modular secara arsitektur dan konsisten di seluruh tema (Dark & Light Mode).

* **Semantic Tokens First:**
  * Seluruh kontainer, kartu, teks, dan input WAJIB merujuk ke token semantik CSS (`--color-app-*`) atau utility class `@layer components` (`.hhg-card-surface`, `.hhg-card-item`).
  * DILARANG KERAS melakukan tambal sulam lokal (*spot patching*) dengan meng-hardcode kelas gelap statis (`bg-slate-950/70`, `border-slate-800`) tanpa varian adaptif tema terang.
* **Pre-Build Audit Verification:**
  * Setiap perubahan UI wajib lolos **Gate 2 Theme Boundary Audit** di `scripts/verify-all.mjs`.

---

## 4. Multi-Target Distribution Contract
Mengikuti standar industri software desktop modern:

* **NSIS Setup (`.exe`):**
  * Target distribusi utama untuk developer personal.
  * Dilengkapi hook pembersihan data residu bersyarat saat uninstall.
* **WiX Package (`.msi`):**
  * Target distribusi enterprise untuk deployment massal via Active Directory / GPO.
