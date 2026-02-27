import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Search, Filter, Shield, User, Clock,
  AlertTriangle, CheckCircle, Info, XCircle, Eye,
  Download, RefreshCw, ChevronRight, Globe, Bot,
  Zap, Database, Settings, Lock, Unlock, Key,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  user: string;
  ipAddress: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  details: string;
  success: boolean;
  metadata: Record<string, string>;
}

const severityConfig = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  critical: { icon: Shield, color: 'text-red-500', bg: 'bg-red-600/10' },
};

const sampleAuditLog: AuditEntry[] = [
  { id: '1', timestamp: '2024-03-20 14:55:12', action: 'login', resource: 'auth/session', user: 'admin', ipAddress: '192.168.1.100', severity: 'info', category: 'Authentication', details: 'Successful login via password', success: true, metadata: { browser: 'Chrome 122', os: 'Windows 11' } },
  { id: '2', timestamp: '2024-03-20 14:52:08', action: 'update_config', resource: 'system/config', user: 'admin', ipAddress: '192.168.1.100', severity: 'warning', category: 'Configuration', details: 'Modified MQTT broker settings', success: true, metadata: { field: 'mqtt.broker_url', old: 'localhost:1883', new: '192.168.1.50:1883' } },
  { id: '3', timestamp: '2024-03-20 14:48:33', action: 'failed_login', resource: 'auth/session', user: 'unknown', ipAddress: '10.0.0.15', severity: 'error', category: 'Authentication', details: 'Failed login attempt - invalid credentials', success: false, metadata: { attempts: '3', locked: 'false' } },
  { id: '4', timestamp: '2024-03-20 14:45:00', action: 'agent_query', resource: 'agents/orchestrator', user: 'admin', ipAddress: '192.168.1.100', severity: 'info', category: 'AI Agents', details: 'Processed agent query: "Check home security status"', success: true, metadata: { agent: 'security_agent', duration: '1.2s' } },
  { id: '5', timestamp: '2024-03-20 14:42:15', action: 'deploy', resource: 'deployments/nexus-api', user: 'admin', ipAddress: '192.168.1.100', severity: 'info', category: 'Deployment', details: 'Deployed nexus-api v2.1.0 to production', success: true, metadata: { version: '2.1.0', environment: 'production' } },
  { id: '6', timestamp: '2024-03-20 14:38:00', action: 'backup_create', resource: 'database/backup', user: 'system', ipAddress: 'localhost', severity: 'info', category: 'Database', details: 'Automated database backup completed', success: true, metadata: { size: '245 MB', duration: '3m 42s' } },
  { id: '7', timestamp: '2024-03-20 14:35:22', action: 'permission_change', resource: 'users/roles', user: 'admin', ipAddress: '192.168.1.100', severity: 'warning', category: 'Access Control', details: 'Modified role permissions for "operator" role', success: true, metadata: { role: 'operator', added: 'deploy:read', removed: 'deploy:write' } },
  { id: '8', timestamp: '2024-03-20 14:30:05', action: 'api_rate_limit', resource: 'api/gateway', user: 'api-user-3', ipAddress: '203.0.113.42', severity: 'warning', category: 'API', details: 'Rate limit exceeded - 429 responses sent', success: false, metadata: { limit: '100/min', actual: '156/min' } },
  { id: '9', timestamp: '2024-03-20 14:25:18', action: 'intrusion_detected', resource: 'security/ids', user: 'system', ipAddress: '198.51.100.14', severity: 'critical', category: 'Security', details: 'Potential port scan detected from external IP', success: false, metadata: { ports_scanned: '22,80,443,8000,8080', blocked: 'true' } },
  { id: '10', timestamp: '2024-03-20 14:20:00', action: 'model_retrain', resource: 'ml/models', user: 'system', ipAddress: 'localhost', severity: 'info', category: 'AI/ML', details: 'Initiated retraining for nexus-nlp-v3', success: true, metadata: { model: 'nexus-nlp-v3', epoch: '1/20' } },
  { id: '11', timestamp: '2024-03-20 14:15:30', action: 'automation_trigger', resource: 'automations/scene-3', user: 'system', ipAddress: 'localhost', severity: 'info', category: 'Automation', details: 'Triggered "Evening Mode" automation', success: true, metadata: { trigger: 'time-based', devices: '5' } },
  { id: '12', timestamp: '2024-03-20 14:10:44', action: 'data_export', resource: 'reports/export', user: 'admin', ipAddress: '192.168.1.100', severity: 'info', category: 'Data', details: 'Exported health analytics report as PDF', success: true, metadata: { format: 'PDF', size: '2.1 MB' } },
  { id: '13', timestamp: '2024-03-20 14:05:12', action: 'ssl_cert_expiring', resource: 'security/certificates', user: 'system', ipAddress: 'localhost', severity: 'warning', category: 'Security', details: 'SSL certificate expires in 15 days', success: true, metadata: { domain: 'nexus.local', expiry: '2024-04-04' } },
  { id: '14', timestamp: '2024-03-20 14:00:00', action: 'health_check', resource: 'system/health', user: 'system', ipAddress: 'localhost', severity: 'info', category: 'Monitoring', details: 'All services healthy - 12/12 passing', success: true, metadata: { services: '12', uptime: '99.97%' } },
  { id: '15', timestamp: '2024-03-20 13:55:38', action: 'token_revoke', resource: 'auth/tokens', user: 'admin', ipAddress: '192.168.1.100', severity: 'warning', category: 'Authentication', details: 'Revoked API token for decommissioned device', success: true, metadata: { token_id: 'tok_abc123', device: 'ESP32-old' } },
];

const auditCategories = ['All', 'Authentication', 'Security', 'Configuration', 'AI Agents', 'Deployment', 'Database', 'API', 'Automation', 'AI/ML', 'Access Control', 'Data', 'Monitoring'];

const activityByHour = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  events: Math.floor(5 + Math.random() * 25),
  warnings: Math.floor(Math.random() * 5),
  errors: Math.floor(Math.random() * 3),
}));

const categoryDistribution = ['Authentication', 'Security', 'Automation', 'AI Agents', 'Deployment', 'API'].map(cat => ({
  name: cat,
  count: Math.floor(10 + Math.random() * 40),
}));

export default function AuditLog() {
  const [entries] = useState(sampleAuditLog);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const filtered = useMemo(() => {
    let items = entries;
    if (severityFilter !== 'All') items = items.filter(e => e.severity === severityFilter.toLowerCase());
    if (categoryFilter !== 'All') items = items.filter(e => e.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(e => e.action.includes(q) || e.details.toLowerCase().includes(q) || e.user.includes(q) || e.resource.includes(q));
    }
    return items;
  }, [entries, search, severityFilter, categoryFilter]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-nexus-bg p-6"
    >
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <ClipboardList className="text-nexus-primary" /> Audit Log
          </h1>
          <p className="text-nexus-muted mt-1">{entries.length} entries · Real-time activity tracking</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"><Download size={16} /> Export</button>
          <button className="flex items-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Events', value: entries.length, icon: ClipboardList, color: 'text-blue-400' },
          { label: 'Warnings', value: entries.filter(e => e.severity === 'warning').length, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Errors', value: entries.filter(e => e.severity === 'error').length, icon: XCircle, color: 'text-red-400' },
          { label: 'Critical', value: entries.filter(e => e.severity === 'critical').length, icon: Shield, color: 'text-red-500' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl border border-nexus-border/30 p-4">
            <div className="flex items-center gap-3">
              <stat.icon size={18} className={stat.color} />
              <div>
                <p className="text-2xl font-bold text-nexus-text">{stat.value}</p>
                <p className="text-xs text-nexus-muted">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">Activity Timeline</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={activityByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="events" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
              <Area type="monotone" dataKey="warnings" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} />
              <Area type="monotone" dataKey="errors" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">By Category</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categoryDistribution} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={100} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, users, resources..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <div className="flex gap-1">
          {['All', 'Info', 'Warning', 'Error', 'Critical'].map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${severityFilter === s ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{s}</button>
          ))}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text">
          {auditCategories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Log Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Log Entries */}
        <div className={`space-y-2 ${selectedEntry ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          {filtered.map((entry, i) => {
            const sc = severityConfig[entry.severity];
            const SevIcon = sc.icon;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedEntry(entry)}
                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-nexus-surface/50 ${selectedEntry?.id === entry.id ? 'bg-nexus-primary/5 border border-nexus-primary/30' : ''}`}
              >
                <SevIcon size={16} className={sc.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-nexus-text">{entry.action}</span>
                    <span className="text-[10px] text-nexus-muted font-mono">{entry.resource}</span>
                  </div>
                  <p className="text-xs text-nexus-muted truncate">{entry.details}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-nexus-muted">{entry.timestamp.split(' ')[1]}</p>
                  <p className="text-[10px] text-nexus-muted">{entry.user}</p>
                </div>
                {!entry.success && <XCircle size={12} className="text-red-400 shrink-0" />}
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedEntry && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass rounded-2xl border border-nexus-border/30 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-nexus-text">Event Details</h3>
                <button onClick={() => setSelectedEntry(null)} className="p-1 hover:text-nexus-primary">✕</button>
              </div>

              <div className="space-y-4">
                {[
                  ['Action', selectedEntry.action],
                  ['Resource', selectedEntry.resource],
                  ['User', selectedEntry.user],
                  ['IP Address', selectedEntry.ipAddress],
                  ['Timestamp', selectedEntry.timestamp],
                  ['Category', selectedEntry.category],
                  ['Severity', selectedEntry.severity],
                  ['Success', selectedEntry.success ? 'Yes' : 'No'],
                ].map(([key, val]) => (
                  <div key={key as string} className="flex justify-between py-1 border-b border-nexus-border/20">
                    <span className="text-xs text-nexus-muted">{key}</span>
                    <span className={`text-xs font-mono ${key === 'Success' ? (val === 'Yes' ? 'text-green-400' : 'text-red-400') : 'text-nexus-text'}`}>{val as string}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-nexus-text mb-2">Details</h4>
                <p className="text-sm text-nexus-muted bg-nexus-surface rounded-xl p-3">{selectedEntry.details}</p>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-nexus-text mb-2">Metadata</h4>
                <div className="bg-nexus-surface rounded-xl p-3 space-y-1">
                  {Object.entries(selectedEntry.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-nexus-muted">{k}</span>
                      <span className="text-nexus-text font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
