import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Activity,
  Clock, Eye, MousePointerClick, Globe, Zap, ArrowUpRight,
  ArrowDownRight, Filter, Calendar, Download, RefreshCcw,
  PieChart, LineChart, Target, Layers, AlertTriangle, CheckCircle2,
  XCircle, Timer, Cpu, HardDrive, Wifi, BarChart2, Maximize2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart as RechartsLineChart, Line,
  PieChart as RechartsPieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Scatter
} from 'recharts';
import { FadeIn, ScaleIn, StaggerList, StaggerItem } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';
import EmptyState from '@/components/shared/EmptyState';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#10b981', '#06b6d4'];

// ─── Sample data generators ─────────────────────────────────────────
const generateTimeSeriesData = (days = 30) => {
  const data = [];
  const now = Date.now();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pageViews: Math.floor(Math.random() * 5000 + 2000),
      uniqueVisitors: Math.floor(Math.random() * 2000 + 800),
      sessions: Math.floor(Math.random() * 3000 + 1000),
      bounceRate: Math.random() * 30 + 20,
      avgDuration: Math.random() * 300 + 60,
      conversions: Math.floor(Math.random() * 200 + 50),
    });
  }
  return data;
};

const generateAgentPerformance = () => [
  { agent: 'Personal', efficiency: 92, tasks: 145, responseTime: 120, satisfaction: 4.8, uptime: 99.9 },
  { agent: 'Financial', efficiency: 88, tasks: 89, responseTime: 180, satisfaction: 4.6, uptime: 99.5 },
  { agent: 'Health', efficiency: 95, tasks: 112, responseTime: 90, satisfaction: 4.9, uptime: 99.8 },
  { agent: 'Home', efficiency: 91, tasks: 234, responseTime: 50, satisfaction: 4.7, uptime: 99.9 },
  { agent: 'Security', efficiency: 97, tasks: 567, responseTime: 30, satisfaction: 4.9, uptime: 100 },
  { agent: 'Task', efficiency: 90, tasks: 321, responseTime: 100, satisfaction: 4.5, uptime: 99.7 },
  { agent: 'Learning', efficiency: 85, tasks: 78, responseTime: 200, satisfaction: 4.4, uptime: 99.3 },
  { agent: 'Communication', efficiency: 93, tasks: 198, responseTime: 75, satisfaction: 4.7, uptime: 99.8 },
];

const generateCategoryData = () => [
  { name: 'Tasks', value: 35, count: 1247 },
  { name: 'Messages', value: 25, count: 892 },
  { name: 'Automations', value: 20, count: 712 },
  { name: 'Health', value: 10, count: 356 },
  { name: 'Finance', value: 7, count: 249 },
  { name: 'Other', value: 3, count: 107 },
];

const generatePerformanceData = () => [
  { time: '00:00', cpu: 23, memory: 45, network: 12, latency: 45 },
  { time: '04:00', cpu: 15, memory: 42, network: 8, latency: 38 },
  { time: '08:00', cpu: 55, memory: 62, network: 45, latency: 72 },
  { time: '12:00', cpu: 72, memory: 71, network: 67, latency: 95 },
  { time: '16:00', cpu: 68, memory: 68, network: 58, latency: 88 },
  { time: '20:00', cpu: 45, memory: 55, network: 32, latency: 62 },
  { time: '24:00', cpu: 28, memory: 48, network: 15, latency: 48 },
];

const generateHourlyData = () => {
  const data = [];
  for (let h = 0; h < 24; h++) {
    data.push({
      hour: `${h.toString().padStart(2, '0')}:00`,
      requests: Math.floor(Math.random() * 1000 + 200),
      errors: Math.floor(Math.random() * 50),
      latency: Math.floor(Math.random() * 200 + 20),
    });
  }
  return data;
};

// ─── Metric Card ────────────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
  sparkline?: number[];
  delay?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, change, icon, color, suffix = '', sparkline, delay = 0,
}) => {
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }}
      className="bg-nexus-card rounded-2xl p-6 border border-nexus-border relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5 group-hover:opacity-10 transition-opacity">
        <div className={`w-full h-full rounded-full ${color} blur-2xl`} />
      </div>

      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${
          isPositive ? 'text-green-500' : 'text-red-500'
        }`}>
          {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {Math.abs(change)}%
        </div>
      </div>

      <h3 className="text-sm text-nexus-muted mb-1">{title}</h3>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-nexus-text">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {suffix && (
          <span className="text-sm text-nexus-muted mb-1">{suffix}</span>
        )}
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                fill={`url(#spark-${title})`}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
};

// ─── Real-time Indicator ────────────────────────────────────────────
const LiveIndicator = () => (
  <div className="flex items-center gap-2">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
    </span>
    <span className="text-sm text-green-500 font-medium">Live</span>
  </div>
);

// ─── Tab Button ─────────────────────────────────────────────────────
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ active, onClick, children, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
        : 'text-nexus-muted hover:bg-nexus-surface'
    }`}
  >
    {icon}
    {children}
  </button>
);

// ─── Main Analytics Page ────────────────────────────────────────────
const Analytics: React.FC = () => {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No analytics data" description="Analytics will appear here as you use the platform and collect data." /></div>;
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'agents' | 'realtime'>('overview');
  const [timeRange, setTimeRange] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const timeSeriesData = useMemo(() => generateTimeSeriesData(30), []);
  const agentData = useMemo(() => generateAgentPerformance(), []);
  const categoryData = useMemo(() => generateCategoryData(), []);
  const performanceData = useMemo(() => generatePerformanceData(), []);
  const hourlyData = useMemo(() => generateHourlyData(), []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  }, []);

  const sparklines = useMemo(() => ({
    views: Array.from({ length: 20 }, () => Math.random() * 5000 + 2000),
    visitors: Array.from({ length: 20 }, () => Math.random() * 2000 + 800),
    sessions: Array.from({ length: 20 }, () => Math.random() * 3000 + 1000),
    duration: Array.from({ length: 20 }, () => Math.random() * 300 + 60),
  }), []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <BarChart3 className="text-indigo-500" size={32} />
              Analytics Dashboard
            </h1>
            <p className="text-nexus-muted mt-1">
              Comprehensive system analytics and performance metrics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LiveIndicator />

            <div className="flex items-center bg-nexus-surface rounded-lg p-1">
              {['24h', '7d', '30d', '90d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    timeRange === range
                      ? 'bg-white text-nexus-text shadow-sm'
                      : 'text-nexus-muted hover:text-nexus-text dark:hover:text-nexus-muted'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-nexus-surface hover:bg-nexus-surface transition-colors"
            >
              <RefreshCcw size={18} className={`text-nexus-text ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <Download size={16} />
              Export
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Tab Navigation */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<PieChart size={16} />}>Overview</TabButton>
          <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} icon={<Activity size={16} />}>Performance</TabButton>
          <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} icon={<Zap size={16} />}>Agent Analytics</TabButton>
          <TabButton active={activeTab === 'realtime'} onClick={() => setActiveTab('realtime')} icon={<Globe size={16} />}>Real-time</TabButton>
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Page Views" value={47832} change={12.5} color="bg-indigo-500" icon={<Eye size={20} className="text-indigo-500" />} sparkline={sparklines.views} delay={0} />
              <MetricCard title="Unique Visitors" value={12847} change={8.3} color="bg-purple-500" icon={<Users size={20} className="text-purple-500" />} sparkline={sparklines.visitors} delay={0.1} />
              <MetricCard title="Active Sessions" value={3452} change={-2.1} color="bg-blue-500" icon={<Activity size={20} className="text-blue-500" />} sparkline={sparklines.sessions} delay={0.2} />
              <MetricCard title="Avg. Duration" value="4m 32s" change={15.7} color="bg-green-500" icon={<Clock size={20} className="text-green-500" />} sparkline={sparklines.duration} delay={0.3} />
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Traffic Over Time */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 bg-nexus-card rounded-2xl p-6 border border-nexus-border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-nexus-text">Traffic Overview</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-nexus-muted">Page Views</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-nexus-muted">Visitors</span></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <ComposedChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }} />
                    <Area type="monotone" dataKey="pageViews" fill="url(#viewsGradient)" stroke="#6366f1" strokeWidth={2} />
                    <Line type="monotone" dataKey="uniqueVisitors" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Category Distribution */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
                <h3 className="text-lg font-semibold text-nexus-text mb-6">Usage by Category</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
                      {categoryData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-4">
                  {categoryData.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                        <span className="text-nexus-text">{item.name}</span>
                      </div>
                      <span className="font-medium text-nexus-text">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Conversion & Bounce Rate */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
                <h3 className="text-lg font-semibold text-nexus-text mb-4">Conversions</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={timeSeriesData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="conversions" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
                <h3 className="text-lg font-semibold text-nexus-text mb-4">Bounce Rate & Avg. Duration</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={timeSeriesData.slice(-14)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Bar yAxisId="right" dataKey="avgDuration" fill="#8b5cf620" stroke="#8b5cf6" strokeWidth={1} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="bounceRate" stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'performance' && (
          <motion.div key="performance" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="CPU Usage" value="34%" change={-5.2} color="bg-blue-500" icon={<Cpu size={20} className="text-blue-500" />} delay={0} />
              <MetricCard title="Memory Usage" value="62%" change={3.1} color="bg-purple-500" icon={<HardDrive size={20} className="text-purple-500" />} delay={0.1} />
              <MetricCard title="Network I/O" value="1.2 GB" change={8.7} color="bg-cyan-500" icon={<Wifi size={20} className="text-cyan-500" />} delay={0.2} />
              <MetricCard title="Avg Latency" value="45ms" change={-12.3} color="bg-green-500" icon={<Timer size={20} className="text-green-500" />} delay={0.3} />
            </div>

            {/* System Performance Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
              <h3 className="text-lg font-semibold text-nexus-text mb-6">System Performance (24h)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RechartsLineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} />
                  <Line type="monotone" dataKey="memory" name="Memory %" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 4 }} />
                  <Line type="monotone" dataKey="network" name="Network %" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 4 }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Hourly Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
              <h3 className="text-lg font-semibold text-nexus-text mb-6">Hourly Request Volume</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#9ca3af" interval={1} />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="requests" name="Requests" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'agents' && (
          <motion.div key="agents" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            {/* Agent Radar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
                <h3 className="text-lg font-semibold text-nexus-text mb-6">Agent Efficiency Radar</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={agentData}>
                    <PolarGrid stroke="#e5e7eb50" />
                    <PolarAngleAxis dataKey="agent" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="Efficiency" dataKey="efficiency" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    <Radar name="Satisfaction ×20" dataKey="uptime" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
                <h3 className="text-lg font-semibold text-nexus-text mb-6">Tasks Completed by Agent</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={agentData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis dataKey="agent" type="category" width={100} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="tasks" fill="#8b5cf6" radius={[0, 6, 6, 0]}>
                      {agentData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Agent Performance Table */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-nexus-card rounded-2xl border border-nexus-border overflow-hidden">
              <div className="p-6 border-b border-nexus-border">
                <h3 className="text-lg font-semibold text-nexus-text">Agent Performance Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-nexus-surface/50">
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Agent</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Efficiency</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Tasks</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Avg Response</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Satisfaction</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Uptime</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-nexus-muted uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nexus-border">
                    {agentData.map((agent, idx) => (
                      <motion.tr
                        key={agent.agent}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-nexus-surface/60/30 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${COLORS[idx]}20` }}>
                              <Zap size={16} style={{ color: COLORS[idx] }} />
                            </div>
                            <span className="font-medium text-nexus-text">{agent.agent}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-nexus-surface rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${agent.efficiency}%` }}
                                transition={{ delay: idx * 0.1, duration: 0.8 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: COLORS[idx] }}
                              />
                            </div>
                            <span className="text-sm font-medium text-nexus-text">{agent.efficiency}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-nexus-text">{agent.tasks}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-nexus-text">{agent.responseTime}ms</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-yellow-500">★</span>
                            <span className="text-sm text-nexus-text">{agent.satisfaction}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-nexus-text">{agent.uptime}%</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 size={12} className="mr-1" /> Active
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === 'realtime' && (
          <motion.div key="realtime" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Active Users Now" value={342} change={5.2} color="bg-green-500" icon={<Users size={20} className="text-green-500" />} delay={0} />
              <MetricCard title="Requests/sec" value={1247} change={18.3} color="bg-indigo-500" icon={<Activity size={20} className="text-indigo-500" />} delay={0.1} />
              <MetricCard title="Error Rate" value="0.12%" change={-45.0} color="bg-red-500" icon={<AlertTriangle size={20} className="text-red-500" />} delay={0.2} />
            </div>

            {/* Live Activity Feed */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-nexus-text">Live Activity Feed</h3>
                <LiveIndicator />
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Array.from({ length: 15 }, (_, i) => {
                  const activities = [
                    { icon: <CheckCircle2 size={16} className="text-green-500" />, text: 'Task completed: "Review quarterly report"', time: `${i + 1}m ago`, type: 'success' },
                    { icon: <Users size={16} className="text-blue-500" />, text: 'User session started from Chrome/Windows', time: `${i + 2}m ago`, type: 'info' },
                    { icon: <Zap size={16} className="text-purple-500" />, text: 'Agent "Personal" processed voice command', time: `${i + 3}m ago`, type: 'agent' },
                    { icon: <AlertTriangle size={16} className="text-yellow-500" />, text: 'High memory usage detected (78%)', time: `${i + 4}m ago`, type: 'warning' },
                    { icon: <Globe size={16} className="text-cyan-500" />, text: 'API request: GET /api/analytics/dashboard', time: `${i + 5}m ago`, type: 'api' },
                  ];
                  const activity = activities[i % activities.length];

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-nexus-surface/60/30 transition-colors"
                    >
                      <div className="flex-shrink-0">{activity.icon}</div>
                      <span className="flex-1 text-sm text-nexus-text">{activity.text}</span>
                      <span className="text-xs text-nexus-muted whitespace-nowrap">{activity.time}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Analytics;
