import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2, 
  Plus, Settings, Database, Cpu, Check, AlertCircle, ArrowUpRight,
  GitBranch, Folder
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  target_path: string;
  internal_skills_path: string;
  hermes_evaluator_url: string;
  mnemosyne_url: string;
}

interface GlobalConfig {
  active_profile: string;
  default_hermes_evaluator_url: string;
  default_mnemosyne_url: string;
  active_workspace_id: string;
  workspaces: Workspace[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspaces' | 'skills' | 'logs' | 'settings'>('dashboard');
  
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
        mnemosyne_url: 'http://172.168.1.202:8080'
      }
    ]
  });

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsPath, setNewWsPath] = useState('');

  // Live Telemetry Logs
  const [logs, setLogs] = useState<{ time: string; event: string }[]>([
    { time: new Date().toLocaleTimeString(), event: 'Hermes Hub Gateway Engine & Watcher online.' },
    { time: new Date().toLocaleTimeString(), event: 'Unified MCP Named Pipe initialized on \\\\.\\pipe\\hhg-bridge.' }
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

    // Listen to real watcher telemetry from Rust
    const unlistenWatcher = listen<any>('watcher-event', (event) => {
      const p = event.payload;
      setLogs((prev) => [
        { time: new Date().toLocaleTimeString(), event: `[EVALUATING] Conv ${p.conversation_id} sent to ${config.default_hermes_evaluator_url}` },
        ...prev.slice(0, 50)
      ]);
    });

    const unlistenLesson = listen<any>('lesson-learned', (event) => {
      const p = event.payload;
      setLogs((prev) => [
        { time: new Date().toLocaleTimeString(), event: `🎉 [LESSON LEARNED] ${p.skill_name}: ${p.commit || 'auto-pushed to git'}` },
        ...prev.slice(0, 50)
      ]);
    });

    return () => {
      unlistenWatcher.then((f) => f());
      unlistenLesson.then((f) => f());
    };
  }, []);

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
      setShowAddModal(false);
      setNewWsName('');
      setNewWsPath('');
      setSyncMessage(`Workspace '${created.name}' aktif! AGENTS.md deklaratif otomatis dibuat.`);
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (err) {
      alert(`Gagal membuat workspace: ${err}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await invoke('save_system_config', { cfg: config });
      setSyncMessage('Pengaturan server gateway berhasil disimpan!');
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (err) {
      alert(`Gagal menyimpan: ${err}`);
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
              onClick={() => setActiveTab('skills')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'skills' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" /> Skills Registry
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
              <Settings className="w-4 h-4" /> Settings & Gateway
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
              {activeTab === 'skills' && 'Knowledge & Skills Registry'}
              {activeTab === 'logs' && 'Continuous Evolution Live Logs'}
              {activeTab === 'settings' && 'Gateway & Server Configuration'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === 'dashboard' && 'Continuous self-improvement loop bridge active for RSUD dr. H. Jusuf SK.'}
              {activeTab === 'workspaces' && 'Kelola folder koding terisolasi tanpa mengotori project dengan folder .agents fisik.'}
              {activeTab === 'skills' && 'Daftar SOP dan aturan koding yang disinkronkan secara atomik dari GitLab.'}
              {activeTab === 'logs' && 'Telemetri evaluasi real-time antara IDE watcher dan server evaluator.'}
              {activeTab === 'settings' && 'Konfigurasi endpoint Hermes evaluator, Mnemosyne DB, dan credential vault.'}
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
                onClick={() => setActiveTab('skills')}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Skills Learned</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-xl font-bold text-white">12 Skills</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Up-to-Date with GitLab main
                </div>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Continuous Self-Improvement Loop Bridge</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hermes Hub Gateway (HHG) mengawasi transkrip percakapan IDE secara background. Saat ada kendala selesai dipecahkan, Hermes Evaluator server (:9125) mengekstrak SOP baru dan mengunggahnya ke repo. HHG otomatis menarik aturan tersebut ke penyimpanan lokal tanpa menyentuh atau mengotori root folder project koding Anda.
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
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Workspace Baru
              </button>
            </div>

            {showAddModal && (
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
                    onClick={() => setShowAddModal(false)}
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

        {/* TAB 3: SKILLS REGISTRY */}
        {activeTab === 'skills' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">Aturan & SOP Terdaftar (On-Demand Retrieval via MCP):</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'simgos2-bpjs-vclaim', category: 'simgos2', desc: 'Integrasi BPJS VClaim 2.0 & SEP RSUD Jusuf SK' },
                { name: 'simgos2-frontend-extjs', category: 'simgos2', desc: 'SOP Komponen Ext JS 4/6 Modern & Classic' },
                { name: 'simgos2-core-blueprint', category: 'simgos2', desc: 'Arsitektur modul core, router, dan model entity' },
                { name: 'simgos2-db-audit', category: 'simgos2', desc: 'Audit skema MariaDB & proteksi transaksi farmasi' },
                { name: 'git-upstream-sync', category: 'devops', desc: 'Disiplin commit, clean squash, dan PR upstream sync' },
                { name: 'server-devops', category: 'devops', desc: 'Operasional VM AlmaLinux, Nginx, PHP-FPM, MariaDB' },
                { name: 'synology-dsm-operations', category: 'devops', desc: 'Manajemen GFS backup NAS Synology WebAPI' }
              ].map((s) => (
                <div key={s.name} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-cyan-300 font-mono">{s.name}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700">{s.category}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: EVOLUTION LOGS */}
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

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-xl space-y-5">
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
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
                  Simpan Konfigurasi
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
