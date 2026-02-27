import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, Activity, Check, X, AlertTriangle, RefreshCw, Server,
  ArrowRight, Circle, Loader, Shield, Zap, Clock, Search,
  TrendingUp, BarChart3, Eye, Settings, Info, ExternalLink
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface ServiceNode {
  id: string; name: string; type: string; status: 'healthy' | 'degraded' | 'down';
  instances: number; requestsPerSec: number; avgLatency: number; errorRate: number;
  dependencies: string[]; x: number; y: number;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#84cc16'];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function ServiceMesh() {
  const isDemo = useIsDemoAccount();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'topology' | 'services' | 'traffic' | 'policies'>('topology');
  const [services, setServices] = useState<ServiceNode[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceNode | null>(null);
  const [search, setSearch] = useState('');

  const trafficData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`, requests: Math.floor(Math.random() * 5000 + 2000),
    errors: Math.floor(Math.random() * 100), latency: Math.random() * 150 + 50,
  })), []);

  const serviceDistribution = useMemo(() => [
    { name: 'API Gateway', value: 35 }, { name: 'Auth Service', value: 20 },
    { name: 'Agent Core', value: 25 }, { name: 'Database', value: 10 },
    { name: 'Cache', value: 10 },
  ], []);

  useEffect(() => {
    setTimeout(() => {
      setServices([
        { id: 's1', name: 'API Gateway', type: 'gateway', status: 'healthy', instances: 3, requestsPerSec: 4200, avgLatency: 12, errorRate: 0.1, dependencies: ['s2', 's3', 's4'], x: 400, y: 60 },
        { id: 's2', name: 'Auth Service', type: 'service', status: 'healthy', instances: 2, requestsPerSec: 1800, avgLatency: 25, errorRate: 0.05, dependencies: ['s6'], x: 150, y: 200 },
        { id: 's3', name: 'Agent Core', type: 'service', status: 'healthy', instances: 4, requestsPerSec: 3500, avgLatency: 45, errorRate: 0.2, dependencies: ['s5', 's6', 's7'], x: 400, y: 200 },
        { id: 's4', name: 'Task Engine', type: 'service', status: 'degraded', instances: 2, requestsPerSec: 920, avgLatency: 180, errorRate: 2.1, dependencies: ['s6'], x: 650, y: 200 },
        { id: 's5', name: 'ML Pipeline', type: 'service', status: 'healthy', instances: 2, requestsPerSec: 320, avgLatency: 350, errorRate: 0.3, dependencies: ['s8'], x: 250, y: 360 },
        { id: 's6', name: 'PostgreSQL', type: 'database', status: 'healthy', instances: 2, requestsPerSec: 5600, avgLatency: 5, errorRate: 0.01, dependencies: [], x: 450, y: 360 },
        { id: 's7', name: 'Redis Cache', type: 'cache', status: 'healthy', instances: 3, requestsPerSec: 12000, avgLatency: 1, errorRate: 0.0, dependencies: [], x: 650, y: 360 },
        { id: 's8', name: 'Model Store', type: 'storage', status: 'healthy', instances: 1, requestsPerSec: 150, avgLatency: 85, errorRate: 0.1, dependencies: [], x: 250, y: 500 },
        { id: 's9', name: 'Notification', type: 'service', status: 'down', instances: 0, requestsPerSec: 0, avgLatency: 0, errorRate: 100, dependencies: ['s6'], x: 100, y: 360 },
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const statusIcon = (status: string) => {
    if (status === 'healthy') return <Check className="w-3.5 h-3.5 text-green-400" />;
    if (status === 'degraded') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    return <X className="w-3.5 h-3.5 text-red-400" />;
  };
  const statusColor = (status: string) => status === 'healthy' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#ef4444';
  const typeIcon = (type: string) => {
    if (type === 'gateway') return <Shield className="w-4 h-4" />;
    if (type === 'database') return <Server className="w-4 h-4" />;
    if (type === 'cache') return <Zap className="w-4 h-4" />;
    if (type === 'storage') return <BarChart3 className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const stats = useMemo(() => ({
    total: services.length,
    healthy: services.filter(s => s.status === 'healthy').length,
    degraded: services.filter(s => s.status === 'degraded').length,
    down: services.filter(s => s.status === 'down').length,
    totalRps: services.reduce((sum, s) => sum + s.requestsPerSec, 0),
    avgLatency: services.length ? Math.round(services.reduce((sum, s) => sum + s.avgLatency, 0) / services.length) : 0,
  }), [services]);

  const policies = [
    { name: 'Circuit Breaker', target: 'All Services', status: 'active', threshold: '50% error rate', action: 'Open circuit for 30s' },
    { name: 'Rate Limit', target: 'API Gateway', status: 'active', threshold: '10k req/min', action: 'Return 429' },
    { name: 'Retry Policy', target: 'Agent Core', status: 'active', threshold: '3 retries', action: 'Exponential backoff' },
    { name: 'Timeout', target: 'ML Pipeline', status: 'active', threshold: '5s timeout', action: 'Cancel request' },
    { name: 'mTLS', target: 'All Services', status: 'active', threshold: 'Required', action: 'Reject non-TLS' },
    { name: 'Load Balance', target: 'API Gateway', status: 'active', threshold: 'Round Robin', action: 'Distribute equally' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-violet-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-violet-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-violet-500/20 rounded-xl">
              <Network className="w-7 h-7 text-violet-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Service Mesh</h1>
              <p className="text-nexus-muted text-sm">Microservice topology & health monitoring</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['topology', 'services', 'traffic', 'policies'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === v ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-6 gap-3">
          {[
            { label: 'Services', value: stats.total, color: 'text-violet-400' },
            { label: 'Healthy', value: stats.healthy, color: 'text-green-400' },
            { label: 'Degraded', value: stats.degraded, color: 'text-amber-400' },
            { label: 'Down', value: stats.down, color: 'text-red-400' },
            { label: 'Total RPS', value: stats.totalRps.toLocaleString(), color: 'text-blue-400' },
            { label: 'Avg Latency', value: `${stats.avgLatency}ms`, color: 'text-cyan-400' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-3 bg-gray-800/30 border border-gray-700/50 rounded-xl text-center">
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              <span className="block text-[10px] text-nexus-muted mt-0.5">{s.label}</span>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {view === 'topology' && (
            <motion.div key="topo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-4">
              <div className="flex-1 bg-gray-800/20 border border-gray-700/50 rounded-xl p-4 min-h-[500px] relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #374151 1px, transparent 1px)', backgroundSize: '25px 25px' }} />
                {/* Connections */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                  {services.map(svc => svc.dependencies.map(depId => {
                    const dep = services.find(s => s.id === depId);
                    if (!dep) return null;
                    return (
                      <g key={`${svc.id}-${depId}`}>
                        <line x1={svc.x + 60} y1={svc.y + 40} x2={dep.x + 60} y2={dep.y + 10} stroke={statusColor(svc.status)} strokeWidth={1.5} strokeOpacity={0.4} strokeDasharray={svc.status === 'down' ? '5,5' : 'none'} />
                        <motion.circle cx={(svc.x + dep.x + 120) / 2} cy={(svc.y + dep.y + 50) / 2} r={3} fill={statusColor(svc.status)}
                          animate={{ cx: [svc.x + 60, dep.x + 60], cy: [svc.y + 40, dep.y + 10] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
                      </g>
                    );
                  }))}
                </svg>
                {/* Service Nodes */}
                {services.map(svc => (
                  <motion.div key={svc.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSelectedService(svc)}
                    style={{ position: 'absolute', left: svc.x, top: svc.y, zIndex: 2 }}
                    className={`w-[130px] p-3 bg-nexus-card border rounded-lg cursor-pointer transition-all hover:shadow-lg ${
                      selectedService?.id === svc.id ? 'border-violet-500 shadow-violet-500/20' : svc.status === 'down' ? 'border-red-500/50' : svc.status === 'degraded' ? 'border-amber-500/50' : 'border-nexus-border hover:border-nexus-border'
                    }`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span style={{ color: statusColor(svc.status) }}>{typeIcon(svc.type)}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor(svc.status) }}>
                        {svc.status === 'healthy' && <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-full h-full rounded-full bg-green-400/50" />}
                      </div>
                    </div>
                    <p className="text-xs text-white font-medium truncate">{svc.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-nexus-muted">
                      <span>{svc.instances}x</span>
                      <span>{svc.requestsPerSec} rps</span>
                      <span>{svc.avgLatency}ms</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {selectedService && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-64 bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 shrink-0 space-y-4">
                  <div className="flex items-center gap-2">
                    <span style={{ color: statusColor(selectedService.status) }}>{typeIcon(selectedService.type)}</span>
                    <h3 className="text-sm font-medium text-white">{selectedService.name}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    {[
                      { label: 'Instances', value: selectedService.instances },
                      { label: 'RPS', value: selectedService.requestsPerSec },
                      { label: 'Latency', value: `${selectedService.avgLatency}ms` },
                      { label: 'Error Rate', value: `${selectedService.errorRate}%` },
                    ].map(m => (
                      <div key={m.label} className="p-2 bg-gray-700/30 rounded-lg">
                        <span className="text-sm font-bold text-white">{m.value}</span>
                        <span className="block text-[10px] text-nexus-muted">{m.label}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs text-nexus-muted mb-2">Dependencies</h4>
                    <div className="space-y-1">
                      {selectedService.dependencies.map(depId => {
                        const dep = services.find(s => s.id === depId);
                        return dep ? (
                          <div key={depId} className="flex items-center gap-2 px-2 py-1 bg-gray-700/30 rounded text-xs">
                            {statusIcon(dep.status)}
                            <span className="text-nexus-muted">{dep.name}</span>
                          </div>
                        ) : null;
                      })}
                      {selectedService.dependencies.length === 0 && <span className="text-xs text-nexus-muted">No dependencies</span>}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {view === 'services' && (
            <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="text-xs text-nexus-muted uppercase tracking-wider border-b border-gray-700/30">
                  <th className="text-left p-3">Service</th><th className="text-center p-3">Status</th><th className="text-center p-3">Instances</th>
                  <th className="text-right p-3">RPS</th><th className="text-right p-3">Latency</th><th className="text-right p-3">Error Rate</th>
                </tr></thead>
                <tbody>
                  {services.map(svc => (
                    <motion.tr key={svc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/20 hover:bg-gray-800/40 text-sm cursor-pointer" onClick={() => { setSelectedService(svc); setView('topology'); }}>
                      <td className="p-3 flex items-center gap-2">
                        <span style={{ color: statusColor(svc.status) }}>{typeIcon(svc.type)}</span>
                        <span className="text-white font-medium">{svc.name}</span>
                        <span className="text-[10px] text-nexus-muted">{svc.type}</span>
                      </td>
                      <td className="p-3 text-center">{statusIcon(svc.status)}</td>
                      <td className="p-3 text-center text-nexus-muted">{svc.instances}</td>
                      <td className="p-3 text-right text-nexus-muted">{svc.requestsPerSec.toLocaleString()}</td>
                      <td className="p-3 text-right"><span className={svc.avgLatency > 100 ? 'text-amber-400' : 'text-nexus-muted'}>{svc.avgLatency}ms</span></td>
                      <td className="p-3 text-right"><span className={svc.errorRate > 1 ? 'text-red-400' : 'text-nexus-muted'}>{svc.errorRate}%</span></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {view === 'traffic' && (
            <motion.div key="traffic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-400" /> Request Volume (24h)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={6} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Area type="monotone" dataKey="requests" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-cyan-400" /> Latency (24h)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={6} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} unit="ms" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Area type="monotone" dataKey="latency" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Errors (24h)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="hour" tick={{ fill: '#9ca3af', fontSize: 10 }} tickCount={6} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Bar dataKey="errors" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-amber-400" /> Traffic Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={serviceDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {serviceDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} /></PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {view === 'policies' && (
            <motion.div key="policies" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {policies.map((p, i) => (
                  <motion.div key={p.name} variants={itemVariants}
                    className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl flex items-center gap-4">
                    <div className="p-2 bg-violet-500/15 rounded-lg"><Shield className="w-5 h-5 text-violet-400" /></div>
                    <div className="flex-1">
                      <h4 className="text-sm text-white font-medium">{p.name}</h4>
                      <span className="text-xs text-nexus-muted">Target: {p.target}</span>
                    </div>
                    <div className="text-xs text-nexus-muted text-right">
                      <span className="block">{p.threshold}</span>
                      <span className="text-nexus-muted">{p.action}</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">{p.status}</span>
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
