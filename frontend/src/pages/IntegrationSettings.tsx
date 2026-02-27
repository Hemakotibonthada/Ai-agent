import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug, Plus, Power, Settings, Trash2, ExternalLink,
  Search, Filter, Check, X, RefreshCw, Code, Globe,
  Shield, Zap, Database, Clock, AlertCircle, MoreVertical,
  ChevronRight, Star, Download, Upload, Lock, Unlock,
  ArrowUpRight, Activity, ToggleLeft, ToggleRight, Edit,
  Terminal, MessageSquare, Brain, Home, Heart
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FadeIn } from '../lib/animations';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: string;
  events: number;
  version: string;
  config: Record<string, string>;
}

const integrations: Integration[] = [
  { id: '1', name: 'MQTT Broker', description: 'Mosquitto MQTT broker for IoT device communication',
    category: 'IoT', icon: '📡', status: 'connected', lastSync: '2 min ago', events: 15420, version: '2.0.18', config: { host: 'localhost', port: '1883', topic: 'nexus/#' } },
  { id: '2', name: 'PostgreSQL', description: 'Primary database for persistent storage',
    category: 'Database', icon: '🐘', status: 'connected', lastSync: '1 min ago', events: 89340, version: '16.1', config: { host: 'localhost', port: '5432', database: 'nexus_ai' } },
  { id: '3', name: 'Redis Cache', description: 'In-memory cache for sessions and real-time data',
    category: 'Database', icon: '🔴', status: 'connected', lastSync: 'Just now', events: 234560, version: '7.2.3', config: { host: 'localhost', port: '6379', db: '0' } },
  { id: '4', name: 'OpenWeather API', description: 'Weather data for location-based automations',
    category: 'API', icon: '🌤️', status: 'connected', lastSync: '30 min ago', events: 2340, version: '3.0', config: { endpoint: 'api.openweathermap.org', key: '***' } },
  { id: '5', name: 'Telegram Bot', description: 'Send notifications and receive commands via Telegram',
    category: 'Communication', icon: '📱', status: 'disconnected', events: 890, version: '6.9', config: { token: '***', chat_id: '***' } },
  { id: '6', name: 'GitHub', description: 'Repository monitoring and webhook integration',
    category: 'Development', icon: '🐙', status: 'connected', lastSync: '15 min ago', events: 1230, version: 'v4', config: { org: 'nexus-ai', webhook: 'enabled' } },
  { id: '7', name: 'Zigbee Gateway', description: 'Zigbee2MQTT bridge for smart home devices',
    category: 'IoT', icon: '📶', status: 'error', lastSync: '2 hours ago', events: 4560, version: '1.34.0', config: { adapter: '/dev/ttyUSB0', channel: '11' } },
  { id: '8', name: 'Slack Webhook', description: 'Post alerts and reports to Slack channels',
    category: 'Communication', icon: '💬', status: 'connected', lastSync: '5 min ago', events: 670, version: 'v2', config: { workspace: 'nexus-team', channel: '#alerts' } },
  { id: '9', name: 'Prometheus', description: 'Metrics collection and monitoring',
    category: 'Monitoring', icon: '📊', status: 'connected', lastSync: '10s ago', events: 456780, version: '2.48', config: { port: '9090', retention: '15d' } },
  { id: '10', name: 'Grafana', description: 'Dashboards and visualization for metrics',
    category: 'Monitoring', icon: '📈', status: 'pending', events: 0, version: '10.2', config: { port: '3000', auth: 'OAuth2' } },
  { id: '11', name: 'ESP32 Firmware OTA', description: 'Over-the-air firmware updates for ESP32 nodes',
    category: 'IoT', icon: '🔧', status: 'connected', lastSync: '1 day ago', events: 45, version: '1.2.0', config: { devices: '12', update_channel: 'stable' } },
  { id: '12', name: 'S3 Storage', description: 'Object storage for backups and media files',
    category: 'Storage', icon: '☁️', status: 'connected', lastSync: '1 hour ago', events: 890, version: 'v4', config: { bucket: 'nexus-backups', region: 'us-east-1' } },
];

const statusConfig = {
  connected: { color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', label: 'Connected', dot: 'bg-green-500' },
  disconnected: { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10', label: 'Disconnected', dot: 'bg-gray-400' },
  error: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', label: 'Error', dot: 'bg-red-500' },
  pending: { color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10', label: 'Pending', dot: 'bg-yellow-500' },
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const IntegrationSettings: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [localIntegrations, setLocalIntegrations] = useState(integrations);

  const categories = [...new Set(integrations.map(i => i.category))];

  const filtered = useMemo(() =>
    localIntegrations.filter(i =>
      (categoryFilter === 'all' || i.category === categoryFilter) &&
      (statusFilter === 'all' || i.status === statusFilter) &&
      (search === '' || i.name.toLowerCase().includes(search.toLowerCase()))
    ),
  [localIntegrations, categoryFilter, statusFilter, search]);

  const categoryData = categories.map(cat => ({
    name: cat,
    count: localIntegrations.filter(i => i.category === cat).length,
  }));

  const statusData = Object.entries(
    localIntegrations.reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const totalEvents = localIntegrations.reduce((sum, i) => sum + i.events, 0);

  const toggleStatus = (id: string) => {
    setLocalIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, status: i.status === 'connected' ? 'disconnected' : 'connected' } : i
    ));
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Plug className="text-blue-500" size={32} />
              Integrations
            </h1>
            <p className="text-gray-500 mt-1">Manage external services and device connections</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">
            <Plus size={14} /> Add Integration
          </motion.button>
        </div>
      </FadeIn>

      {/* Stats */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: localIntegrations.length, color: 'text-blue-500', icon: <Plug size={16} /> },
            { label: 'Connected', value: localIntegrations.filter(i => i.status === 'connected').length, color: 'text-green-500', icon: <Check size={16} /> },
            { label: 'Errors', value: localIntegrations.filter(i => i.status === 'error').length, color: 'text-red-500', icon: <AlertCircle size={16} /> },
            { label: 'Total Events', value: totalEvents.toLocaleString(), color: 'text-purple-500', icon: <Activity size={16} /> },
          ].map(stat => (
            <motion.div key={stat.label} whileHover={{ y: -4 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <FadeIn delay={0.1}>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search integrations..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
                <option value="all">All Status</option>
                <option value="connected">Connected</option>
                <option value="disconnected">Disconnected</option>
                <option value="error">Error</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </FadeIn>

          {/* Integration Cards */}
          <FadeIn delay={0.15}>
            <div className="space-y-3">
              {filtered.map(integration => {
                const sc = statusConfig[integration.status];
                return (
                  <motion.div key={integration.id} whileHover={{ x: 4 }}
                    onClick={() => setSelectedIntegration(selectedIntegration?.id === integration.id ? null : integration)}
                    className={`bg-white dark:bg-gray-800 rounded-xl p-4 border transition-colors cursor-pointer ${
                      selectedIntegration?.id === integration.id
                        ? 'border-blue-300 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}>
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">{integration.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{integration.name}</h3>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.color}`}>
                            {sc.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-500">
                            {integration.category}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{integration.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                          <span>v{integration.version}</span>
                          {integration.lastSync && <span className="flex items-center gap-0.5"><Clock size={9} /> {integration.lastSync}</span>}
                          <span>{integration.events.toLocaleString()} events</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleStatus(integration.id); }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            integration.status === 'connected' ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}>
                          {integration.status === 'connected' ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                        <ChevronRight size={14} className="text-gray-400" />
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {selectedIntegration?.id === integration.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Configuration</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(integration.config).map(([key, value]) => (
                                <div key={key} className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                  <div className="text-[10px] text-gray-500 uppercase">{key}</div>
                                  <div className="text-xs font-mono text-gray-900 dark:text-white">{value}</div>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium flex items-center gap-1">
                                <Settings size={12} /> Configure
                              </button>
                              <button className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium flex items-center gap-1">
                                <RefreshCw size={12} /> Sync
                              </button>
                              <button className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium flex items-center gap-1">
                                <Terminal size={12} /> Test
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </FadeIn>
        </div>

        {/* Sidebar Charts */}
        <div className="space-y-4">
          <FadeIn delay={0.2}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">By Category</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={categoryData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>

          <FadeIn delay={0.25}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Status Distribution</h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Links</h3>
              <div className="space-y-2">
                {[
                  { label: 'API Documentation', icon: <Code size={14} /> },
                  { label: 'Webhook Manager', icon: <Globe size={14} /> },
                  { label: 'Connection Logs', icon: <Terminal size={14} /> },
                  { label: 'Security Settings', icon: <Shield size={14} /> },
                ].map(link => (
                  <button key={link.label}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors">
                    <span className="text-blue-500">{link.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{link.label}</span>
                    <ExternalLink size={12} className="ml-auto text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
