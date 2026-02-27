import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Send, RefreshCw, Play, Pause, Search, Plus, Trash2, Clock,
  Activity, AlertTriangle, Check, X, Loader, Server, Users, ArrowRight,
  ChevronRight, ChevronDown, Eye, RotateCcw, Zap, BarChart3, Database,
  MessageSquare, Filter, Hash, ArrowUp, ArrowDown, Settings
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface QueueItem { id: string; name: string; type: string; status: string; messages_ready: number; messages_unacked: number; messages_total: number; consumers: number; publish_rate: number; consume_rate: number; memory_mb: number; }
interface QueueMessage { id: string; queue: string; body: string; status: string; priority: number; attempts: number; created_at: string; }

const statusConfig: Record<string, { color: string; bg: string }> = {
  active: { color: 'text-green-400', bg: 'bg-green-500/20' },
  paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  idle: { color: 'text-nexus-muted', bg: 'bg-gray-500/20' },
  error: { color: 'text-red-400', bg: 'bg-red-500/20' },
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

export default function QueueMonitor() {
  const isDemo = useIsDemoAccount();
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [dlqMessages, setDlqMessages] = useState<QueueMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'queues' | 'dlq' | 'metrics'>('queues');
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQueues([
        { id: 'q1', name: 'task.process', type: 'standard', status: 'active', messages_ready: 142, messages_unacked: 23, messages_total: 165, consumers: 4, publish_rate: 45.2, consume_rate: 42.8, memory_mb: 12 },
        { id: 'q2', name: 'notification.send', type: 'standard', status: 'active', messages_ready: 56, messages_unacked: 8, messages_total: 64, consumers: 2, publish_rate: 23.1, consume_rate: 22.5, memory_mb: 4 },
        { id: 'q3', name: 'ai.inference', type: 'priority', status: 'active', messages_ready: 312, messages_unacked: 45, messages_total: 357, consumers: 8, publish_rate: 89.6, consume_rate: 78.3, memory_mb: 48 },
        { id: 'q4', name: 'email.outbound', type: 'standard', status: 'active', messages_ready: 23, messages_unacked: 5, messages_total: 28, consumers: 2, publish_rate: 8.4, consume_rate: 8.1, memory_mb: 2 },
        { id: 'q5', name: 'analytics.events', type: 'standard', status: 'active', messages_ready: 1834, messages_unacked: 156, messages_total: 1990, consumers: 6, publish_rate: 234.7, consume_rate: 215.2, memory_mb: 64 },
        { id: 'q6', name: 'webhook.delivery', type: 'standard', status: 'paused', messages_ready: 89, messages_unacked: 0, messages_total: 89, consumers: 0, publish_rate: 0, consume_rate: 0, memory_mb: 6 },
        { id: 'q7', name: 'task.dlq', type: 'dead_letter', status: 'active', messages_ready: 12, messages_unacked: 0, messages_total: 12, consumers: 1, publish_rate: 0.3, consume_rate: 0.1, memory_mb: 1 },
        { id: 'q8', name: 'scheduled.jobs', type: 'delayed', status: 'active', messages_ready: 67, messages_unacked: 3, messages_total: 70, consumers: 2, publish_rate: 5.2, consume_rate: 4.8, memory_mb: 4 },
        { id: 'q9', name: 'file.process', type: 'standard', status: 'idle', messages_ready: 0, messages_unacked: 0, messages_total: 0, consumers: 2, publish_rate: 0, consume_rate: 0, memory_mb: 0.5 },
      ]);
      setDlqMessages([
        { id: 'dlq1', queue: 'task.process', body: '{"task_id": "t-452", "type": "image_resize"}', status: 'failed', priority: 0, attempts: 3, created_at: '2025-01-15T08:12:00Z' },
        { id: 'dlq2', queue: 'notification.send', body: '{"user_id": "u-89", "type": "push"}', status: 'failed', priority: 0, attempts: 3, created_at: '2025-01-15T07:45:00Z' },
        { id: 'dlq3', queue: 'webhook.delivery', body: '{"url": "https://api.example.com/hook", "event": "order.created"}', status: 'failed', priority: 1, attempts: 5, created_at: '2025-01-15T06:30:00Z' },
        { id: 'dlq4', queue: 'email.outbound', body: '{"to": "user@example.com", "template": "welcome"}', status: 'failed', priority: 0, attempts: 3, created_at: '2025-01-15T05:15:00Z' },
        { id: 'dlq5', queue: 'ai.inference', body: '{"model": "gpt-4", "prompt": "..."}', status: 'failed', priority: 2, attempts: 3, created_at: '2025-01-14T23:45:00Z' },
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const totalMessages = useMemo(() => queues.reduce((s, q) => s + q.messages_total, 0), [queues]);
  const totalConsumers = useMemo(() => queues.reduce((s, q) => s + q.consumers, 0), [queues]);
  const totalPublishRate = useMemo(() => queues.reduce((s, q) => s + q.publish_rate, 0).toFixed(1), [queues]);
  const totalConsumeRate = useMemo(() => queues.reduce((s, q) => s + q.consume_rate, 0).toFixed(1), [queues]);

  const metricsData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    published: Math.floor(Math.random() * 5000 + 2000),
    consumed: Math.floor(Math.random() * 4800 + 2000),
    failed: Math.floor(Math.random() * 50),
  })), []);

  const queueBarData = useMemo(() => queues.filter(q => q.type !== 'dead_letter').map(q => ({
    name: q.name.length > 10 ? q.name.slice(0, 10) + '..' : q.name,
    ready: q.messages_ready,
    unacked: q.messages_unacked,
  })), [queues]);

  const filteredQueues = useMemo(() => queues.filter(q =>
    q.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [queues, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-emerald-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.1, rotate: 10 }} className="p-3 bg-emerald-500/20 rounded-xl"><Inbox className="w-7 h-7 text-emerald-400" /></motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Queue Monitor</h1>
              <p className="text-nexus-muted text-sm">Message queue monitoring & management</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> New Queue</motion.button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Messages', value: totalMessages.toLocaleString(), icon: <MessageSquare className="w-5 h-5" />, color: 'emerald' },
            { label: 'Consumers', value: totalConsumers.toString(), icon: <Users className="w-5 h-5" />, color: 'blue' },
            { label: 'Publish Rate', value: `${totalPublishRate}/s`, icon: <ArrowUp className="w-5 h-5" />, color: 'purple' },
            { label: 'Consume Rate', value: `${totalConsumeRate}/s`, icon: <ArrowDown className="w-5 h-5" />, color: 'cyan' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className={`p-2 bg-${stat.color}-500/20 rounded-lg`}><span className={`text-${stat.color}-400`}>{stat.icon}</span></div>
                <span className="text-2xl font-bold text-white">{stat.value}</span>
              </div>
              <p className="text-xs text-nexus-muted mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {[
            { key: 'queues' as const, label: 'Queues', icon: <Inbox className="w-4 h-4" />, count: queues.length },
            { key: 'dlq' as const, label: 'Dead Letter Queue', icon: <AlertTriangle className="w-4 h-4" />, count: dlqMessages.length },
            { key: 'metrics' as const, label: 'Metrics', icon: <BarChart3 className="w-4 h-4" /> },
          ].map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25' : 'text-nexus-muted hover:text-gray-200 hover:bg-nexus-surface/50'}`}>
              {tab.icon}<span>{tab.label}</span>
              {'count' in tab && tab.count !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-emerald-500/50' : 'bg-nexus-surface/50'}`}>{tab.count}</span>}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Queues Tab */}
          {activeTab === 'queues' && (
            <motion.div key="queues" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexus-muted" />
                <input type="text" placeholder="Search queues..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-nexus-border rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
                {filteredQueues.map(queue => {
                  const cfg = statusConfig[queue.status] || statusConfig.idle;
                  return (
                    <motion.div key={queue.id} variants={itemVariants} whileHover={{ scale: 1.005 }}
                      className={`p-4 bg-gray-800/30 border rounded-xl transition-all cursor-pointer ${selectedQueue === queue.id ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-700/50 hover:border-nexus-border'}`}
                      onClick={() => setSelectedQueue(selectedQueue === queue.id ? null : queue.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${cfg.bg}`}>
                            {queue.type === 'dead_letter' ? <AlertTriangle className={`w-4 h-4 ${cfg.color}`} /> :
                             queue.type === 'priority' ? <Zap className={`w-4 h-4 ${cfg.color}`} /> :
                             queue.type === 'delayed' ? <Clock className={`w-4 h-4 ${cfg.color}`} /> :
                             <Inbox className={`w-4 h-4 ${cfg.color}`} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm">{queue.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${cfg.bg} ${cfg.color}`}>{queue.status}</span>
                              <span className="px-1.5 py-0.5 bg-nexus-surface/50 text-nexus-muted text-xs rounded">{queue.type}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-nexus-muted">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {queue.consumers} consumers</span>
                              <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {queue.memory_mb} MB</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <span className="text-lg font-bold text-emerald-400">{queue.messages_ready.toLocaleString()}</span>
                              <p className="text-[10px] text-nexus-muted">Ready</p>
                            </div>
                            <div>
                              <span className="text-lg font-bold text-yellow-400">{queue.messages_unacked}</span>
                              <p className="text-[10px] text-nexus-muted">Unacked</p>
                            </div>
                            <div>
                              <span className="text-lg font-bold text-white">{queue.messages_total}</span>
                              <p className="text-[10px] text-nexus-muted">Total</p>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="flex items-center gap-1 text-green-400"><ArrowUp className="w-3 h-3" /> {queue.publish_rate}/s</div>
                            <div className="flex items-center gap-1 text-cyan-400"><ArrowDown className="w-3 h-3" /> {queue.consume_rate}/s</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {queue.status === 'active' && <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-yellow-500/20 rounded-lg" onClick={e => e.stopPropagation()}><Pause className="w-3.5 h-3.5 text-yellow-400" /></motion.button>}
                            {queue.status === 'paused' && <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-green-500/20 rounded-lg" onClick={e => e.stopPropagation()}><Play className="w-3.5 h-3.5 text-green-400" /></motion.button>}
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-nexus-surface/50 rounded-lg" onClick={e => e.stopPropagation()}><Trash2 className="w-3.5 h-3.5 text-nexus-muted" /></motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* DLQ Tab */}
          {activeTab === 'dlq' && (
            <motion.div key="dlq" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-nexus-muted">{dlqMessages.length} failed messages</p>
                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Retry All</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"><Trash2 className="w-3 h-3" /> Purge DLQ</motion.button>
                </div>
              </div>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
                {dlqMessages.map(msg => (
                  <motion.div key={msg.id} variants={itemVariants} className="p-4 bg-gray-800/30 border border-red-500/20 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-white">From: {msg.queue}</span>
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">attempts: {msg.attempts}</span>
                          {msg.priority > 0 && <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">P{msg.priority}</span>}
                        </div>
                        <code className="text-xs text-nexus-muted font-mono block truncate max-w-2xl">{msg.body}</code>
                        <p className="text-xs text-nexus-muted mt-1"><Clock className="w-3 h-3 inline mr-1" />{new Date(msg.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:bg-blue-500/20 rounded-lg"><RotateCcw className="w-4 h-4 text-blue-400" /></motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:bg-nexus-surface/50 rounded-lg"><Eye className="w-4 h-4 text-nexus-muted" /></motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <motion.div key="metrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-6">
              <div className="col-span-2 p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4">Message Throughput (24h)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Area type="monotone" dataKey="published" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                    <Area type="monotone" dataKey="consumed" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} strokeWidth={2} />
                    <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4">Messages by Queue</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={queueBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Bar dataKey="ready" fill="#10b981" name="Ready" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="unacked" fill="#f59e0b" name="Unacked" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4">Queue Health</h3>
                <div className="space-y-3">
                  {queues.filter(q => q.type !== 'dead_letter').map(q => {
                    const lag = q.messages_ready;
                    const health = lag < 100 ? 'healthy' : lag < 500 ? 'warning' : 'critical';
                    return (
                      <div key={q.id} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${health === 'healthy' ? 'bg-green-400' : health === 'warning' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                        <span className="text-sm text-nexus-muted flex-1">{q.name}</span>
                        <span className={`text-xs font-medium ${health === 'healthy' ? 'text-green-400' : health === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>{lag.toLocaleString()} msgs</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
