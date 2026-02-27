import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Key, Lock, Unlock, Eye, EyeOff, Search, Plus, Copy, RefreshCw,
  Folder, FolderOpen, Clock, AlertTriangle, Check, X, Download, Upload,
  ChevronRight, ChevronDown, Trash2, Edit, MoreVertical, Loader, Settings,
  AlertCircle, FileText, Hash, Database, Globe, Mail, Server
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Secret { id: string; key: string; type: string; scope: string; folder: string; created_at: string; last_rotated: string; rotation_days: number; masked_value: string; }
interface SecretFolder { id: string; name: string; count: number; icon: string; }
interface AuditEntry { id: string; action: string; secret_key: string; user: string; timestamp: string; ip: string; }

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

const typeIcons: Record<string, React.ReactNode> = {
  api_key: <Key className="w-4 h-4" />,
  password: <Lock className="w-4 h-4" />,
  connection_string: <Database className="w-4 h-4" />,
  certificate: <Shield className="w-4 h-4" />,
  token: <Hash className="w-4 h-4" />,
  ssh_key: <Server className="w-4 h-4" />,
  webhook: <Globe className="w-4 h-4" />,
  smtp: <Mail className="w-4 h-4" />,
};

const scopeColors: Record<string, string> = {
  global: 'bg-purple-500/20 text-purple-400',
  production: 'bg-red-500/20 text-red-400',
  staging: 'bg-yellow-500/20 text-yellow-400',
  development: 'bg-green-500/20 text-green-400',
  testing: 'bg-blue-500/20 text-blue-400',
};

export default function SecretsVault() {
  const isDemo = useIsDemoAccount();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [folders, setFolders] = useState<SecretFolder[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [activeView, setActiveView] = useState<'secrets' | 'audit' | 'compliance'>('secrets');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [complianceScore, setComplianceScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFolders([
        { id: 'f1', name: 'API Keys', count: 4, icon: 'key' },
        { id: 'f2', name: 'Database', count: 3, icon: 'database' },
        { id: 'f3', name: 'Authentication', count: 3, icon: 'lock' },
        { id: 'f4', name: 'External Services', count: 2, icon: 'globe' },
        { id: 'f5', name: 'Infrastructure', count: 2, icon: 'server' },
        { id: 'f6', name: 'Certificates', count: 1, icon: 'shield' },
      ]);
      setSecrets([
        { id: 's1', key: 'OPENAI_API_KEY', type: 'api_key', scope: 'global', folder: 'API Keys', created_at: '2025-01-01', last_rotated: '2025-01-10', rotation_days: 90, masked_value: 'sk-••••••••••••••••a3Jf' },
        { id: 's2', key: 'DATABASE_URL', type: 'connection_string', scope: 'production', folder: 'Database', created_at: '2024-12-01', last_rotated: '2025-01-05', rotation_days: 30, masked_value: 'postgres://••••:••••@db.nexus.io/prod' },
        { id: 's3', key: 'JWT_SECRET', type: 'token', scope: 'global', folder: 'Authentication', created_at: '2024-11-15', last_rotated: '2025-01-12', rotation_days: 60, masked_value: '••••••••••••••••••••••••••••••••' },
        { id: 's4', key: 'GITHUB_TOKEN', type: 'token', scope: 'development', folder: 'External Services', created_at: '2024-12-15', last_rotated: '2025-01-08', rotation_days: 90, masked_value: 'ghp_••••••••••••••••••Kx9m' },
        { id: 's5', key: 'REDIS_PASSWORD', type: 'password', scope: 'production', folder: 'Database', created_at: '2024-12-01', last_rotated: '2025-01-05', rotation_days: 30, masked_value: '••••••••••••' },
        { id: 's6', key: 'SMTP_PASSWORD', type: 'password', scope: 'global', folder: 'External Services', created_at: '2024-11-20', last_rotated: '2024-12-20', rotation_days: 60, masked_value: '••••••••••••' },
        { id: 's7', key: 'AWS_ACCESS_KEY', type: 'api_key', scope: 'production', folder: 'Infrastructure', created_at: '2024-10-01', last_rotated: '2025-01-01', rotation_days: 90, masked_value: 'AKIA••••••••••••Q3EF' },
        { id: 's8', key: 'SSL_CERTIFICATE', type: 'certificate', scope: 'production', folder: 'Certificates', created_at: '2024-06-01', last_rotated: '2024-12-01', rotation_days: 365, masked_value: '-----BEGIN CERT-----••••' },
        { id: 's9', key: 'STRIPE_SECRET_KEY', type: 'api_key', scope: 'production', folder: 'API Keys', created_at: '2024-11-01', last_rotated: '2025-01-10', rotation_days: 90, masked_value: 'sk_live_••••••••••••nB4z' },
        { id: 's10', key: 'SSH_DEPLOY_KEY', type: 'ssh_key', scope: 'staging', folder: 'Infrastructure', created_at: '2024-09-01', last_rotated: '2024-12-15', rotation_days: 180, masked_value: '-----BEGIN RSA-----••••' },
      ]);
      setAuditLog([
        { id: 'a1', action: 'rotated', secret_key: 'JWT_SECRET', user: 'system', timestamp: '2025-01-12T14:30:00Z', ip: '10.0.0.1' },
        { id: 'a2', action: 'accessed', secret_key: 'OPENAI_API_KEY', user: 'sarah.chen', timestamp: '2025-01-12T13:15:00Z', ip: '10.0.1.23' },
        { id: 'a3', action: 'rotated', secret_key: 'DATABASE_URL', user: 'admin', timestamp: '2025-01-05T10:00:00Z', ip: '10.0.0.1' },
        { id: 'a4', action: 'created', secret_key: 'STRIPE_SECRET_KEY', user: 'admin', timestamp: '2025-01-10T09:30:00Z', ip: '10.0.0.5' },
        { id: 'a5', action: 'accessed', secret_key: 'AWS_ACCESS_KEY', user: 'deploy-bot', timestamp: '2025-01-12T12:00:00Z', ip: '10.0.2.10' },
        { id: 'a6', action: 'updated', secret_key: 'SMTP_PASSWORD', user: 'admin', timestamp: '2024-12-20T16:45:00Z', ip: '10.0.0.1' },
      ]);
      setComplianceScore(87);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredSecrets = useMemo(() => {
    return secrets.filter(s => {
      const matchFolder = selectedFolder === 'all' || s.folder === selectedFolder;
      const matchSearch = s.key.toLowerCase().includes(searchQuery.toLowerCase()) || s.type.includes(searchQuery.toLowerCase());
      return matchFolder && matchSearch;
    });
  }, [secrets, selectedFolder, searchQuery]);

  const toggleValue = (id: string) => setShowValues(prev => ({ ...prev, [id]: !prev[id] }));

  const getDaysUntilRotation = (lastRotated: string, rotationDays: number) => {
    const last = new Date(lastRotated);
    const next = new Date(last.getTime() + rotationDays * 86400000);
    const now = new Date();
    return Math.ceil((next.getTime() - now.getTime()) / 86400000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-amber-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-amber-950/10 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotateY: 180 }} transition={{ duration: 0.5 }} className="p-3 bg-amber-500/20 rounded-xl">
              <Shield className="w-7 h-7 text-amber-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Secrets Vault</h1>
              <p className="text-gray-400 text-sm">Encrypted credential & secret management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-amber-600/50 hover:bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Rotate All</motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Add Secret</motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Secrets', value: secrets.length, icon: <Key className="w-5 h-5" />, color: 'amber' },
            { label: 'Folders', value: folders.length, icon: <Folder className="w-5 h-5" />, color: 'blue' },
            { label: 'Compliance', value: `${complianceScore}%`, icon: <Shield className="w-5 h-5" />, color: complianceScore > 80 ? 'green' : 'red' },
            { label: 'Need Rotation', value: secrets.filter(s => getDaysUntilRotation(s.last_rotated, s.rotation_days) < 7).length, icon: <AlertTriangle className="w-5 h-5" />, color: 'red' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className={`p-2 bg-${stat.color}-500/20 rounded-lg`}><span className={`text-${stat.color}-400`}>{stat.icon}</span></div>
                <span className="text-2xl font-bold text-white">{stat.value}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {[
            { key: 'secrets' as const, label: 'Secrets', icon: <Key className="w-4 h-4" /> },
            { key: 'audit' as const, label: 'Audit Log', icon: <FileText className="w-4 h-4" /> },
            { key: 'compliance' as const, label: 'Compliance', icon: <Shield className="w-4 h-4" /> },
          ].map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveView(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab.key ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/25' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {tab.icon}<span>{tab.label}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeView === 'secrets' && (
            <motion.div key="secrets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-6">
              {/* Folder Sidebar */}
              <div className="w-56 space-y-1 shrink-0">
                <motion.button whileHover={{ x: 4 }} onClick={() => setSelectedFolder('all')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedFolder === 'all' ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
                  <FolderOpen className="w-4 h-4" /> All Secrets <span className="ml-auto text-xs bg-gray-700/50 px-1.5 py-0.5 rounded">{secrets.length}</span>
                </motion.button>
                {folders.map(folder => (
                  <motion.button key={folder.id} whileHover={{ x: 4 }} onClick={() => setSelectedFolder(folder.name)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedFolder === folder.name ? 'bg-amber-600/20 text-amber-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
                    <Folder className="w-4 h-4" /> {folder.name} <span className="ml-auto text-xs bg-gray-700/50 px-1.5 py-0.5 rounded">{folder.count}</span>
                  </motion.button>
                ))}
              </div>

              {/* Secrets List */}
              <div className="flex-1 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Search secrets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500" />
                </div>
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
                  {filteredSecrets.map(secret => {
                    const daysUntil = getDaysUntilRotation(secret.last_rotated, secret.rotation_days);
                    const urgent = daysUntil < 7;
                    const warning = daysUntil < 30;
                    return (
                      <motion.div key={secret.id} variants={itemVariants} className={`p-4 bg-gray-800/30 border rounded-xl hover:border-gray-600 transition-all ${urgent ? 'border-red-500/50' : warning ? 'border-yellow-500/30' : 'border-gray-700/50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${urgent ? 'bg-red-500/20' : 'bg-gray-700/50'}`}>
                              <span className={urgent ? 'text-red-400' : 'text-amber-400'}>{typeIcons[secret.type] || <Key className="w-4 h-4" />}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <code className="font-mono font-semibold text-white text-sm">{secret.key}</code>
                                <span className={`px-1.5 py-0.5 rounded text-xs ${scopeColors[secret.scope] || 'bg-gray-700 text-gray-400'}`}>{secret.scope}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><Folder className="w-3 h-3" /> {secret.folder}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Rotated: {secret.last_rotated}</span>
                                <span className={`flex items-center gap-1 ${urgent ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-green-400'}`}>
                                  {urgent ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                                  {daysUntil > 0 ? `${daysUntil}d until rotation` : 'Overdue!'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg px-3 py-1.5 font-mono text-xs text-gray-400 min-w-[180px]">
                              {showValues[secret.id] ? 'real-value-hidden-demo' : secret.masked_value}
                            </div>
                            <motion.button whileHover={{ scale: 1.1 }} onClick={() => toggleValue(secret.id)} className="p-1.5 hover:bg-gray-700/50 rounded-lg">
                              {showValues[secret.id] ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-gray-700/50 rounded-lg"><Copy className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-amber-500/20 rounded-lg"><RefreshCw className="w-3.5 h-3.5 text-amber-400" /></motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </motion.div>
          )}

          {activeView === 'audit' && (
            <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-700/50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left p-4">Action</th><th className="text-left p-4">Secret</th><th className="text-left p-4">User</th><th className="text-left p-4">IP</th><th className="text-right p-4">Time</th>
                  </tr></thead>
                  <tbody>
                    {auditLog.map(entry => (
                      <motion.tr key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/30 hover:bg-gray-800/50 transition-colors">
                        <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs ${entry.action === 'rotated' ? 'bg-blue-500/20 text-blue-400' : entry.action === 'accessed' ? 'bg-green-500/20 text-green-400' : entry.action === 'created' ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{entry.action}</span></td>
                        <td className="p-4"><code className="font-mono text-sm text-amber-300">{entry.secret_key}</code></td>
                        <td className="p-4 text-sm text-gray-400">{entry.user}</td>
                        <td className="p-4"><code className="text-xs text-gray-500">{entry.ip}</code></td>
                        <td className="p-4 text-right text-sm text-gray-500">{new Date(entry.timestamp).toLocaleString()}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeView === 'compliance' && (
            <motion.div key="compliance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="p-8 bg-gray-800/30 border border-gray-700/50 rounded-xl text-center">
                <div className="relative w-40 h-40 mx-auto mb-4">
                  <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" fill="none" stroke="rgb(55,65,81)" strokeWidth="12" />
                    <motion.circle cx="80" cy="80" r="70" fill="none" strokeWidth="12" strokeLinecap="round"
                      stroke={complianceScore > 80 ? '#34d399' : complianceScore > 60 ? '#fbbf24' : '#f87171'}
                      strokeDasharray={`${(complianceScore / 100) * 440} 440`}
                      initial={{ strokeDasharray: '0 440' }} animate={{ strokeDasharray: `${(complianceScore / 100) * 440} 440` }}
                      transition={{ duration: 1.5, ease: 'easeOut' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white">{complianceScore}%</span>
                    <span className="text-xs text-gray-500">Compliance Score</span>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white">Vault Compliance Report</h3>
                <p className="text-sm text-gray-400 mt-1">Last scanned: {new Date().toLocaleDateString()}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Rotation Policy Compliance', status: 'pass', detail: '8/10 secrets within rotation window' },
                  { label: 'Encryption Standard', status: 'pass', detail: 'AES-256-GCM encryption verified' },
                  { label: 'Access Control', status: 'warning', detail: '2 secrets accessible by too many users' },
                  { label: 'Audit Logging', status: 'pass', detail: 'All access events logged' },
                  { label: 'Secret Strength', status: 'pass', detail: 'All passwords meet complexity requirements' },
                  { label: 'Expired Secrets', status: 'fail', detail: '1 secret past rotation deadline' },
                ].map((check, i) => (
                  <motion.div key={check.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                    className={`p-4 bg-gray-800/30 border rounded-xl ${check.status === 'fail' ? 'border-red-500/50' : check.status === 'warning' ? 'border-yellow-500/30' : 'border-gray-700/50'}`}>
                    <div className="flex items-center gap-3">
                      {check.status === 'pass' ? <Check className="w-5 h-5 text-green-400" /> : check.status === 'warning' ? <AlertTriangle className="w-5 h-5 text-yellow-400" /> : <X className="w-5 h-5 text-red-400" />}
                      <div>
                        <p className="font-medium text-white text-sm">{check.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
