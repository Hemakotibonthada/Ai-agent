import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Wifi, WifiOff, Server, Monitor, Smartphone, Tablet,
  Router, HardDrive, Shield, AlertTriangle, CheckCircle2,
  XCircle, Clock, RefreshCw, Search, Filter, ChevronDown,
  ChevronRight, Cpu, Activity, Download, Upload, Zap, Info,
  Eye, MoreVertical, TrendingUp
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';
import EmptyState from '@/components/shared/EmptyState';

interface DeviceInfo {
  id: string;
  name: string;
  type: 'server' | 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'router' | 'iot' | 'printer' | 'nas';
  ip: string;
  mac: string;
  status: 'online' | 'offline' | 'warning' | 'maintenance';
  os: string;
  lastSeen: string;
  uptime: string;
  cpu: number;
  memory: number;
  networkIn: number;
  networkOut: number;
  openPorts: number[];
  services: string[];
  location: string;
  vendor: string;
}

const devices: DeviceInfo[] = [
  { id: 'dev_001', name: 'nexus-app-01', type: 'server', ip: '10.0.1.10', mac: 'AA:BB:CC:DD:01:10',
    status: 'online', os: 'Ubuntu 22.04', lastSeen: '1s ago', uptime: '45d 12h 30m',
    cpu: 34, memory: 62, networkIn: 450, networkOut: 280, openPorts: [22, 80, 443, 8000],
    services: ['nexus-api', 'nginx', 'redis'], location: 'Rack A-1', vendor: 'Dell' },
  { id: 'dev_002', name: 'nexus-app-02', type: 'server', ip: '10.0.1.11', mac: 'AA:BB:CC:DD:01:11',
    status: 'online', os: 'Ubuntu 22.04', lastSeen: '2s ago', uptime: '45d 12h 28m',
    cpu: 28, memory: 55, networkIn: 380, networkOut: 240, openPorts: [22, 80, 443, 8000],
    services: ['nexus-api', 'nginx', 'celery'], location: 'Rack A-2', vendor: 'Dell' },
  { id: 'dev_003', name: 'nexus-db-01', type: 'server', ip: '10.0.1.20', mac: 'AA:BB:CC:DD:01:20',
    status: 'online', os: 'Ubuntu 22.04', lastSeen: '1s ago', uptime: '89d 3h 15m',
    cpu: 45, memory: 78, networkIn: 890, networkOut: 650, openPorts: [22, 5432],
    services: ['postgresql', 'pgbouncer'], location: 'Rack B-1', vendor: 'HP' },
  { id: 'dev_004', name: 'nexus-cache-01', type: 'server', ip: '10.0.1.30', mac: 'AA:BB:CC:DD:01:30',
    status: 'online', os: 'Alpine Linux', lastSeen: '1s ago', uptime: '30d 8h 45m',
    cpu: 12, memory: 85, networkIn: 2100, networkOut: 1800, openPorts: [22, 6379],
    services: ['redis', 'redis-sentinel'], location: 'Rack B-2', vendor: 'HP' },
  { id: 'dev_005', name: 'nexus-ml-gpu-01', type: 'server', ip: '10.0.1.40', mac: 'AA:BB:CC:DD:01:40',
    status: 'online', os: 'Ubuntu 22.04', lastSeen: '3s ago', uptime: '15d 2h 10m',
    cpu: 92, memory: 94, networkIn: 120, networkOut: 45, openPorts: [22, 8888, 6006],
    services: ['jupyter', 'tensorboard', 'pytorch'], location: 'Rack C-1', vendor: 'Nvidia DGX' },
  { id: 'dev_006', name: 'edge-gateway-01', type: 'router', ip: '10.0.0.1', mac: 'AA:BB:CC:DD:00:01',
    status: 'online', os: 'RouterOS 7.x', lastSeen: '2s ago', uptime: '120d 5h',
    cpu: 8, memory: 35, networkIn: 5400, networkOut: 4200, openPorts: [22, 443, 8291],
    services: ['firewall', 'dhcp', 'vpn'], location: 'Network Closet', vendor: 'MikroTik' },
  { id: 'dev_007', name: 'admin-desktop', type: 'desktop', ip: '10.0.2.100', mac: 'AA:BB:CC:DD:02:64',
    status: 'online', os: 'Windows 11', lastSeen: '5s ago', uptime: '2d 4h 30m',
    cpu: 22, memory: 48, networkIn: 85, networkOut: 30, openPorts: [3389],
    services: ['rdp'], location: 'Office 201', vendor: 'Lenovo' },
  { id: 'dev_008', name: 'monitoring-pi', type: 'iot', ip: '10.0.3.50', mac: 'AA:BB:CC:DD:03:32',
    status: 'warning', os: 'Raspbian', lastSeen: '30s ago', uptime: '60d 18h',
    cpu: 65, memory: 72, networkIn: 12, networkOut: 8, openPorts: [22, 3000],
    services: ['grafana', 'prometheus-node'], location: 'Server Room', vendor: 'Raspberry Pi' },
  { id: 'dev_009', name: 'nexus-worker-03', type: 'server', ip: '10.0.1.13', mac: 'AA:BB:CC:DD:01:13',
    status: 'maintenance', os: 'Ubuntu 22.04', lastSeen: '15m ago', uptime: '0d 0h 0m',
    cpu: 0, memory: 0, networkIn: 0, networkOut: 0, openPorts: [],
    services: [], location: 'Rack A-3', vendor: 'Dell' },
  { id: 'dev_010', name: 'legacy-nas', type: 'nas', ip: '10.0.4.10', mac: 'AA:BB:CC:DD:04:0A',
    status: 'offline', os: 'DSM 7.2', lastSeen: '3h ago', uptime: 'N/A',
    cpu: 0, memory: 0, networkIn: 0, networkOut: 0, openPorts: [],
    services: [], location: 'Storage Room', vendor: 'Synology' },
  { id: 'dev_011', name: 'dev-laptop-sarah', type: 'laptop', ip: '10.0.2.105', mac: 'AA:BB:CC:DD:02:69',
    status: 'online', os: 'macOS 14', lastSeen: '8s ago', uptime: '0d 8h 15m',
    cpu: 35, memory: 60, networkIn: 42, networkOut: 18, openPorts: [],
    services: ['vscode-server'], location: 'Office 203', vendor: 'Apple' },
  { id: 'dev_012', name: 'office-printer', type: 'printer', ip: '10.0.5.10', mac: 'AA:BB:CC:DD:05:0A',
    status: 'online', os: 'Firmware 4.2', lastSeen: '20s ago', uptime: '45d 12h',
    cpu: 5, memory: 15, networkIn: 2, networkOut: 1, openPorts: [80, 9100, 631],
    services: ['ipp', 'airprint'], location: 'Office 201', vendor: 'HP' },
];

const trafficData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  inbound: Math.floor(Math.random() * 5000 + 2000),
  outbound: Math.floor(Math.random() * 3000 + 1000),
}));

const protocolData = [
  { name: 'HTTP/S', value: 45 },
  { name: 'SSH', value: 12 },
  { name: 'DNS', value: 18 },
  { name: 'SMTP', value: 5 },
  { name: 'Database', value: 15 },
  { name: 'Other', value: 5 },
];

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const typeIcons: Record<string, React.FC<any>> = {
  server: Server, desktop: Monitor, laptop: Monitor, mobile: Smartphone,
  tablet: Tablet, router: Router, iot: Cpu, printer: HardDrive, nas: HardDrive,
};

const statusColors: Record<string, string> = {
  online: '#10b981', offline: '#ef4444', warning: '#f59e0b', maintenance: '#6366f1',
};

export default function NetworkDevices() {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No network devices" description="Add network devices to monitor their status and traffic." /></div>;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    return devices.filter(d => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.ip.includes(q) || d.mac.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    warning: devices.filter(d => d.status === 'warning').length,
    offline: devices.filter(d => d.status === 'offline' || d.status === 'maintenance').length,
    totalIn: devices.reduce((s, d) => s + d.networkIn, 0),
    totalOut: devices.reduce((s, d) => s + d.networkOut, 0),
  }), []);

  const getIcon = (type: string) => typeIcons[type] || Server;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6 text-white">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Network Devices
        </h1>
        <p className="text-gray-400 mt-1">Monitor and manage all network-connected devices</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Total Devices', value: stats.total, icon: Globe, color: 'from-blue-500 to-blue-600' },
          { label: 'Online', value: stats.online, icon: CheckCircle2, color: 'from-green-500 to-green-600' },
          { label: 'Warning', value: stats.warning, icon: AlertTriangle, color: 'from-yellow-500 to-yellow-600' },
          { label: 'Offline', value: stats.offline, icon: XCircle, color: 'from-red-500 to-red-600' },
          { label: 'Traffic In', value: `${(stats.totalIn / 1000).toFixed(1)} GB/s`, icon: Download, color: 'from-cyan-500 to-cyan-600' },
          { label: 'Traffic Out', value: `${(stats.totalOut / 1000).toFixed(1)} GB/s`, icon: Upload, color: 'from-purple-500 to-purple-600' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold">{stat.value}</div>
                  <div className="text-xs text-gray-400">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search devices..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white">
          <option value="all">All Types</option>
          {['server', 'desktop', 'laptop', 'router', 'iot', 'nas', 'printer'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white">
          <option value="all">All Status</option>
          {['online', 'offline', 'warning', 'maintenance'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          {['grid', 'list'].map(v => (
            <button key={v} onClick={() => setView(v as 'grid' | 'list')}
              className={`px-3 py-2 text-sm ${view === v ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}>
              {v === 'grid' ? '▦' : '☰'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device List/Grid */}
        <div className="lg:col-span-2">
          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {filtered.map((device, i) => {
                  const Icon = getIcon(device.type);
                  return (
                    <motion.div key={device.id} initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedDevice(device)}
                      className={`bg-white/5 backdrop-blur-xl rounded-xl border cursor-pointer transition-all hover:bg-white/8 ${
                        selectedDevice?.id === device.id ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-white/10'
                      }`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg">
                              <Icon className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{device.name}</div>
                              <div className="text-xs text-gray-400">{device.ip}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[device.status] }} />
                            <span className="text-xs text-gray-400 capitalize">{device.status}</span>
                          </div>
                        </div>

                        {device.status === 'online' && (
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">CPU</div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{
                                  width: `${device.cpu}%`,
                                  backgroundColor: device.cpu > 80 ? '#ef4444' : device.cpu > 60 ? '#f59e0b' : '#10b981'
                                }} />
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{device.cpu}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Memory</div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{
                                  width: `${device.memory}%`,
                                  backgroundColor: device.memory > 85 ? '#ef4444' : device.memory > 70 ? '#f59e0b' : '#10b981'
                                }} />
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{device.memory}%</div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{device.networkIn} MB/s</span>
                            <span className="flex items-center gap-1"><Upload className="w-3 h-3" />{device.networkOut} MB/s</span>
                          </div>
                          <span className="text-xs text-gray-500">{device.os}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Device', 'IP', 'Status', 'CPU', 'Memory', 'Network', 'OS'].map(h => (
                      <th key={h} className="text-left text-xs text-gray-400 font-medium p-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(device => {
                    const Icon = getIcon(device.type);
                    return (
                      <tr key={device.id} onClick={() => setSelectedDevice(device)}
                        className={`border-b border-white/5 cursor-pointer hover:bg-white/5 ${
                          selectedDevice?.id === device.id ? 'bg-cyan-500/5' : ''
                        }`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-cyan-400" />
                            <span className="font-medium">{device.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-gray-400 font-mono text-xs">{device.ip}</td>
                        <td className="p-3">
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[device.status] }} />
                            <span className="text-xs capitalize">{device.status}</span>
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">{device.cpu > 0 ? `${device.cpu}%` : '-'}</td>
                        <td className="p-3 text-gray-400">{device.memory > 0 ? `${device.memory}%` : '-'}</td>
                        <td className="p-3 text-gray-400 text-xs">{device.networkIn > 0 ? `↓${device.networkIn} ↑${device.networkOut}` : '-'}</td>
                        <td className="p-3 text-gray-400 text-xs">{device.os}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        <div className="space-y-4">
          {selectedDevice ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-5">
              <div className="flex items-center gap-3 mb-4">
                {React.createElement(getIcon(selectedDevice.type), { className: 'w-6 h-6 text-cyan-400' })}
                <div>
                  <h3 className="font-bold text-lg">{selectedDevice.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[selectedDevice.status] }} />
                    <span className="text-sm text-gray-400 capitalize">{selectedDevice.status}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  ['IP Address', selectedDevice.ip],
                  ['MAC', selectedDevice.mac],
                  ['OS', selectedDevice.os],
                  ['Vendor', selectedDevice.vendor],
                  ['Location', selectedDevice.location],
                  ['Uptime', selectedDevice.uptime],
                  ['Last Seen', selectedDevice.lastSeen],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-mono text-xs">{value}</span>
                  </div>
                ))}
              </div>

              {selectedDevice.services.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-gray-400 mb-2">Services</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedDevice.services.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDevice.openPorts.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-2">Open Ports</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedDevice.openPorts.map(p => (
                      <span key={p} className="px-2 py-0.5 bg-white/5 text-gray-300 rounded text-xs font-mono">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button className="flex-1 px-3 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/20 transition-colors">
                  Terminal
                </button>
                <button className="flex-1 px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors">
                  Details
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center text-gray-500">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a device to view details</p>
            </div>
          )}

          {/* Traffic Chart */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Network Traffic (24h)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="inbound" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} />
                <Area type="monotone" dataKey="outbound" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Protocol Distribution */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Protocol Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={protocolData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {protocolData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
