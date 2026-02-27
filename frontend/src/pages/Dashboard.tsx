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
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
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

/* ------------------------------------------------------------------ */
/*  Circular Gauge Component                                           */
/* ------------------------------------------------------------------ */
function SystemGauge({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const size = 80;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;

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
            animate={{ strokeDashoffset: circ * (1 - value / 100) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <Icon size={16} style={{ color }} />
          <span className="text-xs font-bold text-nexus-text mt-0.5">
            <AnimatedNumber value={value} format="none" className="text-xs" />%
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
  const net = resources
    ? Math.min(100, Math.round((resources.network?.bytes_recv ?? 0) / (1024 * 1024 * 100)))
    : 12;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ── Greeting ── */}
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

      {/* ── System Health Gauges ── */}
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
            <SystemGauge label="Network" value={net} icon={Wifi} color="#10B981" />
          </div>
        </Card>
      </motion.div>

      {/* ── Quick Actions ── */}
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

      {/* ── Middle row: Activity Timeline + Mini Widgets ── */}
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
                  <p className="text-lg font-bold text-nexus-text">24°C</p>
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
        </motion.div>
      </div>

      {/* ── Agent Status Panel ── */}
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

      {/* ── Charts Row ── */}
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
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1E1E2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
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
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1E1E2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="completed" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Completed" />
                <Bar dataKey="created" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Created" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* ── Weekly Activity Heatmap ── */}
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
