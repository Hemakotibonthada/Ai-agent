import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge, Search, Filter, Cpu, MemoryStick, HardDrive,
  Wifi, Clock, Activity, TrendingUp, TrendingDown,
  Flame, Zap, RefreshCw, Play, Pause, BarChart3,
  AlertTriangle, CheckCircle, ChevronRight, Timer,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface PerformanceMetric {
  id: string;
  name: string;
  category: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  status: 'good' | 'warning' | 'critical';
  history: { time: string; value: number }[];
}

const generateHistory = (base: number, variance: number, count = 60) =>
  Array.from({ length: count }, (_, i) => ({
    time: `${count - i}s`,
    value: Math.max(0, base + (Math.random() - 0.5) * variance),
  }));

const initialMetrics: PerformanceMetric[] = [
  { id: '1', name: 'CPU Usage', category: 'System', value: 34, unit: '%', trend: 'down', trendValue: 2.1, status: 'good', history: generateHistory(32, 15) },
  { id: '2', name: 'Memory Usage', category: 'System', value: 67, unit: '%', trend: 'up', trendValue: 1.5, status: 'warning', history: generateHistory(65, 10) },
  { id: '3', name: 'Disk I/O', category: 'System', value: 12, unit: 'MB/s', trend: 'stable', trendValue: 0.3, status: 'good', history: generateHistory(12, 8) },
  { id: '4', name: 'Network In', category: 'Network', value: 45, unit: 'Mbps', trend: 'up', trendValue: 5.2, status: 'good', history: generateHistory(42, 20) },
  { id: '5', name: 'Network Out', category: 'Network', value: 18, unit: 'Mbps', trend: 'down', trendValue: 1.8, status: 'good', history: generateHistory(19, 10) },
  { id: '6', name: 'API Latency', category: 'Application', value: 142, unit: 'ms', trend: 'up', trendValue: 12, status: 'warning', history: generateHistory(130, 50) },
  { id: '7', name: 'Request Rate', category: 'Application', value: 856, unit: 'req/s', trend: 'up', trendValue: 45, status: 'good', history: generateHistory(820, 150) },
  { id: '8', name: 'Error Rate', category: 'Application', value: 0.12, unit: '%', trend: 'down', trendValue: 0.03, status: 'good', history: generateHistory(0.15, 0.1) },
  { id: '9', name: 'DB Queries', category: 'Database', value: 2450, unit: 'q/s', trend: 'stable', trendValue: 20, status: 'good', history: generateHistory(2400, 400) },
  { id: '10', name: 'DB Pool', category: 'Database', value: 78, unit: '%', trend: 'up', trendValue: 3, status: 'warning', history: generateHistory(75, 15) },
  { id: '11', name: 'Cache Hit Rate', category: 'Cache', value: 94.5, unit: '%', trend: 'stable', trendValue: 0.2, status: 'good', history: generateHistory(94, 3) },
  { id: '12', name: 'Agent Response', category: 'AI', value: 320, unit: 'ms', trend: 'down', trendValue: 15, status: 'good', history: generateHistory(335, 80) },
];

const radarData = [
  { metric: 'CPU', current: 34, baseline: 40 },
  { metric: 'Memory', current: 67, baseline: 55 },
  { metric: 'Network', current: 45, baseline: 50 },
  { metric: 'Disk', current: 30, baseline: 35 },
  { metric: 'Cache', current: 94, baseline: 90 },
  { metric: 'Latency', current: 72, baseline: 80 },
];

const statusColors = { good: 'text-green-400', warning: 'text-yellow-400', critical: 'text-red-400' };
const statusBgs = { good: 'bg-green-500/10', warning: 'bg-yellow-500/10', critical: 'bg-red-500/10' };

const flamegraphData = [
  { name: 'main()', width: 100, depth: 0, time: '5.2s' },
  { name: 'process_request()', width: 60, depth: 1, time: '3.1s' },
  { name: 'ai_inference()', width: 35, depth: 2, time: '1.8s' },
  { name: 'model.predict()', width: 25, depth: 3, time: '1.3s' },
  { name: 'tokenize()', width: 10, depth: 3, time: '0.5s' },
  { name: 'db_query()', width: 20, depth: 2, time: '1.0s' },
  { name: 'cache_check()', width: 5, depth: 2, time: '0.3s' },
  { name: 'serialize()', width: 30, depth: 1, time: '1.6s' },
  { name: 'json_encode()', width: 20, depth: 2, time: '1.0s' },
  { name: 'compress()', width: 10, depth: 2, time: '0.5s' },
  { name: 'logging()', width: 10, depth: 1, time: '0.5s' },
];

export default function PerformanceProfiler() {
  const isDemo = useIsDemoAccount();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [live, setLive] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<PerformanceMetric | null>(null);
  const [category, setCategory] = useState('All');
  const [tab, setTab] = useState<'metrics' | 'flamegraph' | 'traces'>('metrics');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (live) {
      intervalRef.current = setInterval(() => {
        setMetrics(prev =>
          prev.map(m => {
            const variance = m.value * 0.05;
            const newValue = Math.max(0, m.value + (Math.random() - 0.5) * variance);
            return { ...m, value: parseFloat(newValue.toFixed(2)), history: [...m.history.slice(1), { time: '0s', value: newValue }] };
          })
        );
      }, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [live]);

  const categories = useMemo(() => ['All', ...new Set(metrics.map(m => m.category))], [metrics]);
  const filtered = useMemo(() => category === 'All' ? metrics : metrics.filter(m => m.category === category), [metrics, category]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Gauge className="text-nexus-primary" /> Performance Profiler</h1>
          <p className="text-nexus-muted mt-1">Real-time system & application performance monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          {live && <span className="flex items-center gap-1 text-xs text-green-400"><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /> Live</span>}
          <button onClick={() => setLive(!live)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${live ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
            {live ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-nexus-surface rounded-xl p-1 w-fit">
        {(['metrics', 'flamegraph', 'traces'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm rounded-lg capitalize transition-colors ${tab === t ? 'bg-nexus-primary text-white' : 'text-nexus-muted hover:text-nexus-text'}`}>{t === 'flamegraph' ? 'Flame Graph' : t}</button>
        ))}
      </div>

      {tab === 'metrics' && (
        <>
          {/* Category filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 text-xs rounded-lg ${category === c ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{c}</button>
            ))}
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {filtered.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedMetric(m)}
                className={`glass rounded-2xl border border-nexus-border/30 p-4 cursor-pointer hover:border-nexus-primary/30 transition-all ${selectedMetric?.id === m.id ? 'ring-2 ring-nexus-primary/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-nexus-muted">{m.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusBgs[m.status]} ${statusColors[m.status]}`}>{m.status}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-nexus-text">{typeof m.value === 'number' && m.value > 100 ? m.value.toLocaleString() : m.value}</span>
                  <span className="text-xs text-nexus-muted mb-1">{m.unit}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {m.trend === 'up' ? <TrendingUp size={10} className="text-yellow-400" /> : m.trend === 'down' ? <TrendingDown size={10} className="text-green-400" /> : <Activity size={10} className="text-blue-400" />}
                  <span className="text-[10px] text-nexus-muted">{m.trendValue} {m.unit}</span>
                </div>
                {/* Sparkline */}
                <ResponsiveContainer width="100%" height={40}>
                  <AreaChart data={m.history.slice(-20)}>
                    <Area type="monotone" dataKey="value" stroke={m.status === 'good' ? '#10B981' : m.status === 'warning' ? '#F59E0B' : '#EF4444'} fill={m.status === 'good' ? '#10B981' : m.status === 'warning' ? '#F59E0B' : '#EF4444'} fillOpacity={0.1} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            ))}
          </div>

          {/* Detail + Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {selectedMetric ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
                <h3 className="font-bold text-nexus-text mb-4">{selectedMetric.name} History (60s)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={selectedMetric.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                    <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={9} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                    <Line type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            ) : (
              <div className="glass rounded-2xl border border-nexus-border/30 p-6 flex items-center justify-center text-nexus-muted">
                Click a metric to see detailed history
              </div>
            )}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
              <h3 className="font-bold text-nexus-text mb-4">System Health Radar</h3>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#2E2E45" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <Radar name="Current" dataKey="current" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} />
                  <Radar name="Baseline" dataKey="baseline" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </>
      )}

      {tab === 'flamegraph' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-bold text-nexus-text mb-4 flex items-center gap-2"><Flame size={18} className="text-orange-400" /> CPU Flame Graph</h3>
          <p className="text-xs text-nexus-muted mb-6">Sampled over 5.2s · 12,450 samples · Click to zoom</p>
          <div className="space-y-1">
            {flamegraphData.map((frame, i) => {
              const hue = (frame.depth * 30 + 10) % 360;
              return (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ width: `${frame.width}%`, marginLeft: `${frame.depth * 3}%` }}
                  className="group relative cursor-pointer"
                >
                  <div
                    className="rounded-md px-2 py-1.5 text-xs font-mono text-white hover:brightness-110 transition-all"
                    style={{ background: `hsl(${hue}, 70%, 45%)` }}
                  >
                    <span className="truncate block">{frame.name}</span>
                  </div>
                  <div className="absolute -top-8 left-0 hidden group-hover:block bg-nexus-surface border border-nexus-border/30 rounded-lg px-2 py-1 text-[10px] text-nexus-text z-10 whitespace-nowrap">
                    {frame.name} — {frame.time} ({frame.width}%)
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-nexus-muted">
            <Timer size={12} /> Hottest path: main() → process_request() → ai_inference() → model.predict() (1.3s / 25%)
          </div>
        </motion.div>
      )}

      {tab === 'traces' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-bold text-nexus-text mb-4 flex items-center gap-2"><Activity size={18} className="text-nexus-accent" /> Distributed Traces</h3>
          <div className="space-y-3">
            {[
              { id: 'trace-001', name: 'POST /api/chat', duration: '342ms', spans: 8, status: 'success' },
              { id: 'trace-002', name: 'GET /api/agents', duration: '85ms', spans: 4, status: 'success' },
              { id: 'trace-003', name: 'POST /api/tasks', duration: '1.2s', spans: 12, status: 'slow' },
              { id: 'trace-004', name: 'GET /api/health', duration: '12ms', spans: 2, status: 'success' },
              { id: 'trace-005', name: 'POST /api/search', duration: '520ms', spans: 6, status: 'success' },
              { id: 'trace-006', name: 'PUT /api/config', duration: '2.1s', spans: 15, status: 'error' },
            ].map((trace, i) => (
              <motion.div
                key={trace.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-nexus-surface/50 cursor-pointer"
              >
                <span className={`h-2 w-2 rounded-full ${trace.status === 'success' ? 'bg-green-400' : trace.status === 'slow' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                <span className="text-sm font-mono text-nexus-text flex-1">{trace.name}</span>
                <span className="text-xs text-nexus-muted">{trace.spans} spans</span>
                <span className={`text-sm font-mono ${trace.status === 'error' ? 'text-red-400' : trace.status === 'slow' ? 'text-yellow-400' : 'text-nexus-text'}`}>{trace.duration}</span>
                {/* Waterfall bar */}
                <div className="w-32 h-4 bg-nexus-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${trace.status === 'error' ? 'bg-red-500' : trace.status === 'slow' ? 'bg-yellow-500' : 'bg-nexus-primary'}`}
                    style={{ width: `${Math.min(100, (parseFloat(trace.duration) / 2.5) * 100)}%` }}
                  />
                </div>
                <ChevronRight size={14} className="text-nexus-muted" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
