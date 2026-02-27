/* ===================================================================
   Nexus AI OS — Agents Dashboard Page
   Comprehensive hub for monitoring, managing, and analyzing AI agents
   =================================================================== */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Brain,
  User,
  Home as HomeIcon,
  ListTodo,
  Heart,
  DollarSign,
  ShieldCheck,
  Mic,
  BookOpen,
  FileText,
  MessageSquare,
  Zap,
  Briefcase,
  Database,
  Camera,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  Sparkles,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Server,
  Gauge,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useNavigate } from 'react-router-dom';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import StatusIndicator from '@/components/shared/StatusIndicator';
import useStore from '@/lib/store';
import { agentsApi } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type AgentStatus = 'active' | 'idle' | 'error' | 'disabled';

interface Agent {
  name: string;
  display_name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  icon: string;
  tasks_completed: number;
  uptime_seconds: number;
  error_rate: number;
}

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
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CHART_COLORS = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
  '#EC4899', '#EF4444', '#F97316', '#14B8A6', '#A855F7',
  '#6366F1', '#0EA5E9', '#84CC16', '#E11D48', '#7C3AED',
];

const ICON_MAP: Record<string, React.ElementType> = {
  orchestrator: Brain,
  personal: User,
  home: HomeIcon,
  task: ListTodo,
  health: Heart,
  finance: DollarSign,
  security: ShieldCheck,
  voice: Mic,
  learning: BookOpen,
  report: FileText,
  communication: MessageSquare,
  automation: Zap,
  work: Briefcase,
  memory: Database,
  vision: Camera,
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  active: '#10B981',
  idle: '#F59E0B',
  error: '#EF4444',
  disabled: '#6B7280',
};

const STATUS_BADGE_VARIANT: Record<AgentStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  idle: 'warning',
  error: 'error',
  disabled: 'neutral',
};

/* ------------------------------------------------------------------ */
/*  Mock / fallback data                                               */
/* ------------------------------------------------------------------ */
const MOCK_AGENTS: Agent[] = [
  { name: 'orchestrator', display_name: 'Orchestrator', description: 'Central coordinator that routes tasks to specialized agents', status: 'active', capabilities: ['routing', 'scheduling', 'monitoring', 'load-balancing'], icon: 'brain', tasks_completed: 1427, uptime_seconds: 864000, error_rate: 0.3 },
  { name: 'personal', display_name: 'Personal Assistant', description: 'Manages calendar, reminders, and personal preferences', status: 'active', capabilities: ['calendar', 'reminders', 'preferences', 'contacts'], icon: 'user', tasks_completed: 892, uptime_seconds: 820000, error_rate: 0.8 },
  { name: 'home', display_name: 'Home Automation', description: 'Controls smart devices, lighting, and environmental systems', status: 'active', capabilities: ['devices', 'lighting', 'climate', 'scenes', 'energy'], icon: 'home', tasks_completed: 2341, uptime_seconds: 850000, error_rate: 0.5 },
  { name: 'task', display_name: 'Task Manager', description: 'Tracks projects, tasks, sprints, and productivity metrics', status: 'active', capabilities: ['kanban', 'sprints', 'time-tracking', 'priorities'], icon: 'list-todo', tasks_completed: 567, uptime_seconds: 780000, error_rate: 1.2 },
  { name: 'health', display_name: 'Health & Wellness', description: 'Monitors health metrics, mood, sleep, and exercise patterns', status: 'idle', capabilities: ['vitals', 'mood', 'sleep', 'exercise', 'nutrition'], icon: 'heart', tasks_completed: 312, uptime_seconds: 720000, error_rate: 0.4 },
  { name: 'finance', display_name: 'Finance Manager', description: 'Tracks budgets, transactions, investments, and financial goals', status: 'idle', capabilities: ['budgets', 'transactions', 'investments', 'forecasts'], icon: 'dollar-sign', tasks_completed: 198, uptime_seconds: 690000, error_rate: 0.2 },
  { name: 'security', display_name: 'Security Agent', description: 'Network monitoring, threat detection, and access control', status: 'active', capabilities: ['network-scan', 'threat-detect', 'access-control', 'audit'], icon: 'shield-check', tasks_completed: 3089, uptime_seconds: 860000, error_rate: 0.1 },
  { name: 'voice', display_name: 'Voice Interface', description: 'Speech recognition, synthesis, and natural language processing', status: 'idle', capabilities: ['stt', 'tts', 'wake-word', 'voice-commands'], icon: 'mic', tasks_completed: 984, uptime_seconds: 650000, error_rate: 1.8 },
  { name: 'learning', display_name: 'Learning Engine', description: 'Continuous model training, fine-tuning, and knowledge base updates', status: 'active', capabilities: ['fine-tuning', 'rag', 'embeddings', 'adaptation'], icon: 'book-open', tasks_completed: 145, uptime_seconds: 500000, error_rate: 2.1 },
  { name: 'report', display_name: 'Report Generator', description: 'Creates automated reports, analytics, and data visualizations', status: 'active', capabilities: ['pdf', 'analytics', 'charts', 'scheduled-reports'], icon: 'file-text', tasks_completed: 276, uptime_seconds: 730000, error_rate: 0.7 },
  { name: 'communication', display_name: 'Communications', description: 'Handles email, messaging, and notification routing', status: 'active', capabilities: ['email', 'slack', 'sms', 'notifications'], icon: 'message-square', tasks_completed: 1567, uptime_seconds: 810000, error_rate: 0.9 },
  { name: 'automation', display_name: 'Automation Engine', description: 'Workflow automation, triggers, and scheduled actions', status: 'active', capabilities: ['workflows', 'triggers', 'cron', 'integrations'], icon: 'zap', tasks_completed: 2103, uptime_seconds: 840000, error_rate: 0.6 },
  { name: 'work', display_name: 'Work Assistant', description: 'Manages work tasks, meetings, and professional productivity', status: 'idle', capabilities: ['meetings', 'notes', 'code-review', 'documentation'], icon: 'briefcase', tasks_completed: 423, uptime_seconds: 600000, error_rate: 1.5 },
  { name: 'memory', display_name: 'Memory Store', description: 'Long-term memory, context retention, and knowledge graphs', status: 'active', capabilities: ['long-term', 'context', 'knowledge-graph', 'retrieval'], icon: 'database', tasks_completed: 8912, uptime_seconds: 855000, error_rate: 0.2 },
  { name: 'vision', display_name: 'Vision Agent', description: 'Image analysis, object detection, and visual processing', status: 'idle', capabilities: ['object-detect', 'ocr', 'face-recognition', 'scene-analysis'], icon: 'camera', tasks_completed: 87, uptime_seconds: 350000, error_rate: 3.2 },
];

const MOCK_TRAINING_EVENTS = [
  { id: '1', model: 'PersonalLLM v3.2', type: 'Fine-tuning', status: 'completed', date: '2026-02-26 08:30', accuracy: 94.2, samples: 12800 },
  { id: '2', model: 'RAG Embeddings', type: 'Embedding Update', status: 'completed', date: '2026-02-25 22:15', accuracy: 97.1, samples: 45000 },
  { id: '3', model: 'Voice Recognition', type: 'Adaptation', status: 'completed', date: '2026-02-25 14:00', accuracy: 91.8, samples: 8500 },
  { id: '4', model: 'Vision Classifier', type: 'Transfer Learning', status: 'in-progress', accuracy: 88.5, date: '2026-02-26 10:00', samples: 3200 },
  { id: '5', model: 'Sentiment Model', type: 'Fine-tuning', status: 'scheduled', accuracy: 0, date: '2026-02-26 18:00', samples: 0 },
];

const MOCK_ACTIVITY_TIMELINE = [
  { id: '1', agent: 'security', action: 'Completed full network vulnerability scan — 0 threats detected', time: '2 min ago', type: 'success' as const },
  { id: '2', agent: 'home', action: 'Adjusted living room temperature to 23°C based on occupancy', time: '5 min ago', type: 'info' as const },
  { id: '3', agent: 'communication', action: 'Sent daily digest email with 12 summarized notifications', time: '12 min ago', type: 'success' as const },
  { id: '4', agent: 'automation', action: 'Triggered "Morning Routine" workflow — 6 actions executed', time: '18 min ago', type: 'success' as const },
  { id: '5', agent: 'memory', action: 'Indexed 342 new context entries into knowledge graph', time: '25 min ago', type: 'info' as const },
  { id: '6', agent: 'orchestrator', action: 'Re-balanced task queue — 3 tasks redistributed to idle agents', time: '30 min ago', type: 'warning' as const },
  { id: '7', agent: 'learning', action: 'Fine-tuning batch 47/50 completed — accuracy 94.2%', time: '42 min ago', type: 'success' as const },
  { id: '8', agent: 'task', action: 'Marked 3 overdue tasks for escalation to orchestrator', time: '1 hr ago', type: 'warning' as const },
  { id: '9', agent: 'report', action: 'Generated weekly performance report — PDF exported', time: '1.5 hr ago', type: 'success' as const },
  { id: '10', agent: 'voice', action: 'Processed 24 voice commands with 96.3% recognition accuracy', time: '2 hr ago', type: 'info' as const },
  { id: '11', agent: 'finance', action: 'Detected unusual transaction — flagged for review', time: '3 hr ago', type: 'warning' as const },
  { id: '12', agent: 'personal', action: 'Updated calendar with 2 new events from email invitations', time: '3.5 hr ago', type: 'info' as const },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getAgentIcon(name: string): React.ElementType {
  return ICON_MAP[name] ?? Bot;
}

function getHealthColor(errorRate: number): string {
  if (errorRate < 0.5) return '#10B981';
  if (errorRate < 1.0) return '#3B82F6';
  if (errorRate < 2.0) return '#F59E0B';
  return '#EF4444';
}

function getHealthLabel(errorRate: number): string {
  if (errorRate < 0.5) return 'Excellent';
  if (errorRate < 1.0) return 'Good';
  if (errorRate < 2.0) return 'Fair';
  return 'Poor';
}

/* ------------------------------------------------------------------ */
/*  Recharts custom tooltip                                            */
/* ------------------------------------------------------------------ */
const chartTooltipStyle = {
  backgroundColor: '#1E1E2E',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Agents() {
  const { setAgents, setCurrentPage } = useStore();
  const navigate = useNavigate();

  const [agentData, setAgentData] = useState<Agent[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  /* ---- Fetch agents ---- */
  const fetchAgents = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const result = await agentsApi.list();
      const list = Array.isArray(result) ? result : [];
      if (list.length > 0) {
        setAgentData(list as Agent[]);
        setAgents(list);
      } else {
        setAgentData(MOCK_AGENTS);
      }
    } catch {
      setAgentData(MOCK_AGENTS);
    } finally {
      setLoading(false);
      if (showRefresh) setTimeout(() => setRefreshing(false), 400);
    }
  }, [setAgents]);

  useEffect(() => {
    setCurrentPage('/agents');
    fetchAgents();
  }, [setCurrentPage, fetchAgents]);

  /* ---- Derived data ---- */
  const agents = agentData.length > 0 ? agentData : MOCK_AGENTS;

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((a) => a.status === 'active').length;
    const totalTasks = agents.reduce((s, a) => s + (a.tasks_completed ?? 0), 0);
    const avgError = agents.length ? agents.reduce((s, a) => s + (a.error_rate ?? 0), 0) / agents.length : 0;
    return { total, active, totalTasks, avgError };
  }, [agents]);

  /* ---- Performance chart data ---- */
  const perfBarData = useMemo(
    () =>
      agents
        .slice()
        .sort((a, b) => b.tasks_completed - a.tasks_completed)
        .map((a) => ({
          name: a.display_name,
          tasks: a.tasks_completed,
          fill: STATUS_COLORS[a.status],
        })),
    [agents],
  );

  const pieData = useMemo(
    () =>
      agents.map((a, i) => ({
        name: a.display_name,
        value: a.tasks_completed,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [agents],
  );

  const radarData = useMemo(
    () =>
      agents.map((a) => ({
        agent: a.display_name.split(' ')[0],
        performance: Math.min(100, Math.round((a.tasks_completed / 100) * (100 - a.error_rate))),
        uptime: Math.round((a.uptime_seconds / 864000) * 100),
        reliability: Math.round(100 - a.error_rate * 10),
      })),
    [agents],
  );

  /* ---- Toggle expanded agent ---- */
  const toggleExpand = (name: string) => {
    setExpandedAgent((prev) => (prev === name ? null : name));
  };

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ── 1. Page Header ── */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-nexus-border bg-gradient-to-br from-nexus-primary/10 via-nexus-surface to-nexus-secondary/10 p-6"
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-nexus-primary/5 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-nexus-secondary/5 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-nexus-primary/20"
            >
              <Bot size={28} className="text-nexus-primary" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-nexus-text">
                <span className="gradient-text">AI Agents Hub</span>
              </h1>
              <p className="text-sm text-nexus-muted mt-0.5">
                <Sparkles size={14} className="inline mr-1 text-nexus-accent" />
                {stats.total} agents deployed &middot; {stats.active} active now
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => fetchAgents(true)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </motion.div>

      {/* ── 2. Summary Stats Row ── */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Agents */}
        <Card size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
              <Layers size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider font-semibold">Total Agents</p>
              <p className="text-2xl font-bold text-nexus-text">
                <AnimatedNumber value={stats.total} format="none" className="text-2xl" />
              </p>
            </div>
          </div>
        </Card>

        {/* Active Now */}
        <Card size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <Activity size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider font-semibold">Active Now</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-emerald-400">
                  <AnimatedNumber value={stats.active} format="none" className="text-2xl" />
                </p>
                <Badge variant="success" dot pulse>running</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Total Tasks */}
        <Card size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
              <Target size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider font-semibold">Tasks Completed</p>
              <p className="text-2xl font-bold text-nexus-text">
                <AnimatedNumber value={stats.totalTasks} format="compact" className="text-2xl" />
              </p>
            </div>
          </div>
        </Card>

        {/* Avg Error Rate */}
        <Card size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${getHealthColor(stats.avgError)}15` }}>
              <Gauge size={20} style={{ color: getHealthColor(stats.avgError) }} />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider font-semibold">Avg Error Rate</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold" style={{ color: getHealthColor(stats.avgError) }}>
                  {stats.avgError.toFixed(1)}%
                </p>
                <span className="text-[10px] text-nexus-muted">{getHealthLabel(stats.avgError)}</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── 3. Agent Grid ── */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2 mb-4">
          <Bot size={16} className="text-nexus-secondary" />
          <h2 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider">Agent Fleet</h2>
          <Badge variant="info" className="ml-auto">{agents.length} agents</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, idx) => {
            const Icon = getAgentIcon(agent.name);
            const successRate = 100 - (agent.error_rate ?? 0);
            const isExpanded = expandedAgent === agent.name;
            const color = CHART_COLORS[idx % CHART_COLORS.length];

            return (
              <motion.div
                key={agent.name}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.35 }}
              >
                <Card
                  variant={agent.status === 'active' ? 'glow' : 'default'}
                  hoverable
                  size="sm"
                >
                  {/* Top row: icon + name + status */}
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-nexus-text truncate">{agent.display_name}</h3>
                        <StatusIndicator
                          status={agent.status === 'active' ? 'active' : agent.status === 'error' ? 'error' : 'idle'}
                          size="sm"
                        />
                        <Badge variant={STATUS_BADGE_VARIANT[agent.status]} className="ml-auto text-[10px]">
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-nexus-muted mt-0.5 line-clamp-2">{agent.description}</p>
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {(agent.capabilities ?? []).slice(0, isExpanded ? undefined : 3).map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center rounded-md bg-nexus-surface px-1.5 py-0.5 text-[10px] font-medium text-nexus-muted border border-nexus-border/50"
                      >
                        {cap}
                      </span>
                    ))}
                    {!isExpanded && (agent.capabilities ?? []).length > 3 && (
                      <span className="text-[10px] text-nexus-muted">+{agent.capabilities.length - 3}</span>
                    )}
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-nexus-border/30">
                    <div className="text-center">
                      <p className="text-xs font-bold text-nexus-text">
                        <AnimatedNumber value={agent.tasks_completed} format="compact" className="text-xs" />
                      </p>
                      <p className="text-[9px] text-nexus-muted uppercase tracking-wider">Tasks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-nexus-text">{formatUptime(agent.uptime_seconds)}</p>
                      <p className="text-[9px] text-nexus-muted uppercase tracking-wider">Uptime</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold" style={{ color: getHealthColor(agent.error_rate) }}>
                        {agent.error_rate.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-nexus-muted uppercase tracking-wider">Errors</p>
                    </div>
                  </div>

                  {/* Performance bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-nexus-muted">Success Rate</span>
                      <span className="text-[10px] font-medium" style={{ color: getHealthColor(agent.error_rate) }}>
                        {successRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-nexus-border/30 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: getHealthColor(agent.error_rate) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${successRate}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.04 }}
                      />
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-nexus-border/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-nexus-muted">Uptime %</span>
                            <span className="text-[11px] font-medium text-nexus-text">
                              {((agent.uptime_seconds / 864000) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-nexus-muted">Avg Tasks / Day</span>
                            <span className="text-[11px] font-medium text-nexus-text">
                              {Math.round(agent.tasks_completed / Math.max(1, agent.uptime_seconds / 86400))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-nexus-muted">Health Score</span>
                            <Badge variant={STATUS_BADGE_VARIANT[agent.error_rate < 1 ? 'active' : agent.error_rate < 2 ? 'idle' : 'error']}>
                              {getHealthLabel(agent.error_rate)}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={MessageSquare}
                            onClick={() => navigate('/chat')}
                            className="w-full mt-2"
                          >
                            Chat with {agent.display_name}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expand/collapse toggle */}
                  <button
                    onClick={() => toggleExpand(agent.name)}
                    className="flex items-center justify-center w-full mt-2 pt-1 text-nexus-muted hover:text-nexus-text transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── 4. Performance Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Agent Performance Comparison */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-nexus-primary" />
                <span>Agent Performance Comparison</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={perfBarData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#888', fontSize: 10 }}
                  axisLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#ccc', fontSize: 10 }}
                  axisLine={false}
                  width={110}
                />
                <RechartsTooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="tasks" radius={[0, 4, 4, 0]} name="Tasks Completed" barSize={16}>
                  {perfBarData.map((entry, i) => (
                    <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Chart 2: Agent Activity Distribution (Pie + Radar) */}
        <motion.div variants={item} className="space-y-6">
          <Card
            header={
              <div className="flex items-center gap-2">
                <PieChartIcon size={16} className="text-nexus-accent" />
                <span>Task Distribution</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={chartTooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: 10, color: '#888' }}
                  iconSize={8}
                  formatter={(value: string) => <span className="text-nexus-muted text-[10px]">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card
            header={
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-nexus-secondary" />
                <span>Agent Radar Profile</span>
              </div>
            }
            size="sm"
          >
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData.slice(0, 8)}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="agent" tick={{ fill: '#888', fontSize: 9 }} />
                <PolarRadiusAxis tick={{ fill: '#555', fontSize: 8 }} domain={[0, 100]} />
                <Radar name="Performance" dataKey="performance" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                <Radar name="Uptime" dataKey="uptime" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} />
                <Radar name="Reliability" dataKey="reliability" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                <RechartsTooltip contentStyle={chartTooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* ── 5. Training & Learning Section ── */}
      <motion.div variants={item}>
        <Card
          variant="glow"
          header={
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-nexus-accent" />
              <span>Training & Learning</span>
              <Badge variant="info" className="ml-auto">v3.2.1</Badge>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Training Status Card */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-nexus-muted uppercase tracking-wider">Model Status</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-nexus-muted">Last Training</span>
                  <span className="text-[11px] font-medium text-nexus-text">Feb 26, 2026 08:30</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-nexus-muted">Training Accuracy</span>
                  <span className="text-[11px] font-bold text-emerald-400">94.2%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-nexus-muted">Total Samples</span>
                  <span className="text-[11px] font-medium text-nexus-text">69,500</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-nexus-muted">Model Version</span>
                  <Badge variant="info">v3.2.1</Badge>
                </div>
              </div>

              {/* Training Progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-nexus-muted">Current Session Progress</span>
                  <span className="text-[11px] font-bold text-nexus-primary">94%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-nexus-border/30 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-nexus-primary to-nexus-secondary"
                    initial={{ width: 0 }}
                    animate={{ width: '94%' }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[10px] text-nexus-muted mt-1">Batch 47/50 — Fine-tuning PersonalLLM v3.2</p>
              </div>

              {/* Mini metrics */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded-lg border border-nexus-border/40 bg-nexus-surface/50 p-2 text-center">
                  <p className="text-lg font-bold text-nexus-text">12</p>
                  <p className="text-[9px] text-nexus-muted uppercase">Sessions Today</p>
                </div>
                <div className="rounded-lg border border-nexus-border/40 bg-nexus-surface/50 p-2 text-center">
                  <p className="text-lg font-bold text-nexus-text">847</p>
                  <p className="text-[9px] text-nexus-muted uppercase">Total Sessions</p>
                </div>
              </div>
            </div>

            {/* Recent Training Events */}
            <div className="lg:col-span-2">
              <h4 className="text-xs font-semibold text-nexus-muted uppercase tracking-wider mb-3">Recent Training Events</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                {MOCK_TRAINING_EVENTS.map((evt, i) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 rounded-lg border border-nexus-border/30 bg-nexus-card/30 p-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="shrink-0">
                      {evt.status === 'completed' ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : evt.status === 'in-progress' ? (
                        <RefreshCw size={16} className="text-blue-400 animate-spin" />
                      ) : (
                        <Clock size={16} className="text-nexus-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-nexus-text truncate">{evt.model}</p>
                        <Badge
                          variant={evt.status === 'completed' ? 'success' : evt.status === 'in-progress' ? 'info' : 'neutral'}
                        >
                          {evt.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-nexus-muted mt-0.5">
                        {evt.type} &middot; {evt.samples.toLocaleString()} samples
                        {evt.accuracy > 0 && <> &middot; <span className="text-emerald-400">{evt.accuracy}% acc</span></>}
                      </p>
                    </div>
                    <span className="text-[10px] text-nexus-muted whitespace-nowrap">{evt.date}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── 6. Agent Activity Timeline ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-nexus-accent" />
              <span>Agent Activity Timeline</span>
              <Badge variant="neutral" className="ml-auto">{MOCK_ACTIVITY_TIMELINE.length} events</Badge>
            </div>
          }
        >
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
            <AnimatePresence>
              {MOCK_ACTIVITY_TIMELINE.map((entry, i) => {
                const AgentIcon = getAgentIcon(entry.agent);
                const agentObj = agents.find((a) => a.name === entry.agent);
                const agentColor = CHART_COLORS[agents.findIndex((a) => a.name === entry.agent) % CHART_COLORS.length] ?? '#888';

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 rounded-lg p-2.5 hover:bg-white/5 transition-colors"
                  >
                    {/* Status icon */}
                    <div className="mt-0.5 shrink-0">
                      {entry.type === 'success' ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : entry.type === 'warning' ? (
                        <AlertTriangle size={14} className="text-amber-400" />
                      ) : (
                        <Activity size={14} className="text-blue-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-nexus-text">{entry.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border"
                          style={{
                            backgroundColor: `${agentColor}15`,
                            borderColor: `${agentColor}30`,
                            color: agentColor,
                          }}
                        >
                          <AgentIcon size={10} />
                          {agentObj?.display_name ?? entry.agent}
                        </span>
                        <span className="text-[10px] text-nexus-muted">{entry.time}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* ── 7. Agent Health Matrix ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Server size={16} className="text-nexus-primary" />
              <span>Agent Health Matrix</span>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-nexus-muted">&lt;0.5%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-[10px] text-nexus-muted">&lt;1%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] text-nexus-muted">&lt;2%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <span className="text-[10px] text-nexus-muted">&ge;2%</span>
                </div>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {agents.map((agent) => {
              const Icon = getAgentIcon(agent.name);
              const healthColor = getHealthColor(agent.error_rate);
              const uptimePercent = ((agent.uptime_seconds / 864000) * 100).toFixed(1);
              const healthScore = Math.round(100 - agent.error_rate * 10);

              return (
                <motion.div
                  key={agent.name}
                  whileHover={{ scale: 1.04, y: -2 }}
                  className="relative rounded-xl border border-nexus-border bg-nexus-card/40 p-3 transition-shadow hover:shadow-nexus overflow-hidden"
                >
                  {/* Subtle glow bg */}
                  <div
                    className="absolute inset-0 opacity-[0.04] rounded-xl"
                    style={{ backgroundColor: healthColor }}
                  />
                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${healthColor}20`, color: healthColor }}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-nexus-text truncate">{agent.display_name}</p>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[agent.status] }}
                          />
                          <span className="text-[9px] text-nexus-muted capitalize">{agent.status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Health Score Circle */}
                    <div className="flex items-center justify-center my-2">
                      <div className="relative">
                        <CircularProgress
                          value={healthScore}
                          size={52}
                          strokeWidth={4}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xs font-bold" style={{ color: healthColor }}>
                            {healthScore}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-1 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-nexus-muted">Error Rate</span>
                        <span className="text-[9px] font-medium" style={{ color: healthColor }}>
                          {agent.error_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-nexus-muted">Uptime</span>
                        <span className="text-[9px] font-medium text-nexus-text">{uptimePercent}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-nexus-muted">Health</span>
                        <span className="text-[9px] font-medium" style={{ color: healthColor }}>
                          {getHealthLabel(agent.error_rate)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
