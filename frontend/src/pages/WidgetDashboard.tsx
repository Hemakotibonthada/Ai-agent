import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Plus, GripVertical, Maximize2, Minimize2,
  X, Settings, BarChart3, TrendingUp, Activity,
  Cpu, Globe, Clock, Users, Zap, Database,
  ThermometerSun, Wifi, Eye, Lock, RefreshCw,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

interface Widget {
  id: string;
  type: 'line-chart' | 'bar-chart' | 'area-chart' | 'stat-card' | 'pie-chart' | 'radar-chart' | 'activity-feed' | 'gauge';
  title: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  position: { col: number; row: number };
  config: Record<string, any>;
}

const generateTimeSeries = (n: number, base: number, variance: number) =>
  Array.from({ length: n }, (_, i) => ({
    time: `${String(i).padStart(2, '0')}:00`,
    value: base + (Math.random() - 0.5) * variance * 2,
    secondary: base * 0.7 + (Math.random() - 0.5) * variance * 1.5,
  }));

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

const initialWidgets: Widget[] = [
  {
    id: 'w1', type: 'stat-card', title: 'Active Users', size: 'sm', position: { col: 0, row: 0 },
    config: { value: 1284, change: 12.5, icon: 'users', color: '#6366F1' },
  },
  {
    id: 'w2', type: 'stat-card', title: 'CPU Usage', size: 'sm', position: { col: 1, row: 0 },
    config: { value: 67, suffix: '%', change: -3.2, icon: 'cpu', color: '#10B981' },
  },
  {
    id: 'w3', type: 'stat-card', title: 'API Calls', size: 'sm', position: { col: 2, row: 0 },
    config: { value: 45200, change: 8.7, icon: 'globe', color: '#F59E0B' },
  },
  {
    id: 'w4', type: 'stat-card', title: 'Latency', size: 'sm', position: { col: 3, row: 0 },
    config: { value: 42, suffix: 'ms', change: -15.3, icon: 'clock', color: '#3B82F6' },
  },
  {
    id: 'w5', type: 'area-chart', title: 'System Load', size: 'lg', position: { col: 0, row: 1 },
    config: { data: generateTimeSeries(24, 65, 15), color1: '#6366F1', color2: '#10B981' },
  },
  {
    id: 'w6', type: 'bar-chart', title: 'Requests by Endpoint', size: 'md', position: { col: 2, row: 1 },
    config: {
      data: [
        { name: '/api/chat', value: 4500 }, { name: '/api/tasks', value: 3200 },
        { name: '/api/health', value: 2800 }, { name: '/api/agents', value: 2100 },
        { name: '/api/auth', value: 1800 }, { name: '/api/files', value: 1200 },
      ],
    },
  },
  {
    id: 'w7', type: 'pie-chart', title: 'Traffic Sources', size: 'md', position: { col: 0, row: 2 },
    config: {
      data: [
        { name: 'Web App', value: 45 }, { name: 'Mobile', value: 25 },
        { name: 'API', value: 20 }, { name: 'ESP32', value: 10 },
      ],
    },
  },
  {
    id: 'w8', type: 'line-chart', title: 'Memory Usage', size: 'lg', position: { col: 1, row: 2 },
    config: { data: generateTimeSeries(24, 4.2, 1.5), color: '#EC4899', unit: 'GB' },
  },
  {
    id: 'w9', type: 'activity-feed', title: 'Recent Activity', size: 'md', position: { col: 3, row: 2 },
    config: {
      items: [
        { time: '2m ago', text: 'AI Agent completed task analysis', type: 'success' },
        { time: '5m ago', text: 'New user registered via OAuth', type: 'info' },
        { time: '12m ago', text: 'Database backup completed', type: 'success' },
        { time: '15m ago', text: 'Rate limit exceeded for IP 10.0.0.5', type: 'warning' },
        { time: '23m ago', text: 'Cache invalidation triggered', type: 'info' },
        { time: '30m ago', text: 'ESP32 sensor offline: Garage', type: 'error' },
        { time: '45m ago', text: 'Model fine-tuning batch finished', type: 'success' },
        { time: '1h ago', text: 'SSL certificate renewed', type: 'info' },
      ],
    },
  },
  {
    id: 'w10', type: 'radar-chart', title: 'System Health', size: 'md', position: { col: 0, row: 3 },
    config: {
      data: [
        { metric: 'CPU', value: 72, max: 100 }, { metric: 'Memory', value: 58, max: 100 },
        { metric: 'Disk', value: 45, max: 100 }, { metric: 'Network', value: 85, max: 100 },
        { metric: 'GPU', value: 30, max: 100 }, { metric: 'IO', value: 62, max: 100 },
      ],
    },
  },
  {
    id: 'w11', type: 'gauge', title: 'Uptime', size: 'sm', position: { col: 2, row: 3 },
    config: { value: 99.97, max: 100, color: '#10B981', suffix: '%' },
  },
  {
    id: 'w12', type: 'gauge', title: 'Error Rate', size: 'sm', position: { col: 3, row: 3 },
    config: { value: 0.3, max: 5, color: '#EF4444', suffix: '%' },
  },
];

const iconMap: Record<string, React.ReactNode> = {
  users: <Users size={18} />, cpu: <Cpu size={18} />, globe: <Globe size={18} />,
  clock: <Clock size={18} />, zap: <Zap size={18} />, database: <Database size={18} />,
};

function StatCardWidget({ config }: { config: Record<string, any> }) {
  const isPositive = config.change > 0;
  return (
    <div className="flex items-center gap-4 h-full">
      <div className="p-3 rounded-xl" style={{ backgroundColor: `${config.color}15` }}>
        <span style={{ color: config.color }}>{iconMap[config.icon] || <Zap size={18} />}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-nexus-text">
          {typeof config.value === 'number' && config.value > 9999 ? `${(config.value / 1000).toFixed(1)}k` : config.value}
          {config.suffix && <span className="text-sm font-normal text-nexus-muted ml-1">{config.suffix}</span>}
        </p>
        <p className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(config.change)}%
        </p>
      </div>
    </div>
  );
}

function renderWidget(widget: Widget) {
  const cfg = widget.config;
  switch (widget.type) {
    case 'stat-card': return <StatCardWidget config={cfg} />;
    case 'area-chart': return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={cfg.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
          <Area type="monotone" dataKey="value" stroke={cfg.color1} fill={cfg.color1} fillOpacity={0.1} />
          <Area type="monotone" dataKey="secondary" stroke={cfg.color2} fill={cfg.color2} fillOpacity={0.05} />
        </AreaChart>
      </ResponsiveContainer>
    );
    case 'bar-chart': return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={cfg.data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
          <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
    case 'line-chart': return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={cfg.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
          <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
          <Line type="monotone" dataKey="value" stroke={cfg.color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
    case 'pie-chart': return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={cfg.data} cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={3} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {cfg.data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
        </PieChart>
      </ResponsiveContainer>
    );
    case 'radar-chart': return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={cfg.data} cx="50%" cy="50%">
          <PolarGrid stroke="#2E2E45" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 8 }} domain={[0, 100]} />
          <Radar name="Value" dataKey="value" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} />
        </RadarChart>
      </ResponsiveContainer>
    );
    case 'gauge': {
      const pct = (cfg.value / cfg.max) * 100;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#2E2E45" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={cfg.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${pct * 2.51} 251`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-nexus-text">{cfg.value}{cfg.suffix}</span>
            </div>
          </div>
        </div>
      );
    }
    case 'activity-feed': return (
      <div className="space-y-2 overflow-y-auto max-h-full">
        {cfg.items.map((item: any, i: number) => (
          <div key={i} className="flex gap-3 items-start text-xs">
            <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${item.type === 'success' ? 'bg-green-400' : item.type === 'error' ? 'bg-red-400' : item.type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-nexus-text truncate">{item.text}</p>
              <p className="text-[10px] text-nexus-muted">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    );
    default: return <div className="text-nexus-muted text-sm">Unknown widget</div>;
  }
}

const sizeClasses = {
  sm: 'col-span-1',
  md: 'col-span-1 lg:col-span-2',
  lg: 'col-span-2 lg:col-span-2',
  xl: 'col-span-2 lg:col-span-4',
};

const heightClasses = {
  sm: 'h-32',
  md: 'h-64',
  lg: 'h-64',
  xl: 'h-80',
};

export default function WidgetDashboard() {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [editMode, setEditMode] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><LayoutGrid className="text-nexus-primary" /> Widget Dashboard</h1>
          <p className="text-sm text-nexus-muted mt-1">{widgets.length} widgets · Customizable layout</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditMode(!editMode)} className={`px-4 py-2 text-xs rounded-xl flex items-center gap-2 ${editMode ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
            <Settings size={14} /> {editMode ? 'Done' : 'Edit'}
          </button>
          <button onClick={() => setWidgets(initialWidgets)} className="px-4 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-muted flex items-center gap-2">
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.map((w, i) => (
          <motion.div
            key={w.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className={`glass rounded-2xl border ${selectedWidget === w.id ? 'border-nexus-primary/50' : 'border-nexus-border/30'} ${sizeClasses[w.size]} ${heightClasses[w.size]} p-4 relative group ${editMode ? 'cursor-move' : ''}`}
            onClick={() => editMode && setSelectedWidget(selectedWidget === w.id ? null : w.id)}
          >
            {/* Widget header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-nexus-text">{w.title}</h3>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {editMode && (
                  <>
                    <button className="p-1 rounded hover:bg-nexus-surface"><GripVertical size={10} className="text-nexus-muted" /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeWidget(w.id); }} className="p-1 rounded hover:bg-red-500/10"><X size={10} className="text-red-400" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Widget content */}
            <div className={w.type === 'stat-card' ? 'h-16' : 'h-[calc(100%-30px)]'}>
              {renderWidget(w)}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
