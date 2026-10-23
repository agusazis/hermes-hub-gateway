# Hermes Hub Gateway (HHG)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-cyan.svg)](https://v2.tauri.app/)
[![React 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Platform: Multi-OS](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-emerald.svg)]()

**Hermes Hub Gateway (HHG)** adalah aplikasi desktop *cross-platform* (Linux & Windows) dan *cognitive control plane* mandiri yang dirancang untuk menjembatani AI Coding IDE (seperti Antigravity, Cursor, Zed Editor, VS Code) dengan ekosistem Model Context Protocol (MCP), cognitive memory, dan remote server engineering tanpa konfigurasi rumit.

Dibangun dengan arsitektur **Tauri v2 (Rust Backend)** dan **React 18 / Tailwind CSS (Frontend)**, HHG memisahkan sepenuhnya antara ranah kontrol hak akses lokal pengembang dengan aktivitas eksekusi AI Agent.

---

## 🌟 Arsitektur Utama & Fitur Unggulan

### 1. Discrete Multi-Host MCP Runner (`run_mcp.js`)
Alih-alih menambahkan puluhan server baru di file konfigurasi IDE setiap kali ada server/database baru, HHG menerapkan arsitektur **1 Discrete Server untuk Multi-Host Target** (pola *Tabularis*):
* **Format IDE Bersih & Ringkas:** File konfigurasi IDE (`mcp_config.json` / `settings.json`) hanya membutuhkan satu baris server non-upstream (`remote-ssh`, `hermes-gateway`, `mnemosyne`).
* **Multi-Target Dispatching:** Memetakan panggilan tool IDE ke host target melalui parameter `target` (contoh: `target: "simgos-prod"` atau `target: "172.168.1.6"`).
* **Dual IDE Copas Support:** Menyediakan tombol salin konfigurasi satu klik untuk format **Antigravity / Cursor** (`mcpServers`) dan **Zed Editor** (`context_servers`).

### 2. Isolated Remote SSH Gateway & Vault Kunci Ed25519
Menghilangkan risiko keamanan ketika AI Agent membutuhkan akses remote ke VM/server Linux:
* **Isolated Key Storage:** Pasangan kunci Ed25519 digenerate dan disimpan di vault privat terisolasi HHG (`~/.hermes-hub/vault/ssh_keys/`), **bukan** di direktori default `~/.ssh/`. Hal ini mencegah AI Agent di IDE mem-bypass HHG dengan langsung mengeksekusi SSH melalui terminal lokal OS.
* **Zero-Password Persistence:** Password user/root remote hanya digunakan satu kali saat proses handshake public key awal, lalu langsung dibersihkan dari memori dan **tidak pernah disimpan di disk atau config**.
* **Dynamic Permission Gate:** UI HHG menyediakan saklar izin **`🔒 READ-ONLY`** (Safe Mode: perintah berbahaya seperti `sudo`, `rm -rf`, `reboot` otomatis dicegat di gateway) vs **`⚡ FULL`** (Sudo & Write Mode untuk kebutuhan maintenance).
* **Environment Tiering:** Setiap host diberi label metadata tier (`Production` vs `Development`) yang dapat diinspeksi oleh AI Agent via tool `ssh_list_hosts`.

### 3. Filesystem Junction & Cognitive Workspace Linking
* Menghubungkan direktori `.agents` proyek kerja ke repositori arsitektur kognitif melalui *OS-native junction* (`mklink /J` di Windows, symlink di Linux) tanpa duplikasi fisik berkas.
* Menjaga file aturan `AGENTS.md` tetap bersifat **agnostik, profesional, dan universal**, tanpa membocorkan kredensial pribadi atau nama profile pengguna ke repositori tim.

### 4. Background Silent Update dengan Seamless Auto-Relaunch
* Pembaruan aplikasi berjalan senyap di background tanpa mengunci file binary (*file lock*).
* Dilengkapi *wrapper launcher* otomatis yang langsung membuka kembali aplikasi HHG setelah proses instalasi paket rilis selesai.

---

## 🚀 Panduan Membangun dari Sumber (Build from Source)

### Kebutuhan Sistem:
* Node.js 18+ & Rust stable toolchain (`cargo`).
* **Linux:** `libwebkit2gtk-4.1-dev`, `build-essential`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`.
* **Windows:** C++ Build Tools & WebView2 runtime.

### Langkah Instalasi:
```bash
# 1. Clone repository
git clone https://github.com/agusazis/hermes-hub-gateway.git
cd hermes-hub-gateway

# 2. Install dependensi
npm install

# 3. Jalankan verification gates
npm run verify

# 4. Jalankan aplikasi dalam mode dev
npm run tauri dev
```

### Build Binary Rilis Produksi:
```bash
npm run tauri build
```
Paket rilis akan otomatis terbentuk di direktori `src-tauri/target/release/bundle/` (`.exe` / `.msi` untuk Windows, `.AppImage` / `.deb` / `.rpm` untuk Linux).

---

## 🔒 Privasi Kredensial & Batasan Keamanan

* **Pencegahan Kebocoran Kredensial Tim:** Token akses Git (PAT), password database, dan kunci SSH tersimpan eksklusif di mesin lokal masing-masing pengembang.
* **Non-Invasive Architecture:** HHG tidak pernah memodifikasi binary atau runtime internal aplikasi IDE pihak ketiga.
* **Zero Host Discovery Leakage:** Konfigurasi SSH remote tidak diekspos ke jaringan publik; seluruh komunikasi berjalan lewat IPC lokal mesin pengguna.

---

## ⚖️ Legal Disclaimer & Trademarks

* **Hermes Hub Gateway (HHG)** adalah perangkat lunak *independent open-source utility* yang dikembangkan secara independen oleh kontributor komunitas dan **tidak berafiliasi secara resmi, tidak didukung secara langsung, maupun disponsori oleh Nous Research**.
* Nama "Hermes" atau referensi teknologi terkait digunakan semata-mata sebagai referensi kompatibilitas interoperabilitas ekosistem agen AI.
* Seluruh merek dagang, nama layanan, dan logo yang disebutkan dalam proyek ini adalah hak milik dari masing-masing pemilik resminya.

---

## 📄 Lisensi (License)

Proyek ini didistribusikan di bawah ketentuan lisensi **[Apache License 2.0](LICENSE)**.
Ketentuan ini memberikan kebebasan penggunaan perangkat lunak dengan perlindungan hukum eksplisit terhadap tuntutan paten dan pembatasan penggunaan merek dagang.
