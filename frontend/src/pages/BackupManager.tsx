import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive, Search, Plus, Play, Pause, Clock,
  CheckCircle, XCircle, HardDrive, Download, Upload,
  RefreshCw, Calendar, Database, Trash2, Eye,
  AlertTriangle, Shield, X, FolderArchive, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

interface Backup {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential' | 'snapshot';
  status: 'completed' | 'in-progress' | 'failed' | 'scheduled' | 'cancelled';
  size: number;
  duration: number;
  createdAt: string;
  retention: string;
  target: string;
  compressed: boolean;
  encrypted: boolean;
  checksumValid: boolean;
  itemCount: number;
}

const typeConfig = {
  full: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  incremental: { color: 'text-green-400', bg: 'bg-green-500/10' },
  differential: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  snapshot: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

const statusConfig = {
  completed: { color: 'text-green-400', bg: 'bg-green-500/10', icon: <CheckCircle size={12} /> },
  'in-progress': { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: <RefreshCw size={12} className="animate-spin" /> },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', icon: <XCircle size={12} /> },
  scheduled: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: <Clock size={12} /> },
  cancelled: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: <XCircle size={12} /> },
};

const formatSize = (bytes: number) => {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(1)} KB`;
};

const formatDuration = (seconds: number) => {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const sampleBackups: Backup[] = [
  { id: '1', name: 'Daily Full Backup', type: 'full', status: 'completed', size: 4.2e9, duration: 1845, createdAt: '2024-03-20 02:00', retention: '30 days', target: 'Local NAS + S3', compressed: true, encrypted: true, checksumValid: true, itemCount: 12450 },
  { id: '2', name: 'Hourly Incremental', type: 'incremental', status: 'completed', size: 125e6, duration: 45, createdAt: '2024-03-20 13:00', retention: '7 days', target: 'Local NAS', compressed: true, encrypted: false, checksumValid: true, itemCount: 342 },
  { id: '3', name: 'Database Snapshot', type: 'snapshot', status: 'in-progress', size: 890e6, duration: 0, createdAt: '2024-03-20 14:00', retention: '14 days', target: 'PostgreSQL', compressed: false, encrypted: true, checksumValid: true, itemCount: 0 },
  { id: '4', name: 'Weekly Differential', type: 'differential', status: 'completed', size: 1.8e9, duration: 720, createdAt: '2024-03-17 03:00', retention: '60 days', target: 'S3 Glacier', compressed: true, encrypted: true, checksumValid: true, itemCount: 5670 },
  { id: '5', name: 'Configuration Backup', type: 'full', status: 'completed', size: 15e6, duration: 8, createdAt: '2024-03-20 12:00', retention: '90 days', target: 'Git Repository', compressed: false, encrypted: false, checksumValid: true, itemCount: 89 },
  { id: '6', name: 'Media Files Backup', type: 'full', status: 'failed', size: 0, duration: 3600, createdAt: '2024-03-19 02:00', retention: '30 days', target: 'S3', compressed: true, encrypted: true, checksumValid: false, itemCount: 0 },
  { id: '7', name: 'ML Models Archive', type: 'full', status: 'completed', size: 8.5e9, duration: 2400, createdAt: '2024-03-18 04:00', retention: '180 days', target: 'S3 Deep Archive', compressed: true, encrypted: true, checksumValid: true, itemCount: 45 },
  { id: '8', name: 'Next Scheduled Backup', type: 'incremental', status: 'scheduled', size: 0, duration: 0, createdAt: '2024-03-20 14:00', retention: '7 days', target: 'Local NAS', compressed: true, encrypted: false, checksumValid: true, itemCount: 0 },
];

const sizeHistory = [
  { date: 'Mon', full: 4.2, incremental: 0.8, differential: 0 },
  { date: 'Tue', full: 0, incremental: 0.9, differential: 0 },
  { date: 'Wed', full: 0, incremental: 0.7, differential: 0 },
  { date: 'Thu', full: 0, incremental: 1.1, differential: 1.8 },
  { date: 'Fri', full: 0, incremental: 0.6, differential: 0 },
  { date: 'Sat', full: 4.3, incremental: 0.4, differential: 0 },
  { date: 'Sun', full: 0, incremental: 0.5, differential: 0 },
];

const storageUsage = [
  { name: 'Local NAS', used: 45.2, total: 100 },
  { name: 'AWS S3', used: 28.7, total: 50 },
  { name: 'S3 Glacier', used: 120.5, total: 500 },
];

export default function BackupManager() {
  const [backups] = useState(sampleBackups);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = useMemo(() => {
    let f = backups;
    if (typeFilter !== 'All') f = f.filter(b => b.type === typeFilter);
    if (statusFilter !== 'All') f = f.filter(b => b.status === statusFilter);
    if (searchQuery) f = f.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return f;
  }, [backups, typeFilter, statusFilter, searchQuery]);

  const totalSize = backups.filter(b => b.status === 'completed').reduce((s, b) => s + b.size, 0);
  const successRate = Math.round((backups.filter(b => b.status === 'completed').length / backups.filter(b => b.status !== 'scheduled').length) * 100);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Archive className="text-nexus-primary" /> Backup Manager</h1>
          <p className="text-sm text-nexus-muted mt-1">{backups.length} backups · {formatSize(totalSize)} total · {successRate}% success</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-xs rounded-xl bg-nexus-primary text-white flex items-center gap-2"><Play size={14} /> Run Backup</button>
          <button className="px-4 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-muted flex items-center gap-2"><Calendar size={14} /> Schedule</button>
        </div>
      </div>

      {/* Storage Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {storageUsage.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl border border-nexus-border/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-nexus-text">{s.name}</span>
              <span className="text-[10px] text-nexus-muted">{s.used.toFixed(1)} / {s.total} GB</span>
            </div>
            <div className="h-2 bg-nexus-surface rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(s.used / s.total) * 100}%` }} transition={{ duration: 1 }} className="h-full rounded-full" style={{ backgroundColor: s.used / s.total > 0.8 ? '#EF4444' : s.used / s.total > 0.6 ? '#F59E0B' : '#10B981' }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Backup Size Chart */}
      <div className="glass rounded-2xl border border-nexus-border/30 p-6 mb-6">
        <h3 className="text-sm font-semibold text-nexus-text mb-4">Backup Size History (GB)</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sizeHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
            <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
            <Bar dataKey="full" fill="#6366F1" radius={[4, 4, 0, 0]} name="Full" stackId="a" />
            <Bar dataKey="incremental" fill="#10B981" radius={[4, 4, 0, 0]} name="Incremental" stackId="a" />
            <Bar dataKey="differential" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Differential" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search backups..." className="w-full pl-9 pr-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-sm text-nexus-text" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          <option value="All">All Types</option>
          {Object.keys(typeConfig).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          <option value="All">All Status</option>
          {Object.keys(statusConfig).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Backup List */}
      <div className="space-y-2">
        {filtered.map((b, i) => {
          const tc = typeConfig[b.type];
          const sc = statusConfig[b.status];
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedBackup(selectedBackup?.id === b.id ? null : b)}
              className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${selectedBackup?.id === b.id ? 'bg-nexus-surface border border-nexus-primary/30' : 'hover:bg-nexus-surface/30'}`}
            >
              <div className={`p-2 rounded-xl ${tc.bg}`}><FolderArchive size={18} className={tc.color} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-nexus-text">{b.name}</p>
                <div className="flex items-center gap-3 text-[10px] text-nexus-muted mt-0.5">
                  <span>{b.createdAt}</span>
                  <span>·</span>
                  <span className={tc.color}>{b.type}</span>
                  <span>·</span>
                  <span>{b.target}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {b.size > 0 && <span className="text-xs text-nexus-text">{formatSize(b.size)}</span>}
                {b.duration > 0 && <span className="text-xs text-nexus-muted">{formatDuration(b.duration)}</span>}
                <div className="flex items-center gap-1">
                  {b.compressed && <Archive size={10} className="text-nexus-muted" title="Compressed" />}
                  {b.encrypted && <Shield size={10} className="text-green-400" title="Encrypted" />}
                </div>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${sc.bg} ${sc.color}`}>{sc.icon} {b.status}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedBackup && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 right-6 w-96 glass rounded-2xl border border-nexus-border/30 p-6 shadow-2xl z-50">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-nexus-text">{selectedBackup.name}</h3>
              <button onClick={() => setSelectedBackup(null)} className="p-1 rounded-lg hover:bg-nexus-surface"><X size={14} className="text-nexus-muted" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Type', value: selectedBackup.type },
                { label: 'Size', value: formatSize(selectedBackup.size) },
                { label: 'Duration', value: formatDuration(selectedBackup.duration) },
                { label: 'Items', value: selectedBackup.itemCount.toLocaleString() },
                { label: 'Retention', value: selectedBackup.retention },
                { label: 'Target', value: selectedBackup.target },
              ].map(d => (
                <div key={d.label} className="bg-nexus-surface/50 rounded-lg p-2">
                  <p className="text-[10px] text-nexus-muted">{d.label}</p>
                  <p className="text-xs font-medium text-nexus-text">{d.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mb-4 text-[10px]">
              <span className={selectedBackup.compressed ? 'text-green-400' : 'text-nexus-muted'}>{selectedBackup.compressed ? '✓' : '✗'} Compressed</span>
              <span className={selectedBackup.encrypted ? 'text-green-400' : 'text-nexus-muted'}>{selectedBackup.encrypted ? '✓' : '✗'} Encrypted</span>
              <span className={selectedBackup.checksumValid ? 'text-green-400' : 'text-red-400'}>{selectedBackup.checksumValid ? '✓' : '✗'} Checksum</span>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-text"><Download size={12} className="inline mr-1" /> Restore</button>
              <button className="flex-1 px-3 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-text"><Eye size={12} className="inline mr-1" /> Browse</button>
              <button className="px-3 py-2 text-xs rounded-xl bg-red-500/10 text-red-400"><Trash2 size={12} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
