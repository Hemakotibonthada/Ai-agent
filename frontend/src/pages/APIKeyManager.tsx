import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Search, Plus, Copy, Check, Eye, EyeOff,
  Trash2, Edit3, Shield, Clock, Activity, X,
  AlertTriangle, RefreshCw, MoreHorizontal, Lock,
  Globe, Zap, Database, Bot, Settings,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  fullKey: string;
  status: 'active' | 'expired' | 'revoked' | 'rate-limited';
  scopes: string[];
  createdAt: string;
  expiresAt: string;
  lastUsed: string;
  usageCount: number;
  rateLimit: number;
  createdBy: string;
  environment: 'production' | 'staging' | 'development';
  ipWhitelist: string[];
}

const statusConfig = {
  active: { color: 'text-green-400', bg: 'bg-green-500/10', dot: '#10B981' },
  expired: { color: 'text-nexus-muted', bg: 'bg-gray-500/10', dot: '#6B7280' },
  revoked: { color: 'text-red-400', bg: 'bg-red-500/10', dot: '#EF4444' },
  'rate-limited': { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: '#F59E0B' },
};

const envConfig = {
  production: { color: 'text-red-400', bg: 'bg-red-500/10' },
  staging: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  development: { color: 'text-green-400', bg: 'bg-green-500/10' },
};

const sampleKeys: ApiKey[] = [
  { id: '1', name: 'Production API Key', prefix: 'nxs_prod_', fullKey: 'nxs_prod_a1b2c3d4e5f6g7h8i9j0', status: 'active', scopes: ['read', 'write', 'admin'], createdAt: '2024-01-15', expiresAt: '2025-01-15', lastUsed: '2m ago', usageCount: 145200, rateLimit: 10000, createdBy: 'Alex Morgan', environment: 'production', ipWhitelist: ['10.0.0.1/24', '192.168.1.0/24'] },
  { id: '2', name: 'Staging Key', prefix: 'nxs_stg_', fullKey: 'nxs_stg_x9y8z7w6v5u4t3s2r1q0', status: 'active', scopes: ['read', 'write'], createdAt: '2024-02-01', expiresAt: '2024-08-01', lastUsed: '15m ago', usageCount: 23400, rateLimit: 5000, createdBy: 'Sarah Chen', environment: 'staging', ipWhitelist: [] },
  { id: '3', name: 'Mobile App Key', prefix: 'nxs_mob_', fullKey: 'nxs_mob_m1n2o3p4q5r6s7t8u9v0', status: 'active', scopes: ['read'], createdAt: '2024-02-10', expiresAt: '2025-02-10', lastUsed: '1h ago', usageCount: 89500, rateLimit: 20000, createdBy: 'David Kim', environment: 'production', ipWhitelist: [] },
  { id: '4', name: 'CI/CD Pipeline', prefix: 'nxs_ci_', fullKey: 'nxs_ci_c1d2e3f4g5h6i7j8k9l0', status: 'active', scopes: ['deploy', 'read'], createdAt: '2024-03-01', expiresAt: '2024-09-01', lastUsed: '5m ago', usageCount: 3400, rateLimit: 1000, createdBy: 'Alex Morgan', environment: 'production', ipWhitelist: ['10.0.0.50'] },
  { id: '5', name: 'ESP32 IoT Key', prefix: 'nxs_iot_', fullKey: 'nxs_iot_i1o2t3k4e5y6s7e8c9r0', status: 'rate-limited', scopes: ['read', 'write:sensors'], createdAt: '2024-02-20', expiresAt: '2025-02-20', lastUsed: '30s ago', usageCount: 500000, rateLimit: 100, createdBy: 'Maria Garcia', environment: 'production', ipWhitelist: ['192.168.1.100'] },
  { id: '6', name: 'Old Dev Key', prefix: 'nxs_dev_', fullKey: 'nxs_dev_o1l2d3k4e5y6d7e8v9x0', status: 'expired', scopes: ['read', 'write'], createdAt: '2023-06-15', expiresAt: '2024-01-15', lastUsed: '90d ago', usageCount: 12300, rateLimit: 5000, createdBy: 'James Wilson', environment: 'development', ipWhitelist: [] },
  { id: '7', name: 'Revoked Service Key', prefix: 'nxs_svc_', fullKey: 'nxs_svc_r1e2v3o4k5e6d7k8e9y0', status: 'revoked', scopes: ['admin'], createdAt: '2024-01-01', expiresAt: '2025-01-01', lastUsed: '30d ago', usageCount: 5600, rateLimit: 10000, createdBy: 'Robert Lee', environment: 'production', ipWhitelist: [] },
  { id: '8', name: 'Dev Testing Key', prefix: 'nxs_dev_', fullKey: 'nxs_dev_t1e2s3t4k5e6y7d8e9v0', status: 'active', scopes: ['read', 'write', 'delete'], createdAt: '2024-03-10', expiresAt: '2024-06-10', lastUsed: '1d ago', usageCount: 780, rateLimit: 2000, createdBy: 'Lisa Wang', environment: 'development', ipWhitelist: [] },
];

const usageHistory = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  requests: 3000 + Math.random() * 7000,
  errors: Math.random() * 200,
}));

export default function APIKeyManager() {
  const isDemo = useIsDemoAccount();
  const [keys] = useState(isDemo ? sampleKeys : []);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [envFilter, setEnvFilter] = useState('All');
  const [showKey, setShowKey] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let f = keys;
    if (envFilter !== 'All') f = f.filter(k => k.environment === envFilter);
    if (searchQuery) f = f.filter(k => k.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return f;
  }, [keys, envFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: keys.length,
    active: keys.filter(k => k.status === 'active').length,
    totalUsage: keys.reduce((s, k) => s + k.usageCount, 0),
    rateLimited: keys.filter(k => k.status === 'rate-limited').length,
  }), [keys]);

  const toggleShowKey = (id: string) => {
    const s = new Set(showKey);
    s.has(id) ? s.delete(id) : s.add(id);
    setShowKey(s);
  };

  const copyKey = (key: ApiKey) => {
    navigator.clipboard.writeText(key.fullKey);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Key className="text-nexus-primary" /> API Key Manager</h1>
          <p className="text-sm text-nexus-muted mt-1">{stats.total} keys · {stats.active} active · {stats.totalUsage.toLocaleString()} total requests</p>
        </div>
        <button className="px-4 py-2 text-xs rounded-xl bg-nexus-primary text-white flex items-center gap-2"><Plus size={14} /> Generate Key</button>
      </div>

      {/* Usage Chart */}
      <div className="glass rounded-2xl border border-nexus-border/30 p-6 mb-6">
        <h3 className="text-sm font-semibold text-nexus-text mb-4">API Usage (30 days)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={usageHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={4} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
            <Area type="monotone" dataKey="requests" stroke="#6366F1" fill="#6366F1" fillOpacity={0.1} name="Requests" />
            <Area type="monotone" dataKey="errors" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} name="Errors" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search keys..." className="w-full pl-9 pr-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-sm text-nexus-text" />
        </div>
        <select value={envFilter} onChange={e => setEnvFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          <option value="All">All Environments</option>
          {Object.keys(envConfig).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Key List */}
      <div className="space-y-2">
        {filtered.map((k, i) => {
          const sc = statusConfig[k.status];
          const ec = envConfig[k.environment];
          const isVisible = showKey.has(k.id);
          return (
            <motion.div
              key={k.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedKey(selectedKey?.id === k.id ? null : k)}
              className={`glass rounded-2xl border p-4 cursor-pointer transition-all ${selectedKey?.id === k.id ? 'border-nexus-primary/30' : 'border-nexus-border/30 hover:border-nexus-border/50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-nexus-primary/10"><Key size={18} className="text-nexus-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-nexus-text">{k.name}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-full ${ec.bg} ${ec.color}`}>{k.environment}</span>
                    <span className={`px-1.5 py-0.5 text-[9px] rounded-full flex items-center gap-1 ${sc.bg} ${sc.color}`}>{k.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-nexus-muted font-mono bg-nexus-surface px-2 py-0.5 rounded">
                      {isVisible ? k.fullKey : `${k.prefix}${'•'.repeat(16)}`}
                    </code>
                    <button onClick={e => { e.stopPropagation(); toggleShowKey(k.id); }} className="p-1 hover:bg-nexus-surface rounded">
                      {isVisible ? <EyeOff size={12} className="text-nexus-muted" /> : <Eye size={12} className="text-nexus-muted" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); copyKey(k); }} className="p-1 hover:bg-nexus-surface rounded">
                      {copiedId === k.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-nexus-muted" />}
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-nexus-text">{k.usageCount.toLocaleString()} requests</p>
                  <p className="text-[10px] text-nexus-muted">Last used {k.lastUsed}</p>
                </div>
              </div>

              <AnimatePresence>
                {selectedKey?.id === k.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 pt-4 border-t border-nexus-border/20 overflow-hidden">
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="bg-nexus-surface/50 rounded-lg p-2"><p className="text-[10px] text-nexus-muted">Created</p><p className="text-xs text-nexus-text">{k.createdAt}</p></div>
                      <div className="bg-nexus-surface/50 rounded-lg p-2"><p className="text-[10px] text-nexus-muted">Expires</p><p className="text-xs text-nexus-text">{k.expiresAt}</p></div>
                      <div className="bg-nexus-surface/50 rounded-lg p-2"><p className="text-[10px] text-nexus-muted">Rate Limit</p><p className="text-xs text-nexus-text">{k.rateLimit}/min</p></div>
                      <div className="bg-nexus-surface/50 rounded-lg p-2"><p className="text-[10px] text-nexus-muted">Created By</p><p className="text-xs text-nexus-text">{k.createdBy}</p></div>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-nexus-muted mb-1">Scopes</p>
                        <div className="flex gap-1 flex-wrap">
                          {k.scopes.map(s => <span key={s} className="px-2 py-0.5 text-[10px] bg-nexus-primary/10 text-nexus-primary rounded-full">{s}</span>)}
                        </div>
                      </div>
                      {k.ipWhitelist.length > 0 && (
                        <div className="ml-auto">
                          <p className="text-[10px] text-nexus-muted mb-1">IP Whitelist</p>
                          <div className="flex gap-1 flex-wrap">
                            {k.ipWhitelist.map(ip => <span key={ip} className="px-2 py-0.5 text-[10px] bg-green-500/10 text-green-400 rounded-full font-mono">{ip}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 text-xs rounded-lg bg-nexus-surface text-nexus-text flex items-center gap-1"><RefreshCw size={10} /> Rotate</button>
                      <button className="px-3 py-1.5 text-xs rounded-lg bg-nexus-surface text-nexus-text flex items-center gap-1"><Edit3 size={10} /> Edit</button>
                      <button className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 flex items-center gap-1"><Trash2 size={10} /> Revoke</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
