import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Play, Pause, Trash2, Plus, Search, Edit3,
  AlertCircle, CheckCircle, XCircle, Timer, RefreshCw,
  Calendar, Filter, Copy, MoreVertical, Zap, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  scheduleHuman: string;
  command: string;
  description: string;
  status: 'active' | 'paused' | 'error' | 'running';
  lastRun: string;
  nextRun: string;
  duration: string;
  successCount: number;
  failureCount: number;
  category: string;
  history: { date: string; status: string; duration: number }[];
}

const sampleJobs: CronJob[] = [
  {
    id: '1', name: 'Database Backup', schedule: '0 2 * * *', scheduleHuman: 'Every day at 2:00 AM',
    command: 'python backup_db.py --full', description: 'Full database backup to S3',
    status: 'active', lastRun: '2024-03-20 02:00:15', nextRun: '2024-03-21 02:00:00',
    duration: '3m 42s', successCount: 87, failureCount: 2, category: 'Database',
    history: Array.from({ length: 14 }, (_, i) => ({ date: `Mar ${i + 7}`, status: Math.random() > 0.05 ? 'success' : 'failure', duration: 180 + Math.random() * 60 })),
  },
  {
    id: '2', name: 'ML Model Retraining', schedule: '0 4 * * 0', scheduleHuman: 'Every Sunday at 4:00 AM',
    command: 'python train.py --model nexus-v3', description: 'Weekly retraining of Nexus AI model',
    status: 'active', lastRun: '2024-03-17 04:00:00', nextRun: '2024-03-24 04:00:00',
    duration: '47m 18s', successCount: 12, failureCount: 1, category: 'AI/ML',
    history: Array.from({ length: 12 }, (_, i) => ({ date: `Week ${i + 1}`, status: Math.random() > 0.08 ? 'success' : 'failure', duration: 2400 + Math.random() * 600 })),
  },
  {
    id: '3', name: 'Health Check Sweep', schedule: '*/5 * * * *', scheduleHuman: 'Every 5 minutes',
    command: 'curl -s /api/health/all', description: 'Ping all services and record status',
    status: 'running', lastRun: '2024-03-20 14:55:00', nextRun: '2024-03-20 15:00:00',
    duration: '2s', successCount: 6240, failureCount: 18, category: 'Monitoring',
    history: Array.from({ length: 24 }, (_, i) => ({ date: `${i}:00`, status: Math.random() > 0.01 ? 'success' : 'failure', duration: 1 + Math.random() * 3 })),
  },
  {
    id: '4', name: 'Log Rotation', schedule: '0 0 * * *', scheduleHuman: 'Every day at midnight',
    command: 'logrotate /etc/logrotate.d/nexus', description: 'Rotate and compress log files',
    status: 'active', lastRun: '2024-03-20 00:00:05', nextRun: '2024-03-21 00:00:00',
    duration: '8s', successCount: 94, failureCount: 0, category: 'System',
    history: Array.from({ length: 14 }, (_, i) => ({ date: `Mar ${i + 7}`, status: 'success', duration: 5 + Math.random() * 8 })),
  },
  {
    id: '5', name: 'Email Digest', schedule: '0 8 * * 1-5', scheduleHuman: 'Weekdays at 8:00 AM',
    command: 'python send_digest.py --template daily', description: 'Send daily digest email to users',
    status: 'paused', lastRun: '2024-03-19 08:00:02', nextRun: 'Paused',
    duration: '12s', successCount: 65, failureCount: 3, category: 'Communication',
    history: Array.from({ length: 10 }, (_, i) => ({ date: `Day ${i + 1}`, status: Math.random() > 0.05 ? 'success' : 'failure', duration: 8 + Math.random() * 10 })),
  },
  {
    id: '6', name: 'Cache Cleanup', schedule: '0 3 * * *', scheduleHuman: 'Every day at 3:00 AM',
    command: 'python cache_manager.py --clean --ttl 86400', description: 'Clear expired cache entries',
    status: 'error', lastRun: '2024-03-20 03:00:01', nextRun: '2024-03-21 03:00:00',
    duration: 'Failed', successCount: 45, failureCount: 5, category: 'System',
    history: Array.from({ length: 14 }, (_, i) => ({ date: `Mar ${i + 7}`, status: i === 13 ? 'failure' : 'success', duration: 15 + Math.random() * 20 })),
  },
  {
    id: '7', name: 'Sensor Data Collection', schedule: '*/15 * * * *', scheduleHuman: 'Every 15 minutes',
    command: 'python collect_sensors.py --mqtt', description: 'Collect IoT sensor data via MQTT',
    status: 'active', lastRun: '2024-03-20 14:45:00', nextRun: '2024-03-20 15:00:00',
    duration: '4s', successCount: 2880, failureCount: 12, category: 'IoT',
    history: Array.from({ length: 24 }, (_, i) => ({ date: `${i}:00`, status: Math.random() > 0.02 ? 'success' : 'failure', duration: 2 + Math.random() * 5 })),
  },
  {
    id: '8', name: 'Security Scan', schedule: '0 1 * * *', scheduleHuman: 'Every day at 1:00 AM',
    command: 'python security_scan.py --deep', description: 'Deep security vulnerability scan',
    status: 'active', lastRun: '2024-03-20 01:00:08', nextRun: '2024-03-21 01:00:00',
    duration: '5m 22s', successCount: 56, failureCount: 1, category: 'Security',
    history: Array.from({ length: 14 }, (_, i) => ({ date: `Mar ${i + 7}`, status: 'success', duration: 280 + Math.random() * 60 })),
  },
];

const statusConfig = {
  active: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle, label: 'Active' },
  running: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity, label: 'Running' },
  paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Pause, label: 'Paused' },
  error: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'Error' },
};

const jobCategories = ['All', 'System', 'Database', 'AI/ML', 'Monitoring', 'Communication', 'IoT', 'Security'];

export default function CronJobManager() {
  const isDemo = useIsDemoAccount();
  const [jobs, setJobs] = useState(isDemo ? sampleJobs : []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);

  const filtered = useMemo(() => {
    let items = jobs;
    if (statusFilter !== 'All') items = items.filter(j => j.status === statusFilter.toLowerCase());
    if (categoryFilter !== 'All') items = items.filter(j => j.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(j => j.name.toLowerCase().includes(q) || j.command.toLowerCase().includes(q));
    }
    return items;
  }, [jobs, search, statusFilter, categoryFilter]);

  const toggleJob = (id: string) => {
    setJobs(prev => prev.map(j => {
      if (j.id !== id) return j;
      return { ...j, status: j.status === 'active' ? 'paused' : 'active' } as CronJob;
    }));
  };

  const executionChart = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      executions: jobs.reduce((sum, j) => sum + Math.floor(Math.random() * 5), 0),
      successes: jobs.reduce((sum, j) => sum + Math.floor(Math.random() * 4), 0),
    }));
  }, [jobs]);

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
            <Clock className="text-nexus-primary" /> Cron Job Manager
          </h1>
          <p className="text-nexus-muted mt-1">{jobs.length} scheduled jobs · {jobs.filter(j => j.status === 'active' || j.status === 'running').length} active</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 rounded-xl bg-nexus-primary px-4 py-2 text-white font-medium"
        >
          <Plus size={18} /> New Job
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Jobs', value: jobs.filter(j => j.status === 'active').length, color: 'text-green-400', icon: CheckCircle },
          { label: 'Running Now', value: jobs.filter(j => j.status === 'running').length, color: 'text-blue-400', icon: Activity },
          { label: 'Total Executions', value: jobs.reduce((s, j) => s + j.successCount + j.failureCount, 0).toLocaleString(), color: 'text-purple-400', icon: Zap },
          { label: 'Success Rate', value: `${((jobs.reduce((s, j) => s + j.successCount, 0) / Math.max(1, jobs.reduce((s, j) => s + j.successCount + j.failureCount, 0))) * 100).toFixed(1)}%`, color: 'text-emerald-400', icon: CheckCircle },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl border border-nexus-border/30 p-4"
          >
            <div className="flex items-center gap-3">
              <stat.icon size={20} className={stat.color} />
              <div>
                <p className="text-2xl font-bold text-nexus-text">{stat.value}</p>
                <p className="text-xs text-nexus-muted">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Execution Timeline Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl border border-nexus-border/30 p-6 mb-6"
      >
        <h3 className="font-semibold text-nexus-text mb-4">Today's Execution Timeline</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={executionChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
            <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
            <Area type="monotone" dataKey="executions" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
            <Area type="monotone" dataKey="successes" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text">
          <option>All</option>
          <option>Active</option>
          <option>Running</option>
          <option>Paused</option>
          <option>Error</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text">
          {jobCategories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Job Grid + Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job List */}
        <div className={`space-y-3 ${selectedJob ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          <AnimatePresence>
            {filtered.map((job, i) => {
              const sc = statusConfig[job.status];
              const StatusIcon = sc.icon;
              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedJob(job)}
                  className={`glass rounded-2xl border p-4 cursor-pointer transition-all hover:border-nexus-primary/30 ${selectedJob?.id === job.id ? 'border-nexus-primary/50 bg-nexus-primary/5' : 'border-nexus-border/30'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon size={14} className={sc.color} />
                        <h4 className="font-semibold text-nexus-text truncate">{job.name}</h4>
                      </div>
                      <p className="text-xs text-nexus-muted mb-2">{job.scheduleHuman}</p>
                      <code className="text-[10px] text-nexus-primary bg-nexus-primary/5 px-2 py-0.5 rounded font-mono">{job.schedule}</code>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); toggleJob(job.id); }} className="p-1.5 rounded-lg hover:bg-nexus-surface transition-colors">
                        {job.status === 'active' ? <Pause size={14} className="text-yellow-400" /> : <Play size={14} className="text-green-400" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-nexus-muted">
                    <span className="px-2 py-0.5 rounded-full bg-nexus-surface">{job.category}</span>
                    <span>✓{job.successCount} ✗{job.failureCount}</span>
                    <span className="ml-auto">{job.duration}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedJob && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-2 glass rounded-2xl border border-nexus-border/30 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-nexus-text">{selectedJob.name}</h3>
                <button onClick={() => setSelectedJob(null)} className="p-1 hover:text-nexus-primary">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-nexus-surface rounded-xl p-3">
                  <p className="text-xs text-nexus-muted">Schedule</p>
                  <p className="text-sm font-mono text-nexus-text">{selectedJob.schedule}</p>
                  <p className="text-xs text-nexus-muted">{selectedJob.scheduleHuman}</p>
                </div>
                <div className="bg-nexus-surface rounded-xl p-3">
                  <p className="text-xs text-nexus-muted">Command</p>
                  <p className="text-xs font-mono text-nexus-primary break-all">{selectedJob.command}</p>
                </div>
                <div className="bg-nexus-surface rounded-xl p-3">
                  <p className="text-xs text-nexus-muted">Last Run</p>
                  <p className="text-sm text-nexus-text">{selectedJob.lastRun}</p>
                </div>
                <div className="bg-nexus-surface rounded-xl p-3">
                  <p className="text-xs text-nexus-muted">Next Run</p>
                  <p className="text-sm text-nexus-text">{selectedJob.nextRun}</p>
                </div>
              </div>

              {/* Execution History Chart */}
              <h4 className="font-semibold text-nexus-text mb-3">Execution History</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={selectedJob.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                  <Bar dataKey="duration" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button className="flex items-center gap-2 rounded-xl bg-nexus-primary/10 px-4 py-2 text-sm text-nexus-primary hover:bg-nexus-primary/20"><Play size={14} /> Run Now</button>
                <button className="flex items-center gap-2 rounded-xl bg-nexus-surface px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"><Edit3 size={14} /> Edit</button>
                <button className="flex items-center gap-2 rounded-xl bg-nexus-surface px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"><Copy size={14} /> Clone</button>
                <button className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20"><Trash2 size={14} /> Delete</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
