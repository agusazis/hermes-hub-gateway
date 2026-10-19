import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2, 
  Plus, Settings, Database, Cpu, Check, AlertCircle, ArrowUpRight
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspaces' | 'skills' | 'logs' | 'settings'>('dashboard');
  
  const [status] = useState({
    status: 'online',
    hermes_server: '172.168.1.202:9125',
    mnemosyne_server: '172.168.1.202:8080',
    active_workspace: 'simgos2',
    total_skills: 12
  });

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Workspaces State
  const [workspaces, setWorkspaces] = useState([
    {
      id: 'simgos2',
      name: 'SIMGOSv2 SIMRS',
      path: 'D:\\7. Project\\SIMGOSv2\\New - php82\\simgos2',
      status: 'Active',
      skills_count: 12,
      profile: 'agus'
    }
  ]);

  // Skills State
  const [skills] = useState([
    { name: 'simgos2-bpjs-vclaim', category: 'simgos2', desc: 'Integrasi BPJS VClaim 2.0 & SEP RSUD Jusuf SK', status: 'Synced' },
    { name: 'simgos2-frontend-extjs', category: 'simgos2', desc: 'SOP Komponen Ext JS 4/6 Modern & Classic', status: 'Synced' },
    { name: 'simgos2-core-blueprint', category: 'simgos2', desc: 'Arsitektur modul core, router, dan model entity', status: 'Synced' },
    { name: 'simgos2-db-audit', category: 'simgos2', desc: 'Audit skema MariaDB & proteksi transaksi farmasi', status: 'Synced' },
    { name: 'git-upstream-sync', category: 'devops', desc: 'Disiplin commit, clean squash, dan PR upstream sync', status: 'Synced' },
    { name: 'server-devops', category: 'devops', desc: 'Operasional VM AlmaLinux, Nginx, PHP-FPM, MariaDB', status: 'Synced' },
    { name: 'synology-dsm-operations', category: 'devops', desc: 'Manajemen GFS backup NAS Synology WebAPI', status: 'Synced' }
  ]);

  // Logs State
  const [logs] = useState([
    { time: '21:54:44', event: 'Task ba0b690f evaluated (2.84s). Lesson learned detected & committed.' },
    { time: '21:45:35', event: 'Transcript review task c14e95bd received from IDE watcher.' },
    { time: '21:38:12', event: 'Hermes Hub Gateway background watcher bound to Brain directory.' },
    { time: '21:00:00', event: 'Unified MCP Bridge listening on \\\\.\\pipe\\hhg-bridge.' }
  ]);

  // Settings State
  const [hermesServer, setHermesServer] = useState('http://172.168.1.202:9125');
  const [mnemosyneServer, setMnemosyneServer] = useState('http://172.168.1.202:8080');
  const [savedSettings, setSavedSettings] = useState(false);

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

  const handleSaveSettings = () => {
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 3000);
  };

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
          <div className="font-mono text-[11px] text-slate-300 truncate">{status.hermes_server}</div>
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
              {activeTab === 'workspaces' && 'Kelola folder koding terisolasi tanpa mengotori project dengan file agent fisik.'}
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
                <div className="text-xl font-bold text-white capitalize">{status.active_workspace}</div>
                <div className="text-[11px] text-cyan-400 font-mono truncate">D:\7. Project\SIMGOSv2\New - php82\simgos2</div>
              </div>

              <div 
                onClick={() => setActiveTab('skills')}
                className="p-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 hover:border-cyan-500/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>Skills Learned</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-xl font-bold text-white">{status.total_skills} Skills</div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Up-to-Date with GitLab main
                </div>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Continuous Loop Bridge</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hermes Hub Gateway berjalan secara background di system tray Windows. Setiap percakapan yang selesai di IDE akan dievaluasi dalam 2–3 detik oleh server evaluator Hermes, dan bila ada koreksi/lesson baru, rules akan langsung ditarik otomatis ke IDE tanpa interupsi.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: WORKSPACES */}
        {activeTab === 'workspaces' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Terdaftar {workspaces.length} Workspace Aktif</span>
              <button 
                onClick={() => alert("Fitur Add Workspace: Cukup pilih direktori folder project target, file AGENTS.md deklaratif akan otomatis dibuat.")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs font-semibold border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Workspace
              </button>
            </div>

            <div className="space-y-3">
              {workspaces.map((ws) => (
                <div key={ws.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{ws.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                        {ws.status}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-slate-400">{ws.path}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-cyan-400 font-semibold">{ws.skills_count} Skills Aktif</span>
                    <div className="text-[10px] text-slate-500">Profile: {ws.profile}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SKILLS REGISTRY */}
        {activeTab === 'skills' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400">Total {skills.length} Aturan & SOP Terdaftar di Sistem:</div>
            <div className="grid grid-cols-2 gap-3">
              {skills.map((s) => (
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
              <span>WAKTU (WITA)</span>
              <span>EVENT TELEMETRI WATCHER</span>
            </div>
            <div className="space-y-2">
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
                  value={hermesServer}
                  onChange={(e) => setHermesServer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Server Mnemosyne Shared Memory (URL)</label>
                <input 
                  type="text" 
                  value={mnemosyneServer}
                  onChange={(e) => setMnemosyneServer(e.target.value)}
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

              {savedSettings && (
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
                  <Check className="w-3.5 h-3.5" /> Konfigurasi berhasil disimpan!
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
