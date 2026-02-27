/* ===================================================================
   Nexus AI OS — Dashboard Page
   Main overview with system health, quick actions, activity & charts
   =================================================================== */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Mic,
  ListTodo,
  Mail,
  Home,
  FileText,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Activity,
  Zap,
  Droplets,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Brain,
  Bot,
  Clock,
  Calendar,
  DollarSign,
  Heart,
  Smile,
  Meh,
  Frown,
  Sun,
  Moon,
  CloudSun,
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  GraduationCap,
  Gauge,
  Target,
  Network,
  Timer,
  Database,
  GitBranch,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import StatusIndicator from '@/components/shared/StatusIndicator';
import useStore from '@/lib/store';
import { systemApi, agentsApi } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

/* ------------------------------------------------------------------ */
/*  Greeting helper                                                    */
/* ------------------------------------------------------------------ */
function getGreeting(): { text: string; icon: React.ReactNode } {
  const h = new Date().getHours();
  if (h < 6) return { text: 'Good Night', icon: <Moon className="text-indigo-400" size={28} /> };
  if (h < 12) return { text: 'Good Morning', icon: <Sun className="text-amber-400" size={28} /> };
  if (h < 18) return { text: 'Good Afternoon', icon: <CloudSun className="text-orange-400" size={28} /> };
  return { text: 'Good Evening', icon: <Moon className="text-violet-400" size={28} /> };
}

/* ------------------------------------------------------------------ */
/*  Mock data helpers                                                  */
/* ------------------------------------------------------------------ */
const resourceHistory = Array.from({ length: 12 }, (_, i) => ({
  time: `${String((i + 1) * 2).padStart(2, '0')}:00`,
  cpu: 25 + Math.random() * 40,
  ram: 40 + Math.random() * 30,
  net: 5 + Math.random() * 15,
}));

const taskTrend = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => ({
  day: d,
  completed: Math.floor(3 + Math.random() * 8),
  created: Math.floor(2 + Math.random() * 6),
}));

const heatmap = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 24 }, (__, h) => ({
    day: d,
    hour: h,
    value: Math.random(),
  })),
).flat();

const activityLog = [
  { id: '1', text: 'Task "Deploy v2.1" completed', agent: 'Task Agent', time: '2 min ago', type: 'success' as const },
  { id: '2', text: 'New email from engineering team', agent: 'Communication Agent', time: '8 min ago', type: 'info' as const },
  { id: '3', text: 'Living room light turned off', agent: 'Home Agent', time: '15 min ago', type: 'neutral' as const },
  { id: '4', text: 'Budget alert: Food category at 85%', agent: 'Financial Agent', time: '32 min ago', type: 'warning' as const },
  { id: '5', text: 'Afternoon mood logged: 4/5', agent: 'Health Agent', time: '1 hr ago', type: 'success' as const },
  { id: '6', text: 'Security scan completed', agent: 'Security Agent', time: '2 hr ago', type: 'success' as const },
];

/* -- New mock data -- */

// Model performance over time
const modelPerf = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
  nexus7b: 88 + Math.random() * 7,
  visionCnn: 86 + Math.random() * 8,
  voiceTransformer: 90 + Math.random() * 6,
  sentimentBert: 83 + Math.random() * 9,
  anomalyDetector: 92 + Math.random() * 5,
  recommendation: 80 + Math.random() * 10,
}));

// Agent radar data
const agentRadar = [
  { metric: 'Speed', orchestrator: 90, personal: 85, security: 95, task: 88, home: 82 },
  { metric: 'Accuracy', orchestrator: 92, personal: 88, security: 94, task: 86, home: 90 },
  { metric: 'Reliability', orchestrator: 95, personal: 90, security: 97, task: 91, home: 93 },
  { metric: 'Throughput', orchestrator: 88, personal: 82, security: 90, task: 85, home: 80 },
  { metric: 'Efficiency', orchestrator: 91, personal: 87, security: 93, task: 89, home: 85 },
];

// Agent response times
const agentResponseTimes = [
  { agent: 'Security', time: 12 },
  { agent: 'Orchestrator', time: 18 },
  { agent: 'Task', time: 22 },
  { agent: 'Home', time: 28 },
  { agent: 'Personal', time: 35 },
  { agent: 'Voice', time: 42 },
  { agent: 'Finance', time: 48 },
  { agent: 'Health', time: 55 },
].sort((a, b) => a.time - b.time);

// Sparkline data for inference metrics
const genSparkline = (base: number, variance: number) =>
  Array.from({ length: 12 }, () => ({ v: base + (Math.random() - 0.5) * variance }));

// Training progress data
const trainingJobs = [
  { name: 'Nexus-7B Fine-tuning', progress: 78, eta: '2h 14m', status: 'running' },
  { name: 'Vision-CNN Retraining', progress: 45, eta: '5h 30m', status: 'running' },
  { name: 'Voice Model Update', progress: 92, eta: '18m', status: 'completing' },
];

// Pipeline flow
const pipelineStages = [
  { stage: 'Raw Data', count: 125000, rate: 100, color: '#3B82F6' },
  { stage: 'Preprocessed', count: 118750, rate: 95, color: '#8B5CF6' },
  { stage: 'Embedded', count: 113000, rate: 90.4, color: '#06B6D4' },
  { stage: 'Inference', count: 110000, rate: 88, color: '#10B981' },
  { stage: 'Response', count: 108900, rate: 87.1, color: '#F59E0B' },
];

// Inference metric cards data
const inferenceMetrics = [
  {
    label: 'Avg Latency',
    value: '23ms',
    sparkline: genSparkline(23, 8),
    trend: 'down' as const,
    trendValue: '-4%',
    icon: Timer,
    color: '#3B82F6',
  },
  {
    label: 'Requests/min',
    value: '847',
    sparkline: genSparkline(847, 120),
    trend: 'up' as const,
    trendValue: '+12%',
    icon: Activity,
    color: '#8B5CF6',
  },
  {
    label: 'Token/sec',
    value: '1,240',
    sparkline: genSparkline(1240, 200),
    trend: 'up' as const,
    trendValue: '+8%',
    icon: Zap,
    color: '#06B6D4',
  },
  {
    label: 'Cache Hit',
    value: '94%',
    sparkline: genSparkline(94, 6),
    trend: 'up' as const,
    trendValue: '+2%',
    icon: Database,
    color: '#10B981',
  },
];

const radarColors = [
  { key: 'orchestrator', name: 'Orchestrator', color: '#3B82F6' },
  { key: 'personal', name: 'Personal', color: '#8B5CF6' },
  { key: 'security', name: 'Security', color: '#06B6D4' },
  { key: 'task', name: 'Task', color: '#10B981' },
  { key: 'home', name: 'Home', color: '#F59E0B' },
];

const responseBarColors = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#EF4444', '#F97316'];

/* ------------------------------------------------------------------ */
/*  Tooltip style constant                                             */
/* ------------------------------------------------------------------ */
const tooltipStyle = {
  backgroundColor: '#1E1E2E',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
};

/* ------------------------------------------------------------------ */
/*  Circular Gauge Component                                           */
/* ------------------------------------------------------------------ */
function SystemGauge({
  label,
  value,
  icon: Icon,
  color,
  unit = '%',
  maxValue = 100,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  unit?: string;
  maxValue?: number;
}) {
  const size = 80;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const fillRatio = Math.min(1, value / maxValue);

  return (
    <motion.div
      variants={item}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="fill-none stroke-nexus-border/30"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            className="fill-none"
            stroke={color}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - fillRatio) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <Icon size={16} style={{ color }} />
          <span className="text-xs font-bold text-nexus-text mt-0.5">
            <AnimatedNumber value={value} format="none" className="text-xs" />
            {unit}
          </span>
        </div>
      </div>
      <span className="text-[11px] text-nexus-muted font-medium uppercase tracking-wider">{label}</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Action Card                                                  */
/* ------------------------------------------------------------------ */
const quickActions = [
  { label: 'Chat', icon: MessageSquare, color: '#3B82F6', path: '/chat' },
  { label: 'Voice', icon: Mic, color: '#8B5CF6', path: '/voice' },
  { label: 'Tasks', icon: ListTodo, color: '#06B6D4', path: '/tasks' },
  { label: 'Email', icon: Mail, color: '#F59E0B', path: '/chat' },
  { label: 'Home', icon: Home, color: '#10B981', path: '/home' },
  { label: 'Reports', icon: FileText, color: '#EC4899', path: '/reports' },
];

/* ------------------------------------------------------------------ */
/*  Weekly Heatmap                                                     */
/* ------------------------------------------------------------------ */
function WeeklyHeatmap() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 min-w-[340px]">
        {days.map((day, d) => (
          <div key={day} className="flex flex-col gap-0.5 items-center">
            <span className="text-[9px] text-nexus-muted mb-1">{day}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const entry = heatmap.find((e) => e.day === d && e.hour === h);
              const v = entry?.value ?? 0;
              const opacity = 0.1 + v * 0.9;
              return (
                <div
                  key={h}
                  className="w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: `rgba(59,130,246,${opacity})`,
                  }}
                  title={`${day} ${String(h).padStart(2, '0')}:00 — ${Math.round(v * 100)}%`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const { resources, agents, setResources, setAgents, setCurrentPage } = useStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const greeting = useMemo(() => getGreeting(), []);

  /* Fetch on mount */
  useEffect(() => {
    setCurrentPage('/');
    let mounted = true;

    async function load() {
      try {
        const [res, ags] = await Promise.allSettled([
          systemApi.resources(),
          agentsApi.list(),
        ]);
        if (!mounted) return;
        if (res.status === 'fulfilled') setResources(res.value);
        if (ags.status === 'fulfilled') setAgents(ags.value);
      } catch {
        /* silent */
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setCurrentPage, setResources, setAgents]);

  const cpu = resources?.cpu_percent ?? 32;
  const ram = resources
    ? Math.round(resources.memory_percent ?? ((resources.memory_used_gb / resources.memory_total_gb) * 100))
    : 58;
  const disk = resources
    ? Math.round(resources.disk_percent ?? ((resources.disk_used_gb / resources.disk_total_gb) * 100))
    : 44;
  const netMbps = resources?.network_speed_mbps
    ? Math.round(resources.network_speed_mbps)
    : 0;
  const linkSpeed = resources?.network_link_speed_mbps ?? 1000;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* -- Greeting -- */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-nexus-border bg-gradient-to-br from-nexus-primary/10 via-nexus-surface to-nexus-secondary/10 p-6"
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-nexus-primary/5 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-nexus-secondary/5 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            {greeting.icon}
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-nexus-text">
              {greeting.text},{' '}
              <span className="gradient-text">Nexus User</span>
            </h1>
            <p className="text-sm text-nexus-muted mt-0.5">
              <Sparkles size={14} className="inline mr-1 text-nexus-accent" />
              Your AI agents are running smoothly. Here's your overview.
            </p>
          </div>
        </div>
      </motion.div>

      {/* -- System Health Gauges -- */}
      <motion.div variants={item}>
        <Card
          variant="glow"
          header={
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/settings')}>
              <Activity size={16} className="text-nexus-primary" />
              <span>System Health</span>
              <ChevronRight size={14} className="ml-auto text-nexus-muted" />
            </div>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 justify-items-center">
            <SystemGauge label="CPU" value={cpu} icon={Cpu} color="#3B82F6" />
            <SystemGauge label="RAM" value={ram} icon={MemoryStick} color="#8B5CF6" />
            <SystemGauge label="Disk" value={disk} icon={HardDrive} color="#06B6D4" />
            <SystemGauge label="Wifi" value={netMbps} icon={Wifi} color="#10B981" unit=" Mb" maxValue={linkSpeed} />
          </div>
        </Card>
      </motion.div>

      {/* -- Quick Actions -- */}
      <motion.div variants={item}>
        <h2 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map((a) => (
            <motion.button
              key={a.label}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(a.path)}
              className="flex flex-col items-center gap-2 rounded-xl border border-nexus-border bg-nexus-card/60 backdrop-blur-sm p-4 transition-shadow hover:shadow-nexus"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${a.color}20`, color: a.color }}
              >
                <a.icon size={20} />
              </span>
              <span className="text-xs font-medium text-nexus-text">{a.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* -- Middle row: Activity Timeline + Mini Widgets -- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/agents')}>
                <Clock size={16} className="text-nexus-accent" />
                <span>Recent Activity</span>
                <ChevronRight size={14} className="ml-auto text-nexus-muted" />
              </div>
            }
          >
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              <AnimatePresence>
                {activityLog.map((a, i) => {
                  const agentRoute: Record<string, string> = {
                    'Task Agent': '/tasks', 'Communication Agent': '/chat', 'Home Agent': '/home',
                    'Financial Agent': '/finance', 'Health Agent': '/health', 'Security Agent': '/network',
                  };
                  return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(agentRoute[a.agent] || '/agents')}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="mt-1">
                      {a.type === 'success' ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : a.type === 'warning' ? (
                        <AlertCircle size={14} className="text-amber-400" />
                      ) : (
                        <Activity size={14} className="text-nexus-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-nexus-text truncate">{a.text}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="neutral">{a.agent}</Badge>
                        <span className="text-[10px] text-nexus-muted">{a.time}</span>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>

        {/* Mini Widgets */}
        <motion.div variants={item} className="space-y-4">
          {/* Environment */}
          <Card size="sm" hoverable>
            <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => navigate('/home')}>
              <span className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">Home Environment</span>
              <Home size={14} className="text-nexus-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Thermometer size={14} className="text-orange-400" />
                <div>
                  <p className="text-lg font-bold text-nexus-text">24C</p>
                  <p className="text-[10px] text-nexus-muted">Temperature</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Droplets size={14} className="text-blue-400" />
                <div>
                  <p className="text-lg font-bold text-nexus-text">52%</p>
                  <p className="text-[10px] text-nexus-muted">Humidity</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Upcoming Tasks */}
          <Card size="sm" hoverable>
            <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => navigate('/tasks')}>
              <span className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">Upcoming Tasks</span>
              <Calendar size={14} className="text-nexus-primary" />
            </div>
            <div className="space-y-2">
              {['Review PR #42', 'Team standup', 'Deploy staging'].map((t, i) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-nexus-primary" />
                  <span className="text-xs text-nexus-text truncate">{t}</span>
                  <span className="text-[10px] text-nexus-muted ml-auto whitespace-nowrap">
                    {i === 0 ? '30m' : i === 1 ? '2h' : '4h'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Financial Summary */}
          <Card size="sm" hoverable>
            <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => navigate('/finance')}>
              <span className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">Finance</span>
              <DollarSign size={14} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={4280} format="currency" className="text-lg font-bold text-nexus-text" />
              <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                <TrendingUp size={10} /> +12%
              </span>
            </div>
            <p className="text-[10px] text-nexus-muted mt-0.5">Monthly savings on track</p>
          </Card>

          {/* Health Mood */}
          <Card size="sm" hoverable>
            <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => navigate('/health')}>
              <span className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">Mood Today</span>
              <Heart size={14} className="text-pink-400" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[Frown, Meh, Smile].map((Ic, i) => (
                  <Ic
                    key={i}
                    size={20}
                    className={i === 2 ? 'text-emerald-400' : 'text-nexus-muted/40'}
                  />
                ))}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-nexus-text">Great</p>
                <p className="text-[10px] text-nexus-muted">3-day streak</p>
              </div>
            </div>
          </Card>

          {/* Agents Overview */}
          <Card size="sm" hoverable>
            <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => navigate('/agents')}>
              <span className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">AI Agents</span>
              <Bot size={14} className="text-nexus-secondary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center rounded-lg bg-nexus-surface/50 border border-nexus-border/30 p-2">
                <p className="text-lg font-bold text-emerald-400">
                  {agents.filter((a) => a.status === 'active').length || 10}
                </p>
                <p className="text-[9px] text-nexus-muted uppercase">Active</p>
              </div>
              <div className="text-center rounded-lg bg-nexus-surface/50 border border-nexus-border/30 p-2">
                <p className="text-lg font-bold text-nexus-text">
                  {agents.length || 15}
                </p>
                <p className="text-[9px] text-nexus-muted uppercase">Total</p>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <StatusIndicator status="active" size="sm" />
              <span className="text-[10px] text-nexus-muted">All systems operational</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* -- Agent Status Panel -- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/agents')}>
              <Bot size={16} className="text-nexus-secondary" />
              <span>AI Agents</span>
              <Badge variant="success" dot pulse className="ml-auto">
                {agents.filter((a) => a.status === 'active').length} active
              </Badge>
              <ChevronRight size={14} className="text-nexus-muted" />
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {(agents.length
              ? agents
              : [
                  { name: 'orchestrator', display_name: 'Orchestrator', status: 'active' as const, tasks_completed: 142 },
                  { name: 'personal', display_name: 'Personal', status: 'active' as const, tasks_completed: 87 },
                  { name: 'home', display_name: 'Home', status: 'active' as const, tasks_completed: 234 },
                  { name: 'task', display_name: 'Tasks', status: 'active' as const, tasks_completed: 56 },
                  { name: 'health', display_name: 'Health', status: 'idle' as const, tasks_completed: 31 },
                  { name: 'finance', display_name: 'Finance', status: 'idle' as const, tasks_completed: 19 },
                  { name: 'security', display_name: 'Security', status: 'active' as const, tasks_completed: 303 },
                  { name: 'voice', display_name: 'Voice', status: 'idle' as const, tasks_completed: 98 },
                  { name: 'learning', display_name: 'Learning', status: 'idle' as const, tasks_completed: 14 },
                  { name: 'report', display_name: 'Reports', status: 'active' as const, tasks_completed: 27 },
                ]
            ).map((ag) => (
              <motion.div
                key={ag.name}
                whileHover={{ scale: 1.03 }}
                onClick={() => navigate('/agents')}
                className="flex items-center gap-2 rounded-lg border border-nexus-border bg-nexus-card/40 p-2.5 transition-shadow hover:shadow-nexus cursor-pointer"
              >
                <StatusIndicator
                  status={
                    ag.status === 'active' ? 'active' : ag.status === 'error' ? 'error' : 'idle'
                  }
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-nexus-text truncate">{ag.display_name}</p>
                  <p className="text-[10px] text-nexus-muted">{ag.tasks_completed} tasks</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* -- Charts Row: System Resources & Task Trend -- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Usage Line Chart */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/settings')}>
                <BarChart3 size={16} className="text-nexus-primary" />
                <span>System Resources (24h)</span>
                <ChevronRight size={14} className="ml-auto text-nexus-muted" />
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={resourceHistory}>
                <defs>
                  <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ramG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} domain={[0, 100]} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="cpu" stroke="#3B82F6" fill="url(#cpuG)" strokeWidth={2} name="CPU%" />
                <Area type="monotone" dataKey="ram" stroke="#8B5CF6" fill="url(#ramG)" strokeWidth={2} name="RAM%" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Task Completion Trend */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/tasks')}>
                <ListTodo size={16} className="text-nexus-accent" />
                <span>Task Trend (Weekly)</span>
                <ChevronRight size={14} className="ml-auto text-nexus-muted" />
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={taskTrend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="completed" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Completed" />
                <Bar dataKey="created" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Created" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* -- A. AI Model Performance Overview -- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/ai-models')}>
              <Brain size={16} className="text-purple-400" />
              <span>AI Model Performance</span>
              <Badge variant="info" className="ml-2">6 models</Badge>
              <ChevronRight size={14} className="ml-auto text-nexus-muted" />
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={modelPerf}>
              <defs>
                <linearGradient id="nexusLineG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <YAxis
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                domain={[75, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value.toFixed(1)}%`]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Line type="monotone" dataKey="nexus7b" stroke="#3B82F6" strokeWidth={2} dot={false} name="Nexus-7B" />
              <Line type="monotone" dataKey="visionCnn" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Vision-CNN" />
              <Line type="monotone" dataKey="voiceTransformer" stroke="#06B6D4" strokeWidth={2} dot={false} name="Voice-Transformer" />
              <Line type="monotone" dataKey="sentimentBert" stroke="#10B981" strokeWidth={2} dot={false} name="Sentiment-BERT" />
              <Line type="monotone" dataKey="anomalyDetector" stroke="#F59E0B" strokeWidth={2} dot={false} name="Anomaly-Detector" />
              <Line type="monotone" dataKey="recommendation" stroke="#EC4899" strokeWidth={2} dot={false} name="Recommendation" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* -- B. Agent Performance Radar + Response Times -- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/agents')}>
                <Target size={16} className="text-cyan-400" />
                <span>Agent Performance Radar</span>
                <ChevronRight size={14} className="ml-auto text-nexus-muted" />
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={agentRadar} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#888', fontSize: 10 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[60, 100]}
                  tick={{ fill: '#666', fontSize: 9 }}
                  axisLine={false}
                />
                {radarColors.map((rc) => (
                  <Radar
                    key={rc.key}
                    name={rc.name}
                    dataKey={rc.key}
                    stroke={rc.color}
                    fill={rc.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                  iconType="circle"
                  iconSize={7}
                />
                <RechartsTooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Agent Response Times */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/agents')}>
                <Timer size={16} className="text-amber-400" />
                <span>Agent Response Times</span>
                <ChevronRight size={14} className="ml-auto text-nexus-muted" />
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={agentResponseTimes} layout="vertical" barSize={16}>
                <defs>
                  <linearGradient id="respBarG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#888', fontSize: 10 }}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}ms`}
                />
                <YAxis
                  type="category"
                  dataKey="agent"
                  tick={{ fill: '#aaa', fontSize: 11 }}
                  axisLine={false}
                  width={80}
                />
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value}ms`, 'Avg Response']}
                />
                <Bar dataKey="time" radius={[0, 6, 6, 0]} name="Avg Response">
                  {agentResponseTimes.map((_, idx) => (
                    <Cell key={idx} fill={responseBarColors[idx % responseBarColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* -- C. Real-Time Inference Metrics (Sparklines) -- */}
      <motion.div variants={item}>
        <h2 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider mb-3">Real-Time Inference Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {inferenceMetrics.map((m) => (
            <motion.div
              key={m.label}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-xl border border-nexus-border bg-nexus-card/60 backdrop-blur-sm p-4"
            >
              <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10" style={{ backgroundColor: m.color }} />
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-nexus-muted font-medium uppercase tracking-wider">{m.label}</span>
                <m.icon size={14} style={{ color: m.color }} />
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-nexus-text">{m.value}</span>
                <span
                  className={`flex items-center gap-0.5 text-[11px] font-medium ${
                    m.trend === 'up'
                      ? m.label === 'Avg Latency' ? 'text-red-400' : 'text-emerald-400'
                      : m.label === 'Avg Latency' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {m.trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {m.trendValue}
                </span>
              </div>
              <div className="h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.sparkline}>
                    <defs>
                      <linearGradient id={`spark-${m.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={m.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={m.color}
                      fill={`url(#spark-${m.label})`}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* -- D. Training Progress Overview -- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/ai-models')}>
              <GraduationCap size={16} className="text-indigo-400" />
              <span>Training Progress</span>
              <Badge variant="warning" className="ml-2">{trainingJobs.length} active</Badge>
              <ChevronRight size={14} className="ml-auto text-nexus-muted" />
            </div>
          }
        >
          <div className="space-y-5">
            {trainingJobs.map((job) => {
              const barColor =
                job.progress >= 90
                  ? '#10B981'
                  : job.progress >= 60
                  ? '#3B82F6'
                  : '#F59E0B';
              const statusColor =
                job.status === 'completing'
                  ? 'text-emerald-400'
                  : 'text-blue-400';
              const statusBg =
                job.status === 'completing'
                  ? 'bg-emerald-400/10 border-emerald-400/20'
                  : 'bg-blue-400/10 border-blue-400/20';

              return (
                <div key={job.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-nexus-text">{job.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBg} ${statusColor} font-medium capitalize`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-nexus-muted">ETA: {job.eta}</span>
                      <span className="text-sm font-bold text-nexus-text">{job.progress}%</span>
                    </div>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-nexus-border/30 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
                        boxShadow: `0 0 12px ${barColor}40`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                    {job.status === 'running' && (
                      <motion.div
                        className="absolute inset-y-0 rounded-full"
                        style={{
                          width: '20%',
                          background: `linear-gradient(90deg, transparent, ${barColor}30, transparent)`,
                        }}
                        animate={{ left: ['0%', '80%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* -- E. AI Pipeline Flow -- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-teal-400" />
              <span>AI Pipeline Flow</span>
              <Badge variant="success" className="ml-2">Live</Badge>
            </div>
          }
        >
          {/* Pipeline funnel visualization */}
          <div className="space-y-4">
            {/* Stage bars */}
            <div className="relative">
              {pipelineStages.map((s, idx) => {
                const widthPct = (s.count / pipelineStages[0].count) * 100;
                return (
                  <div key={s.stage} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-xs font-medium text-nexus-text">{s.stage}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-nexus-muted">
                          {s.count.toLocaleString()} items
                        </span>
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: s.color }}
                        >
                          {s.rate}%
                        </span>
                      </div>
                    </div>
                    <div className="relative h-3 rounded-full bg-nexus-border/20 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${s.color}99, ${s.color})`,
                          boxShadow: `0 0 8px ${s.color}30`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 1, delay: idx * 0.15, ease: 'easeOut' }}
                      />
                    </div>
                    {/* Connector arrow between stages */}
                    {idx < pipelineStages.length - 1 && (
                      <div className="flex justify-center my-1">
                        <div className="flex flex-col items-center">
                          <div className="w-px h-2 bg-nexus-border/30" />
                          <ChevronRight size={10} className="text-nexus-muted/40 rotate-90" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-nexus-border/20">
              <div className="text-center">
                <p className="text-lg font-bold text-nexus-text">
                  {((pipelineStages[pipelineStages.length - 1].count / pipelineStages[0].count) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-nexus-muted uppercase tracking-wider">Overall Throughput</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-nexus-text">
                  {(pipelineStages[0].count - pipelineStages[pipelineStages.length - 1].count).toLocaleString()}
                </p>
                <p className="text-[10px] text-nexus-muted uppercase tracking-wider">Filtered Items</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400">Healthy</p>
                <p className="text-[10px] text-nexus-muted uppercase tracking-wider">Pipeline Status</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* -- Weekly Activity Heatmap -- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span>Weekly Activity Heatmap</span>
              <ChevronRight size={14} className="ml-auto text-nexus-muted" />
            </div>
          }
        >
          <WeeklyHeatmap />
        </Card>
      </motion.div>
    </motion.div>
  );
}
