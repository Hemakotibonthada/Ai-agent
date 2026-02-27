import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, Search, AlertCircle, CheckCircle,
  XCircle, Clock, Server, Database, Wifi, Globe,
  Shield, Bot, Cpu, HardDrive, RefreshCw,
  ChevronRight, TrendingUp, BarChart3, Eye,
  Bell, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'partial' | 'major' | 'maintenance';
  uptime: number;
  responseTime: number;
  category: string;
  lastChecked: string;
  icon: string;
  incidents: number;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  service: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  updates: { time: string; message: string; status: string }[];
}

const statusConfig = {
  operational: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Operational', barColor: '#10B981' },
  degraded: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Degraded', barColor: '#F59E0B' },
  partial: { color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'Partial Outage', barColor: '#F97316' },
  major: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Major Outage', barColor: '#EF4444' },
  maintenance: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Maintenance', barColor: '#3B82F6' },
};

const sampleServices: ServiceStatus[] = [
  { id: '1', name: 'API Gateway', description: 'Main API endpoint for all services', status: 'operational', uptime: 99.98, responseTime: 42, category: 'Core', lastChecked: '30s ago', icon: 'globe', incidents: 0 },
  { id: '2', name: 'AI Engine', description: 'NLP processing and agent orchestration', status: 'operational', uptime: 99.95, responseTime: 185, category: 'AI', lastChecked: '30s ago', icon: 'bot', incidents: 1 },
  { id: '3', name: 'Database (Primary)', description: 'PostgreSQL primary instance', status: 'operational', uptime: 99.99, responseTime: 8, category: 'Data', lastChecked: '30s ago', icon: 'database', incidents: 0 },
  { id: '4', name: 'Database (Replica)', description: 'Read replica for queries', status: 'operational', uptime: 99.97, responseTime: 12, category: 'Data', lastChecked: '30s ago', icon: 'database', incidents: 0 },
  { id: '5', name: 'WebSocket Server', description: 'Real-time communication layer', status: 'operational', uptime: 99.92, responseTime: 5, category: 'Core', lastChecked: '30s ago', icon: 'wifi', incidents: 0 },
  { id: '6', name: 'Authentication Service', description: 'OAuth2 and JWT token management', status: 'operational', uptime: 99.99, responseTime: 35, category: 'Security', lastChecked: '30s ago', icon: 'shield', incidents: 0 },
  { id: '7', name: 'Task Scheduler', description: 'Cron jobs and background tasks', status: 'degraded', uptime: 99.85, responseTime: 220, category: 'Core', lastChecked: '30s ago', icon: 'clock', incidents: 2 },
  { id: '8', name: 'MQTT Broker', description: 'IoT device messaging', status: 'operational', uptime: 99.96, responseTime: 3, category: 'IoT', lastChecked: '30s ago', icon: 'wifi', incidents: 0 },
  { id: '9', name: 'Search Engine', description: 'Full-text and vector search', status: 'operational', uptime: 99.93, responseTime: 65, category: 'Data', lastChecked: '30s ago', icon: 'search', incidents: 0 },
  { id: '10', name: 'File Storage', description: 'Media and document storage', status: 'operational', uptime: 99.98, responseTime: 28, category: 'Data', lastChecked: '30s ago', icon: 'hard-drive', incidents: 0 },
  { id: '11', name: 'Vision Service', description: 'Camera feeds and image analysis', status: 'maintenance', uptime: 98.50, responseTime: 0, category: 'AI', lastChecked: '5m ago', icon: 'eye', incidents: 0 },
  { id: '12', name: 'Notification Service', description: 'Push notifications and email', status: 'operational', uptime: 99.94, responseTime: 55, category: 'Core', lastChecked: '30s ago', icon: 'bell', incidents: 0 },
];

const sampleIncidents: Incident[] = [
  {
    id: 'inc-1', title: 'Elevated API latency in AI Engine', status: 'monitoring', severity: 'minor', service: 'AI Engine', createdAt: '2024-03-20 13:00', updatedAt: '2024-03-20 14:30', description: 'Users may experience slower response times for AI-powered queries.',
    updates: [
      { time: '14:30', message: 'Model cache has been refreshed. Monitoring response times.', status: 'monitoring' },
      { time: '13:45', message: 'Root cause identified: model cache invalidation caused cold starts.', status: 'identified' },
      { time: '13:00', message: 'Investigating reports of increased latency in AI responses.', status: 'investigating' },
    ],
  },
  {
    id: 'inc-2', title: 'Task Scheduler delays', status: 'identified', severity: 'major', service: 'Task Scheduler', createdAt: '2024-03-20 12:00', updatedAt: '2024-03-20 14:00', description: 'Some scheduled tasks are executing with delays of up to 5 minutes.',
    updates: [
      { time: '14:00', message: 'Worker pool has been scaled up. Backlog clearing.', status: 'identified' },
      { time: '12:30', message: 'Identified queue congestion in the task worker pool.', status: 'identified' },
      { time: '12:00', message: 'Investigating delayed task executions reported by monitoring.', status: 'investigating' },
    ],
  },
  {
    id: 'inc-3', title: 'Vision Service scheduled maintenance', status: 'monitoring', severity: 'minor', service: 'Vision Service', createdAt: '2024-03-20 14:00', updatedAt: '2024-03-20 14:00', description: 'Planned maintenance for camera processing pipeline upgrade.',
    updates: [
      { time: '14:00', message: 'Maintenance window started. Expected duration: 2 hours.', status: 'monitoring' },
    ],
  },
];

const uptimeData = Array.from({ length: 90 }, (_, i) => ({
  day: `Day ${90 - i}`,
  uptime: 99.5 + Math.random() * 0.5,
}));

const responseTimeData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  p50: 30 + Math.random() * 20,
  p95: 80 + Math.random() * 80,
  p99: 150 + Math.random() * 150,
}));

export default function StatusPage() {
  const [services] = useState(sampleServices);
  const [incidents] = useState(sampleIncidents);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = useMemo(() => ['All', ...new Set(services.map(s => s.category))], [services]);
  const filtered = useMemo(() => categoryFilter === 'All' ? services : services.filter(s => s.category === categoryFilter), [services, categoryFilter]);

  const overallStatus = services.every(s => s.status === 'operational' || s.status === 'maintenance') ? 'All Systems Operational' :
    services.some(s => s.status === 'major') ? 'Major System Outage' :
    services.some(s => s.status === 'degraded' || s.status === 'partial') ? 'Some Systems Degraded' : 'All Systems Operational';
  const overallColor = overallStatus.includes('Operational') ? 'text-green-400' : overallStatus.includes('Major') ? 'text-red-400' : 'text-yellow-400';
  const avgUptime = (services.reduce((s, sv) => s + sv.uptime, 0) / services.length).toFixed(2);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><CheckSquare className="text-nexus-primary" /> System Status</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className={`text-lg font-semibold ${overallColor}`}>{overallStatus}</span>
          <span className="text-xs text-nexus-muted">· Avg Uptime: {avgUptime}%</span>
        </div>
      </div>

      {/* Active Incidents */}
      {incidents.filter(i => i.status !== 'resolved').length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-nexus-text flex items-center gap-2"><AlertCircle size={16} className="text-yellow-400" /> Active Incidents</h2>
          {incidents.filter(i => i.status !== 'resolved').map((inc, i) => (
            <motion.div
              key={inc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedIncident(selectedIncident?.id === inc.id ? null : inc)}
              className={`glass rounded-2xl border p-4 cursor-pointer transition-all ${
                inc.severity === 'critical' ? 'border-red-500/30' : inc.severity === 'major' ? 'border-yellow-500/30' : 'border-nexus-border/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={16} className={inc.severity === 'critical' ? 'text-red-400' : inc.severity === 'major' ? 'text-yellow-400' : 'text-blue-400'} />
                  <div>
                    <p className="text-sm font-medium text-nexus-text">{inc.title}</p>
                    <p className="text-xs text-nexus-muted">{inc.service} · {inc.status} · Updated {inc.updatedAt}</p>
                  </div>
                </div>
                <ChevronRight size={14} className={`text-nexus-muted transition-transform ${selectedIncident?.id === inc.id ? 'rotate-90' : ''}`} />
              </div>
              <AnimatePresence>
                {selectedIncident?.id === inc.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 space-y-3 overflow-hidden">
                    <p className="text-sm text-nexus-muted">{inc.description}</p>
                    <div className="space-y-2">
                      {inc.updates.map((upd, j) => (
                        <div key={j} className="flex gap-3 text-xs">
                          <span className="text-nexus-muted font-mono shrink-0">{upd.time}</span>
                          <div className="flex-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] mr-2 ${upd.status === 'resolved' ? 'bg-green-500/10 text-green-400' : upd.status === 'monitoring' ? 'bg-blue-500/10 text-blue-400' : upd.status === 'identified' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-orange-500/10 text-orange-400'}`}>{upd.status}</span>
                            <span className="text-nexus-text">{upd.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Service Category Filter */}
      <div className="flex gap-2 mb-4">
        {categories.map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)} className={`px-3 py-1.5 text-xs rounded-lg ${categoryFilter === c ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>{c}</button>
        ))}
      </div>

      {/* Service Grid */}
      <div className="space-y-2 mb-8">
        {filtered.map((svc, i) => {
          const sc = statusConfig[svc.status];
          return (
            <motion.div
              key={svc.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-4 rounded-xl hover:bg-nexus-surface/30 transition-colors"
            >
              <div className={`h-3 w-3 rounded-full ${sc.bg}`} style={{ backgroundColor: sc.barColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-nexus-text">{svc.name}</p>
                <p className="text-xs text-nexus-muted">{svc.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-medium ${sc.color}`}>{sc.label}</p>
                <p className="text-[10px] text-nexus-muted">{svc.uptime}% uptime · {svc.responseTime}ms</p>
              </div>
              {/* 90-day uptime bar */}
              <div className="hidden md:flex gap-px">
                {Array.from({ length: 30 }, (_, j) => {
                  const up = 99.5 + Math.random() * 0.5;
                  return <div key={j} className="h-6 w-1 rounded-sm" style={{ backgroundColor: up > 99.9 ? '#10B981' : up > 99.5 ? '#F59E0B' : '#EF4444' }} />;
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">90-Day Uptime</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={uptimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={14} />
              <YAxis domain={[99, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} formatter={(v: number) => `${v.toFixed(3)}%`} />
              <Area type="monotone" dataKey="uptime" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">Response Time Percentiles</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="p99" stroke="#EF4444" fill="#EF4444" fillOpacity={0.05} name="p99" />
              <Area type="monotone" dataKey="p95" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.05} name="p95" />
              <Area type="monotone" dataKey="p50" stroke="#10B981" fill="#10B981" fillOpacity={0.1} name="p50" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </motion.div>
  );
}
