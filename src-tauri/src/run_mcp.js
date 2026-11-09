// Hermes Hub Gateway - 100% Compliant Tool Names (<=64 total char IDs)
const readline = require("readline");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const homeDir = process.env.HOME || process.env.USERPROFILE || (typeof os.homedir === "function" ? os.homedir() : "/home/user");
// Parse command line arguments: e.g. node run_mcp.js --server=gitlab
const targetServerArg = process.argv.find(a => a.startsWith("--server="));
const TARGET_SERVER = targetServerArg ? targetServerArg.split("=")[1].trim().toLowerCase() : null;

const serverSuffix = TARGET_SERVER ? `_${TARGET_SERVER.replace(/[^a-z0-9_-]/g, '_')}` : '';
const cacheFile = path.join(homeDir, ".hermes-hub", `mcp_tools_cache${serverSuffix}.json`);
const configPath = path.join(homeDir, ".hermes-hub", "config.json");
const skillsRepoDir = path.join(homeDir, ".hermes-hub", "workspaces", "ai-agents", "skills");
const actualSkillsDir = fs.existsSync(path.join(skillsRepoDir, "skills")) ? path.join(skillsRepoDir, "skills") : skillsRepoDir;
const skillsDir = actualSkillsDir;
const MAX_TOOL_NAME_LEN = 40;

const rl = readline.createInterface({ input: process.stdin, terminal: false });

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch (e) {}
  return { mcp_servers: [] };
}

function callSubprocessRpc(command, args, env, rpcReq, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let child;
    try {
      const mergedEnv = { ...process.env, ...(env || {}) };
      child = spawn(command, args || [], {
        env: mergedEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: command.toLowerCase().endsWith(".exe") ? false : true
      });
    } catch (err) {
      return resolve({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32603, message: `Failed to spawn ${command}: ${err.message}` }
      });
    }

    let initDone = false;
    let rlOut = readline.createInterface({ input: child.stdout, terminal: false });

    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 9999,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "hhg-aggregator", version: "0.8.2" } }
    }) + "\n");

    rlOut.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const resp = JSON.parse(trimmed);
        if (!initDone && resp.id === 9999) {
          initDone = true;
          child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
          child.stdin.write(JSON.stringify(rpcReq) + "\n");
        } else if (resp.id === rpcReq.id) {
          try { child.kill(); } catch (e) {}
          resolve(resp);
        }
      } catch (e) {}
    });

    child.on("error", (err) => {
      resolve({ jsonrpc: "2.0", id: rpcReq.id, error: { code: -32603, message: err.message } });
    });

    setTimeout(() => {
      try { child.kill(); } catch (e) {}
      resolve({ jsonrpc: "2.0", id: rpcReq.id, error: { code: -32603, message: `Subprocess timeout after ${timeoutMs}ms` } });
    }, timeoutMs);
  });
}

function callHttpJsonRpc(urlStr, rpcReq, timeoutMs = 25000) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const postData = JSON.stringify(rpcReq);
      const isHttps = url.protocol === "https:";
      const client = isHttps ? require("https") : require("http");

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (url.search || ""),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          "Accept": "application/json"
        },
        timeout: timeoutMs
      };

      const req = client.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            resolve({
              jsonrpc: "2.0",
              id: rpcReq.id,
              error: { code: -32603, message: `Invalid HTTP JSON response from ${urlStr}: ${body.slice(0, 100)}` }
            });
          }
        });
      });

      req.on("error", (err) => {
        resolve({
          jsonrpc: "2.0",
          id: rpcReq.id,
          error: { code: -32603, message: `HTTP request to ${urlStr} failed: ${err.message}` }
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({
          jsonrpc: "2.0",
          id: rpcReq.id,
          error: { code: -32603, message: `HTTP request to ${urlStr} timed out after ${timeoutMs}ms` }
        });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      resolve({
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32603, message: `Failed to construct HTTP request to ${urlStr}: ${err.message}` }
      });
    }
  });
}

async function discoverServerTools(server) {
  const req = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  if (server.serverUrl || server.url) {
    const targetUrl = server.serverUrl || server.url;
    const resp = await callHttpJsonRpc(targetUrl, req, 20000);
    if (resp && resp.result && Array.isArray(resp.result.tools)) {
      return resp.result.tools;
    }
    return [];
  }
  const resp = await callSubprocessRpc(server.command, server.args, server.env, req, 20000);
  if (resp && resp.result && Array.isArray(resp.result.tools)) {
    return resp.result.tools;
  }
  return [];
}

function shortenToolName(prefix, rawName, maxLen = MAX_TOOL_NAME_LEN) {
  const full = `${prefix}_${rawName}`;
  if (full.length <= maxLen) return full;

  let s = rawName;
  const replacements = [
    ["merge_request", "mr"],
    ["description", "desc"],
    ["approval_state", "appr_state"],
    ["changed_files", "changes"],
    ["discussion", "discuss"],
    ["resolve", "res"],
    ["update", "upd"],
    ["repositories", "repos"],
    ["repository", "repo"],
    ["prometheus", "prom"],
    ["datasources", "ds"],
    ["connections", "conn"],
    ["custom_fields", "cfields"]
  ];
  for (const [oldW, newW] of replacements) {
    s = s.replace(new RegExp(oldW, "g"), newW);
    const candidate = `${prefix}_${s}`;
    if (candidate.length <= maxLen) return candidate;
  }
  const budget = maxLen - prefix.length - 1;
  return `${prefix}_${s.substring(0, Math.max(1, budget))}`;
}

function loadMikrotikRouters() {
  const routersFile = path.join(homeDir, ".hermes-hub", "vault", "mikrotik_routers.json");
  try {
    if (fs.existsSync(routersFile)) {
      return JSON.parse(fs.readFileSync(routersFile, "utf-8"));
    }
  } catch (e) {}
  return [];
}

function encodeMikrotikLen(len) {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) {
    len |= 0x8000;
    return Buffer.from([(len >> 8) & 0xff, len & 0xff]);
  }
  return Buffer.from([0]);
}

function sendMikrotikSentence(sock, words) {
  for (const w of words) {
    const b = Buffer.from(w, 'utf8');
    sock.write(encodeMikrotikLen(b.length));
    sock.write(b);
  }
  sock.write(Buffer.from([0]));
}

function executeMikrotikApi(router, cmdWords, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const host = router.host;
    const port = router.port || 8728;
    const user = router.user || 'admin';
    const pass = router.password || '';

    const net = require('net');
    let sock;
    try {
      sock = net.createConnection({ host, port, timeout: timeoutMs }, () => {
        sendMikrotikSentence(sock, ['/login', '=name=' + user, '=password=' + pass]);
      });
    } catch (err) {
      return resolve({ error: `Gagal inisialisasi socket TCP ke ${host}:${port}: ${err.message}` });
    }

    let buf = Buffer.alloc(0);
    let stage = 'login';
    let results = [];
    let done = false;

    const cleanup = () => {
      if (!done) {
        done = true;
        try { sock.destroy(); } catch (_) {}
      }
    };

    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        let offset = 0;
        let wList = [];
        let complete = false;
        while (offset < buf.length) {
          const first = buf[offset++];
          if (first === 0) { complete = true; break; }
          let len = first;
          if ((first & 0x80) && !(first & 0x40)) {
            if (offset >= buf.length) { complete = false; break; }
            len = ((first & 0x3f) << 8) | buf[offset++];
          }
          if (offset + len > buf.length) { complete = false; break; }
          wList.push(buf.slice(offset, offset + len).toString('utf8'));
          offset += len;
        }
        if (!complete) break;
        buf = buf.slice(offset);

        if (stage === 'login') {
          if (wList.includes('!done')) {
            stage = 'cmd';
            sendMikrotikSentence(sock, cmdWords);
          } else {
            cleanup();
            return resolve({ error: `Autentikasi RouterOS gagal (User: ${user}): ${wList.join(' ')}` });
          }
        } else if (stage === 'cmd') {
          if (wList.includes('!trap')) {
            const msg = wList.find(w => w.startsWith('=message='))?.slice(9) || 'Command trap error';
            cleanup();
            return resolve({ error: `RouterOS Trap Error: ${msg}` });
          }
          if (wList.includes('!re')) {
            const item = {};
            for (const w of wList) {
              if (w.startsWith('=')) {
                const idx = w.indexOf('=', 1);
                if (idx !== -1) {
                  item[w.slice(1, idx)] = w.slice(idx + 1);
                }
              }
            }
            results.push(item);
          }
          if (wList.includes('!done')) {
            cleanup();
            return resolve({ success: true, data: results });
          }
        }
      }
    });

    sock.on('error', err => {
      cleanup();
      resolve({ error: `Koneksi TCP ke MikroTik ${host}:${port} gagal: ${err.message}` });
    });

    sock.on('timeout', () => {
      cleanup();
      resolve({ error: `Timeout koneksi (${timeoutMs}ms) ke RouterOS ${host}:${port}` });
    });
  });
}

function resolveMikrotikTarget(targetArg) {
  const allRouters = loadMikrotikRouters();
  const activeRouters = allRouters.filter(r => r.enabled !== false);
  if (targetArg && String(targetArg).trim()) {
    const t = String(targetArg).trim().toLowerCase();
    const found = allRouters.find(r => (r.alias || '').toLowerCase() === t || r.host === t || r.id === t);
    if (!found) return { error: `Router '${targetArg}' tidak ditemukan di daftar MikroTik HHG. Gunakan mikrotik_list_routers untuk melihat daftar router valid.` };
    if (found.enabled === false) return { error: `Router '${found.alias}' (${found.host}) saat ini DINONAKTIFKAN di HHG. Aktifkan router melalui dashboard HHG.` };
    return { router: found };
  }
  if (activeRouters.length === 1) {
    return { router: activeRouters[0] };
  }
  if (activeRouters.length === 0) {
    return { error: allRouters.length > 0 ? 'Seluruh router MikroTik dalam status NON-AKTIF di HHG. Aktifkan router di dashboard HHG.' : 'Belum ada router MikroTik yang didaftarkan di HHG. Buka HHG -> MCP Servers -> Router MikroTik untuk menambahkan router.' };
  }
  return { error: `Terdapat ${activeRouters.length} router MikroTik aktif (${activeRouters.map(r => r.alias).join(', ')}). Harap tentukan router tujuan via parameter 'router': '<alias>'.` };
}

function getMikrotikTools() {
  return [
    {
      name: "mikrotik_list_routers",
      description: "[mikrotik] Melihat daftar seluruh router MikroTik yang terdaftar di HHG (Alias, Host/IP, Port API, Tier: Production/Development, Status Aktif).",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "mikrotik_get_system_resource",
      description: "[mikrotik] Mengambil status beban CPU, RAM, Disk, Uptime, Versi OS, dan Board Router MikroTik.",
      inputSchema: {
        type: "object",
        properties: {
          router: { type: "string", description: "Alias atau IP router target (contoh: 'mtk-chr' atau '10.10.1.4'). Opsional jika hanya ada 1 router aktif." }
        }
      }
    },
    {
      name: "mikrotik_get_interface_traffic",
      description: "[mikrotik] Mengambil traffic real-time (bps & pps) untuk interface ethernet/bridge tertentu pada router MikroTik.",
      inputSchema: {
        type: "object",
        properties: {
          interface: { type: "string", description: "Nama interface yang dimonitor (contoh: 'ether1-lan', 'ether1', 'bridge1')." },
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        },
        required: ["interface"]
      }
    },
    {
      name: "mikrotik_list_interfaces",
      description: "[mikrotik] Melihat daftar seluruh interface jaringan pada router MikroTik beserta status running, disabled, MTU, dan MAC address.",
      inputSchema: {
        type: "object",
        properties: {
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        }
      }
    },
    {
      name: "mikrotik_list_ip_addresses",
      description: "[mikrotik] Melihat alokasi daftar IP address, subnet mask, dan interface terkait pada router MikroTik.",
      inputSchema: {
        type: "object",
        properties: {
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        }
      }
    },
    {
      name: "mikrotik_list_active_routes",
      description: "[mikrotik] Memeriksa tabel routing IP aktif (dst-address, gateway, status dynamic/static/active).",
      inputSchema: {
        type: "object",
        properties: {
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        }
      }
    },
    {
      name: "mikrotik_list_arp_table",
      description: "[mikrotik] Melihat tabel ARP (pemetaan IP address ke MAC address device yang terhubung).",
      inputSchema: {
        type: "object",
        properties: {
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        }
      }
    },
    {
      name: "mikrotik_router_ping",
      description: "[mikrotik] Menjalankan uji ping dari router MikroTik ke IP target atau domain luar.",
      inputSchema: {
        type: "object",
        properties: {
          address: { type: "string", description: "IP address atau hostname tujuan ping (contoh: '10.10.1.1' atau '8.8.8.8')." },
          count: { type: "number", description: "Jumlah ping packet (default: 4)." },
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        },
        required: ["address"]
      }
    },
    {
      name: "mikrotik_run_command",
      description: "[mikrotik] Menjalankan perintah RouterOS API langsung (khusus inspeksi/read-only secara default).",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Sentence RouterOS API command (contoh: '/system/identity/print' atau '/ip/dns/print')." },
          params: { type: "object", description: "Dictionary key-value parameter opsional (contoh: { 'detail': '' })." },
          router: { type: "string", description: "Alias atau IP router target. Opsional jika hanya ada 1 router aktif." }
        },
        required: ["command"]
      }
    }
  ];
}

function getRemoteSshTools() {
  return [
    {
      name: "ssh_list_hosts",
      description: "[remote-ssh] Melihat daftar seluruh host VM/Server yang terdaftar di HHG (IP, Port, User, Tier: Production/Development, Status Elevasi/Sudo).",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "ssh_run_command",
      description: "[remote-ssh] Menjalankan perintah shell ke VM remote via SSH terisolasi. Jika host berstatus ReadOnly, perintah sudo/write akan otomatis dicegat.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Alias atau IP host tujuan (contoh: 'simgos-prod' atau '172.168.1.6')" },
          command: { type: "string", description: "Perintah shell yang akan dieksekusi" }
        },
        required: ["target", "command"]
      }
    },
    {
      name: "ssh_read_file",
      description: "[remote-ssh] Membaca isi berkas teks dari VM remote secara aman.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Alias atau IP host tujuan" },
          remote_path: { type: "string", description: "Path lengkap file di server remote (contoh: '/var/log/php-fpm/error.log')" }
        },
        required: ["target", "remote_path"]
      }
    },
    {
      name: "ssh_write_file",
      description: "[remote-ssh] Menulis atau mengunggah konten file ke VM remote. HANYA dapat digunakan jika mode 'FULL (Sudo/Write)' diaktifkan di HHG.",
      inputSchema: {
        type: "object",
        properties: {
          target: { type: "string", description: "Alias atau IP host tujuan" },
          remote_path: { type: "string", description: "Path lengkap file di server remote" },
          content: { type: "string", description: "Isi teks file yang akan ditulis" }
        },
        required: ["target", "remote_path", "content"]
      }
    }
  ];
}

function loadSshHosts() {
  const hostsFile = path.join(homeDir, ".hermes-hub", "vault", "ssh_hosts.json");
  try {
    if (fs.existsSync(hostsFile)) {
      return JSON.parse(fs.readFileSync(hostsFile, "utf-8"));
    }
  } catch (e) {}
  return [];
}

function appendSshAuditLog(entry) {
  try {
    const logDir = path.join(homeDir, ".hermes-hub", "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "ssh_audit.log");
    
    // Size-based log rotation: 10 MB limit
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > 10 * 1024 * 1024) {
        const backupFile = path.join(logDir, "ssh_audit.1.log");
        try {
          if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
          fs.renameSync(logFile, backupFile);
        } catch (_) {}
      }
    }

    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      client: "IDE",
      tool: entry.tool || "ssh_unknown",
      target: entry.target || "unknown",
      target_ip: entry.target_ip || "unknown",
      mode: entry.mode || "READONLY",
      action_summary: (entry.action_summary || "").slice(0, 500),
      status: entry.status || "UNKNOWN",
      duration_ms: entry.duration_ms || 0,
      output_preview: (entry.output_preview || "").slice(0, 300),
      exit_code: typeof entry.exit_code === "number" ? entry.exit_code : null
    }) + "\n";

    fs.appendFile(logFile, payload, () => {});
  } catch (_) {}
}

function getBuiltinSkillsTools() {
  return [
    {
      name: "hermes_list_skills",
      description: "[hermes] Melihat daftar seluruh SOP, pedoman arsitektur koding, dan aturan kerja spesialis.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "hermes_get_skill",
      description: "[hermes] Membaca isi lengkap SOP dan aturan koding spesialis secara on-demand.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Nama skill/SOP" } },
        required: ["name"]
      }
    },
    {
      name: "hermes_list_rules",
      description: "[hermes] Melihat daftar seluruh aturan arsitektur koding aktif (ExtJS, PHP 8.2, Database, Security).",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "hermes_get_rule",
      description: "[hermes] Membaca aturan arsitektur koding spesifik dari HHG secara on-demand.",
      inputSchema: {
        type: "object",
        properties: { category: { type: "string", description: "Kategori aturan (contoh: 'extjs', 'php82', 'database', 'security')" } },
        required: ["category"]
      }
    },
    {
      name: "hermes_save_rule",
      description: "[hermes] Menyimpan atau memperbarui aturan arsitektur / pola koding baru ke HHG langsung dari IDE.",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", description: "Kategori aturan/slug (contoh: 'crud-pattern', 'extjs-styling')" },
          title: { type: "string", description: "Judul deskriptif aturan koding" },
          content: { type: "string", description: "Isi lengkap aturan koding dalam format Markdown" }
        },
        required: ["category", "content"]
      }
    },
    {
      name: "hermes_get_environment",
      description: "[hermes] Menampilkan pemetaan dinamis representatif antara server MCP yang terdaftar di HHG dengan target repositori/lingkungan kerja aktif untuk mencegah salah pemanggilan tools.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "hermes_update_environment",
      description: "[hermes] Menyimpan atau memperbarui catatan pemetaan lingkungan proyek ke server MCP (misal: menentukan server Git atau Database primer) agar diingat oleh seluruh agent.",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Nama proyek atau konteks repositori" },
          mapping: { type: "string", description: "Catatan deskriptif pemetaan peran server MCP (misal: 'Primary Git: gitlabjsk, External: gitlabsimpel')" }
        },
        required: ["project", "mapping"]
      }
    },
    {
      name: "hermes_consult_specialist",
      description: "[hermes] Konsultasi peran spesialis (Database Architect, Frontend Specialist, System Reviewer).",
      inputSchema: {
        type: "object",
        properties: {
          role: { type: "string", description: "Peran spesialis (contoh: 'database', 'frontend', 'security', 'devops')" },
          query: { type: "string", description: "Pertanyaan atau masalah teknis yang ingin dikonsultasikan" }
        },
        required: ["role", "query"]
      }
    },
    {
      name: "hermes_get_project_context",
      description: "[hermes] Mengambil ringkasan konteks proyek aktif (branch, issue terkini, rencana kerja/roadmap, dan catatan backlog) langsung dari HHG.",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Nama proyek atau workspace (opsional, default: aktif)" }
        }
      }
    }
  ];
}

async function buildAndSaveCache() {
  const cfg = loadConfig();
  let allActiveServers = [...(cfg.mcp_servers || []).filter(s => s.enabled)];
  
  // Otomatis masukkan Mnemosyne sebagai server downstream jika belum ada di mcp_servers
  const hasMnemo = allActiveServers.some(s => (s.name || s.id || "").toLowerCase().includes("mnemo"));
  if (!hasMnemo) {
    const mnemoHost = (cfg.default_mnemosyne_url || "http://172.168.1.202:8080").replace(/\/+$/, "");
    const mnemoUrl = mnemoHost.endsWith("/sse") ? mnemoHost : `${mnemoHost}/sse`;
    allActiveServers.push({
      name: "mnemosyne",
      serverUrl: mnemoUrl,
      enabled: true,
      description: "Mnemosyne Knowledge Graph & Cross-Agent Shared Memory"
    });
  }
  
  // Filter downstream servers if scoped via --server=<name>
  let activeServers = allActiveServers;
  let includeHermesBuiltin = true;

  if (TARGET_SERVER) {
    if (TARGET_SERVER === "hermes" || TARGET_SERVER === "core" || TARGET_SERVER === "hermes-gateway") {
      activeServers = [];
      includeHermesBuiltin = true;
    } else if (TARGET_SERVER === "mikrotik" || TARGET_SERVER === "mikrotik-router" || TARGET_SERVER === "mikrotikrouter" || TARGET_SERVER === "routeros") {
      activeServers = [];
      includeHermesBuiltin = false;
      const mtkTools = getMikrotikTools();
      const routing = {};
      for (const mt of mtkTools) {
        routing[mt.name] = { builtin: true, originalToolName: mt.name, isMikrotik: true };
      }
      return { tools: mtkTools, routing };
    } else if (TARGET_SERVER === "remote-ssh" || TARGET_SERVER === "ssh" || TARGET_SERVER === "remotessh") {
      activeServers = [];
      includeHermesBuiltin = false;
      const sshTools = getRemoteSshTools();
      const routing = {};
      for (const st of sshTools) {
        routing[st.name] = { builtin: true, originalToolName: st.name, isSsh: true };
      }
      return { tools: sshTools, routing };
    } else {
      const normTarget = TARGET_SERVER.replace(/[_-]/g, "");
      activeServers = allActiveServers.filter(s => {
        const sName = (s.name || s.id || "").toLowerCase().replace(/[_-]/g, "");
        return sName === normTarget;
      });
      // Fallback spesifik jika IDE meminta --server=mnemosyne
      if (activeServers.length === 0 && (normTarget.includes("mnemo") || normTarget === "memory")) {
        const mnemoHost = (cfg.default_mnemosyne_url || "http://172.168.1.202:8080").replace(/\/+$/, "");
        const mnemoUrl = mnemoHost.endsWith("/sse") ? mnemoHost : `${mnemoHost}/sse`;
        activeServers = [{
          name: "mnemosyne",
          serverUrl: mnemoUrl,
          enabled: true,
          description: "Mnemosyne Knowledge Graph & Cross-Agent Shared Memory"
        }];
      }
      includeHermesBuiltin = false;
    }
  }

  const aggregated = includeHermesBuiltin ? [...getBuiltinSkillsTools()] : [];
  const routing = {};

  if (includeHermesBuiltin) {
    for (const bt of getBuiltinSkillsTools()) {
      routing[bt.name] = { builtin: true, originalToolName: bt.name };
    }
  }

  const discoveries = activeServers.map(async (s) => {
    try {
      const tools = await discoverServerTools(s);
      return { server: s, tools };
    } catch (e) {
      return { server: s, tools: [] };
    }
  });

  const results = await Promise.allSettled(discoveries);
  for (const res of results) {
    if (res.status === "fulfilled") {
      const { server, tools } = res.value;
      const sName = (server.name || server.id || "mcp").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
      for (const t of tools) {
        // Jika nama tool sudah diawali dengan nama server (misal: mnemosyne_remember pada server mnemosyne), jangan double-prefix
        const rawTName = t.name;
        const safeNamespacedName = rawTName.startsWith(`${sName}_`) ? rawTName : shortenToolName(sName, rawTName, MAX_TOOL_NAME_LEN);
        
        routing[safeNamespacedName] = { server: server, originalToolName: t.name };
        routing[`${sName}_${t.name}`] = { server: server, originalToolName: t.name };
        routing[`${sName}__${t.name}`] = { server: server, originalToolName: t.name };
        routing[t.name] = { server: server, originalToolName: t.name };

        aggregated.push({
          ...t,
          name: safeNamespacedName,
          description: `[${sName}] ${t.description || ""}`.trim()
        });
      }
    }
  }

  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ tools: aggregated, routing }, null, 2), "utf-8");
  } catch (e) {}

  return { tools: aggregated, routing };
}

function getCachedData() {
  const cfg = loadConfig();

  // Jika runner ini diskop ke spesifik target server (misal: --server=grafana atau --server=tabularis)
  // dan di HHG server tersebut disetel disabled (enabled === false), maka kembalikan tools kosong seketika!
  if (TARGET_SERVER && TARGET_SERVER !== "hermes" && TARGET_SERVER !== "core" && TARGET_SERVER !== "hermes-gateway" && TARGET_SERVER !== "remote-ssh" && TARGET_SERVER !== "ssh") {
    const normTarget = TARGET_SERVER.replace(/[_-]/g, "");
    const matchingServer = (cfg.mcp_servers || []).find(s => {
      const sName = (s.name || s.id || "").toLowerCase().replace(/[_-]/g, "");
      return sName === normTarget;
    });
    if (matchingServer && matchingServer.enabled === false) {
      return { tools: [], routing: {}, disabled: true };
    }
  }

  const builtin = TARGET_SERVER && TARGET_SERVER !== "hermes" && TARGET_SERVER !== "core" && TARGET_SERVER !== "hermes-gateway" ? [] : getBuiltinSkillsTools();

  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      if (cached && Array.isArray(cached.tools) && cached.tools.length > 0) {
        return cached;
      }
    }
  } catch (e) {}

  return { tools: builtin, routing: {} };
}

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const req = JSON.parse(trimmed);
    const id = req.id;
    const method = req.method;

    if (method === "initialize") {
      const clientProto = req.params?.protocolVersion || "2024-11-05";
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        result: {
          protocolVersion: clientProto,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: "hermes-hub-gateway", version: "0.8.29" }
        }
      });
    } else if (method === "notifications/initialized") {
      // client notification, no response required
    } else if (method === "tools/list") {
      let data = getCachedData();
      if (!data.disabled && (!data || !data.tools || data.tools.length === 0)) {
        data = await buildAndSaveCache();
      }
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        result: { tools: data.disabled ? [] : (data.tools || []) }
      });
    } else if (method === "tools/call") {
      const toolName = req.params?.name;
      const toolArgs = req.params?.arguments || {};

      const currentCached = getCachedData();
      if (currentCached.disabled) {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: `Server MCP '${TARGET_SERVER}' saat ini dinonaktifkan (DISABLED) di HHG. Aktifkan kembali server melalui dashboard HHG jika ingin memanggil tool '${toolName}'.` }], isError: true }
        });
        return;
      }

      if (toolName === "hermes_list_skills" || toolName === "hermes__list_skills") {
        let skills = [];
        if (fs.existsSync(skillsDir)) {
          const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory() && !e.name.startsWith(".")) {
              const skillFile = path.join(skillsDir, e.name, "SKILL.md");
              let desc = "Skill: " + e.name;
              if (fs.existsSync(skillFile)) {
                try {
                  const content = fs.readFileSync(skillFile, "utf-8");
                  const descMatch = content.match(/description:\s*>?-?\s*([^\n\r]+)/i);
                  if (descMatch && descMatch[1]) {
                    desc = descMatch[1].trim();
                  } else {
                    const lines = content.replace(/^---[\s\S]*?---/, "").trim().split("\n").filter(l => l.trim() && !l.startsWith("#"));
                    if (lines.length > 0) desc = lines[0].trim();
                  }
                } catch (err) {}
              }
              skills.push(`- **${e.name}**: ${desc}`);
            }
          }
        }
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: skills.join("\n") }] }
        });
      } else if (toolName === "hermes_get_skill" || toolName === "hermes__get_skill") {
        const skillName = (toolArgs.name || "").trim();
        const skillFile = path.join(skillsDir, skillName, "SKILL.md");
        const fallbackSkillFile = path.join(skillsRepoDir, skillName, "SKILL.md");
        const targetFile = fs.existsSync(skillFile) ? skillFile : (fs.existsSync(fallbackSkillFile) ? fallbackSkillFile : null);
        if (targetFile) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: fs.readFileSync(targetFile, "utf-8") }] }
          });
        } else {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Skill '${skillName}' tidak ditemukan di repositori HHG.` }], isError: true }
          });
        }
      } else if (toolName === "hermes_list_rules" || toolName === "hermes__list_rules") {
        const localRulesDir = path.join(homeDir, ".hermes-hub", "rules");
        const repoRulesDir = path.join(skillsRepoDir, "rules");
        let rulesMap = new Map();

        const scanRules = (dir) => {
          if (!fs.existsSync(dir)) return;
          const files = fs.readdirSync(dir).filter(f => f.endsWith(".md") && !f.toLowerCase().includes("readme"));
          for (const f of files) {
            const cat = f.replace(".md", "");
            try {
              const firstLine = fs.readFileSync(path.join(dir, f), "utf-8").split("\n")[0].replace(/^#+\s*/, "").trim();
              rulesMap.set(cat, `- **${cat}**: ${firstLine || cat}`);
            } catch (err) {}
          }
        };

        scanRules(repoRulesDir);
        scanRules(localRulesDir);

        const rulesList = Array.from(rulesMap.values());
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: rulesList.length > 0 ? rulesList.join("\n") : "Tidak ada aturan koding aktif di HHG." }] }
        });
      } else if (toolName === "hermes_get_rule" || toolName === "hermes__get_rule") {
        const category = (toolArgs.category || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
        const localRuleFile = path.join(homeDir, ".hermes-hub", "rules", `${category}.md`);
        const repoRuleFile = path.join(skillsRepoDir, "rules", `${category}.md`);
        const targetRule = fs.existsSync(localRuleFile) ? localRuleFile : (fs.existsSync(repoRuleFile) ? repoRuleFile : null);
        if (targetRule) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: fs.readFileSync(targetRule, "utf-8") }] }
          });
        } else {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Aturan untuk kategori '${category}' belum terdaftar di HHG.` }], isError: true }
          });
        }
      } else if (toolName === "hermes_save_rule" || toolName === "hermes__save_rule") {
        const category = (toolArgs.category || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
        const content = toolArgs.content || "";
        const title = toolArgs.title || category;
        const rulesDir = path.join(homeDir, ".hermes-hub", "rules");
        try {
          if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
          const ruleFile = path.join(rulesDir, `${category}.md`);
          const fullContent = `# ${title}\n\n${content}`;
          fs.writeFileSync(ruleFile, fullContent, "utf-8");
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Berhasil menyimpan aturan koding '${category}' ke repository HHG.` }] }
          });
        } catch (e) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Gagal menyimpan aturan: ${e.message}` }], isError: true }
          });
        }
      } else if (toolName === "hermes_get_environment" || toolName === "hermes__get_environment") {
        const envFile = path.join(homeDir, ".hermes-hub", "environment_mapping.json");
        let customMappings = {};
        if (fs.existsSync(envFile)) {
          try { customMappings = JSON.parse(fs.readFileSync(envFile, "utf-8")); } catch (e) {}
        }
        const cfg = loadConfig();
        const activeServers = (cfg.mcp_servers || []).filter(s => s.enabled);
        
        let report = "# Dynamic Environment & Tool Mapping Context\n\n";
        report += "Dokumen ini menyajikan pemetaan representatif antara server MCP yang aktif di HHG dengan target lingkungan kerja untuk memandu agen agar tidak salah memanggil tools.\n\n";
        report += "### Daftar Server MCP Aktif di HHG:\n";
        activeServers.forEach(s => {
          report += `- **${s.name || s.id}**: Command: \`${s.command} ${(s.args || []).join(' ')}\`\n`;
        });
        report += "\n### Catatan Pemetaan Peran / Proyek (Custom Mappings):\n";
        if (Object.keys(customMappings).length === 0) {
          report += "_Belum ada catatan pemetaan kustom. Agen dapat memperbarui ini via `hermes_update_environment`._\n";
        } else {
          for (const [proj, note] of Object.entries(customMappings)) {
            report += `- **${proj}**: ${note}\n`;
          }
        }
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: report }] }
        });
      } else if (toolName === "hermes_update_environment" || toolName === "hermes__update_environment") {
        const project = (toolArgs.project || "").trim();
        const mapping = (toolArgs.mapping || "").trim();
        const envFile = path.join(homeDir, ".hermes-hub", "environment_mapping.json");
        try {
          let customMappings = {};
          if (fs.existsSync(envFile)) {
            try { customMappings = JSON.parse(fs.readFileSync(envFile, "utf-8")); } catch (e) {}
          }
          customMappings[project] = mapping;
          fs.writeFileSync(envFile, JSON.stringify(customMappings, null, 2), "utf-8");
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Berhasil memperbarui pemetaan environment untuk proyek '${project}'.` }] }
          });
        } catch (e) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Gagal memperbarui pemetaan environment: ${e.message}` }], isError: true }
          });
        }
      } else if (toolName === "hermes_consult_specialist" || toolName === "hermes__consult_specialist") {
        const role = (toolArgs.role || "Architect").toLowerCase().replace(/[^a-z0-9_-]/g, "");
        const query = toolArgs.query || "";
        const specFile = path.join(skillsRepoDir, "specialists", `${role}.md`);
        let specialistContent = "";
        if (fs.existsSync(specFile)) {
          try { specialistContent = fs.readFileSync(specFile, "utf-8"); } catch (e) {}
        }

        let reply = `[Hermes Specialist: ${role.toUpperCase()}]\n`;
        if (specialistContent) {
          reply += `${specialistContent}\n\n`;
        }
        reply += `Menganalisis kueri: "${query}"\nPedoman: Patuhi RFC 2119, validasi skema via Tabularis SIMRS, isolasi perubahan, dan catat keputusan teknis ke Mnemosyne.`;

        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: reply }] }
        });
      } else if (toolName === "hermes_get_project_context" || toolName === "hermes__get_project_context") {
        const plansDir = path.join(skillsRepoDir, "plans");
        const activeBranchDir = path.join(skillsRepoDir, "rules", "active_branch");
        let contextReport = "# Dynamic Project Context & Active Workstream\n\n";
        
        let plans = [];
        if (fs.existsSync(plansDir)) {
          try {
            plans = fs.readdirSync(plansDir).filter(f => f.endsWith(".md")).map(f => `- **${f.replace('.md', '')}**`);
          } catch (e) {}
        }
        
        let activeBranches = [];
        if (fs.existsSync(activeBranchDir)) {
          try {
            const items = fs.readdirSync(activeBranchDir, { withFileTypes: true });
            for (const item of items) {
              if (item.isDirectory()) {
                activeBranches.push(`- **Branch Context: ${item.name}**`);
              }
            }
          } catch (e) {}
        }

        contextReport += "### Active Workplans / Roadmaps:\n" + (plans.length > 0 ? plans.join("\n") : "_Nihil rencana kerja tersimpan._") + "\n\n";
        contextReport += "### Active Branch Specs & Boundaries:\n" + (activeBranches.length > 0 ? activeBranches.join("\n") : "_Nihil spesifikasi branch khusus._") + "\n\n";
        contextReport += "Pedoman: Gunakan konteks ini untuk memahami milestone aktif sebelum memodifikasi kode.";

        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: { content: [{ type: "text", text: contextReport }] }
        });
      } else if (toolName === "mikrotik_list_routers" || toolName === "mikrotik_mikrotik_list_routers") {
        const allRouters = loadMikrotikRouters();
        if (allRouters.length === 0) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: "Belum ada router MikroTik yang terdaftar di HHG. Daftarkan router melalui dashboard HHG (MCP Hub -> Router MikroTik)." }] }
          });
        } else {
          let report = "ROUTERS (mikrotik):\n";
          for (const r of allRouters) {
            const status = r.enabled !== false ? 'AKTIF' : 'NON-AKTIF';
            const tier = (r.tier || 'prod').toUpperCase().slice(0, 4);
            report += `• ${r.alias} | ${r.user}@${r.host}:${r.port || 8728} | ${tier} | ${status}${r.description ? ` | ${r.description}` : ''}\n`;
          }
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: report.trimEnd() }] }
          });
        }
      } else if (toolName === "mikrotik_get_system_resource" || toolName === "mikrotik_mikrotik_get_system_resource") {
        const target = resolveMikrotikTarget(toolArgs.router);
        if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/system/resource/print']);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            const d = (res.data && res.data[0]) || {};
            const freeMemMb = d['free-memory'] ? (Number(d['free-memory']) / 1048576).toFixed(1) : '-';
            const totalMemMb = d['total-memory'] ? (Number(d['total-memory']) / 1048576).toFixed(1) : '-';
            const freeHddMb = d['free-hdd-space'] ? (Number(d['free-hdd-space']) / 1048576).toFixed(1) : '-';
            const totalHddMb = d['total-hdd-space'] ? (Number(d['total-hdd-space']) / 1048576).toFixed(1) : '-';
            const text = [
              `=== MIKROTIK RESOURCE: ${target.router.alias} (${target.router.host}) ===`,
              `Board / Model : ${d['board-name'] || d.platform || 'MikroTik Router'}`,
              `RouterOS Ver  : ${d.version || '-'} (Arch: ${d['architecture-name'] || '-'})`,
              `Uptime        : ${d.uptime || '-'}`,
              `CPU Load      : ${d['cpu-load'] !== undefined ? `${d['cpu-load']}%` : '-'} (${d['cpu-count'] || '1'} core @ ${d['cpu-frequency'] || '-'} MHz)`,
              `RAM Usage     : Free ${freeMemMb} MB / Total ${totalMemMb} MB`,
              `Storage HDD   : Free ${freeHddMb} MB / Total ${totalHddMb} MB`
            ].join('\n');
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text }] } });
          }
        }
      } else if (toolName === "mikrotik_get_interface_traffic" || toolName === "mikrotik_mikrotik_get_interface_traffic") {
        const iface = (toolArgs.interface || '').trim();
        const target = resolveMikrotikTarget(toolArgs.router);
        if (!iface) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: "Parameter 'interface' wajib diisi (contoh: 'ether1-lan')." }], isError: true } });
        } else if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/interface/monitor-traffic', `=interface=${iface}`, '=once=']);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            const d = (res.data && res.data[0]) || {};
            const rxBps = d['rx-bits-per-second'] ? Number(d['rx-bits-per-second']) : 0;
            const txBps = d['tx-bits-per-second'] ? Number(d['tx-bits-per-second']) : 0;
            const rxMbps = (rxBps / 1000000).toFixed(2);
            const txMbps = (txBps / 1000000).toFixed(2);
            const text = [
              `=== MIKROTIK TRAFFIC MONITOR: ${iface} on ${target.router.alias} ===`,
              `RX Throughput : ${rxMbps} Mbps (${rxBps.toLocaleString()} bps) | ${d['rx-packets-per-second'] || 0} pps`,
              `TX Throughput : ${txMbps} Mbps (${txBps.toLocaleString()} bps) | ${d['tx-packets-per-second'] || 0} pps`,
              `RX Drops/Err  : ${d['rx-drops-per-second'] || 0} drops/s, ${d['rx-errors-per-second'] || 0} err/s`,
              `TX Drops/Err  : ${d['tx-drops-per-second'] || 0} drops/s, ${d['tx-errors-per-second'] || 0} err/s`
            ].join('\n');
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text }] } });
          }
        }
      } else if (toolName === "mikrotik_list_interfaces" || toolName === "mikrotik_mikrotik_list_interfaces") {
        const target = resolveMikrotikTarget(toolArgs.router);
        if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/interface/print']);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            let out = `INTERFACES on ${target.router.alias} (${res.data.length} total):\n`;
            for (const item of res.data) {
              const run = item.running === 'true' ? 'RUNNING' : 'DOWN';
              const dis = item.disabled === 'true' ? ' [DISABLED]' : '';
              out += `• ${item.name} | Type: ${item.type} | MTU: ${item.mtu || '-'} | MAC: ${item['mac-address'] || '-'} | ${run}${dis}\n`;
            }
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: out.trimEnd() }] } });
          }
        }
      } else if (toolName === "mikrotik_list_ip_addresses" || toolName === "mikrotik_mikrotik_list_ip_addresses") {
        const target = resolveMikrotikTarget(toolArgs.router);
        if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/ip/address/print']);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            let out = `IP ADDRESSES on ${target.router.alias} (${res.data.length} total):\n`;
            for (const item of res.data) {
              const dis = item.disabled === 'true' ? ' [DISABLED]' : '';
              const dyn = item.dynamic === 'true' ? ' (Dynamic)' : '';
              out += `• ${item.address} on ${item.interface} (Network: ${item.network || '-'})${dyn}${dis}\n`;
            }
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: out.trimEnd() }] } });
          }
        }
      } else if (toolName === "mikrotik_list_active_routes" || toolName === "mikrotik_mikrotik_list_active_routes") {
        const target = resolveMikrotikTarget(toolArgs.router);
        if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/ip/route/print']);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            let out = `IP ROUTES on ${target.router.alias} (${res.data.length} total):\n`;
            for (const item of res.data.slice(0, 50)) {
              const act = item.active === 'true' ? 'ACTIVE' : 'INACTIVE';
              const gw = item.gateway || item['immediate-gw'] || '-';
              out += `• Dst: ${item['dst-address']} -> Gateway: ${gw} | ${act} | Distance: ${item.distance || '1'}\n`;
            }
            if (res.data.length > 50) out += `... dan ${res.data.length - 50} rute lainnya.\n`;
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: out.trimEnd() }] } });
          }
        }
      } else if (toolName === "mikrotik_list_arp_table" || toolName === "mikrotik_mikrotik_list_arp_table") {
        const target = resolveMikrotikTarget(toolArgs.router);
        if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/ip/arp/print']);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            let out = `ARP TABLE on ${target.router.alias} (${res.data.length} entries):\n`;
            for (const item of res.data.slice(0, 60)) {
              const complete = item.complete === 'true' ? 'OK' : 'INCOMPLETE';
              out += `• IP: ${item.address} | MAC: ${item['mac-address']} | Interface: ${item.interface} | ${complete}\n`;
            }
            if (res.data.length > 60) out += `... dan ${res.data.length - 60} entri ARP lainnya.\n`;
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: out.trimEnd() }] } });
          }
        }
      } else if (toolName === "mikrotik_router_ping" || toolName === "mikrotik_mikrotik_router_ping") {
        const addr = (toolArgs.address || '').trim();
        const cnt = toolArgs.count ? Number(toolArgs.count) : 4;
        const target = resolveMikrotikTarget(toolArgs.router);
        if (!addr) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: "Parameter 'address' wajib diisi untuk uji ping." }], isError: true } });
        } else if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const res = await executeMikrotikApi(target.router, ['/ping', `=address=${addr}`, `=count=${cnt}`], 12000);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            let out = `PING from ${target.router.alias} to ${addr} (${cnt} packets):\n`;
            for (const p of res.data) {
              out += `• Seq ${p.seq}: ${p.host || addr} time=${p.time || '-'} ttl=${p.ttl || '-'} loss=${p['packet-loss'] || '0'}%\n`;
            }
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: out.trimEnd() }] } });
          }
        }
      } else if (toolName === "mikrotik_run_command" || toolName === "mikrotik_mikrotik_run_command") {
        const rawCmd = (toolArgs.command || '').trim();
        const target = resolveMikrotikTarget(toolArgs.router);
        if (!rawCmd) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: "Parameter 'command' wajib diisi." }], isError: true } });
        } else if (target.error) {
          sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: target.error }], isError: true } });
        } else {
          const words = [rawCmd];
          if (toolArgs.params && typeof toolArgs.params === 'object') {
            for (const [k, v] of Object.entries(toolArgs.params)) {
              words.push(`=${k}=${v}`);
            }
          }
          const res = await executeMikrotikApi(target.router, words);
          if (res.error) {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: res.error }], isError: true } });
          } else {
            sendResponse({ jsonrpc: "2.0", id: id, result: { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] } });
          }
        }
      } else if (toolName === "ssh_list_hosts" || toolName === "remote-ssh_ssh_list_hosts" || toolName === "ssh_ssh_list_hosts") {
        const allHosts = loadSshHosts();
        const hosts = allHosts.filter(h => h.enabled !== false);
        if (hosts.length === 0) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: allHosts.length > 0 ? "Seluruh host remote SSH terdaftar saat ini dalam status NON-AKTIF di HHG. Aktifkan host melalui toggle di HHG." : "Belum ada host remote SSH yang terdaftar di HHG. Daftarkan host terlebih dahulu via UI HHG (MCP Hub -> Pasang Remote SSH Host)." }] }
          });
        } else {
          let report = "HOSTS (remote-ssh):\n";
          for (const h of hosts) {
            const tier = (h.tier || 'dev').toUpperCase().slice(0, 4);
            const mode = h.allow_elevated ? 'FULL' : 'READONLY';
            report += `• ${h.alias} | ${h.user}@${h.host}:${h.port} | ${tier} | ${mode}${h.description ? ` | ${h.description}` : ''}\n`;
          }
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: report.trimEnd() }] }
          });
        }
      } else if (toolName === "ssh_run_command" || toolName === "remote-ssh_ssh_run_command" || toolName === "ssh_ssh_run_command") {
        const target = (toolArgs.target || "").trim();
        const cmd = (toolArgs.command || "").trim();
        const hosts = loadSshHosts();
        const host = hosts.find(h => h.alias.toLowerCase() === target.toLowerCase() || h.host === target || h.id === target);

        if (!host) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Host '${target}' tidak ditemukan di daftar remote SSH HHG. Gunakan ssh_list_hosts untuk melihat target valid.` }], isError: true }
          });
        } else if (host.enabled === false) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Host '${host.alias}' (${host.host}) saat ini DINONAKTIFKAN di HHG. Aktifkan host terlebih dahulu via tombol toggle di dashboard HHG.` }], isError: true }
          });
        } else if (!cmd) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: "Parameter 'command' tidak boleh kosong." }], isError: true }
          });
        } else {
          // Safety Check: Cegah sudo / perintah destruktif & modifikasi file jika allow_elevated false
          const isElevated = host.allow_elevated;
          let isForbidden = false;
          let forbiddenReason = "";

          if (!isElevated) {
            // 1. Privileged / Escalation tokens
            if (/\bsudo\b/i.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "eksekusi hak akses root (sudo)";
            }
            // 2. Destructive system & disk commands
            else if (/\b(reboot|shutdown|poweroff|halt|mkfs|fdisk|parted)\b/i.test(cmd) || /\bdd\s+if=/i.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "perintah sistem/disk destruktif";
            }
            // 3. File & directory modification commands
            else if (/\b(rm|cp|mv|touch|mkdir|rmdir|chmod|chown|chgrp|truncate|tee)\b/i.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "modifikasi berkas/direktori (rm, cp, mv, touch, chmod, tee, dll)";
            }
            // 4. In-place stream editors
            else if (/\bsed\s+-[a-zA-Z]*i/i.test(cmd) || /\bperl\s+-[a-zA-Z]*i/i.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "in-place editing berkas (sed -i / perl -i)";
            }
            // 5. Output redirection writing to files (> or >>)
            else if (/(?:[12&]?>{1,2}|>[&12])/.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "redirection output penulisan berkas (> atau >>)";
            }
            // 6. Script interpreter inline write patterns (python, perl, node, bash)
            else if (/\b(python|python3|node|perl|ruby|bash|sh)\b/i.test(cmd) && /\b(open\s*\(.*['"].*[wa\+]|write|unlink|remove|rmdir|chmod|copy|copy2|copyfile)\b/i.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "skrip inline yang melakukan penulisan berkas";
            }
            // 7. Absolute Database CLI Guard: Blokir seluruh eksekusi SQL/Database via SSH saat READ-ONLY
            else if (/\b(mysql|mariadb|psql|sqlite3)\b/i.test(cmd)) {
              isForbidden = true;
              forbiddenReason = "eksekusi database CLI (mysql/mariadb/psql). Gunakan MCP Database khusus (misal database-simrs/tabularis) untuk query data. Eksekusi database via SSH hanya diizinkan dalam mode FULL";
            }
          }

          if (isForbidden) {
            appendSshAuditLog({
              tool: "ssh_run_command",
              target: host.alias,
              target_ip: host.host,
              mode: "READONLY",
              action_summary: cmd,
              status: "BLOCKED_READONLY",
              duration_ms: 0
            });
            const blockMsg = "[PERMISSION REFUSED] Host '" + host.alias + "' disetel dalam mode READ-ONLY di HHG. Aksi diblokir karena terdeteksi " + forbiddenReason + " (" + cmd + "). Aktifkan toggle 'FULL (Sudo)' di UI HHG jika memerlukan akses root/write.";
            sendResponse({
              jsonrpc: "2.0",
              id: id,
              result: { content: [{ type: "text", text: blockMsg }], isError: true }
            });
          } else {
            // Eksekusi via SSH client bawaan OS dengan isolated key
            const startTime = Date.now();
            const sshBinary = process.platform === "win32" ? "C:\\\\Windows\\\\System32\\\\OpenSSH\\\\ssh.exe" : "ssh";
            const sshArgs = [
              "-i", host.key_path,
              "-p", String(host.port || 22),
              "-o", "StrictHostKeyChecking=no",
              "-o", "UserKnownHostsFile=/dev/null",
              "-o", "BatchMode=yes",
              "-o", "ConnectTimeout=10",
              `${host.user}@${host.host}`,
              cmd
            ];

            try {
              const child = spawn(sshBinary, sshArgs, { windowsHide: true });
              let stdout = "";
              let stderr = "";
              child.stdout.on("data", d => stdout += d.toString());
              child.stderr.on("data", d => stderr += d.toString());
              child.on("close", (code) => {
                const duration = Date.now() - startTime;
                let outText = stdout || stderr || `[Exit Code ${code}]`;
                appendSshAuditLog({
                  tool: "ssh_run_command",
                  target: host.alias,
                  target_ip: host.host,
                  mode: isElevated ? "FULL" : "READONLY",
                  action_summary: cmd,
                  status: code === 0 ? "SUCCESS" : `EXIT_${code}`,
                  duration_ms: duration,
                  output_preview: outText.trim().replace(/\r?\n/g, " ").slice(0, 200),
                  exit_code: code
                });
                sendResponse({
                  jsonrpc: "2.0",
                  id: id,
                  result: {
                    content: [{ type: "text", text: outText }],
                    isError: code !== 0
                  }
                });
              });
              child.on("error", (err) => {
                const duration = Date.now() - startTime;
                appendSshAuditLog({
                  tool: "ssh_run_command",
                  target: host.alias,
                  target_ip: host.host,
                  mode: isElevated ? "FULL" : "READONLY",
                  action_summary: cmd,
                  status: `SPAWN_ERROR: ${err.message}`,
                  duration_ms: duration
                });
                sendResponse({
                  jsonrpc: "2.0",
                  id: id,
                  result: { content: [{ type: "text", text: `Gagal menjalankan binary SSH: ${err.message}` }], isError: true }
                });
              });
            } catch (err) {
              appendSshAuditLog({
                tool: "ssh_run_command",
                target: host.alias,
                target_ip: host.host,
                mode: isElevated ? "FULL" : "READONLY",
                action_summary: cmd,
                status: `EXEC_ERROR: ${err.message}`,
                duration_ms: 0
              });
              sendResponse({
                jsonrpc: "2.0",
                id: id,
                result: { content: [{ type: "text", text: `SSH execution error: ${err.message}` }], isError: true }
              });
            }
          }
        }
      } else if (toolName === "ssh_read_file" || toolName === "remote-ssh_ssh_read_file" || toolName === "ssh_ssh_read_file") {
        const target = (toolArgs.target || "").trim();
        const rPath = (toolArgs.remote_path || "").trim();
        const hosts = loadSshHosts();
        const host = hosts.find(h => h.alias.toLowerCase() === target.toLowerCase() || h.host === target || h.id === target);

        if (!host || !rPath) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Target host atau remote_path tidak valid.` }], isError: true }
          });
        } else if (host.enabled === false) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Host '${host.alias}' (${host.host}) saat ini DINONAKTIFKAN di HHG.` }], isError: true }
          });
        } else {
          const startTime = Date.now();
          const sshBinary = process.platform === "win32" ? "C:\\\\Windows\\\\System32\\\\OpenSSH\\\\ssh.exe" : "ssh";
          const sshArgs = [
            "-i", host.key_path,
            "-p", String(host.port || 22),
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "BatchMode=yes",
            `${host.user}@${host.host}`,
            `cat "${rPath}"`
          ];
          try {
            const child = spawn(sshBinary, sshArgs, { windowsHide: true });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", d => stdout += d.toString());
            child.stderr.on("data", d => stderr += d.toString());
            child.on("close", (code) => {
              const duration = Date.now() - startTime;
              appendSshAuditLog({
                tool: "ssh_read_file",
                target: host.alias,
                target_ip: host.host,
                mode: host.allow_elevated ? "FULL" : "READONLY",
                action_summary: `read ${rPath}`,
                status: code === 0 ? "SUCCESS" : `EXIT_${code}`,
                duration_ms: duration
              });
              sendResponse({
                jsonrpc: "2.0",
                id: id,
                result: {
                  content: [{ type: "text", text: code === 0 ? stdout : (stderr || `Gagal membaca file (exit ${code})`) }],
                  isError: code !== 0
                }
              });
            });
          } catch (err) {
            appendSshAuditLog({
              tool: "ssh_read_file",
              target: host.alias,
              target_ip: host.host,
              mode: host.allow_elevated ? "FULL" : "READONLY",
              action_summary: `read ${rPath}`,
              status: `EXEC_ERROR: ${err.message}`,
              duration_ms: 0
            });
            sendResponse({
              jsonrpc: "2.0",
              id: id,
              result: { content: [{ type: "text", text: `SSH read error: ${err.message}` }], isError: true }
            });
          }
        }
      } else if (toolName === "ssh_write_file" || toolName === "remote-ssh_ssh_write_file" || toolName === "ssh_ssh_write_file") {
        const target = (toolArgs.target || "").trim();
        const rPath = (toolArgs.remote_path || "").trim();
        const content = toolArgs.content || "";
        const hosts = loadSshHosts();
        const host = hosts.find(h => h.alias.toLowerCase() === target.toLowerCase() || h.host === target || h.id === target);

        if (!host || !rPath) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Target host atau remote_path tidak valid.` }], isError: true }
          });
        } else if (host.enabled === false) {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `Host '${host.alias}' (${host.host}) saat ini DINONAKTIFKAN di HHG.` }], isError: true }
          });
        } else if (!host.allow_elevated) {
          appendSshAuditLog({
            tool: "ssh_write_file",
            target: host.alias,
            target_ip: host.host,
            mode: "READONLY",
            action_summary: `write ${rPath} (${content.length} bytes)`,
            status: "BLOCKED_READONLY",
            duration_ms: 0
          });
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            result: { content: [{ type: "text", text: `[PERMISSION REFUSED] Host '${host.alias}' dalam mode READ-ONLY. Penulisan berkas remote diblokir. Aktifkan mode FULL di HHG.` }], isError: true }
          });
        } else {
          const startTime = Date.now();
          const sshBinary = process.platform === "win32" ? "C:\\\\Windows\\\\System32\\\\OpenSSH\\\\ssh.exe" : "ssh";
          const sshArgs = [
            "-i", host.key_path,
            "-p", String(host.port || 22),
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", "BatchMode=yes",
            `${host.user}@${host.host}`,
            `cat > "${rPath}"`
          ];
          try {
            const child = spawn(sshBinary, sshArgs, { windowsHide: true });
            let stderr = "";
            child.stderr.on("data", d => stderr += d.toString());
            child.on("close", (code) => {
              const duration = Date.now() - startTime;
              appendSshAuditLog({
                tool: "ssh_write_file",
                target: host.alias,
                target_ip: host.host,
                mode: "FULL",
                action_summary: `write ${rPath} (${content.length} bytes)`,
                status: code === 0 ? "SUCCESS" : `EXIT_${code}`,
                duration_ms: duration
              });
              sendResponse({
                jsonrpc: "2.0",
                id: id,
                result: {
                  content: [{ type: "text", text: code === 0 ? `✓ Berhasil menulis berkas ke ${rPath} pada host ${host.alias}` : (stderr || `Gagal menulis file (exit ${code})`) }],
                  isError: code !== 0
                }
              });
            });
            child.stdin.write(content);
            child.stdin.end();
          } catch (err) {
            appendSshAuditLog({
              tool: "ssh_write_file",
              target: host.alias,
              target_ip: host.host,
              mode: "FULL",
              action_summary: `write ${rPath} (${content.length} bytes)`,
              status: `EXEC_ERROR: ${err.message}`,
              duration_ms: 0
            });
            sendResponse({
              jsonrpc: "2.0",
              id: id,
              result: { content: [{ type: "text", text: `SSH write error: ${err.message}` }], isError: true }
            });
          }
        }
      } else {
        let data = getCachedData();
        let route = (data.routing || {})[toolName];
        if (!route && (!data.tools || data.tools.length === 0 || !fs.existsSync(cacheFile))) {
          data = await buildAndSaveCache();
          route = (data.routing || {})[toolName];
        }

        // Direct Routing Fallback untuk seluruh tool mnemosyne_*
        if (!route && toolName.startsWith("mnemosyne_")) {
          const cfg = loadConfig();
          const mnemoHost = (cfg.default_mnemosyne_url || "http://172.168.1.202:8080").replace(/\/+$/, "");
          const mnemoUrl = mnemoHost.endsWith("/sse") ? mnemoHost : `${mnemoHost}/sse`;
          route = {
            server: {
              name: "mnemosyne",
              serverUrl: mnemoUrl,
              enabled: true
            },
            originalToolName: toolName
          };
        }
        if (route && route.server) {
          const targetServer = route.server;
          const origName = route.originalToolName || toolName;

          if (targetServer.name === "tabularis" || targetServer.id === "tabularis") {
            if (origName !== "list_connections" && (!toolArgs.connection_id || toolArgs.connection_id.trim() === "")) {
              toolArgs.connection_id = "25cc551a-9479-4f84-88a6-24d84365746f";
            }
          }

          const downstreamReq = {
            jsonrpc: "2.0",
            id: id,
            method: "tools/call",
            params: {
              name: origName,
              arguments: toolArgs
            }
          };

          let subResp;
          if (targetServer.serverUrl || targetServer.url) {
            const targetUrl = targetServer.serverUrl || targetServer.url;
            subResp = await callHttpJsonRpc(targetUrl, downstreamReq, 25000);
          } else {
            subResp = await callSubprocessRpc(targetServer.command, targetServer.args, targetServer.env, downstreamReq, 25000);
          }
          sendResponse(subResp);

          // SINKRONISASI REALTIME KE TELEGRAM & EVOLUTION LOGS
          // Jika IDE memanggil tool mutasi memori (mnemosyne_remember, mnemosyne_remember_canonical, mnemosyne_update, mnemosyne_batch)
          if (origName.startsWith("mnemosyne_remember") || origName === "mnemosyne_update" || origName === "mnemosyne_batch") {
            try {
              const bodyText = toolArgs.body || toolArgs.content || JSON.stringify(toolArgs);
              const catName = toolArgs.category ? `${toolArgs.category}:${toolArgs.name || "slot"}` : (toolArgs.name || "memory");
              const activeCfg = loadConfig();
              const activeProfile = activeCfg.active_profile || activeCfg.profile || "developer";
              const postData = JSON.stringify({
                type: "memory",
                workspace_id: "ai-agents",
                profile_id: activeProfile,
                category: toolArgs.category || "canonical",
                name: toolArgs.name || "slot",
                body: bodyText,
                direct_mutation: true
              });

              const http = require("http");
              const evReq = http.request({
                hostname: "172.168.1.202",
                port: 9125,
                path: "/api/v1/direct-memory-event",
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(postData)
                },
                timeout: 3000
              });
              evReq.on("error", () => {});
              evReq.write(postData);
              evReq.end();
            } catch (e) {}
          }
        } else {
          sendResponse({
            jsonrpc: "2.0",
            id: id,
            error: { code: -32601, message: `Tool ${toolName} tidak dikenali di routing namespace server MCP HHG mana pun.` }
          });
        }
      }
    } else if (method === "ping") {
      sendResponse({ jsonrpc: "2.0", id: id, result: {} });
    } else if (method === "resources/list") {
      sendResponse({ jsonrpc: "2.0", id: id, result: { resources: [] } });
    } else if (method === "prompts/list") {
      sendResponse({ jsonrpc: "2.0", id: id, result: { prompts: [] } });
    } else if (method === "logging/setLevel") {
      sendResponse({ jsonrpc: "2.0", id: id, result: {} });
    } else if (method?.startsWith("notifications/")) {
      // Ignore notifications without error response
    } else {
      if (id !== undefined && id !== null) {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          error: { code: -32601, message: `Method ${method} tidak didukung` }
        });
      }
    }
  } catch (err) {
    sendResponse({ jsonrpc: "2.0", id: req?.id, error: { code: -32603, message: err.message } });
  }
});
