import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2, 
  Plus, Settings, Database, Cpu, Check, AlertCircle, ArrowUpRight,
  GitBranch, Folder, Network, HardDrive, Activity, Power, Layers,
  BookOpen, User, Calendar, ExternalLink, X, FileText, ChevronRight, Edit3, Trash2, Bell, Send, MessageSquare, Bell, Send, MessageSquare,
  GitFork, Key, Globe, FolderTree
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
  const [skillsHierarchy] = useState<SkillHierarchyItem[]>([
    {
      name: 'simgos2-bpjs-vclaim',
      category: 'simgos2',
      author: 'agus',
      created_at: '2026-10-18',
      desc: 'Integrasi BPJS VClaim 2.0, generate signature HMAC-SHA256, dan pembuatan SEP RSUD Jusuf SK',
      references: ['vclaim-v2-spec.md', 'bpjs-error-codes.json', 'sep-create-payload.sample']
    },
    {
      name: 'simgos2-frontend-extjs',
      category: 'simgos2',
      author: 'ardi',
      created_at: '2026-10-17',
      desc: 'Standar penamaan Store, Controller, dan View Ext JS 4/6 Classic tanpa memory leak',
      references: ['extjs-store-lifecycle.md', 'grid-paging-best-practice.md']
    },
    {
      name: 'simgos2-core-blueprint',
      category: 'simgos2',
      author: 'agus',
      created_at: '2026-10-15',
      desc: 'Arsitektur modul backend PHP 8.2 Simgos2, router RESTful, dan audit log transaksi',
      references: ['router-dispatch-contract.md', 'database-transaction-wrapper.md']
    },
    {
      name: 'simgos2-db-audit',
      category: 'simgos2',
      author: 'agus',
      created_at: '2026-10-16',
      desc: 'Proteksi transaksi stok farmasi dan lock baris pesanan resep pasien',
      references: ['mariadb-isolation-levels.md', 'stock-fifo-rules.md']
    },
    {
      name: 'git-upstream-sync',
      category: 'devops',
      author: 'ardi',
      created_at: '2026-10-14',
      desc: 'Prosedur sinkronisasi branch fitur ke remote upstream GitLab SIMRS',
      references: ['squash-merge-checklist.md']
    },
    {
      name: 'server-devops',
      category: 'devops',
      author: 'agus',
      created_at: '2026-10-12',
      desc: 'Manajemen isolasi VM AlmaLinux 9, Nginx upstream socket, dan PHP-FPM pool',
      references: ['nginx-timeout-tuning.conf', 'php-fpm-memory-limit.ini']
    },
    {
      name: 'synology-dsm-operations',
      category: 'devops',
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
      const created: Workspace = await invoke('create_workspace_declarative', {
        name: newWsName,
        targetPath: newWsPath
      });
      setConfig((prev) => ({
        ...prev,
        active_workspace_id: created.id,
        workspaces: [...prev.workspaces, created]
      }));
      setShowAddWsModal(false);
      setNewWsName('');
      setNewWsPath('');
      setSyncMessage(`Workspace '${created.name}' aktif! AGENTS.md deklaratif otomatis dibuat.`);
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (err) {
      alert(`Gagal membuat workspace: ${err}`);
    }
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
              <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Gateway v0.1</span>
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

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div 
                onClick={() => setActiveTab('workspaces')}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Active Workspace</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-xl font-bold text-white capitalize">{activeWs?.name || 'SIMGOSv2'}</div>
                <div className="text-[11px] text-cyan-400 font-mono truncate">{activeWs?.target_path}</div>
              </div>

              <div 
                onClick={() => setActiveTab('mcp_hub')}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Unified MCP Servers</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-xl font-bold text-white">{config.mcp_servers.filter(m => m.enabled).length} Active Tools</div>
                <div className="text-[11px] text-cyan-400 font-mono truncate">DB, Synology, MikroTik, Grafana</div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Unified MCP Bridge</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
                <div className="text-xl font-bold text-white">Active (Named Pipe)</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">\\.\pipe\hhg-bridge</div>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Resilient Desktop & Single-Instance IPC Active</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                  IPC GUARD ENABLED
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi ini dilengkapi <b>Single-Instance Inter-Process Communication</b>. Menutup jendela dengan tanda (X) menjaga watcher tetap aktif di background system tray. Mengklik kembali shortcut aplikasi di desktop tidak akan macet atau membutuhkan <i>End Task</i>, melainkan langsung membawa jendela aktif ke layar depan.
              </p>
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Pendaftaran Workspace Baru (Zero-Pollution)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Nama Workspace / Project</label>
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
                    <label className="text-xs text-slate-400">Direktori Project Target di Laptop</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: D:\7. Project\Billing"
                      value={newWsPath}
                      onChange={(e) => setNewWsPath(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddWsModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Generate AGENTS.md & Simpan
                  </button>
                </div>
              </form>
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

        {/* TAB 3: MCP SERVERS HUB */}
        {activeTab === 'mcp_hub' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Gudang MCP Terpusat ({config.mcp_servers.length} Terdaftar)</span>
              <button 
                onClick={() => setShowAddMcpModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Daftarkan Server MCP Baru
              </button>
            </div>

            {showAddMcpModal && (
              <form onSubmit={handleCreateMcp} className="p-5 bg-slate-900 border border-cyan-500/30 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  {editingMcpIndex !== null ? 'Edit Konfigurasi Server MCP' : 'Daftarkan MCP Server Baru'}
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
                    {editingMcpIndex !== null ? 'Simpan Perubahan' : 'Simpan MCP Server'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {config.mcp_servers.map((mcp, idx) => (
                <div key={mcp.name} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white font-mono">{mcp.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                        mcp.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {mcp.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{mcp.description}</div>
                    <div className="font-mono text-[11px] text-cyan-400/80">Command: {mcp.command} {mcp.args.join(' ')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditMcp(idx)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-all border border-slate-700"
                      title="Edit Command & Parameter MCP"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" /> Edit
                    </button>
                    <button
                      onClick={() => handleToggleMcp(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        mcp.enabled 
                          ? "bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/60" 
                          : "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/60"
                      }`}
                    >
                      {mcp.enabled ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => handleDeleteMcp(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-all"
                      title="Hapus Server MCP"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SKILLS HIERARCHY & READER */}
        {activeTab === 'skills' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-white font-semibold flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-cyan-400" /> Hirarki Skills: Parent & File Referensi Pendukung
                </span>
                <p className="text-[11px] text-slate-400">Setiap skill induk (SKILL.md) dapat memiliki berkas referensi child di subdirektori <code>references/</code>.</p>
              </div>
              <span className="text-xs text-cyan-400 font-mono">Workspace: {config.active_workspace_id}</span>
            </div>

            <div className="space-y-3">
              {skillsHierarchy.map((s) => (
                <div key={s.name} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                  {/* Skill Parent Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-cyan-300 font-mono">{s.name}</span>
                        <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-cyan-400 px-2 py-0.5 rounded-md border border-slate-700">
                          <User className="w-3 h-3" /> Author: @{s.author}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700">
                          {s.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{s.desc}</p>
                    </div>

                    <button
                      onClick={() => handleOpenSkill(s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-all"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Baca SKILL.md
                    </button>
                  </div>

                  {/* Child References Sub-tree */}
                  <div className="pl-4 border-l-2 border-slate-800 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-slate-500 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" /> references/ ({s.references.length} berkas pendukung)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.references.map((ref) => (
                        <div 
                          key={ref}
                          onClick={() => {
                            handleOpenSkill(s);
                            setSelectedRefFile(ref);
                          }}
                          className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-md text-[11px] font-mono text-slate-300 hover:text-cyan-300 cursor-pointer flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="w-3 h-3 text-cyan-400" />
                          <span>{ref}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* SKILL READER MODAL */}
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
                          <User className="w-3.5 h-3.5" /> Pencetus: <b className="text-white">{selectedSkill.author}</b>
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
                        Aturan ini diekstrak secara otomatis oleh Hermes Evaluator dari interaksi koding programmer <b>@{selectedSkill.author}</b> dan disinkronkan langsung dari repositori GitLab kantor.
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {selectedRefFile ? `Isi Berkas Referensi: ${selectedRefFile}` : 'Isi Berkas SKILL.md Utama'}
                      </div>
                      <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl whitespace-pre-wrap leading-relaxed text-slate-200">
                        {selectedRefFile 
                          ? `# Referensi Spesifikasi Teknis: ${selectedRefFile}\n\nBerkas referensi ini memuat skema JSON, endpoint URL, atau aturan isolasi transaksi yang disuplai secara on-demand ke konteks IDE.`
                          : selectedSkill.content
                        }
                      </pre>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Status Relevansi: Terverifikasi Aktif di Workspace {config.active_workspace_id}</span>
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
                      updated.telegram_target = { bot_token: '', chat_id: '', topic_id: '', enabled: true };
                    } else {
                      updated.telegram_target.enabled = !updated.telegram_target.enabled;
                    }
                    setConfig(updated);
                  }}
                  className={config.telegram_target?.enabled ? "px-3 py-1 rounded-full text-[10px] font-mono border transition-all bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "px-3 py-1 rounded-full text-[10px] font-mono border transition-all bg-slate-800 text-slate-400 border-slate-700"}
                >
                  {config.telegram_target?.enabled ? 'BROADCAST AKTIF' : 'NONAKTIF'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs text-slate-400 font-medium">Bot Token Telegram (Kantor / Sistem)</label>
                  <input 
                    type="password" 
                    placeholder="Contoh: 7829104523:AAFnJ39..."
                    value={config.telegram_target?.bot_token || ''}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (!updated.telegram_target) {
                        updated.telegram_target = { bot_token: e.target.value, chat_id: '', topic_id: '', enabled: true };
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
                    value={config.telegram_target?.chat_id || ''}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (!updated.telegram_target) {
                        updated.telegram_target = { bot_token: '', chat_id: e.target.value, topic_id: '', enabled: true };
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
                    value={config.telegram_target?.topic_id || ''}
                    onChange={(e) => {
                      const updated = { ...config };
                      if (!updated.telegram_target) {
                        updated.telegram_target = { bot_token: '', chat_id: '', topic_id: e.target.value, enabled: true };
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
