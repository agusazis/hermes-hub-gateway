# Hermes Hub Companion Daemon (Server Component)

Hermes Hub Companion Daemon adalah *server-side engine* pendamping untuk **Hermes Hub Gateway (HHG)**. Daemon ini dipasang di server Linux yang menjalankan instance Hermes Agent.

## Fungsi Utama
1. **Continuous Evolution Handshake:** Menerima payload transkrip koding dari HHG Desktop (port `:9125`).
2. **Autonomous Learning Extractor:** Mengevaluasi solusi kode dan secara otomatis men-commit aturan baru ke GitLab Skills repository.
3. **Real-time Memory Interceptor Bridge:** Menerima mutasi memori langsung dari IDE via MCP dan memancarkannya ke broadcast Telegram dan Evolution Feed.
4. **Evolution Logs Feed API:** Menyajikan endpoint `/api/v1/evolution-events` untuk kartu log replika Telegram di desktop HHG.

## Cara Pemasangan di Server Hermes Baru (One-Liner)

Jalankan perintah ini di mesin Linux tempat Hermes Agent terpasang:

```bash
curl -fsSL https://raw.githubusercontent.com/agusazis/hermes-hub-gateway/main/server/install.sh | bash
```

Atau jika telah meng-clone repository ini secara lokal:
```bash
chmod +x server/install.sh
./server/install.sh
```

## Memeriksa Status Layanan
```bash
systemctl --user status hermes-antigravity-review.service
journalctl --user -u hermes-antigravity-review.service -f
```
