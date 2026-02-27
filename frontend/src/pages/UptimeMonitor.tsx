import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Plus, Trash2, Edit3, Search, Play, Pause, RotateCcw,
  CheckCircle, XCircle, Clock, AlertTriangle, Copy, Download,
  ExternalLink, Shield, Zap, Activity, BarChart3, Settings,
  ArrowUp, ArrowDown, ChevronRight, Wifi, WifiOff, MapPin,
  Server, Eye
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type MonitorStatus = 'up' | 'down' | 'degraded' | 'paused' | 'maintenance';

interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  type: 'HTTP' | 'HTTPS' | 'TCP' | 'DNS' | 'PING';
  status: MonitorStatus;
  responseTime: number;
  uptime: number;
  lastChecked: string;
  checkInterval: number;
  sslExpiry?: string;
  region: string;
  statusHistory: { timestamp: string; status: MonitorStatus; responseTime: number }[];
  alerts: { type: string; message: string; timestamp: string }[];
}

interface Incident {
  id: string;
  monitorId: string;
  monitorName: string;
  startTime: string;
  endTime?: string;
  duration: string;
  type: 'outage' | 'degradation' | 'maintenance';
  rootCause?: string;
  affectedRegions: string[];
}

const monitors: UptimeCheck[] = [
  {
    id: 'mon_1', name: 'Production API', url: 'https://api.nexus-ai.app/health',
    type: 'HTTPS', status: 'up', responseTime: 142, uptime: 99.98, lastChecked: '10s ago',
    checkInterval: 30, sslExpiry: '2025-09-28', region: 'US East',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: 'up' as MonitorStatus, responseTime: 120 + Math.random() * 80,
    })),
    alerts: [],
  },
  {
    id: 'mon_2', name: 'Web Frontend', url: 'https://nexus-ai.app',
    type: 'HTTPS', status: 'up', responseTime: 89, uptime: 99.99, lastChecked: '15s ago',
    checkInterval: 60, sslExpiry: '2025-09-28', region: 'Global CDN',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: 'up' as MonitorStatus, responseTime: 60 + Math.random() * 60,
    })),
    alerts: [],
  },
  {
    id: 'mon_3', name: 'Database Primary', url: 'tcp://db-primary.internal:5432',
    type: 'TCP', status: 'up', responseTime: 12, uptime: 99.95, lastChecked: '5s ago',
    checkInterval: 15, region: 'US East',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: (i === 8 ? 'degraded' : 'up') as MonitorStatus, responseTime: i === 8 ? 450 : 10 + Math.random() * 15,
    })),
    alerts: [{ type: 'warning', message: 'High latency detected at 15:00', timestamp: '2025-07-14T15:00:00Z' }],
  },
  {
    id: 'mon_4', name: 'Redis Cache', url: 'tcp://redis.internal:6379',
    type: 'TCP', status: 'up', responseTime: 3, uptime: 100, lastChecked: '2s ago',
    checkInterval: 10, region: 'US East',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: 'up' as MonitorStatus, responseTime: 1 + Math.random() * 5,
    })),
    alerts: [],
  },
  {
    id: 'mon_5', name: 'ML Inference API', url: 'https://ml.nexus-ai.app/v1/predict',
    type: 'HTTPS', status: 'degraded', responseTime: 890, uptime: 97.5, lastChecked: '20s ago',
    checkInterval: 30, sslExpiry: '2026-01-15', region: 'US West',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: (i < 4 ? 'degraded' : 'up') as MonitorStatus, responseTime: i < 4 ? 700 + Math.random() * 400 : 200 + Math.random() * 150,
    })),
    alerts: [
      { type: 'critical', message: 'Response time >500ms for 4 hours', timestamp: '2025-07-14T06:00:00Z' },
      { type: 'warning', message: 'GPU utilization at 95%', timestamp: '2025-07-14T05:30:00Z' },
    ],
  },
  {
    id: 'mon_6', name: 'SMTP Server', url: 'tcp://smtp.nexus-ai.app:587',
    type: 'TCP', status: 'down', responseTime: 0, uptime: 95.2, lastChecked: '5s ago',
    checkInterval: 60, region: 'EU West',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: (i < 2 ? 'down' : 'up') as MonitorStatus, responseTime: i < 2 ? 0 : 45 + Math.random() * 30,
    })),
    alerts: [
      { type: 'critical', message: 'Connection refused - port 587 unreachable', timestamp: '2025-07-14T08:00:00Z' },
    ],
  },
  {
    id: 'mon_7', name: 'DNS nexus-ai.app', url: 'nexus-ai.app',
    type: 'DNS', status: 'up', responseTime: 25, uptime: 100, lastChecked: '30s ago',
    checkInterval: 120, region: 'Global',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: 'up' as MonitorStatus, responseTime: 15 + Math.random() * 20,
    })),
    alerts: [],
  },
  {
    id: 'mon_8', name: 'Staging API', url: 'https://staging-api.nexus-ai.app/health',
    type: 'HTTPS', status: 'maintenance', responseTime: 0, uptime: 98.0, lastChecked: '1m ago',
    checkInterval: 60, sslExpiry: '2025-06-01', region: 'US East',
    statusHistory: Array.from({ length: 24 }, (_, i) => ({
      timestamp: `${23 - i}:00`, status: (i < 3 ? 'maintenance' : 'up') as MonitorStatus, responseTime: i < 3 ? 0 : 180 + Math.random() * 100,
    })),
    alerts: [{ type: 'info', message: 'Scheduled maintenance in progress', timestamp: '2025-07-14T07:00:00Z' }],
  },
];

const incidents: Incident[] = [
  { id: 'inc_1', monitorId: 'mon_6', monitorName: 'SMTP Server', startTime: '2025-07-14T08:00:00Z', duration: '2h 15m', type: 'outage', rootCause: 'TLS certificate misconfiguration after renewal', affectedRegions: ['EU West'] },
  { id: 'inc_2', monitorId: 'mon_5', monitorName: 'ML Inference API', startTime: '2025-07-14T06:00:00Z', duration: '4h+', type: 'degradation', rootCause: 'GPU memory leak in model serving', affectedRegions: ['US West'] },
  { id: 'inc_3', monitorId: 'mon_8', monitorName: 'Staging API', startTime: '2025-07-14T07:00:00Z', duration: '3h', type: 'maintenance', affectedRegions: ['US East'] },
  { id: 'inc_4', monitorId: 'mon_3', monitorName: 'Database Primary', startTime: '2025-07-14T15:00:00Z', endTime: '2025-07-14T15:12:00Z', duration: '12m', type: 'degradation', rootCause: 'Connection pool exhaustion', affectedRegions: ['US East'] },
];

const statusConfig: Record<MonitorStatus, { color: string; icon: React.ElementType; label: string }> = {
  up: { color: '#10b981', icon: CheckCircle, label: 'Operational' },
  down: { color: '#ef4444', icon: XCircle, label: 'Down' },
  degraded: { color: '#f59e0b', icon: AlertTriangle, label: 'Degraded' },
  paused: { color: '#6b7280', icon: Pause, label: 'Paused' },
  maintenance: { color: '#3b82f6', icon: Settings, label: 'Maintenance' },
};

const incidentColors: Record<string, string> = {
  outage: '#ef4444', degradation: '#f59e0b', maintenance: '#3b82f6',
};

export default function UptimeMonitor() {
  const [selectedMonitor, setSelectedMonitor] = useState<UptimeCheck | null>(null);
  const [activeTab, setActiveTab] = useState<'monitors' | 'incidents' | 'statuspage'>('monitors');
  const [filter, setFilter] = useState<MonitorStatus | 'all'>('all');

  const filteredMonitors = monitors.filter(m => filter === 'all' || m.status === filter);

  const overallUptime = (monitors.reduce((s, m) => s + m.uptime, 0) / monitors.length).toFixed(2);
  const upCount = monitors.filter(m => m.status === 'up').length;
  const downCount = monitors.filter(m => m.status === 'down').length;
  const degradedCount = monitors.filter(m => m.status === 'degraded').length;
  const avgResponseTime = Math.round(monitors.filter(m => m.responseTime > 0).reduce((s, m) => s + m.responseTime, 0) / monitors.filter(m => m.responseTime > 0).length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6 text-white">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Uptime Monitor
            </h1>
            <p className="text-gray-400 mt-1">Real-time service availability and incident tracking</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Add Monitor
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Overall Uptime', value: `${overallUptime}%`, icon: Activity, color: '#10b981' },
          { label: 'Up', value: upCount, icon: CheckCircle, color: '#10b981' },
          { label: 'Down', value: downCount, icon: XCircle, color: '#ef4444' },
          { label: 'Degraded', value: degradedCount, icon: AlertTriangle, color: '#f59e0b' },
          { label: 'Avg Response', value: `${avgResponseTime}ms`, icon: Zap, color: '#3b82f6' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} whileHover={{ y: -2 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-gray-400">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 border border-white/10 w-fit">
        {([
          { id: 'monitors' as const, label: 'Monitors' },
          { id: 'incidents' as const, label: 'Incidents' },
          { id: 'statuspage' as const, label: 'Status Page' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* Monitors Tab */}
      {activeTab === 'monitors' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10 mb-6 w-fit">
            {(['all', 'up', 'down', 'degraded', 'maintenance'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all capitalize ${filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredMonitors.map((mon, i) => {
              const StatusIcon = statusConfig[mon.status].icon;
              const color = statusConfig[mon.status].color;
              return (
                <motion.div key={mon.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedMonitor(selectedMonitor?.id === mon.id ? null : mon)}
                  className={`bg-white/5 backdrop-blur-sm rounded-xl border p-5 cursor-pointer transition-all hover:bg-white/[0.07] ${
                    selectedMonitor?.id === mon.id ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-white/10'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                        <StatusIcon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{mon.name}</h3>
                        <div className="text-xs text-gray-500 font-mono truncate max-w-[250px]">{mon.url}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${color}15`, color }}>{statusConfig[mon.status].label}</span>
                      <div className="text-xs text-gray-500 mt-1">Checked {mon.lastChecked}</div>
                    </div>
                  </div>

                  {/* Status bars (last 24 checks) */}
                  <div className="flex gap-0.5 mb-3">
                    {mon.statusHistory.map((h, j) => (
                      <div key={j} className="flex-1 h-6 rounded-sm transition-colors" title={`${h.timestamp} - ${h.status} (${Math.round(h.responseTime)}ms)`}
                        style={{ backgroundColor: statusConfig[h.status].color, opacity: 0.7 + (j / 24) * 0.3 }} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex gap-4">
                      <span>{mon.type}</span>
                      <span>{mon.responseTime > 0 ? `${mon.responseTime}ms` : '—'}</span>
                      <span className={mon.uptime >= 99.9 ? 'text-green-400' : mon.uptime >= 99 ? 'text-yellow-400' : 'text-red-400'}>
                        {mon.uptime}% uptime
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {mon.region}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {selectedMonitor?.id === mon.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="mt-4 pt-4 border-t border-white/10 space-y-4 overflow-hidden">
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mon.statusHistory.map(h => ({ time: h.timestamp, latency: Math.round(h.responseTime) }))}>
                              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} />
                              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                              <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: 12 }} />
                              <Area type="monotone" dataKey="latency" stroke={color} fill={`${color}20`} strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        {mon.alerts.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-gray-400">Active Alerts</h4>
                            {mon.alerts.map((alert, j) => (
                              <div key={j} className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span className="text-gray-300">{alert.message}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><span className="text-gray-500 block">Check Interval</span>{mon.checkInterval}s</div>
                          {mon.sslExpiry && <div><span className="text-gray-500 block">SSL Expiry</span>{mon.sslExpiry}</div>}
                          <div><span className="text-gray-500 block">Region</span>{mon.region}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {incidents.map((inc, i) => (
            <motion.div key={inc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: incidentColors[inc.type] }} />
                  <div>
                    <h3 className="font-semibold text-sm">{inc.monitorName}</h3>
                    <p className="text-xs text-gray-500 capitalize">{inc.type} · Duration: {inc.duration}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{
                  backgroundColor: `${incidentColors[inc.type]}15`, color: incidentColors[inc.type],
                }}>{inc.type}</span>
              </div>
              {inc.rootCause && (
                <p className="text-sm text-gray-400 mb-2"><strong className="text-gray-300">Root cause:</strong> {inc.rootCause}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Started: {new Date(inc.startTime).toLocaleString()}</span>
                <span>Regions: {inc.affectedRegions.join(', ')}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Status Page Tab */}
      {activeTab === 'statuspage' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 mb-6 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-2 ${
              downCount > 0 ? 'bg-red-500/15 text-red-400' : degradedCount > 0 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-green-500/15 text-green-400'
            }`}>
              {downCount > 0 ? <XCircle className="w-4 h-4" /> : degradedCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {downCount > 0 ? 'Partial Outage' : degradedCount > 0 ? 'Degraded Performance' : 'All Systems Operational'}
            </div>
            <p className="text-xs text-gray-500">Last updated: {new Date().toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            {monitors.map(mon => {
              const color = statusConfig[mon.status].color;
              return (
                <div key={mon.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium">{mon.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-0.5">
                      {mon.statusHistory.slice(-30).map((h, j) => (
                        <div key={j} className="w-1 h-4 rounded-sm" style={{ backgroundColor: statusConfig[h.status].color, opacity: 0.8 }} />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color }}>{mon.uptime}%</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{ backgroundColor: `${color}15`, color }}>{statusConfig[mon.status].label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
