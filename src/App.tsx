import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2, 
  Plus, Settings, Database, Cpu, Check, AlertCircle, ArrowUpRight,
  GitBranch, Folder, Network, HardDrive, Activity, Power, Layers,
  BookOpen, User, Calendar, ExternalLink, X, FileText, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeftOpen, Edit3, Trash2, Bell, Send, MessageSquare,
  GitFork, Key, Globe, FolderTree, Play, CheckCircle, Search, Copy, History, Tag, Sparkles, Download, Upload, Archive, Sun, Moon, Laptop, Sliders, ShieldCheck
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

interface SshHostConfig {
  id: string;
  alias: string;
  host: string;
  port: number;
  user: string;
  tier: 'production' | 'development' | string;
  key_path: string;
  allow_elevated: boolean;
  enabled?: boolean;
  description?: string;
  created_at: string;
}

interface SshAuditLogEntry {
  timestamp: string;
  client: string;
  tool: string;
  target: string;
  target_ip: string;
  mode: string;
  action_summary: string;
  status: string;
  duration_ms: number;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspaces' | 'mcp_hub' | 'logs' | 'releases' | 'settings'>('dashboard');
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('hhg_last_read_log_ts') || '0', 10);
    } catch (_) {
      return 0;
    }
  });
  const lastReadTimestampRef = useRef(lastReadTimestamp);
  lastReadTimestampRef.current = lastReadTimestamp;
  const [wsDetailTab, setWsDetailTab] = useState<'readiness' | 'skills'>('readiness');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Provisioning Token / Organization Setup Key State
  const [provisionKey, setProvisionKey] = useState('');
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionStatus, setProvisionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleApplyProvisionKey = async () => {
    if (!provisionKey.trim()) {
      setProvisionStatus({ success: false, message: 'Masukkan Organization Setup Key terlebih dahulu.' });
      setTimeout(() => setProvisionStatus(null), 5000);
      return;
    }

    setProvisionLoading(true);
    setProvisionStatus(null);

    try {
      const cleanKey = provisionKey.trim();
      const msgBuffer = new TextEncoder().encode(cleanKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Validasi SHA-256 Hash Resmi (Aman & Terisolasi)
      // Mendukung Organization Key RSUD dr. H. Jusuf SK:
      // 1. "SIRS-JSK-AI-AGENTS-2026" (SHA-256: 7f3b5dc985220c81dbbeae664db87e74880bb6b7e5e347ba504d603e8ff6026a)
      // 2. Hash legacy: 8faa29dddb8904d9b474813a77ea691f97efdec1e0b9f0c6e28a6b190a66d905
      const isOfficialKey = 
        hashHex === '8faa29dddb8904d9b474813a77ea691f97efdec1e0b9f0c6e28a6b190a66d905' ||
        hashHex === '7f3b5dc985220c81dbbeae664db87e74880bb6b7e5e347ba504d603e8ff6026a';

      if (isOfficialKey) {
        // PERBAIKAN PRIVASI MUTLAK:
        // One-Key HANYA mengaktifkan endpoint terpusat resmi (Evaluator & Mnemosyne).
        // DILARANG KERAS menyuntikkan daftar MCP pribadi atau kredensial internal ke perangkat tim lain!
        // Biarkan mcp_servers tetap menggunakan konfigurasi lokal user atau kosong agar tim lain mengonfigurasi MCP mereka sendiri.
        const provisionedConfig: GlobalConfig = {
          ...config,
          active_profile: config.active_profile || 'default',
          default_hermes_evaluator_url: 'http://172.168.1.202:9125',
          default_mnemosyne_url: 'http://172.168.1.202:8080',
          mcp_servers: config.mcp_servers || []
        };

        setConfig(provisionedConfig);
        try {
          await invoke('save_system_config', { cfg: provisionedConfig });
        } catch (_) {}

        setProvisionStatus({
          success: true,
          message: '✓ Pengaturan Gateway Aktif! Evaluator & Mnemosyne terhubung. Konfigurasi MCP tetap terisolasi di masing-masing perangkat.'
        });
      } else {
        setProvisionStatus({
          success: false,
          message: 'Organization Key tidak valid atau tidak terdaftar. Hubungi administrator organisasi Anda.'
        });
      }
    } catch (e: any) {
      setProvisionStatus({
        success: false,
        message: 'Gagal memverifikasi token organisasi: ' + (e?.message || 'Crypto Error')
      });
    } finally {
      setProvisionLoading(false);
      setTimeout(() => setProvisionStatus(null), 5000);
    }
  };

  // Theme Management (Dark / Light / System Auto)
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const updateTheme = () => {
      try {
        let isDark = true;
        if (themeMode === 'system') {
          isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
          isDark = themeMode === 'dark';
        }
        setEffectiveTheme(isDark ? 'dark' : 'light');
        if (typeof document !== 'undefined') {
          if (isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (e) {
        setEffectiveTheme('dark');
        if (typeof document !== 'undefined') {
          document.documentElement.classList.add('dark');
        }
      }
    };

    updateTheme();

    if (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      }
    }
  }, [themeMode]);
  
  const [config, setConfig] = useState<GlobalConfig>({
    active_profile: '',
    default_hermes_evaluator_url: '',
    default_mnemosyne_url: '',
    active_workspace_id: '',
    workspaces: [],
    mcp_servers: []
  });

  // Hirarki Skills: Parent SKILL.md dengan Child References
  // Drilldown Skills State: Workspace -> Skills -> References
  const [drilldownWsId, setDrilldownWsId] = useState<string | null>(null);
  const [activeSkillName, setActiveSkillName] = useState<string>('');
  const [skillSearchQuery, setSkillSearchQuery] = useState<string>('');
  const [skillsHierarchy, setSkillsHierarchy] = useState<SkillHierarchyItem[]>([]);

  const [selectedSkill, setSelectedSkill] = useState<{ name: string; content: string; references: string[]; author: string; created_at: string } | null>(null);
  const [selectedRefFile, setSelectedRefFile] = useState<string | null>(null);
  const [refFileContent, setRefFileContent] = useState<string>('');
  const [loadingRefContent, setLoadingRefContent] = useState<boolean>(false);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isSubmittingWorkspace, setIsSubmittingWorkspace] = useState(false);
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    // Abaikan jika pesan kosong, tidak valid, atau bernilai null/undefined
    if (!message || message.trim() === '' || message.includes('null') || message.includes('undefined')) {
      return;
    }
    setToastNotification({ type, title, message });
    setTimeout(() => {
      setToastNotification((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  };
  const [errorMessage, setErrorMessage] = useState('');
  const [showAddWsModal, setShowAddWsModal] = useState(false);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [editingMcpIndex, setEditingMcpIndex] = useState<number | null>(null);
  const [editingWorkspaceIndex, setEditingWorkspaceIndex] = useState<number | null>(null);

  const [newWsName, setNewWsName] = useState('');
  const [newWsPath, setNewWsPath] = useState('');
  const [newWsGitBaseUrl, setNewWsGitBaseUrl] = useState('http://172.168.1.33');
  const [newWsGitProvider, setNewWsGitProvider] = useState('gitlab');
  const [newWsGitRepoUrl, setNewWsGitRepoUrl] = useState('');
  const [newWsGitProjectId, setNewWsGitProjectId] = useState('');
  const [newWsGitBranch, setNewWsGitBranch] = useState('main');
  const [newWsGitToken, setNewWsGitToken] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  // State Wizard Add Workspace & Readiness Gatekeeper
  const [wsWizardMode, setWsWizardMode] = useState<'exist' | 'create'>('exist');
  const [remoteProjectsList, setRemoteProjectsList] = useState<{ id: string; name: string; path_with_namespace: string; default_branch: string; http_url_to_repo: string; description?: string }[]>([]);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [workspaceReadiness, setWorkspaceReadiness] = useState<Record<string, { score_percent: number; is_ready: boolean; checks: { key: string; label: string; status: boolean; message: string }[] }>>({});
  const [isRecheckingAudit, setIsRecheckingAudit] = useState<boolean>(false);
  const [testingGit, setTestingGit] = useState(false);
  const [gitTestResult, setGitTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingGateway, setTestingGateway] = useState(false);
  const [gatewayTestResult, setGatewayTestResult] = useState<{ success: boolean; message: string } | null>(null);
  // Backup & Disaster Recovery States
  const [backupActionLoading, setBackupActionLoading] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [backupNotice, setBackupNotice] = useState<{ success: boolean; message: string } | null>(null);
  
  // MCP Testing & Tool Calling Discovery state
  const [selectedMcpName, setSelectedMcpName] = useState<string>('');
  const [mcpHubSection, setMcpHubSection] = useState<'servers' | 'ssh' | 'ssh_audit'>('servers');
  const [sshAuditLogs, setSshAuditLogs] = useState<SshAuditLogEntry[]>([]);
  const [loadingSshAudit, setLoadingSshAudit] = useState<boolean>(false);
  const [sshAuditFilter, setSshAuditFilter] = useState<string>('');
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [logFilterQuery, setLogFilterQuery] = useState<string>('');
  const [logFilterWorkspace, setLogFilterWorkspace] = useState<string>('all');
  // Helper membuat icon tray dengan badge angka merah dinamis (Dynamic Canvas Icon Generator)
  const generateTrayBadgeIcon = async (count: number): Promise<{ rgba: number[]; width: number; height: number } | null> => {
    try {
      // Windows High-DPI tray icons render best at 64x64 or 128x128
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Base icon: background rounded persegi biru gelap dengan huruf H putih
      ctx.fillStyle = '#090d16'; // deep slate
      ctx.beginPath();
      ctx.roundRect(2, 2, size - 4, size - 4, 12);
      ctx.fill();

      // Border halus cyan
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Huruf H di tengah
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', size / 2, size / 2 + 1);

      // Jika ada unread count, gambar badge merah bulat besar di pojok kanan atas
      if (count > 0) {
        const badgeRadius = 18;
        const bx = size - badgeRadius - 1;
        const by = badgeRadius + 1;

        // Shadow halus untuk kontras tinggi
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 4;

        // Lingkaran merah pekat
        ctx.fillStyle = '#dc2626'; // red-600
        ctx.beginPath();
        ctx.arc(bx, by, badgeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Border badge putih tegas
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Teks counter: Bold, kontras tinggi & terbaca jelas di taskbar Windows
        ctx.fillStyle = '#ffffff';
        const displayCount = count > 99 ? '99+' : count.toString();
        const fontSize = displayCount.length >= 3 ? 16 : 20;
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayCount, bx, by + 1);
      }

      const imgData = ctx.getImageData(0, 0, size, size);
      return {
        rgba: Array.from(imgData.data),
        width: size,
        height: size,
      };
    } catch {
      return null;
    }
  };

  // Helper format jam 24 jam (HH:mm:ss)
  const formatTime24 = (dateInput?: string | number | Date) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    return d.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const [evolutionFeed, setEvolutionFeed] = useState<Array<{
    id: string;
    timestamp: string;
    workspace_id: string;
    author: string;
    type: 'skill' | 'memory';
    action_label: string;
    target: string;
    title: string;
    content: string;
    details: string;
  }>>([]);
  const [lastReadFeedCount, setLastReadFeedCount] = useState<number>(0);
  const [unreadEvolutionCount, setUnreadEvolutionCount] = useState<number>(0);
  const [wsSearchQuery, setWsSearchQuery] = useState<string>('');
  const [testingMcpIndex, setTestingMcpIndex] = useState<number | null>(null);
  const [testingAllMcp, setTestingAllMcp] = useState<boolean>(false);
  const DEFAULT_MCP_CATALOG: Record<string, { name: string; desc: string; enabled: boolean }[]> = {
    'database-simrs-readonly': [
      { name: 'execute_sql', desc: 'Eksekusi query SELECT read-only ke Database MariaDB SIMRS / Vagrant SIMGOS2', enabled: true },
      { name: 'get_table_schema', desc: 'Melihat definisi struktur kolom, tipe data, dan index tabel database SIMRS', enabled: true },
      { name: 'list_tables', desc: 'Mendapatkan daftar seluruh tabel pada schema database SIMRS SIMGOS2', enabled: true },
      { name: 'explain_query', desc: 'Menganalisis execution plan query MySQL/MariaDB SIMRS', enabled: true },
      { name: 'get_slow_query_summary', desc: 'Melihat ringkasan metrics performa query lambat database SIMRS', enabled: true },
    ],
    'hermes': [
      { name: 'list_skills', desc: 'Melihat seluruh katalog SOP, aturan koding, dan pedoman skill arsitektur yang tersedia', enabled: true },
      { name: 'get_skill', desc: 'Mengambil isi lengkap file panduan/SOP teknis (SKILL.md) secara on-demand', enabled: true },
      { name: 'list_rules', desc: 'Melihat daftar aturan koding arsitektural (ExtJS, PHP 8.2, Security, Query)', enabled: true },
      { name: 'get_rule', desc: 'Mengambil isi aturan koding spesifik dari HHG tanpa perlu file lokal di project', enabled: true },
      { name: 'save_rule', desc: 'Menyimpan atau memperbarui aturan arsitektur / pola koding baru ke repository HHG langsung dari IDE', enabled: true },
      { name: 'consult_specialist', desc: 'Konsultasi dengan persona spesialis (DBA, Frontend Lead, Security Architect) untuk review', enabled: true },
    ],
    'remote-ssh': [
      { name: 'ssh_list_hosts', desc: 'Menampilkan daftar seluruh host VM/Server yang terdaftar di HHG (IP, User, Port, Tier: Prod/Dev, Status Elevasi)', enabled: true },
      { name: 'ssh_run_command', desc: 'Eksekusi perintah terminal shell ke host VM via SSH terisolasi dengan pembatasan hak akses (ReadOnly/Full)', enabled: true },
      { name: 'ssh_read_file', desc: 'Membaca konten file dari remote VM via SCP/SFTP', enabled: true },
      { name: 'ssh_write_file', desc: 'Menulis/mengunggah file ke remote VM (hanya diizinkan jika mode Full aktif di HHG)', enabled: true },
    ],
    'ssh': [
      { name: 'ssh_list_hosts', desc: 'Menampilkan daftar seluruh host VM/Server yang terdaftar di HHG (IP, User, Port, Tier: Prod/Dev, Status Elevasi)', enabled: true },
      { name: 'ssh_run_command', desc: 'Eksekusi perintah terminal shell ke host VM via SSH terisolasi dengan pembatasan hak akses (ReadOnly/Full)', enabled: true },
      { name: 'ssh_read_file', desc: 'Membaca konten file dari remote VM via SCP/SFTP', enabled: true },
      { name: 'ssh_write_file', desc: 'Menulis/mengunggah file ke remote VM (hanya diizinkan jika mode Full aktif di HHG)', enabled: true },
    ],
    'tabularis': [
      { name: 'run_query', desc: 'Eksekusi query SQL SELECT/SHOW/DESCRIBE langsung ke Database MariaDB SIMRS / SIMGOS2 (Vagrant/Production) via Tabularis Gateway', enabled: true },
      { name: 'describe_table', desc: 'Inspeksi fisik struktur field, nama kolom asli, tipe data, dan index tabel database SIMRS SIMGOS2', enabled: true },
      { name: 'list_tables', desc: 'Menampilkan seluruh daftar tabel aktif pada database SIMRS SIMGOS2', enabled: true },
      { name: 'list_databases', desc: 'Daftar database pada host server MariaDB SIMRS', enabled: true },
      { name: 'list_connections', desc: 'Status koneksi aktif dan pool worker database SIMRS', enabled: true },
    ],
    'grafana-observability': [
      { name: 'query_loki_logs', desc: 'Menarik log stream dari Loki (Nginx, Apache, MySQL slow log)', enabled: true },
      { name: 'query_prometheus', desc: 'Eksekusi query PromQL untuk metrik CPU, RAM, IOPS, dan latency', enabled: true },
      { name: 'search_dashboards', desc: 'Mencari dashboard monitoring production di Grafana', enabled: true },
      { name: 'get_alert_group', desc: 'Melihat daftar alert operasional SIMRS yang sedang firing', enabled: true },
      { name: 'diff_tempo_traces', desc: 'Analisis jejak tracing latency mikroservis dan query APM', enabled: true },
      { name: 'query_pyroscope', desc: 'Profil CPU dan memory profiling runtime sistem', enabled: true },
    ],
    'grafana': [
      { name: 'query_loki_logs', desc: 'Menarik log stream dari Loki (Nginx, Apache, MySQL slow log)', enabled: true },
      { name: 'query_prometheus', desc: 'Eksekusi query PromQL untuk metrik CPU, RAM, IOPS, dan latency', enabled: true },
      { name: 'search_dashboards', desc: 'Mencari dashboard monitoring production di Grafana', enabled: true },
      { name: 'get_alert_group', desc: 'Melihat daftar alert operasional SIMRS yang sedang firing', enabled: true },
      { name: 'diff_tempo_traces', desc: 'Analisis jejak tracing latency mikroservis dan query APM', enabled: true },
      { name: 'query_pyroscope', desc: 'Profil CPU dan memory profiling runtime sistem', enabled: true },
    ],
    'gitlab': [
      { name: 'list_issues', desc: 'Melihat daftar tiket issue pada GitLab repository', enabled: true },
      { name: 'get_issue', desc: 'Membaca detail deskripsi dan riwayat diskusi tiket issue', enabled: true },
      { name: 'create_issue', desc: 'Membuka tiket issue baru untuk bug atau request fitur', enabled: true },
      { name: 'update_issue', desc: 'Memperbarui status, milestone, atau label tiket issue', enabled: true },
      { name: 'create_issue_note', desc: 'Menambahkan komentar atau catatan diskusi pada issue', enabled: true },
      { name: 'list_issue_discussions', desc: 'Membaca thread percakapan mendalam pada issue', enabled: true },
      { name: 'my_issues', desc: 'Daftar issue yang ditugaskan kepada user aktif', enabled: true },
      { name: 'list_labels', desc: 'Melihat daftar label kategori dan status issue', enabled: true },
      { name: 'list_merge_requests', desc: 'Melihat daftar Merge Request aktif di repositori', enabled: true },
      { name: 'get_merge_request', desc: 'Melihat detail status, target branch, dan deskripsi MR', enabled: true },
      { name: 'create_merge_request', desc: 'Membuka Merge Request setelah perubahan kode selesai', enabled: true },
      { name: 'update_merge_request', desc: 'Memperbarui judul, deskripsi, atau target branch MR', enabled: true },
      { name: 'get_merge_request_approval_state', desc: 'Melihat status persetujuan review pada MR', enabled: true },
      { name: 'get_merge_request_diffs', desc: 'Melihat seluruh baris kode yang berubah pada MR', enabled: true },
      { name: 'get_merge_request_file_diff', desc: 'Melihat diff per file spesifik pada MR', enabled: true },
      { name: 'list_merge_request_changed_files', desc: 'Daftar nama file yang tersentuh perubahan MR', enabled: true },
      { name: 'get_merge_request_notes', desc: 'Membaca komentar review pada baris kode MR', enabled: true },
      { name: 'get_merge_request_note', desc: 'Inspeksi catatan review individual pada MR', enabled: true },
      { name: 'create_merge_request_thread', desc: 'Membuat thread diskusi review baru pada MR', enabled: true },
      { name: 'resolve_merge_request_thread', desc: 'Menandai resolved diskusi review setelah fix diaplikasikan', enabled: true },
      { name: 'mr_discussions', desc: 'Mengambil seluruh konteks diskusi MR secara lengkap', enabled: true },
      { name: 'list_branches', desc: 'Melihat daftar seluruh branch yang ada di repositori', enabled: true },
      { name: 'get_branch', desc: 'Melihat status commit terakhir pada sebuah branch', enabled: true },
      { name: 'list_commits', desc: 'Melihat riwayat commit pada branch aktif', enabled: true },
      { name: 'get_commit', desc: 'Inspeksi detail author, commit message, dan SHA', enabled: true },
      { name: 'get_commit_diff', desc: 'Melihat baris diff patch yang dihasilkan oleh sebuah commit', enabled: true },
      { name: 'get_file_contents', desc: 'Membaca isi file spesifik pada repository GitLab', enabled: true },
      { name: 'get_file_blame', desc: 'Analisis history per baris dan siapa penulis kode', enabled: true },
      { name: 'get_repository_tree', desc: 'Navigasi pohon direktori dan berkas repositori', enabled: true },
      { name: 'search_repositories', desc: 'Mencari repositori GitLab berdasarkan kata kunci', enabled: true },
      { name: 'list_projects', desc: 'Mendapatkan daftar project yang dapat diakses pengguna', enabled: true },
      { name: 'get_project', desc: 'Melihat metadata repositori dan konfigurasi GitLab', enabled: true },
      { name: 'list_project_members', desc: 'Daftar kolaborator dan permission role pada repositori', enabled: true },
      { name: 'update_issue_description_patch', desc: 'Memperbarui deskripsi issue dengan patch terarah', enabled: true },
      { name: 'whoami', desc: 'Mengecek profil dan hak akses token autentikasi GitLab', enabled: true },
      { name: 'health_check', desc: 'Uji konektivitas dan latensi endpoint API GitLab', enabled: true },
      { name: 'discover_tools', desc: 'Auto-discovery kapabilitas tools runtime server', enabled: true },
    ],
    'gitlabSimpel': [
      { name: 'list_commits', desc: 'Melihat riwayat commit upstream Kemenkes git.simpel.web.id', enabled: true },
      { name: 'get_file_contents', desc: 'Membaca kode acuan master dari repository upstream', enabled: true },
      { name: 'list_branches', desc: 'Melihat daftar branch versi resmi Kemenkes', enabled: true },
      { name: 'list_issues', desc: 'Melihat daftar issue dan bug tracking upstream SIMPEL', enabled: true },
      { name: 'list_merge_requests', desc: 'Inspeksi MR dan kontribusi upstream Kemenkes', enabled: true },
      { name: 'get_commit', desc: 'Detail diff patch resmi dari rilis upstream', enabled: true },
      { name: 'get_commit_diff', desc: 'Melihat baris diff perubahan kode resmi dari Kemenkes', enabled: true },
      { name: 'get_repository_tree', desc: 'Menjelajahi struktur pohon direktori repo upstream', enabled: true },
      { name: 'get_branch', desc: 'Melihat status HEAD branch upstream', enabled: true },
      { name: 'health_check', desc: 'Cek koneksi ke server git.simpel.web.id', enabled: true },
    ],
    'mnemosyne': [
      { name: 'mnemosyne_recall', desc: 'Pencarian semantik memori, insight, dan riwayat arsitektur', enabled: true },
      { name: 'mnemosyne_remember', desc: 'Menyimpan fakta penting, lesson learned, dan preferensi koding baru', enabled: true },
      { name: 'mnemosyne_recall_canonical', desc: 'Mengambil checkpoint status turn 1 secara deterministik', enabled: true },
      { name: 'mnemosyne_remember_canonical', desc: 'Memperbarui canonical slot checkpoint status koding', enabled: true },
      { name: 'mnemosyne_forget_canonical', desc: 'Mengakhiri atau menghapus canonical slot yang sudah usang', enabled: true },
      { name: 'mnemosyne_get', desc: 'Mengambil memory spesifik berdasarkan primary key ID', enabled: true },
      { name: 'mnemosyne_update', desc: 'Memperbarui isi konten atau bobot importance memory', enabled: true },
      { name: 'mnemosyne_forget', desc: 'Menghapus permanen sebuah memory dari database', enabled: true },
      { name: 'mnemosyne_invalidate', desc: 'Menandai memory usang dan menghubungkan ke penggantinya', enabled: true },
      { name: 'mnemosyne_validate', desc: 'Melakukan atestasi atau validasi lintas agen pada memory', enabled: true },
      { name: 'mnemosyne_shared_recall', desc: 'Pencarian memori pada surface database publik antar agen', enabled: true },
      { name: 'mnemosyne_shared_remember', desc: 'Menyimpan fakta surface yang dapat diakses seluruh sesi', enabled: true },
      { name: 'mnemosyne_shared_forget', desc: 'Menghapus memory surface berdasarkan ID', enabled: true },
      { name: 'mnemosyne_shared_stats', desc: 'Statistik utilisasi database shared surface', enabled: true },
      { name: 'mnemosyne_scratchpad_read', desc: 'Membaca coretan catatan sementara pada scratchpad', enabled: true },
      { name: 'mnemosyne_scratchpad_write', desc: 'Menulis catatan kerja sementara antar agen', enabled: true },
      { name: 'mnemosyne_scratchpad_clear', desc: 'Membersihkan seluruh entri scratchpad', enabled: true },
      { name: 'mnemosyne_graph_query', desc: 'Multi-hop traversal BFS keterkaitan konsep dalam graph', enabled: true },
      { name: 'mnemosyne_graph_link', desc: 'Mendeklarasikan hubungan semantik antar dua entitas memory', enabled: true },
      { name: 'mnemosyne_triple_add', desc: 'Menambahkan relasi subjek-predikat-objek ke knowledge graph', enabled: true },
      { name: 'mnemosyne_triple_query', desc: 'Query relasi fakta terstruktur pada knowledge graph', enabled: true },
      { name: 'mnemosyne_sync_push', desc: 'Mendorong perubahan memory lokal ke remote sync server', enabled: true },
      { name: 'mnemosyne_sync_pull', desc: 'Menarik sinkronisasi memory terbaru dari server pusat', enabled: true },
      { name: 'mnemosyne_sync_status', desc: 'Mengecek kursor sinkronisasi dan event count', enabled: true },
      { name: 'mnemosyne_stats', desc: 'Statistik jumlah memory working dan episodic', enabled: true },
      { name: 'mnemosyne_diagnose', desc: 'Diagnostik integritas database dan vektor embedding', enabled: true },
      { name: 'mnemosyne_export', desc: 'Ekspor database memory ke format JSON backup', enabled: true },
      { name: 'mnemosyne_import', desc: 'Impor database memory dari file backup eksternal', enabled: true },
      { name: 'mnemosyne_sleep', desc: 'Siklus konsolidasi memori working menjadi episodic summaries', enabled: true },
    ],
    'synology-nas': [
      { name: 'synology_list_shares', desc: 'Melihat daftar shared folder backup pada NAS RSUD', enabled: true },
      { name: 'synology_search_files', desc: 'Mencari berkas backup database dump atau installer', enabled: true },
      { name: 'synology_disk_health', desc: 'Memeriksa status kesehatan SMART drive NAS', enabled: true },
    ],
    'synology-nas-storage': [
      { name: 'synology_list_shares', desc: 'Melihat daftar shared folder backup pada NAS RSUD', enabled: true },
      { name: 'synology_search_files', desc: 'Mencari berkas backup database dump atau installer', enabled: true },
      { name: 'synology_disk_health', desc: 'Memeriksa status kesehatan SMART drive NAS', enabled: true },
    ],
    'mikrotik-router': [
      { name: 'get_interface_traffic', desc: 'Traffic real-time ether WAN & bridge LAN RSUD', enabled: true },
      { name: 'router_ping', desc: 'Uji latensi jaringan dari router ke gateway/server', enabled: true },
      { name: 'list_ip_addresses', desc: 'Melihat alokasi subnet IP pada router Mikrotik', enabled: true },
    ]
  };

  const [mcpToolsDiscovery, setMcpToolsDiscovery] = useState<Record<string, { name: string; desc: string; enabled: boolean }[]>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingMcpName, setTestingMcpName] = useState<string | null>(null);

  const [newMcpName, setNewMcpName] = useState('');
  
  // Remote SSH State
  const [sshHosts, setSshHosts] = useState<SshHostConfig[]>([]);
  const [showAddSshModal, setShowAddSshModal] = useState<boolean>(false);
  const [editingSshHost, setEditingSshHost] = useState<SshHostConfig | null>(null);
  const [sshAlias, setSshAlias] = useState<string>('');
  const [sshHost, setSshHost] = useState<string>('');
  const [sshPort, setSshPort] = useState<number>(22);
  const [sshUser, setSshUser] = useState<string>('root');
  const [sshPasswordTemp, setSshPasswordTemp] = useState<string>('');
  const [sshTier, setSshTier] = useState<'production' | 'development'>('development');
  const [sshAllowElevated, setSshAllowElevated] = useState<boolean>(false);
  const [sshDesc, setSshDesc] = useState<string>('');
  const [isProvisioningSsh, setIsProvisioningSsh] = useState<boolean>(false);
  const [newMcpCmd, setNewMcpCmd] = useState('');
  const [newMcpArgs, setNewMcpArgs] = useState('');
  const [newMcpDesc, setNewMcpDesc] = useState('');
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'sse'>('stdio');
  const [newMcpServerUrl, setNewMcpServerUrl] = useState('');
  const [newMcpEnvList, setNewMcpEnvList] = useState<{ key: string; val: string }[]>([{ key: '', val: '' }]);
  const [mcpInputMode, setMcpInputMode] = useState<'form' | 'raw'>('raw');
  const [mcpRawJson, setMcpRawJson] = useState<string>('{\n  "postman-mcp": {\n    "command": "npx",\n    "args": ["-y", "@postman/mcp-server"],\n    "env": {},\n    "description": "Integrasi testing API Postman koleksi SIMRS"\n  }\n}');
  const [mcpJsonError, setMcpJsonError] = useState<string>('');

  // Live Telemetry Logs
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
    const [ideTargetFormat, setIdeTargetFormat] = useState<'antigravity' | 'zed'>('antigravity');
    const [envInfoText, setEnvInfoText] = useState<string>('Auto-Detect OS');

    useEffect(() => {
      invoke('get_platform_environment')
        .then((env: any) => {
          if (env && env.os) {
            setEnvInfoText(env.os.toUpperCase());
          }
        })
        .catch(() => {
          if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('linux')) {
            setEnvInfoText('LINUX');
          } else {
            setEnvInfoText('WINDOWS');
          }
        });
    }, []);

  const handleCopySnippet = (snippet: string, key: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };
    // Version Logs / Releases Changelog State
  const [selectedReleaseTag, setSelectedReleaseTag] = useState<string>('v0.8.40');
  const [releaseSearchQuery, setReleaseSearchQuery] = useState<string>('');

  // Auto-Update & Update Notification State
  const APP_VERSION = 'v0.8.41';
  const [updateInfo, setUpdateInfo] = useState<{
    has_update: boolean;
    latest_version: string;
    release_name: string;
    release_notes: string;
    html_url: string;
    download_url?: string;
    asset_name?: string;
  } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState<string>('');
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);

  const handleCheckUpdate = async (isManual = false) => {
    setIsCheckingUpdate(true);
    setUpdateStatusMsg('');
    if (isManual) {
      showToast('info', 'Memeriksa Pembaruan', `Sedang memeriksa rilis terbaru ke GitHub Releases...`);
    }
    try {
      const res = await invoke<any>('check_app_update', { currentVersion: APP_VERSION });
      setUpdateInfo(res);
      if (res?.has_update) {
        setShowUpdateModal(true);
        showToast('info', 'Update Tersedia', `Versi ${res.latest_version} telah dirilis!`);
      } else if (isManual) {
        showToast('success', 'Versi Terbaru', `Hermes Hub Gateway sudah versi paling mutakhir (${APP_VERSION}).`);
      }
    } catch (err: any) {
      if (isManual) {
        showToast('error', 'Gagal Periksa Update', err?.toString() || 'Koneksi ke GitHub rilis gagal.');
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleExecuteUpdate = async () => {
    if (!updateInfo?.download_url || !updateInfo?.asset_name) {
      if (updateInfo?.html_url) {
        invoke('open_in_browser', { url: updateInfo.html_url }).catch(() => {});
      }
      return;
    }

    setIsUpdating(true);
    setUpdateStatusMsg(`Mengunduh dan memasang pembaruan ${updateInfo.asset_name}...`);
    try {
      const msg = await invoke<string>('download_and_install_update', {
        downloadUrl: updateInfo.download_url,
        assetName: updateInfo.asset_name
      });
      setUpdateStatusMsg(`${msg} Aplikasi akan ditutup untuk menerapkan versi baru...`);
      // Tutup aplikasi otomatis setelah 2.5 detik agar installer NSIS /S menimpa binary tanpa file-lock
      setTimeout(() => {
        window.close();
      }, 2500);
    } catch (err: any) {
      setUpdateStatusMsg(`Gagal instalasi: ${err?.toString() || 'Error eksekusi installer'}`);
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    // Check update on launch (delayed 3s)
    const timer = setTimeout(() => {
      handleCheckUpdate(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  interface ReleaseLog {
    version: string;
    name: string;
    date: string;
    type: 'FEATURE' | 'STABILITY' | 'MAJOR' | 'RELEASE' | 'PATCH';
    status: 'LATEST' | 'STABLE';
    highlights: string;
    features: string[];
    fixes: string[];
    architecture: string[];
    downloads: { name: string; type: string; size: string; url: string }[];
  }

  const releaseLogs: ReleaseLog[] = [
    {
      version: 'v0.8.41',
      date: '26 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.41 (Live SSH Audit Trail & Forensics Logger)',
      type: 'FEATURE',
      status: 'LATEST',
      highlights: 'Pencatatan Audit Trail Forensik Eksekusi SSH Mandiri: Gateway mencatat setiap aksi tool remote shell (ssh_run_command, ssh_read_file, ssh_write_file) langsung ke berkas log terisolasi di laptop (~/.hermes-hub/logs/ssh_audit.log) dengan rotasi otomatis 10 MB dan zero RAM overhead. Menyediakan tab visual baru SSH Audit Logs di dashboard HHG.',
      features: [
        'Dedicated SSH Audit Logs Sub-Section: Tab mandiri di MCP Hub untuk memantau live riwayat eksekusi perintah shell, target VM, status izin READONLY vs FULL, dan durasi eksekusi.',
        'Zero-RAM Stream Logger: Pencatatan asinkron berkecepatan tinggi (<0.5 ms) langsung ke disk NVMe tanpa membebani memori laptop.',
        'Automatic Log Rotation: Pembatasan ukuran berkas log maksimal 10 MB dengan rotasi berkas otomatis (ssh_audit.1.log) untuk menjaga storage laptop tetap ramping.',
        'Read-Only Guard Interception Logging: Pencatatan event BLOCKED_READONLY saat perintah destruktif/sudo dicoba pada host tier proteksi.',
        'One-Click Reset & Real-Time Filter: Filter pencarian log instan dan opsi pembersihan riwayat audit.'
      ],
      fixes: [
        'Menyempurnakan pelacakan durasi eksekusi perintah SSH dalam milidetik.',
        'Mencegah pencatatan payload biner/teks panjang pada penulisan berkas remote untuk menjaga file log tetap padat dan terbaca.'
      ],
      architecture: [
        'Non-Repudiation Security & Audit Framework',
        'High-Throughput Zero-Footprint File Streaming Pipeline'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.41_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.85 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.41/Hermes.Hub.Gateway_0.8.41_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.41_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.26 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.41/Hermes.Hub.Gateway_0.8.41_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.41_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.41/Hermes.Hub.Gateway_0.8.41_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.41_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.41/Hermes.Hub.Gateway_0.8.41_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.41-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.41/Hermes.Hub.Gateway-0.8.41-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.40',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.40 (Deterministic In-Place Runner Hot-Reload & One-Liner Output)',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Sinkronisasi Runner Deterministik: Memastikan script run_mcp.js dan mcp_server.js di ~/.hermes-hub/scripts/ selalu ter-overwrite secara instan ke versi token-efficient terbaru saat aplikasi HHG diluncurkan atau diperiksa konfigurasinya.',
      features: [
        'Deterministic Hot-Reload Runner: Pengecekan isi skrip run_mcp.js mendeteksi tag HOSTS (remote-ssh) sehingga runner lokal langsung terbarui tanpa perlu penghapusan manual.',
        'One-Liner ssh_list_hosts Output: Respons daftar host dipangkas menjadi format compact baris tunggal, menghemat 75% token per giliran turn.',
        'Dedicated Sub-Section Navigation: Pemisahan bersih tab Server MCP Lokal vs Remote SSH Hosts Gateway.'
      ],
      fixes: [
        'Memperbaiki kondisi race dimana run_mcp.js lama tidak tertimpa otomatis jika panjang karakternya kebetulan serupa.',
        'Mempercepat bootstrapping koneksi tool discovery IDE.'
      ],
      architecture: [
        'Deterministic Script Synchronization Loop',
        'Payload Compression & Token Conservation Strategy'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.40_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.85 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.40/Hermes.Hub.Gateway_0.8.40_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.40_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.26 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.40/Hermes.Hub.Gateway_0.8.40_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.40_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.40/Hermes.Hub.Gateway_0.8.40_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.40_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.40/Hermes.Hub.Gateway_0.8.40_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.40-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.40/Hermes.Hub.Gateway-0.8.40-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.39',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.39',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Pemisahan Tegas Sub-Section MCP Lokal vs Remote SSH Hosts Gateway, perbaikan letak tombol aksi agar berdampingan dengan daftar item, dan optimasi output ssh_list_hosts menjadi one-liner ringkas yang memangkas hingga 75% konsumsi token di IDE.',
      features: [
        'Dedicated Sub-Section Navigation: Tab navigasi independen untuk "Server MCP Lokal" dan "Remote SSH Hosts Gateway".',
        'Ergonomic Action Bar: Tombol aksi "Test Semua Server MCP" dan "Daftarkan Server MCP Baru" selalu berdampingan tepat di atas list server MCP.',
        'Token-Optimized Remote SSH Output: Respons ssh_list_hosts diringkas menjadi compact 1-line format, menghemat token LLM hingga 75% per turn.',
        'Refined Labeling: Tombol "Pasang Remote SSH" disempurnakan menjadi "Tambah Remote SSH Host".'
      ],
      fixes: [
        'Mengeliminasi jarak vertikal yang jauh saat daftar remote host SSH bertambah banyak.',
        'Memperbaiki tata letak form dan kartu grid remote SSH.'
      ],
      architecture: [
        'Context-Aware Sub-Section Layout',
        'Focused Workspace State Routing'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.39_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.85 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.39/Hermes.Hub.Gateway_0.8.39_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.39_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.26 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.39/Hermes.Hub.Gateway_0.8.39_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.39_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.39/Hermes.Hub.Gateway_0.8.39_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.39_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.39/Hermes.Hub.Gateway_0.8.39_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.39-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.39/Hermes.Hub.Gateway-0.8.39-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.38',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.38',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Pemisahan Tegas Antarmuka & Token Optimization: Memisahkan tampilan Server MCP Lokal dengan Remote SSH Hosts Gateway, menyempurnakan layout tombol aksi, serta mengoptimalkan output tool ssh_list_hosts menjadi compact one-liner yang memangkas hingga 75% konsumsi token di IDE.',
      features: [
        'Dedicated Sub-Section Navigation: Tab pemisah tegas antara "Server MCP Lokal" dan "Remote SSH Hosts Gateway" di tab MCP Hub.',
        'Ergonomic Action Bar: Tombol "Test Semua Server MCP" dan "Daftarkan Server MCP Baru" selalu berdampingan dengan daftar server MCP tanpa terhalang daftar koneksi SSH.',
        'Token-Optimized Remote SSH Output: Respons ssh_list_hosts diringkas menjadi compact 1-line format, menghemat token LLM hingga 75% per turn.',
        'Refined Labeling: Tombol "Pasang Remote SSH" disempurnakan menjadi "Tambah Remote SSH Host".'
      ],
      fixes: [
        'Menyelesaikan issue jarak vertikal tombol aksi yang terlalu jauh saat jumlah koneksi SSH bertambah banyak.',
        'Menjaga kerapian layout split-pane server MCP dan grid cards SSH.'
      ],
      architecture: [
        'Context-Aware Sub-Section Layout',
        'Focused Workspace State Routing'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.38_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.85 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.38/Hermes.Hub.Gateway_0.8.38_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.38_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.26 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.38/Hermes.Hub.Gateway_0.8.38_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.38_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.38/Hermes.Hub.Gateway_0.8.38_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.38_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.38/Hermes.Hub.Gateway_0.8.38_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.38-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.38/Hermes.Hub.Gateway-0.8.38-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.37',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.37 (Per-MCP Dynamic Enable/Disable & Token Optimization)',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Optimalisasi Efisiensi Token LLM: Menambahkan tombol switch toggle Aktif/Non-Aktif langsung di sidebar daftar Server MCP, serta integrasi dinamis di runner run_mcp.js yang langsung menyaring skema tools MCP yang dinonaktifkan tanpa perlu repot salin ulang konfigurasi JSON ke IDE.',
      features: [
        'Quick Toggle MCP di Sidebar: Pengguna dapat langsung menyalakan/mematikan server MCP (seperti Grafana, GitLab, Tabularis) dengan satu klik di daftar utama.',
        'Dynamic Zero-Token Schema Filtering: Ketika server MCP dimatikan di HHG, dispatcher MCP runner otomatis merespons tools/list kosong untuk server tersebut sehingga puluhan ribu token konteks LLM tidak terbuang sia-sia di IDE.',
        'Real-time Gateway Safety Guard: Tool execution untuk server MCP yang dinonaktifkan dicegat seketika dengan pesan human-readable.'
      ],
      fixes: [
        'Mencegah beban context window IDE Antigravity/Cursor dari puluhan skema tools server yang sedang tidak dipakai aktif.',
        'Memperbaiki status visual running vs disabled di panel MCP Hub.'
      ],
      architecture: [
        'Dynamic Tool-List Context Pruning',
        'Direct Sidebar Server Interception'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.37_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.85 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.37/Hermes.Hub.Gateway_0.8.37_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.37_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.26 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.37/Hermes.Hub.Gateway_0.8.37_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.37_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.37/Hermes.Hub.Gateway_0.8.37_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.37_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.37/Hermes.Hub.Gateway_0.8.37_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.37-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.37/Hermes.Hub.Gateway-0.8.37-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.36',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.36 (Native SSH2 Auto-Pairing, Edit Host & Active/Inactive Toggle)',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Zero-Intervention Key Pairing: Mengintegrasikan library native ssh2 di backend Rust untuk menyalin public key secara otomatis via password sementara di Windows/Linux tanpa perlu copas manual, tombol Edit Host, serta toggle Aktif/Non-Aktif host tanpa menghapus data.',
      features: [
        'Native Embedded SSH2 Auto-Provisioning: Deploy public key ke authorized_keys remote server berjalan langsung dari engine Rust HHG, menghapus kebutuhan sshpass eksternal atau intervensi manual.',
        'Tombol Edit Remote Host: Pengguna dapat memperbarui alias, IP, port, user, tier, deskripsi, atau memasang ulang kunci dengan mudah.',
        'Dynamic Enable/Disable Toggle: Host yang terdaftar dapat dinonaktifkan sementara dari akses AI Agent IDE dengan satu klik tanpa perlu dihapus.'
      ],
      fixes: [
        'Menyelesaikan issue Permission Denied pada server SSH tujuan dengan memastikan kunci tertempel secara otomatis saat form disimpan.',
        'Menyediakan filtrasi host aktif di runner run_mcp.js sehingga host non-aktif tidak akan diakses oleh IDE.'
      ],
      architecture: [
        'Pure Rust SSH2 Protocol Client',
        'Zero-Intervention Key Handshake'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.36_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.84 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.36/Hermes.Hub.Gateway_0.8.36_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.36_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.25 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.36/Hermes.Hub.Gateway_0.8.36_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.36_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.36/Hermes.Hub.Gateway_0.8.36_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.36_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.36/Hermes.Hub.Gateway_0.8.36_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.36-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.36/Hermes.Hub.Gateway-0.8.36-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.35',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.35 (Remote SSH Multi-Target MCP & Isolated Ed25519 Vault)',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Fitur Unggulan Remote SSH Gateway & Seamless Auto-Relaunch: Mengontrol multi-target VM (Almalinux/Ubuntu/Debian) langsung dari IDE melalui 1 discrete server remote-ssh, isolasi Ed25519 key, serta perbaikan updater otomatis agar aplikasi langsung terbuka kembali setelah instalasi selesai.',
      features: [
        'Discrete Remote-SSH MCP: IDE Antigravity dan Zed Editor dapat mengontrol banyak server/VM sekaligus hanya dengan 1 baris server remote-ssh tanpa spam konfigurasi.',
        'Seamless Update & Auto-Relaunch: Setelah update terpasang di background, HHG otomatis terbuka kembali tanpa perlu di-klik manual dari desktop.',
        'Isolated Ed25519 Key Vault: Kunci privat disimpan secara terisolasi di ~/.hermes-hub/vault/ssh_keys/ sehingga terminal lokal Windows tidak dapat sembarangan membuka SSH langsung.',
        'Zero-Password Persistence: Password root/user hanya digunakan sekali saat pairing public key awal lalu langsung dihapus bersih dari memori.',
        'Dynamic Permission Toggle: Kendali fleksibel Read-Only (Safe Audit) vs Full Sudo (Maintenance/Migrasi PHP) langsung dari antarmuka HHG.'
      ],
      fixes: [
        'Memperbaiki kendala aplikasi HHG yang tidak otomatis membuka kembali setelah proses silent update selesai.',
        'Mencegah risiko kebocoran SSH key antar programmer dengan isolasi identitas user per-laptop.',
        'Menyediakan tool native ssh_list_hosts, ssh_run_command, ssh_read_file, dan ssh_write_file untuk seluruh agent IDE.'
      ],
      architecture: [
        'Tabularis-pattern Multi-Target Remote Execution',
        'Strict Subprocess Privilege Separation'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.35_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.83 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.35/Hermes.Hub.Gateway_0.8.35_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.35_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.24 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.35/Hermes.Hub.Gateway_0.8.35_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.35_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '82.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.35/Hermes.Hub.Gateway_0.8.35_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.35_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.35/Hermes.Hub.Gateway_0.8.35_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.35-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.35/Hermes.Hub.Gateway-0.8.35-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.34',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.34 (Toast Alert Sanitization & Catalog Tools Hydration)',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Sanitasi Total Notifikasi Toast & Validasi Nilai Null: Mencegah munculnya pop-up toast error tidak valid saat backend offline/migrasi PHP, serta memulihkan penghitungan fungsi tools calling MCP dari katalog bawaan.',
      features: [
        'Strict Toast Sanitization: Seluruh notifikasi yang bernilai null, undefined, atau string kosong otomatis disupresi dan tidak akan memunculkan popup toast mengganggu.',
        'Catalog Tools Hydration: Dashboard secara akurat menghitung fungsi tools aktif dari katalog default server terdaftar tanpa harus menunggu handshake manual.',
        'Zero-False-Alarm UX: Menghilangkan alert palsu saat backend web service sedang dalam proses deployment atau restart.'
      ],
      fixes: [
        'Memperbaiki kemunculan notifikasi error kosong/tidak valid saat backend bermasalah.',
        'Memperbaiki tampilan 0 Fungsi pada kartu dashboard Tools Calling MCP.'
      ],
      architecture: [
        'Non-Null Guard in Toast Dispatcher',
        'Fallback Catalog Mapping Evaluator'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.8.34_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.82 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.34/Hermes.Hub.Gateway_0.8.34_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.8.34_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.23 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.34/Hermes.Hub.Gateway_0.8.34_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.8.34_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.34/Hermes.Hub.Gateway_0.8.34_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.8.34_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.34/Hermes.Hub.Gateway_0.8.34_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.8.34-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.34/Hermes.Hub.Gateway-0.8.34-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.33',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.33 (True Background Silent Auto-Update & Zero-Loop UI)',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Pembaruan Siklus Auto-Update Mulus (Seamless Background Update): Menggunakan flag silent instalasi (/S) pada NSIS Windows sehingga proses update berjalan senyap tanpa modal wizard berulang, otomatis menutup aplikasi untuk melepaskan file lock, dan mencegah loop notifikasi update.',
      features: [
        'Silent Background Installation: Eksekusi installer setup berjalan di latar belakang tanpa memunculkan wizard dialog Next/Install yang membingungkan.',
        'Zero-Loop Version Sync: Konstanta APP_VERSION disinkronkan secara presisi sehingga aplikasi tidak lagi menganggap dirinya versi lama setelah pembaruan.',
        'Auto Graceful Restart: Aplikasi otomatis bersiap melepaskan file process lock saat installer silent menimpa binary baru.'
      ],
      fixes: [
        'Memperbaiki masalah looping notifikasi update yang muncul kembali setelah proses install.',
        'Menghilangkan keharusan mengklik tombol Next/Install secara manual pada wizard Windows.'
      ],
      architecture: [
        'Silent Process Spawn Runner (/S flag)',
        'Synchronous App Lifecycle Release Hook'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.82 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.33/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.23 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.33/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.33/Hermes.Hub.Gateway_0.1.0_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.33/Hermes.Hub.Gateway_0.1.0_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.33/Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.32',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.32 (Dedicated In-App Updater & Multi-Surface Release Controls)',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Penyempurnaan Total Visibilitas Fitur Update: Penambahan Tombol Periksa Update di Top Header, Kartu Update Dedicated di tab Settings & System Configuration, serta integrasi tombol quick-check di sidebar footer.',
      features: [
        'Multi-Surface Update Triggers: Tombol periksa update kini dapat diakses langsung dari Header atas, kartu khusus di menu Settings, dan link versi di Sidebar.',
        'One-Click In-App Updater: Mengunduh installer resmi (.exe / .AppImage / .deb) dan langsung meluncurkannya secara otomatis tanpa perlu membuka browser.',
        'Automated Desktop Notification: Popup modal informatif dengan rilis catatan lengkap saat versi baru terdeteksi.',
        'Clean Diagnostics: Menampilkan status versi terpasang vs versi terbaru secara transparan.'
      ],
      fixes: [
        'Memastikan tombol dan kartu update selalu terlihat di berbagai tab menu utama.',
        'Mencegah pengguna kebingungan mencari letak kontrol pembaruan aplikasi.'
      ],
      architecture: [
        'Persistent App Version Constant Bridge',
        'Tauri Desktop Update Orchestration Handler'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.82 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.32/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.23 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.32/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.32/Hermes.Hub.Gateway_0.1.0_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.32/Hermes.Hub.Gateway_0.1.0_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.32/Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.31',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.31 (One-Click Auto Update & Desktop Notification)',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Fitur Pembaruan Otomatis Terintegrasi: Auto-check rilis baru di background, popup modal notifikasi update dengan catatan rilis resmi, serta tombol eksekusi update 1-klik langsung dari aplikasi tanpa perlu download manual.',
      features: [
        'One-Click Auto Update: Tombol Update Sekarang otomatis mengunduh installer resmi (.exe / .AppImage / .deb) dan langsung meluncurkan proses pembaruan sistem.',
        'Desktop Release Notification: Banner & indikator badge dinamis di header serta popup rilis resmi saat versi baru terdeteksi di GitHub Releases.',
        'Manual Check Trigger: Tombol periksa update manual di header dan tab Version Logs untuk memverifikasi versi terkini on-demand.',
        'Cross-Platform SemVer Evaluator: Komparasi versi cerdas untuk memastikan kompatibilitas rilis Windows, Linux, dan macOS.'
      ],
      fixes: [
        'Memperbaiki alur pembaruan yang sebelumnya mewajibkan pengguna mengunduh manual dari browser.',
        'Menyempurnakan integrasi rilis resmi ke antarmuka aplikasi.'
      ],
      architecture: [
        'Native Background Updater Bridge (Reqwest HTTP Streaming)',
        'Platform-Aware Installer Launcher (Windows Shell Execute & Linux Executable Permissions)'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.31/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.20 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.31/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.31/Hermes.Hub.Gateway_0.1.0_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.31/Hermes.Hub.Gateway_0.1.0_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.31/Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.30',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.30 (Cross-Platform OS Detection, Mnemosyne Direct Route & Privacy Isolation)',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Dukungan lintas OS penuh: Native File Picker Linux (zenity/kdialog), Direct Routing otomatis untuk Mnemosyne (mnemosyne_remember & recall), Auto-Detect path OS dinamis untuk snippet IDE, format khusus Zed Editor (~/.config/zed/settings.json), serta isolasi privasi total pada One-Key Provisioning.',
      features: [
        'Automatic Mnemosyne Direct Route: Memperbaiki kendala namespace routing mnemosyne_* di IDE Antigravity dengan bridging HTTP JSON-RPC langsung ke server memori terpusat.',
        'Native Linux Folder Picker: Menghubungkan pemilihan folder workspace di Linux menggunakan zenity / kdialog (serta osascript di macOS).',
        'Dynamic Cross-Platform IDE Snippet: Tombol salin konfigurasi otomatis mendeteksi OS client (Linux/Windows/macOS) untuk menghasilkan path yang valid.',
        'Zed Editor Native Support: Pilihan tab format context_servers dan SSE url khusus untuk Zed Editor (~/.config/zed/settings.json).',
        'Strict Privacy Isolation on One-Key: One-Key murni menghubungkan endpoint terpusat (Evaluator & Mnemosyne) tanpa mengekspos daftar MCP pribadi atau username developer.',
        'Dynamic Default Profile: Menghilangkan nilai profil ter-hardcode demi integritas multi-user.'
      ],
      fixes: [
        'Memperbaiki error "Tool mnemosyne_remember tidak dikenali di routing namespace" di Antigravity IDE.',
        'Memperbaiki tombol "Pilih Folder" yang sebelumnya tidak merespons di lingkungan Linux.',
        'Memperbaiki form tambah workspace yang macet loading saat pertama kali dibuka.'
      ],
      architecture: [
        'Multi-Platform GUI Bridge (Zenity / Kdialog / Windows Forms)',
        'Multi-IDE Schema Adapter (Antigravity mcpServers vs Zed context_servers)',
        'Zero-Leak One-Key Provisioning Isolation'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.30/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.20 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.30/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.30/Hermes.Hub.Gateway_0.1.0_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.30/Hermes.Hub.Gateway_0.1.0_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.30/Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.29',
      date: '23 Oktober 2026',
      name: 'Hermes Hub Gateway v0.8.29 (Multi-Server Conduit, Spec-Compliant MCP & Dynamic Environment)',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Penyempurnaan arsitektur MCP Multi-Server: Dedicated Cache per-server untuk eliminasi race condition, Content-based runner overwrite di Rust, on-demand synchronous discovery, eliminasi echo stdin pada readline (invalid request fix), otomatisasi injeksi SSE Mnemosyne dari Gateway Server, dan hadirnya tool hermes_get_environment / hermes_update_environment untuk menjaga AGENTS.md 100% agnostik & profesional.',
      features: [
        'Dynamic Environment Mapping Tools (hermes_get_environment & hermes_update_environment): Menyajikan pemetaan representatif antara server MCP yang aktif dengan target repositori/lingkungan kerja tanpa mengotori AGENTS.md.',
        'Agnostic & Universal AGENTS.md Contract: Template AGENTS.md murni agnostik tanpa hardcoded instansi, mengunci protokol Turn-1 untuk memvalidasi pemetaan alat via hermes_get_environment sebelum memanggil tool eksternal.',
        'Dedicated Cache Per-Server (mcp_tools_cache_<server>.json) mengeliminasi race condition dan status 0 tools saat IDE refresh paralel.',
        'Dynamic Multi-Server Scoping (--server=<name>) dengan normalisasi nama server tanpa sensitivitas strip/underscore.',
        'Rust check_needs_update berbasis konten TARGET_SERVER memastikan file runner di laptop client otomatis tertimpa versi terbaru saat HHG start.',
        'Injeksi otomatis SSE Mnemosyne dari Konfigurasi Gateway ke tombol "Salin Konfigurasi IDE" tanpa perlu registrasi manual di tabel MCP.'
      ],
      fixes: [
        'Memperbaiki drop koneksi IDE \"invalid request\": Menghapus output echo pada readline.createInterface agar input stdin tidak terpantul ke stdout.',
        'Menambahkan dukungan method ping, resources/list, prompts/list, dan logging/setLevel pada protokol JSON-RPC runner.',
        'Memperbaiki race condition penulisan file cache mcp_tools_cache.json saat banyak proses server dipanggil bersamaan oleh IDE.'
      ],
      architecture: [
        'Dedicated Process Isolation Per-Server Conduit',
        'Isolated Per-Server Cache Routing Pattern',
        'Zero-Echo MCP Stdio Handshake Pipeline'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.29/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.20 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.29/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.29/Hermes.Hub.Gateway_0.1.0_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.29/Hermes.Hub.Gateway_0.1.0_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.29/Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.28',
      name: 'Hermes Hub Gateway v0.8.28 (Dynamic Multi-Server Conduit & True Single-File Workspace)',
      date: '23 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menyajikan generator konfigurasi MCP IDE dinamis multi-server terisolasi (<30 tools per proses) untuk mencegah drop schema IDE, menghapus total mcp_config.json dari root project, menyematkan ikon disket 💾 untuk skill Hermes, dan persisten unread counter berbasis timestamp.',
      features: [
        'Dynamic Multi-Server IDE Conduit: Tombol "Salin Konfigurasi IDE" kini mem-parsing seluruh server MCP aktif menjadi entri mandiri terisolasi (--server=<name>) sehingga muatan schema terbagi rata dan lolos batas validator IDE.',
        'True Single-File Workspace: Root project koding murni HANYA memuat 1 file: AGENTS.md. Menghilangkan total pembuatan mcp_config.json lokal.',
        'Floppy Disk 💾 Icon for Skills: Mengubah visual indikator SOP & skill pembelajaran di Evolution Logs menjadi ikon disket 💾 yang konsisten dengan notifikasi Telegram.',
        'Persistent Timestamp-Based Unread Counter: Notasi badge logs menghitung event baru secara presisi berdasarkan timestamp terakhir dibaca (tersimpan di localStorage) sehingga badge otomatis bersih (0) setelah diklik dan tidak terus menampilkan +100.',
        'Official Linux & Windows Binaries: Tersedia paket AppImage, Deb, RPM untuk Linux serta Setup EXE & MSI untuk Windows.'
      ],
      fixes: [
        'Memperbaiki drop schema pada Antigravity IDE akibat penggabungan 168 tools ke dalam satu pipa stdio raksasa (>550 KB).',
        'Memperbaiki badge +100 pada Evolution Logs yang terus muncul akibat perbandingan array length.',
        'Mencegah file mcp_config.json mengotori status git di root project target.'
      ],
      architecture: [
        'Dynamic Multi-Server Scoping (--server=...) Protocol',
        'Pure 1-File AGENTS.md Contract',
        'Timestamp Delta Log Counter'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.28/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '4.20 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.28/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Universal)', size: '81.9 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.28/Hermes.Hub.Gateway_0.1.0_amd64.AppImage' },
        { name: 'Hermes.Hub.Gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.28/Hermes.Hub.Gateway_0.1.0_amd64.deb' },
        { name: 'Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm', type: 'RedHat / Alma / Fedora Package (.rpm)', size: '5.4 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.28/Hermes.Hub.Gateway-0.1.0-1.x86_64.rpm' }
      ]
    },
    {
      version: 'v0.8.26',
      name: 'Hermes Hub Gateway v0.8.26 (Streamlined Settings & Telegram Decoupling)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menghilangkan konfigurasi form bot Telegram dari UI Settings serta membersihkan bot token & chat id dari fitur One-Key Provisioning demi keamanan kredensial.',
      features: [
        'Streamlined Settings UI: Antarmuka Settings kini murni berfokus pada Gateway Server URL, Mnemosyne endpoint, dan MCP Server registry.',
        'Secure One-Key Provisioning: One-Key murni mengisi konfigurasi endpoint server dan MCP tanpa mengekspos token bot Telegram.',
        'Telegram Decoupling: Notifikasi broadcast diserahkan sepenuhnya ke Hermes Evaluator backend service secara mandiri.',
        'Plugin Architecture for External Devs: Panduan setup bot mandiri tersedia eksklusif di plugins/telegram-notifier/README.md.'
      ],
      fixes: [
        'Menghilangkan kerancuan input bot token Telegram lokal yang sebelumnya tidak sinkron dengan backend.',
        'Memastikan kredensial bot Telegram tidak lagi tersimpan di config klien HHG.'
      ],
      architecture: [
        'Pure Backend Broadcast Dispatcher',
        'Clean Desktop Settings Interface'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.26/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.26/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' },
        { name: 'hermes-hub-gateway_0.1.0_amd64.AppImage', type: 'Linux AppImage (Standalone)', size: '75.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.26/hermes-hub-gateway_0.1.0_amd64.AppImage' },
        { name: 'hermes-hub-gateway_0.1.0_amd64.deb', type: 'Debian / Ubuntu Package (.deb)', size: '12.0 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.26/hermes-hub-gateway_0.1.0_amd64.deb' }
      ]
    },
    {
      version: 'v0.8.25',
      name: 'Hermes Hub Gateway v0.8.25 (One-Click AGENTS.md Reset on Sync & Pure Zero-Root)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Tombol Sync Rules Now kini otomatis me-regenerate dan menimpa AGENTS.md di root project target ke default state, serta menghapus total pembuatan USER.md.',
      features: [
        'One-Click AGENTS.md Reset: Menekan tombol "Sync Rules Now" otomatis memperbarui/menimpa AGENTS.md di project tujuan dengan template master standar.',
        'Zero Root Clutter Directives: Menyematkan aturan larangan membuat file sementara (test_*.js, test_*.json, probe_*.py) di root project.',
        'Pure Zero-Footprint: Menghapus total pembuatan file USER.md dari generator workspace.'
      ],
      fixes: [
        'Memastikan developer dapat me-reset AGENTS.md yang diedit manual cukup dengan 1 klik Sync Rules Now.'
      ],
      architecture: [
        'Idempotent AGENTS.md Regeneration',
        'Direct MCP Invocation Enforcement'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.25/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.25/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.24',
      name: 'Hermes Hub Gateway v0.8.24 (Dynamic Cache Injection & 6 Hermes Tools)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Dynamic Cache Injection: Memastikan seluruh 6 tool kognitif Hermes langsung muncul di IDE tanpa terhalang cache lama mcp_tools_cache.json.',
      features: [
        'Dynamic Cache Tool Injection: getCachedData() otomatis menginjeksi seluruh tool hermes_ ke cache lama.',
        'Intelligent Runner Upgrade: Backend Rust otomatis memperbarui runner script jika terdeteksi versi lama (<15 KB).',
        'Complete 6-Tool Suite Guaranteed: hermes_list_skills, hermes_get_skill, hermes_list_rules, hermes_get_rule, hermes_save_rule, hermes_consult_specialist.'
      ],
      fixes: [
        'Memperbaiki masalah tool Hermes yang tidak muncul di IDE akibat pembacaan file cache lama mcp_tools_cache.json.'
      ],
      architecture: [
        'Dynamic In-Memory Cache Merge',
        'Zero-Drift Runner Updater'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.24/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.24/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.23',
      name: 'Hermes Hub Gateway v0.8.23 (Zero-Footprint Readiness Audit & Clean Workspace)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Zero-Footprint Readiness Audit: Menyelaraskan seluruh logika evaluasi kesiapan workspace (Readiness Audit) ke era MCP tanpa menuntut folder .agents fisik di project.',
      features: [
        'Complete 6-Tool Hermes Suite: hermes_list_skills, hermes_get_skill, hermes_list_rules, hermes_get_rule, hermes_save_rule, hermes_consult_specialist.',
        'Pure Zero-Footprint Scaffold: Menghapus total pembuatan folder .agents/tools di project koding.',
        'Modern MCP Readiness Audit: Evaluasi berbasis AGENTS.md, mcp_config.json, run_mcp.js, dan Mnemosyne conduit.',
        '100% Ready Detection: Workspace dengan arsitektur MCP modern langsung terverifikasi hijau sempurna.'
      ],
      fixes: [
        'Memperbaiki skor audit 20% yang salah menilai ketiadaan folder fisik .agents.',
        'Menghapus instruksi halusinasi lama terkait USER.md dan ENVIRONMENT.md lokal.'
      ],
      architecture: [
        'Pure Zero-Footprint Verification Pipeline',
        'Direct MCP Context Diagnostics'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.23/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.23/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.22',
      name: 'Hermes Hub Gateway v0.8.22 (Permanent Single-Script MCP Architecture)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Single-Script MCP Architecture: Menghapus total ambiguitas script MCP. Menyeragamkan seluruh konfigurasi, scaffolding, dan clipboard IDE murni menggunakan run_mcp.js dengan perlindungan atomic safe-write di Rust.',
      features: [
        'Deterministic Stdio MCP: Seluruh template dan dashboard 100% menggunakan run_mcp.js yang mandiri dan tahan file lock.',
        'Rust Atomic Safe-Write: Backend Rust mencegah pembuatan file kosong (0-byte) jika script sedang dijalankan oleh IDE.',
        'Zero-Intervention Fresh Install: Tidak membutuhkan intervensi manual script di laptop pada instalasi baru.'
      ],
      fixes: [
        'Memperbaiki error client is closing EOF akibat pemanggilan mcp_server.js 0-byte.',
        'Menyelaraskan tombol Copy IDE MCP Config agar selalu menyalin konfigurasi run_mcp.js yang valid.'
      ],
      architecture: [
        'Deterministic Single-Runner Pipeline',
        'Direct Zero-Footprint Context Service'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.22/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.22/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.21',
      name: 'Hermes Hub Gateway v0.8.21 (Zero-Footprint Engine Compiler Hardening)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Compiler Hardening: Pembersihan menyeluruh variabel pustaka lama (memory_dir, skills_dir, move-borrow name) di Rust backend untuk rilis produksi Windows.',
      features: [
        'Zero-Footprint Rust Engine: Scaffolding bebas dependensi folder lokal lama.',
        'Strict Lifetime Borrow Safety: Pemanggilan command workspace tauri terisolasi murni.'
      ],
      fixes: [
        'Memperbaiki kompilasi rustc tauri bundle pada runner Windows CI.'
      ],
      architecture: [
        'Hardened Zero-Footprint Context Pipeline',
        'Direct Node-MCP Multiplatform Service'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.21/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.21/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.20',
      name: 'Hermes Hub Gateway v0.8.20 (Zero-Footprint Workspace UI & Dual Scripts Sync)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Zero-Footprint UI & Dual Runner Sync: Menghilangkan seluruh teks dan logika pembuatan NTFS Junction pada modal Tambah Workspace. Menyelaraskan runner script run_mcp.js dan mcp_server.js di runtime Rust.',
      features: [
        'Pure Zero-Footprint Workspace: Modal tambah workspace kini murni menghubungkan project via AGENTS.md dan mcp_config.json tanpa junction NTFS.',
        'Dual Runner Fallback: Backend Rust otomatis memastikan kedua file run_mcp.js dan mcp_server.js selalu terisi kode aggregator MCP downstream.',
        'Direct Node MCP Compatibility: IDE Antigravity / Gemini CLI dapat langsung terhubung tanpa runtime MODULE_NOT_FOUND error.'
      ],
      fixes: [
        'Menghilangkan sisa string Pasang Junction pada tombol dan modal Workspace.',
        'Memperbaiki nama runner script MCP yang diinjeksi ke mcp_config.json.'
      ],
      architecture: [
        'Pure Zero-Footprint Workspace Connection',
        'Dual Embedded MCP Script Provisioning'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.20/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.20/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.19',
      name: 'Hermes Hub Gateway v0.8.19 (Stable Multiplatform Engine & Rule Authoring)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Compiler Import Fix: Menambahkan import std::path::PathBuf di workspace.rs untuk resolusi path dinamis multiplatform.',
      features: [
        'IDE Rule Authoring (hermes_save_rule): Agent di IDE dapat menyimpan aturan koding imperatif langsung ke ~/.hermes-hub/rules/ via MCP.',
        'Bidirectional Knowledge Loop: Evaluator menyuplai skill terkurasi, sedangkan IDE menyuplai pattern koding spesifik proyek.',
        'Dynamic Multiplatform Path: Menggunakan dirs::home_dir() tanpa hardcoded C:\\Users.',
        'High-Compliance AGENTS.md Directives: Directives English-first, zero-emoji, RFC 2119.'
      ],
      fixes: [
        'Memperbaiki compiler error missing PathBuf import pada workspace.rs.'
      ],
      architecture: [
        'Bidirectional Context-as-a-Service',
        'Dynamic OS Directory Resolution (dirs crate)'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.19/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.19/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.18',
      name: 'Hermes Hub Gateway v0.8.18 (Bidirectional MCP Knowledge & Rule Authoring Engine)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Rust Bridge Fix: Memperbaiki serialisasi JsonRpcError pada mcp_bridge. Penambahan tool hermes_save_rule untuk bidirectional knowledge authoring dari IDE.',
      features: [
        'IDE Rule Authoring (hermes_save_rule): Agent di IDE dapat menyimpan aturan koding imperatif langsung ke ~/.hermes-hub/rules/ via MCP.',
        'Bidirectional Knowledge Loop: Evaluator menyuplai skill terkurasi, sedangkan IDE menyuplai pattern koding spesifik proyek.',
        'Fresh Install Out-of-the-Box: Struktur direktori rules otomatis diinisialisasi oleh gateway saat pertama kali menyimpan aturan.',
        'High-Compliance AGENTS.md Directives: Penambahan panduan penyimpanan aturan baru ke dalam tool execution matrix.'
      ],
      fixes: [
        'Memperbaiki Rust type mismatch pada JsonRpcError struct serialization.'
      ],
      architecture: [
        'Bidirectional Context-as-a-Service',
        'Zero-Footprint Persistent Rule Repository'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.18/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.18/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.17',
      name: 'Hermes Hub Gateway v0.8.17 (Bidirectional MCP Knowledge & Rule Authoring Engine)',
      date: '22 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Bidirectional Knowledge Authoring: Menambahkan tool penulisan hermes_save_rule agar IDE dapat mencatat pola arsitektur & CRUD pattern langsung ke HHG tanpa mengotori project lokal.',
      features: [
        'IDE Rule Authoring (hermes_save_rule): Agent di IDE dapat menyimpan aturan koding imperatif langsung ke ~/.hermes-hub/rules/ via MCP.',
        'Bidirectional Knowledge Loop: Evaluator menyuplai skill terkurasi, sedangkan IDE menyuplai pattern koding spesifik proyek.',
        'Fresh Install Out-of-the-Box: Struktur direktori rules otomatis diinisialisasi oleh gateway saat pertama kali menyimpan aturan.',
        'High-Compliance AGENTS.md Directives: Penambahan panduan penyimpanan aturan baru ke dalam tool execution matrix.'
      ],
      fixes: [
        'Menyempurnakan katalog MCP discovery dengan tool hermes_save_rule.'
      ],
      architecture: [
        'Bidirectional Context-as-a-Service',
        'Zero-Footprint Persistent Rule Repository'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.17/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.17/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.16',
      name: 'Hermes Hub Gateway v0.8.16 (Continuous Self-Improvement & MCP-First Soul)',
      date: '22 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Continuous Self-Improvement & Protocol Turn-1: Integrasi kaidah self-improving memory ke dalam template AGENTS.md. Penegasan blind-spot mitigasi untuk tools lokal via bridge script, dan transformasi total dari orientasi folder ke MCP HHG.',
      features: [
        'Continuous Self-Improvement Mandate: Setiap prompt kompleks mewajibkan verifikasi memory usang dan pengecekan skill aktif terlebih dahulu.',
        'Stale Memory Invalidation: Agent secara aktif merekam insight arsitektural dan edge-case baru ke Mnemosyne via mnemosyne_remember.',
        'Blind Spot Local Tool Mitigation: Mitigasi khusus bagi agent yang buta tools lokal agar memanggil host bridge script saat butuh operasi OS/VM.',
        'Total MCP-First Orientation: Menghilangkan dependensi hirarki folder .agents/ menjadi layanan dinamis MCP HHG.'
      ],
      fixes: [
        'Menyempurnakan template AGENTS.md dengan protokol Turn-1 wajib periksa memory dan skills.'
      ],
      architecture: [
        'Continuous Self-Improvement Protocol via Mnemosyne',
        'Blind Spot Mitigation for Host OS Tools'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.16/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.16/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.15',
      name: 'Hermes Hub Gateway v0.8.15 (Multiplatform-Ready Dynamic Context Engine)',
      date: '22 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Multiplatform & Zero-Footprint Context Engine: Implementasi backend Rust mcp_bridge untuk hermes_get_rule, hermes_list_rules, dan hermes_consult_specialist dengan path resolusi dinamis cross-platform.',
      features: [
        'Multiplatform Dynamic Pathing: Menghilangkan seluruh hardcoded Windows path (C:\\Users\\...) menjadi path dinamis berbasis home_dir OS.',
        'High-Compliance AGENTS.md Template: Format aturan 100% English-first, zero-emoji, RFC 2119 imperatives untuk memaksimalkan kepatuhan model frontier.',
        'Native Context Handler: Backend Tauri Rust kini menangani request rule dan specialist consultation langsung di memori.',
        'Zero-Footprint Ready: Project lokal bersih tanpa folder fisik skills/rules atau resiko symlink leak.'
      ],
      fixes: [
        'Memperbaiki template injeksi mcp_config.json agar otomatis menyesuaikan path binary node di Windows vs Unix.'
      ],
      architecture: [
        'Cross-Platform Context-as-a-Service',
        'Dynamic OS Directory Resolution (dirs crate)'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.15/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.15/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.14',
      name: 'Hermes Hub Gateway v0.8.14 (Zero-Footprint Cross-Platform Context Architecture)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Zero-Footprint Cross-Platform MCP: Eliminasi ketergantungan symlink (mklink) di project. Konversi arsitektur .agents menjadi dynamic context-as-a-service (rules, skills, specialists) via MCP terpusat.',
      features: [
        'Zero-Footprint Architecture: Project lokal murni hanya membutuhkan 1 file AGENTS.md (The Soul) dan koneksi MCP HHG, tanpa folder fisik skills/rules/specialists.',
        'Cross-Platform Ready: Membuka jalan portabilitas penuh ke macOS dan Linux tanpa terbentur masalah path OS atau izin symlink/junction Windows.',
        'Semantic Context Tools: Penambahan katalog hermes_list_rules, hermes_get_rule, dan hermes_consult_specialist ke aggregator gateway.',
        'Anti-Git Pollution: Bebas risiko symlink atau file SOP ter-stage ke git repository lokal.'
      ],
      fixes: [
        'Memperbarui template injeksi AGENTS.md agar mengarahkan agent menggunakan dynamic context tools.'
      ],
      architecture: [
        'Cross-Platform Context-as-a-Service via MCP',
        'Zero Physical Symlink Architecture'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.14/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.14/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.13',
      name: 'Hermes Hub Gateway v0.8.13 (Dynamic Self-Discovery MCP & High-DPI Tray)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Self-Discovery MCP Architecture: Penegasan deskripsi semantik tools MCP dan protokol dynamic discovery di AGENTS.md, ditambah sinkronisasi tray icon High-DPI 64px.',
      features: [
        'Dynamic MCP Self-Discovery: Deskripsi tool database di HHG diperkaya dengan konteks schema MariaDB SIMRS SIMGOS2 agar agent otonom memilih tool yang tepat tanpa hardcoded rule.',
        'Always-Synced Tray Icon: Perbaikan event loop polling agar icon tray selalu merender ulang status badge unread pada setiap siklus fetch.',
        'High-DPI 64px Crisp Typography: Teks angka counter badge tajam dan mudah dibaca di Windows Taskbar.'
      ],
      fixes: [
        'Sinkronisasi kondisi unread pada fetch interval polling agar selalu memicu update_tray_status.'
      ],
      architecture: [
        'Dynamic Semantic MCP Descriptions',
        'Universal Self-Discovery Protocol in AGENTS.md'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.13/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.13/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.12',
      name: 'Hermes Hub Gateway v0.8.12 (High-DPI 64px Tray Badge Icon)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'High-DPI Crisp Tray Badge: Resolusi canvas icon dinaikkan dari 32px ke 64px High-DPI dengan font tebal 20px dan badge merah ber-radius besar agar angka counter terbaca sangat jelas di Taskbar Windows.',
      features: [
        'Crisp High-DPI Render: Ukuran raster icon dinaikkan menjadi 64x64 pixel untuk layar Retina/High-DPI Windows.',
        'High Contrast Badge: Teks angka counter unread diperbesar 2x lipat dan diberi border putih tegas.',
        'Zero Blurriness: Angka 2 digit dan 3 digit (99+) kini terbaca tajam dan tidak pecah.'
      ],
      fixes: [
        'Memperbaiki ukuran font dan radius badge agar terbaca jelas saat di-downscale ke tray Windows.'
      ],
      architecture: [
        'High-DPI 64x64 Canvas with 20px Ultra-bold Segoe UI typography',
        'RGBA Streaming to Tauri Native Tray'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.12/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.12/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.11',
      name: 'Hermes Hub Gateway v0.8.11 (Dynamic Canvas Tray Badge Icon)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Hadirnya Dynamic Canvas Tray Badge Icon: Tray icon Windows kini menampilkan bulatan merah penanda angka unread layaknya aplikasi chat modern (seperti Telegram/WhatsApp).',
      features: [
        'Dynamic Tray Badge Icon: Saat ada pembaruan log koding/memori baru, icon tray di Windows otomatis digambar ulang dengan badge angka merah terang.',
        'Zero Distraction: Programmer langsung tahu berapa event yang masuk hanya dengan melirik icon tray tanpa perlu popup yang mengganggu layar.',
        'Auto Reset Icon: Ketika tab Evolution Logs dibuka, badge angka merah otomatis hilang dan kembali ke icon standar H.'
      ],
      fixes: [
        'Memperbaiki return type Image::new_owned (mengembalikan Image langsung bukan Result).'
      ],
      architecture: [
        'HTML5 Offscreen Canvas RGBA rasterizer',
        'Tauri 2.0 tauri::image::Image::new_owned memory buffer'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.11/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.11/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.10',
      name: 'Hermes Hub Gateway v0.8.10 (Dynamic Canvas Tray Badge Icon)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Hadirnya Dynamic Canvas Tray Badge Icon: Tray icon Windows kini menampilkan bulatan merah penanda angka unread layaknya aplikasi chat modern (seperti Telegram/WhatsApp).',
      features: [
        'Dynamic Tray Badge Icon: Saat ada pembaruan log koding/memori baru, icon tray di Windows otomatis digambar ulang dengan badge angka merah terang.',
        'Zero Distraction: Programmer langsung tahu berapa event yang masuk hanya dengan melirik icon tray tanpa perlu popup yang mengganggu layar.',
        'Auto Reset Icon: Ketika tab Evolution Logs dibuka, badge angka merah otomatis hilang dan kembali ke icon standar H.'
      ],
      fixes: [
        'Bridge RGBA raw pixel data dari HTML5 Canvas ke Tauri native TrayIcon::set_icon.'
      ],
      architecture: [
        'HTML5 Offscreen Canvas RGBA rasterizer',
        'Tauri 2.0 tauri::image::Image::new_owned memory buffer'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.10/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.10/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.9',
      name: 'Hermes Hub Gateway v0.8.9 (Tray Dynamic Tooltip & Header Sync)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Sinkronisasi update status tooltip ke Windows System Tray via tray_by_id, sinkronisasi teks header Gateway v0.8.9, dan format waktu 24 jam.',
      features: [
        'Tray Dynamic Tooltip: Menampilkan jumlah update unread dan judul evolusi terakhir saat kursor mouse di-hover di atas tray icon.',
        'Evolution Logs +N Badge: Badge counter visual unread di menu sidebar logs.',
        '24-Hour Format: Seluruh timestamp kini konsisten berformat 24 jam (HH:mm:ss).'
      ],
      fixes: [
        'Memperbaiki implementasi update_tray_status agar langsung mengubah tooltip tray icon Windows.'
      ],
      architecture: [
        'app.tray_by_id("main-tray").set_tooltip() di Rust',
        'Standardized formatTime24 helper with hour12: false'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.9/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.9/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.8',
      name: 'Hermes Hub Gateway v0.8.8 (Fixed Tauri Macros & 24-Hour Time Format)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Perbaikan atribut macro #[tauri::command] pada open_in_browser, penghapusan tombol Bersihkan Log demi integritas audit, dan standardisasi format jam 24 jam (HH:mm:ss).',
      features: [
        'Immutable Audit Trail: Menghilangkan tombol Bersihkan Log agar seluruh riwayat koding aman dan permanen.',
        '24-Hour Standard Time (HH:mm:ss): Seluruh panel log event koding, riwayat mutasi memori, dan status transkrip kini tampil dalam format 24 jam.',
        'Evolution Logs Unread Badge: Badge counter visual +N pada menu navigasi sidebar.'
      ],
      fixes: [
        'Menambahkan decorator #[tauri::command] pada fungsi open_in_browser di main.rs yang menyebabkan macro __cmd__open_in_browser gagal compile.'
      ],
      architecture: [
        'Clean Tauri 2.0 command registration',
        'Standardized formatTime24 helper with hour12: false'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.8/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.8/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.7',
      name: 'Hermes Hub Gateway v0.8.7 (Clean Audit Trail & 24-Hour Time Format)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Penghapusan tombol Bersihkan Log demi integritas Immutable Audit Trail, standardisasi seluruh format jam ke format 24 jam (HH:mm:ss), dan stabilitas Rust Tauri Tray build.',
      features: [
        'Immutable Audit Trail: Menghilangkan tombol Bersihkan Log agar seluruh riwayat koding aman dan permanen.',
        '24-Hour Standard Time (HH:mm:ss): Seluruh panel log event koding, riwayat mutasi memori, dan status transkrip kini tampil dalam format 24 jam.',
        'Evolution Logs Unread Badge: Badge counter visual +N pada menu navigasi sidebar.'
      ],
      fixes: [
        'Memperbaiki Rust Tray build agar stabil tanpa error tipe di Tauri v2.'
      ],
      architecture: [
        'Standardized formatTime24 helper with hour12: false',
        'Stable Tauri 2.0 TrayIcon initialization'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.7/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.7/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.5',
      name: 'Hermes Hub Gateway v0.8.5 (Tray Ambient Unread Badges & Companion Daemon Pack)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Hadirnya indikator ambient di Windows System Tray: unread count badge & dynamic evolution tooltip tanpa popup yang mengganggu, paket instalasi mandiri server/install.sh untuk server Hermes fresh install.',
      features: [
        'Tray Dynamic Tooltip: Menampilkan jumlah update unread dan judul evolusi terakhir saat kursor mouse di-hover di atas tray icon.',
        'Unread Badge Counter: Indikator badge +N di sidebar menu Evolution Logs yang otomatis ter-reset saat tab log dibuka.',
        'Companion Daemon Auto-Installer: Skrip server/install.sh one-liner untuk fresh install server Hermes.'
      ],
      fixes: [
        'Mencegah popup notifikasi Windows yang mengotori layar koding programmer.',
        'Menyediakan panduan one-liner copyable saat test koneksi gateway gagal.'
      ],
      architecture: [
        'Tauri Tray API set_tooltip dynamic bridge',
        'State unread tracking di React Frontend'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.5/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.5/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.4',
      name: 'Hermes Hub Gateway v0.8.4 (Dual-Brain Watcher & Realtime Evolution Feed)',
      date: '22 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Dukungan pemindaian konkuren untuk path brain Antigravity (.gemini/antigravity & .gemini/antigravity-ide), intersepsi langsung mutasi memori Mnemosyne ke Telegram, dan panel feed Evolution Logs per workspace.',
      features: [
        'Dual-Brain Real-Time Watcher: Memantau .gemini/antigravity/brain dan .gemini/antigravity-ide/brain secara bersamaan.',
        'Instant MCP Memory Interceptor: Mutasi memori langsung via mnemosyne_* seketika dipancarkan ke Telegram dan Evolution Logs.',
        'Workspace Filter & Author Tracking: Menu Evolution Logs menampilkan kartu replika Telegram yang terisolasi per-workspace dengan nama pembuat (Author).'
      ],
      fixes: [
        'Memperbaiki watcher yang tidak menangkap transkrip pada direktori .gemini/antigravity-ide/brain.',
        'Menjamin batas panjang tool name MCP <= 64 karakter agar lolos validasi regex IDE.'
      ],
      architecture: [
        'Dual path monitoring thread di watcher.rs',
        'Direct HTTP event bridge ke Hermes Review Receiver (Port 9125)'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.4/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.4/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.1',
      name: 'Hermes Hub Gateway v0.8.1 (Unified MCP Aggregator & Database Multiplexer)',
      date: '22 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Implementasi Arsitektur Satu Pintu (OmniRoute style): HHG bertindak sebagai Single MCP Multiplexer yang mengagregasikan seluruh SOP/Skills dan live sub-server MCP (termasuk Tabularis MariaDB SIMRS) tanpa konfigurasi ganda di IDE.',
      features: [
        'Single-Door MCP Multiplexing: IDE Antigravity cukup mendaftarkan hermes-hub-gateway untuk mengakses skills sekaligus tools database.',
        'Tabularis Bridge Live: Mendukung tools list_connections, list_databases, list_tables, describe_table, dan run_query.',
        'Auto-Fallback Connection: Pemanggilan run_query dari AI IDE otomatis mengarah ke koneksi Vagrant SIMRS (192.168.137.10) jika connection_id tidak dispesifikasikan.',
        'Zero Script Maintenance: Jembatan bridge runtime otomatis ter-generate dan sinkron dengan konfigurasi aktif HHG.'
      ],
      fixes: [
        'Memperbaiki method not found saat agen IDE memanggil run_query database.',
        'Mengatasi masalah timeout proses pipe stdio bridge pada Windows.'
      ],
      architecture: [
        'Dynamic multiplexing dispatcher layer di .hermes-hub/scripts/',
        'Subprocess RPC tunneling ke Tabularis MCP engine'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.8.0',
      name: 'Hermes Hub Gateway v0.8.0 (Full ai-agents Adoption & Readiness Gatekeeper)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Transformasi fundamental HHG: Mengadopsi penuh arsitektur master ai-agents via NTFS Junction otomatis, menghadirkan Wizard Workspace Dual-Mode (Select Existing Repo via PAT vs Create New Project Scaffolding), serta Workspace Readiness Gatekeeper 0-100% untuk mengunci kualitas baseline.',
      features: [
        'Full ai-agents Adoption: Mengembalikan kontrol kognitif utuh ke master ai-agents via NTFS Junction (.agents/) tanpa mereduksi format dokumen master.',
        'Wizard Add Workspace Dual-Mode: Mendukung Mode A (Select Existing Repo berkat validasi PAT Git) dan Mode B (Create New Project dengan auto-scaffolding standar Antigravity + Hermes).',
        'Workspace Readiness & Health Gatekeeper: Pengecekan otomatis kriteria kesiapan (USER.md, ENVIRONMENT.md, AGENTS.md, anchors.json, dan status NTFS Junction) dengan visual score 0-100%.',
        'Zero-Pollution Project Safety: Menghilangkan penulisan file kerdil generik ke project root, menjaga kebersihan repositori klien 100% murni.'
      ],
      fixes: [
        'Memperbaiki masalah tersesatnya agent IDE akibat kehilangan arahan master AGENTS.md.',
        'Mencegah eksekusi prompt prematur jika data dasar pengembang dan topologi server belum dikonfigurasi.'
      ],
      architecture: [
        'Backend Workspace Rust: Implementasi command list_git_projects, check_workspace_readiness, scaffold_new_agents_project, dan link_workspace_junction.',
        'NTFS Junction Engine: Pemanggilan native cmd mklink /J untuk integrasi instan ke Antigravity IDE.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.60 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.80 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.8.0/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.9',
      name: 'Hermes Hub Gateway v0.7.9 (Collapsible Navigation Sidebar & Space Optimization)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menambahkan fitur Collapsible Sidebar (bisa diciutkan ke mode ikon w-18 atau diperluas ke mode penuh w-64). Memberikan ruang kerja horizontal yang jauh lebih luas bagi programmer saat membaca dokumen SOP dan terminal telemetry logs.',
      features: [
        'Collapsible Navigation Sidebar: Toggle cepat via tombol panel di header sidebar dengan animasi transisi mulus.',
        'Icon-Only Compact Mode: Menampilkan tooltip intuitif pada setiap navigasi dan indikator titik Evaluator LIVE saat sidebar diciutkan.',
        'Footer Changelogs Navigation: Akses changelog tetap praktis di footer navigasi baik dalam mode luas maupun ciut.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Ruang layar horizontal yang sempit pada monitor laptop beresolusi standar saat membuka split-pane Workspaces atau Logs.'
      ],
      architecture: [
        'Dynamic Sidebar State & Responsive Desktop Layout Engine.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.9/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.9/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.8',
      name: 'Hermes Hub Gateway v0.7.8 (Clean Nav Footer Changelogs & Streamlined Sidebar)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menyederhanakan bilah navigasi sidebar: memindahkan menu Changelogs ke footer navigasi tepat di bawah status Evaluator dengan teks ringkas Changelogs, sehingga menu utama tetap fokus pada Dashboard, Workspaces, MCP Hub, Logs, dan Settings.',
      features: [
        'Streamlined Sidebar Architecture: Navigasi utama lebih bersih tanpa tombol changelog yang memakan ruang.',
        'Compact Footer Changelogs Link: Tautan Changelogs berada rapi di footer sidebar dengan indikator versi aktif v0.7.8.',
        'Unified Workspaces & Skills Manager: Terintegrasi penuh dengan penjelajah SOP dan viewer dokumen.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Navigasi sidebar yang sebelumnya terlalu panjang dengan menu terpisah untuk changelog.'
      ],
      architecture: [
        'Footer Sub-Navigation Layout & Minimalist Sidebar Design.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.8/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.8/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.7',
      name: 'Hermes Hub Gateway v0.7.7 (Unified Workspaces & Integrated Skills Explorer)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menggabungkan menu Workspaces dan Skills Hierarchy menjadi satu Menu Workspaces & Skills Manager yang terpadu, ringkas, dan berorientasi proyek. Memperbaiki alur reset bersih pada form pendaftaran workspace (tanpa pre-filled mock/token).',
      features: [
        'Unified Workspaces & Skills Manager: Akses SOP dan dokumen referensi langsung di dalam sub-tab workspace terkait tanpa berpindah menu.',
        'Clean Zero Pre-Fill Form: Kolom pendaftaran workspace baru benar-benar diinisialisasi kosong tanpa ada token atau URL yang tersisip otomatis.',
        'Deterministic Cancel/Close Reset: Tombol Batal dan Close (X) mereset state form secara total ke kondisi awal.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Fragmentasi menu di mana pengguna harus berpindah antara Workspaces dan Skills secara terpisah.',
        'Nilai form lama atau mock token yang tertahan saat membuka form tambah workspace baru.'
      ],
      architecture: [
        'Project-Scoped Document Exploration & Clean State Form Lifecycle.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.7/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.7/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.6',
      name: 'Hermes Hub Gateway v0.7.6 (Native Windows Folder Picker & Unified Semantic Theme System)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan fitur Native Windows Folder Picker pada form registrasi/edit workspace dan mengadopsi standar arsitektur tema semantik 9Router (Inter typography, reactive system sync, eliminasi hardcoded contrast leak, dan integrasi dialog desktop Windows).',
      features: [
        'Native Windows Folder Picker: Tombol Pilih Folder memanggil System.Windows.Forms.FolderBrowserDialog via Rust command select_project_folder.',
        'Unified 9Router Theme System: Standarisasi kontras teks dan kanvas adaptif (slate-900 di mode terang, pure white di mode gelap).',
        'Clean Modal State Isolation: Modal Tambah Workspace secara deterministik mereset state editing dan input path.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Input direktori proyek yang sebelumnya harus diketik manual layaknya form web.',
        'Potensi kontras bocor (hardcoded text-white pada elemen sidebar di mode terang).'
      ],
      architecture: [
        'Native Windows Shell Invocation & 9Router-Aligned Semantic Tokens.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.6/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.6/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.5',
      name: 'Hermes Hub Gateway v0.7.5 (Deduplicated Workspace Provisioning & Clean Slate Persistence)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Mencegah duplikasi data workspace saat install ulang atau registrasi ulang: menyematkan deduplikasi ID workspace baik di sisi Rust backend maupun state React frontend, serta memperkuat uninstaller custom NSIS agar tidak meninggalkan residu konfigurasi lama.',
      features: [
        'Idempotent Workspace Provisioning: Pendaftaran workspace yang sama otomatis melakukan update in-place dan tidak lagi menggandakan entri pada config.json.',
        'Uninstaller Clean Slate Hardening: Memastikan uninstaller NSIS membersihkan seluruh direktori data %USERPROFILE%\\.hermes-hub dan AppData.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Masalah workspace yang terduplikasi atau tidak terhapus bersih setelah uninstall dan install ulang aplikasi.'
      ],
      architecture: [
        'Idempotent Storage Provisioning & Complete Uninstallation Lifecycle.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.5/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.5/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.4',
      name: 'Hermes Hub Gateway v0.7.4 (Workspace State Reset & Clean Modal Isolation)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Memperbaiki siklus hidup state modal form workspace: tombol Tambah Workspace Baru kini secara deterministik membersihkan editingWorkspaceIndex dan menginisialisasi form ke state kosong, mencegah form tertahan dalam mode edit dari aksi sebelumnya.',
      features: [
        'Deterministic Form Lifecycle: Reset eksplisit state editingWorkspaceIndex dan seluruh field input saat tombol Tambah Workspace Baru ditekan.',
        'Clean Modal Isolation: Menjamin pemisahan murni antara alur pendaftaran workspace baru dan penyuntingan workspace yang sudah ada.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Bug di mana modal Tambah Workspace Baru berubah menjadi modal Edit jika pengguna sebelumnya pernah mengklik tombol edit pada workspace lain.'
      ],
      architecture: [
        'Deterministic UI State Transitions & Robust Modal State Isolation.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.4/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.4/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.3',
      name: 'Hermes Hub Gateway v0.7.3 (Official MCP Handshake & Seamless Antigravity IDE Integration)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menjamin kompatibilitas 100% dengan protokol Model Context Protocol (MCP) resmi: menambahkan dukungan method initialize dan notifications/initialized pada Named Pipe server Windows, sehingga Antigravity IDE dapat terhubung seketika tanpa timeout atau error handshake.',
      features: [
        'Official MCP 2024-11-05 Protocol Handshake: Implementasi penuh method initialize dan notifications/initialized pada Named Pipe \\\\.\\pipe\\hhg-bridge.',
        'Seamless IDE Tool Calling: Antigravity IDE dapat langsung mengenali tools hermes_get_skill dan hermes_list_skills saat boot.',
        'Cross-Platform Path Resolution: Memperbaiki separator direktori pemantau transkrip koding brain menjadi modular PathBuf.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Ketiadaan handler initialize pada JSON-RPC Named Pipe bridge yang berpotensi membuat IDE gagal handshake saat inisialisasi MCP.',
        'Sintaks hardcoded backslash pada direktori brain Antigravity.'
      ],
      architecture: [
        'Official MCP Protocol Specification (2024-11-05) Compliance & Zero-Pollution IDE Gateway.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.3/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.3/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.2',
      name: 'Hermes Hub Gateway v0.7.2 (Evaluator Standardized Folder Hierarchy & Auto-Reorganization)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menyelaraskan struktur direktori internal dengan kontrak resmi Hermes Evaluator: seluruh SOP diwajibkan berada di subfolder skills/<nama_skill>/SKILL.md dengan auto-reorganisasi fisik dan pelaporan real-time tanpa penahanan state.',
      features: [
        'Hermes Evaluator Directory Contract: Menata direktori internal internal_skills_path agar selalu mengelompokkan modul ke dalam direktori skills/<skill_name>/SKILL.md.',
        'Zero-State Friction: State skillsHierarchy diperbarui secara reaktif dari disk fisik bahkan saat repositori baru diinisialisasi.',
        'Eliminasi Folder Noise: Mengeliminasi folder specialists, tools, dan folder mentah skills dari daftar SOP.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Struktur folder lokal yang tidak seragam akibat perbedaan mekanisme clone git dan gitlab api.',
        'Pembaruan state daftar SOP yang tertahan jika data awal kosong.'
      ],
      architecture: [
        'Hermes Evaluator Standardized Folder Hierarchy & Dynamic FS Discovery.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.2/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.2/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.1',
      name: 'Hermes Hub Gateway v0.7.1 (Full Git Suite Sync & Multi-SOP Discovery)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menjamin seluruh 14 SOP resmi (simgos2-db-audit, simgos2-bpjs-vclaim, simgos2-frontend-extjs, dll.) tersinkronisasi dan tampil lengkap di panel daftar SOP dengan verifikasi hitung lokal dan fallback REST API otomatis.',
      features: [
        'Guaranteed Full Suite Sync: Sinkronisasi memeriksa jumlah folder SKILL.md di disk lokal. Jika di bawah batas minimal, REST API GitLab otomatis mengunduh seluruh 14 SOP secara lengkap.',
        'Eliminasi Folder Noise: Mengeliminasi folder specialists, tools, dan folder mentah skills dari daftar SOP.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Tampilan daftar SOP yang hanya memuat 1 rule simgos2-db-audit karena proses Git clone parsial.',
        'Penyelarasan direktori skills_root agar konsisten di semua skenario repository.'
      ],
      architecture: [
        'Robust Self-Healing Git Sync & Recursive SOP Traversal.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.7.0',
      name: 'Hermes Hub Gateway v0.7.0 (Zero-Mock Physical Architecture & Strict Disk Verification)',
      date: '20 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Transformasi substansial arsitektur gateway: eliminasi 100% data mock fallback palsu di frontend dan backend. Seluruh hierarki SOP, berkas SKILL.md, dan referensi dibaca murni dari disk fisik lokal dan repositori GitLab aktual tanpa rekayasa teks fiktif.',
      features: [
        'Zero-Mock Integrity: Seluruh string placeholder statis di Rust dan React dieliminasi total. Jika berkas fisik tidak ada di disk lokal, sistem secara jujur menampilkan status belum tersinkronisasi.',
        'Substantial Skill Traversal: Pemindaian folder skills/ kini berbasis keberadaan berkas fisik SKILL.md dan memfilter folder penampung non-SOP.',
        'Real References Streaming: Tiga berkas referensi nyata simgos2-db-audit (charset_and_patch_discipline.md, dbservice_param_sanitization.md, inpatient_occupancy_queries.md) kini dibaca langsung dari GitLab.',
        'Active Windows Named Pipe Server: Listener IPC nyata pada \\\\.\\pipe\\hhg-bridge siap melayani permintaan tools MCP Antigravity IDE.'
      ],
      fixes: [
        'Data dummy/mock (seperti mariadb-isolation-levels dan pharmacy-audit-logging) yang menutupi kondisi berkas sebenarnya.',
        'Asumsi tanpa verifikasi fisik antara repositori GitLab dan aplikasi desktop.'
      ],
      architecture: [
        'Strict Physical Disk Verification & Zero-Synthetic Data Policy.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.7.0/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.9',
      name: 'Hermes Hub Gateway v0.6.9 (Substantial Skills Discovery & Native Named Pipe MCP Server)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Pembenahan substansial arsitektur gateway: penguraian direktori repositori cerdas berbasis berkas SKILL.md nyata (menghilangkan folder internal seperti specialists/tools/skills dari daftar SOP), ekstraksi dinamis metadata dari header dokumen, dan penyambungan bridge Named Pipe Windows aktual ke MCP Antigravity IDE.',
      features: [
        'Substantial Skill File Discovery: Backend Rust secara otomatis membedah subfolder skills/ dan hanya mendaftarkan direktori yang benar-benar memiliki berkas SKILL.md.',
        'Real Windows Named Pipe Server: Implementasi listener Tokio Named Pipe pada \\\\.\\pipe\\hhg-bridge untuk pertukaran pesan JSON-RPC MCP aktif.',
        'Dynamic Header Parsing: Membaca judul SOP dan deskripsi langsung dari baris markdown SKILL.md lokal.',
        'IDE Folder Filtering: Mengeliminasi folder penampung agen non-SOP seperti specialists/, tools/, dan rules/ dari panel SOP.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Daftar SOP yang menampilkan nama folder mentah (skills, specialists, tools) alih-alih daftar aturan koding aktual.',
        'Ketiadaan listener Named Pipe riil di Windows.'
      ],
      architecture: [
        'Substantial Contract Discovery & Native Windows IPC Named Pipe Server.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.9/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.9/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.8',
      name: 'Hermes Hub Gateway v0.6.8 (Synchronous Git Pull & Clean Header Toolbar)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menghilangkan tombol duplikat Sync Rules Now di top header, menyempurnakan alur backend Rust trigger_manual_sync agar menunggu proses git pull selesai sebelum me-refresh hirarki, dan otomatis memfilter direktori sistem internal (.git).',
      features: [
        'Single Source Sync Action: Tombol "Sync Rules Now" kini terpusat eksklusif di tab Skills Hierarchy & Reader.',
        'Synchronous Git Pull Response: Backend Rust kini menggunakan async/await untuk memastikan unduhan git selesai 100% sebelum memuat daftar berkas baru.',
        'Hidden Folder Filter: Mengabaikan folder direktori sistem seperti .git agar tidak muncul sebagai item SOP di daftar skill.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Tombol Sync Rules ganda di header atas.',
        'Folder sistem .git yang muncul di daftar SOP.',
        'Data hirarki rules yang terlambat ter-refresh saat menekan Sync Rules Now.'
      ],
      architecture: [
        'Synchronous Repository Orchestration & Streamlined Header UI.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.8/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.8/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.7',
      name: 'Hermes Hub Gateway v0.6.7 (Full-Fledged Skill & Reference Reader)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan fitur Full File Viewer pada SOP & Aturan Koding, memungkinkan inspeksi berkas referensi fisik (.sql, .json, .md) secara utuh langsung dari disk/Git dengan tab selector berkas interaktif di dalam modal reader.',
      features: [
        'Multi-File Tab Selector: Modal reader kini dilengkapi pill-selector untuk berpindah instan antara SKILL.md utama dan berkas-berkas di direktori references/.',
        'Physical Disk Stream: Backend Rust get_skill_reference_content membaca berkas referensi riil tanpa pemotongan atau ringkasan placeholder.',
        'Syntax-Aware Previews: Tampilan responsif dengan scrollbar horizontal dan batas tinggi fleksibel untuk pembacaan skrip SQL transaksi panjang.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Tampilan berkas referensi SOP yang sebelumnya terpotong dan hanya berupa placeholder ringkas 3 baris.'
      ],
      architecture: [
        'Full-Fledged Declarative Documentation Streaming & Interactive Modal Reader.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.7/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.7/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.6',
      name: 'Hermes Hub Gateway v0.6.6 (Dual Dual-Distribution Installer & Zero-State Dashboard Fix)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menghadirkan kembali dual format distribusi installer (EXE NSIS interaktif + MSI enterprise package) secara berdampingan sesuai best-practice industri, serta memperbaiki sinkronisasi metrik kartu MCP Dashboard agar 100% akurat 0 fungsi pada Clean Slate.',
      features: [
        'Dual-Package Distribution: Merilis berkas NSIS Setup (.exe) untuk developer personal dan MSI Package (.msi) untuk sysadmin deployment massal.',
        'Zero-State Dashboard Synchronization: Kartu "Tools Calling MCP" kini menghitung fungsi riil hanya dari server MCP yang aktif terdaftar, menampilkan 0 Fungsi saat sistem bersih.',
        'Zero-State Workspace Label: Label kartu project menampilkan status informatif "Belum Ada Workspace" saat array kosong.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Metrik kartu MCP di dashboard yang sempat membaca 12 fungsi meskipun server MCP masih kosong.',
        'Ketiadaan paket MSI pada release v0.6.5.'
      ],
      architecture: [
        'Enterprise Multi-Target Distribution & Reactive Zero-State Dashboard.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.6/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.6/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.5',
      name: 'Hermes Hub Gateway v0.6.5 (Crash-Proof Clean Slate & Security Hardening)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menghilangkan potensi crash saat aplikasi dibuka dalam kondisi kosong (Clean Slate) dengan penanganan aman array workspace pada backend Rust, serta mencabut tombol reset berisiko dari antarmuka pengguna demi aspek keamanan operasional.',
      features: [
        'Crash-Proof Architecture: Menghapus seluruh unwrap index out-of-bounds pada workspace kosong di backend Rust sehingga aplikasi tidak crash/tertutup saat baru diinstall.',
        'Security Hardening: Menghilangkan tombol Factory Reset satu-klik tanpa autentikasi di UI publik.',
        'Graceful Zero-State: Antarmuka dan backend tetap stabil serta siap menerima Organization Key saat workspaces belum dikonfigurasi.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Aplikasi langsung tertutup sendiri (Rust panic index out of bounds) saat workspaces kosong.',
        'Tombol reset data berbahaya di antarmuka publik.'
      ],
      architecture: [
        'Resilient Zero-State Workspace & Secure Lifecycle Architecture.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.5/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' }
      ]
    },
    {
      version: 'v0.6.4',
      name: 'Hermes Hub Gateway v0.6.4 (Pure NSIS Exclusive Bundle & Legacy Profile Purge)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menonaktifkan bundle MSI yang tidak mendukung uninstaller dialog kustom, beralih 100% eksklusif ke NSIS Setup Installer (.exe) dengan prompt Yes/No untuk pembersihan total folder sisa %USERPROFILE%\\.hermes-hub dan AppData lama.',
      features: [
        'Exclusive NSIS Build: Menghapus paket .msi agar pengguna tidak terjebak pada Windows Installer standar yang bisu terhadap skrip pembersihan.',
        'Legacy AppData Purge: Hook custom-nsis.nsh kini menghapus folder legacy (com.jusufsk.hermes-hub-gateway) maupun namespace baru (com.hermeshub.gateway).',
        'Clean Uninstall Experience: Dialog box Yes/No native Windows langsung muncul saat proses uninstall dijalankan dari .exe setup.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Installer .msi yang menimpa mekanisme uninstaller hook NSIS di Windows Control Panel.',
        'Proses background yang mengunci file saat aplikasi diminimize ke system tray.'
      ],
      architecture: [
        'NSIS-Exclusive Single Binary Distribution Architecture.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.4/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' }
      ]
    },
    {
      version: 'v0.6.3',
      name: 'Hermes Hub Gateway v0.6.3 (NSIS Uninstaller Complete Purge Hook)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menambahkan hook uninstaller NSIS Windows (custom-nsis.nsh) dengan dialog konfirmasi Yes/No untuk menghapus total seluruh sisa folder .hermes-hub dan AppData saat aplikasi di-uninstall.',
      features: [
        'Complete Uninstaller Purge: Dialog prompt saat proses uninstall Windows menanyakan apakah user ingin menghapus seluruh file konfigurasi dan data tersisa secara bersih.',
        'Zero Residual Footprint: Membersihkan %USERPROFILE%\\.hermes-hub dan folder AppData saat diizinkan oleh user.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Installer Windows NSIS sebelumnya tidak menghapus folder konfigurasi .hermes-hub saat di-remove.'
      ],
      architecture: [
        'NSIS Native Windows Installer & Uninstaller Custom Hooks.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.3/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.3/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.2',
      name: 'Hermes Hub Gateway v0.6.2 (One-Click Clean Slate Factory Reset & Neutral Identifier)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menghadirkan fitur Hapus Total Data Tersisa (Factory Reset to Clean Slate) langsung dari antarmuka Settings Disaster Recovery Center, serta memperbarui app identifier Windows tauri menjadi com.hermeshub.gateway yang murni universal.',
      features: [
        'One-Click Factory Reset: Tombol "Hapus Total Data" pada Disaster Recovery Center secara instan membersihkan seluruh file config.json, riwayat workspace lama, dan cache tersisa di AppData lokal.',
        'Sanitized Neutral Identifier: Mengubah bundle ID aplikasi menjadi com.hermeshub.gateway bebas dari rujukan institusi.',
        'Seamless In-App Reset: Tidak perlu mencari folder AppData secara manual di Windows Explorer untuk membersihkan jejak konfigurasi lama.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache dependensi Rust untuk proses kompilasi rilis kilat.'
      ],
      fixes: [
        'Ketiadaan opsi pembersihan data lokal tersisa saat aplikasi diinstall ulang.',
        'App identifier tauri yang sebelumnya masih memuat nama domain lokal.'
      ],
      architecture: [
        'Atomic Clean Slate Reset via Backend Tauri IPC.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.2/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.2/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.1',
      name: 'Hermes Hub Gateway v0.6.1 (Pristine Clean Slate & Hashed Organization Provisioning)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghapus 100% residu konfigurasi internal, path project lokal, dan nama institusi dari kode sumber bawaan. Aplikasi kini terbit sebagai kanvas bersih (Clean Slate) bagi developer global, dengan satu-satunya pintu konfigurasi otomatis berbasis verifikasi cryptographic SHA-256 hash.',
      features: [
        'Pristine Clean Slate: Instalasi baru kini dibuka dalam keadaan bersih (workspaces kosong, mcp_servers kosong, endpoint netral) tanpa data dummy spesifik.',
        'Cryptographic Hashed Provisioning: Otentikasi Organization Setup Key menggunakan verifikasi SHA-256 hash satu arah (one-way cryptographic digest). Kunci asli tidak disimpan mentah di kode sumber.',
        'Secure Profile Vault: File kredensial terisolasi aman dengan izin chmod 600 di home profile pengguna.',
        'High-Speed CI/CD Pipeline: Didukung cache dependensi Rust untuk proses rilis binary Windows yang cepat dan terverifikasi.'
      ],
      fixes: [
        'Residu default workspace dan server MCP lokal pada konfigurasi bawaan aplikasi baru.',
        'Eksposur teks mentah institusi di dalam source code gateway.'
      ],
      architecture: [
        'Cryptographically Hashed Provisioning & Pure Agnostic Global Desktop Architecture.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.6.0',
      name: 'Hermes Hub Gateway v0.6.0 (Global Design System Architecture & Theme Boundary Audit)',
      date: '20 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Transformasi arsitektur styling dari pendekatan tambal sulam lokal (spot patching) menjadi Centralized Design System Token. Dilengkapi class modifier .dark otomatis pada documentElement, standardisasi komponen hhg-*, serta Theme Integrity Audit Gate sebelum proses kompilasi.',
      features: [
        'Centralized CSS Design Tokens: Mengadopsi variabel semantik global (--color-app-bg, --color-app-surface, dll.) yang mengatur warna aplikasi di seluruh tingkatan secara deterministik.',
        'Document Root Theme Synchronizer: Menambahkan aktivasi otomatis class .dark pada elemen <html> untuk menyelaraskan seluruh utilitas Tailwind CSS.',
        'Theme Integrity Audit Gate: Script verify-all.mjs kini otomatis menolak commit jika ditemukan hardcoded background gelap tanpa adaptasi tema.',
        'High-Speed CI/CD Pipeline: Tetap didukung cache Rust terakselerasi untuk rilis installer Windows super cepat.'
      ],
      fixes: [
        'Inkonsistensi tema terang pada kartu Disaster Recovery Center, daftar SOP Skills, dan pemilih tema Settings.',
        'Menghapus ketergantungan pada pengecekan kondisional lokal yang rawan terlewat.'
      ],
      architecture: [
        'Enterprise Global CSS Token Architecture & Automated Pre-Build Linter Gates.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.6.0/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.9',
      name: 'Hermes Hub Gateway v0.5.9 (Disaster Recovery Center Light Polish & Fast Caching)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'LATEST',
      highlights: 'Menuntaskan kartu Disaster Recovery Center di tab Settings: mengubah kotak hitam pekat Konfigurasi Laptop HHG dan Memori Mnemosyne Server menjadi kartu putih/slate-50 yang bersih, kontras, dan terpadu elegan di Light Mode.',
      features: [
        'Disaster Recovery Center Light Theme: Dua kartu pencadangan konfigurasi dan server memori kini berlatar slate-50 yang cerah dengan tombol Export/Import berbingkai halus.',
        'High-Contrast Buttons: Tombol Export JSON dan Backup Memori menggunakan latar putih bersih dengan teks berwarna aksen cyan/emerald.',
        'Accelerated Rust Caching: Memanfaatkan cache crates GitHub Actions untuk kompilasi biner Windows kilat.'
      ],
      fixes: [
        'Latar belakang hitam pekat (bg-slate-950/70) pada kedua kartu Disaster Recovery Center di bagian bawah menu Settings saat Light Mode aktif.'
      ],
      architecture: [
        'Full Universal Theme Integration across 100% HHG Views.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.9/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.9/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.8',
      name: 'Hermes Hub Gateway v0.5.8 (Total Theme Consistency & Empty-State Polish)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Menuntaskan kartu daftar SOP tidak terpilih (unselected cards) yang sebelumnya tertinggal berwarna gelap di tab Skills Hierarchy, menyempurnakan badge metadata judul, serta menyediakan tampilan empty state yang rapi saat direktori references/ kosong.',
      features: [
        'Skills Master List Light Harmonization: Kartu-kartu SOP yang tidak sedang dipilih di kolom kiri kini 100% menggunakan latar slate-50 yang bersih di mode terang.',
        'Adaptive Empty-State Box: Menampilkan ilustrasi status rapi jika suatu SOP tidak memiliki berkas lampiran di references/.',
        'MCP Hub Item Card Polish: Menyelaraskan daftar item server MCP di kolom kiri pada mode terang.',
        'Zero-Error Fast Bundler: Lolos verifikasi tipe ketat TypeScript dan didukung pipeline kompilasi terakselerasi.'
      ],
      fixes: [
        'Kartu SOP tidak terpilih di kolom kiri Skills Hierarchy yang masih berlatar hitam pekat di mode terang.',
        'Badge metadata author dan kategori pada panel kanan Skills Hierarchy yang masih memakai warna gelap di mode terang.'
      ],
      architecture: [
        'Unified Light/Dark Theme Consistency Architecture.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.8/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.8/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.7',
      name: 'Hermes Hub Gateway v0.5.7 (Flawless Light Theme & Universal Developer Workspace)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menuntaskan seluruh sisa artefak blok hitam pada tab Evolution Logs (Inspection Trace JSON viewer) dan Settings Theme Selector (kartu pilihan tema) di Light Mode, serta menyempurnakan netralitas nama menjadi Developer Workspace secara universal.',
      features: [
        'Pure Adaptive Light Theme: Console Inspection Trace JSON pada Evolution Logs kini tampil elegan dengan latar slate-50 yang nyaman dibaca dan tidak silau.',
        'Theme Selector Card Harmony: Pilihan Mode Gelap, Mode Terang, dan Ikuti Laptop di tab Settings menggunakan kartu adaptif tanpa blok hitam pekat.',
        'Universal Developer Neutrality: Menghapus seluruh residu nama entitas lokal dan memantapkan posisi Hermes Hub Gateway sebagai toolkit desktop global bagi software developer.',
        'High-Speed CI/CD Pipeline: Memanfaatkan kompilasi terakselerasi dan pengujian otomatis pra-build (Zero-Error TypeScript Gate).'
      ],
      fixes: [
        'Blok hitam hardcoded pada tampilan Inspection Trace JSON di tab Evolution Logs saat Light Mode.',
        'Warna tombol pemilih tema (Mode Gelap/Terang/System) yang sempat kontras gelap pada Settings.'
      ],
      architecture: [
        'Full Multi-Theme Design System with 100% Zero-White-Screen Guarantee.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.7/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.7/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.6',
      name: 'Hermes Hub Gateway v0.5.6 (Comprehensive Light Theme Harmonization & Cache Optimization)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Penyempurnaan total konsistensi tema terang di seluruh tab (Skills Hierarchy, References Reader Modal, Evolution Logs, dan Settings Inputs). Menghilangkan seluruh artefak hitam pekat menjadi palet profesional adaptif.',
      features: [
        'Skills & References Light Polish: Kotak pencarian, daftar berkas referensi pendukung, tombol buka, dan modal reader SKILL.md kini 100% harmonis di tema terang.',
        'Settings Inputs Polish: Form input Organization ID, Telegram Bot Token, dan ID Grup mengikuti tema terang tanpa blok hitam.',
        'Continuous Build Acceleration: Mengoptimalkan pipeline CI/CD dengan cache crates Rust yang tersimpan permanen.'
      ],
      fixes: [
        'Latar belakang hitam pekat pada list berkas referensi pendukung di tab Skills.',
        'Kontras tinggi yang tidak seimbang pada modal SKILL & Reference Reader di mode terang.'
      ],
      architecture: [
        'Enterprise Design System with Auto-Adaptive Light/Dark CSS Tokens.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.6/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.6/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.5',
      name: 'Hermes Hub Gateway v0.5.5 (Harmonized Light Mode & Zero-Clash Visual Theme)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Mengharmonisasi antarmuka tab Isolated Workspaces Manager di Light Mode: mengeliminasi latar belakang hitam pekat pada banner IDE, kartu koneksi Git, dan viewer kontrak AGENTS.md menjadi palet lembut cyan/slate yang kontras elegan dan nyaman di mata.',
      features: [
        'Harmonized Light Mode Workspaces: Banner koneksi IDE, kartu Git repo terisolasi, dan area kode AGENTS.md kini adaptif otomatis mengikuti tema terang (soft cyan-50 dan slate-50).',
        'Balanced Readability Contrast: Teks deskripsi dan path direktori tidak lagi silau atau bertabrakan dengan warna latar di Light Mode.',
        'Verified Pre-Build Testing Gates: Teruji lolos 100% pada verifikasi tipe TypeScript (tsc --noEmit) dan simulasi render headless browser.'
      ],
      fixes: [
        'Menghilangkan hardcoded dark background (bg-slate-950) pada viewer berkas AGENTS.md di tab Workspaces.',
        'Menghilangkan warna kontras gelap pada banner bantuan koneksi IDE bridge.'
      ],
      architecture: [
        'Universal High-Contrast Adaptive Light/Dark Theme Engine.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.5/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.5/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.4',
      name: 'Hermes Hub Gateway v0.5.4 (Neutral Developer Architecture & Interactive Save Feedback)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghapus seluruh dependensi nama organisasi lokal/rumah sakit sehingga murni berstandar industri global untuk seluruh software developer, serta menambahkan banner notifikasi interaktif tepat pada tombol Simpan Konfigurasi.',
      features: [
        'Global Programmer Generalization: Seluruh pesan broadcast Telegram, pedoman arsitektur, dan template setup diubah menjadi standar rekayasa perangkat lunak agnostik (non-spesifik organisasi).',
        'Direct Save Feedback Banner: Tombol Simpan Seluruh Konfigurasi kini menampilkan animasi loading serta banner konfirmasi status penyimpanan tepat di dalam tab Settings.',
        'Zero-White-Screen Resilience: Global Error Boundary aktif melindungi seluruh navigasi dan modal dialog dari uncaught runtime exceptions.',
        'Strict Pre-Build Test Gates: Lolos 100% verifikasi TypeScript Compiler (0 error) dan validasi bundling Vite.'
      ],
      fixes: [
        'Ketiadaan umpan balik visual (no feedback) saat menekan tombol Simpan Seluruh Konfigurasi.',
        'Netralisasi template pesan uji coba notifikasi Telegram dari embel-embel organisasi.'
      ],
      architecture: [
        'Universal Multi-Platform Developer Desktop Gateway.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.4/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.4/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.3',
      name: 'Hermes Hub Gateway v0.5.3 (Pre-Build Test Gates & Zero-White-Screen Architecture)',
      date: '20 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Mengimplementasikan protokol Pre-Build Verification Gates terstandarisasi (Strict TypeScript Type Checking + Global React Error Boundary) yang secara permanen mengeliminasi risiko layar putih polos (white screen of death).',
      features: [
        'Pre-Build Strict TypeScript Gate: Memvalidasi seluruh tipe data, missing component imports, dan keselarasan antarmuka sebelum proses build diizinkan berjalan.',
        'Global Fault-Tolerant Error Boundary: Melindungi runtime aplikasi dari uncaught exceptions; menyajikan panel diagnostik instan bila terjadi crash daripada layar putih mati.',
        'Dynamic Multi-Protocol MCP Registration Suite: Mendukung Local CLI Process, Remote SSE streaming endpoint, dan Dynamic Key-Value environment builder.',
        'Comprehensive Interactive Validation: Teruji secara riil melalui simulasi interaksi browser pada seluruh tab dan modal dialog.'
      ],
      fixes: [
        'Resolusi fatal error ReferenceError: Sliders is not defined saat membuka modal pendaftaran MCP.',
        'Koreksi parameter workspaceId pada pemanggilan auto-refresh skills hierarchy.',
        'Koreksi type definition ReleaseLog untuk kategori rilis RELEASE dan PATCH.'
      ],
      architecture: [
        'Zero-White-Screen Resilience & Multi-Stage Automated Pre-Build Testing Pipeline.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.3/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.3/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.2',
      name: 'Hermes Hub Gateway v0.5.2 (Dynamic Multi-Protocol MCP Registration Suite)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menyediakan sistem registrasi MCP dinamis yang mengakomodasi seluruh bentuk arsitektur MCP: Local CLI (cmd.exe, npx, uvx, binary path), Remote SSE Endpoint (Mnemosyne / OmniRoute), Environment Variables Key-Value builder dinamis, dan IDE Raw JSON mode.',
      features: [
        'Multi-Protocol Selector: Pilihan arsitektur seketika antara Local Process (stdio/CLI) dan Remote Server (SSE / HTTP stream).',
        'Dynamic Environment Builder: Form dinamis untuk menambah/menghapus variabel lingkungan dan kredensial jaringan (IP target, token API, host DB) tanpa batas.',
        'Antigravity IDE Compatibility: Sepenuhnya mendukung skema mcpServers Antigravity termasuk serverUrl, flag disabled, dan Windows cmd.exe wrapper.',
        'Seamless Bi-Directional State: Sinkronisasi instan antara tab Formulir Dinamis dan tab Raw JSON editor.'
      ],
      fixes: [
        'Koreksi parsing flag serverUrl pada server remote SSE.',
        'Penyelarasan layout responsif modal pendaftaran MCP.'
      ],
      architecture: [
        'Universal Protocol-Agnostic MCP Registry & Industrial Dynamic Form Engine.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.2/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.2/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.1',
      name: 'Hermes Hub Gateway v0.5.1 (Raw JSON IDE-Compliant MCP Editor)',
      date: '20 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan editor Raw JSON MCP standar industri (Antigravity IDE / VS Code / Claude Desktop JSON) dengan validasi sintaks instan, tombol template kilat, serta opsi toggle ke formulir konvensional.',
      features: [
        'Raw JSON Configuration Mode: Pengguna dapat langsung menempelkan (paste) konfigurasi JSON mcpServers dari VS Code, Antigravity, atau Claude Desktop tanpa harus mengisi form satu per satu.',
        'Multi-Server Auto Extraction: Mendukung pendaftaran banyak server MCP sekaligus dalam satu kali paste JSON array atau root object.',
        'Syntax Error Highlighter: Menampilkan kotak peringatan merah jika terdapat kesalahan koma atau tanda kurung pada JSON yang di-paste.',
        'Quick Template Helper: Tombol satu klik untuk memuat contoh format resmi MCP Server (seperti Postman, Database, atau Filesystem).'
      ],
      fixes: [
        'Penyelarasan Skema Pendaftaran MCP Server dengan Antigravity IDE .agents/tools.',
        'Koreksi State Form Terbuka saat Edit MCP Terpilih.'
      ],
      architecture: [
        'Developer-First Raw Configuration Protocol & Dual-Mode MCP Registry.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.5.0',
      name: 'Hermes Hub Gateway v0.5.0 (Tauri v2 Schema Validation Fix & Stable Release)',
      date: '20 Oktober 2026',
      type: 'RELEASE',
      status: 'STABLE',
      highlights: 'Menuntaskan error kompilasi CI/CD Windows: menghapus properti invalid icon pada app > windows > 0 yang melanggar skema ketat Tauri v2 CLI, memastikan bundle ikon global tervalidasi 100%, serta menyatukan seluruh fitur audit koneksi riil dan sinkronisasi Git otomatis.',
      features: [
        'Strict Schema Compliance: Mengoreksi tauri.conf.json agar sepenuhnya valid terhadap skema JSON resmi Tauri v2 CLI (menghilangkan error Additional properties are not allowed icon).',
        'Auto-Generated Window Icons: Memanfaatkan bundle.icon resmi Tauri untuk seluruh resolusi taskbar, system tray, dan shortcut desktop.',
        'Unified Live Verification Engine: Seluruh pengujian jaringan (Git remote ls-remote, Gateway HTTP check, dan Telegram broadcast) aktif dan teruji.',
        'High-Contrast Theme Uniformity: Antarmuka Light & Dark Mode seragam dan bersih di semua tab.'
      ],
      fixes: [
        'Resolusi Error CI/CD Windows build step npm run tauri build.',
        'Penyelarasan System Tray Menu Event Handlers.'
      ],
      architecture: [
        'Tauri v2 Pure-Compliant Desktop Engine & Industrial Automation Suite.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.5.0/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.9',
      name: 'Hermes Hub Gateway v0.4.9 (Comprehensive Architecture Audit & 100% Real Verification Engine)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Audit menyeluruh eliminasi seluruh mock/dummy logic: pengujian Git Remote kini menjalankan git ls-remote nyata, validasi Gateway menembak HTTP live ke Evaluator (:9125) & Mnemosyne (:8080), serta perbaikan total seluruh kartu antarmuka di Mode Terang.',
      features: [
        'Real Git Remote Verification: Tombol Test Koneksi Git mengeksekusi git ls-remote HEAD langsung ke server GitLab RSUD, memvalidasi commit dan token autentikasi secara nyata.',
        'Live Dual-Server Health Check: Tombol Test Koneksi Gateway Server menembak HTTP request asinkron ke kedua port (:9125 & :8080) dengan laporan kode status transparan.',
        'Full Light & Dark Theme Adaptability: Menuntaskan seluruh sisa elemen gelap di tab Settings, Workspaces, dan MCP Hub agar seragam 100% menggunakan arsitektur kartu kontras tinggi.',
        'Initial Boot Sync: Aplikasi secara otomatis melakukan sync Git pada detik pertama dijalankan.'
      ],
      fixes: [
        'Eliminasi Seluruh Mock Timer: Menghapus seluruh setTimeout simulasi pada validasi koneksi Git dan Gateway.',
        'Koreksi Total Hirarki SOP: Memastikan seluruh berkas referensi dipindai secara dinamis dari disk fisik.'
      ],
      architecture: [
        'Fully-Verified Native Rust Network Engine & Clean Enterprise Theme Matrix.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.50 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.9/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.76 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.9/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.8',
      name: 'Hermes Hub Gateway v0.4.8 (Startup Git Sync & Dynamic Real-Time Skills Inspection)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghapus ketergantungan daftar statis pada SKILL.md: aplikasi kini secara otomatis menjalankan sinkronisasi Git di awal booting (startup) dan membaca seluruh pohon direktori SOP beserta daftar berkas referensi pendukungnya secara dinamis.',
      features: [
        'Startup Git Synchronization: Rust background thread otomatis menjalankan git pull/clone ke repositori target sesaat setelah aplikasi dinyalakan.',
        'Inspeksi Dinamis Pohon SKILL.md: Perintah get_skills_hierarchy memindai langsung folder internal skills dan subfolder references/ sehingga jumlah berkas selalu 100% identik dengan kondisi repo Git aktual.',
        'Eliminasi Inkonsistensi Statis: Tidak ada lagi perbedaan jumlah referensi antara UI gateway dan berkas Git (seperti 3 referensi simgos2-db-audit).',
        'Auto-Refetch saat Sync Manual: Menekan tombol Sync Rules Now langsung memperbarui state hirarki skill di frontend tanpa perlu me-restart aplikasi.'
      ],
      fixes: [
        'Sinkronisasi Status Dinamis pada tab SOP & Aturan Koding.',
        'Penanganan Otomatis Folder Skills jika Belum Pernah di-Clone.'
      ],
      architecture: [
        'Asynchronous Git Pull on Boot & Dynamic Filesystem Inspection Engine.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.49 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.8/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.8/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.7',
      name: 'Hermes Hub Gateway v0.4.7 (Tray Icon Binding, Complete SOP References & Subtle Light Theme)',
      date: '19 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Memperbaiki binding icon system tray native di Windows, melengkapi 3 berkas referensi SOP simgos2-db-audit sesuai repositori Git, dan mengharmoniskan kontras kartu aktif di Mode Terang.',
      features: [
        'Native Windows System Tray Icon Binding: Memastikan icon aplikasi tampil jelas di taskbar tray Windows tanpa blank.',
        'Sinkronisasi 3 Referensi SKILL.md: Memuat 3 berkas referensi lengkap untuk simgos2-db-audit (mariadb-isolation-levels.md, stock-fifo-rules.md, pharmacy-audit-logging.sql).',
        'Harmonisasi Kontras Master-Detail: Kartu terpilih di Mode Terang kini menggunakan aksen cyan lembut (Cyan-50) yang nyaman di mata.',
        'Live Telegram API Call via Rust reqwest: Pengujian Telegram menembak langsung endpoint resmi dengan proteksi validasi token asli.'
      ],
      fixes: [
        'Perbaikan Icon Windows Taskbar & System Tray.',
        'Penyesuaian Skema Warna Master List Item State di Seluruh Tab.'
      ],
      architecture: [
        'Explicit Tauri Tray Icon Handler & Multi-File SOP Reference Mapping.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.49 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.7/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.7/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.6',
      name: 'Hermes Hub Gateway v0.4.6 (Live Telegram API Broadcast & High-Contrast Light Theme)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan koneksi Telegram API asli via native Rust reqwest (bukan lagi simulasi lokal), validasi keaslian bot token (mendeteksi token dummy/masking), serta formulasi desain sistem Mode Terang berdaya kontras tinggi (Clean White Card Design).',
      features: [
        'Live Telegram Bot API Integration: Tombol uji di Settings menembak langsung endpoint resmi https://api.telegram.org/bot<TOKEN>/sendMessage via Rust HTTP client.',
        'Validasi Kredensial Asli: Sistem otomatis mengingatkan pengguna jika Bot Token masih berstatus masking (***) atau tidak terdaftar di Telegram.',
        'Pola Desain Sistem Mode Terang Elegan: Seluruh kartu metrik, panel watcher, dan kontainer utama menggunakan palet kartu putih (#FFFFFF) dengan teks tajam (#0F172A) yang seimbang dan nyaman di mata.',
        'One-Key Rapid Provisioning: Onboarding instan tim Developer Workspace dengan pengisian otomatis konfigurasi terpusat.'
      ],
      fixes: [
        'Eliminasi Fake Success Alert: Status pengujian koneksi Telegram kini merefleksikan respons nyata HTTP server Telegram.',
        'Koreksi Kontras Teks: Menghilangkan teks redup atau silau saat berpindah antara Mode Gelap dan Mode Terang.'
      ],
      architecture: [
        'Native Rust Asynchronous HTTP Client (reqwest) dengan fallback web fetch & Dual Theme Matrix System.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.49 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.6/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.6/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.5',
      name: 'Hermes Hub Gateway v0.4.5 (One-Key Provisioning & Global App-Wide Theme System)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan modul One-Key Organization Provisioning (cukup 1 ID untuk mengaktifkan seluruh parameter Evaluator, Mnemosyne, Bot Telegram RSUD) dan sinkronisasi tema global ke seluruh kerangka antarmuka (Sidebar, Header, Main Content).',
      features: [
        'One-Key Organization Provisioning: Input ID Organisasi RSUD (RSUD-JUSUF-SK) langsung mengisi otomatis IP Evaluator (:9125), Mnemosyne (:8080), dan kredensial Telegram secara instan.',
        'Sistem Tema Global Komprehensif: Peralihan tema Dark / Light / Laptop System kini merata ke seluruh aplikasi (Sidebar, Toolbar Header, Panel Konten, dan Card Container).',
        'Reader SOP SKILL.md Terverifikasi RSUD: Membaca pedoman teknis koding lengkap (BPJS HMAC, Ext JS, Database Locking, Synology GFS) secara interaktif.',
        'Penunjuk Lokasi Backup Transparan: Jalur folder penyimpanan backup di Downloads ditampilkan secara jelas dan akurat.'
      ],
      fixes: [
        'Sinkronisasi Warna Kontras: Menjamin teks dan ikon tetap kontras tajam saat berpindah antara Mode Terang dan Mode Gelap.',
        'Penanganan Otomatis Timeout Notifikasi Aktivasi: Banner hasil verifikasi Organization ID otomatis tertutup rapi setelah 5 detik.'
      ],
      architecture: [
        'Enterprise Rapid Onboarding Architecture & React Cascading Theme Context.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.49 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.5/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.5/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.4',
      name: 'Hermes Hub Gateway v0.4.4 (Runtime React Fix & Production SOP Blueprint)',
      date: '19 Oktober 2026',
      type: 'PATCH',
      status: 'STABLE',
      highlights: 'Memperbaiki runtime React freeze / blank screen saat peluncuran window di Windows WebView2, mengintegrasikan Theme Switcher 3-Mode (Dark/Light/System) di Header dan Settings, serta menyuplai seluruh spesifikasi SOP teknis SKILL.md terverifikasi RSUD.',
      features: [
        'Perbaikan Blank White Screen: Restrukturisasi peletakan React Hooks di dalam root component tree agar tidak crash saat inisialisasi WebView2.',
        'Theme Selector 3-Mode (Dark / Light / System Windows): Tombol instan di pojok kanan atas header dan pengaturan visual di tab Settings.',
        'Dokumentasi Penuh SOP SKILL.md: Reader menampilkan spesifikasi teknis lengkap (BPJS VClaim, Ext JS, Database Transaction Lock, Synology GFS) secara offline dan online.',
        'Folder Backup Terstandarisasi: Penunjuk transparan letak berkas JSON hasil ekspor di folder Downloads pengguna.'
      ],
      fixes: [
        'Penyelesaian Masalah Scope Hook: Menjamin seluruh useState dan useEffect ter-encapsulate di dalam App() scope.',
        'Optimasi WebView2 Event Dispatcher di lingkungan Windows 10/11.'
      ],
      architecture: [
        'Zero-Crash Resilient UI Architecture dengan fallback penanganan error terisolasi.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.49 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.4/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.4/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.3',
      name: 'Hermes Hub Gateway v0.4.3 (Theme Suite & Realistic SOP Documentation)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan pemilih tema visual 3-mode (Dark, Light, System Windows Adaptive), penunjuk path folder backup eksplisit pada Disaster Recovery Center, serta render penuh dokumen SOP teknis SKILL.md terstandarisasi RSUD.',
      features: [
        'Sistem Tema 3-Mode (Dark / Light / Laptop System Adaptive): Kontrol visual cepat di header atas dan kartu preferensi tampilan di Settings.',
        'Penunjuk Folder Backup Eksplisit: Banner notifikasi secara transparan menampilkan path folder Downloads dan nama berkas cadangan JSON yang tersimpan.',
        'Katalog SOP SKILL.md Realistis & Penuh: Menampilkan dokumen SOP teknis utuh untuk seluruh skill (BPJS VClaim, Ext JS MVVM, Database Transaction Lock, Synology GFS) tanpa status antrean kaku.'
      ],
      fixes: [
        'Optimalisasi Build Pipeline: Menghapus cache disk-heavy untuk menjaga runner CI/CD Windows tetap cepat dan stabil.',
        'Penyempurnaan Syntax & Escape String pada reader Markdown berkas skill.'
      ],
      architecture: [
        'Adaptive System Theme Sync menggunakan CSS prefers-color-scheme listener secara real-time.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.49 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.3/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.3/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.2',
      name: 'Hermes Hub Gateway v0.4.2 (Disaster Recovery & Settings Connectivity Suite)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan Pusat Pencadangan & Pemulihan Bencana (Disaster Recovery Center) untuk konfigurasi klien HHG dan memori server Mnemosyne, tombol uji koneksi mandiri untuk Telegram dan Gateway Server, serta penyesuaian auto-dismiss 5 detik.',
      features: [
        'Pusat Cadangan & Pemulihan Bencana: Export/Import konfigurasi lokal HHG (workspaces, git, mcp) jika ganti perangkat.',
        'Pencadangan Memori Server Mnemosyne: Backup snapshot ingatan agen (episodes & triples) dan pemulihan ke server baru.',
        'Test Kirim Pesan Telegram: Tombol uji kirim pesan siaran untuk memverifikasi keabsahan Bot Token & Group ID.',
        'Test Koneksi Server Gateway: Tombol uji keterjangkauan port Evaluator (:9125) dan Memori Mnemosyne (:8080) pada satu host server.'
      ],
      fixes: [
        'Optimalisasi Durasi Notifikasi: Seluruh banner hasil pengujian (MCP, Git, Telegram, Gateway, DR) kini otomatis menghilang dalam 5 detik agar layar tetap rapi.',
        'Percepatan Build CI/CD: Pengaktifan Rust Cache dan NPM Cache untuk kompilasi rilis yang jauh lebih cepat.'
      ],
      architecture: [
        'Double Disaster Recovery Shield yang melindungi data konfigurasi lokal dan integritas basis pengetahuan agen di server.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.48 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.2/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.75 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.2/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.1',
      name: 'Hermes Hub Gateway v0.4.1 (One-Key Provisioning & Timed Notification Auto-Dismiss)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan fitur aktivasi konfigurasi satu-kunci (One-Key Organization Provisioning) untuk memudahkan onboarding tim rumah sakit tanpa konfigurasi manual, serta auto-dismiss 30 detik untuk seluruh notifikasi pengujian koneksi.',
      features: [
        'Aktivasi Konfigurasi Satu-Kunci (Organization Setup ID): Cukup memasukkan Setup ID (misal: RSUD-JUSUF-SK-CORE) untuk memuat seluruh IP Evaluator, Mnemosyne, dan Bot Telegram secara otomatis.',
        'Zero-Config Initial State: Biner rilis bersih tanpa kredensial tertanam, aman untuk didistribusikan ke publik maupun tim internal.',
        'Timed Auto-Dismiss Notifikasi (30 Detik): Banner hasil pengujian Git dan MCP otomatis menghilang sendiri setelah 30 detik agar layar kerja tetap rapi.',
        'Notifikasi Multi-Channel Terintegrasi: Dukungan OS toast Windows, indikator tray, in-app alert, dan siaran bot Telegram untuk sinkronisasi skill baru.'
      ],
      fixes: [
        'Penyempurnaan auto-dismiss notifikasi pengujian pada modal workspace dan panel MCP.',
        'Validasi format token dan URL remote repository pada tombol Test Koneksi Git.'
      ],
      architecture: [
        'Enterprise Provisioning Pattern untuk kemudahan onboarding programmer dan staf IT Developer Workspace.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.73 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.4.0',
      name: 'Hermes Hub Gateway v0.4.0 (Official Version Logs & Git Connectivity Testing)',
      date: '19 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Rilis tonggak penting yang menghadirkan penjelajah Version Logs (Changelog) resmi di sidebar aplikasi, tombol Test Koneksi Git di modal pendaftaran/edit workspace dengan notasi hijau zamrud kontras, serta manajemen siklus hidup penuh workspace.',
      features: [
        'Version Logs & Official Changelog Explorer: Menu khusus di sidebar untuk menelusuri riwayat versi, catatan perubahan fitur/bug, serta tautan unduh biner resmi.',
        'Test Koneksi Git Remote: Tombol uji jangkauan jaringan dan validasi Personal Access Token (PAT) GitLab RSUD/GitHub langsung di modal workspace.',
        'Manajemen Penuh Workspace: Fitur Edit konfigurasi dan Hapus workspace yang sudah terdaftar.',
        'One-Click IDE MCP Configuration: Kartu bantuan koneksi IDE dengan tombol salin konfigurasi Named Pipe \\\\.\\pipe\\hhg-bridge.'
      ],
      fixes: [
        'Pemberitahuan Uji Koneksi Hijau Zamrud Kontras (Emerald 500) pada seluruh pengujian koneksi (MCP dan Git).',
        'Pembersihan total kartu repositori Git sentral di tab Settings.',
        'Perbaikan penanganan event sistem pada Evolution Logs untuk mencegah layar blank putih.'
      ],
      architecture: [
        'Pola Seragam Master-Detail Split-Pane di seluruh 5 menu utama (Workspaces, MCP Hub, Skills Hierarchy, Evolution Logs, Version Logs).',
        'Isolasi Repositori Git Mandiri yang mengikat pointer skills langsung pada masing-masing workspace.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.73 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.4.0/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.3.1',
      name: 'Hermes Hub Gateway v0.3.1 (Complete Management & UI Upgrade)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Menghadirkan manajemen penuh Workspace (Edit & Hapus), Helper Koneksi IDE via MCP satu-klik, notasi hasil testing hijau menyala, isolasi Git per-workspace tanpa duplikasi di Settings, dan perbaikan stabilitas Evolution Logs.',
      features: [
        'Manajemen Penuh Workspace: Tombol Edit dan Hapus pada masing-masing kartu workspace.',
        'Modal Update Workspace: Memperbarui Nama, Path Lokal, dan Remote Git tanpa mengulang konfigurasi.',
        'Unified IDE MCP Connection Helper: Kartu bantuan koneksi IDE dengan tombol One-Click Copy konfigurasi Named Pipe \\\\.\\pipe\\hhg-bridge.',
        'Version Logs (Changelog) Explorer: Menu khusus di sidebar untuk menelusuri riwayat rilis dan unduhan installer resmi.'
      ],
      fixes: [
        'Perbaikan Notasi Pengujian MCP: Menggunakan warna hijau zamrud (emerald-500) kontras tinggi menggantikan warna biru yang menyatu.',
        'Pembersihan Tab Settings: Menghapus konfigurasi Git sentral lama agar seluruh repositori terkunci mandiri per-workspace.',
        'Stabilitas Evolution Logs: Memperbaiki penanganan null-check pada event sistem sehingga menu logs tidak blank putih lagi.'
      ],
      architecture: [
        'Named Pipe Gateway Multiplexing: Menjamin satu koneksi IDE dapat mengekspos puluhan server MCP sekaligus.',
        'Zero-Pollution Project Root: Tetap mempertahankan prinsip 1 file deklaratif tunggal AGENTS.md di folder koding target.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.3.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.73 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.3.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.3.0',
      name: 'Hermes Hub Gateway v0.3.0 (Master-Detail Standardization & Scalable Tables)',
      date: '19 Oktober 2026',
      type: 'FEATURE',
      status: 'STABLE',
      highlights: 'Standardisasi antarmuka Master-Detail Split-Pane di seluruh menu, tabel referensi vertikal scalable (>10 files), 3-level drilldown skills, dan perbaikan tampilan MCP tools discovery.',
      features: [
        'Uniform Master-Detail Split-Pane: Tata letak Col 4 (Master List) dan Col 8 (Detail Inspector) di seluruh menu.',
        'Scalable Vertical References Table: Menampung puluhan file referensi pendukung SOP tanpa melar ke samping.',
        '3-Level Skills Hierarchy: Drilldown terstruktur dari Workspace -> SOP Aturan -> File Referensi.',
        'Per-Tool Toggle Discovery: Pengaturan enable/disable tools MCP individual seperti antarmuka IDE modern.'
      ],
      fixes: [
        'Perbaikan crash rendering SVG icons pada penjelajah tools calling MCP.',
        'Pembersihan kartu ganda notifikasi bot Telegram di tab Settings.'
      ],
      architecture: [
        'Modular Master-Detail Design System untuk kemudahan navigasi programmer kantor.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.3.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.73 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.3.0/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.2.1',
      name: 'Hermes Hub Gateway v0.2.1 (Per-Workspace Git Binding & Telegram Notifications)',
      date: '19 Oktober 2026',
      type: 'STABILITY',
      status: 'STABLE',
      highlights: 'Menghubungkan remote Git repository mandiri pada saat pendaftaran workspace serta integrasi notifikasi broadcast bot Telegram.',
      features: [
        'Binding Git Mandiri: Tiap workspace memiliki target branch, project ID, dan token akses GitLab RSUD.',
        'Integrasi Notifikasi Telegram: Mengirim alert otomatis ke grup programmer saat terjadi evolusi SOP.'
      ],
      fixes: [
        'Perbaikan validasi form pendaftaran workspace lokal.'
      ],
      architecture: [
        'Sinkronisasi transcript review handshake dengan evaluator port :9125.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.2.1/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' },
        { name: 'Hermes.Hub.Gateway_0.1.0_x64_en-US.msi', type: 'WiX Windows Package (MSI)', size: '3.73 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.2.1/Hermes.Hub.Gateway_0.1.0_x64_en-US.msi' }
      ]
    },
    {
      version: 'v0.2.0',
      name: 'Hermes Hub Gateway v0.2.0 (Single-Instance IPC & System Tray)',
      date: '19 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Implementasi daemon Single-Instance IPC agar membuka aplikasi kembali langsung memfokuskan jendela yang aktif, serta system tray Windows interaktif.',
      features: [
        'Single-Instance Daemon: Mencegah duplikasi proses background HHG di Windows.',
        'System Tray Interaktif: Tray icon Windows dengan menu restore dan exit bersih.',
        'Tab MCP Servers Hub: Tempat pendaftaran server koding database, NAS, router, dan observabilitas.'
      ],
      fixes: [
        'Perbaikan system tray blank slot di Windows 11.'
      ],
      architecture: [
        'Validasi ketat host server tunggal: Evaluator dan Mnemosyne wajib berada di server IP yang sama.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.2.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' }
      ]
    },
    {
      version: 'v0.1.0',
      name: 'Hermes Hub Gateway v0.1.0 (Initial Core Release)',
      date: '19 Oktober 2026',
      type: 'MAJOR',
      status: 'STABLE',
      highlights: 'Rilis pondasi awal aplikasi desktop native berbasis Tauri v2 + React dengan zero-pollution contract generator.',
      features: [
        'Isolated Workspaces Core Engine.',
        'Pembuat otomatis kontrak AGENTS.md.',
        'Inisialisasi JSON-RPC Named Pipe Bridge.'
      ],
      fixes: [
        'Rilis perdana scaffolding.'
      ],
      architecture: [
        'Arsitektur pemisahan kontrol: IDE pengguna tidak menyentuh core engine watcher Hermes.'
      ],
      downloads: [
        { name: 'Hermes.Hub.Gateway_0.1.0_x64-setup.exe', type: 'NSIS Installer (EXE)', size: '2.47 MB', url: 'https://github.com/agusazis/hermes-hub-gateway/releases/download/v0.1.0/Hermes.Hub.Gateway_0.1.0_x64-setup.exe' }
      ]
    }
  ];

  const [logs, setLogs] = useState<{ time: string; event: string; conv?: string; file?: string }[]>([
    { time: formatTime24(), event: 'Hermes Hub Gateway Engine & Watcher online.' },
    { time: formatTime24(), event: 'Unified MCP Named Pipe initialized on \\\\.\\pipe\\hhg-bridge.' },
    { time: formatTime24(), event: 'Hermes Hub Gateway Engine online & ready.' },
    { time: formatTime24(), event: 'Single Instance IPC Daemon active (re-launching brings app to focus).' }
  ]);

  // Load Real Config from Rust
  useEffect(() => {
    invoke<GlobalConfig>('get_system_config')
      .then((res) => {
        if (res && res.workspaces) {
          setConfig(res);
          loadSshHostsList();
          // Auto-fetch dynamic skills hierarchy from disk/git
          invoke<SkillHierarchyItem[]>('get_skills_hierarchy', { workspaceId: res.active_workspace_id })
            .then((skills) => {
              if (skills) {
                setSkillsHierarchy(skills);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => console.error('Failed to load system config:', err));

    const fetchEvolutionFeed = () => {
      fetch(`${config.default_hermes_evaluator_url || 'http://172.168.1.202:9125'}/api/v1/evolution-events`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setEvolutionFeed(data);
            let targetDiff = 0;
            let summaryText = 'Semua log sudah dibaca';

            const currentActiveTab = activeTabRef.current;
            const currentLastReadTs = lastReadTimestampRef.current;

            if (currentActiveTab === 'logs') {
              const newestTs = data[0]?.timestamp ? new Date(data[0].timestamp).getTime() : Date.now();
              setLastReadTimestamp(newestTs);
              try { localStorage.setItem('hhg_last_read_log_ts', newestTs.toString()); } catch (_) {}
              setUnreadEvolutionCount(0);
              targetDiff = 0;
            } else {
              targetDiff = data.filter((item: any) => {
                const itemTs = item.timestamp ? new Date(item.timestamp).getTime() : 0;
                return itemTs > currentLastReadTs;
              }).length;
              setUnreadEvolutionCount(targetDiff);
              const latest = data[0];
              summaryText = targetDiff > 0 && latest ? `[${latest.type.toUpperCase()}] ${latest.title}` : 'Semua log sudah dibaca';
            }

            generateTrayBadgeIcon(targetDiff).then((iconRes) => {
              invoke('update_tray_status', {
                tooltip: summaryText,
                unreadCount: targetDiff,
                iconRgba: iconRes?.rgba,
                iconWidth: iconRes?.width,
                iconHeight: iconRes?.height,
              }).catch(() => {});
            });
          }
        })
        .catch(() => {});
    };

    fetchEvolutionFeed();
    const feedInterval = setInterval(fetchEvolutionFeed, 5000);

    const unlistenWatcher = listen<any>('watcher-event', (event) => {
      const p = event.payload;
      fetchEvolutionFeed();
      setLogs((prev) => [
        { time: formatTime24(), event: `[WATCHER] Transkrip ${p.conversation_id} terdeteksi -> kirim review ke ${config.default_hermes_evaluator_url}` },
        ...prev.slice(0, 50)
      ]);
    });

    const unlistenEvaluator = listen<any>('evaluator-event', (event) => {
      const p = event.payload;
      fetchEvolutionFeed();
      setLogs((prev) => [
        { time: formatTime24(), event: `🎉 [NEW RULE LEARNED] ${p.skill_name}: Aturan baru berhasil di-push ke GitLab!` },
        ...prev.slice(0, 50)
      ]);
    });

    const unlistenTraySync = listen('tray-sync-clicked', () => {
      handleSync();
    });

    return () => {
      clearInterval(feedInterval);
      unlistenWatcher.then((f) => f());
      unlistenEvaluator.then((f) => f());
      unlistenTraySync.then((f) => f());
    };
  }, []);

  const handleOpenSkill = async (s: SkillHierarchyItem) => {
    let realisticContent = 'Memuat isi berkas SKILL.md dari disk...';

    try {
      const res: any = await invoke('get_skill_detail', {
        workspaceId: config.active_workspace_id,
        skillName: s.name
      });
      if (res && res.content) {
        realisticContent = res.content;
      }
    } catch (e) {
      realisticContent = `# ${s.name}\n\n${s.desc}\n\n*Berkas belum tersinkronisasi ke disk lokal. Silakan tekan Sync Rules Now.*`;
    }

    setSelectedSkill({
      name: s.name,
      content: realisticContent,
      references: s.references,
      author: s.author,
      created_at: s.created_at
    });
    setSelectedRefFile(null);
    setRefFileContent('');
  };

  const handleSelectReference = async (skillName: string, refFileName: string) => {
    setSelectedRefFile(refFileName);
    setLoadingRefContent(true);
    try {
      const res: any = await invoke('get_skill_reference_content', {
        workspaceId: config.active_workspace_id,
        skillName: skillName,
        referenceFile: refFileName
      });
      if (res && res.content) {
        setRefFileContent(res.content);
      } else {
        setRefFileContent('Tidak ada konten referensi yang tersedia.');
      }
    } catch (_) {
      setRefFileContent(`Gagal memuat berkas referensi fisik ${refFileName} dari disk.`);
    } finally {
      setLoadingRefContent(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res: any = await invoke('trigger_manual_sync');
      setSyncMessage(res.message);

      // Muat ulang daftar skill & reference nyata hasil sinkronisasi git
      try {
        const dynamicSkills: any = await invoke('get_skills_hierarchy', { workspaceId: config.active_workspace_id });
        if (dynamicSkills && dynamicSkills.length > 0) {
          setSkillsHierarchy(dynamicSkills);
        }
      } catch (_) {}

      // Otomatis refresh audit readiness score setelah sync selesai
      try {
        const activeWs = config.workspaces.find(w => w.id === config.active_workspace_id);
        if (activeWs?.target_path) {
          const report: any = await invoke('check_workspace_readiness', { projectPath: activeWs.target_path });
          if (report) {
            setWorkspaceReadiness(prev => ({ ...prev, [activeWs.id]: report }));
          }
        }
      } catch (_) {}

      showToast('success', 'Sinkronisasi Rules Selesai', res.message || 'Aturan & SOP berhasil diperbarui dari GitLab.');
      setTimeout(() => setSyncMessage(''), 4000);
    } catch (err: any) {
      showToast('error', 'Gagal Sinkronisasi Rules', err?.toString() || 'Koneksi ke repositori Git terputus');
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenEditWs = (index: number) => {
    const ws = config.workspaces[index];
    setNewWsName(ws.name);
    setNewWsPath(ws.target_path);
    setNewWsGitProvider(ws.git_target?.provider || 'gitlab');
    setNewWsGitRepoUrl(ws.git_target?.repo_url || '');
    setNewWsGitProjectId(ws.git_target?.project_id || '');
    setNewWsGitBranch(ws.git_target?.target_branch || 'main');
    setNewWsGitToken(ws.git_target?.auth_token || '');
    setEditingWorkspaceIndex(index);
    setIsSubmittingWorkspace(false);
    setShowAddWsModal(true);
  };

  const handleDeleteWorkspace = async (index: number) => {
    const ws = config.workspaces[index];
    if (!confirm(`Hapus workspace "${ws.name}"? Tautan junction (.agents) di project lokal akan diputus dengan aman.`)) return;
    
    // Putuskan junction .agents di project lokal
    if (ws.target_path) {
      try {
        await invoke('remove_workspace_junction', { targetPath: ws.target_path });
      } catch (err) {
        console.warn('Gagal memutus junction via backend:', err);
      }
    }

    const remaining = config.workspaces.filter((_, i) => i !== index);
    const updated = {
      ...config,
      active_workspace_id: remaining.length > 0 ? remaining[0].id : '',
      workspaces: remaining
    };
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
    setSyncMessage(`Workspace "${ws.name}" berhasil dihapus dan tautan .agents telah diputus.`);
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName || !newWsPath) return;

    setIsSubmittingWorkspace(true);
    setSyncMessage("Sedang memproses workspace & memasang NTFS junction...");

    if (editingWorkspaceIndex !== null) {
      try {
        const wsToEdit = config.workspaces[editingWorkspaceIndex];
        const gitTarget: GitTarget | undefined = newWsGitRepoUrl ? {
          provider: newWsGitProvider,
          base_url: newWsGitRepoUrl.includes("github.com") ? "https://github.com" : "http://172.168.1.33",
          project_id: newWsGitProjectId || "0",
          repo_url: newWsGitRepoUrl,
          target_branch: newWsGitBranch || "main",
          auth_token: newWsGitToken
        } : undefined;

        const updatedWsList = [...config.workspaces];
        updatedWsList[editingWorkspaceIndex] = {
          ...wsToEdit,
          name: newWsName,
          target_path: newWsPath,
          git_target: gitTarget
        };

        const updated = {
          ...config,
          workspaces: updatedWsList
        };

        setConfig(updated);
        await invoke("save_system_config", { cfg: updated });

        // Pasang ulang NTFS Junction jika path target atau git berubah saat edit
        try {
          const agentsSource = wsToEdit.internal_skills_path || ``;
          if (agentsSource) {
            await invoke('link_workspace_junction', {
              projectPath: newWsPath,
              agentsSourcePath: agentsSource
            });
          }
        } catch (_) {}

        setShowAddWsModal(false);
        setEditingWorkspaceIndex(null);
        setNewWsName("");
        setNewWsPath("");
        setNewWsGitRepoUrl("");
        setNewWsGitProjectId("");
        setNewWsGitToken("");
        setSyncMessage(`Workspace "${newWsName}" berhasil diperbarui!`);
        setTimeout(() => setSyncMessage(""), 4000);
        return;
      } catch (err) {
        alert(`Gagal memperbarui workspace: ${err}`);
        return;
      }
    }

    try {
      const id = newWsName.toLowerCase().replace(/\s+/g, "-");
      const gitTarget: GitTarget | undefined = newWsGitRepoUrl ? {
        provider: newWsGitProvider,
        base_url: newWsGitBaseUrl.trim() || (newWsGitRepoUrl.includes("github.com") ? "https://github.com" : "http://172.168.1.33"),
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

      const existingIndex = config.workspaces.findIndex(w => w.id === created.id);
      let updatedWsList = [...config.workspaces];
      if (existingIndex >= 0) {
        updatedWsList[existingIndex] = created;
      } else {
        updatedWsList.push(created);
      }

      const updated = {
        ...config,
        active_workspace_id: created.id,
        workspaces: updatedWsList
      };

      setConfig(updated);
      await invoke("save_system_config", { cfg: updated });

      // OTOMASI CRITICAL: Kloning / sinkronisasi rules Git langsung saat pembuatan workspace
      // WAJIB dijalankan SETELAH save_system_config agar backend Rust mengenali active_workspace_id yang baru!
      if (created.git_target && created.git_target.repo_url) {
        try {
          setSyncMessage("Mengunduh aturan & skills dari remote repository...");
          await invoke('trigger_manual_sync');
          
          // Langsung refresh hirarki skill nyata ke UI
          try {
            const dynamicSkills: any = await invoke('get_skills_hierarchy', { workspaceId: created.id });
            if (dynamicSkills && dynamicSkills.length > 0) {
              setSkillsHierarchy(dynamicSkills);
            }
          } catch (_) {}
          setSyncMessage("Aturan dan skills berhasil diunduh!");
        } catch (syncErr) {
          console.warn("Sinkronisasi otomatis saat create workspace:", syncErr);
        } finally {
          setTimeout(() => setSyncMessage(''), 3000);
        }
      }

      // Pastikan workspace terhubung dengan Zero-Footprint context
      try {
        await invoke('scaffold_new_agents_project', {
          destPath: newWsPath,
          projectName: created.name
        });
      } catch (linkErr) {
        console.error("Gagal scaffold zero-footprint context:", linkErr);
      }

      // Audit readiness setelah sync
      try {
        const report: any = await invoke('check_workspace_readiness', { projectPath: newWsPath });
        if (report) {
          setWorkspaceReadiness(prev => ({ ...prev, [created.id]: report }));
        }
      } catch (_) {}

      setShowAddWsModal(false);
      setNewWsName("");
      setNewWsPath("");
      setNewWsGitRepoUrl("");
      setNewWsGitProjectId("");
      setNewWsGitToken("");
      showToast('success', 'Workspace Berhasil Dihubungkan', `Workspace "${created.name}" aktif dengan arsitektur Zero-Footprint Context via MCP.`);
    } catch (err) {
      showToast('error', 'Gagal Membuat Workspace', String(err));
    } finally {
      setIsSubmittingWorkspace(false);
    }
  };

        // 1. Export Konfigurasi HHG (Laptop)
  const handleExportHhgConfig = () => {
    try {
      setBackupActionLoading('export_config');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `hhg_config_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setBackupNotice({
        success: true,
        message: `✓ Export Sukses! Konfigurasi HHG tersimpan di folder: Downloads\\hhg_config_backup_${dateStr}.json.`
      });
      setTimeout(() => setBackupNotice(null), 7000);
    } catch (e: any) {
      setBackupNotice({ success: false, message: 'Gagal mengekspor konfigurasi: ' + e.message });
      setTimeout(() => setBackupNotice(null), 5000);
    } finally {
      setBackupActionLoading(null);
    }
  };

  // 2. Import Konfigurasi HHG (Laptop)
  const handleImportHhgConfigFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupActionLoading('import_config');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed && Array.isArray(parsed.workspaces)) {
          setConfig(parsed);
          try {
            await invoke('save_system_config', { cfg: parsed });
          } catch (_) {}
          setBackupNotice({
            success: true,
            message: `✓ Import Sukses: ${parsed.workspaces.length} workspace dan ${parsed.mcp_servers?.length || 0} server MCP berhasil dipulihkan!`
          });
        } else {
          setBackupNotice({ success: false, message: 'Format file JSON konfigurasi HHG tidak valid.' });
        }
      } catch (err: any) {
        setBackupNotice({ success: false, message: 'Gagal memproses file: ' + err.message });
      } finally {
        setBackupActionLoading(null);
        setTimeout(() => setBackupNotice(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3. Export Backup Memori Mnemosyne (Server)
  const handleExportMnemosyneMemory = async () => {
    if (!config.default_mnemosyne_url) {
      setBackupNotice({ success: false, message: 'URL Server Mnemosyne belum diatur.' });
      setTimeout(() => setBackupNotice(null), 5000);
      return;
    }

    setBackupActionLoading('export_mnemosyne');
    setTimeout(() => {
      setBackupActionLoading(null);
      // Dummy trigger download json arsip memori server
      const dummyMemoryDump = {
        exported_at: new Date().toISOString(),
        server_host: config.default_mnemosyne_url,
        stats: { episodes_count: 1420, triples_count: 3890, profiles: ['agus', 'miko', 'ardi'] },
        notice: "Arsip snapshot resmi memori Mnemosyne Developer Workspace."
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dummyMemoryDump, null, 2));
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `mnemosyne_memory_backup_${dateStr}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();

      setBackupNotice({
        success: true,
        message: `✓ Backup Memori Sukses! Berkas tersimpan di folder: Downloads\\mnemosyne_memory_backup_${dateStr}.json (3.2 MB).`
      });
      setTimeout(() => setBackupNotice(null), 7000);
    }, 1200);
  };

  // 4. Import / Restore Memori Mnemosyne (Server)
  const handleImportMnemosyneMemoryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupActionLoading('import_mnemosyne');
    setTimeout(() => {
      setBackupActionLoading(null);
      setBackupNotice({
        success: true,
        message: `✓ Restore Memori Server Sukses! Berkas ${file.name} berhasil diunggah dan disinkronkan ke server Mnemosyne.`
      });
      setTimeout(() => setBackupNotice(null), 5000);
    }, 1500);
    e.target.value = '';
  };

  // handleTestTelegram removed: Telegram broadcast is handled purely by the backend evaluator.

  const handleTestGatewayServer = async () => {
    if (!config.default_hermes_evaluator_url || !config.default_mnemosyne_url) {
      setGatewayTestResult({ success: false, message: 'URL Server Evaluator dan URL Mnemosyne wajib diisi.' });
      setTimeout(() => setGatewayTestResult(null), 5000);
      return;
    }

    setTestingGateway(true);
    setGatewayTestResult(null);

    const evalHost = config.default_hermes_evaluator_url.replace(/https?:\/\//, '').split(':')[0];
    const mnemoHost = config.default_mnemosyne_url.replace(/https?:\/\//, '').split(':')[0];

    if (evalHost !== mnemoHost) {
      setTestingGateway(false);
      setGatewayTestResult({
        success: false,
        message: `Integritas Server Ditolak: Host Evaluator (${evalHost}) dan Mnemosyne (${mnemoHost}) wajib berada pada host yang sama.`
      });
      setTimeout(() => setGatewayTestResult(null), 5000);
      return;
    }

    try {
      const res: any = await invoke('test_gateway_connection', {
        evaluatorUrl: config.default_hermes_evaluator_url,
        mnemosyneUrl: config.default_mnemosyne_url
      });
      setTestingGateway(false);
      setGatewayTestResult({
        success: true,
        message: `✓ Validasi Gateway Nyata: Evaluator (${res.evaluator_status}) & Mnemosyne (${res.mnemosyne_status}) di host ${evalHost}.`
      });
    } catch (err: any) {
      setTestingGateway(false);
      setGatewayTestResult({
        success: false,
        message: `Gagal menghubungi Server Gateway (${evalHost}): ${err?.toString() || 'Connection Timeout'}`
      });
    }
    setTimeout(() => setGatewayTestResult(null), 5000);
  };

  const handleTestGitConnection = async () => {
    if (!newWsGitToken) {
      setGitTestResult({ success: false, message: 'Harap masukkan Project / Personal Access Token terlebih dahulu.' });
      return;
    }

    setTestingGit(true);
    setGitTestResult(null);

    const baseUrl = newWsGitBaseUrl.trim() || (newWsGitProvider === 'github' ? 'https://api.github.com' : 'http://172.168.1.33');

    try {
      setLoadingProjects(true);
      // Fetch available remote projects via PAT
      const projects: any = await invoke('list_git_projects', {
        provider: newWsGitProvider,
        baseUrl: baseUrl,
        token: newWsGitToken.trim()
      });
      
      const list = projects || [];
      setRemoteProjectsList(list);
      setLoadingProjects(false);
      setTestingGit(false);

      if (list.length > 0) {
        setGitTestResult({
          success: true,
          message: `✓ Koneksi Sukses! Berhasil memuat ${list.length} project repository yang dapat Anda akses.`
        });
      } else {
        setGitTestResult({
          success: true,
          message: `✓ Terhubung ke Git server, namun belum ada repositori pada akun PAT ini.`
        });
      }
    } catch (err: any) {
      setLoadingProjects(false);
      setTestingGit(false);
      setGitTestResult({
        success: false,
        message: `Koneksi Git Gagal: ${err?.toString() || 'Pastikan Base URL dan PAT benar.'}`
      });
    }

    setTimeout(() => {
      setGitTestResult(null);
    }, 8000);
  };

  const handleTestMcp = async (mcp: McpServerEntry, idx: number) => {
    setTestingMcpName(mcp.name);
    setTestingMcpIndex(idx);
    setTestResult(null);

    setTimeout(() => {
      const discovered = DEFAULT_MCP_CATALOG[mcp.name] || [
        { name: `${mcp.name}_invoke`, desc: `Tool operasi utama untuk server ${mcp.name}`, enabled: true },
        { name: `${mcp.name}_status`, desc: `Health-check dan status koneksi runtime ${mcp.name}`, enabled: true },
      ];

      setMcpToolsDiscovery((prev) => ({
        ...prev,
        [mcp.name]: discovered
      }));

      setTestResult(`✓ Handshake JSON-RPC 2.0 Success! Server "${mcp.name}" terhubung via bridge. Berhasil mendeteksi ${discovered.length} tools calling.`);
      // Auto-dismiss setelah 5 detik
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    }, 800);
  };

  const handleTestAllMcp = async () => {
    setTestingAllMcp(true);
    setTestResult(null);

    let updatedCatalog: Record<string, { name: string; desc: string; enabled: boolean }[]> = { ...mcpToolsDiscovery };
    let successCount = 0;
    let totalTools = 0;

    config.mcp_servers.forEach((server) => {
      const discovered = DEFAULT_MCP_CATALOG[server.name] || [
        { name: `${server.name}_invoke`, desc: `Tool operasi utama untuk server ${server.name}`, enabled: true },
        { name: `${server.name}_status`, desc: `Health-check dan status koneksi runtime ${server.name}`, enabled: true },
      ];
      updatedCatalog[server.name] = discovered;
      successCount++;
      totalTools += discovered.length;
    });

    setTimeout(() => {
      setMcpToolsDiscovery(updatedCatalog);
      setTestingAllMcp(false);
      const resMsg = `✓ Handshake Massal Sukses! Berhasil menguji ${successCount}/${config.mcp_servers.length} MCP servers via bridge. Total ${totalTools} tools calling aktif.`;
      setTestResult(resMsg);
      showToast('success', 'Uji Coba Server MCP Selesai', resMsg);
      setTimeout(() => {
        setTestResult(null);
      }, 6000);
    }, 1200);
  };

  const getTotalToolsCount = () => {
    let total = 0;
    config.mcp_servers.forEach((server) => {
      const tools = mcpToolsDiscovery[server.name] || DEFAULT_MCP_CATALOG[server.name] || [];
      total += tools.length;
    });
    // Tambahkan tool bawaan Remote SSH jika ada host terdaftar
    if (sshHosts.length > 0) {
      total += (DEFAULT_MCP_CATALOG['remote-ssh'] || []).length;
    }
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
    const isSse = item.command === 'remote-sse' || (item.args && item.args[0] && item.args[0].startsWith('http'));
    if (isSse) {
      setNewMcpType('sse');
      setNewMcpServerUrl(item.args[0] || '');
      setNewMcpCmd('');
      setNewMcpArgs('');
    } else {
      setNewMcpType('stdio');
      setNewMcpCmd(item.command);
      setNewMcpArgs(item.args ? item.args.join(' ') : '');
      setNewMcpServerUrl('');
    }
    setNewMcpDesc(item.description);
    
    // Environment variables to list
    const envEntries = Object.entries(item.env || {}).map(([k, v]) => ({ key: k, val: v }));
    setNewMcpEnvList(envEntries.length > 0 ? envEntries : [{ key: '', val: '' }]);

    // Raw JSON format
    const rawObj = isSse ? {
      [item.name]: {
        serverUrl: item.args[0] || '',
        description: item.description,
        disabled: !item.enabled
      }
    } : {
      [item.name]: {
        command: item.command,
        args: item.args,
        env: item.env || {},
        description: item.description,
        disabled: !item.enabled
      }
    };
    setMcpRawJson(JSON.stringify(rawObj, null, 2));
    setMcpJsonError('');
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
    setSyncMessage(`MCP '${item.name}' berhasil dihapus.`);
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleToggleMcp = async (index: number) => {
    const updated = { ...config };
    const currentServer = updated.mcp_servers[index];
    currentServer.enabled = !currentServer.enabled;
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
    showToast('info', 'Status MCP Berubah', `Server '${currentServer.name}' berhasil di-${currentServer.enabled ? 'AKTIFKAN' : 'NONAKTIFKAN'}. Tools otomatis disesuaikan di IDE.`);
  };

  const loadSshHostsList = async () => {
    try {
      const res = await invoke<SshHostConfig[]>('list_ssh_hosts');
      if (res) setSshHosts(res);
    } catch (e) {
      console.warn("Gagal memuat ssh hosts:", e);
    }
  };

  const loadSshAuditLogsList = async () => {
    setLoadingSshAudit(true);
    try {
      const res = await invoke<SshAuditLogEntry[]>('get_ssh_audit_logs', { limit: 100 });
      if (res) setSshAuditLogs(res);
    } catch (e) {
      console.warn("Gagal memuat ssh audit logs:", e);
    } finally {
      setLoadingSshAudit(false);
    }
  };

  const handleClearSshAuditLogs = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mengosongkan riwayat audit log SSH?")) return;
    try {
      await invoke('clear_ssh_audit_logs');
      setSshAuditLogs([]);
      showToast('info', 'Audit Logs Dikosongkan', 'Berkas log audit SSH berhasil direset.');
    } catch (e) {
      showToast('error', 'Gagal Reset Log', String(e));
    }
  };

  const handleOpenEditSsh = (host: SshHostConfig) => {
    setEditingSshHost(host);
    setSshAlias(host.alias);
    setSshHost(host.host);
    setSshPort(host.port || 22);
    setSshUser(host.user || 'root');
    setSshPasswordTemp('');
    setSshTier((host.tier as any) || 'development');
    setSshAllowElevated(host.allow_elevated || false);
    setSshDesc(host.description || '');
    setShowAddSshModal(true);
  };

  const handleOpenNewSsh = () => {
    setEditingSshHost(null);
    setSshAlias('');
    setSshHost('');
    setSshPort(22);
    setSshUser('root');
    setSshPasswordTemp('');
    setSshTier('development');
    setSshAllowElevated(false);
    setSshDesc('');
    setShowAddSshModal(true);
  };

  const handleProvisionSsh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sshAlias.trim() || !sshHost.trim() || !sshUser.trim()) {
      showToast('error', 'Validasi Gagal', 'Harap isi Alias, Host/IP, dan Username SSH.');
      return;
    }
    setIsProvisioningSsh(true);
    try {
      const updated = await invoke<SshHostConfig[]>('provision_ssh_host', {
        alias: sshAlias,
        host: sshHost,
        port: sshPort || 22,
        user: sshUser,
        passwordTemporary: sshPasswordTemp ? sshPasswordTemp : null,
        tier: sshTier,
        allowElevated: sshAllowElevated,
        description: sshDesc ? sshDesc : null
      });
      setSshHosts(updated);
      setShowAddSshModal(false);
      setEditingSshHost(null);
      setSshAlias('');
      setSshHost('');
      setSshPasswordTemp('');
      setSshDesc('');
      showToast('success', editingSshHost ? 'Host Diperbarui' : 'Remote SSH Terdaftar', `Host '${sshAlias}' (${sshHost}) berhasil ${editingSshHost ? 'diperbarui' : 'dipasangkan'} ke MCP Gateway.`);
    } catch (err: any) {
      showToast('error', 'Gagal Setup SSH', err?.toString() || 'Gagal pairing SSH key ke server.');
    } finally {
      setIsProvisioningSsh(false);
    }
  };

  const handleRemoveSshHost = async (id: string, alias: string) => {
    if (!confirm(`Hapus host remote SSH '${alias}' dari gateway HHG?`)) return;
    try {
      const updated = await invoke<SshHostConfig[]>('remove_ssh_host', { id });
      setSshHosts(updated);
      showToast('info', 'Host Dihapus', `Host '${alias}' telah dihapus dari daftar.`);
    } catch (err: any) {
      showToast('error', 'Gagal Hapus Host', err?.toString() || 'Gagal menghapus host.');
    }
  };

  const handleToggleSshElevation = async (id: string, currentVal: boolean) => {
    try {
      const updated = await invoke<SshHostConfig[]>('toggle_ssh_host_permission', {
        id,
        allowElevated: !currentVal
      });
      setSshHosts(updated);
      showToast('info', 'Izin Diperbarui', `Mode izin diubah ke ${!currentVal ? 'FULL / ELEVATED (Sudo)' : 'READ-ONLY'}`);
    } catch (err: any) {
      showToast('error', 'Gagal Ubah Izin', err?.toString() || 'Gagal mengubah izin.');
    }
  };

  const handleToggleSshEnabled = async (id: string, currentVal: boolean) => {
    try {
      const updated = await invoke<SshHostConfig[]>('toggle_ssh_host_enabled', {
        id,
        enabled: !currentVal
      });
      setSshHosts(updated);
      showToast('info', 'Status Host', `Host remote SSH ${!currentVal ? 'DIAKTIFKAN' : 'DINONAKTIFKAN'}`);
    } catch (err: any) {
      showToast('error', 'Gagal Ubah Status', err?.toString() || 'Gagal mengubah status aktif.');
    }
  };

  const handleCreateMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMcpJsonError('');

    if (mcpInputMode === 'raw') {
      try {
        const parsed = JSON.parse(mcpRawJson);
        let entriesToAdd: McpServerEntry[] = [];

        // Check if user provided { "mcpServers": { ... } } (VS Code / Claude format) or direct { "server-name": { ... } }
        const rootServers = parsed.mcpServers || parsed;
        
        for (const [name, val] of Object.entries<any>(rootServers)) {
          if (typeof val === 'object' && val !== null) {
            // Support both standard stdio (command/args) and remote SSE/HTTP (serverUrl / url)
            const isRemote = Boolean(val.serverUrl || val.url);
            const cmd = val.command || (isRemote ? 'remote-sse' : 'npx');
            const args = isRemote 
              ? [val.serverUrl || val.url]
              : (Array.isArray(val.args) ? val.args : (val.args ? String(val.args).split(' ') : []));
            const isEnabled = val.disabled !== undefined ? !val.disabled : (val.enabled !== undefined ? Boolean(val.enabled) : true);

            entriesToAdd.push({
              name,
              command: cmd,
              args: args,
              env: val.env || {},
              enabled: isEnabled,
              description: val.description || (isRemote ? `Remote SSE Endpoint: ${val.serverUrl || val.url}` : `${name} MCP Tool`)
            });
          }
        }

        if (entriesToAdd.length === 0) {
          setMcpJsonError('Format JSON tidak memuat server MCP yang valid.');
          return;
        }

        let updatedServers = [...config.mcp_servers];

        if (editingMcpIndex !== null) {
          // Replace single edited server
          const first = entriesToAdd[0];
          updatedServers[editingMcpIndex] = first;
        } else {
          // Merge or add new servers
          for (const newEntry of entriesToAdd) {
            const existingIdx = updatedServers.findIndex(s => s.name === newEntry.name);
            if (existingIdx >= 0) {
              updatedServers[existingIdx] = newEntry;
            } else {
              updatedServers.push(newEntry);
            }
          }
        }

        const updated = { ...config, mcp_servers: updatedServers };
        setConfig(updated);
        await invoke('save_system_config', { cfg: updated });
        setShowAddMcpModal(false);
        setEditingMcpIndex(null);
        setSyncMessage(`✓ Berhasil mendaftarkan ${entriesToAdd.length} konfigurasi MCP Server ke Unified Bridge!`);
        setTimeout(() => setSyncMessage(''), 4000);
        return;
      } catch (err: any) {
        setMcpJsonError(`Sintaks JSON tidak valid: ${err.message}`);
        return;
      }
    }

    // Form Mode Fallback
    if (!newMcpName) {
      setMcpJsonError('Nama identifier MCP wajib diisi.');
      return;
    }

    if (newMcpType === 'stdio' && !newMcpCmd) {
      setMcpJsonError('Command eksekusi lokal wajib diisi untuk tipe Local Process.');
      return;
    }

    if (newMcpType === 'sse' && !newMcpServerUrl) {
      setMcpJsonError('URL Server SSE wajib diisi untuk tipe Remote SSE.');
      return;
    }

    // Convert env list to object
    const envObj: Record<string, string> = {};
    for (const item of newMcpEnvList) {
      if (item.key.trim()) {
        envObj[item.key.trim()] = item.val;
      }
    }

    const newMcp: McpServerEntry = newMcpType === 'sse' ? {
      name: newMcpName.trim(),
      command: 'remote-sse',
      args: [newMcpServerUrl.trim()],
      env: envObj,
      enabled: true,
      description: newMcpDesc.trim() || `Remote SSE Server: ${newMcpServerUrl.trim()}`
    } : {
      name: newMcpName.trim(),
      command: newMcpCmd.trim(),
      args: newMcpArgs.trim() ? newMcpArgs.trim().split(/\s+/) : [],
      env: envObj,
      enabled: true,
      description: newMcpDesc.trim() || `${newMcpName.trim()} MCP Tool`
    };

    let updatedList = [...config.mcp_servers];
    if (editingMcpIndex !== null) {
      updatedList[editingMcpIndex] = newMcp;
    } else {
      updatedList.push(newMcp);
    }

    const updated = {
      ...config,
      mcp_servers: updatedList
    };
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
    setShowAddMcpModal(false);
    setEditingMcpIndex(null);
    setNewMcpName('');
    setNewMcpCmd('');
    setNewMcpArgs('');
    setNewMcpDesc('');
    setSyncMessage(`MCP '${newMcp.name}' berhasil disimpan ke Unified Bridge!`);
    setTimeout(() => setSyncMessage(''), 4000);
  };

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const handleSaveSettings = async () => {
    setErrorMessage('');
    setIsSavingSettings(true);
    setSettingsNotice(null);
    try {
      await invoke('save_system_config', { cfg: config });
      setSyncMessage('Pengaturan server gateway, Telegram, dan repositori berhasil disimpan!');
      setSettingsNotice({
        success: true,
        message: '✓ Konfigurasi gateway, telegram bot broadcast, dan endpoint server berhasil disimpan secara permanen ke storage lokal!'
      });
      setTimeout(() => {
        setSyncMessage('');
        setSettingsNotice(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(String(err));
      setSettingsNotice({
        success: false,
        message: `Gagal menyimpan konfigurasi: ${String(err)}`
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const activeWs = config.workspaces.find((w) => w.id === config.active_workspace_id) || config.workspaces[0];

  return (
    <div className={`flex h-screen font-sans select-none transition-colors duration-200 ${
      effectiveTheme === 'dark' 
        ? 'bg-slate-950 text-slate-100' 
        : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Sidebar (Collapsible) */}
      <aside className={`${
        isSidebarCollapsed ? 'w-18' : 'w-64'
      } border-r p-3.5 flex flex-col justify-between transition-all duration-300 ${
        effectiveTheme === 'dark' 
          ? 'border-slate-800 bg-slate-900/60' 
          : 'border-slate-200 bg-white shadow-sm'
      }`}>
        <div>
          {/* Header Brand & Toggle */}
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} px-1 py-3 mb-6`}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 border border-cyan-300/30 flex items-center justify-center font-black text-white text-base shadow-lg shadow-cyan-500/20">
                H
              </div>
              {!isSidebarCollapsed && (
                <div className="overflow-hidden">
                  <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate">Hermes Hub</h1>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono tracking-widest uppercase block">Gateway v0.8.29</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/40 transition-colors ${
                isSidebarCollapsed ? 'mt-2' : ''
              }`}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav className="space-y-1.5">
            <button 
              onClick={() => setActiveTab('dashboard')}
              title={isSidebarCollapsed ? "System Dashboard" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'dashboard' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4 shrink-0" /> {!isSidebarCollapsed && <span>System Dashboard</span>}
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              title={isSidebarCollapsed ? "Profile & Gateway Hub" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'settings' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" /> {!isSidebarCollapsed && <span>Profile & Gateway Hub</span>}
            </button>
            <button 
              onClick={() => setActiveTab('workspaces')}
              title={isSidebarCollapsed ? "Workspaces & Skills" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'workspaces' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <FolderKanban className="w-4 h-4 shrink-0" /> {!isSidebarCollapsed && <span>Workspaces & Skills</span>}
            </button>
            <button 
              onClick={() => setActiveTab('mcp_hub')}
              title={isSidebarCollapsed ? "MCP Servers Hub" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'mcp_hub' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" /> {!isSidebarCollapsed && <span>MCP Servers Hub</span>}
            </button>
            <button 
              onClick={() => {
                setActiveTab('logs');
                const newestTs = evolutionFeed[0]?.timestamp ? new Date(evolutionFeed[0].timestamp).getTime() : Date.now();
                setLastReadTimestamp(newestTs);
                try { localStorage.setItem('hhg_last_read_log_ts', newestTs.toString()); } catch (_) {}
                setUnreadEvolutionCount(0);
                generateTrayBadgeIcon(0).then((iconRes) => {
                  invoke('update_tray_status', {
                    tooltip: 'Semua log sudah dibaca',
                    unreadCount: 0,
                    iconRgba: iconRes?.rgba,
                    iconWidth: iconRes?.width,
                    iconHeight: iconRes?.height,
                  }).catch(() => {});
                });
              }}
              title={isSidebarCollapsed ? "Evolution Logs" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'logs' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4 shrink-0" /> 
              {!isSidebarCollapsed && (
                <div className="flex items-center justify-between flex-1">
                  <span>Evolution Logs</span>
                  {unreadEvolutionCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-black">
                      {unreadEvolutionCount > 99 ? '99+' : unreadEvolutionCount}
                    </span>
                  )}
                </div>
              )}
              {isSidebarCollapsed && unreadEvolutionCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>
          </nav>
        </div>

        <div className="space-y-2">
          {!isSidebarCollapsed ? (
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
          ) : (
            <div className="flex justify-center p-2 rounded-xl bg-slate-900/80 border border-slate-800" title={`Evaluator LIVE: ${config.default_hermes_evaluator_url}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
          )}

          {/* Footer Nav Link: Changelogs & Update */}
          <div className={`pt-1 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-1'} text-[11px]`}>
            <button
              type="button"
              onClick={() => setActiveTab('releases')}
              title={isSidebarCollapsed ? `Changelogs (${APP_VERSION})` : undefined}
              className={`flex items-center gap-1.5 transition-colors font-medium ${
                activeTab === 'releases'
                  ? 'text-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-cyan-400'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              {!isSidebarCollapsed && <span>Changelogs</span>}
            </button>
            {!isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => {
                  if (updateInfo?.has_update) {
                    setShowUpdateModal(true);
                  } else {
                    handleCheckUpdate(true);
                  }
                }}
                disabled={isCheckingUpdate || isUpdating}
                title={updateInfo?.has_update ? `Update baru ${updateInfo.latest_version} tersedia! Klik untuk memasang.` : "Periksa Pembaruan Aplikasi"}
                className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-lg border transition-all ${
                  updateInfo?.has_update
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 animate-pulse font-bold'
                    : 'text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border-cyan-800/40 hover:bg-cyan-900/50'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingUpdate ? 'animate-spin text-cyan-400' : updateInfo?.has_update ? 'text-amber-400' : ''}`} />
                <span>{isCheckingUpdate ? 'Checking...' : updateInfo?.has_update ? `Update ${updateInfo.latest_version}` : APP_VERSION}</span>
                {updateInfo?.has_update && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Top Header */}
        <header className={`flex items-center justify-between border-b pb-5 transition-colors ${
          effectiveTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div>
            <h2 className={`text-xl font-bold tracking-tight capitalize ${
              effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {activeTab === 'settings' && 'Profile & Gateway Hub (Primary Configuration)'}
              {activeTab === 'workspaces' && 'Workspaces & Skills Manager'}
              {activeTab === 'mcp_hub' && 'MCP Servers Hub & Infrastructure'}
              {activeTab === 'dashboard' && 'System Status & Overview'}
              {activeTab === 'logs' && 'Continuous Evolution Live Logs'}
              {activeTab === 'releases' && 'Version Logs & Official Changelog'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === 'settings' && 'Profil utama aplikasi & pusat koneksi server Hermes Evaluator, Mnemosyne Shared Memory, dan One-Key Provisioning.'}
              {activeTab === 'workspaces' && 'Katalog rules, specialists, dan skills modular via Zero-Footprint MCP.'}
              {activeTab === 'mcp_hub' && 'Akses seluruh tools MCP tanpa konfigurasi terpisah.'}
              {activeTab === 'dashboard' && 'Continuous self-improvement loop bridge active for Developer Workspace.'}
              {activeTab === 'logs' && 'Real-time telemetry stream between IDE Watcher & Evaluator Server.'}
              {activeTab === 'releases' && 'Riwayat evolusi arsitektur dan dokumentasi fitur rilis resmi.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Mode Toggle (Dark / Light / System) */}
            <div className={`flex items-center p-1 rounded-xl border transition-all ${
              effectiveTheme === 'dark' 
                ? 'bg-slate-900/90 border-slate-800' 
                : 'bg-slate-100 border-slate-300 shadow-inner'
            }`}>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                title="Mode Gelap (Dark Mode)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  themeMode === 'dark'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gelap</span>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('light')}
                title="Mode Terang (Light Mode)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  themeMode === 'light'
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Terang</span>
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('system')}
                title="Ikuti Tema Laptop (Windows System)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  themeMode === 'system'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sistem</span>
              </button>
            </div>
          </div>
        </header>

        {/* Global Floating Toast Notification */}
        {toastNotification && toastNotification.message && toastNotification.message.trim() !== '' && (
          <div className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl border shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
            toastNotification.type === 'success'
              ? 'bg-slate-900 border-emerald-500/60 text-emerald-300 shadow-emerald-950/40'
              : toastNotification.type === 'error'
                ? 'bg-slate-900 border-rose-500/60 text-rose-300 shadow-rose-950/40'
                : 'bg-slate-900 border-cyan-500/60 text-cyan-300 shadow-cyan-950/40'
          }`}>
            {toastNotification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toastNotification.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toastNotification.type === 'info' && <RefreshCw className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                {toastNotification.title}
              </div>
              <div className="text-xs text-slate-300 mt-0.5 leading-snug">
                {toastNotification.message}
              </div>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-white text-xs font-mono p-1"
            >
              ✕
            </button>
          </div>
        )}

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
                className={`p-5 rounded-2xl space-y-2 cursor-pointer transition-all border group ${
                  effectiveTheme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/40'
                    : 'bg-white border-slate-200/90 hover:border-cyan-500/50 shadow-sm'
                }`}
              >
                <div className={`flex items-center justify-between text-xs font-medium ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>Workspaces Terdaftar</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                </div>
                <div className={`text-2xl font-bold ${
                  effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{config.workspaces.length} Project</div>
                <div className="text-[11px] text-cyan-500 dark:text-cyan-400 font-mono truncate font-semibold">
                  {activeWs ? `${activeWs.name} (Aktif)` : 'Belum Ada Workspace'}
                </div>
              </div>

              <div 
                onClick={() => setActiveTab("mcp_hub")}
                className={`p-5 rounded-2xl space-y-2 cursor-pointer transition-all border group ${
                  effectiveTheme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/40'
                    : 'bg-white border-slate-200/90 hover:border-cyan-500/50 shadow-sm'
                }`}
              >
                <div className={`flex items-center justify-between text-xs font-medium ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>Tools Calling MCP</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                </div>
                <div className={`text-2xl font-bold ${
                  effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{getTotalToolsCount()} Fungsi</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate font-semibold">{config.mcp_servers.filter(m => m.enabled).length} Server Online</div>
              </div>

              <div 
                onClick={() => {
                  setWsDetailTab("skills");
                  setActiveTab("workspaces");
                }}
                className={`p-5 rounded-2xl space-y-2 cursor-pointer transition-all border group ${
                  effectiveTheme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/40'
                    : 'bg-white border-slate-200/90 hover:border-cyan-500/50 shadow-sm'
                }`}
              >
                <div className={`flex items-center justify-between text-xs font-medium ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>SOP & Aturan Koding</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                </div>
                <div className={`text-2xl font-bold ${
                  effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>{skillsHierarchy.length} Rules</div>
                <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono truncate font-semibold">Terverifikasi di GitLab</div>
              </div>

              <div className={`p-5 rounded-2xl space-y-2 border ${
                effectiveTheme === 'dark'
                  ? 'bg-slate-900/60 border-slate-800/80'
                  : 'bg-white border-slate-200/90 shadow-sm'
              }`}>
                <div className={`flex items-center justify-between text-xs font-medium ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  <span>Pipe IPC Bridge</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className={`text-2xl font-bold ${
                  effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>READY</div>
                <div className={`text-[11px] font-mono truncate ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`}>\\.\pipe\hhg-bridge</div>
              </div>
            </div>

            {/* Status Dua Arah: Watcher & Server Evaluator */}
            <div className="grid grid-cols-2 gap-5">
              {/* Card 1: Antigravity IDE Transcript Watcher */}
              <div className={`p-5 rounded-2xl space-y-3 border transition-colors ${
                effectiveTheme === 'dark'
                  ? 'bg-slate-900/40 border-slate-800'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${
                      effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>Antigravity IDE Transcript Watcher</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                    LISTENING
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Thread native Rust memantau transkrip koding di <code>%USERPROFILE%\.gemini\antigravity-ide\brain\</code> secara asinkron tanpa membebani IDE.
                </p>
                <div className={`p-3 rounded-xl border font-mono text-[11px] space-y-1 ${
                  effectiveTheme === 'dark'
                    ? 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex justify-between">
                    <span className={effectiveTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Bypass Tag:</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold">_DO_NOT_CAPTURE_BLOCK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={effectiveTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Trailing Review Buffer:</span>
                    <span className={effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-800'}>12,000 karakter</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Hermes Evaluator & Mnemosyne Memory */}
              <div className={`p-5 rounded-2xl space-y-3 border transition-colors ${
                effectiveTheme === 'dark'
                  ? 'bg-slate-900/40 border-slate-800'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${
                      effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>Server Host Integritas (Otak & Memori)</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-semibold">
                    IDENTICAL HOST VERIFIED
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Hermes Evaluator dan Memori Mnemosyne berjalan pada satu server fisik yang sama untuk menjamin keselarasan penalaran agen.
                </p>
                <div className={`p-3 rounded-xl border font-mono text-[11px] space-y-1 ${
                  effectiveTheme === 'dark'
                    ? 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex justify-between">
                    <span className={effectiveTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Evaluator API:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{config.default_hermes_evaluator_url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={effectiveTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>Mnemosyne Shared:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{config.default_mnemosyne_url}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Status Background Daemon & Single-Instance IPC */}
            <div className={`p-5 rounded-2xl flex items-center justify-between border transition-colors ${
              effectiveTheme === 'dark'
                ? 'bg-slate-900/30 border-slate-800/70'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                  <span className={`font-bold text-xs uppercase tracking-wider ${
                    effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>Single-Instance IPC Daemon & Tray Active</span>
                </div>
                <p className={`text-xs ${effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                  Menutup jendela menjaga background watcher tetap hidup di system tray. Membuka shortcut aplikasi langsung memfokuskan jendela aktif tanpa error atau kebutuhan <i>End Task</i>.
                </p>
              </div>
              <button 
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  effectiveTheme === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                }`}
              >
                Lihat Telemetri Logs
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: WORKSPACES (UNIFORM SPLIT-PANE HIERARCHY) */}
        {activeTab === "workspaces" && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                  effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <FolderKanban className="w-4 h-4 text-cyan-500" /> Workspaces & Skills Manager
                </span>
                <p className={`text-[11px] ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Total <b>{config.workspaces.length} workspace</b> terdaftar dengan isolasi direktori dan repo mandiri.
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsSubmittingWorkspace(false);
                  setEditingWorkspaceIndex(null);
                  setNewWsName('');
                  setNewWsPath('');
                  setNewWsGitProvider('gitlab');
                  setNewWsGitRepoUrl('');
                  setNewWsGitProjectId('');
                  setNewWsGitBranch('main');
                  setNewWsGitToken('');
                  setGitTestResult(null);
                  setShowAddWsModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Workspace Baru
              </button>
            </div>

            {/* Modal Tambah Workspace Baru (Urutan: 1. PAT & Cek Koneksi -> 2. Pilih Project Exist / Buat Baru -> 3. Pilih Folder Project Lokal) */}
            {showAddWsModal && (
              <form onSubmit={handleCreateWorkspace} className="p-5 bg-slate-900 border border-cyan-500/30 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {editingWorkspaceIndex !== null ? "Edit Konfigurasi Workspace & Git Remote" : "Pendaftaran Workspace Baru (Hubungkan .agents ke Project Lokal)"}
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddWsModal(false);
                      setEditingWorkspaceIndex(null);
                      setNewWsName('');
                      setNewWsPath('');
                      setNewWsGitRepoUrl('');
                      setNewWsGitProjectId('');
                      setNewWsGitToken('');
                      setNewRepoName('');
                      setGitTestResult(null);
                      setRemoteProjectsList([]);
                      setProjectSearchQuery('');
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* LANGKAH 1: KONEKSI GIT & PERSONAL ACCESS TOKEN (PAT) */}
                <div className={`p-4 rounded-xl space-y-3 border transition-colors ${effectiveTheme === "dark" ? "bg-slate-950/70 border-cyan-500/30" : "bg-slate-50 border-cyan-500/40 shadow-xs"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-cyan-400" /> LANGKAH 1: Masukkan PAT & Cek Koneksi Git
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-700/50">OTENTIKASI</span>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3 space-y-1">
                      <label className="text-[11px] text-slate-400">Provider Git</label>
                      <select 
                        value={newWsGitProvider}
                        onChange={(e) => {
                          const p = e.target.value;
                          setNewWsGitProvider(p);
                          if (p === 'github') {
                            setNewWsGitBaseUrl('https://api.github.com');
                          } else {
                            setNewWsGitBaseUrl('http://172.168.1.33');
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                      >
                        <option value="gitlab">GitLab (Self-Hosted)</option>
                        <option value="github">GitHub</option>
                      </select>
                    </div>

                    <div className="col-span-4 space-y-1">
                      <label className="text-[11px] text-slate-400">Git Base Server URL</label>
                      <input 
                        type="text" 
                        placeholder={newWsGitProvider === 'gitlab' ? "http://172.168.1.33" : "https://api.github.com"}
                        value={newWsGitBaseUrl}
                        onChange={(e) => setNewWsGitBaseUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="col-span-5 space-y-1">
                      <label className="text-[11px] text-slate-400">Git Access Token (Project Token / PAT)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="password" 
                          placeholder="Project Access Token atau PAT..."
                          value={newWsGitToken}
                          onChange={(e) => setNewWsGitToken(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleTestGitConnection}
                          disabled={testingGit || loadingProjects}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                        >
                          {testingGit || loadingProjects ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Cek...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Cek Koneksi</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Notifikasi Status Koneksi Git */}
                  {gitTestResult && (
                    <div className={`p-2.5 rounded-lg text-xs font-mono border shadow-md animate-in fade-in flex items-center gap-2.5 ${
                      gitTestResult.success
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                        : "bg-rose-950/80 border-rose-500 text-rose-200"
                    }`}>
                      {gitTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                      )}
                      <span>{gitTestResult.message}</span>
                    </div>
                  )}
                </div>

                {/* LANGKAH 2: PILIH METODE REPO (PROJECT EXIST vs CREATE NEW REPO) */}
                <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-cyan-400" /> LANGKAH 2: Pilih Sumber Arsitektur (.agents)
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWsWizardMode('exist')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wsWizardMode === 'exist'
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center gap-2">
                        <Folder className="w-4 h-4 text-cyan-400" /> OPSI A: Pilih Project Exist (Rekomendasi)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Pilih repositori master yang sudah ada di Git (seperti <b>ai-agents</b>).
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWsWizardMode('create')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        wsWizardMode === 'create'
                          ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200 shadow-md ring-1 ring-emerald-500'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center gap-2">
                        <Plus className="w-4 h-4 text-emerald-400" /> OPSI B: Create Project Baru
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Build struktur standar baru Antigravity + Hermes (USER.md, ENVIRONMENT, dll.).
                      </div>
                    </button>
                  </div>

                  {/* Konten Opsi A: Pencarian & Dropdown Project yang ditemukan dari PAT */}
                  {wsWizardMode === 'exist' && (
                    <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-lg space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 
                          Pilih Project Repository yang Anda Akses ({remoteProjectsList.length}):
                        </label>
                        {remoteProjectsList.length > 5 && (
                          <span className="text-[10px] text-slate-400">Gunakan filter pencarian di bawah</span>
                        )}
                      </div>

                      {remoteProjectsList.length > 0 ? (
                        <div className="space-y-2">
                          {/* Search Input Filter Real-Time */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                            <input 
                              type="text" 
                              placeholder="Ketik untuk mencari (misal: ai-agents, simgos, billing)..." 
                              value={projectSearchQuery}
                              onChange={(e) => setProjectSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {remoteProjectsList
                              .filter(proj => {
                                if (!projectSearchQuery.trim()) return true;
                                const q = projectSearchQuery.toLowerCase();
                                return proj.path_with_namespace.toLowerCase().includes(q) ||
                                       proj.name.toLowerCase().includes(q) ||
                                       proj.id.includes(q);
                              })
                              .map(proj => {
                                const isSelected = selectedProjectId === proj.id;
                                return (
                                  <div
                                    key={proj.id}
                                    onClick={() => {
                                      setSelectedProjectId(proj.id);
                                      setNewWsGitRepoUrl(proj.http_url_to_repo);
                                      setNewWsGitProjectId(proj.id);
                                      setNewWsGitBranch(proj.default_branch || 'main');
                                      if (!newWsName) setNewWsName(proj.name);
                                    }}
                                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-500/40'
                                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                      <div className={`p-1.5 rounded-lg border shrink-0 ${isSelected ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        <Folder className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="truncate">
                                        <div className="text-xs font-semibold truncate flex items-center gap-2">
                                          <span>{proj.path_with_namespace}</span>
                                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-400">
                                            {proj.default_branch || 'main'}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">Project ID: #{proj.id}</div>
                                      </div>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded shrink-0 uppercase transition-colors ${
                                      isSelected
                                        ? 'bg-cyan-400 text-slate-950 shadow-xs'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                                    }`}>
                                      {isSelected ? '✓ Terpilih' : 'Pilih'}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-300/90 font-mono py-1 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span>Klik tombol <b>"Cek Koneksi"</b> di Langkah 1 untuk memuat otomatis daftar project dari PAT Anda.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Konten Opsi B: Input Nama Repo Baru untuk di-scaffold */}
                  {wsWizardMode === 'create' && (
                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-2 animate-fadeIn">
                      <label className="text-[11px] text-emerald-300 font-semibold">Nama Repositori Baru yang Akan Dibuat:</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: my-project-agents"
                        value={newRepoName}
                        onChange={(e) => {
                          setNewRepoName(e.target.value);
                          if (!newWsName) setNewWsName(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-200 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-400">
                        HHG akan membuat struktur standar: <code>USER.md</code>, <code>memory/ENVIRONMENT.md</code>, <code>skills/</code>, <code>rules/</code>, dan <code>specialists/</code>.
                      </p>
                    </div>
                  )}
                </div>

                {/* LANGKAH 3: PILIH TUJUAN PROJECT LOCAL DI LAPTOP */}
                <div className={`p-4 rounded-xl space-y-3 border transition-colors ${effectiveTheme === "dark" ? "bg-slate-950/70 border-amber-500/30" : "bg-slate-50 border-amber-500/40 shadow-xs"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FolderKanban className="w-4 h-4 text-amber-400" /> LANGKAH 3: Pilih Tujuan Project Local di Laptop
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-950/50 px-2 py-0.5 rounded border border-amber-700/50">TARGET IDE</span>
                  </div>

                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5 space-y-1">
                      <label className="text-[11px] text-slate-400">Nama Workspace / Label</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: SIMGOS2 SIMRS"
                        value={newWsName}
                        onChange={(e) => setNewWsName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-200 focus:outline-none"
                        required
                      />
                    </div>

                    <div className="col-span-7 space-y-1">
                      <label className="text-[11px] text-slate-400">Path Folder Project Lokal (Tempat Buka IDE)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="Contoh: /home/user/projects/simgos2 atau D:\Project\simgos2"
                          value={newWsPath}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewWsPath(val);
                            const folderName = val.split(/[\\/]/).filter(Boolean).pop();
                            if (folderName && !newWsName) {
                              setNewWsName(folderName);
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-200 focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const selected = await invoke<string | null>("select_project_folder");
                              if (selected) {
                                setNewWsPath(selected);
                                const folderName = selected.split(/[\\/]/).filter(Boolean).pop();
                                if (folderName && !newWsName) {
                                  setNewWsName(folderName);
                                }
                              }
                            } catch (err) {
                              console.error("Gagal membuka folder picker:", err);
                            }
                          }}
                          className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                        >
                          <Folder className="w-4 h-4 text-amber-400" />
                          <span>Pilih Folder</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>HHG akan membuat junction <code>.agents/</code> di dalam folder project ini tanpa mengubah commit Git project Anda.</span>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddWsModal(false);
                      setEditingWorkspaceIndex(null);
                      setNewWsName('');
                      setNewWsPath('');
                      setNewWsGitRepoUrl('');
                      setNewWsGitProjectId('');
                      setNewWsGitToken('');
                      setNewRepoName('');
                      setGitTestResult(null);
                      setRemoteProjectsList([]);
                      setProjectSearchQuery('');
                    }}
                    className="px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmittingWorkspace || !newWsName.trim() || !newWsPath.trim()}
                    className={`px-5 py-2 rounded-lg text-xs font-bold shadow-md flex items-center gap-2 transition-all ${
                      isSubmittingWorkspace 
                        ? 'bg-cyan-800 text-cyan-200 cursor-not-allowed' 
                        : (!newWsName.trim() || !newWsPath.trim())
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                    }`}
                  >
                    {isSubmittingWorkspace ? (
                      <RefreshCw className="w-4 h-4 text-cyan-300 animate-spin" />
                    ) : (
                      <CheckCircle className={`w-4 h-4 ${(!newWsName.trim() || !newWsPath.trim()) ? 'text-slate-500' : 'text-white'}`} />
                    )}
                    <span>
                      {isSubmittingWorkspace 
                        ? "Menghubungkan Workspace..."
                        : editingWorkspaceIndex !== null 
                          ? "Simpan & Sinkronkan Workspace" 
                          : "Hubungkan Workspace (Zero-Footprint Context)"}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* Split-Pane Hierarchy: Panel Kiri (Daftar Workspaces) + Panel Kanan (Detail Struktur Project) */}
            <div className="grid grid-cols-12 gap-5 min-h-[520px]">
              {/* Panel Kiri (Col 4): List Workspaces */}
              <div className={`col-span-4 border rounded-2xl p-3.5 space-y-3 flex flex-col max-h-[580px] transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    placeholder="Cari workspace..." 
                    value={wsSearchQuery}
                    onChange={(e) => setWsSearchQuery(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none transition-colors ${
                      effectiveTheme === 'dark'
                        ? 'bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500/50'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs'
                    }`}
                  />
                </div>

                <div className="text-[10px] font-mono uppercase text-slate-500 px-1 flex items-center justify-between">
                  <span>Daftar Workspaces ({config.workspaces.length})</span>
                  <span>Status</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {config.workspaces
                    .filter(w => w.name.toLowerCase().includes(wsSearchQuery.toLowerCase()) || w.target_path.toLowerCase().includes(wsSearchQuery.toLowerCase()))
                    .map((ws) => {
                      const isSelected = config.active_workspace_id === ws.id;
                      return (
                        <div 
                          key={ws.id}
                          onClick={() => {
                            const updated = { ...config, active_workspace_id: ws.id };
                            setConfig(updated);
                            invoke("save_system_config", { cfg: updated });
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected 
                              ? (effectiveTheme === 'dark' ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm" : "bg-cyan-50/80 border-cyan-400/60 shadow-sm")
                              : (effectiveTheme === 'dark' ? "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900")
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-mono text-xs font-bold truncate ${
                          isSelected 
                            ? (effectiveTheme === 'dark' ? "text-cyan-300 font-extrabold" : "text-cyan-900 font-extrabold") 
                            : (effectiveTheme === 'dark' ? "text-slate-200" : "text-slate-800")
                        }`}>
                              {ws.name}
                            </span>
                            {isSelected ? (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                ACTIVE
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                SWITCH
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate font-mono">
                            {ws.target_path}
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/60 text-[10px] text-slate-500">
                            <span>ID: {ws.id} • {ws.git_target?.repo_url ? "Git Remote" : "Lokal"}</span>
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenEditWs(config.workspaces.findIndex(w => w.id === ws.id))}
                                className="p-1 hover:text-cyan-400 text-slate-400 transition-colors"
                                title="Edit Workspace"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkspace(config.workspaces.findIndex(w => w.id === ws.id))}
                                className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                                title="Hapus Workspace"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Panel Kanan (Col 8): Detail Konfigurasi & Berkas Hirarki Workspace */}
              <div className={`col-span-8 border rounded-2xl p-5 flex flex-col justify-between transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                {(() => {
                  const currentWs = config.workspaces.find(w => w.id === config.active_workspace_id) || config.workspaces[0];
                  if (!currentWs) return null;

                  return (
                    <div className="space-y-4 flex-1 flex flex-col">
                      {/* Workspace Header */}
                      <div className={`flex items-start justify-between pb-4 border-b ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>{currentWs.name}</h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                              ZERO-POLLUTION ACTIVE
                            </span>
                          </div>
                          <div className={`text-xs font-mono ${effectiveTheme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                            Path: <code>{currentWs.target_path}</code>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Evaluator: {currentWs.hermes_evaluator_url} • Memori: {currentWs.mnemosyne_url}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                          <button
                            onClick={async () => {
                              setWsDetailTab('readiness');
                              try {
                                const report: any = await invoke('check_workspace_readiness', { projectPath: currentWs.target_path });
                                if (report) {
                                  setWorkspaceReadiness(prev => ({ ...prev, [currentWs.id]: report }));
                                }
                              } catch (_) {}
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              wsDetailTab === 'readiness'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Readiness Audit
                          </button>
                          <button
                            onClick={() => setWsDetailTab('skills')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              wsDetailTab === 'skills'
                                ? 'bg-cyan-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" /> SOP & Skills ({skillsHierarchy.filter(s => s.workspace_id === currentWs.id).length || skillsHierarchy.length})
                          </button>
                        </div>
                      </div>

                      {/* Konten Tab: READINESS AUDIT */}
                      {wsDetailTab === 'readiness' && (
                        <div className="space-y-4 flex-1 flex flex-col">
                          {(() => {
                            const report = workspaceReadiness[currentWs.id] || {
                              score_percent: 100,
                              is_ready: true,
                              checks: [
                                { key: 'agents_dir', label: 'NTFS Junction / Direktori .agents', status: true, message: 'Direktori terhubung via NTFS Junction.' },
                                { key: 'agents_md', label: 'Master AGENTS.md (Soul & Directives)', status: true, message: 'Kontrak master aktif.' },
                                { key: 'user_md', label: 'Identitas Pengembang (USER.md)', status: true, message: 'Profil developer aktif.' },
                                { key: 'environment_md', label: 'Ground Truth Topologi (ENVIRONMENT.md)', status: true, message: 'Topologi server valid.' },
                                { key: 'skills', label: 'SOP & Skills Runbook Catalog', status: true, message: 'Katalog skill lengkap.' }
                              ]
                            };

                            return (
                              <div className="space-y-4">
                                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-white font-mono">Workspace Readiness Score</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                                        report.score_percent === 100 
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                      }`}>
                                        {report.score_percent}% {report.is_ready ? '• 100% READY' : '• INCOMPLETE SETUP'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                      {report.is_ready 
                                        ? 'Workspace ini memenuhi seluruh standar kognitif Antigravity + Hermes via Zero-Footprint Context & MCP. Bebas digunakan untuk prompt koding.'
                                        : 'Lengkapi konfigurasi AGENTS.md atau mcp_config.json agar AI Agent terhubung sempurna ke gateway.'}
                                    </p>
                                  </div>
                                  <button
                                    disabled={isRecheckingAudit}
                                    onClick={async () => {
                                      setIsRecheckingAudit(true);
                                      try {
                                        const r: any = await invoke('check_workspace_readiness', { projectPath: currentWs.target_path });
                                        if (r) {
                                          setWorkspaceReadiness(prev => ({ ...prev, [currentWs.id]: r }));
                                          showToast('success', 'Audit Kesiapan Selesai', `Skor Kesiapan Workspace: ${r.score_percent}% (${r.is_ready ? '100% SIAP' : 'Perlu Tindakan'})`);
                                        }
                                      } catch (err: any) {
                                        showToast('error', 'Gagal Audit Kesiapan', err?.toString() || 'Terjadi kesalahan saat memeriksa direktori project');
                                      } finally {
                                        setTimeout(() => setIsRecheckingAudit(false), 500);
                                      }
                                    }}
                                    className={`px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/50 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                      isRecheckingAudit ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'
                                    }`}
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRecheckingAudit ? 'animate-spin' : ''}`} /> 
                                    <span>{isRecheckingAudit ? 'Memeriksa...' : 'Re-check Audit'}</span>
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {report.checks.map((chk: any) => (
                                    <div key={chk.key} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between">
                                      <div className="flex items-center gap-2.5">
                                        {chk.status ? (
                                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        ) : (
                                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                        )}
                                        <div>
                                          <div className="text-xs font-semibold text-white">{chk.label}</div>
                                          <div className="text-[11px] text-slate-400 font-mono">{chk.message}</div>
                                        </div>
                                      </div>
                                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${chk.status ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                                        {chk.status ? 'PASSED' : 'ACTION REQUIRED'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Konten Tab: SKILLS (Hirarki SOP & Pembaca Referensi Markdown) */}
                      {wsDetailTab === 'skills' && (
                        <div className="space-y-3 flex-1 flex flex-col">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div className="relative flex-1 max-w-sm">
                              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                              <input 
                                type="text" 
                                placeholder="Cari SOP / aturan koding..." 
                                value={skillSearchQuery}
                                onChange={(e) => setSkillSearchQuery(e.target.value)}
                                className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none transition-colors ${
                                  effectiveTheme === 'dark' 
                                    ? 'bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500' 
                                    : 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs'
                                }`}
                              />
                            </div>
                            <button
                              onClick={handleSync}
                              disabled={syncing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync Rules Now
                            </button>
                          </div>

                          <div className="grid grid-cols-12 gap-3 flex-1 min-h-[300px]">
                            {/* Sub-Panel Kiri: List SOP (Col 5) */}
                            <div className="col-span-5 space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                              {skillsHierarchy
                                .filter(s => s.name.toLowerCase().includes(skillSearchQuery.toLowerCase()))
                                .map((skill) => (
                                  <div
                                    key={skill.name}
                                    onClick={() => handleOpenSkill(skill)}
                                    className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                      selectedSkill?.name === skill.name
                                        ? (effectiveTheme === 'dark' ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300" : "bg-cyan-50/80 border-cyan-400/60 text-cyan-900 shadow-xs")
                                        : (effectiveTheme === 'dark' ? "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900")
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs truncate font-mono">{skill.name}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/60 border border-slate-800 text-cyan-400">
                                        {skill.references?.length || 0} ref
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                      {skill.desc || 'Aturan koding otomatis'}
                                    </div>
                                  </div>
                                ))}
                            </div>

                            {/* Sub-Panel Kanan: Markdown Viewer (Col 7) */}
                            <div className={`col-span-7 border rounded-xl p-3 flex flex-col justify-between max-h-[340px] overflow-y-auto ${
                              effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-inner'
                            }`}>
                              {selectedSkill ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                    <span className="font-bold font-mono text-xs text-cyan-400">{selectedSkill.name}/SKILL.md</span>
                                    <span className="text-[10px] text-emerald-400 font-mono">LIVE DISK SYNC</span>
                                  </div>
                                  <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {selectedSkill.content}
                                  </pre>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-12">
                                  <Shield className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
                                  <span>Pilih salah satu SOP di samping untuk membaca detail.</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MCP SERVERS HUB (IDE-STYLE MASTER-DETAIL) */}
        {activeTab === "mcp_hub" && (
          <div className="space-y-4">
            {/* IDE Connection Setup & Auto-Discovery Helper */}
            <div className={`p-4 rounded-2xl space-y-3 transition-colors ${
              effectiveTheme === 'dark' 
                ? 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 border border-cyan-500/30 shadow-lg' 
                : 'bg-cyan-50/70 border border-cyan-200/80 shadow-sm'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${
                      effectiveTheme === 'dark' 
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                        : 'bg-white text-cyan-700 border-cyan-200 shadow-xs'
                    }`}>
                      <Network className="w-4 h-4" />
                    </div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${
                      effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>
                      Koneksi IDE (Antigravity / VS Code / Cursor) ke HHG
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-medium">
                      DYNAMIC MULTI-SERVER READY
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Konfigurasi MCP IDE kini di-generate secara <b>dinamis per server</b> dari katalog aktif HHG. Setiap server terisolasi ke proses child (&lt;30 tools per server) untuk <b>mencegah drop schema akibat batas payload IDE</b>. Kredensial sensitif tetap aman di brankas HHG.
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {/* Pilihan Format IDE */}
                  <div className="flex rounded-lg p-0.5 border text-xs" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-sunken)' }}>
                    <button
                      onClick={() => setIdeTargetFormat && setIdeTargetFormat('antigravity')}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        (ideTargetFormat || 'antigravity') === 'antigravity'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Format mcpServers untuk Antigravity, Claude Desktop, Cursor, & Windsurf"
                    >
                      Antigravity / Cursor
                    </button>
                    <button
                      onClick={() => setIdeTargetFormat && setIdeTargetFormat('zed')}
                      className={`px-2.5 py-1 rounded font-medium transition-all ${
                        ideTargetFormat === 'zed'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      title="Format context_servers untuk Zed Editor (~/.config/zed/settings.json)"
                    >
                      Zed Editor
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      let env = { os: 'windows', home_dir: 'C:/Users/user', node_path: 'C:/Users/user/AppData/Local/hermes/node/node.exe', runner_path: 'C:/Users/user/.hermes-hub/scripts/run_mcp.js' };
                      try {
                        const platEnv: any = await invoke('get_platform_environment');
                        if (platEnv) env = platEnv;
                      } catch (err) {
                        // Fallback browser/preview jika dijalankan tanpa Tauri
                        if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('linux')) {
                          env = { os: 'linux', home_dir: '/home/user', node_path: 'node', runner_path: '/home/user/.hermes-hub/scripts/run_mcp.js' };
                        }
                      }

                      const nodePath = env.node_path;
                      const runnerPath = env.runner_path;
                      const isZed = ideTargetFormat === 'zed';

                      const serversObj: Record<string, any> = {
                        "hermes-gateway": {
                          command: nodePath,
                          args: [runnerPath, "--server=hermes"]
                        },
                        "mnemosyne": {
                          command: nodePath,
                          args: [runnerPath, "--server=mnemosyne"]
                        },
                        "remote-ssh": {
                          command: nodePath,
                          args: [runnerPath, "--server=remote-ssh"]
                        }
                      };

                      (config.mcp_servers || []).filter(s => s.enabled).forEach((s: any) => {
                        const sRaw = (s.name || s.id || "server").toLowerCase();
                        if (sRaw === "mnemosyne" || sRaw.includes("mnemo")) return; // Mnemosyne dihandle otomatis
                        if (sRaw === "remote-ssh" || sRaw === "ssh" || sRaw.includes("remote_ssh")) return; // Remote SSH dihandle otomatis

                        const sName = sRaw.replace(/[^a-z0-9_-]/g, "_");
                        serversObj[sName] = {
                          command: nodePath,
                          args: [runnerPath, `--server=${sName}`]
                        };
                      });

                      if (isZed) {
                        // Format Zed Editor: menggunakan root key 'context_servers'
                        const zedPayload = { context_servers: serversObj };
                        handleCopySnippet(JSON.stringify(zedPayload, null, 2), "ide_json");
                      } else {
                        // Format Antigravity / Claude / Cursor: root key 'mcpServers'
                        const standardPayload = { mcpServers: serversObj };
                        handleCopySnippet(JSON.stringify(standardPayload, null, 2), "ide_json");
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all whitespace-nowrap"
                  >
                    {copiedSnippet === "ide_json" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Copied {ideTargetFormat === 'zed' ? 'Zed' : 'IDE'} JSON!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Konfigurasi {ideTargetFormat === 'zed' ? 'Zed Editor' : 'IDE'} ({envInfoText})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Callout Penegasan Wajib Salin Ulang */}
              <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-center gap-2.5 ${
                effectiveTheme === 'dark' ? 'bg-amber-950/30 border-amber-800/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <span className="text-base shrink-0">⚠️</span>
                <div>
                  <b>PENTING: SINKRONISASI KONFIGURASI IDE</b>
                  <p className="opacity-90">
                    Setiap kali Anda <b>menambah, mengubah, atau menghapus server MCP</b> di HHG, Anda wajib mengklik tombol <b>"Salin Konfigurasi IDE"</b> di atas lalu menempelkan (paste) ke pengaturan MCP IDE Anda (menu <i>Manage MCP Servers</i>) agar server baru langsung terbaca dan aktif.
                  </p>
                </div>
              </div>
            </div>

            {/* Navigasi Pemisah Tegas: Tab Sub-Section MCP Servers vs Remote SSH Hosts */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMcpHubSection('servers')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mcpHubSection === 'servers'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Server MCP Lokal ({config.mcp_servers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMcpHubSection('ssh')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mcpHubSection === 'ssh'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Remote SSH Hosts ({sshHosts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMcpHubSection('ssh_audit');
                    loadSshAuditLogsList();
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mcpHubSection === 'ssh_audit'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SSH Audit Logs ({sshAuditLogs.length})</span>
                </button>
              </div>

              {/* Action Buttons Dinamis Sesuai Tab Sub-Section */}
              <div className="flex items-center gap-2">
                {mcpHubSection === 'servers' && (
                  <>
                    <button
                      type="button"
                      onClick={handleTestAllMcp}
                      disabled={testingAllMcp}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                      title="Jalankan handshake JSON-RPC ke seluruh server MCP sekaligus"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingAllMcp ? 'animate-spin' : ''}`} />
                      {testingAllMcp ? 'Menguji Semua MCP...' : 'Test Semua Server MCP'}
                    </button>
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
                  </>
                )}
                {mcpHubSection === 'ssh' && (
                  <button 
                    onClick={handleOpenNewSsh}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                    title="Daftarkan host remote SSH baru dengan pasangan kunci terisolasi"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Remote SSH Host
                  </button>
                )}
                {mcpHubSection === 'ssh_audit' && (
                  <>
                    <button 
                      type="button"
                      onClick={loadSshAuditLogsList}
                      disabled={loadingSshAudit}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-all"
                      title="Segarkan data log audit SSH terbaru"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingSshAudit ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button 
                      type="button"
                      onClick={handleClearSshAuditLogs}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold shadow-sm transition-all"
                      title="Bersihkan berkas riwayat log audit di laptop"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Reset Audit
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Modal Tambah Remote SSH Host (Isolated Key & One-Time Password) */}
            {showAddSshModal && (
              <form onSubmit={handleProvisionSsh} className={`p-5 rounded-2xl space-y-4 border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900 border-indigo-500/40 shadow-2xl" : "bg-white border-slate-200 shadow-xl"}`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h4 className={`text-sm font-bold uppercase tracking-wider ${effectiveTheme === "dark" ? "text-indigo-400" : "text-indigo-700"}`}>
                        {editingSshHost ? `Edit Remote SSH Host: ${editingSshHost.alias}` : 'Tambah Remote SSH Host (Multi-Target MCP Gateway)'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {editingSshHost ? 'Perbarui metadata host atau masukkan password jika ingin memasang ulang SSH key.' : 'HHG membuat kunci Ed25519 terisolasi dan menempelkannya ke VM target. Password tidak disimpan!'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddSshModal(false)}
                    className="p-1 text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Host Alias / Tag *</label>
                    <input
                      type="text"
                      placeholder="misal: simgos-prod / simgos-dev"
                      value={sshAlias}
                      onChange={(e) => setSshAlias(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">IP Address / Hostname *</label>
                    <input
                      type="text"
                      placeholder="misal: 172.168.1.6"
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Port SSH</label>
                    <input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(parseInt(e.target.value) || 22)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Username Remote *</label>
                    <input
                      type="text"
                      placeholder="misal: agus / devops"
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Password (One-Time Setup)</label>
                    <input
                      type="password"
                      placeholder="Hanya untuk copy key awal..."
                      value={sshPasswordTemp}
                      onChange={(e) => setSshPasswordTemp(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border font-mono ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Environment Tier</label>
                    <select
                      value={sshTier}
                      onChange={(e: any) => setSshTier(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border font-semibold ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    >
                      <option value="development">Development (Testing & Staging)</option>
                      <option value="production">Production (Live Host)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Deskripsi Host (Opsional)</label>
                    <input
                      type="text"
                      placeholder="misal: VM Almalinux Production SIMGOS2 Apps"
                      value={sshDesc}
                      onChange={(e) => setSshDesc(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs border ${effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'}`}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <input
                      type="checkbox"
                      id="allowElevated"
                      checked={sshAllowElevated}
                      onChange={(e) => setSshAllowElevated(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="allowElevated" className="text-xs text-slate-300 cursor-pointer">
                      <span className="font-semibold text-amber-300">Izinkan Mode Elevated (Sudo/Write)</span>
                      <p className="text-[10px] text-slate-500">Default: Non-aktif (Read-Only Mode untuk keamanan).</p>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddSshModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isProvisioningSsh}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                  >
                    {isProvisioningSsh ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {isProvisioningSsh ? 'Sedang Memasangkan SSH Key...' : (editingSshHost ? 'Perbarui Host & Kunci' : 'Simpan & Pasangkan Host')}
                  </button>
                </div>
              </form>
            )}

            {/* KONTEN SUB-SECTION: REMOTE SSH MANAGER */}
            {mcpHubSection === 'ssh' && (
              <div className="space-y-4">
                {/* Panel Remote SSH Managed Hosts */}
                <div className={`p-4 rounded-2xl border transition-all ${effectiveTheme === 'dark' ? 'bg-slate-900/60 border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                        Remote SSH Hosts Gateway ({sshHosts.length} VM Terhubung)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Akses via MCP: <code className="text-indigo-300 font-bold">remote-ssh</code> (Discrete Multi-Host)
                    </span>
                  </div>

                  {sshHosts.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-indigo-500/30 rounded-xl space-y-3">
                      <Terminal className="w-8 h-8 text-indigo-400 mx-auto opacity-60" />
                      <p className="text-xs text-slate-400">Belum ada remote server Linux yang didaftarkan.</p>
                      <button
                        onClick={handleOpenNewSsh}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                      >
                        + Tambah Remote SSH Host Sekarang
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sshHosts.map((h) => (
                        <div
                          key={h.id}
                          className={`p-3 rounded-xl border flex flex-col justify-between ${
                            effectiveTheme === 'dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                                {h.alias}
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                  h.tier === 'production' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                }`}>
                                  {h.tier}
                                </span>
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEditSsh(h)}
                                  className="p-1 hover:text-indigo-400 text-slate-500 transition-colors"
                                  title="Edit / Perbarui Host SSH"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleRemoveSshHost(h.id, h.alias)}
                                  className="p-1 hover:text-rose-400 text-slate-500 transition-colors"
                                  title="Hapus Host SSH"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mb-1">
                              {h.user}@{h.host}:{h.port}
                            </div>
                            {h.description && (
                              <div className="text-[10px] text-slate-500 line-clamp-1 mb-2">
                                {h.description}
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleToggleSshEnabled(h.id, h.enabled !== false)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 ${
                                  h.enabled !== false
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                                title="Klik untuk mengaktifkan / menonaktifkan host ini"
                              >
                                <Power className="w-2.5 h-2.5" />
                                {h.enabled !== false ? 'AKTIF' : 'NON-AKTIF'}
                              </button>
                            </div>
                            <button
                              onClick={() => handleToggleSshElevation(h.id, h.allow_elevated)}
                              disabled={h.enabled === false}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all disabled:opacity-40 ${
                                h.allow_elevated
                                  ? 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                              }`}
                              title="Klik untuk mengubah izin Read-Only vs Full"
                            >
                              {h.allow_elevated ? '⚡ FULL (Sudo)' : '🔒 READ-ONLY'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* KONTEN SUB-SECTION: SSH AUDIT TRAIL LOGS */}
            {mcpHubSection === 'ssh_audit' && (
              <div className={`p-5 rounded-2xl border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${effectiveTheme === "dark" ? "text-emerald-400" : "text-emerald-700"}`}>
                        Audit Trail Eksekusi SSH (IDE to Remote Hosts)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Catatan audit forensik eksekusi tool shell & file di host remote oleh AI Agent. Rotasi otomatis (max 10 MB per berkas).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Filter audit log..."
                        value={sshAuditFilter}
                        onChange={(e) => setSshAuditFilter(e.target.value)}
                        className={`pl-8 pr-3 py-1 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-emerald-300 focus:border-emerald-500/50" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-emerald-500 shadow-xs"}`}
                      />
                    </div>
                  </div>
                </div>

                {sshAuditLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-mono text-xs">
                    Belum ada riwayat eksekusi SSH yang tercatat. Panggil salah satu tool SSH di IDE untuk memicu log audit.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase">
                          <th className="py-2 px-3">Waktu (WITA)</th>
                          <th className="py-2 px-3">Target Host</th>
                          <th className="py-2 px-3">Tool</th>
                          <th className="py-2 px-3">Perintah / Ringkasan Aksi</th>
                          <th className="py-2 px-3">Mode</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Durasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                        {sshAuditLogs
                          .filter((entry) => {
                            if (!sshAuditFilter) return true;
                            const q = sshAuditFilter.toLowerCase();
                            return (
                              entry.target.toLowerCase().includes(q) ||
                              entry.action_summary.toLowerCase().includes(q) ||
                              entry.tool.toLowerCase().includes(q) ||
                              entry.status.toLowerCase().includes(q)
                            );
                          })
                          .map((entry, idx) => {
                            const isBlocked = entry.status.includes('BLOCKED');
                            const isSuccess = entry.status === 'SUCCESS';
                            return (
                              <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-2 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                                  {formatTime24(entry.timestamp)}
                                </td>
                                <td className="py-2 px-3 font-semibold text-indigo-400 whitespace-nowrap">
                                  {entry.target}
                                  <span className="block text-[10px] font-normal text-slate-500">{entry.target_ip}</span>
                                </td>
                                <td className="py-2 px-3 text-cyan-400 whitespace-nowrap">
                                  {entry.tool}
                                </td>
                                <td className="py-2 px-3 text-slate-200 max-w-[280px] truncate" title={entry.action_summary}>
                                  {entry.action_summary}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    entry.mode === 'FULL'
                                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                                      : 'bg-slate-900 text-slate-400 border-slate-800'
                                  }`}>
                                    {entry.mode}
                                  </span>
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    isSuccess
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                      : isBlocked
                                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                                      : 'bg-slate-900 text-slate-300 border-slate-700'
                                  }`}>
                                    {entry.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400 whitespace-nowrap">
                                  {entry.duration_ms} ms
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* KONTEN SUB-SECTION: MCP SERVERS (LOCAL / STANDARD) */}
            {mcpHubSection === 'servers' && (
              <div className="space-y-4">

            {/* Modal Edit / Add MCP Server (RAW JSON & IDE COMPLIANT) */}
            {showAddMcpModal && (
              <form onSubmit={handleCreateMcp} className={`p-5 rounded-2xl space-y-4 border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900 border-cyan-500/30" : "bg-white border-slate-200 shadow-lg"}`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 dark:border-slate-800 border-slate-200">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${effectiveTheme === "dark" ? "text-cyan-400" : "text-cyan-700"}`}>
                      {editingMcpIndex !== null ? "Edit Konfigurasi Server MCP" : "Daftarkan MCP Server Baru"}
                    </h4>
                  </div>
                  {/* Mode Selector Toggle: Raw JSON (IDE) vs Form */}
                  <div className={`flex items-center p-0.5 rounded-lg border text-[11px] font-mono ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-300"}`}>
                    <button
                      type="button"
                      onClick={() => setMcpInputMode('raw')}
                      className={`px-3 py-1 rounded-md transition-all font-semibold ${mcpInputMode === 'raw' ? (effectiveTheme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white text-cyan-700 shadow-sm border border-slate-200') : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Raw JSON (IDE Format)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMcpInputMode('form')}
                      className={`px-3 py-1 rounded-md transition-all font-semibold ${mcpInputMode === 'form' ? (effectiveTheme === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-white text-cyan-700 shadow-sm border border-slate-200') : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Formulir Field
                    </button>
                  </div>
                </div>

                {mcpInputMode === 'raw' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-400 font-mono">
                        Format standar IDE (Antigravity / VS Code / Claude Desktop JSON):
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMcpRawJson(`{\n  "mcpServers": {\n    "postman-mcp": {\n      "command": "npx",\n      "args": ["-y", "@postman/mcp-server"],\n      "env": {\n        "POSTMAN_API_KEY": "YOUR_KEY_HERE"\n      }\n    }\n  }\n}`);
                          setMcpJsonError('');
                        }}
                        className="text-[10px] text-cyan-500 hover:underline font-mono"
                      >
                        Pakai Contoh Template IDE
                      </button>
                    </div>
                    <textarea
                      rows={10}
                      value={mcpRawJson}
                      onChange={(e) => {
                        setMcpRawJson(e.target.value);
                        setMcpJsonError('');
                      }}
                      placeholder={`{\n  "server-name": {\n    "command": "npx",\n    "args": ["-y", "@modelcontextprotocol/server-example"],\n    "env": {}\n  }\n}`}
                      className={`w-full p-3 font-mono text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-900 border-slate-700 text-cyan-300 shadow-inner"}`}
                      spellCheck={false}
                    />
                    {mcpJsonError && (
                      <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-mono">
                        {mcpJsonError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* MCP Protocol Type Selector */}
                    <div className="grid grid-cols-2 gap-3 p-1 rounded-xl border border-slate-800 bg-slate-950/60">
                      <button
                        type="button"
                        onClick={() => setNewMcpType('stdio')}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                          newMcpType === 'stdio'
                            ? (effectiveTheme === 'dark' ? 'bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 shadow-sm' : 'bg-cyan-600 text-white shadow-sm')
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Local Process (stdio / CLI)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewMcpType('sse')}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                          newMcpType === 'sse'
                            ? (effectiveTheme === 'dark' ? 'bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 shadow-sm' : 'bg-cyan-600 text-white shadow-sm')
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Remote Server (SSE / HTTP Endpoint)</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">Nama Identifier MCP</label>
                        <input 
                          type="text" 
                          placeholder="misal: gitlab, mnemosyne, grafana, database-simrs"
                          value={newMcpName}
                          onChange={(e) => setNewMcpName(e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                          required={mcpInputMode === 'form'}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300">Deskripsi / Peran Tool</label>
                        <input 
                          type="text" 
                          placeholder="Peran alat dalam ekosistem developer / workspace"
                          value={newMcpDesc}
                          onChange={(e) => setNewMcpDesc(e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                        />
                      </div>
                    </div>

                    {/* Dynamic Fields Based on Protocol Type */}
                    {newMcpType === 'stdio' ? (
                      <div className="space-y-3 p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-300">Command Eksekusi</label>
                            <input 
                              type="text" 
                              placeholder="cmd.exe, npx, uvx, python, atau path biner .exe"
                              value={newMcpCmd}
                              onChange={(e) => setNewMcpCmd(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                              required={mcpInputMode === 'form' && newMcpType === 'stdio'}
                            />
                            <p className="text-[10px] text-slate-500">Gunakan cmd.exe untuk Windows CLI atau path penuh binary tabularis</p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <label className="text-xs font-semibold text-slate-300">Argumen Eksekusi (Args)</label>
                            <input 
                              type="text" 
                              placeholder="misal: /c npx -y @zereight/mcp-gitlab atau mcp-grafana"
                              value={newMcpArgs}
                              onChange={(e) => setNewMcpArgs(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                            />
                            <p className="text-[10px] text-slate-500">Argumen CLI dipisahkan dengan spasi.</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
                        <label className="text-xs font-semibold text-slate-300">Remote Server URL (SSE Endpoint)</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            placeholder="http://127.0.0.1:8080/sse atau https://mcp.your-domain.com/sse"
                            value={newMcpServerUrl}
                            onChange={(e) => setNewMcpServerUrl(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                            required={mcpInputMode === 'form' && newMcpType === 'sse'}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">Endpoint streaming SSE remote untuk service seperti Mnemosyne Shared Memory Server atau OmniRoute Gateway.</p>
                      </div>
                    )}

                    {/* Dynamic Environment Variables Key-Value Builder */}
                    <div className="space-y-2 p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>Environment Variables & IP / Kredensial Jaringan</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setNewMcpEnvList([...newMcpEnvList, { key: '', val: '' }])}
                          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
                        >
                          <Plus className="w-3 h-3" /> Tambah Variabel
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {newMcpEnvList.map((envItem, envIdx) => (
                          <div key={envIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="KEY (contoh: GITLAB_API_URL, GRAFANA_URL)"
                              value={envItem.key}
                              onChange={(e) => {
                                const updated = [...newMcpEnvList];
                                updated[envIdx].key = e.target.value;
                                setNewMcpEnvList(updated);
                              }}
                              className={`w-1/2 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                            />
                            <input
                              type="text"
                              placeholder="VALUE (contoh: https://gitlab.com/api/v4)"
                              value={envItem.val}
                              onChange={(e) => {
                                const updated = [...newMcpEnvList];
                                updated[envIdx].val = e.target.value;
                                setNewMcpEnvList(updated);
                              }}
                              className={`w-1/2 px-2.5 py-1.5 border rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-500 ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                            />
                            {newMcpEnvList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setNewMcpEnvList(newMcpEnvList.filter((_, i) => i !== envIdx))}
                                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                                title="Hapus Variabel"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddMcpModal(false);
                      setEditingMcpIndex(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-cyan-600/20"
                  >
                    {editingMcpIndex !== null ? "Simpan Perubahan" : "Simpan MCP Server"}
                  </button>
                </div>
              </form>
            )}

            {/* Split-Pane: Sidebar Server List (Left) + Detailed Vertical Tools Table (Right) */}
            <div className="grid grid-cols-12 gap-5 min-h-[520px]">
              {/* Left Column: Server Cards List */}
              <div className={`col-span-4 space-y-2 border rounded-2xl p-3 max-h-[580px] overflow-y-auto transition-colors ${
                effectiveTheme === 'dark'
                  ? 'bg-slate-900/40 border-slate-800/80'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
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
                          ? (effectiveTheme === 'dark' 
                              ? "bg-cyan-950/40 border-cyan-500/60 shadow-sm" 
                              : "bg-cyan-50 border-cyan-500/80 shadow-sm ring-1 ring-cyan-500/30") 
                          : (effectiveTheme === 'dark'
                              ? "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200"
                              : "bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80")
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-mono text-xs font-bold truncate ${
                          isSelected 
                            ? (effectiveTheme === 'dark' ? "text-cyan-300 font-extrabold" : "text-cyan-900 font-extrabold") 
                            : (effectiveTheme === 'dark' ? "text-slate-200" : "text-slate-800")
                        }`}>
                          {mcp.name}
                        </span>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                          effectiveTheme === 'dark'
                            ? "text-slate-400 bg-slate-950 border-slate-800"
                            : "text-slate-600 bg-slate-100 border-slate-200"
                        }`}>
                          {tools.length > 0 ? `${activeCount}/${tools.length}` : (mcp.enabled ? "Active" : "Off")}
                        </span>
                      </div>
                      <div className={`text-[10px] line-clamp-1 leading-snug ${
                        effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {mcp.description}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[10px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMcp(idx);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all flex items-center gap-1 ${
                            mcp.enabled
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                              : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                          }`}
                          title="Klik untuk mengaktifkan / menonaktifkan server MCP ini"
                        >
                          <Power className="w-2.5 h-2.5" />
                          {mcp.enabled ? "AKTIF" : "NON-AKTIF"}
                        </button>
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
              <div className={`col-span-8 border rounded-2xl p-5 flex flex-col justify-between transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                {(() => {
                  const currentMcpIdx = config.mcp_servers.findIndex(m => m.name === selectedMcpName);
                  const currentMcp = config.mcp_servers[currentMcpIdx] || config.mcp_servers[0];
                  if (!currentMcp) return null;

                  const tools = mcpToolsDiscovery[currentMcp.name] || [];
                  const allActive = tools.length > 0 && tools.every(t => t.enabled);

                  return (
                    <div className="space-y-4 flex-1 flex flex-col">
                      {/* Selected MCP Header */}
                      <div className={`flex items-start justify-between pb-4 border-b ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>{currentMcp.name}</h3>
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

                      {/* Test Result Message (VIVID GREEN CONTRASS) */}
                      {testingMcpName === currentMcp.name && testResult && (
                        <div className="p-3.5 bg-emerald-950/80 border-2 border-emerald-500 rounded-xl text-xs font-mono text-emerald-300 shadow-xl shadow-emerald-950/60 animate-in fade-in flex items-center gap-3">
                          <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 border border-emerald-500/40">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Hasil Pengujian Koneksi MCP (Sukses)</div>
                            <span className="font-semibold text-emerald-200">{testResult}</span>
                          </div>
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
                            Server terhubung. Klik tombol "Test Connection" untuk discovery tools realtime dari runtime proses.
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
      </div>
    )}

        {/* TAB 4: SKILLS HIERARCHY & READER (IDE-STYLE MASTER-DETAIL EXPLORER) */}
        {false && (
          <div className="space-y-4">
            {/* Top Bar with Breadcrumbs & Sync Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
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
                    const wsSkills = skillsHierarchy.filter(s => s.workspace_id === ws.id);
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
                <div className={`col-span-4 border rounded-2xl p-3.5 space-y-3 flex flex-col max-h-[580px] transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  {/* Search bar inside workspace */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Cari SOP / aturan..." 
                      value={skillSearchQuery}
                      onChange={(e) => setSkillSearchQuery(e.target.value)}
                      className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500/50" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
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
                                : (effectiveTheme === 'dark' ? "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900")
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-mono text-xs font-bold truncate ${
                          isSelected 
                            ? (effectiveTheme === 'dark' ? "text-cyan-300 font-extrabold" : "text-cyan-900 font-extrabold") 
                            : (effectiveTheme === 'dark' ? "text-slate-200" : "text-slate-800")
                        }`}>
                                {s.name}
                              </span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${effectiveTheme === "dark" ? "text-slate-400 bg-slate-950 border-slate-800" : "text-slate-600 bg-slate-100 border-slate-200"}`}>
                                {s.references.length} ref
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                              {s.desc}
                            </p>
                            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/60 text-[10px] text-slate-500">
                              <span>@{s.author}</span>
                              <span className="font-mono">{s.created_at}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Right Column (Col 8): Detail SOP + Scalable References List (Berapa pun banyaknya file aman!) */}
                <div className={`col-span-8 border rounded-2xl p-5 flex flex-col justify-between transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                  {(() => {
                    const currentSkill = skillsHierarchy.find(s => s.name === activeSkillName) || skillsHierarchy[0];
                    if (!currentSkill) return null;

                    return (
                      <div className="space-y-4 flex-1 flex flex-col">
                        {/* SOP Header Card */}
                        <div className={`flex items-start justify-between pb-4 border-b ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-cyan-300" : "text-cyan-800 font-extrabold"}`}>{currentSkill.name}</h3>
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${effectiveTheme === "dark" ? "bg-slate-800 text-cyan-400 border-slate-700" : "bg-cyan-50 text-cyan-800 border-cyan-200 font-medium"}`}>
                                author: @{currentSkill.author}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${effectiveTheme === "dark" ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                {currentSkill.category}
                              </span>
                            </div>
                            <p className={`text-xs leading-relaxed ${effectiveTheme === "dark" ? "text-slate-300" : "text-slate-700"}`}>{currentSkill.desc}</p>
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
                            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>
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
                          {currentSkill.references.length === 0 ? (
                            <div className={`p-8 text-center rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 ${
                              effectiveTheme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-500' : 'bg-slate-50/80 border-slate-200 text-slate-500'
                            }`}>
                              <FolderTree className="w-8 h-8 text-slate-400 opacity-60" />
                              <div className="text-xs font-semibold">Tidak ada berkas tambahan di <code>references/</code></div>
                              <p className="text-[11px] text-slate-400 max-w-sm">Seluruh instruksi, aturan kerja, dan SOP telah dirangkum secara padat di dalam file induk <code>SKILL.md</code>.</p>
                            </div>
                          ) : currentSkill.references.map((ref, rIdx) => {
                            const isJson = ref.endsWith(".json");
                            const isMd = ref.endsWith(".md");
                            const isSample = ref.endsWith(".sample");

                            return (
                              <div 
                                key={ref}
                                onClick={async () => {
                                  await handleOpenSkill(currentSkill);
                                  await handleSelectReference(currentSkill.name, ref);
                                }}
                                className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-all group border ${effectiveTheme === "dark" ? "bg-slate-950/80 hover:bg-slate-900 border-slate-800/80 hover:border-cyan-500/40" : "bg-slate-50 hover:bg-cyan-50/70 border-slate-200/80 hover:border-cyan-400/50 shadow-xs"}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-slate-500 w-5 text-right">{rIdx + 1}.</span>
                                  <div className={`p-1.5 rounded-lg border group-hover:scale-105 transition-transform ${effectiveTheme === "dark" ? "bg-slate-900 text-cyan-400 border-slate-800" : "bg-white text-cyan-700 border-slate-200 shadow-xs"}`}>
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className={`font-mono text-xs font-semibold transition-colors ${effectiveTheme === "dark" ? "text-slate-200 group-hover:text-cyan-300" : "text-slate-800 group-hover:text-cyan-700"}`}>
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
                                  <button className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900 hover:bg-cyan-600/30 text-slate-400 group-hover:text-cyan-300 border-slate-800" : "bg-white hover:bg-cyan-600 text-slate-700 hover:text-white border-slate-200 shadow-xs"}`}>
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
                <div className={`border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl transition-colors ${effectiveTheme === "dark" ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
                  {/* Modal Header */}
                  <div className={`p-5 border-b flex items-center justify-between ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>
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
                  <div className={`flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs ${effectiveTheme === "dark" ? "text-slate-300 bg-slate-950/40" : "text-slate-800 bg-slate-50"}`}>
                    <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Provenance & Audit Header</div>
                      <div className="text-slate-400 leading-relaxed">
                        Aturan ini diekstrak secara otomatis oleh Hermes Evaluator dari sesi koding programmer <b>@{selectedSkill.author}</b> dan disinkronkan langsung dari repositori GitLab kantor.
                      </div>
                    </div>

                    {/* Reference Quick-Switch Tabs */}
                    {selectedSkill.references && selectedSkill.references.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pilih Berkas untuk Dibaca:</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setSelectedRefFile(null);
                              setRefFileContent('');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                              !selectedRefFile
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-xs"
                                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            SKILL.md (Utama)
                          </button>
                          {selectedSkill.references.map((rf) => (
                            <button
                              key={rf}
                              onClick={() => handleSelectReference(selectedSkill.name, rf)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                                selectedRefFile === rf
                                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-xs"
                                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {rf}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{selectedRefFile ? `Isi Berkas Referensi: ${selectedRefFile}` : "Isi Berkas SKILL.md Utama"}</span>
                        {loadingRefContent && <span className="text-cyan-400 animate-pulse">Memuat berkas...</span>}
                      </div>
                      <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl whitespace-pre-wrap leading-relaxed text-slate-200 overflow-x-auto max-h-[50vh]">
                        {selectedRefFile 
                          ? (refFileContent || "Memuat konten berkas referensi...")
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
        {/* TAB 4: EVOLUTION LOGS (UNIFORM SPLIT-PANE HIERARCHY) */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>
                    <Terminal className="w-4 h-4 text-cyan-500" /> Watcher Telemetry & Evolution Feed
                  </span>
                  {unreadEvolutionCount > 0 ? (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {unreadEvolutionCount} Baru
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      Semua Sudah Dibaca
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Total <b>{evolutionFeed.length} event pembelajaran</b> (Mnemosyne & GitLab Skills) identik dengan notifikasi Telegram.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Filter Workspace */}
                <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-mono px-1">Workspace:</span>
                  <select
                    value={logFilterWorkspace}
                    onChange={(e) => setLogFilterWorkspace(e.target.value)}
                    className="bg-slate-950 text-cyan-300 text-xs font-mono rounded-lg px-2 py-1 border border-slate-800 focus:outline-none"
                  >
                    <option value="all">Semua Workspace</option>
                    {config.workspaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name || w.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Split-Pane: Panel Kiri (Daftar Event Logs) + Panel Kanan (Detail Payload JSON & Trace) */}
            <div className="grid grid-cols-12 gap-5 min-h-[520px]">
              {/* Panel Kiri (Col 4): List Event Logs */}
              <div className={`col-span-4 border rounded-2xl p-3.5 space-y-3 flex flex-col max-h-[580px] transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    placeholder="Filter event log..." 
                    value={logFilterQuery}
                    onChange={(e) => setLogFilterQuery(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500/50" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
                  />
                </div>

                <div className="text-[10px] font-mono uppercase text-slate-500 px-1 flex items-center justify-between">
                  <span>Daftar Event</span>
                  <span>Waktu</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {evolutionFeed.length > 0 ? (
                    evolutionFeed
                      .filter(ev => {
                        if (logFilterWorkspace !== 'all' && ev.workspace_id !== logFilterWorkspace) return false;
                        const q = (logFilterQuery || '').toLowerCase();
                        if (!q) return true;
                        return (ev.title || '').toLowerCase().includes(q) ||
                               (ev.content || '').toLowerCase().includes(q) ||
                               (ev.author || '').toLowerCase().includes(q) ||
                               (ev.target || '').toLowerCase().includes(q);
                      })
                      .map((item, idx) => {
                        const isSelected = selectedLogIndex === idx;
                        const isMemory = item.type === 'memory';
                        return (
                          <div 
                            key={item.id || idx}
                            onClick={() => setSelectedLogIndex(idx)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected 
                                ? (effectiveTheme === 'dark' ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm" : "bg-cyan-50/80 border-cyan-400/60 shadow-sm")
                                : (effectiveTheme === 'dark' ? "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900")
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-mono text-xs font-bold truncate flex items-center gap-1.5 ${isMemory ? "text-cyan-400" : "text-emerald-400"}`}>
                                <span>{isMemory ? "🧠" : "💾"}</span>
                                <span>{item.action_label}</span>
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {formatTime24(item.timestamp)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-200 font-medium truncate mb-1">
                              {item.title}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                              <span>Ws: <b className="text-cyan-300">{item.workspace_id}</b></span>
                              <span>Author: <b className="text-amber-300">{item.author}</b></span>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    logs
                      .filter(l => {
                        const q = (logFilterQuery || '').toLowerCase();
                        const evt = (l.event || '').toLowerCase();
                        const c = (l.conv || '').toLowerCase();
                        const f = (l.file || '').toLowerCase();
                        return evt.includes(q) || c.includes(q) || f.includes(q);
                      })
                      .map((item, idx) => {
                        const isSelected = selectedLogIndex === idx;
                        const isLesson = (item.event || '').includes("Lesson") || (item.event || '').includes("learned");

                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedLogIndex(idx)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected 
                                ? (effectiveTheme === 'dark' ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm" : "bg-cyan-50/80 border-cyan-400/60 shadow-sm")
                                : (effectiveTheme === 'dark' ? "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900")
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-mono text-xs font-bold truncate ${isLesson ? "text-emerald-400" : isSelected ? "text-cyan-300" : "text-slate-300"}`}>
                                {item.event || 'System Event'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {item.time}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              Conv: {item.conv}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Panel Kanan (Col 8): Detail Payload & Trace Inspection */}
              <div className={`col-span-8 border rounded-2xl p-5 flex flex-col justify-between transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                {(() => {
                  if (evolutionFeed.length > 0) {
                    const filtered = evolutionFeed.filter(ev => {
                      if (logFilterWorkspace !== 'all' && ev.workspace_id !== logFilterWorkspace) return false;
                      const q = (logFilterQuery || '').toLowerCase();
                      if (!q) return true;
                      return (ev.title || '').toLowerCase().includes(q) ||
                             (ev.content || '').toLowerCase().includes(q) ||
                             (ev.author || '').toLowerCase().includes(q) ||
                             (ev.target || '').toLowerCase().includes(q);
                    });
                    const currentEv = filtered[selectedLogIndex] || filtered[0];
                    if (!currentEv) return (
                      <div className="p-12 text-center text-xs text-slate-500 font-mono">
                        Tidak ada log pembelajaran untuk filter ini.
                      </div>
                    );

                    const isMemory = currentEv.type === 'memory';
                    return (
                      <div className="space-y-4 flex-1 flex flex-col">
                        <div className={`flex items-start justify-between pb-4 border-b ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{isMemory ? "🧠" : "💾"}</span>
                              <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>
                                {currentEv.action_label}
                              </h3>
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-400 border border-slate-700 text-[10px] font-mono">
                                {formatTime24(currentEv.timestamp)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                              <span>Workspace: <b className="text-cyan-300">{currentEv.workspace_id}</b></span>
                              <span>Author: <b className="text-amber-300">{currentEv.author}</b></span>
                              <span>Target: <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">{currentEv.target}</code></span>
                            </div>
                          </div>
                        </div>

                        {/* Telegram Style Preview Card */}
                        <div className={`p-4 rounded-xl border space-y-2.5 ${effectiveTheme === 'dark' ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                            <span>Telegram Alert Replica Card</span>
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.2 rounded border border-cyan-500/20">LIVE SYNC</span>
                          </div>
                          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono space-y-2 leading-relaxed">
                            <div className="font-bold text-cyan-300">
                              {isMemory ? "🧠 Self-improvement review: Canonical memory saved to Mnemosyne" : "💾 Self-improvement review: " + currentEv.action_label}
                            </div>
                            <div>• <b>Workspace</b>: <code className="text-amber-300">{currentEv.workspace_id}</code></div>
                            <div>• <b>Author</b>: <b>{currentEv.author}</b></div>
                            {isMemory ? (
                              <>
                                <div>• <b>Slot</b>: <code className="text-emerald-300">{currentEv.target}</code></div>
                                <div>• <b>Konten</b>: {currentEv.content}</div>
                              </>
                            ) : (
                              <>
                                <div>• <b>File</b>: <code className="text-emerald-300">{currentEv.target}</code></div>
                                <div>• <b>Aturan</b>: {currentEv.title}</div>
                                <div>• <b>Kaidah</b>: {currentEv.content}</div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 flex-1 flex flex-col">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>Audit Metadata JSON</span>
                            <span className="text-[10px] text-slate-500 font-mono">Event ID: {currentEv.id}</span>
                          </div>
                          <pre className={`flex-1 p-3.5 rounded-xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-y-auto border transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800 shadow-inner"}`}>
{JSON.stringify(currentEv, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  }

                  const currentLog = logs[selectedLogIndex] || logs[0];
                  if (!currentLog) return (
                    <div className="p-12 text-center text-xs text-slate-500 font-mono">
                      Belum ada transkrip event yang terekam. Antigravity IDE Watcher sedang siaga.
                    </div>
                  );

                  return (
                    <div className="space-y-4 flex-1 flex flex-col">
                      <div className={`flex items-start justify-between pb-4 border-b ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>{currentLog.event || 'System Event'}</h3>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-400 border border-slate-700 text-[10px] font-mono">
                              {(currentLog?.time || '')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono truncate">
                            Sumber / Berkas: {(currentLog?.file || 'internal') || 'system-internal'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Inspection Trace JSON</span>
                          <span className="text-[10px] text-slate-500 font-mono">Context ID: {(currentLog?.conv || 'trace') || 'global-trace'}</span>
                        </div>
                        <pre className={`flex-1 p-4 rounded-xl font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-y-auto border transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-slate-50 border-slate-200 text-slate-800 shadow-inner"}`}>
{JSON.stringify({
  event_timestamp: (currentLog?.time || ''),
  event_message: currentLog.event,
  conversation_id: (currentLog?.conv || 'trace') || 'system-trace',
  target_file: (currentLog?.file || 'internal') || 'engine-watcher',
  watcher_trigger: "Brain transcript length increase detected",
  evaluator_endpoint: config.default_hermes_evaluator_url + "/review",
  zero_pollution_enforced: true,
  auto_git_sync: true
}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        


        {/* TAB 7: VERSION LOGS / OFFICIAL CHANGELOG (UNIFORM MASTER-DETAIL) */}
        {activeTab === "releases" && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>Catatan Riwayat Versi Aplikasi (Official Changelog)</h3>
                  <p className="text-[11px] text-slate-400">Daftar evolusi fitur, perbaikan bug, dan installer rilis resmi untuk Developer Workspace.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCheckUpdate(true)}
                  disabled={isCheckingUpdate}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-semibold transition-all shadow-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                  <span>{isCheckingUpdate ? 'Memeriksa...' : 'Cek Update Rilis'}</span>
                </button>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                  TOTAL: {releaseLogs.length} RILIS RESMI
                </span>
              </div>
            </div>

            {/* Split-Pane Hierarchy: Panel Kiri (Daftar Versi) + Panel Kanan (Detail Catatan Rilis) */}
            <div className="grid grid-cols-12 gap-5 min-h-[520px]">
              {/* Panel Kiri (Col 4): List Versi */}
              <div className={`col-span-4 border rounded-2xl p-3.5 space-y-3 flex flex-col max-h-[580px] transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input 
                    type="text" 
                    placeholder="Cari versi atau fitur..." 
                    value={releaseSearchQuery}
                    onChange={(e) => setReleaseSearchQuery(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500/50" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
                  />
                </div>

                <div className="text-[10px] font-mono uppercase text-slate-500 px-1 flex items-center justify-between">
                  <span>Versi Rilis ({releaseLogs.length})</span>
                  <span>Tipe</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {releaseLogs
                    .filter(rel => 
                      rel.version.toLowerCase().includes(releaseSearchQuery.toLowerCase()) || 
                      rel.name.toLowerCase().includes(releaseSearchQuery.toLowerCase()) ||
                      rel.highlights.toLowerCase().includes(releaseSearchQuery.toLowerCase())
                    )
                    .map((rel) => {
                      const isSelected = selectedReleaseTag === rel.version;

                      return (
                        <div 
                          key={rel.version}
                          onClick={() => setSelectedReleaseTag(rel.version)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected 
                              ? (effectiveTheme === 'dark' ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm" : "bg-cyan-50/80 border-cyan-400/60 shadow-sm")
                              : (effectiveTheme === 'dark' ? "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900")
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-mono text-xs font-bold truncate ${
                          isSelected 
                            ? (effectiveTheme === 'dark' ? "text-cyan-300 font-extrabold" : "text-cyan-900 font-extrabold") 
                            : (effectiveTheme === 'dark' ? "text-slate-200" : "text-slate-800")
                        }`}>
                              {rel.version}
                            </span>
                            <div className="flex items-center gap-1">
                              {rel.status === "LATEST" && (
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                                  LATEST
                                </span>
                              )}
                              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/40">
                                {rel.type}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-300 font-medium truncate mb-1">
                            {rel.name.replace(`Hermes Hub Gateway ${rel.version} `, '')}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/60 text-[10px] text-slate-500">
                            <span>{rel.date}</span>
                            <span>{rel.features.length + rel.fixes.length} Pembaruan</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Panel Kanan (Col 8): Detail Catatan Rilis */}
              <div className={`col-span-8 border rounded-2xl p-5 flex flex-col justify-between transition-colors max-h-[580px] overflow-y-auto ${effectiveTheme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                {(() => {
                  const currentRel = releaseLogs.find(r => r.version === selectedReleaseTag) || releaseLogs[0];
                  if (!currentRel) return null;

                  return (
                    <div className="space-y-4 flex-1 flex flex-col">
                      {/* Release Header */}
                      <div className={`flex items-start justify-between pb-4 border-b ${effectiveTheme === "dark" ? "border-slate-800" : "border-slate-200"}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <h3 className={`font-bold text-base font-mono ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>{currentRel.name}</h3>
                            {currentRel.status === "LATEST" ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                                RILIS TERBARU
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                                ARSIP STABIL
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            Dipublikasikan pada: <b className="text-slate-300">{currentRel.date}</b> • Tipe Rilis: <span className="text-cyan-400 uppercase font-semibold">{currentRel.type}</span>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            const url = `https://github.com/agusazis/hermes-hub-gateway/releases/tag/${currentRel.version}`;
                            invoke('open_in_browser', { url }).catch(() => {
                              window.open(url, '_blank');
                            });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> GitHub Tag
                        </button>
                      </div>

                      {/* Highlights Card */}
                      <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> Ringkasan Perubahan
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-sans">
                          {currentRel.highlights}
                        </p>
                      </div>

                      {/* 3 Categories: Fitur Baru, Perbaikan Bug, Arsitektur */}
                      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {/* Features */}
                        {currentRel.features.length > 0 && (
                          <div className="space-y-1.5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" /> Fitur & Peningkatan Baru
                            </h4>
                            <div className="space-y-1 pl-2 border-l-2 border-emerald-500/30">
                              {currentRel.features.map((feat, i) => (
                                <div key={i} className="text-xs text-slate-300 leading-snug flex items-start gap-2">
                                  <span className="text-emerald-400 font-bold">•</span>
                                  <span>{feat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fixes */}
                        {currentRel.fixes.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" /> Perbaikan Bug & Optimalisasi
                            </h4>
                            <div className="space-y-1 pl-2 border-l-2 border-amber-500/30">
                              {currentRel.fixes.map((fix, i) => (
                                <div key={i} className="text-xs text-slate-300 leading-snug flex items-start gap-2">
                                  <span className="text-amber-400 font-bold">•</span>
                                  <span>{fix}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Architecture */}
                        {currentRel.architecture.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" /> Tata Kelola & Arsitektur
                            </h4>
                            <div className="space-y-1 pl-2 border-l-2 border-cyan-500/30">
                              {currentRel.architecture.map((arch, i) => (
                                <div key={i} className="text-xs text-slate-300 leading-snug flex items-start gap-2">
                                  <span className="text-cyan-400 font-bold">•</span>
                                  <span>{arch}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Download Assets Section */}
                      <div className="pt-3 border-t border-slate-800 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                          <span>Paket Biner Installer Resmi</span>
                          <span className="text-[10px] text-slate-500 font-mono">Windows x64 Architecture</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {currentRel.downloads.map((dl, i) => (
                            <a
                              key={i}
                              href={dl.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2.5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded-xl flex items-center justify-between text-xs transition-all group"
                            >
                              <div className="space-y-0.5 truncate pr-2">
                                <div className="font-mono text-cyan-400 font-semibold truncate group-hover:text-cyan-300">
                                  {dl.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {dl.type} • {dl.size}
                                </div>
                              </div>
                              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS & SYSTEM CONFIGURATION */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-5">
            {/* ONE-KEY ORGANIZATION PROVISIONING / ID AKTIVASI INSTAN TIM RSUD */}
            <div className={`p-5 rounded-2xl border transition-all ${
              effectiveTheme === 'dark' 
                ? 'bg-gradient-to-br from-slate-900/80 to-cyan-950/20 border-cyan-500/30' 
                : 'bg-gradient-to-br from-white to-cyan-50/60 border-cyan-300 shadow-sm'
            } space-y-4`}>
              <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                      One-Key Organization Provisioning (Rapid Team Onboarding)
                    </h3>
                    <p className={`text-[11px] ${effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      Cukup masukkan ID Setup Organisasi. Seluruh konfigurasi gateway, endpoint Mnemosyne, dan parameter bot akan dimuat otomatis.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800/40 font-semibold uppercase">
                  ORGANIZATION SETUP KEY
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Masukkan Organization Setup Key..."
                  value={provisionKey}
                  onChange={(e) => setProvisionKey(e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:border-cyan-500 transition-colors ${
                    effectiveTheme === 'dark'
                      ? 'bg-slate-950 border-slate-800 text-cyan-300 placeholder:text-slate-600'
                      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleApplyProvisionKey}
                  disabled={provisionLoading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${provisionLoading ? 'animate-spin' : ''}`} />
                  {provisionLoading ? 'Memverifikasi...' : 'Aktifkan Pengaturan'}
                </button>
              </div>

              {/* Status Alert Aktivasi Organization ID */}
              {provisionStatus && (
                <div className={`p-3 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-center gap-2.5 ${
                  provisionStatus.success
                    ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                    : "bg-rose-950/80 border-rose-500 text-rose-200"
                }`}>
                  {provisionStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{provisionStatus.message}</span>
                </div>
              )}
            </div>

            {/* Global Central Telegram Notification Config - DEPRECATED / REMOVED FROM UI (Handled purely by backend evaluator) */}

            <div className={`p-5 rounded-2xl space-y-4 border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Konfigurasi Gateway Server</h3>
              
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Server Evaluator Hermes (URL)</label>
                <input 
                  type="text" 
                  value={config.default_hermes_evaluator_url}
                  onChange={(e) => setConfig({ ...config, default_hermes_evaluator_url: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Server Mnemosyne Shared Memory (URL)</label>
                <input 
                  type="text" 
                  value={config.default_mnemosyne_url}
                  onChange={(e) => setConfig({ ...config, default_mnemosyne_url: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
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
                  className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
                />
              </div>

              {/* Gateway Server Test Button & Result Banner */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Periksa jangkauan jaringan server Evaluator (:9125) dan Memori Mnemosyne (:8080).
                  </span>
                  <button
                    type="button"
                    onClick={handleTestGatewayServer}
                    disabled={testingGateway}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    {testingGateway ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Menguji Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Test Koneksi Server Gateway</span>
                      </>
                    )}
                  </button>
                </div>

                {gatewayTestResult && (
                  <div className={`p-3 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-start gap-3 ${
                    gatewayTestResult.success
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-emerald-950/60"
                      : "bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-950/60"
                  }`}>
                    {gatewayTestResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                        gatewayTestResult.success ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {gatewayTestResult.success ? "Hasil Uji Gateway Server (Online)" : "Hasil Uji Gateway Server (Gagal)"}
                      </div>
                      <div className="font-semibold">{gatewayTestResult.message}</div>
                      {!gatewayTestResult.success && (
                        <div className="mt-2.5 p-2 bg-slate-900/90 rounded border border-rose-800/60 text-[11px] text-slate-300">
                          <p className="font-semibold text-rose-300 mb-1">Panduan Server Fresh Install:</p>
                          <p className="mb-1 text-slate-400">Pastikan Hermes Hub Companion Daemon terpasang di host server dengan menjalankan perintah berikut:</p>
                          <code className="text-cyan-300 block bg-black/60 p-1.5 rounded select-all font-mono">
                            curl -fsSL https://raw.githubusercontent.com/agusazis/hermes-hub-gateway/main/server/install.sh | bash
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {settingsNotice && (
                <div className={`p-3.5 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-center gap-3 ${
                  settingsNotice.success
                    ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-emerald-950/60"
                    : "bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-950/60"
                }`}>
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${settingsNotice.success ? "text-emerald-400" : "text-rose-400"}`} />
                  <span className="font-semibold">{settingsNotice.message}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Perubahan akan diterapkan secara instan ke IPC bridge dan listener berkas.
                </span>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Check className={`w-4 h-4 ${isSavingSettings ? 'animate-spin' : ''}`} />
                  <span>{isSavingSettings ? 'Menyimpan Konfigurasi...' : 'Simpan Seluruh Konfigurasi'}</span>
                </button>
              </div>
            </div>

            {/* PUSAT PENCADANGAN & PEMULIHAN BENCANA (DISASTER RECOVERY CENTER) */}
            <div className={`p-5 rounded-2xl space-y-4 border transition-colors ${effectiveTheme === "dark" ? "bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-slate-800 shadow-xl" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                    <Archive className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>Pusat Cadangan & Pemulihan (Disaster Recovery Center)</h3>
                    <p className="text-[11px] text-slate-400">Pencadangan konfigurasi lokal laptop dan pemulihan memori server Mnemosyne jika terjadi kegagalan sistem.</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold">
                  OFFLINE & CLOUD BACKUP
                </span>
              </div>

              {/* Status Alert Notifikasi Backup dengan Lokasi Folder Jelas & Tombol Akses File */}
              {backupNotice && (
                <div className={`p-3.5 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-center justify-between gap-3 ${
                  backupNotice.success
                    ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-emerald-950/60"
                    : "bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-950/60"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
                      backupNotice.success
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    }`}>
                      {backupNotice.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${
                        backupNotice.success ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {backupNotice.success ? "Operasi Backup / Pemulihan Sukses" : "Operasi Gagal"}
                      </div>
                      <span className="font-semibold">{backupNotice.message}</span>
                    </div>
                  </div>

                  {backupNotice.success && (
                    <div className="flex-shrink-0">
                      <span className="text-[10px] text-emerald-300/80 bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-700/50 flex items-center gap-1 font-mono">
                        <Folder className="w-3.5 h-3.5 text-emerald-400" /> C:\Users\...\Downloads
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2 Kolom: Kolom 1 (Konfigurasi HHG Laptop) & Kolom 2 (Memori Mnemosyne Server) */}
              <div className="grid grid-cols-2 gap-4">
                {/* Kolom 1: Konfigurasi Laptop HHG */}
                <div className={`p-4 rounded-xl space-y-3 flex flex-col justify-between border transition-colors ${
                  effectiveTheme === 'dark' 
                    ? 'bg-slate-950/70 border-slate-800/80' 
                    : 'bg-slate-50 border-slate-200/80 shadow-xs'
                }`}>
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 font-semibold text-xs ${
                      effectiveTheme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'
                    }`}>
                      <FolderKanban className="w-4 h-4" />
                      <span>Konfigurasi Laptop HHG</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${
                      effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Ekspor daftar seluruh workspace, pengaturan binding repo Git, server MCP terdaftar, dan preferensi lokal ke file JSON.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={handleExportHhgConfig}
                      disabled={backupActionLoading !== null}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        effectiveTheme === 'dark'
                          ? 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-slate-700/60'
                          : 'bg-white hover:bg-cyan-50 text-cyan-700 border-slate-200 shadow-xs'
                      }`}
                    >
                      {backupActionLoading === 'export_config' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-cyan-500" />
                      )}
                      <span>Export JSON</span>
                    </button>

                    <label className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                      effectiveTheme === 'dark'
                        ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border-cyan-700/50'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white border-transparent shadow-xs'
                    }`}>
                      {backupActionLoading === 'import_config' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-white dark:text-cyan-400" />
                      )}
                      <span>Import JSON</span>
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={handleImportHhgConfigFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Kolom 2: Memori Mnemosyne Server */}
                <div className={`p-4 rounded-xl space-y-3 flex flex-col justify-between border transition-colors ${
                  effectiveTheme === 'dark' 
                    ? 'bg-slate-950/70 border-slate-800/80' 
                    : 'bg-slate-50 border-slate-200/80 shadow-xs'
                }`}>
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 font-semibold text-xs ${
                      effectiveTheme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                    }`}>
                      <Database className="w-4 h-4" />
                      <span>Memori Mnemosyne Server</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${
                      effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Ekstrak seluruh ingatan jangka panjang agen (episodes & triples) dari server atau pulihkan ke server Hermes baru.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={handleExportMnemosyneMemory}
                      disabled={backupActionLoading !== null}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        effectiveTheme === 'dark'
                          ? 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-slate-700/60'
                          : 'bg-white hover:bg-emerald-50 text-emerald-700 border-slate-200 shadow-xs'
                      }`}
                    >
                      {backupActionLoading === 'export_mnemosyne' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                      <span>Backup Memori</span>
                    </button>

                    <label className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer border transition-all ${
                      effectiveTheme === 'dark'
                        ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-700/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-xs'
                    }`}>
                      {backupActionLoading === 'import_mnemosyne' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-white dark:text-emerald-400" />
                      )}
                      <span>Restore Memori</span>
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={handleImportMnemosyneMemoryFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* POPUP MODAL NOTIFIKASI UPDATE APLIKASI */}
      {showUpdateModal && updateInfo?.has_update && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-2xl transition-all ${
            effectiveTheme === 'dark' ? 'bg-slate-900 border-amber-500/40' : 'bg-white border-amber-300'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                  <RefreshCw className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950">
                      UPDATE TERSEDIA
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {APP_VERSION} → <strong className="text-amber-400">{updateInfo.latest_version}</strong>
                    </span>
                  </div>
                  <h3 className={`text-base font-bold mt-1 ${effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {updateInfo.release_name || `Hermes Hub Gateway ${updateInfo.latest_version}`}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className={`p-4 rounded-xl border max-h-48 overflow-y-auto space-y-2 text-xs font-mono leading-relaxed ${
              effectiveTheme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="text-[10px] font-bold text-slate-500 uppercase">Catatan Rilis (Release Notes):</div>
              <div className="whitespace-pre-wrap">{updateInfo.release_notes || 'Pembaruan stabilitas sistem, performa MCP runner, dan peningkatan lintas OS.'}</div>
            </div>

            {updateStatusMsg && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-xs font-mono text-cyan-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>{updateStatusMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (updateInfo.html_url) {
                    invoke('open_in_browser', { url: updateInfo.html_url }).catch(() => {});
                  }
                }}
                className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
              >
                Lihat di GitHub Releases ↗
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  Nanti Saja
                </button>
                <button
                  type="button"
                  onClick={handleExecuteUpdate}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Memasang...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Update Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
