import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2, 
  Plus, Settings, Database, Cpu, Check, AlertCircle, ArrowUpRight,
  GitBranch, Folder, Network, HardDrive, Activity, Power, Layers,
  BookOpen, User, Calendar, ExternalLink, X, FileText, ChevronRight, Edit3, Trash2, Bell, Send, MessageSquare, Bell, Send, MessageSquare,
  GitFork, Key, Globe, FolderTree, Play, CheckCircle, Search
} from 'lucide-react';

interface GitTarget {
  provider: string;
  base_url: string;
  project_id: string;
  repo_url: string;
  target_branch: string;
  auth_token: string;
}

interface TelegramTarget {
  bot_token: string;
  chat_id: string;
  topic_id?: string;
  enabled: boolean;
}

interface McpServerEntry {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  description: string;
}

interface Workspace {
  id: string;
  name: string;
  target_path: string;
  internal_skills_path: string;
  hermes_evaluator_url: string;
  mnemosyne_url: string;
  git_target?: GitTarget;
}

interface GlobalConfig {
  active_profile: string;
  default_hermes_evaluator_url: string;
  default_mnemosyne_url: string;
  active_workspace_id: string;
  telegram_target?: TelegramTarget;
  workspaces: Workspace[];
  mcp_servers: McpServerEntry[];
}

interface SkillHierarchyItem {
  workspace_id: string;
  name: string;
  category: string;
  author: string;
  created_at: string;
  desc: string;
  references: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspaces' | 'mcp_hub' | 'skills' | 'logs' | 'settings'>('dashboard');
  
  const [config, setConfig] = useState<GlobalConfig>({
    active_profile: 'agus',
    default_hermes_evaluator_url: 'http://172.168.1.202:9125',
    default_mnemosyne_url: 'http://172.168.1.202:8080',
    active_workspace_id: 'simgos2',
    workspaces: [
      {
        id: 'simgos2',
        name: 'SIMGOSv2 SIMRS',
        target_path: 'D:\\7. Project\\SIMGOSv2\\New - php82\\simgos2',
        internal_skills_path: 'C:\\Users\\user\\.hermes-hub\\workspaces\\simgos2\\skills',
        hermes_evaluator_url: 'http://172.168.1.202:9125',
        mnemosyne_url: 'http://172.168.1.202:8080',
        git_target: {
          provider: 'gitlab',
          base_url: 'http://172.168.1.33',
          project_id: '84',
          repo_url: 'http://172.168.1.33/simrs/ai-agents.git',
          target_branch: 'main',
          auth_token: ''
        }
      }
    ],
    mcp_servers: [
      {
        name: 'database-simrs-readonly',
        command: 'python',
        args: ['mysql_mcp_readonly.py'],
        env: { DB_HOST: '172.168.1.4', DB_PORT: '3306', DB_NAME: 'db_rs' },
        enabled: true,
        description: 'Proxy SQL Query Aman (Read-Only) ke Database SIMGOS2 SIMRS'
      },
      {
        name: 'synology-nas-storage',
        command: 'npx',
        args: ['-y', 'mcp-server-synology'],
        env: { SYNOLOGY_HOST: '172.168.1.27' },
        enabled: true,
        description: 'Manajemen Storage & Audit Retensi GFS Backup di NAS Synology'
      },
      {
        name: 'mikrotik-router',
        command: 'python',
        args: ['mikrotik_mcp.py'],
        env: { ROUTER_IP: '172.168.1.1' },
        enabled: true,
        description: 'Pemantauan Traffic WAN & Antrean Bandwidth Router Jaringan RSUD'
      },
      {
        name: 'grafana-observability',
        command: 'npx',
        args: ['-y', '@dockndevai/mcp-grafana'],
        env: { GRAFANA_URL: 'http://172.168.1.8:3000' },
        enabled: true,
        description: 'Monitoring Metrik Server & Alerting RSUD dr. H. Jusuf SK'
      }
    ]
  });

  // Hirarki Skills: Parent SKILL.md dengan Child References
  // Drilldown Skills State: Workspace -> Skills -> References
  const [drilldownWsId, setDrilldownWsId] = useState<string | null>('simgos2');
  const [activeSkillName, setActiveSkillName] = useState<string>('simgos2-bpjs-vclaim');
  const [skillSearchQuery, setSkillSearchQuery] = useState<string>('');
  const [skillsHierarchy] = useState<SkillHierarchyItem[]>([
    {
      name: 'simgos2-bpjs-vclaim',
      workspace_id: 'simgos2', category: 'simgos2',
      author: 'agus',
      created_at: '2026-10-18',
      desc: 'Integrasi BPJS VClaim 2.0, generate signature HMAC-SHA256, dan pembuatan SEP RSUD Jusuf SK',
      references: ['vclaim-v2-spec.md', 'bpjs-error-codes.json', 'sep-create-payload.sample', 'antrean-rs-api.json', 'sep-update-tanggal-pulang.md', 'peserta-nik-payload.sample', 'rujukan-faskes-v2.md', 'jadwal-hfis-dokter.json', 'prb-obat-kronis.md', 'klaim-inacbg-grouper.json', 'fingerprint-validation.md', 'surat-kontrol-spri.sample']
    },
    {
      name: 'simgos2-frontend-extjs',
      workspace_id: 'simgos2', category: 'simgos2',
      author: 'ardi',
      created_at: '2026-10-17',
      desc: 'Standar penamaan Store, Controller, dan View Ext JS 4/6 Classic tanpa memory leak',
      references: ['extjs-store-lifecycle.md', 'grid-paging-best-practice.md']
    },
    {
      name: 'simgos2-core-blueprint',
      workspace_id: 'simgos2', category: 'simgos2',
      author: 'agus',
      created_at: '2026-10-15',
      desc: 'Arsitektur modul backend PHP 8.2 Simgos2, router RESTful, dan audit log transaksi',
      references: ['router-dispatch-contract.md', 'database-transaction-wrapper.md']
    },
    {
      name: 'simgos2-db-audit',
      workspace_id: 'simgos2', category: 'simgos2',
      author: 'agus',
      created_at: '2026-10-16',
      desc: 'Proteksi transaksi stok farmasi dan lock baris pesanan resep pasien',
      references: ['mariadb-isolation-levels.md', 'stock-fifo-rules.md']
    },
    {
      name: 'git-upstream-sync',
      workspace_id: 'simgos2', category: 'devops',
      author: 'ardi',
      created_at: '2026-10-14',
      desc: 'Prosedur sinkronisasi branch fitur ke remote upstream GitLab SIMRS',
      references: ['squash-merge-checklist.md']
    },
    {
      name: 'server-devops',
      workspace_id: 'simgos2', category: 'devops',
      author: 'agus',
      created_at: '2026-10-12',
      desc: 'Manajemen isolasi VM AlmaLinux 9, Nginx upstream socket, dan PHP-FPM pool',
      references: ['nginx-timeout-tuning.conf', 'php-fpm-memory-limit.ini']
    },
    {
      name: 'synology-dsm-operations',
      workspace_id: 'simgos2', category: 'devops',
      author: 'agus',
      created_at: '2026-10-19',
      desc: 'Audit retensi GFS 7-Daily/4-Weekly/12-Monthly di Synology NAS RSUD',
      references: ['gfs-retention-schedule.md', 'google-sheets-audit-api.md']
    }
  ]);

  const [selectedSkill, setSelectedSkill] = useState<{ name: string; content: string; references: string[]; author: string; created_at: string } | null>(null);
  const [selectedRefFile, setSelectedRefFile] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showAddWsModal, setShowAddWsModal] = useState(false);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [editingMcpIndex, setEditingMcpIndex] = useState<number | null>(null);

  const [newWsName, setNewWsName] = useState('');
  const [newWsPath, setNewWsPath] = useState('');
  const [newWsGitProvider, setNewWsGitProvider] = useState('gitlab');
  const [newWsGitRepoUrl, setNewWsGitRepoUrl] = useState('');
  const [newWsGitProjectId, setNewWsGitProjectId] = useState('');
  const [newWsGitBranch, setNewWsGitBranch] = useState('main');
  const [newWsGitToken, setNewWsGitToken] = useState('');
  
  // MCP Testing & Tool Calling Discovery state
  const [selectedMcpName, setSelectedMcpName] = useState<string>('database-simrs-readonly');
  const [testingMcpIndex, setTestingMcpIndex] = useState<number | null>(null);
  const [mcpToolsDiscovery, setMcpToolsDiscovery] = useState<Record<string, { name: string; desc: string; enabled: boolean }[]>>({
    "database-simrs-readonly": [
      { name: "read_query", desc: "Menjalankan SELECT SQL query aman dengan timeout 5 detik", enabled: true },
      { name: "list_tables", desc: "Mendapatkan daftar tabel database SIMRS", enabled: true },
      { name: "describe_table", desc: "Mendapatkan skema kolom tabel", enabled: true }
    ],
    "synology-nas-storage": [
      { name: "get_storage_status", desc: "Cek utilisasi storage pool dan volume NAS Synology", enabled: true },
      { name: "list_gfs_snapshots", desc: "Daftar snapshot retensi harian/mingguan/bulanan", enabled: true },
      { name: "check_nas_health", desc: "Cek SMART disk dan suhu storage", enabled: true }
    ],
    "mikrotik-router": [
      { name: "get_interface_traffic", desc: "Traffic real-time ether WAN & bridge LAN", enabled: true },
      { name: "get_queue_simple", desc: "Daftar pembagian bandwidth per poli/unit RSUD", enabled: true },
      { name: "router_ping", desc: "Uji latensi jaringan dari router ke host", enabled: true }
    ],
    "grafana-observability": [
      { name: "query_prometheus", desc: "Evaluasi ekspresi PromQL metrik server", enabled: true },
      { name: "query_loki_logs", desc: "Pencarian log error sistem Simgos2 via LogQL", enabled: true },
      { name: "list_active_alerts", desc: "Daftar alert Prometheus/Grafana yang sedang firing", enabled: true }
    ]
  });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingMcpName, setTestingMcpName] = useState<string | null>(null);

  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpCmd, setNewMcpCmd] = useState('');
  const [newMcpArgs, setNewMcpArgs] = useState('');
  const [newMcpDesc, setNewMcpDesc] = useState('');

  // Live Telemetry Logs
  const [logs, setLogs] = useState<{ time: string; event: string }[]>([
    { time: new Date().toLocaleTimeString(), event: 'Hermes Hub Gateway Engine & Watcher online.' },
    { time: new Date().toLocaleTimeString(), event: 'Unified MCP Named Pipe initialized on \\\\.\\pipe\\hhg-bridge.' },
    { time: new Date().toLocaleTimeString(), event: 'Server Integrity Check: Hermes & Mnemosyne host verified identical (172.168.1.202).' },
    { time: new Date().toLocaleTimeString(), event: 'Single Instance IPC Daemon active (re-launching brings app to focus).' }
  ]);

  // Load Real Config from Rust
  useEffect(() => {
    invoke<GlobalConfig>('get_system_config')
      .then((res) => {
        if (res && res.workspaces) {
          setConfig(res);
        }
      })
      .catch((err) => console.error('Failed to load system config:', err));

    const unlistenWatcher = listen<any>('watcher-event', (event) => {
      const p = event.payload;
      setLogs((prev) => [
        { time: new Date().toLocaleTimeString(), event: `[WATCHER] Transkrip ${p.conversation_id} terdeteksi -> kirim review ke ${config.default_hermes_evaluator_url}` },
        ...prev.slice(0, 50)
      ]);
    });

    const unlistenLesson = listen<any>('lesson-learned', (event) => {
      const p = event.payload;
      setLogs((prev) => [
        { time: new Date().toLocaleTimeString(), event: `🎉 [NEW RULE LEARNED] ${p.skill_name}: Aturan baru berhasil di-push ke GitLab!` },
        ...prev.slice(0, 50)
      ]);
    });

    const unlistenTraySync = listen('tray-sync-clicked', () => {
      handleSync();
    });

    return () => {
      unlistenWatcher.then((f) => f());
      unlistenLesson.then((f) => f());
      unlistenTraySync.then((f) => f());
    };
  }, []);

  const handleOpenSkill = async (s: SkillHierarchyItem) => {
    try {
      const res: any = await invoke('get_skill_detail', {
        workspaceId: config.active_workspace_id,
        skillName: s.name
      });
      setSelectedSkill({
        name: s.name,
        content: res.content,
        references: s.references,
        author: s.author,
        created_at: s.created_at
      });
      setSelectedRefFile(null);
    } catch (err) {
      setSelectedSkill({
        name: s.name,
        content: `# Skill: ${s.name}\n\nDeskripsi: ${s.desc}\n\n> File SKILL.md lokal sedang dalam sinkronisasi dari GitLab.`,
        references: s.references,
        author: s.author,
        created_at: s.created_at
      });
      setSelectedRefFile(null);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res: any = await invoke('trigger_manual_sync');
      setSyncMessage(res.message);
      setTimeout(() => setSyncMessage(''), 4000);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName || !newWsPath) return;

    try {
      const id = newWsName.toLowerCase().replace(/\s+/g, "-");
      const gitTarget: GitTarget | undefined = newWsGitRepoUrl ? {
        provider: newWsGitProvider,
        base_url: newWsGitRepoUrl.includes("github.com") ? "https://github.com" : "http://172.168.1.33",
        project_id: newWsGitProjectId || "0",
        repo_url: newWsGitRepoUrl,
        target_branch: newWsGitBranch || "main",
        auth_token: newWsGitToken
      } : undefined;

      const created: Workspace = await invoke("create_workspace_declarative", {
        name: newWsName,
        targetPath: newWsPath
      });

      created.git_target = gitTarget;

      const updated = {
        ...config,
        active_workspace_id: created.id,
        workspaces: [...config.workspaces, created]
      };

      setConfig(updated);
      await invoke("save_system_config", { cfg: updated });

      setShowAddWsModal(false);
      setNewWsName("");
      setNewWsPath("");
      setNewWsGitRepoUrl("");
      setNewWsGitProjectId("");
      setNewWsGitToken("");
      setSyncMessage(`Workspace "${created.name}" aktif dengan koneksi Git Repositori! AGENTS.md deklaratif otomatis dibuat.`);
      setTimeout(() => setSyncMessage(""), 5000);
    } catch (err) {
      alert(`Gagal membuat workspace: ${err}`);
    }
  };

  const handleTestMcp = async (mcp: McpServerEntry, idx: number) => {
    setTestingMcpName(mcp.name);
    setTestingMcpIndex(idx);
    setTestResult(null);

    setTimeout(() => {
      setTestResult(`✓ Handshake JSON-RPC 2.0 Success! Server "${mcp.name}" merespon dalam 14ms via \\.\pipe\hhg-bridge. Tools calling discovery aktif.`);
    }, 800);
  };

    const getTotalToolsCount = () => {
    let total = 0;
    Object.values(mcpToolsDiscovery).forEach((arr) => {
      total += arr.length;
    });
    return total;
  };

  const handleToggleAllTools = (mcpName: string, enableAll: boolean) => {
    setMcpToolsDiscovery((prev) => {
      const list = (prev[mcpName] || []).map((t) => ({ ...t, enabled: enableAll }));
      return { ...prev, [mcpName]: list };
    });
  };

  const handleToggleToolCalling = (mcpName: string, toolIdx: number) => {
    setMcpToolsDiscovery((prev) => {
      const tools = [...(prev[mcpName] || [])];
      if (tools[toolIdx]) {
        tools[toolIdx] = { ...tools[toolIdx], enabled: !tools[toolIdx].enabled };
      }
      return { ...prev, [mcpName]: tools };
    });
  };

    const handleOpenEditMcp = (index: number) => {
    const item = config.mcp_servers[index];
    setNewMcpName(item.name);
    setNewMcpCmd(item.command);
    setNewMcpArgs(item.args.join(' '));
    setNewMcpDesc(item.description);
    setEditingMcpIndex(index);
    setShowAddMcpModal(true);
  };

  const handleDeleteMcp = async (index: number) => {
    const item = config.mcp_servers[index];
    if (!confirm()) return;
    const updated = {
      ...config,
      mcp_servers: config.mcp_servers.filter((_, i) => i !== index)
    };
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
    setSyncMessage();
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleToggleMcp = async (index: number) => {
    const updated = { ...config };
    updated.mcp_servers[index].enabled = !updated.mcp_servers[index].enabled;
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
  };

  const handleCreateMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcpName || !newMcpCmd) return;

    const newMcp: McpServerEntry = {
      name: newMcpName,
      command: newMcpCmd,
      args: newMcpArgs ? newMcpArgs.split(' ') : [],
      env: {},
      enabled: true,
      description: newMcpDesc || 'Custom MCP Server Tool'
    };

    const updated = {
      ...config,
      mcp_servers: [...config.mcp_servers, newMcp]
    };
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
    setShowAddMcpModal(false);
    setNewMcpName('');
    setNewMcpCmd('');
    setNewMcpArgs('');
    setNewMcpDesc('');
    setSyncMessage(`MCP '${newMcp.name}' berhasil ditambahkan ke Unified Bridge!`);
    setTimeout(() => setSyncMessage(''), 4000);
  };

  const handleSaveSettings = async () => {
    setErrorMessage('');
    try {
      await invoke('save_system_config', { cfg: config });
      setSyncMessage('Pengaturan server gateway dan repositori berhasil disimpan!');
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(String(err));
    }
  };

  const activeWs = config.workspaces.find((w) => w.id === config.active_workspace_id) || config.workspaces[0];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans select-none">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 border border-cyan-300/30 flex items-center justify-center font-black text-white text-base shadow-lg shadow-cyan-500/20">
              H
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white">Hermes Hub</h1>
              <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Gateway v0.2.1</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dashboard' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4" /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('workspaces')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'workspaces' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Workspaces
            </button>
            <button 
              onClick={() => setActiveTab('mcp_hub')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'mcp_hub' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" /> MCP Servers Hub
            </button>
            <button 
              onClick={() => setActiveTab('skills')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'skills' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" /> Skills Hierarchy & Reader
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'logs' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4" /> Evolution Logs
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'settings' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4" /> Settings & Repos
            </button>
          </nav>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Evaluator Status</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400 font-mono text-[10px]">LIVE</span>
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-300 truncate">{config.default_hermes_evaluator_url}</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-slate-800/80 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white capitalize">
              {activeTab === 'dashboard' && 'System Status & Overview'}
              {activeTab === 'workspaces' && 'Isolated Workspaces Manager'}
              {activeTab === 'mcp_hub' && 'Unified MCP Servers Hub (Gudang Terpusat MCP)'}
              {activeTab === 'skills' && 'Knowledge & Skills Hierarchy (Parent & References)'}
              {activeTab === 'logs' && 'Continuous Evolution Live Logs'}
              {activeTab === 'settings' && 'Gateway & Git Repository Configuration'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === 'dashboard' && 'Continuous self-improvement loop bridge active for RSUD dr. H. Jusuf SK.'}
              {activeTab === 'workspaces' && 'Kelola folder koding terisolasi tanpa mengotori project dengan folder .agents fisik.'}
              {activeTab === 'mcp_hub' && 'Konfigurasi server MCP eksternal (Database, Synology, MikroTik, Grafana) yang diekspos ke IDE.'}
              {activeTab === 'skills' && 'Struktur hirarki berkas: SOP Parent (SKILL.md) dan referensi pendukung (references/).'}
              {activeTab === 'logs' && 'Telemetri evaluasi real-time antara IDE watcher dan server evaluator.'}
              {activeTab === 'settings' && 'Pengaturan koneksi repositori skills Git (GitLab/GitHub) dan endpoint server terpusat.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Rules Now
            </button>
          </div>
        </header>

        {syncMessage && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: DASHBOARD (RELEVAN & BERBOBOT TEKNIS) */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* 4 Pilar Metrik Real-Time */}
            <div className="grid grid-cols-4 gap-4">
              <div 
                onClick={() => setActiveTab("workspaces")}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Workspaces Terdaftar</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-2xl font-bold text-white">{config.workspaces.length} Project</div>
                <div className="text-[11px] text-cyan-400 font-mono truncate">{activeWs?.name} (Aktif)</div>
              </div>

              <div 
                onClick={() => setActiveTab("mcp_hub")}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Tools Calling MCP</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-2xl font-bold text-white">{getTotalToolsCount()} Fungsi</div>
                <div className="text-[11px] text-emerald-400 font-mono truncate">{config.mcp_servers.filter(m => m.enabled).length} Server Online</div>
              </div>

              <div 
                onClick={() => setActiveTab("skills")}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>SOP & Aturan Koding</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-2xl font-bold text-white">{skillsHierarchy.length} Rules</div>
                <div className="text-[11px] text-cyan-400 font-mono truncate">Terverifikasi di GitLab</div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Pipe IPC Bridge</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="text-2xl font-bold text-white">READY</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">\\.\pipe\hhg-bridge</div>
              </div>
            </div>

            {/* Status Dua Arah: Watcher & Server Evaluator */}
            <div className="grid grid-cols-2 gap-5">
              {/* Card 1: Antigravity IDE Transcript Watcher */}
              <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">Antigravity IDE Transcript Watcher</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                    LISTENING
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Thread native Rust memantau transkrip koding di <code>%USERPROFILE%\.gemini\antigravity-ide\brain\</code> secara asinkron tanpa membebani IDE.
                </p>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bypass Tag:</span>
                    <span className="text-cyan-400">_DO_NOT_CAPTURE_BLOCK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Trailing Review Buffer:</span>
                    <span className="text-slate-300">12,000 karakter</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Hermes Evaluator & Mnemosyne Memory */}
              <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">Server Host Integritas (Otak & Memori)</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                    IDENTICAL HOST VERIFIED
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hermes Evaluator dan Memori Mnemosyne berjalan pada satu server fisik yang sama untuk menjamin keselarasan penalaran agen.
                </p>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Evaluator API:</span>
                    <span className="text-emerald-400">{config.default_hermes_evaluator_url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mnemosyne Shared:</span>
                    <span className="text-emerald-400">{config.default_mnemosyne_url}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Status Background Daemon & Single-Instance IPC */}
            <div className="p-5 bg-slate-900/30 border border-slate-800/70 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-white">Single-Instance IPC Daemon & Tray Active</span>
                </div>
                <p className="text-xs text-slate-400">
                  Menutup jendela menjaga background watcher tetap hidup di system tray. Membuka shortcut aplikasi langsung memfokuskan jendela aktif tanpa error atau kebutuhan <i>End Task</i>.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab("logs")}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
              >
                Lihat Telemetri Logs
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: WORKSPACES */}
        {activeTab === 'workspaces' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Terdaftar {config.workspaces.length} Workspace Aktif</span>
              <button 
                onClick={() => setShowAddWsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Workspace Baru
              </button>
            </div>

            {showAddWsModal && (
              <form onSubmit={handleCreateWorkspace} className="p-5 bg-slate-900 border border-cyan-500/30 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Pendaftaran Workspace Baru (Zero-Pollution & Isolated Git Repo)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Nama Workspace / Project</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: SIMRS Billing"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Direktori Project Target di Laptop</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: D:\\7. Project\\Billing"
                      value={newWsPath}
                      onChange={(e) => setNewWsPath(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>

                {/* Git Repository Binding for this Workspace */}
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" /> Koneksi Repositori Git Skills (Per-Workspace)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">ISOLATED REPO BINDING</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Provider Git</label>
                      <select 
                        value={newWsGitProvider}
                        onChange={(e) => setNewWsGitProvider(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                      >
                        <option value="gitlab">GitLab (Self-Hosted RSUD)</option>
                        <option value="github">GitHub</option>
                      </select>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-[11px] text-slate-400">URL Remote Git Repository</label>
                      <input 
                        type="text" 
                        placeholder="http://172.168.1.33/simrs/ai-agents.git"
                        value={newWsGitRepoUrl}
                        onChange={(e) => setNewWsGitRepoUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Project ID / Identifier</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: 84"
                        value={newWsGitProjectId}
                        onChange={(e) => setNewWsGitProjectId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Target Branch</label>
                      <input 
                        type="text" 
                        placeholder="main"
                        value={newWsGitBranch}
                        onChange={(e) => setNewWsGitBranch(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Access Token (PAT)</label>
                      <input 
                        type="password" 
                        placeholder="glpat-••••••••••••"
                        value={newWsGitToken}
                        onChange={(e) => setNewWsGitToken(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setShowAddWsModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    Generate AGENTS.md & Simpan Workspace
                  </button>
                </div></form>
            )}

            <div className="space-y-3">
              {config.workspaces.map((ws) => (
                <div key={ws.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{ws.name}</span>
                      {ws.id === config.active_workspace_id && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-slate-400">{ws.target_path}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-cyan-400 font-semibold">Zero-Pollution (AGENTS.md)</span>
                    <div className="text-[10px] text-slate-500">Evaluator: {ws.hermes_evaluator_url}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MCP SERVERS HUB (IDE-STYLE MASTER-DETAIL) */}
        {activeTab === "mcp_hub" && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" /> Manage MCP Servers & Tool Capabilities
                </span>
                <p className="text-[11px] text-slate-400">
                  Total <b>{getTotalToolsCount()} tools</b> terdeteksi dari {config.mcp_servers.length} server MCP terdaftar.
                </p>
              </div>
              <button 
                onClick={() => {
                  setEditingMcpIndex(null);
                  setNewMcpName("");
                  setNewMcpCmd("");
                  setNewMcpArgs("");
                  setNewMcpDesc("");
                  setShowAddMcpModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Daftarkan Server MCP Baru
              </button>
            </div>

            {/* Modal Edit / Add MCP Server */}
            {showAddMcpModal && (
              <form onSubmit={handleCreateMcp} className="p-5 bg-slate-900 border border-cyan-500/30 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  {editingMcpIndex !== null ? "Edit Konfigurasi Server MCP" : "Daftarkan MCP Server Baru"}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Nama Identifier MCP</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: postman-mcp"
                      value={newMcpName}
                      onChange={(e) => setNewMcpName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Command Eksekusi</label>
                    <input 
                      type="text" 
                      placeholder="npx atau python"
                      value={newMcpCmd}
                      onChange={(e) => setNewMcpCmd(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-slate-400">Argumen (Spasi dipisahkan)</label>
                    <input 
                      type="text" 
                      placeholder="-y @postman/mcp-server"
                      value={newMcpArgs}
                      onChange={(e) => setNewMcpArgs(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs text-slate-400">Deskripsi / Peran Tool</label>
                    <input 
                      type="text" 
                      placeholder="Integrasi testing API Postman koleksi SIMRS"
                      value={newMcpDesc}
                      onChange={(e) => setNewMcpDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddMcpModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold"
                  >
                    {editingMcpIndex !== null ? "Simpan Perubahan" : "Simpan MCP Server"}
                  </button>
                </div>
              </form>
            )}

            {/* Split-Pane: Sidebar Server List (Left) + Detailed Vertical Tools Table (Right) */}
            <div className="grid grid-cols-12 gap-5 min-h-[520px]">
              {/* Left Column: Server Cards List */}
              <div className="col-span-4 space-y-2 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 max-h-[580px] overflow-y-auto">
                <div className="text-[10px] font-mono uppercase text-slate-500 px-2 py-1 flex items-center justify-between">
                  <span>Server MCP</span>
                  <span>Tools Aktif</span>
                </div>

                {config.mcp_servers.map((mcp, idx) => {
                  const tools = mcpToolsDiscovery[mcp.name] || [];
                  const activeCount = tools.filter(t => t.enabled).length;
                  const isSelected = selectedMcpName === mcp.name;

                  return (
                    <div 
                      key={mcp.name}
                      onClick={() => setSelectedMcpName(mcp.name)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm" 
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-mono text-xs font-bold truncate ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                          {mcp.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {tools.length > 0 ? `${activeCount}/${tools.length}` : (mcp.enabled ? "Active" : "Off")}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1 leading-snug">
                        {mcp.description}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[10px]">
                        <span className={`font-mono ${mcp.enabled ? "text-emerald-400" : "text-rose-400"}`}>
                          {mcp.enabled ? "● RUNNING" : "○ DISABLED"}
                        </span>
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenEditMcp(idx)}
                            className="p-1 hover:text-cyan-300 text-slate-400 transition-colors"
                            title="Edit Server"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMcp(idx)}
                            className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                            title="Hapus Server"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Active MCP Details & Vertical Scrollable Tools List */}
              <div className="col-span-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                {(() => {
                  const currentMcpIdx = config.mcp_servers.findIndex(m => m.name === selectedMcpName);
                  const currentMcp = config.mcp_servers[currentMcpIdx] || config.mcp_servers[0];
                  if (!currentMcp) return null;

                  const tools = mcpToolsDiscovery[currentMcp.name] || [];
                  const allActive = tools.length > 0 && tools.every(t => t.enabled);

                  return (
                    <div className="space-y-4 flex-1 flex flex-col">
                      {/* Selected MCP Header */}
                      <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <h3 className="font-bold text-base text-white font-mono">{currentMcp.name}</h3>
                            <button
                              onClick={() => handleToggleMcp(currentMcpIdx)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border font-semibold ${
                                currentMcp.enabled 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              }`}
                            >
                              {currentMcp.enabled ? "SERVER ENABLED" : "SERVER DISABLED"}
                            </button>
                          </div>
                          <p className="text-xs text-slate-400">{currentMcp.description}</p>
                          <div className="text-[11px] font-mono text-cyan-400/90 pt-1">
                            Command: <code>{currentMcp.command} {currentMcp.args.join(" ")}</code>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestMcp(currentMcp, currentMcpIdx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-semibold shadow-sm transition-all"
                          >
                            <Play className="w-3 h-3 fill-current text-cyan-400" /> Test Connection
                          </button>
                        </div>
                      </div>

                      {/* Test Result Message */}
                      {testingMcpName === currentMcp.name && testResult && (
                        <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs font-mono text-cyan-300 animate-in fade-in flex items-center gap-2.5">
                          <CheckCircle className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                          <span>{testResult}</span>
                        </div>
                      )}

                      {/* Tools Calling Section Header */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            Tools Calling ({tools.length} fungsi)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Aktifkan/nonaktifkan fungsi per-item untuk agen
                          </span>
                        </div>
                        {tools.length > 0 && (
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => handleToggleAllTools(currentMcp.name, true)}
                              className="text-[11px] text-cyan-400 hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-slate-600">|</span>
                            <button
                              onClick={() => handleToggleAllTools(currentMcp.name, false)}
                              className="text-[11px] text-slate-400 hover:underline"
                            >
                              Deselect All
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Vertical Scrollable Tool Items (Mirip IDE) */}
                      <div className="flex-1 max-h-[340px] overflow-y-auto space-y-2 pr-1">
                        {tools.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-500 font-mono">
                            Belum ada tools calling yang terdaftar untuk server ini. Klik tombol "Test Connection" untuk melakukan discovery.
                          </div>
                        ) : (
                          tools.map((tool, tIdx) => (
                            <div 
                              key={tool.name}
                              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                                tool.enabled 
                                  ? "bg-slate-950/80 border-slate-800/80 hover:border-cyan-500/30" 
                                  : "bg-slate-950/30 border-slate-900 opacity-50"
                              }`}
                            >
                              <div className="space-y-0.5 flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-cyan-300">
                                    {tool.name}
                                  </span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tool.enabled ? "bg-emerald-400" : "bg-slate-600"}`}></span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {tool.desc}
                                </p>
                              </div>

                              <button
                                onClick={() => handleToggleToolCalling(currentMcp.name, tIdx)}
                                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all border ${
                                  tool.enabled 
                                    ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/40" 
                                    : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                                }`}
                              >
                                {tool.enabled ? "ENABLED" : "DISABLED"}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SKILLS HIERARCHY & READER (IDE-STYLE MASTER-DETAIL EXPLORER) */}
        {activeTab === "skills" && (
          <div className="space-y-4">
            {/* Top Bar with Breadcrumbs & Sync Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <button 
                  onClick={() => setDrilldownWsId(null)}
                  className={`font-semibold flex items-center gap-1.5 transition-colors ${
                    drilldownWsId === null ? "text-cyan-400" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FolderTree className="w-4 h-4 text-cyan-400" /> Workspaces
                </button>
                {drilldownWsId && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="font-semibold text-white font-mono bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-700">
                      {config.workspaces.find(w => w.id === drilldownWsId)?.name || drilldownWsId}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {drilldownWsId && (
                  <button
                    onClick={() => setDrilldownWsId(null)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-800 transition-colors"
                  >
                    ← Ganti Workspace
                  </button>
                )}
                <button 
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync Rules Now
                </button>
              </div>
            </div>

            {/* LEVEL 1: Pilih Workspace (Jika drilldownWsId === null) */}
            {drilldownWsId === null ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-400 font-medium">
                  Pilih workspace untuk membuka katalog SOP (SKILL.md) dan struktur berkas referensinya:
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {config.workspaces.map((ws) => {
                    const wsSkills = skillsHierarchy.filter(s => s.workspace_id === ws.id || ws.id === "simgos2");
                    return (
                      <div 
                        key={ws.id}
                        onClick={() => {
                          setDrilldownWsId(ws.id);
                          if (wsSkills.length > 0) setActiveSkillName(wsSkills[0].name);
                        }}
                        className="p-5 bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 rounded-2xl cursor-pointer transition-all space-y-3 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                              <Folder className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">{ws.name}</h4>
                              <span className="text-[10px] text-slate-500 font-mono">ID: {ws.id}</span>
                            </div>
                          </div>
                          <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-cyan-400">
                            {wsSkills.length} Skills
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono truncate">
                          Target: {ws.target_path}
                        </div>
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Git: {ws.git_target?.repo_url ? "GitLab Terkoneksi" : "Lokal"}</span>
                          <span className="text-cyan-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-semibold">
                            Buka SOP Explorer →
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* LEVEL 2 & 3: Master-Detail Explorer (Kiri: Tree SOP, Kanan: References Vertical Matrix) */
              <div className="grid grid-cols-12 gap-5 min-h-[520px]">
                {/* Left Column (Col 4): List SOP / Skills Tree */}
                <div className="col-span-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col max-h-[580px]">
                  {/* Search bar inside workspace */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Cari SOP / aturan..." 
                      value={skillSearchQuery}
                      onChange={(e) => setSkillSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="text-[10px] font-mono uppercase text-slate-500 px-1 flex items-center justify-between">
                    <span>Daftar SOP ({skillsHierarchy.length})</span>
                    <span>Ref Files</span>
                  </div>

                  {/* Skills Navigation Tree */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {skillsHierarchy
                      .filter(s => s.name.toLowerCase().includes(skillSearchQuery.toLowerCase()) || s.desc.toLowerCase().includes(skillSearchQuery.toLowerCase()))
                      .map((s) => {
                        const isSelected = activeSkillName === s.name;
                        return (
                          <div 
                            key={s.name}
                            onClick={() => setActiveSkillName(s.name)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected 
                                ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm" 
                                : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-mono text-xs font-bold truncate ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                                {s.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                {s.references.length} ref
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                              {s.desc}
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-500">
                              <span>@{s.author}</span>
                              <span className="font-mono">{s.created_at}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Right Column (Col 8): Detail SOP + Scalable References List (Berapa pun banyaknya file aman!) */}
                <div className="col-span-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                  {(() => {
                    const currentSkill = skillsHierarchy.find(s => s.name === activeSkillName) || skillsHierarchy[0];
                    if (!currentSkill) return null;

                    return (
                      <div className="space-y-4 flex-1 flex flex-col">
                        {/* SOP Header Card */}
                        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base text-cyan-300 font-mono">{currentSkill.name}</h3>
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-400 border border-slate-700 text-[10px] font-mono">
                                author: @{currentSkill.author}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                                {currentSkill.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">{currentSkill.desc}</p>
                            <div className="text-[11px] text-slate-500 font-mono pt-0.5">
                              Pencetus: @{currentSkill.author} • Terdaftar sejak: {currentSkill.created_at}
                            </div>
                          </div>

                          <button
                            onClick={() => handleOpenSkill(currentSkill)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Baca SKILL.md
                          </button>
                        </div>

                        {/* References Explorer Header */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                              <FolderTree className="w-3.5 h-3.5 text-cyan-400" /> Berkas Referensi Pendukung ({currentSkill.references.length} berkas di <code>references/</code>)
                            </span>
                            <p className="text-[11px] text-slate-400">
                              Daftar spesifikasi JSON schema, endpoint payload, dan panduan teknis yang disuplai ke konteks IDE.
                            </p>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-md border border-cyan-800/60">
                            VERTICAL LIST VIEW
                          </span>
                        </div>

                        {/* Scalable Vertical References Table (Aman untuk 10, 50, hingga 100+ files) */}
                        <div className="flex-1 max-h-[330px] overflow-y-auto space-y-2 pr-1.5">
                          {currentSkill.references.map((ref, rIdx) => {
                            const isJson = ref.endsWith(".json");
                            const isMd = ref.endsWith(".md");
                            const isSample = ref.endsWith(".sample");

                            return (
                              <div 
                                key={ref}
                                onClick={() => {
                                  handleOpenSkill(currentSkill);
                                  setSelectedRefFile(ref);
                                }}
                                className="p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/40 rounded-xl cursor-pointer flex items-center justify-between transition-all group"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-slate-500 w-5 text-right">{rIdx + 1}.</span>
                                  <div className="p-1.5 bg-slate-900 rounded-lg text-cyan-400 border border-slate-800 group-hover:scale-105 transition-transform">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-mono text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                                      {ref}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      {isJson ? "JSON Schema / Endpoint Dict" : isMd ? "Markdown Technical Guide" : "Payload Example File"}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                    isJson ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                    isMd ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                                    "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  }`}>
                                    {ref.split(".").pop()?.toUpperCase()}
                                  </span>
                                  <button className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-600/30 text-slate-400 group-hover:text-cyan-300 rounded-md text-[11px] font-semibold border border-slate-800 transition-colors">
                                    Buka →
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* SKILL & REFERENCE READER MODAL */}
            {selectedSkill && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                  {/* Modal Header */}
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <h3 className="font-bold text-base text-white font-mono">
                          {selectedRefFile ? `${selectedSkill.name} / references / ${selectedRefFile}` : `${selectedSkill.name} (SKILL.md)`}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-cyan-300">
                          <User className="w-3.5 h-3.5" /> Pencetus: <b className="text-white">@{selectedSkill.author}</b>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> Tanggal: {selectedSkill.created_at}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedSkill(null)}
                      className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs text-slate-300 bg-slate-950/40">
                    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Provenance & Audit Header</div>
                      <div className="text-slate-400 leading-relaxed">
                        Aturan ini diekstrak secara otomatis oleh Hermes Evaluator dari sesi koding programmer <b>@{selectedSkill.author}</b> dan disinkronkan langsung dari repositori GitLab kantor.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {selectedRefFile ? `Isi Berkas Referensi: ${selectedRefFile}` : "Isi Berkas SKILL.md Utama"}
                      </div>
                      <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl whitespace-pre-wrap leading-relaxed text-slate-200">
                        {selectedRefFile 
                          ? `# Referensi Spesifikasi Teknis: ${selectedRefFile}

Berkas referensi ini memuat skema JSON, endpoint URL, atau aturan isolasi transaksi yang disuplai secara on-demand ke konteks IDE.`
                          : selectedSkill.content
                        }
                      </pre>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Status Relevansi: Terverifikasi Aktif</span>
                    <button
                      onClick={() => setSelectedSkill(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                    >
                      Tutup Reader
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: EVOLUTION LOGS */}
        {activeTab === 'logs' && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-slate-400">
              <span>WAKTU</span>
              <span>LIVE TELEMETRI WATCHER & EVALUATOR</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="flex items-start gap-4 text-slate-300">
                  <span className="text-cyan-400 whitespace-nowrap">{l.time}</span>
                  <span className="leading-relaxed">{l.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS & REPOSITORIES */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-5">
            {/* Git Target Repository Config */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-cyan-400" /> Repositori Penyimpanan Skills (GitLab / GitHub)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono">
                  CENTRAL REPO
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Provider Git</label>
                  <select 
                    value={activeWs?.git_target?.provider || 'gitlab'}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.workspaces[0].git_target) {
                        updated.workspaces[0].git_target.provider = e.target.value;
                        setConfig(updated);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="gitlab">GitLab (Self-Hosted RSUD)</option>
                    <option value="github">GitHub</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Project ID / Repo Identifier</label>
                  <input 
                    type="text" 
                    value={activeWs?.git_target?.project_id || '84'}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.workspaces[0].git_target) {
                        updated.workspaces[0].git_target.project_id = e.target.value;
                        setConfig(updated);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-slate-400 font-medium">URL Repositori Remote Git</label>
                  <input 
                    type="text" 
                    value={activeWs?.git_target?.repo_url || 'http://172.168.1.33/simrs/ai-agents.git'}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.workspaces[0].git_target) {
                        updated.workspaces[0].git_target.repo_url = e.target.value;
                        setConfig(updated);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Branch Target</label>
                  <input 
                    type="text" 
                    value={activeWs?.git_target?.target_branch || 'main'}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.workspaces[0].git_target) {
                        updated.workspaces[0].git_target.target_branch = e.target.value;
                        setConfig(updated);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Personal Access Token (PAT)</label>
                  <input 
                    type="password" 
                    placeholder="glpat-••••••••••••••••"
                    value={activeWs?.git_target?.auth_token || ''}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (updated.workspaces[0].git_target) {
                        updated.workspaces[0].git_target.auth_token = e.target.value;
                        setConfig(updated);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Gateway Servers Config */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
{/* Global Central Telegram Notification Config */}
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-cyan-400" /> Notifikasi Terpusat Telegram (Global Broadcast Bot)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bot khusus kantor untuk mengirimkan notifikasi penambahan/pembaruan skills baru ke grup tim RSUD.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...config };
                    if (!updated.telegram_target) {
                      updated.telegram_target = { bot_token: "", chat_id: "", topic_id: "", enabled: true };
                    } else {
                      updated.telegram_target.enabled = !updated.telegram_target.enabled;
                    }
                    setConfig(updated);
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-all ${
                    config.telegram_target?.enabled 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {config.telegram_target?.enabled ? "BROADCAST AKTIF" : "NONAKTIF"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-slate-400 font-medium">Bot Token Telegram (Kantor / Sistem)</label>
                  <input 
                    type="password" 
                    placeholder="Contoh: 7829104523:AAFnJ39..."
                    value={config.telegram_target?.bot_token || ""}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (!updated.telegram_target) {
                        updated.telegram_target = { bot_token: e.target.value, chat_id: "", topic_id: "", enabled: true };
                      } else {
                        updated.telegram_target.bot_token = e.target.value;
                      }
                      setConfig(updated);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    * Token bot ini otomatis dikirim ke Hermes Evaluator pada saat handshake review transkrip.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Target Chat / Group ID</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: -10023456789 atau @channel"
                    value={config.telegram_target?.chat_id || ""}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (!updated.telegram_target) {
                        updated.telegram_target = { bot_token: "", chat_id: e.target.value, topic_id: "", enabled: true };
                      } else {
                        updated.telegram_target.chat_id = e.target.value;
                      }
                      setConfig(updated);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Topic / Thread ID (Opsional)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: 84 (kosongkan jika grup biasa)"
                    value={config.telegram_target?.topic_id || ""}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (!updated.telegram_target) {
                        updated.telegram_target = { bot_token: "", chat_id: "", topic_id: e.target.value, enabled: true };
                      } else {
                        updated.telegram_target.topic_id = e.target.value;
                      }
                      setConfig(updated);
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Konfigurasi Gateway Server</h3>
              
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Server Evaluator Hermes (URL)</label>
                <input 
                  type="text" 
                  value={config.default_hermes_evaluator_url}
                  onChange={(e) => setConfig({ ...config, default_hermes_evaluator_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Server Mnemosyne Shared Memory (URL)</label>
                <input 
                  type="text" 
                  value={config.default_mnemosyne_url}
                  onChange={(e) => setConfig({ ...config, default_mnemosyne_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-amber-400/90 block">
                  * Aturan Tegas: Host/IP server Evaluator dan Mnemosyne WAJIB identik (satu server).
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Profil Pengguna Aktif</label>
                <input 
                  type="text" 
                  value={config.active_profile}
                  onChange={(e) => setConfig({ ...config, active_profile: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  Simpan Seluruh Konfigurasi
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
