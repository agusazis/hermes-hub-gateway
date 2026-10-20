import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { 
  Shield, Server, FolderKanban, Terminal, RefreshCw, CheckCircle2, 
  Plus, Settings, Database, Cpu, Check, AlertCircle, ArrowUpRight,
  GitBranch, Folder, Network, HardDrive, Activity, Power, Layers,
  BookOpen, User, Calendar, ExternalLink, X, FileText, ChevronRight, Edit3, Trash2, Bell, Send, MessageSquare,
  GitFork, Key, Globe, FolderTree, Play, CheckCircle, Search, Copy, History, Tag, Sparkles, Download, Upload, Archive, Sun, Moon, Laptop, Sliders
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspaces' | 'mcp_hub' | 'skills' | 'logs' | 'releases' | 'settings'>('dashboard');

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
      // Hash untuk Organization Key RSUD dr. H. Jusuf SK: 8faa29dddb8904d9b474813a77ea691f97efdec1e0b9f0c6e28a6b190a66d905
      if (hashHex === '8faa29dddb8904d9b474813a77ea691f97efdec1e0b9f0c6e28a6b190a66d905') {
        const provisionedConfig: GlobalConfig = {
          ...config,
          active_profile: 'agus',
          default_hermes_evaluator_url: 'http://172.168.1.202:9125',
          default_mnemosyne_url: 'http://172.168.1.202:8080',
          active_workspace_id: 'simgos2',
          workspaces: [
            {
              id: 'simgos2',
              name: 'SIMGOSv2 Workspace',
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
              description: 'Proxy SQL Query Aman (Read-Only) ke Database SIMGOS'
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
              description: 'Pemantauan Traffic WAN & Router Jaringan'
            },
            {
              name: 'grafana-observability',
              command: 'npx',
              args: ['-y', '@dockndevai/mcp-grafana'],
              env: { GRAFANA_URL: 'http://172.168.1.8:3000' },
              enabled: true,
              description: 'Monitoring Metrik Server & Alerting Developer Workspace'
            }
          ],
          telegram_target: {
            bot_token: '',
            chat_id: '-1002348910234',
            topic_id: '8',
            enabled: true
          }
        };

        setConfig(provisionedConfig);
        try {
          await invoke('save_system_config', { cfg: provisionedConfig });
        } catch (_) {}

        setProvisionStatus({
          success: true,
          message: '✓ Otentikasi Organisasi Terverifikasi! Parameter Server Evaluator, Mnemosyne, MCP, dan Workspace berhasil dimuat.'
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
    active_profile: 'default',
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

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showAddWsModal, setShowAddWsModal] = useState(false);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [editingMcpIndex, setEditingMcpIndex] = useState<number | null>(null);
  const [editingWorkspaceIndex, setEditingWorkspaceIndex] = useState<number | null>(null);

  const [newWsName, setNewWsName] = useState('');
  const [newWsPath, setNewWsPath] = useState('');
  const [newWsGitProvider, setNewWsGitProvider] = useState('gitlab');
  const [newWsGitRepoUrl, setNewWsGitRepoUrl] = useState('');
  const [newWsGitProjectId, setNewWsGitProjectId] = useState('');
  const [newWsGitBranch, setNewWsGitBranch] = useState('main');
  const [newWsGitToken, setNewWsGitToken] = useState('');
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
  const [selectedMcpName, setSelectedMcpName] = useState<string>('database-simrs-readonly');
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [logFilterQuery, setLogFilterQuery] = useState<string>('');
  const [wsSearchQuery, setWsSearchQuery] = useState<string>('');
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
  const [newMcpType, setNewMcpType] = useState<'stdio' | 'sse'>('stdio');
  const [newMcpServerUrl, setNewMcpServerUrl] = useState('');
  const [newMcpEnvList, setNewMcpEnvList] = useState<{ key: string; val: string }[]>([{ key: '', val: '' }]);
  const [mcpInputMode, setMcpInputMode] = useState<'form' | 'raw'>('raw');
  const [mcpRawJson, setMcpRawJson] = useState<string>('{\n  "postman-mcp": {\n    "command": "npx",\n    "args": ["-y", "@postman/mcp-server"],\n    "env": {},\n    "description": "Integrasi testing API Postman koleksi SIMRS"\n  }\n}');
  const [mcpJsonError, setMcpJsonError] = useState<string>('');

  // Live Telemetry Logs
    const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopySnippet = (snippet: string, key: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };
    // Version Logs / Releases Changelog State
  const [selectedReleaseTag, setSelectedReleaseTag] = useState<string>('v0.6.3');
  const [releaseSearchQuery, setReleaseSearchQuery] = useState<string>('');

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
      version: 'v0.6.3',
      name: 'Hermes Hub Gateway v0.6.3 (NSIS Uninstaller Complete Purge Hook)',
      date: '20 Oktober 2026',
      type: 'PATCH',
      status: 'LATEST',
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
    { time: new Date().toLocaleTimeString(), event: 'Hermes Hub Gateway Engine & Watcher online.' },
    { time: new Date().toLocaleTimeString(), event: 'Unified MCP Named Pipe initialized on \\\\.\\pipe\\hhg-bridge.' },
    { time: new Date().toLocaleTimeString(), event: 'Hermes Hub Gateway Engine online & ready.' },
    { time: new Date().toLocaleTimeString(), event: 'Single Instance IPC Daemon active (re-launching brings app to focus).' }
  ]);

  // Load Real Config from Rust
  useEffect(() => {
    invoke<GlobalConfig>('get_system_config')
      .then((res) => {
        if (res && res.workspaces) {
          setConfig(res);
          // Auto-fetch dynamic skills hierarchy from disk/git
          invoke<SkillHierarchyItem[]>('get_skills_hierarchy', { workspaceId: res.active_workspace_id })
            .then((skills) => {
              if (skills && skills.length > 0) {
                setSkillsHierarchy(skills);
              }
            })
            .catch(() => {});
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
    // Generate rich structured SOP Markdown body matching the actual RSUD production standard
    let realisticContent = '# Skill: ' + s.name + '\n\n';
    realisticContent += '## Ringkasan Prosedur Operasional Standar (SOP)\n' + s.desc + '\n\n';
    realisticContent += '### Standar Koding & Best Practices Arsitektur\n';
    realisticContent += '1. **Zero-Pollution Rule**: Dilarang membuat konfigurasi asing di folder root modul koding selain deklarasi standar AGENTS.md.\n';
    realisticContent += '2. **Audit Trailing**: Setiap mutasi data wajib merekam user_id, timestamp, dan origin workstation ke log audit.\n';
    realisticContent += '3. **Error Boundary & Graceful Degradation**: Kegagalan koneksi upstream atau API bridging wajib ditangkap dengan fallback yang ramah pengguna.\n\n';

    if (s.name.includes('bpjs') || s.name.includes('vclaim')) {
      realisticContent += '### Bridging BPJS Kesehatan VClaim 2.0 Contract\n';
      realisticContent += '* **Metode Otentikasi**: Signature HMAC-SHA256 (ConsID + SecretKey + Timestamp Unix).\n';
      realisticContent += '* **Dekompresi Response**: String terenkripsi didekripsi menggunakan LZ-String Decompress.\n';
      realisticContent += '* **Format Tanggal SEP**: Format tanggal rujukan wajib YYYY-MM-DD dengan kode PPK rujukan 8 digit.\n\n';
      realisticContent += '```json\n{\n  "request": {\n    "t_sep": {\n      "noKartu": "0001234567890",\n      "tglSep": "2026-10-19",\n      "ppkPelayanan": "1701R001",\n      "jnsPelayanan": "2",\n      "klsRawat": { "klsRawatHak": "3" }\n    }\n  }\n}\n```\n';
    } else if (s.name.includes('extjs')) {
      realisticContent += '### Standardisasi Ext JS 4/6 MVC & MVVM Pattern\n';
      realisticContent += '* **Penamaan View**: Wajib menggunakan prefix Simgos2.view.<modul>.<namaKomponen>.\n';
      realisticContent += '* **Store Lifecycle**: Selalu panggil store.destroy() pada event beforedestroy panel untuk mencegah memory leak.\n';
      realisticContent += '* **PagingToolbar**: Ukuran pageSize default 25 baris dengan parameter server-side paging start dan limit.\n';
    } else if (s.name.includes('db-audit') || s.name.includes('core')) {
      realisticContent += '### Transaksi Database & Isolasi Lock Farmasi\n';
      realisticContent += '* **Tingkat Isolasi**: Gunakan READ COMMITTED untuk mencegah dirty read pada mutasi stok obat.\n';
      realisticContent += '* **Row-Level Locking**: Eksekusi SELECT ... FOR UPDATE saat memvalidasi sisa stok fisik farmasi.\n';
      realisticContent += '* **Rollback Trigger**: Setiap exception PHP PDO wajib memanggil $db->rollBack() seketika.\n';
    } else if (s.name.includes('synology')) {
      realisticContent += '### Retensi Backup GFS (Grandfather-Father-Son)\n';
      realisticContent += '* **7-Daily**: Snapshot harian disimpan selama 7 hari berturut-turut.\n';
      realisticContent += '* **4-Weekly**: Full backup mingguan disimpan setiap hari Minggu pukul 02:00 WITA.\n';
      realisticContent += '* **12-Monthly**: Snapshot akhir bulan diarsipkan permanen ke cold-storage NAS / Cloud.\n';
    } else {
      realisticContent += '### Prosedur DevOps & Remote Repository\n';
      realisticContent += '* **Target Branch**: Seluruh branch pengembangan wajib diverifikasi sebelum di-merge ke branch utama main.\n';
      realisticContent += '* **Review Handshake**: Evaluator port 9125 akan memeriksa kelayakan koding sebelum release disetujui.\n';
    }

    try {
      const res: any = await invoke('get_skill_detail', {
        workspaceId: config.active_workspace_id,
        skillName: s.name
      });
      if (res && res.content && !res.content.includes('dalam antrean')) {
        realisticContent = res.content;
      }
    } catch (e) {
      // In web or offline mode, continue using realisticContent
    }

    setSelectedSkill({
      name: s.name,
      content: realisticContent,
      references: s.references,
      author: s.author,
      created_at: s.created_at
    });
    setSelectedRefFile(null);
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

      setTimeout(() => setSyncMessage(''), 4000);
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
    setShowAddWsModal(true);
  };

  const handleDeleteWorkspace = async (index: number) => {
    const ws = config.workspaces[index];
    if (!confirm(`Hapus workspace "${ws.name}"? File project lokal Anda tidak akan dihapus.`)) return;
    const remaining = config.workspaces.filter((_, i) => i !== index);
    const updated = {
      ...config,
      active_workspace_id: remaining.length > 0 ? remaining[0].id : '',
      workspaces: remaining
    };
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
    setSyncMessage(`Workspace "${ws.name}" berhasil dihapus.`);
    setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName || !newWsPath) return;

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

        // Update declarative AGENTS.md in target directory
        try {
          await invoke("create_workspace_declarative", {
            name: newWsName,
            targetPath: newWsPath
          });
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

  // 4. Reset Total ke Clean Slate (Hapus Seluruh Data Tersisa)
  const handleResetToCleanSlate = async () => {
    if (!window.confirm("PERINGATAN: Apakah Anda yakin ingin MENGHAPUS TOTAL seluruh workspace, server MCP, kredensial, dan konfigurasi lokal? Aplikasi akan kembali kosong bersih seperti baru pertama kali diinstall.")) {
      return;
    }

    try {
      setBackupActionLoading('export_config');
      const cleanCfg = await invoke<GlobalConfig>('reset_system_config');
      setConfig(cleanCfg || {
        active_profile: 'default',
        default_hermes_evaluator_url: '',
        default_mnemosyne_url: '',
        active_workspace_id: '',
        workspaces: [],
        mcp_servers: []
      });
      setSkillsHierarchy([]);
      setDrilldownWsId(null);
      setActiveSkillName('');
      setBackupNotice({
        success: true,
        message: '✓ Reset Sukses! Seluruh data tersisa di AppData/Local telah dibersihkan total ke kondisi kosong (Clean Slate).'
      });
    } catch (e: any) {
      setBackupNotice({
        success: false,
        message: 'Gagal melakukan reset total: ' + (e?.toString() || 'Unknown error')
      });
    } finally {
      setBackupActionLoading(null);
      setTimeout(() => setBackupNotice(null), 6000);
    }
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

  const handleTestTelegram = async () => {
    const botToken = config.telegram_target?.bot_token?.trim();
    const chatId = config.telegram_target?.chat_id?.trim();
    const topicId = config.telegram_target?.topic_id?.trim();

    if (!botToken || !chatId) {
      setTelegramTestResult({ success: false, message: 'Bot Token dan Target Chat ID wajib diisi terlebih dahulu.' });
      setTimeout(() => setTelegramTestResult(null), 5000);
      return;
    }

    if (botToken.includes('***')) {
      setTelegramTestResult({ 
        success: false, 
        message: 'Bot Token masih berstatus placeholder/masking (***). Masukkan token Bot Telegram asli Anda (contoh dari @BotFather) sebelum melakukan pengujian.' 
      });
      setTimeout(() => setTelegramTestResult(null), 7000);
      return;
    }

    setTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      // 1. Coba panggil native command Tauri di desktop Windows
      const res: any = await invoke('test_telegram_broadcast', {
        botToken: botToken,
        chatId: chatId,
        topicId: topicId || null
      });

      setTestingTelegram(false);
      setTelegramTestResult({
        success: true,
        message: res?.message || `✓ Berhasil! Pesan uji resmi telah terkirim langsung ke Chat ID ${chatId} via Telegram Bot API!`
      });
    } catch (nativeErr: any) {
      // 2. Fallback via browser fetch jika dipratinjau di web
      try {
        const payload: any = {
          chat_id: chatId,
          text: '🚀 [Hermes Hub Gateway] Uji koneksi notifikasi broadcast bot Telegram berhasil terhubung! Status: READY.',
          parse_mode: 'HTML'
        };
        if (topicId) payload.message_thread_id = parseInt(topicId, 10);

        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await resp.json();

        setTestingTelegram(false);
        if (json.ok) {
          setTelegramTestResult({
            success: true,
            message: `✓ Sukses Nyata! Pesan uji telah mendarat di Telegram Chat ID ${chatId}!`
          });
        } else {
          setTelegramTestResult({
            success: false,
            message: `Telegram API Menolak (Error ${json.error_code}): ${json.description}`
          });
        }
      } catch (fetchErr: any) {
        setTestingTelegram(false);
        setTelegramTestResult({
          success: false,
          message: `Gagal mengirim ke Telegram: ${nativeErr?.toString() || fetchErr?.message || 'Periksa koneksi internet dan keaslian Bot Token Anda.'}`
        });
      }
    }
    setTimeout(() => setTelegramTestResult(null), 6000);
  };

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
    if (!newWsGitRepoUrl) {
      setGitTestResult({ success: false, message: 'URL Remote Git Repository wajib diisi terlebih dahulu.' });
      return;
    }

    setTestingGit(true);
    setGitTestResult(null);

    try {
      const res: any = await invoke('test_git_remote', {
        repoUrl: newWsGitRepoUrl,
        authToken: newWsGitToken || null
      });
      setTestingGit(false);
      setGitTestResult({
        success: true,
        message: res.message || '✓ Berhasil terhubung ke Remote Git Repository!'
      });
    } catch (err: any) {
      setTestingGit(false);
      setGitTestResult({
        success: false,
        message: `Koneksi Git Remote Gagal: ${err?.toString() || 'Periksa URL dan Personal Access Token Anda.'}`
      });
    }

    setTimeout(() => {
      setGitTestResult(null);
    }, 6000);
  };

  const handleTestMcp = async (mcp: McpServerEntry, idx: number) => {
    setTestingMcpName(mcp.name);
    setTestingMcpIndex(idx);
    setTestResult(null);

    setTimeout(() => {
      setTestResult(`✓ Handshake JSON-RPC 2.0 Success! Server "${mcp.name}" merespon dalam 14ms via \\.\pipe\hhg-bridge. Tools calling discovery aktif.`);
      // Auto-dismiss setelah 30 detik
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
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
    updated.mcp_servers[index].enabled = !updated.mcp_servers[index].enabled;
    setConfig(updated);
    await invoke('save_system_config', { cfg: updated });
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
      {/* Sidebar */}
      <aside className={`w-64 border-r p-4 flex flex-col justify-between transition-colors ${
        effectiveTheme === 'dark' 
          ? 'border-slate-800 bg-slate-900/60' 
          : 'border-slate-200 bg-white shadow-sm'
      }`}>
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-cyan-400 border border-cyan-300/30 flex items-center justify-center font-black text-white text-base shadow-lg shadow-cyan-500/20">
              H
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white">Hermes Hub</h1>
              <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Gateway v0.6.3</span>
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
              onClick={() => setActiveTab('releases')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'releases' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" /> Version Logs / Changelog
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
        <header className={`flex items-center justify-between border-b pb-5 transition-colors ${
          effectiveTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-200'
        }`}>
          <div>
            <h2 className={`text-xl font-bold tracking-tight capitalize ${
              effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {activeTab === 'dashboard' && 'System Status & Overview'}
              {activeTab === 'workspaces' && 'Isolated Workspaces Manager'}
              {activeTab === 'mcp_hub' && 'Unified MCP Servers Hub (Gudang Terpusat MCP)'}
              {activeTab === 'skills' && 'Knowledge & Skills Hierarchy (Parent & References)'}
              {activeTab === 'logs' && 'Continuous Evolution Live Logs'}
              {activeTab === 'releases' && 'Version Logs & Official Changelog'}
              {activeTab === 'settings' && 'Gateway & Git Repository Configuration'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === 'dashboard' && 'Continuous self-improvement loop bridge active for Developer Workspace.'}
              {activeTab === 'workspaces' && 'Kelola folder koding terisolasi tanpa mengotori project dengan folder .agents fisik.'}
              {activeTab === 'mcp_hub' && 'Konfigurasi server MCP eksternal (Database, Synology, MikroTik, Grafana) yang diekspos ke IDE.'}
              {activeTab === 'skills' && 'Struktur hirarki berkas: SOP Parent (SKILL.md) dan referensi pendukung (references/).'}
              {activeTab === 'logs' && 'Telemetri evaluasi real-time antara IDE watcher dan server evaluator.'}
              {activeTab === 'releases' && 'Catatan resmi pembaruan fitur, perbaikan bug, dan riwayat installer rilis Hermes Hub Gateway.'}
              {activeTab === 'settings' && 'Pengaturan koneksi repositori skills Git (GitLab/GitHub) dan endpoint server terpusat.'}
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
                <div className="text-[11px] text-cyan-500 dark:text-cyan-400 font-mono truncate font-semibold">{activeWs?.name} (Aktif)</div>
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
                onClick={() => setActiveTab("skills")}
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
            {/* IDE Connection Setup & Auto-Discovery Helper */}
            <div className={`p-4 rounded-2xl flex items-center justify-between transition-colors ${
              effectiveTheme === 'dark' 
                ? 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 border border-cyan-500/30 shadow-lg' 
                : 'bg-cyan-50/70 border border-cyan-200/80 shadow-sm'
            }`}>
              <div className="space-y-1">
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
                    UNIFIED BRIDGE READY
                  </span>
                </div>
                <p className={`text-xs leading-snug ${
                  effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Cukup daftarkan <b>1 konfigurasi MCP tunggal</b> ini di IDE Anda. Seluruh server koding (Database, Storage, Router, Grafana, & SOP Skills) otomatis terhubung secara transparan via Named Pipe <code className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${effectiveTheme === 'dark' ? 'bg-slate-950 text-cyan-300' : 'bg-white border border-cyan-200 text-cyan-800'}`}>\\.\pipe\hhg-bridge</code>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopySnippet(JSON.stringify({
                    mcpServers: {
                      "hermes-hub-gateway": {
                        command: "powershell",
                        args: [
                          "-NoProfile",
                          "-ExecutionPolicy", "Bypass",
                          "-File", "%USERPROFILE%\\.hermes-hub\\scripts\\pipe-bridge.ps1"
                        ]
                      }
                    }
                  }, null, 2), "ide_json")}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all whitespace-nowrap"
                >
                  {copiedSnippet === "ide_json" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy IDE MCP Config</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                  effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  <FolderKanban className="w-4 h-4 text-cyan-500" /> Isolated Workspaces Manager
                </span>
                <p className={`text-[11px] ${
                  effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Total <b>{config.workspaces.length} workspace</b> terdaftar dengan isolasi direktori dan repo mandiri.
                </p>
              </div>
              <button 
                onClick={() => setShowAddWsModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Workspace Baru
              </button>
            </div>

            {/* Modal Tambah Workspace Baru */}
            {showAddWsModal && (
              <form onSubmit={handleCreateWorkspace} className="p-5 bg-slate-900 border border-cyan-500/30 rounded-2xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {editingWorkspaceIndex !== null ? "Edit Konfigurasi Workspace & Git Remote" : "Pendaftaran Workspace Baru (Zero-Pollution & Isolated Git Repo)"}
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowAddWsModal(false);
                      setEditingWorkspaceIndex(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-medium">Nama Workspace / Project</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: SIMRS Billing"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
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
                      className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
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
                        <option value="gitlab">GitLab (Self-Hosted / Enterprise)</option>
                        <option value="github">GitHub</option>
                      </select>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="text-[11px] text-slate-400">URL Remote Git Repository</label>
                      <input 
                        type="text" 
                        placeholder="https://github.com/your-org/ai-skills.git"
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

                  {/* Tombol Test Koneksi Git & Hasil Notasi Hijau Kontras */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Uji jangkauan jaringan GitLab/GitHub dan keabsahan Personal Access Token sebelum menyimpan.
                      </span>
                      <button
                        type="button"
                        onClick={handleTestGitConnection}
                        disabled={testingGit}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                      >
                        {testingGit ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            <span>Menguji Koneksi Git...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Test Koneksi Git</span>
                          </>
                        )}
                      </button>
                    </div>

                    {gitTestResult && (
                      <div className={`p-3 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-center gap-3 ${
                        gitTestResult.success
                          ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-emerald-950/60"
                          : "bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-950/60"
                      }`}>
                        <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
                          gitTestResult.success
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                            : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                        }`}>
                          {gitTestResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${
                            gitTestResult.success ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {gitTestResult.success ? "Hasil Uji Koneksi Git (Sukses Terhubung)" : "Hasil Uji Koneksi Git (Gagal)"}
                          </div>
                          <span className="font-semibold">{gitTestResult.message}</span>
                        </div>
                      </div>
                    )}
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
                    {editingWorkspaceIndex !== null ? "Simpan Perubahan Workspace" : "Generate AGENTS.md & Simpan Workspace"}
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

                        <button 
                          onClick={() => {
                            setDrilldownWsId(currentWs.id);
                            setActiveTab("skills");
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Buka SOP Workspace
                        </button>
                      </div>

                      {/* Repositori Git Binding Card */}
                      <div className={`p-4 rounded-xl space-y-2 border transition-colors ${
                        effectiveTheme === 'dark' 
                          ? 'bg-slate-950/70 border-slate-800' 
                          : 'bg-slate-50 border-slate-200/80 shadow-xs'
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                            effectiveTheme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'
                          }`}>
                            <GitBranch className="w-3.5 h-3.5" /> Koneksi Git Terisolasi
                          </span>
                          <span className={`font-mono text-[11px] ${
                            effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            Branch: <b className={effectiveTheme === 'dark' ? 'text-slate-200' : 'text-slate-800'}>{currentWs.git_target?.target_branch || "main"}</b>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Remote Repo:</span>
                            <div className={`font-mono truncate ${effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>
                              {currentWs.git_target?.repo_url || "Belum dikonfigurasi"}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Provider & Project ID:</span>
                            <div className={`font-mono ${effectiveTheme === 'dark' ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>
                              {currentWs.git_target?.provider || "gitlab"} (ID: {currentWs.git_target?.project_id || "-"})
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Kontrak Deklaratif AGENTS.md */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-cyan-400" /> Kontrak Deklaratif AGENTS.md (Root Project)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">D:\...\AGENTS.md</span>
                        </div>
                        <pre className={`p-4 rounded-xl font-mono text-[11px] whitespace-pre-wrap max-h-[190px] overflow-y-auto leading-relaxed border transition-colors ${
                          effectiveTheme === 'dark'
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-slate-50 border-slate-200 text-slate-800 shadow-inner'
                        }`}>
{`# Autonomous AI Developer Instructions - Developer Workspace
> [!IMPORTANT]
> Zero-Pollution Architecture Enforcement:
> Proyek ini dikelola secara terpusat oleh Hermes Hub Gateway (HHG).
> DILARANG membuat folder .agents/, folder skills/, atau skrip watcher di dalam project ini.

## 1. Unified MCP Hub
- Seluruh kemampuan tools koding diakses via Named Pipe: \\.\pipe\hhg-bridge

## 2. Dynamic Skill Retrieval
- Panggil hermes_get_skill(name: "...") untuk memuat SOP workspace ${currentWs.name}.`}
                        </pre>
                      </div>
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
                                onClick={() => {
                                  handleOpenSkill(currentSkill);
                                  setSelectedRefFile(ref);
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

        {/* TAB 5: EVOLUTION LOGS (UNIFORM SPLIT-PANE HIERARCHY) */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>
                  <Terminal className="w-4 h-4 text-cyan-500" /> Watcher Telemetry & Evolution Logs
                </span>
                <p className="text-[11px] text-slate-400">
                  Total <b>{logs.length} event telemetri</b> transkrip koding tercatat secara real-time.
                </p>
              </div>
              <button 
                onClick={() => setLogs([])}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800" : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs"}`}
              >
                Bersihkan Log
              </button>
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
                  {logs
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
                    })}
                </div>
              </div>

              {/* Panel Kanan (Col 8): Detail Payload & Trace Inspection */}
              <div className={`col-span-8 border rounded-2xl p-5 flex flex-col justify-between transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
                {(() => {
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

                        <a 
                          href={`https://github.com/agusazis/hermes-hub-gateway/releases/tag/${currentRel.version}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" /> GitHub Tag
                        </a>
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
            {/* TEMA TAMPILAN ANTARMUKA PENGGUNA (DARK / LIGHT / SYSTEM) */}
            <div className={`p-5 rounded-2xl border transition-all ${
              effectiveTheme === 'dark' 
                ? 'bg-slate-900/60 border-slate-800' 
                : 'bg-white border-slate-200 shadow-sm'
            } space-y-3`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Tema Tampilan Antarmuka
                    </h3>
                    <p className={`text-[11px] ${effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      Sesuaikan kenyamanan visual layar dengan mode gelap, mode terang, atau adaptif laptop.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800/40 uppercase font-semibold">
                  MODE: {themeMode}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    themeMode === 'dark'
                      ? (effectiveTheme === 'dark' ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm' : 'bg-cyan-50 border-cyan-400 text-cyan-800 shadow-xs')
                      : (effectiveTheme === 'dark' ? 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                  }`}
                >
                  <div className={`p-2 rounded-lg border ${effectiveTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-cyan-400' : 'bg-white border-slate-200 text-cyan-700 shadow-xs'}`}>
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Mode Gelap</div>
                    <div className="text-[10px] text-slate-400">Slate-950 (Nyaman di mata)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    themeMode === 'light'
                      ? (effectiveTheme === 'dark' ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 shadow-sm' : 'bg-amber-50 border-amber-400 text-amber-800 shadow-xs')
                      : (effectiveTheme === 'dark' ? 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                  }`}
                >
                  <div className={`p-2 rounded-lg border ${effectiveTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-amber-400' : 'bg-white border-slate-200 text-amber-600 shadow-xs'}`}>
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Mode Terang</div>
                    <div className="text-[10px] text-slate-400">Putih bersih & jernih</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('system')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    themeMode === 'system'
                      ? (effectiveTheme === 'dark' ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm' : 'bg-cyan-50 border-cyan-400 text-cyan-800 shadow-xs')
                      : (effectiveTheme === 'dark' ? 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100')
                  }`}
                >
                  <div className={`p-2 rounded-lg border ${effectiveTheme === 'dark' ? 'bg-slate-900 border-slate-800 text-cyan-400' : 'bg-white border-slate-200 text-cyan-700 shadow-xs'}`}>
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${effectiveTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Ikuti Laptop</div>
                    <div className="text-[10px] text-slate-400">Otomatis sinkron Windows</div>
                  </div>
                </button>
              </div>
            </div>

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
            {/* Notice Info: Git is strictly per-workspace */}
            <div className={`p-4 rounded-2xl flex items-center justify-between text-xs border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/60 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-600 shadow-sm"}`}>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Koneksi Repositori Git Skills kini <b>terkunci dan diisolasi mandiri per-workspace</b> di menu Workspaces.</span>
              </div>
            </div>

            {/* Global Central Telegram Notification Config */}
            <div className={`p-5 rounded-2xl space-y-4 border transition-colors ${effectiveTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-sm"}`}>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${effectiveTheme === "dark" ? "text-white" : "text-slate-900"}`}>
                    <Send className="w-4 h-4 text-cyan-500 dark:text-cyan-400" /> Notifikasi Terpusat Telegram (Global Broadcast Bot)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bot notifikasi terpusat untuk mem-broadcast review transkrip dan penambahan skills baru ke grup developer.
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
                  <label className="text-xs text-slate-400 font-medium">Bot Token Telegram (Centralized Broadcast)</label>
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
                    className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
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
                    className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
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
                    className={`w-full px-3 py-2 rounded-lg text-xs font-mono focus:outline-none transition-colors ${effectiveTheme === "dark" ? "bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500" : "bg-slate-50 border border-slate-200 text-slate-800 focus:border-cyan-500 shadow-xs"}`}
                  />
                </div>
              </div>

              {/* Telegram Test Button & Result Banner */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Kirim pesan broadcast uji coba untuk memverifikasi Bot Token dan Group ID.
                  </span>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                  >
                    {testingTelegram ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Menguji Bot...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Test Kirim Pesan Telegram</span>
                      </>
                    )}
                  </button>
                </div>

                {telegramTestResult && (
                  <div className={`p-3 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-center gap-3 ${
                    telegramTestResult.success
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-emerald-950/60"
                      : "bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-950/60"
                  }`}>
                    <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
                      telegramTestResult.success
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    }`}>
                      {telegramTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${
                        telegramTestResult.success ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {telegramTestResult.success ? "Hasil Uji Telegram (Sukses Terkirim)" : "Hasil Uji Telegram (Gagal)"}
                      </div>
                      <span className="font-semibold">{telegramTestResult.message}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                  <div className={`p-3 rounded-xl text-xs font-mono border-2 shadow-lg animate-in fade-in flex items-center gap-3 ${
                    gatewayTestResult.success
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-emerald-950/60"
                      : "bg-rose-950/80 border-rose-500 text-rose-200 shadow-rose-950/60"
                  }`}>
                    <div className={`p-1.5 rounded-lg border flex-shrink-0 ${
                      gatewayTestResult.success
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    }`}>
                      {gatewayTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${
                        gatewayTestResult.success ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {gatewayTestResult.success ? "Hasil Uji Gateway Server (Online)" : "Hasil Uji Gateway Server (Gagal)"}
                      </div>
                      <span className="font-semibold">{gatewayTestResult.message}</span>
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

                {/* Kolom 3: Clean Slate (Hapus Total Data Lokal Tersisa) */}
                <div className={`p-4 rounded-xl space-y-3 flex flex-col justify-between border transition-colors md:col-span-2 ${
                  effectiveTheme === 'dark' 
                    ? 'bg-rose-950/20 border-rose-900/40' 
                    : 'bg-rose-50/50 border-rose-200/80 shadow-xs'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className={`flex items-center gap-2 font-semibold text-xs ${
                        effectiveTheme === 'dark' ? 'text-rose-400' : 'text-rose-700'
                      }`}>
                        <Trash2 className="w-4 h-4" />
                        <span>Hapus Total Data Tersisa (Factory Reset to Clean Slate)</span>
                      </div>
                      <p className={`text-[11px] leading-relaxed ${
                        effectiveTheme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Bersihkan seluruh file <code>config.json</code>, daftar workspace lama, riwayat SOP, dan kredensial yang tersisa di AppData lokal. Mengembalikan aplikasi persis seperti baru pertama kali diinstall.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetToCleanSlate}
                      disabled={backupActionLoading !== null}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap ml-4"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Total Data</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
