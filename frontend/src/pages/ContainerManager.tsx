import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container, Play, Square, RefreshCw, Trash2, Search, Plus, MoreVertical,
  Server, HardDrive, Network, Layers, Clock, Cpu, MemoryStick, Activity,
  ChevronRight, ChevronDown, Download, Upload, AlertCircle, Check, X,
  Terminal, Eye, Pause, SkipForward, Settings, Loader, Database, Globe
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface ContainerItem { id: string; name: string; image: string; status: string; cpu_percent: number; memory_mb: number; memory_limit_mb: number; uptime: string; ports: string; network: string; }
interface ContainerImage { id: string; name: string; tag: string; size_mb: number; created: string; }
interface DockerNetwork { id: string; name: string; driver: string; containers_count: number; subnet: string; }
interface DockerVolume { id: string; name: string; driver: string; size_mb: number; mount_point: string; used_by: number; }

type TabType = 'containers' | 'images' | 'networks' | 'volumes' | 'compose';

const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  running: { color: 'text-green-400', bg: 'bg-green-500/20', icon: <Play className="w-3 h-3" /> },
  stopped: { color: 'text-red-400', bg: 'bg-red-500/20', icon: <Square className="w-3 h-3" /> },
  paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <Pause className="w-3 h-3" /> },
  restarting: { color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <RefreshCw className="w-3 h-3" /> },
  created: { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: <Plus className="w-3 h-3" /> },
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

export default function ContainerManager() {
  const isDemo = useIsDemoAccount();
  const [activeTab, setActiveTab] = useState<TabType>('containers');
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [images, setImages] = useState<ContainerImage[]>([]);
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setContainers([
        { id: 'c1', name: 'nexus-core', image: 'nexus-ai/core:latest', status: 'running', cpu_percent: 23.5, memory_mb: 512, memory_limit_mb: 2048, uptime: '3d 14h', ports: '8000:8000', network: 'nexus-net' },
        { id: 'c2', name: 'nexus-frontend', image: 'nexus-ai/frontend:latest', status: 'running', cpu_percent: 8.2, memory_mb: 256, memory_limit_mb: 1024, uptime: '3d 14h', ports: '3000:3000', network: 'nexus-net' },
        { id: 'c3', name: 'nexus-db', image: 'postgres:16-alpine', status: 'running', cpu_percent: 4.1, memory_mb: 384, memory_limit_mb: 1024, uptime: '7d 2h', ports: '5432:5432', network: 'nexus-net' },
        { id: 'c4', name: 'nexus-redis', image: 'redis:7-alpine', status: 'running', cpu_percent: 1.8, memory_mb: 64, memory_limit_mb: 256, uptime: '7d 2h', ports: '6379:6379', network: 'nexus-net' },
        { id: 'c5', name: 'nexus-ml-worker', image: 'nexus-ai/ml:latest', status: 'running', cpu_percent: 67.3, memory_mb: 4096, memory_limit_mb: 8192, uptime: '1d 6h', ports: '8001:8001', network: 'nexus-net' },
        { id: 'c6', name: 'nexus-rabbitmq', image: 'rabbitmq:3-management', status: 'running', cpu_percent: 5.4, memory_mb: 192, memory_limit_mb: 512, uptime: '7d 2h', ports: '5672:5672, 15672:15672', network: 'nexus-net' },
        { id: 'c7', name: 'nexus-grafana', image: 'grafana/grafana:latest', status: 'stopped', cpu_percent: 0, memory_mb: 0, memory_limit_mb: 512, uptime: '-', ports: '3001:3000', network: 'monitoring' },
        { id: 'c8', name: 'nexus-prometheus', image: 'prom/prometheus:latest', status: 'paused', cpu_percent: 0, memory_mb: 128, memory_limit_mb: 512, uptime: '5d 8h', ports: '9090:9090', network: 'monitoring' },
      ]);
      setImages([
        { id: 'img1', name: 'nexus-ai/core', tag: 'latest', size_mb: 856, created: '2025-01-15' },
        { id: 'img2', name: 'nexus-ai/frontend', tag: 'latest', size_mb: 342, created: '2025-01-15' },
        { id: 'img3', name: 'nexus-ai/ml', tag: 'latest', size_mb: 2340, created: '2025-01-14' },
        { id: 'img4', name: 'postgres', tag: '16-alpine', size_mb: 232, created: '2025-01-01' },
        { id: 'img5', name: 'redis', tag: '7-alpine', size_mb: 28, created: '2025-01-01' },
        { id: 'img6', name: 'rabbitmq', tag: '3-management', size_mb: 185, created: '2024-12-15' },
        { id: 'img7', name: 'grafana/grafana', tag: 'latest', size_mb: 415, created: '2025-01-10' },
        { id: 'img8', name: 'prom/prometheus', tag: 'latest', size_mb: 234, created: '2025-01-08' },
      ]);
      setNetworks([
        { id: 'net1', name: 'nexus-net', driver: 'bridge', containers_count: 6, subnet: '172.20.0.0/16' },
        { id: 'net2', name: 'monitoring', driver: 'bridge', containers_count: 2, subnet: '172.21.0.0/16' },
        { id: 'net3', name: 'bridge', driver: 'bridge', containers_count: 0, subnet: '172.17.0.0/16' },
      ]);
      setVolumes([
        { id: 'vol1', name: 'nexus-data', driver: 'local', size_mb: 5120, mount_point: '/var/lib/nexus/data', used_by: 1 },
        { id: 'vol2', name: 'postgres-data', driver: 'local', size_mb: 2048, mount_point: '/var/lib/postgresql/data', used_by: 1 },
        { id: 'vol3', name: 'redis-data', driver: 'local', size_mb: 128, mount_point: '/data', used_by: 1 },
        { id: 'vol4', name: 'ml-models', driver: 'local', size_mb: 15360, mount_point: '/models', used_by: 1 },
        { id: 'vol5', name: 'grafana-data', driver: 'local', size_mb: 256, mount_point: '/var/lib/grafana', used_by: 1 },
        { id: 'vol6', name: 'rabbitmq-data', driver: 'local', size_mb: 512, mount_point: '/var/lib/rabbitmq', used_by: 1 },
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const totalCpu = useMemo(() => containers.reduce((s, c) => s + c.cpu_percent, 0), [containers]);
  const totalMem = useMemo(() => containers.reduce((s, c) => s + c.memory_mb, 0), [containers]);
  const runningCount = useMemo(() => containers.filter(c => c.status === 'running').length, [containers]);

  const filteredContainers = useMemo(() => containers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.image.toLowerCase().includes(searchQuery.toLowerCase())
  ), [containers, searchQuery]);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'containers', label: 'Containers', icon: <Server className="w-4 h-4" />, count: containers.length },
    { key: 'images', label: 'Images', icon: <Layers className="w-4 h-4" />, count: images.length },
    { key: 'networks', label: 'Networks', icon: <Network className="w-4 h-4" />, count: networks.length },
    { key: 'volumes', label: 'Volumes', icon: <HardDrive className="w-4 h-4" />, count: volumes.length },
    { key: 'compose', label: 'Compose', icon: <Settings className="w-4 h-4" />, count: 1 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-cyan-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-cyan-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.1 }} className="p-3 bg-cyan-500/20 rounded-xl"><Server className="w-7 h-7 text-cyan-400" /></motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Container Manager</h1>
              <p className="text-gray-400 text-sm">Docker container orchestration & monitoring</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> New Container
          </motion.button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Running', value: `${runningCount}/${containers.length}`, icon: <Play className="w-5 h-5" />, color: 'cyan' },
            { label: 'CPU Usage', value: `${totalCpu.toFixed(1)}%`, icon: <Cpu className="w-5 h-5" />, color: 'blue' },
            { label: 'Memory', value: `${(totalMem / 1024).toFixed(1)} GB`, icon: <MemoryStick className="w-5 h-5" />, color: 'purple' },
            { label: 'Images', value: `${images.length}`, icon: <Layers className="w-5 h-5" />, color: 'green' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl`}>
              <div className="flex items-center justify-between">
                <div className={`p-2 bg-${stat.color}-500/20 rounded-lg`}><span className={`text-${stat.color}-400`}>{stat.icon}</span></div>
                <span className="text-2xl font-bold text-white">{stat.value}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {tabs.map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-cyan-500/50' : 'bg-gray-700/50'}`}>{tab.count}</span>
            </motion.button>
          ))}
        </div>

        {/* Search (for containers tab) */}
        {activeTab === 'containers' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Search containers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Containers Tab */}
          {activeTab === 'containers' && (
            <motion.div key="containers" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {filteredContainers.map(container => {
                const cfg = statusConfig[container.status] || statusConfig.created;
                const memPercent = container.memory_limit_mb ? (container.memory_mb / container.memory_limit_mb) * 100 : 0;
                return (
                  <motion.div key={container.id} variants={itemVariants} className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cfg.bg}`}><span className={cfg.color}>{cfg.icon}</span></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{container.name}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>{container.status}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>{container.image}</span>
                            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {container.ports}</span>
                            <span className="flex items-center gap-1"><Network className="w-3 h-3" /> {container.network}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {container.status === 'running' && (
                          <div className="flex items-center gap-6 text-xs">
                            <div className="w-32">
                              <div className="flex justify-between text-gray-500 mb-1"><span>CPU</span><span className="text-cyan-400">{container.cpu_percent}%</span></div>
                              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${container.cpu_percent}%` }} transition={{ duration: 1 }}
                                  className={`h-full rounded-full ${container.cpu_percent > 80 ? 'bg-red-500' : container.cpu_percent > 50 ? 'bg-yellow-500' : 'bg-cyan-500'}`} />
                              </div>
                            </div>
                            <div className="w-32">
                              <div className="flex justify-between text-gray-500 mb-1"><span>MEM</span><span className="text-purple-400">{container.memory_mb}MB</span></div>
                              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${memPercent}%` }} transition={{ duration: 1 }}
                                  className={`h-full rounded-full ${memPercent > 80 ? 'bg-red-500' : memPercent > 50 ? 'bg-yellow-500' : 'bg-purple-500'}`} />
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          {container.status === 'running' && (
                            <>
                              <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors" title="Logs"><Terminal className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors" title="Stop"><Square className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors" title="Restart"><RefreshCw className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                            </>
                          )}
                          {container.status === 'stopped' && (
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors" title="Start"><Play className="w-3.5 h-3.5 text-green-400" /></motion.button>
                          )}
                          {container.status === 'paused' && (
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-blue-500/20 rounded-lg transition-colors" title="Unpause"><SkipForward className="w-3.5 h-3.5 text-blue-400" /></motion.button>
                          )}
                          <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" /></motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <motion.div key="images" variants={containerVariants} initial="hidden" animate="visible" exit="hidden">
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-700/50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left p-4">Image</th><th className="text-left p-4">Tag</th><th className="text-right p-4">Size</th><th className="text-right p-4">Created</th><th className="text-right p-4">Actions</th>
                  </tr></thead>
                  <tbody>
                    {images.map((img, i) => (
                      <motion.tr key={img.id} variants={itemVariants} className="border-b border-gray-700/30 hover:bg-gray-800/50 transition-colors">
                        <td className="p-4"><div className="flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-400" /><span className="text-white text-sm font-medium">{img.name}</span></div></td>
                        <td className="p-4"><code className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-cyan-300">{img.tag}</code></td>
                        <td className="p-4 text-right text-sm text-gray-400">{img.size_mb > 1000 ? `${(img.size_mb / 1024).toFixed(1)} GB` : `${img.size_mb} MB`}</td>
                        <td className="p-4 text-right text-sm text-gray-500">{img.created}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-gray-700/50 rounded-lg"><Play className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Networks Tab */}
          {activeTab === 'networks' && (
            <motion.div key="networks" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-3">
              {networks.map(net => (
                <motion.div key={net.id} variants={itemVariants} className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg"><Network className="w-5 h-5 text-blue-400" /></div>
                      <div>
                        <h3 className="font-semibold text-white">{net.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>Driver: {net.driver}</span>
                          <span>Subnet: {net.subnet}</span>
                          <span>{net.containers_count} containers</span>
                        </div>
                      </div>
                    </div>
                    <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-gray-400" /></motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Volumes Tab */}
          {activeTab === 'volumes' && (
            <motion.div key="volumes" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {volumes.map(vol => (
                <motion.div key={vol.id} variants={itemVariants} className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl hover:border-gray-600 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg"><HardDrive className="w-4 h-4 text-purple-400" /></div>
                      <div>
                        <span className="font-medium text-white text-sm">{vol.name}</span>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{vol.driver}</span>
                          <span className="font-mono">{vol.mount_point}</span>
                          <span>{vol.used_by} container(s)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">{vol.size_mb > 1000 ? `${(vol.size_mb / 1024).toFixed(1)} GB` : `${vol.size_mb} MB`}</span>
                      <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div className="flex justify-end pt-2">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-red-600/50 hover:bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 transition-colors">
                  <Trash2 className="w-4 h-4" /> Prune Unused Volumes
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Compose Tab */}
          {activeTab === 'compose' && (
            <motion.div key="compose" variants={containerVariants} initial="hidden" animate="visible" exit="hidden">
              <div className="p-6 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg"><Settings className="w-5 h-5 text-green-400" /></div>
                    <div>
                      <h3 className="font-semibold text-white">nexus-stack</h3>
                      <p className="text-xs text-gray-500">docker-compose.yml · 8 services · Running</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button whileHover={{ scale: 1.05 }} className="px-3 py-1.5 bg-green-600/50 hover:bg-green-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"><Play className="w-3 h-3" /> Up</motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} className="px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"><Square className="w-3 h-3" /> Down</motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} className="px-3 py-1.5 bg-blue-600/50 hover:bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Restart</motion.button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {containers.slice(0, 8).map(c => {
                    const cfg = statusConfig[c.status] || statusConfig.created;
                    return (
                      <motion.div key={c.id} whileHover={{ scale: 1.02 }} className="p-3 bg-gray-900/50 border border-gray-700/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${c.status === 'running' ? 'bg-green-400' : c.status === 'paused' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                          <span className="text-xs font-medium text-white truncate">{c.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{c.image}</p>
                      </motion.div>
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
