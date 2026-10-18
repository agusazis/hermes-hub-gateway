import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [status] = useState({
    status: 'online',
    hermes_server: '172.168.1.202:9125',
    mnemosyne_server: '172.168.1.202:8080',
    active_workspace: 'simgos2',
    total_skills: 12
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

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

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center font-bold text-cyan-400">
              H
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">Hermes Hub</h1>
              <span className="text-[10px] text-cyan-400 font-mono tracking-wider">GATEWAY v0.1</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-slate-800 text-cyan-400 text-sm font-medium">
              <Server className="w-4 h-4" /> Dashboard
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 text-sm font-medium">
              <FolderKanban className="w-4 h-4" /> Workspaces
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 text-sm font-medium">
              <Shield className="w-4 h-4" /> Skills Registry
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 text-sm font-medium">
              <Terminal className="w-4 h-4" /> Live Evolution Logs
            </button>
          </nav>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Server Evaluator</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="font-mono text-[11px] text-slate-300 truncate">{status.hermes_server}</div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">System Status & Overview</h2>
            <p className="text-sm text-slate-400">Continuous self-improvement loop bridge active.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Rules Now
            </button>
          </div>
        </header>

        {syncMessage && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>{syncMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">Active Workspace</span>
            <div className="text-lg font-bold text-white capitalize">{status.active_workspace}</div>
            <div className="text-[11px] text-cyan-400 font-mono">D:\7. Project\SIMGOSv2\New - php82\simgos2</div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">Skills Learned</span>
            <div className="text-lg font-bold text-white">{status.total_skills} Skills</div>
            <div className="text-[11px] text-emerald-400">Up-to-Date with GitLab main</div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium">Unified MCP Bridge</span>
            <div className="text-lg font-bold text-white">Active (Named Pipe)</div>
            <div className="text-[11px] text-slate-400">Listening on \\.\pipe\hhg-bridge</div>
          </div>
        </div>
      </main>
    </div>
  );
}
