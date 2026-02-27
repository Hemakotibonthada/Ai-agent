import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, HardDrive, Wifi, Thermometer, Activity, Zap,
  Server, Database, MemoryStick, Clock, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, ChevronDown,
  Monitor, Globe, Shield, TrendingUp, BarChart3,
  ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: string;
  warning?: boolean;
  critical?: boolean;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'degraded';
  uptime: string;
  cpu: number;
  memory: number;
  port?: number;
}

const generateTimeData = (points: number, baseValue: number, variance: number) => {
  const now = new Date();
  return Array.from({ length: points }, (_, i) => {
    const time = new Date(now.getTime() - (points - i) * 60000);
    return {
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variance)),
      value2: Math.max(0, Math.min(100, baseValue * 0.6 + (Math.random() - 0.5) * variance)),
    };
  });
};

const SystemMonitor: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'network' | 'storage'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [cpuData, setCpuData] = useState(() => generateTimeData(30, 35, 20));
  const [memoryData, setMemoryData] = useState(() => generateTimeData(30, 62, 10));
  const [networkData, setNetworkData] = useState(() => generateTimeData(30, 45, 30));

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      setCpuData(prev => [...prev.slice(1), {
        time: timeStr,
        value: Math.max(5, Math.min(95, prev[prev.length - 1].value + (Math.random() - 0.5) * 15)),
        value2: Math.max(5, Math.min(95, prev[prev.length - 1].value2 + (Math.random() - 0.5) * 10)),
      }]);

      setMemoryData(prev => [...prev.slice(1), {
        time: timeStr,
        value: Math.max(40, Math.min(90, prev[prev.length - 1].value + (Math.random() - 0.5) * 5)),
        value2: Math.max(20, Math.min(70, prev[prev.length - 1].value2 + (Math.random() - 0.5) * 5)),
      }]);

      setNetworkData(prev => [...prev.slice(1), {
        time: timeStr,
        value: Math.max(0, Math.min(100, prev[prev.length - 1].value + (Math.random() - 0.5) * 40)),
        value2: Math.max(0, Math.min(100, prev[prev.length - 1].value2 + (Math.random() - 0.5) * 30)),
      }]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentCpu = cpuData[cpuData.length - 1]?.value || 0;
  const currentMem = memoryData[memoryData.length - 1]?.value || 0;
  const currentNet = networkData[networkData.length - 1]?.value || 0;

  const metrics: SystemMetric[] = [
    { name: 'CPU Usage', value: Math.round(currentCpu), unit: '%', icon: <Cpu size={20} />, color: 'from-blue-500 to-cyan-500', trend: 'up', trendValue: '+2.3%', warning: currentCpu > 70 },
    { name: 'Memory', value: Math.round(currentMem), unit: '%', icon: <MemoryStick size={20} />, color: 'from-purple-500 to-pink-500', trend: 'stable', trendValue: '0.1%' },
    { name: 'Disk I/O', value: 23, unit: 'MB/s', icon: <HardDrive size={20} />, color: 'from-green-500 to-emerald-500', trend: 'down', trendValue: '-5.1%' },
    { name: 'Network', value: Math.round(currentNet), unit: 'Mbps', icon: <Wifi size={20} />, color: 'from-orange-500 to-amber-500', trend: 'up', trendValue: '+12%' },
    { name: 'Temperature', value: 54, unit: '°C', icon: <Thermometer size={20} />, color: 'from-red-500 to-orange-500', trend: 'stable', trendValue: '0°C' },
    { name: 'Uptime', value: 72, unit: 'hours', icon: <Clock size={20} />, color: 'from-indigo-500 to-blue-500', trend: 'up', trendValue: '+1h' },
  ];

  const services: ServiceStatus[] = [
    { name: 'FastAPI Server', status: 'running', uptime: '72h 14m', cpu: 12, memory: 245, port: 8000 },
    { name: 'AI Engine', status: 'running', uptime: '72h 14m', cpu: 35, memory: 1842, port: undefined },
    { name: 'MQTT Broker', status: 'running', uptime: '72h 14m', cpu: 3, memory: 67, port: 1883 },
    { name: 'Scheduler', status: 'running', uptime: '72h 13m', cpu: 1, memory: 34 },
    { name: 'WebSocket Server', status: 'running', uptime: '72h 14m', cpu: 5, memory: 89, port: 8000 },
    { name: 'Vision Service', status: 'degraded', uptime: '12h 45m', cpu: 8, memory: 512, port: 8001 },
    { name: 'Voice Service', status: 'running', uptime: '72h 14m', cpu: 15, memory: 324 },
    { name: 'Email Service', status: 'stopped', uptime: '0h', cpu: 0, memory: 0 },
    { name: 'Cache Layer', status: 'running', uptime: '72h 14m', cpu: 2, memory: 128 },
    { name: 'Auth Service', status: 'running', uptime: '72h 14m', cpu: 4, memory: 56 },
  ];

  const diskUsage = [
    { name: 'System', value: 15, color: '#3b82f6' },
    { name: 'Models', value: 28, color: '#8b5cf6' },
    { name: 'Data', value: 22, color: '#10b981' },
    { name: 'Logs', value: 8, color: '#f59e0b' },
    { name: 'Backups', value: 18, color: '#ef4444' },
    { name: 'Free', value: 9, color: '#6b7280' },
  ];

  const processes = [
    { pid: 1234, name: 'python3 main.py', cpu: 12.3, memory: 245.8, status: 'running', user: 'nexus' },
    { pid: 1235, name: 'uvicorn worker', cpu: 8.1, memory: 189.4, status: 'running', user: 'nexus' },
    { pid: 1236, name: 'ai_engine', cpu: 35.2, memory: 1842.0, status: 'running', user: 'nexus' },
    { pid: 1237, name: 'mqtt_broker', cpu: 3.4, memory: 67.2, status: 'running', user: 'mqtt' },
    { pid: 1238, name: 'scheduler', cpu: 1.2, memory: 34.5, status: 'sleeping', user: 'nexus' },
    { pid: 1239, name: 'vision_worker', cpu: 8.7, memory: 512.3, status: 'running', user: 'nexus' },
    { pid: 1240, name: 'voice_engine', cpu: 15.1, memory: 324.7, status: 'running', user: 'nexus' },
    { pid: 1241, name: 'cache_service', cpu: 2.0, memory: 128.9, status: 'running', user: 'nexus' },
    { pid: 1242, name: 'node vite', cpu: 4.5, memory: 156.2, status: 'running', user: 'node' },
    { pid: 1243, name: 'postgres', cpu: 6.8, memory: 256.0, status: 'running', user: 'postgres' },
  ];

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'running') return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'degraded') return <AlertTriangle size={14} className="text-yellow-500" />;
    return <XCircle size={14} className="text-red-500" />;
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <ArrowUp size={12} className="text-green-500" />;
    if (trend === 'down') return <ArrowDown size={12} className="text-red-500" />;
    return <Minus size={12} className="text-gray-400" />;
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Monitor className="text-blue-500" size={32} />
              System Monitor
            </h1>
            <p className="text-gray-500 mt-1">Real-time system performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 rounded-full bg-green-500" />
              Live
            </span>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(['overview', 'processes', 'network', 'storage'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {metrics.map((metric, i) => (
              <FadeIn key={metric.name} delay={i * 0.05}>
                <motion.div whileHover={{ y: -4 }}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 ${metric.warning ? 'ring-2 ring-yellow-400' : ''} ${metric.critical ? 'ring-2 ring-red-500' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${metric.color} text-white`}>{metric.icon}</div>
                    <div className="flex items-center gap-0.5 text-xs">
                      <TrendIcon trend={metric.trend} />
                      <span className="text-gray-500">{metric.trendValue}</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}<span className="text-sm text-gray-400 ml-1">{metric.unit}</span></div>
                  <div className="text-xs text-gray-500 mt-1">{metric.name}</div>
                  {(metric.name === 'CPU Usage' || metric.name === 'Memory') && (
                    <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div animate={{ width: `${metric.value}%` }} transition={{ duration: 0.5 }}
                        className={`h-full rounded-full bg-gradient-to-r ${metric.color}`} />
                    </div>
                  )}
                </motion.div>
              </FadeIn>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FadeIn delay={0.15}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Cpu size={16} className="text-blue-500" /> CPU & Memory Usage
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={cpuData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="CPU" />
                    <Area type="monotone" dataKey="value2" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} name="Memory" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Wifi size={16} className="text-orange-500" /> Network Traffic
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={networkData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="Download" />
                    <Area type="monotone" dataKey="value2" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Upload" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>
          </div>

          {/* Services Grid */}
          <FadeIn delay={0.25}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Server size={16} className="text-blue-500" /> Services
                  <span className="ml-auto text-xs text-gray-500">
                    {services.filter(s => s.status === 'running').length}/{services.length} running
                  </span>
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-x divide-y divide-gray-100 dark:divide-gray-700">
                {services.map(service => (
                  <div key={service.name} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusIcon status={service.status} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{service.name}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">CPU</span>
                        <span className="text-gray-900 dark:text-white">{service.cpu}%</span>
                      </div>
                      <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(service.cpu * 2, 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">RAM</span>
                        <span className="text-gray-900 dark:text-white">{service.memory}MB</span>
                      </div>
                      {service.port && (
                        <div className="text-[10px] text-gray-400 mt-1">Port: {service.port}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </>
      )}

      {activeTab === 'processes' && (
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">PID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CPU %</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Memory</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {processes.sort((a, b) => b.cpu - a.cpu).map(proc => (
                  <motion.tr key={proc.pid}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{proc.pid}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white font-mono">{proc.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${proc.cpu > 30 ? 'bg-red-500' : proc.cpu > 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(proc.cpu * 2, 100)}%` }} />
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white">{proc.cpu}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{proc.memory.toFixed(1)} MB</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        proc.status === 'running' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>{proc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{proc.user}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}

      {activeTab === 'network' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FadeIn delay={0.1}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Network Interfaces</h3>
              <div className="space-y-3">
                {[
                  { name: 'eth0', ip: '192.168.1.100', speed: '1 Gbps', status: 'active', rx: '2.4 GB', tx: '1.1 GB' },
                  { name: 'wlan0', ip: '192.168.1.101', speed: '300 Mbps', status: 'active', rx: '890 MB', tx: '234 MB' },
                  { name: 'lo', ip: '127.0.0.1', speed: '-', status: 'active', rx: '45 MB', tx: '45 MB' },
                  { name: 'docker0', ip: '172.17.0.1', speed: '-', status: 'active', rx: '1.2 GB', tx: '890 MB' },
                ].map(iface => (
                  <div key={iface.name} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{iface.name}</span>
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">{iface.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <span>IP: <span className="text-gray-900 dark:text-gray-300">{iface.ip}</span></span>
                      <span>Speed: <span className="text-gray-900 dark:text-gray-300">{iface.speed}</span></span>
                      <span>RX: <span className="text-green-500">{iface.rx}</span></span>
                      <span>TX: <span className="text-blue-500">{iface.tx}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Active Connections</h3>
              <div className="space-y-2">
                {[
                  { proto: 'TCP', local: ':8000', remote: '192.168.1.50:49812', state: 'ESTABLISHED' },
                  { proto: 'TCP', local: ':5173', remote: '192.168.1.50:49813', state: 'ESTABLISHED' },
                  { proto: 'TCP', local: ':1883', remote: '192.168.1.200:55234', state: 'ESTABLISHED' },
                  { proto: 'TCP', local: ':8000', remote: '192.168.1.50:49815', state: 'TIME_WAIT' },
                  { proto: 'WS', local: ':8000/ws', remote: '192.168.1.50:49816', state: 'OPEN' },
                  { proto: 'TCP', local: ':5432', remote: '127.0.0.1:49820', state: 'ESTABLISHED' },
                ].map((conn, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 text-xs font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px]">{conn.proto}</span>
                    <span className="text-gray-500">{conn.local}</span>
                    <span className="text-gray-300">→</span>
                    <span className="text-gray-900 dark:text-gray-300">{conn.remote}</span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                      conn.state === 'ESTABLISHED' || conn.state === 'OPEN' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>{conn.state}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      )}

      {activeTab === 'storage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FadeIn delay={0.1}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Disk Usage Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={diskUsage} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {diskUsage.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {diskUsage.map(item => (
                  <span key={item.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}: {item.value}GB
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Volumes</h3>
              <div className="space-y-4">
                {[
                  { mount: '/', total: '100 GB', used: '45.2 GB', pct: 45 },
                  { mount: '/data', total: '500 GB', used: '234.8 GB', pct: 47 },
                  { mount: '/backups', total: '200 GB', used: '156.3 GB', pct: 78 },
                  { mount: '/tmp', total: '20 GB', used: '2.1 GB', pct: 10 },
                ].map(vol => (
                  <div key={vol.mount}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-mono text-gray-900 dark:text-white">{vol.mount}</span>
                      <span className="text-xs text-gray-500">{vol.used} / {vol.total}</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${vol.pct}%` }} transition={{ duration: 1 }}
                        className={`h-full rounded-full ${vol.pct > 75 ? 'bg-red-500' : vol.pct > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
};

export default SystemMonitor;
