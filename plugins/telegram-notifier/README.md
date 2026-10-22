# Telegram Notifier Plugin & Standalone Guide for Hermes Hub Gateway (HHG)

Panduan ini ditujukan bagi pengguna mandiri atau pengembang di luar RSUD dr. H. Jusuf SK yang ingin mengintegrasikan notifikasi audit, evolusi memori, dan event coding AI Agent ke bot/grup Telegram pribadi.

---

## 1. Arsitektur Pemisahan Tanggung Jawab

Di ekosistem Hermes Hub Gateway (HHG):
1. **Desktop Client (HHG):** Berjalan di laptop programmer, bertugas murni sebagai orkestrator workspace lokal, MCP bridge, dan viewer aktivitas agent.
2. **Backend Server (Hermes Evaluator):** Berjalan di server/VM terpusat (Linux), bertugas memantau event memori Mnemosyne, evolusi SOP, dan mengeksekusi webhook notifikasi Telegram secara asynchronous.

> **Catatan untuk Programmer RSUD:**  
> Untuk programmer internal RSUD dr. H. Jusuf SK, seluruh notifikasi grup Telegram ditangani terpusat oleh server Hermes internal. Programmer cukup memantau status aktivitas lewat UI HHG. Jika ingin bergabung ke grup notifikasi RSUD, hubungi System Administrator.

---

## 2. Menyiapkan Bot Telegram Mandiri

Bagi pengguna di luar RSUD, ikuti langkah berikut untuk membuat endpoint notifikasi Telegram sendiri:

### Langkah A: Buat Bot via BotFather
1. Buka aplikasi Telegram dan cari **@BotFather**.
2. Kirim perintah `/newbot`, lalu ikuti instruksi untuk memberi nama dan username bot Anda.
3. Simpan **HTTP API Bot Token** yang diberikan (contoh: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).

### Langkah B: Dapatkan Chat ID (Grup atau DM Pribadi)
1. **Untuk DM Pribadi:** Buka bot Anda di Telegram dan klik **/start**. Lalu kirim pesan apa saja ke bot Anda. Buka URL:
   ```
   https://api.telegram.org/bot<TOKEN_ANDA>/getUpdates
   ```
   Cari nilai `"id"` di dalam objek `"chat"`.
2. **Untuk Grup:** Masukkan bot Anda ke dalam grup Telegram yang diinginkan (dan jadikan admin jika menggunakan supergroup/forum). Kirim pesan apa saja di grup tersebut, lalu buka URL `getUpdates` di atas untuk melihat ID grup (biasanya diawali tanda minus `-`, misalnya `-1001234567890`).

---

## 3. Konfigurasi di Backend Hermes (Hermes Evaluator Server)

Di sisi server backend Linux Anda tempat Hermes / Mnemosyne berjalan:

1. Buat atau sesuaikan file konfigurasi lingkungan (misal: `/opt/hermes-evaluator/.env` atau `~/.hermes/.env`):
   ```env
   # TELEGRAM BROADCAST PLUGIN CONFIG
   TELEGRAM_ENABLED=true
   TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
   TELEGRAM_CHAT_ID="-1001234567890"
   TELEGRAM_TOPIC_ID="" # Opsional, isi jika menggunakan Telegram Forum Topics
   ```

2. Jalankan atau restart service evaluator Anda:
   ```bash
   systemctl restart hermes-evaluator.service
   ```

---

## 4. Format Notifikasi yang Dikirimkan

Ketika agent Anda di IDE mengeksekusi memori atau task, backend Hermes akan otomatis memformat dan mengirimkan ringkasan 3-part report ke Telegram:

```
🚀 [HERMES EVOLUTION EVENT]
------------------------------------
• Workspace : SIMGOS2 Production
• Event     : Rule Updated / Memory Consolidated
• Scope     : ExtJS / PHP 8.2 Security
• Summary   : Refactored database query to use Tabularis MCP.
------------------------------------
Waktu: 22/10/2026 23:45 WITA
```

Dengan pola plugin ini, aplikasi desktop HHG tetap ringan tanpa beban daemon Telegram eksternal, dan pengguna mandiri dapat dengan leluasa mengarahkan broadcast ke kanal Telegram masing-masing.
