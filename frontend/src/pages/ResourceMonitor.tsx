import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, MemoryStick, HardDrive, Activity, Wifi, Thermometer, Clock,
  RefreshCw, AlertTriangle, Check, TrendingUp, TrendingDown, Server,
  Loader, Settings, Zap, BarChart3, Gauge, ArrowUp, ArrowDown, Eye
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface SystemMetric { label: string; value: number; max: number; unit: string; trend: number; history: number[]; }

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'];

export default function ResourceMonitor() {
  const [loading, setLoading] = useState(true);
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [diskUsage, setDiskUsage] = useState(0);
  const [networkIn, setNetworkIn] = useState(0);
  const [networkOut, setNetworkOut] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [uptime, setUptime] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(3000);

  const [cpuHistory, setCpuHistory] = useState<{ time: string; value: number }[]>([]);
  const [memHistory, setMemHistory] = useState<{ time: string; value: number }[]>([]);
  const [netHistory, setNetHistory] = useState<{ time: string; in: number; out: number }[]>([]);

  const [processes, setProcesses] = useState<{ pid: number; name: string; cpu: number; memory: number; status: string }[]>([]);
  const [disks, setDisks] = useState<{ name: string; total: number; used: number; fs: string }[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    const update = () => {
      const cpu = 20 + Math.random() * 40;
      const mem = 55 + Math.random() * 20;
      setCpuUsage(cpu);
      setMemoryUsage(mem);
      setDiskUsage(62 + Math.random() * 5);
      setNetworkIn(Math.random() * 50 + 10);
      setNetworkOut(Math.random() * 30 + 5);
      setTemperature(55 + Math.random() * 15);
      setUptime('14d 7h 32m');

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCpuHistory(prev => [...prev.slice(-29), { time, value: Math.round(cpu * 10) / 10 }]);
      setMemHistory(prev => [...prev.slice(-29), { time, value: Math.round(mem * 10) / 10 }]);
      setNetHistory(prev => [...prev.slice(-29), { time, in: Math.round((Math.random() * 50 + 10) * 10) / 10, out: Math.round((Math.random() * 30 + 5) * 10) / 10 }]);
    };

    update();
    setProcesses([
      { pid: 1, name: 'nexus-core', cpu: 18.5, memory: 512, status: 'running' },
      { pid: 2, name: 'python3.12', cpu: 12.3, memory: 384, status: 'running' },
      { pid: 3, name: 'node', cpu: 8.7, memory: 256, status: 'running' },
      { pid: 4, name: 'postgres', cpu: 4.2, memory: 310, status: 'running' },
      { pid: 5, name: 'redis-server', cpu: 1.8, memory: 64, status: 'running' },
      { pid: 6, name: 'uvicorn', cpu: 6.4, memory: 180, status: 'running' },
      { pid: 7, name: 'celery', cpu: 3.1, memory: 128, status: 'running' },
      { pid: 8, name: 'nginx', cpu: 0.5, memory: 32, status: 'running' },
    ]);
    setDisks([
      { name: '/', total: 500, used: 312, fs: 'ext4' },
      { name: '/data', total: 2000, used: 1245, fs: 'ext4' },
      { name: '/models', total: 1000, used: 734, fs: 'ext4' },
    ]);

    const interval = setInterval(update, refreshInterval);
    return () => clearInterval(interval);
  }, [loading, refreshInterval]);

  const getColor = (value: number, max: number = 100) => {
    const pct = (value / max) * 100;
    if (pct > 80) return '#ef4444';
    if (pct > 60) return '#f59e0b';
    return '#10b981';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-teal-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-teal-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-teal-500/20 rounded-xl">
              <Activity className="w-7 h-7 text-teal-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Resource Monitor</h1>
              <p className="text-nexus-muted text-sm">Real-time system performance monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-nexus-muted">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Uptime: {uptime}</span>
            <select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))} className="bg-nexus-card border border-nexus-border rounded-lg px-2 py-1 text-nexus-muted text-xs focus:outline-none">
              <option value={1000}>1s</option><option value={3000}>3s</option><option value={5000}>5s</option><option value={10000}>10s</option>
            </select>
          </div>
        </div>

        {/* Gauges */}
        <div className="grid grid-cols-6 gap-4">
          {[
            { label: 'CPU', value: cpuUsage, unit: '%', icon: <Cpu className="w-5 h-5" />, max: 100 },
            { label: 'Memory', value: memoryUsage, unit: '%', icon: <MemoryStick className="w-5 h-5" />, max: 100 },
            { label: 'Disk', value: diskUsage, unit: '%', icon: <HardDrive className="w-5 h-5" />, max: 100 },
            { label: 'Net In', value: networkIn, unit: 'MB/s', icon: <ArrowDown className="w-5 h-5" />, max: 100 },
            { label: 'Net Out', value: networkOut, unit: 'MB/s', icon: <ArrowUp className="w-5 h-5" />, max: 100 },
            { label: 'Temp', value: temperature, unit: '°C', icon: <Thermometer className="w-5 h-5" />, max: 90 },
          ].map((metric, i) => (
            <motion.div key={metric.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
              className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl text-center">
              <div className="relative w-20 h-20 mx-auto mb-3">
                <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(55,65,81)" strokeWidth="6" />
                  <motion.circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" strokeLinecap="round"
                    stroke={getColor(metric.value, metric.max)}
                    strokeDasharray={`${(metric.value / metric.max) * 213.6} 213.6`}
                    animate={{ strokeDasharray: `${(metric.value / metric.max) * 213.6} 213.6` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-white">{metric.value.toFixed(1)}</span>
                  <span className="text-[10px] text-nexus-muted">{metric.unit}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-teal-400">{metric.icon}</span>
                <span className="text-xs text-nexus-muted">{metric.label}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Cpu className="w-4 h-4 text-teal-400" /> CPU Usage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cpuHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={5} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="value" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><MemoryStick className="w-4 h-4 text-purple-400" /> Memory Usage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={memHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={5} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="value" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Wifi className="w-4 h-4 text-blue-400" /> Network I/O</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={netHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={5} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                <Line type="monotone" dataKey="in" stroke="#3b82f6" strokeWidth={2} dot={false} name="In" />
                <Line type="monotone" dataKey="out" stroke="#f59e0b" strokeWidth={2} dot={false} name="Out" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><HardDrive className="w-4 h-4 text-amber-400" /> Disk Usage</h3>
            <div className="space-y-4">
              {disks.map(disk => {
                const pct = (disk.used / disk.total) * 100;
                return (
                  <div key={disk.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-nexus-muted font-mono">{disk.name}</span>
                      <span className="text-nexus-muted">{disk.used} / {disk.total} GB ({disk.fs})</span>
                    </div>
                    <div className="h-3 bg-nexus-surface rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }}
                        className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-teal-500'}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Process Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2"><Server className="w-4 h-4 text-teal-400" /> Top Processes</h3>
            <span className="text-xs text-nexus-muted">{processes.length} processes</span>
          </div>
          <table className="w-full">
            <thead><tr className="text-xs text-nexus-muted uppercase tracking-wider border-b border-gray-700/30">
              <th className="text-left p-3">PID</th><th className="text-left p-3">Name</th><th className="text-right p-3">CPU %</th><th className="text-right p-3">Memory</th><th className="text-center p-3">Status</th>
            </tr></thead>
            <tbody>
              {processes.sort((a, b) => b.cpu - a.cpu).map(p => (
                <motion.tr key={p.pid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/20 hover:bg-gray-800/50 text-sm">
                  <td className="p-3 text-nexus-muted font-mono text-xs">{p.pid}</td>
                  <td className="p-3 text-white font-medium">{p.name}</td>
                  <td className="p-3 text-right">
                    <span className={p.cpu > 15 ? 'text-amber-400' : p.cpu > 5 ? 'text-teal-400' : 'text-nexus-muted'}>{p.cpu}%</span>
                  </td>
                  <td className="p-3 text-right text-nexus-muted">{p.memory} MB</td>
                  <td className="p-3 text-center"><span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">{p.status}</span></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </motion.div>
    </div>
  );
}
