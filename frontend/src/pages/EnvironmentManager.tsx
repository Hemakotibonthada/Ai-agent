import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Globe, Settings, Search, Plus, RefreshCw, Copy, Edit, Trash2,
  Check, X, AlertTriangle, Eye, EyeOff, Download, Upload, GitCompare,
  Loader, ChevronRight, ChevronDown, Lock, Unlock, Hash, Clock, Filter,
  FileText, ArrowRight, FolderOpen
} from 'lucide-react';

interface Environment { id: string; name: string; type: string; status: string; variables_count: number; base_url: string; region: string; last_deployed: string; }
interface EnvVariable { key: string; value: string; type: string; is_secret: boolean; source: string; description: string; }

const typeColors: Record<string, string> = {
  production: 'bg-red-500/20 text-red-400 border-red-500/30',
  staging: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  development: 'bg-green-500/20 text-green-400 border-green-500/30',
  testing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

export default function EnvironmentManager() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnv, setSelectedEnv] = useState<string>('');
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [activeView, setActiveView] = useState<'variables' | 'compare' | 'history'>('variables');
  const [loading, setLoading] = useState(true);
  const [compareEnv, setCompareEnv] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setEnvironments([
        { id: 'env-1', name: 'Production', type: 'production', status: 'running', variables_count: 45, base_url: 'https://api.nexus-ai.com', region: 'us-east-1', last_deployed: '2025-01-15T10:00:00Z' },
        { id: 'env-2', name: 'Staging', type: 'staging', status: 'running', variables_count: 42, base_url: 'https://staging.nexus-ai.com', region: 'us-east-1', last_deployed: '2025-01-15T08:30:00Z' },
        { id: 'env-3', name: 'Development', type: 'development', status: 'running', variables_count: 38, base_url: 'http://localhost:8000', region: 'local', last_deployed: '2025-01-15T12:00:00Z' },
        { id: 'env-4', name: 'Testing', type: 'testing', status: 'idle', variables_count: 35, base_url: 'https://test.nexus-ai.com', region: 'us-west-2', last_deployed: '2025-01-14T16:00:00Z' },
      ]);
      setVariables([
        { key: 'DATABASE_URL', value: 'postgres://nexus:****@db.nexus.io:5432/nexus_prod', type: 'connection_string', is_secret: true, source: 'vault', description: 'Primary database connection' },
        { key: 'REDIS_URL', value: 'redis://redis.nexus.io:6379/0', type: 'connection_string', is_secret: true, source: 'vault', description: 'Redis cache connection' },
        { key: 'OPENAI_API_KEY', value: 'sk-••••••••••a3Jf', type: 'api_key', is_secret: true, source: 'vault', description: 'OpenAI API key for AI services' },
        { key: 'JWT_SECRET', value: '••••••••••••••••', type: 'secret', is_secret: true, source: 'vault', description: 'JWT signing secret' },
        { key: 'APP_DEBUG', value: 'false', type: 'boolean', is_secret: false, source: 'config', description: 'Enable debug mode' },
        { key: 'APP_PORT', value: '8000', type: 'number', is_secret: false, source: 'config', description: 'Application port' },
        { key: 'LOG_LEVEL', value: 'info', type: 'string', is_secret: false, source: 'config', description: 'Logging level' },
        { key: 'CORS_ORIGINS', value: 'https://app.nexus-ai.com,https://admin.nexus-ai.com', type: 'string', is_secret: false, source: 'config', description: 'Allowed CORS origins' },
        { key: 'MAX_UPLOAD_SIZE', value: '52428800', type: 'number', is_secret: false, source: 'config', description: 'Max file upload size (bytes)' },
        { key: 'SMTP_HOST', value: 'smtp.sendgrid.net', type: 'string', is_secret: false, source: 'config', description: 'SMTP server host' },
        { key: 'SMTP_PASSWORD', value: '••••••••', type: 'password', is_secret: true, source: 'vault', description: 'SMTP authentication password' },
        { key: 'SENTRY_DSN', value: 'https://abc123@sentry.io/12345', type: 'string', is_secret: false, source: 'config', description: 'Sentry error tracking DSN' },
        { key: 'FEATURE_AI_V2', value: 'true', type: 'boolean', is_secret: false, source: 'config', description: 'Enable AI v2 features' },
        { key: 'RATE_LIMIT_RPM', value: '1000', type: 'number', is_secret: false, source: 'config', description: 'Rate limit requests per minute' },
        { key: 'AWS_REGION', value: 'us-east-1', type: 'string', is_secret: false, source: 'config', description: 'AWS deployment region' },
      ]);
      setSelectedEnv('env-1');
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredVars = useMemo(() => variables.filter(v =>
    v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description.toLowerCase().includes(searchQuery.toLowerCase())
  ), [variables, searchQuery]);

  const secretCount = useMemo(() => variables.filter(v => v.is_secret).length, [variables]);
  const configCount = useMemo(() => variables.filter(v => !v.is_secret).length, [variables]);

  const diffData = useMemo(() => [
    { key: 'APP_DEBUG', env1: 'false', env2: 'true', status: 'different' },
    { key: 'LOG_LEVEL', env1: 'info', env2: 'debug', status: 'different' },
    { key: 'RATE_LIMIT_RPM', env1: '1000', env2: '5000', status: 'different' },
    { key: 'FEATURE_AI_V2', env1: 'true', env2: 'true', status: 'same' },
    { key: 'DATABASE_URL', env1: 'postgres://...prod', env2: 'postgres://...staging', status: 'different' },
    { key: 'TEST_MODE', env1: '-', env2: 'true', status: 'only_env2' },
    { key: 'PRODUCTION_ONLY', env1: 'true', env2: '-', status: 'only_env1' },
  ], []);

  const historyData = useMemo(() => [
    { id: 'h1', action: 'updated', key: 'LOG_LEVEL', old_value: 'debug', new_value: 'info', user: 'admin', timestamp: '2025-01-15T12:00:00Z' },
    { id: 'h2', action: 'created', key: 'FEATURE_AI_V2', old_value: '', new_value: 'true', user: 'tech.lead', timestamp: '2025-01-15T10:30:00Z' },
    { id: 'h3', action: 'rotated', key: 'JWT_SECRET', old_value: '', new_value: '', user: 'system', timestamp: '2025-01-12T14:30:00Z' },
    { id: 'h4', action: 'deleted', key: 'DEPRECATED_FLAG', old_value: 'false', new_value: '', user: 'admin', timestamp: '2025-01-10T09:00:00Z' },
    { id: 'h5', action: 'updated', key: 'CORS_ORIGINS', old_value: 'https://app.nexus-ai.com', new_value: 'https://app.nexus-ai.com,https://admin.nexus-ai.com', user: 'admin', timestamp: '2025-01-08T16:00:00Z' },
  ], []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-indigo-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.1, rotate: 90 }} transition={{ duration: 0.3 }} className="p-3 bg-indigo-500/20 rounded-xl"><Settings className="w-7 h-7 text-indigo-400" /></motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">Environment Manager</h1>
              <p className="text-gray-400 text-sm">Environment variables & configuration management</p>
            </div>
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.05 }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-2 border border-gray-700"><Download className="w-4 h-4" /> Export</motion.button>
            <motion.button whileHover={{ scale: 1.05 }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Add Variable</motion.button>
          </div>
        </div>

        {/* Environment Selector */}
        <div className="grid grid-cols-4 gap-3">
          {environments.map(env => (
            <motion.button key={env.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setSelectedEnv(env.id)}
              className={`p-4 rounded-xl border transition-all text-left ${selectedEnv === env.id ? `${typeColors[env.type]} border` : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white text-sm">{env.name}</span>
                <div className={`w-2 h-2 rounded-full ${env.status === 'running' ? 'bg-green-400' : 'bg-gray-400'}`} />
              </div>
              <p className="text-xs text-gray-500 truncate">{env.base_url}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{env.variables_count} vars</span>
                <span>·</span>
                <span>{env.region}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* View Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {[
            { key: 'variables' as const, label: 'Variables', icon: <Hash className="w-4 h-4" /> },
            { key: 'compare' as const, label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
            { key: 'history' as const, label: 'History', icon: <Clock className="w-4 h-4" /> },
          ].map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveView(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {tab.icon}<span>{tab.label}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Variables View */}
          {activeView === 'variables' && (
            <motion.div key="variables" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Search variables..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
                </div>
                <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowSecrets(!showSecrets)}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${showSecrets ? 'bg-amber-600/50 text-amber-200' : 'bg-gray-800/50 text-gray-400 border border-gray-700'}`}>
                  {showSecrets ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} {showSecrets ? 'Hide' : 'Show'} Secrets
                </motion.button>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="px-2 py-1 bg-gray-800/50 rounded-lg text-gray-400">{filteredVars.length} variables</span>
                <span className="px-2 py-1 bg-amber-500/10 rounded-lg text-amber-400 flex items-center gap-1"><Lock className="w-3 h-3" /> {secretCount} secrets</span>
                <span className="px-2 py-1 bg-blue-500/10 rounded-lg text-blue-400 flex items-center gap-1"><Settings className="w-3 h-3" /> {configCount} config</span>
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-1">
                {filteredVars.map(v => (
                  <motion.div key={v.key} variants={itemVariants} className="p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg hover:border-gray-600 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {v.is_secret ? <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        <code className="font-mono font-semibold text-white text-sm">{v.key}</code>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-500 truncate">{v.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-900/50 border border-gray-700/50 px-3 py-1 rounded font-mono text-gray-400 max-w-xs truncate">
                          {v.is_secret && !showSecrets ? '••••••••' : v.value}
                        </code>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${v.source === 'vault' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{v.source}</span>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button className="p-1 hover:bg-gray-700/50 rounded"><Copy className="w-3 h-3 text-gray-400" /></button>
                          <button className="p-1 hover:bg-gray-700/50 rounded"><Edit className="w-3 h-3 text-gray-400" /></button>
                          <button className="p-1 hover:bg-red-500/20 rounded"><Trash2 className="w-3 h-3 text-gray-400" /></button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Compare View */}
          {activeView === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-4">
                <select className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500" value={selectedEnv} onChange={e => setSelectedEnv(e.target.value)}>
                  {environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <ArrowRight className="w-5 h-5 text-gray-500" />
                <select className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500" value={compareEnv} onChange={e => setCompareEnv(e.target.value)}>
                  <option value="">Select environment...</option>
                  {environments.filter(e => e.id !== selectedEnv).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-700/50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left p-3">Key</th>
                    <th className="text-left p-3">{environments.find(e => e.id === selectedEnv)?.name || 'Env 1'}</th>
                    <th className="text-left p-3">{environments.find(e => e.id === compareEnv)?.name || 'Env 2'}</th>
                    <th className="text-center p-3">Status</th>
                  </tr></thead>
                  <tbody>
                    {diffData.map(d => (
                      <tr key={d.key} className={`border-b border-gray-700/30 ${d.status === 'different' ? 'bg-yellow-500/5' : d.status === 'only_env1' || d.status === 'only_env2' ? 'bg-red-500/5' : ''}`}>
                        <td className="p-3"><code className="font-mono text-sm text-white">{d.key}</code></td>
                        <td className="p-3"><code className="text-xs text-gray-400">{d.env1}</code></td>
                        <td className="p-3"><code className="text-xs text-gray-400">{d.env2}</code></td>
                        <td className="p-3 text-center">
                          {d.status === 'same' && <Check className="w-4 h-4 text-green-400 mx-auto" />}
                          {d.status === 'different' && <AlertTriangle className="w-4 h-4 text-yellow-400 mx-auto" />}
                          {(d.status === 'only_env1' || d.status === 'only_env2') && <X className="w-4 h-4 text-red-400 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* History View */}
          {activeView === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
                {historyData.map(entry => (
                  <motion.div key={entry.id} variants={itemVariants} className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${entry.action === 'created' ? 'bg-green-500/20' : entry.action === 'deleted' ? 'bg-red-500/20' : entry.action === 'rotated' ? 'bg-blue-500/20' : 'bg-yellow-500/20'}`}>
                          {entry.action === 'created' ? <Plus className="w-4 h-4 text-green-400" /> : entry.action === 'deleted' ? <Trash2 className="w-4 h-4 text-red-400" /> : entry.action === 'rotated' ? <RefreshCw className="w-4 h-4 text-blue-400" /> : <Edit className="w-4 h-4 text-yellow-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${entry.action === 'created' ? 'bg-green-500/20 text-green-400' : entry.action === 'deleted' ? 'bg-red-500/20 text-red-400' : entry.action === 'rotated' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{entry.action}</span>
                            <code className="font-mono text-sm text-white">{entry.key}</code>
                          </div>
                          {entry.old_value && entry.new_value && (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <code className="text-red-400 line-through">{entry.old_value}</code>
                              <ArrowRight className="w-3 h-3 text-gray-500" />
                              <code className="text-green-400">{entry.new_value}</code>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>{entry.user}</p>
                        <p>{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
