import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Search, Trash2, RefreshCw, Copy, Eye, EyeOff, Plus,
  Settings, Clock, Activity, TrendingUp, AlertTriangle, Check,
  Loader, BarChart3, Zap, Server, Hash, Key, Filter, Download
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface CacheEntry {
  key: string; value: string; type: string; ttl: number; size: number;
  hits: number; lastAccessed: string; namespace: string;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function CacheManager() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'keys' | 'stats' | 'config' | 'clusters'>('keys');
  const [search, setSearch] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(false);
  const [entries, setEntries] = useState<CacheEntry[]>([]);

  const hitRateData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`, hitRate: 85 + Math.random() * 12, misses: Math.floor(Math.random() * 200),
    evictions: Math.floor(Math.random() * 50),
  })), []);

  const memoryData = useMemo(() => [
    { name: 'sessions', value: 35 }, { name: 'api_cache', value: 25 },
    { name: 'model_cache', value: 20 }, { name: 'user_prefs', value: 12 },
    { name: 'tmp_data', value: 8 },
  ], []);

  const keySizeData = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    range: `${i * 100}-${(i + 1) * 100}B`, count: Math.floor(Math.random() * 500 + 50),
  })), []);

  useEffect(() => {
    setTimeout(() => {
      setEntries([
        { key: 'session:usr_abc123', value: '{"user_id":"abc123","role":"admin","theme":"dark"}', type: 'hash', ttl: 3600, size: 256, hits: 1450, lastAccessed: '2s ago', namespace: 'sessions' },
        { key: 'session:usr_def456', value: '{"user_id":"def456","role":"user","theme":"light"}', type: 'hash', ttl: 3600, size: 240, hits: 890, lastAccessed: '15s ago', namespace: 'sessions' },
        { key: 'cache:agents:list', value: '[{"id":"a1","name":"orchestrator","status":"active"}...]', type: 'string', ttl: 300, size: 4096, hits: 8920, lastAccessed: '1s ago', namespace: 'api_cache' },
        { key: 'cache:tasks:pending', value: '{"count":42,"last_updated":"2024-01-15T10:30:00Z"}', type: 'string', ttl: 60, size: 128, hits: 15200, lastAccessed: '0s ago', namespace: 'api_cache' },
        { key: 'model:embeddings:v2', value: '<binary tensor data, 45MB>', type: 'binary', ttl: -1, size: 47185920, hits: 320, lastAccessed: '5min ago', namespace: 'model_cache' },
        { key: 'model:tokenizer:v2', value: '<binary vocab data, 2MB>', type: 'binary', ttl: -1, size: 2097152, hits: 320, lastAccessed: '5min ago', namespace: 'model_cache' },
        { key: 'pref:usr_abc123', value: '{"notifications":true,"ai_model":"gpt-4","lang":"en"}', type: 'hash', ttl: 86400, size: 192, hits: 2340, lastAccessed: '30s ago', namespace: 'user_prefs' },
        { key: 'rate:api_gw:10.0.0.1', value: '{"requests":42,"window_start":"2024-01-15T10:30:00Z"}', type: 'string', ttl: 60, size: 96, hits: 42, lastAccessed: '1s ago', namespace: 'tmp_data' },
        { key: 'lock:deployment:prod', value: '{"locked_by":"deploy-01","expires":"2024-01-15T10:35:00Z"}', type: 'string', ttl: 300, size: 128, hits: 5, lastAccessed: '2min ago', namespace: 'tmp_data' },
        { key: 'queue:notifications:pending', value: '15', type: 'string', ttl: -1, size: 2, hits: 890, lastAccessed: '3s ago', namespace: 'tmp_data' },
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const namespaces = useMemo(() => {
    const ns: Record<string, number> = {};
    entries.forEach(e => { ns[e.namespace] = (ns[e.namespace] || 0) + 1; });
    return Object.entries(ns).map(([name, count]) => ({ name, count }));
  }, [entries]);

  const filteredEntries = entries.filter(e => {
    if (selectedNamespace && e.namespace !== selectedNamespace) return false;
    if (search && !e.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const totalMemory = entries.reduce((sum, e) => sum + e.size, 0);
  const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
  const avgHitRate = 92.4;

  const clusters = [
    { name: 'redis-primary', role: 'master', host: '10.0.1.10:6379', memory: '2.1 GB / 8 GB', keys: 15420, connections: 128, status: 'healthy' },
    { name: 'redis-replica-1', role: 'replica', host: '10.0.1.11:6379', memory: '2.1 GB / 8 GB', keys: 15420, connections: 64, status: 'healthy' },
    { name: 'redis-replica-2', role: 'replica', host: '10.0.1.12:6379', memory: '2.0 GB / 8 GB', keys: 15380, connections: 64, status: 'healthy' },
    { name: 'redis-sentinel', role: 'sentinel', host: '10.0.1.20:26379', memory: '64 MB / 1 GB', keys: 0, connections: 6, status: 'healthy' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-rose-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-rose-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-rose-500/20 rounded-xl">
              <Database className="w-7 h-7 text-rose-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">Cache Manager</h1>
              <p className="text-gray-400 text-sm">Redis cache monitoring & key management</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['keys', 'stats', 'config', 'clusters'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === v ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Keys', value: entries.length.toLocaleString(), icon: <Key className="w-4 h-4 text-rose-400" /> },
            { label: 'Memory Used', value: formatSize(totalMemory), icon: <Database className="w-4 h-4 text-blue-400" /> },
            { label: 'Total Hits', value: totalHits.toLocaleString(), icon: <Zap className="w-4 h-4 text-amber-400" /> },
            { label: 'Hit Rate', value: `${avgHitRate}%`, icon: <TrendingUp className="w-4 h-4 text-green-400" /> },
            { label: 'Namespaces', value: namespaces.length.toString(), icon: <Hash className="w-4 h-4 text-purple-400" /> },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-3 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center gap-3">
              {s.icon}
              <div>
                <span className="text-base font-bold text-white">{s.value}</span>
                <span className="block text-[10px] text-gray-500">{s.label}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {view === 'keys' && (
            <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
              {/* Namespace Sidebar */}
              <div className="w-44 bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 shrink-0 space-y-2">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Namespaces</h4>
                <button onClick={() => setSelectedNamespace(null)} className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg ${!selectedNamespace ? 'bg-rose-500/20 text-rose-300' : 'text-gray-500 hover:text-gray-300'}`}>
                  All ({entries.length})
                </button>
                {namespaces.map(ns => (
                  <button key={ns.name} onClick={() => setSelectedNamespace(ns.name === selectedNamespace ? null : ns.name)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex justify-between ${selectedNamespace === ns.name ? 'bg-rose-500/20 text-rose-300' : 'text-gray-500 hover:text-gray-300'}`}>
                    <span>{ns.name}</span><span className="opacity-60">{ns.count}</span>
                  </button>
                ))}
                <hr className="border-gray-700/50" />
                <button className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/20 text-red-400 text-xs rounded-lg hover:bg-red-600/30 transition-colors">
                  <Trash2 className="w-3 h-3" /> Flush All
                </button>
              </div>

              {/* Keys Table */}
              <div className="flex-1 bg-gray-800/20 border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search keys..."
                      className="w-full pl-8 pr-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none" />
                  </div>
                  <button onClick={() => setShowValues(!showValues)} className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-700/30 rounded-lg">
                    {showValues ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showValues ? 'Hide' : 'Show'} Values
                  </button>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead><tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-700/30 sticky top-0 bg-gray-900/80 backdrop-blur">
                      <th className="text-left p-3">Key</th><th className="text-left p-3">Type</th><th className="text-right p-3">Size</th>
                      <th className="text-right p-3">TTL</th><th className="text-right p-3">Hits</th><th className="text-right p-3">Last Access</th><th className="text-center p-3">Actions</th>
                    </tr></thead>
                    <tbody>
                      {filteredEntries.map(entry => (
                        <tr key={entry.key} className="border-b border-gray-700/15 hover:bg-gray-800/40 text-xs group">
                          <td className="p-3">
                            <code className="text-rose-400 font-mono text-[11px]">{entry.key}</code>
                            {showValues && <div className="mt-1 text-[10px] text-gray-500 font-mono truncate max-w-xs">{entry.value}</div>}
                          </td>
                          <td className="p-3"><span className="px-1.5 py-0.5 bg-gray-700/50 text-gray-400 rounded text-[10px] font-mono">{entry.type}</span></td>
                          <td className="p-3 text-right text-gray-400">{formatSize(entry.size)}</td>
                          <td className="p-3 text-right"><span className={entry.ttl === -1 ? 'text-gray-600' : entry.ttl < 60 ? 'text-amber-400' : 'text-gray-400'}>{entry.ttl === -1 ? '∞' : `${entry.ttl}s`}</span></td>
                          <td className="p-3 text-right text-gray-400">{entry.hits.toLocaleString()}</td>
                          <td className="p-3 text-right text-gray-500">{entry.lastAccessed}</td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => navigator.clipboard.writeText(entry.value)} className="p-1 text-gray-500 hover:text-blue-400"><Copy className="w-3 h-3" /></button>
                              <button className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'stats' && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" /> Hit Rate (24h)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={hitRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={6} />
                    <YAxis domain={[80, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Area type="monotone" dataKey="hitRate" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Evictions & Misses</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hitRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={6} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Bar dataKey="misses" fill="#f59e0b" radius={[2, 2, 0, 0]} name="Misses" />
                    <Bar dataKey="evictions" fill="#ef4444" radius={[2, 2, 0, 0]} name="Evictions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-rose-400" /> Memory by Namespace</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={memoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {memoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Hash className="w-4 h-4 text-blue-400" /> Key Size Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={keySizeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="range" tick={{ fill: '#9ca3af', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {view === 'config' && (
            <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {[
                  { label: 'Max Memory', value: '8 GB', desc: 'Maximum allocated memory for Redis' },
                  { label: 'Eviction Policy', value: 'allkeys-lru', desc: 'Remove least recently used keys when memory limit is reached' },
                  { label: 'Persistence', value: 'RDB + AOF', desc: 'Snapshot every 900s if 1+ keys changed, append-only file enabled' },
                  { label: 'Max Connections', value: '10000', desc: 'Maximum concurrent client connections' },
                  { label: 'Timeout', value: '300s', desc: 'Close idle connections after 300 seconds' },
                  { label: 'Replication', value: '2 replicas', desc: 'Asynchronous replication to 2 replica nodes' },
                  { label: 'TLS', value: 'Enabled', desc: 'TLS 1.3 encryption for all connections' },
                  { label: 'Cluster Mode', value: 'Sentinel', desc: 'Automatic failover via Redis Sentinel' },
                ].map((cfg, i) => (
                  <motion.div key={cfg.label} variants={itemVariants}
                    className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm text-white font-medium">{cfg.label}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{cfg.desc}</p>
                    </div>
                    <span className="px-3 py-1.5 bg-gray-700/50 text-gray-300 text-xs font-mono rounded-lg">{cfg.value}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {view === 'clusters' && (
            <motion.div key="clusters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {clusters.map(node => (
                  <motion.div key={node.name} variants={itemVariants}
                    className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center gap-4">
                    <div className="p-2.5 bg-rose-500/15 rounded-lg"><Server className="w-5 h-5 text-rose-400" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm text-white font-medium">{node.name}</h4>
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${node.role === 'master' ? 'bg-amber-500/20 text-amber-400' : node.role === 'replica' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>{node.role}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{node.host}</span>
                    </div>
                    <div className="flex items-center gap-6 text-xs text-gray-400">
                      <div className="text-center"><span className="block text-white font-medium">{node.memory}</span><span className="text-gray-600">Memory</span></div>
                      <div className="text-center"><span className="block text-white font-medium">{node.keys.toLocaleString()}</span><span className="text-gray-600">Keys</span></div>
                      <div className="text-center"><span className="block text-white font-medium">{node.connections}</span><span className="text-gray-600">Conns</span></div>
                    </div>
                    <Check className="w-4 h-4 text-green-400" />
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
