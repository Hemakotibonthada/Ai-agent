import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, Filter, Activity, Server, Wifi,
  WifiOff, Monitor, Smartphone, Router, HardDrive,
  Shield, AlertTriangle, CheckCircle, Signal,
  Zap, RefreshCw, Eye, MapPin, Clock, ArrowUpDown,
  ChevronRight, BarChart3, TrendingUp, Download,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface NetworkNode {
  id: string;
  name: string;
  type: 'router' | 'server' | 'desktop' | 'mobile' | 'iot' | 'switch' | 'firewall';
  ip: string;
  mac: string;
  status: 'online' | 'offline' | 'warning';
  latency: number;
  bandwidth: { up: number; down: number };
  location: string;
  os: string;
  uptime: string;
  connections: number;
  lastSeen: string;
  group: string;
}

const nodeIcons = { router: Router, server: Server, desktop: Monitor, mobile: Smartphone, iot: Wifi, switch: ArrowUpDown, firewall: Shield };
const statusColors = { online: 'text-green-400', offline: 'text-red-400', warning: 'text-yellow-400' };
const statusBgs = { online: 'bg-green-500/10', offline: 'bg-red-500/10', warning: 'bg-yellow-500/10' };

const sampleNodes: NetworkNode[] = [
  { id: '1', name: 'Gateway Router', type: 'router', ip: '192.168.1.1', mac: 'AA:BB:CC:DD:EE:01', status: 'online', latency: 2, bandwidth: { up: 450, down: 920 }, location: 'Server Room', os: 'OpenWrt 23.05', uptime: '45d 12h', connections: 24, lastSeen: 'now', group: 'Infrastructure' },
  { id: '2', name: 'Nexus AI Server', type: 'server', ip: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:02', status: 'online', latency: 1, bandwidth: { up: 850, down: 420 }, location: 'Server Room', os: 'Ubuntu 22.04', uptime: '120d 5h', connections: 156, lastSeen: 'now', group: 'Infrastructure' },
  { id: '3', name: 'Database Server', type: 'server', ip: '192.168.1.11', mac: 'AA:BB:CC:DD:EE:03', status: 'online', latency: 1, bandwidth: { up: 320, down: 180 }, location: 'Server Room', os: 'Debian 12', uptime: '89d 3h', connections: 42, lastSeen: 'now', group: 'Infrastructure' },
  { id: '4', name: 'Firewall', type: 'firewall', ip: '192.168.1.2', mac: 'AA:BB:CC:DD:EE:04', status: 'online', latency: 1, bandwidth: { up: 950, down: 950 }, location: 'Server Room', os: 'pfSense 2.7', uptime: '200d 18h', connections: 0, lastSeen: 'now', group: 'Infrastructure' },
  { id: '5', name: 'Core Switch', type: 'switch', ip: '192.168.1.3', mac: 'AA:BB:CC:DD:EE:05', status: 'online', latency: 0, bandwidth: { up: 1000, down: 1000 }, location: 'Server Room', os: 'Cisco IOS', uptime: '365d 2h', connections: 48, lastSeen: 'now', group: 'Infrastructure' },
  { id: '6', name: 'Admin Desktop', type: 'desktop', ip: '192.168.1.100', mac: 'AA:BB:CC:DD:EE:06', status: 'online', latency: 3, bandwidth: { up: 95, down: 340 }, location: 'Office', os: 'Windows 11', uptime: '2d 8h', connections: 12, lastSeen: 'now', group: 'Workstations' },
  { id: '7', name: 'Dev Laptop', type: 'desktop', ip: '192.168.1.101', mac: 'AA:BB:CC:DD:EE:07', status: 'online', latency: 5, bandwidth: { up: 55, down: 180 }, location: 'Office', os: 'macOS 14.3', uptime: '0d 6h', connections: 8, lastSeen: 'now', group: 'Workstations' },
  { id: '8', name: 'iPhone - Admin', type: 'mobile', ip: '192.168.1.150', mac: 'AA:BB:CC:DD:EE:08', status: 'online', latency: 12, bandwidth: { up: 25, down: 85 }, location: 'Wi-Fi', os: 'iOS 17.3', uptime: '0d 3h', connections: 4, lastSeen: '2m ago', group: 'Mobile' },
  { id: '9', name: 'ESP32 - Living Room', type: 'iot', ip: '192.168.1.200', mac: 'AA:BB:CC:DD:EE:09', status: 'online', latency: 8, bandwidth: { up: 0.1, down: 0.5 }, location: 'Living Room', os: 'ESP-IDF 5.1', uptime: '15d 2h', connections: 1, lastSeen: '30s ago', group: 'IoT Devices' },
  { id: '10', name: 'ESP32 - Kitchen', type: 'iot', ip: '192.168.1.201', mac: 'AA:BB:CC:DD:EE:10', status: 'online', latency: 10, bandwidth: { up: 0.05, down: 0.2 }, location: 'Kitchen', os: 'ESP-IDF 5.1', uptime: '12d 18h', connections: 1, lastSeen: '45s ago', group: 'IoT Devices' },
  { id: '11', name: 'Smart Thermostat', type: 'iot', ip: '192.168.1.202', mac: 'AA:BB:CC:DD:EE:11', status: 'warning', latency: 45, bandwidth: { up: 0.01, down: 0.05 }, location: 'Hallway', os: 'Proprietary', uptime: '5d 1h', connections: 1, lastSeen: '5m ago', group: 'IoT Devices' },
  { id: '12', name: 'Smart Camera', type: 'iot', ip: '192.168.1.203', mac: 'AA:BB:CC:DD:EE:12', status: 'offline', latency: 0, bandwidth: { up: 0, down: 0 }, location: 'Garage', os: 'Linux', uptime: '0d 0h', connections: 0, lastSeen: '2h ago', group: 'IoT Devices' },
  { id: '13', name: 'NAS Storage', type: 'server', ip: '192.168.1.20', mac: 'AA:BB:CC:DD:EE:13', status: 'online', latency: 2, bandwidth: { up: 520, down: 680 }, location: 'Server Room', os: 'TrueNAS 13', uptime: '180d 7h', connections: 8, lastSeen: 'now', group: 'Infrastructure' },
  { id: '14', name: 'Tablet - Dashboard', type: 'mobile', ip: '192.168.1.151', mac: 'AA:BB:CC:DD:EE:14', status: 'online', latency: 8, bandwidth: { up: 15, down: 42 }, location: 'Living Room', os: 'Android 14', uptime: '0d 12h', connections: 2, lastSeen: '1m ago', group: 'Mobile' },
];

const trafficData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  download: Math.floor(200 + Math.random() * 600),
  upload: Math.floor(50 + Math.random() * 200),
}));

const protocolData = [
  { name: 'HTTPS', value: 45, color: '#3B82F6' },
  { name: 'MQTT', value: 25, color: '#8B5CF6' },
  { name: 'SSH', value: 10, color: '#10B981' },
  { name: 'DNS', value: 8, color: '#F59E0B' },
  { name: 'HTTP', value: 7, color: '#EF4444' },
  { name: 'Other', value: 5, color: '#6B7280' },
];

export default function NetworkTopology() {
  const [nodes] = useState(sampleNodes);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  const groups = useMemo(() => ['All', ...new Set(nodes.map(n => n.group))], [nodes]);

  const filtered = useMemo(() => {
    let items = nodes;
    if (groupFilter !== 'All') items = items.filter(n => n.group === groupFilter);
    if (statusFilter !== 'All') items = items.filter(n => n.status === statusFilter.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(n => n.name.toLowerCase().includes(q) || n.ip.includes(q) || n.mac.toLowerCase().includes(q));
    }
    return items;
  }, [nodes, search, groupFilter, statusFilter]);

  const stats = {
    total: nodes.length,
    online: nodes.filter(n => n.status === 'online').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    warning: nodes.filter(n => n.status === 'warning').length,
    totalBandwidth: nodes.reduce((s, n) => s + n.bandwidth.down + n.bandwidth.up, 0),
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Globe className="text-nexus-primary" /> Network Topology</h1>
          <p className="text-nexus-muted mt-1">{stats.total} devices · {stats.online} online · {stats.offline} offline</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"><RefreshCw size={16} /> Scan Network</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Devices', value: stats.total, icon: Monitor, color: 'text-blue-400' },
          { label: 'Online', value: stats.online, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Offline', value: stats.offline, icon: WifiOff, color: 'text-red-400' },
          { label: 'Warnings', value: stats.warning, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Bandwidth', value: `${(stats.totalBandwidth / 1000).toFixed(1)} Gbps`, icon: Zap, color: 'text-purple-400' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl border border-nexus-border/30 p-4">
            <div className="flex items-center gap-3">
              <stat.icon size={18} className={stat.color} />
              <div>
                <p className="text-xl font-bold text-nexus-text">{stat.value}</p>
                <p className="text-xs text-nexus-muted">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-2 glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">24h Traffic</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="download" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="Download (Mbps)" />
              <Area type="monotone" dataKey="upload" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.1} name="Upload (Mbps)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">Protocol Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={protocolData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name">
                {protocolData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {protocolData.map(p => (
              <span key={p.name} className="flex items-center gap-1 text-[10px] text-nexus-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name} {p.value}%
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices, IPs..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <div className="flex gap-1">
          {['All', 'Online', 'Warning', 'Offline'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg ${statusFilter === s ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>{s}</button>
          ))}
        </div>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text">
          {groups.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      <div className={`grid gap-6 ${selectedNode ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Device List */}
        <div className={`space-y-2 ${selectedNode ? 'lg:col-span-2' : ''}`}>
          {filtered.map((node, i) => {
            const NodeIcon = nodeIcons[node.type];
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedNode(node)}
                className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all hover:bg-nexus-surface/50 ${selectedNode?.id === node.id ? 'bg-nexus-primary/5 border border-nexus-primary/30' : ''}`}
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${statusBgs[node.status]}`}>
                  <NodeIcon size={18} className={statusColors[node.status]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-nexus-text">{node.name}</span>
                    <span className={`h-2 w-2 rounded-full ${node.status === 'online' ? 'bg-green-400' : node.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-nexus-muted">
                    <span className="font-mono">{node.ip}</span>
                    <span>{node.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-nexus-text">{node.latency}ms</p>
                  <p className="text-[10px] text-nexus-muted">↓{node.bandwidth.down} ↑{node.bandwidth.up} Mbps</p>
                </div>
                <ChevronRight size={14} className="text-nexus-muted" />
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-nexus-text">{selectedNode.name}</h3>
                <button onClick={() => setSelectedNode(null)} className="p-1 hover:text-nexus-primary text-nexus-muted">✕</button>
              </div>

              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-4 ${statusBgs[selectedNode.status]} ${statusColors[selectedNode.status]}`}>
                <span className={`h-2 w-2 rounded-full ${selectedNode.status === 'online' ? 'bg-green-400' : selectedNode.status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                {selectedNode.status}
              </div>

              <div className="space-y-3 mb-6">
                {[
                  ['IP Address', selectedNode.ip],
                  ['MAC Address', selectedNode.mac],
                  ['Type', selectedNode.type],
                  ['OS', selectedNode.os],
                  ['Location', selectedNode.location],
                  ['Uptime', selectedNode.uptime],
                  ['Latency', `${selectedNode.latency}ms`],
                  ['Connections', selectedNode.connections],
                  ['Last Seen', selectedNode.lastSeen],
                  ['Group', selectedNode.group],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-xs border-b border-nexus-border/10 pb-1">
                    <span className="text-nexus-muted">{k}</span>
                    <span className="text-nexus-text font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>

              <h4 className="text-sm font-semibold text-nexus-text mb-3">Bandwidth</h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-nexus-surface rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{selectedNode.bandwidth.down}</p>
                  <p className="text-[10px] text-nexus-muted">↓ Download Mbps</p>
                </div>
                <div className="bg-nexus-surface rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-purple-400">{selectedNode.bandwidth.up}</p>
                  <p className="text-[10px] text-nexus-muted">↑ Upload Mbps</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-xs text-nexus-muted hover:text-nexus-text"><Signal size={12} /> Ping</button>
                <button className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-xs text-nexus-muted hover:text-nexus-text"><Eye size={12} /> Monitor</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
