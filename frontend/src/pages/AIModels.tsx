/* ===================================================================
   Nexus AI OS — AI Models & Training Dashboard
   Comprehensive model management, training metrics & visualizations
   =================================================================== */

import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Cpu,
  Zap,
  Target,
  Database,
  TrendingUp,
  TrendingDown,
  Play,
  Download,
  Eye,
  Mic,
  MessageSquare,
  Shield,
  Sparkles,
  Clock,
  BarChart3,
  Layers,
  Activity,
  HardDrive,
  Gauge,
  GitBranch,
  Calendar,
  FlaskConical,
  ChevronRight,
  Star,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from 'recharts';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import useStore from '@/lib/store';

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
/*  Color palette                                                      */
/* ------------------------------------------------------------------ */
const COLORS = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
  '#EC4899', '#EF4444', '#F97316', '#14B8A6', '#A855F7',
];

/* ------------------------------------------------------------------ */
/*  Shared tooltip style                                               */
/* ------------------------------------------------------------------ */
const tooltipStyle = {
  backgroundColor: '#1E1E2E',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
};

/* ------------------------------------------------------------------ */
/*  Mock Data — Training epochs (30 points)                            */
/* ------------------------------------------------------------------ */
const epochData = Array.from({ length: 30 }, (_, i) => {
  const ep = i + 1;
  const acc = 0.58 + 0.37 * (1 - Math.exp(-ep / 8)) + (Math.random() * 0.02 - 0.01);
  const valAcc = acc - 0.02 - Math.random() * 0.03;
  const loss = 0.82 * Math.exp(-ep / 7) + 0.05 + (Math.random() * 0.02 - 0.01);
  const valLoss = loss + 0.02 + Math.random() * 0.03;
  return {
    epoch: ep,
    accuracy: +acc.toFixed(4),
    val_accuracy: +valAcc.toFixed(4),
    loss: +loss.toFixed(4),
    val_loss: +valLoss.toFixed(4),
  };
});

/* ------------------------------------------------------------------ */
/*  Mock Data — Model definitions                                      */
/* ------------------------------------------------------------------ */
interface ModelInfo {
  id: string;
  name: string;
  type: string;
  params: string;
  paramsNum: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  status: 'active' | 'idle';
  icon: React.ElementType;
  color: string;
  trainingProgress: number | null;
  lastTrained: string;
  inferenceTime: number;
  sparkline: number[];
  memoryEfficiency: number;
  speed: number;
}

const models: ModelInfo[] = [
  {
    id: 'nexus-7b',
    name: 'Nexus-7B LLM',
    type: 'Language Model',
    params: '7B',
    paramsNum: 7000,
    accuracy: 94.2,
    precision: 93.8,
    recall: 94.6,
    f1: 94.2,
    status: 'active',
    icon: Brain,
    color: COLORS[0],
    trainingProgress: 72,
    lastTrained: '2 hours ago',
    inferenceTime: 145,
    sparkline: [91.1, 91.8, 92.3, 92.9, 93.2, 93.7, 94.0, 94.2],
    memoryEfficiency: 78,
    speed: 82,
  },
  {
    id: 'vision-cnn',
    name: 'Vision-CNN',
    type: 'Object Detection',
    params: '45M',
    paramsNum: 45,
    accuracy: 91.8,
    precision: 90.5,
    recall: 92.1,
    f1: 91.3,
    status: 'active',
    icon: Eye,
    color: COLORS[1],
    trainingProgress: 88,
    lastTrained: '45 min ago',
    inferenceTime: 32,
    sparkline: [88.2, 89.0, 89.5, 90.1, 90.8, 91.2, 91.5, 91.8],
    memoryEfficiency: 91,
    speed: 95,
  },
  {
    id: 'voice-tf',
    name: 'Voice-Transformer',
    type: 'Speech Recognition',
    params: '120M',
    paramsNum: 120,
    accuracy: 96.1,
    precision: 95.8,
    recall: 96.4,
    f1: 96.1,
    status: 'active',
    icon: Mic,
    color: COLORS[2],
    trainingProgress: null,
    lastTrained: '6 hours ago',
    inferenceTime: 58,
    sparkline: [93.5, 94.0, 94.6, 95.1, 95.5, 95.7, 95.9, 96.1],
    memoryEfficiency: 85,
    speed: 88,
  },
  {
    id: 'sentiment-bert',
    name: 'Sentiment-BERT',
    type: 'Text Classification',
    params: '110M',
    paramsNum: 110,
    accuracy: 89.5,
    precision: 88.7,
    recall: 90.3,
    f1: 89.5,
    status: 'idle',
    icon: MessageSquare,
    color: COLORS[3],
    trainingProgress: null,
    lastTrained: '2 days ago',
    inferenceTime: 24,
    sparkline: [85.2, 86.1, 87.0, 87.8, 88.4, 88.9, 89.2, 89.5],
    memoryEfficiency: 92,
    speed: 96,
  },
  {
    id: 'anomaly-det',
    name: 'Anomaly-Detector',
    type: 'Network Security',
    params: '15M',
    paramsNum: 15,
    accuracy: 97.3,
    precision: 97.0,
    recall: 97.6,
    f1: 97.3,
    status: 'active',
    icon: Shield,
    color: COLORS[4],
    trainingProgress: 34,
    lastTrained: '1 hour ago',
    inferenceTime: 12,
    sparkline: [94.8, 95.3, 95.9, 96.2, 96.6, 96.9, 97.1, 97.3],
    memoryEfficiency: 97,
    speed: 99,
  },
  {
    id: 'rec-engine',
    name: 'Recommendation-Engine',
    type: 'User Preferences',
    params: '25M',
    paramsNum: 25,
    accuracy: 88.7,
    precision: 87.9,
    recall: 89.5,
    f1: 88.7,
    status: 'idle',
    icon: Sparkles,
    color: COLORS[5],
    trainingProgress: null,
    lastTrained: '3 days ago',
    inferenceTime: 18,
    sparkline: [84.5, 85.4, 86.2, 87.0, 87.6, 88.1, 88.4, 88.7],
    memoryEfficiency: 94,
    speed: 97,
  },
];

/* ------------------------------------------------------------------ */
/*  Mock Data — Radar chart metrics                                    */
/* ------------------------------------------------------------------ */
const radarData = [
  { metric: 'Accuracy', ...Object.fromEntries(models.map((m) => [m.id, m.accuracy])) },
  { metric: 'Precision', ...Object.fromEntries(models.map((m) => [m.id, m.precision])) },
  { metric: 'Recall', ...Object.fromEntries(models.map((m) => [m.id, m.recall])) },
  { metric: 'F1 Score', ...Object.fromEntries(models.map((m) => [m.id, m.f1])) },
  { metric: 'Speed', ...Object.fromEntries(models.map((m) => [m.id, m.speed])) },
  { metric: 'Memory Eff.', ...Object.fromEntries(models.map((m) => [m.id, m.memoryEfficiency])) },
];

/* ------------------------------------------------------------------ */
/*  Mock Data — Inference time bar chart                               */
/* ------------------------------------------------------------------ */
const inferenceData = models
  .map((m) => ({ name: m.name.split('-')[0], time: m.inferenceTime, fill: m.color }))
  .sort((a, b) => b.time - a.time);

/* ------------------------------------------------------------------ */
/*  Mock Data — Training history (30 days)                             */
/* ------------------------------------------------------------------ */
const trainingHistory = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  return {
    day: `Day ${day}`,
    sessions: Math.floor(1 + Math.random() * 5),
    cumAccuracy: +(85 + 10 * (1 - Math.exp(-day / 10)) + Math.random() * 0.5).toFixed(2),
  };
});

/* ------------------------------------------------------------------ */
/*  Mock Data — GPU / Resource utilization (20 points)                 */
/* ------------------------------------------------------------------ */
const gpuData = Array.from({ length: 20 }, (_, i) => ({
  time: `${String(i * 3).padStart(2, '0')}m`,
  gpuUtil: Math.round(55 + Math.random() * 35),
  gpuMemory: Math.round(40 + Math.random() * 40),
  cpuUtil: Math.round(20 + Math.random() * 30),
}));

/* ------------------------------------------------------------------ */
/*  Mock Data — Loss analysis (30 epochs)                              */
/* ------------------------------------------------------------------ */
const lossData = Array.from({ length: 30 }, (_, i) => {
  const ep = i + 1;
  const trainLoss = 0.85 * Math.exp(-ep / 7) + 0.04 + Math.random() * 0.015;
  const valLoss = trainLoss + 0.025 + Math.random() * 0.02;
  const testLoss = valLoss + 0.015 + Math.random() * 0.015;
  return {
    epoch: ep,
    train_loss: +trainLoss.toFixed(4),
    val_loss: +valLoss.toFixed(4),
    test_loss: +testLoss.toFixed(4),
    bestCheckpoint: ep === 24,
  };
});

/* ------------------------------------------------------------------ */
/*  Mock Data — Scatter (model size vs perf)                           */
/* ------------------------------------------------------------------ */
const scatterData = models.map((m) => ({
  name: m.name,
  params: m.paramsNum,
  accuracy: m.accuracy,
  speed: m.speed,
  color: m.color,
}));

/* ------------------------------------------------------------------ */
/*  Mock Data — Training queue                                         */
/* ------------------------------------------------------------------ */
const trainingQueue = [
  { model: 'Nexus-7B LLM', scheduled: '14:30 Today', duration: '~4h', priority: 'high' as const, progress: 72 },
  { model: 'Anomaly-Detector', scheduled: '18:00 Today', duration: '~45m', priority: 'high' as const, progress: 34 },
  { model: 'Vision-CNN', scheduled: '22:00 Today', duration: '~2h', priority: 'medium' as const, progress: 88 },
  { model: 'Sentiment-BERT', scheduled: 'Tomorrow 06:00', duration: '~3h', priority: 'low' as const, progress: null },
  { model: 'Recommendation-Engine', scheduled: 'Tomorrow 10:00', duration: '~1.5h', priority: 'low' as const, progress: null },
];

/* ------------------------------------------------------------------ */
/*  Mock Data — Data pipeline                                          */
/* ------------------------------------------------------------------ */
const pipelineData = [
  { name: 'Text', value: 40, color: COLORS[0] },
  { name: 'Images', value: 25, color: COLORS[1] },
  { name: 'Audio', value: 20, color: COLORS[2] },
  { name: 'Structured', value: 15, color: COLORS[3] },
];

/* ------------------------------------------------------------------ */
/*  Mock Data — Confusion matrix (5x5)                                 */
/* ------------------------------------------------------------------ */
const confusionLabels = ['Positive', 'Negative', 'Neutral', 'Mixed', 'Unknown'];
const confusionMatrix = [
  [142, 5, 3, 2, 1],
  [4, 138, 6, 3, 2],
  [2, 7, 130, 8, 3],
  [3, 4, 9, 125, 5],
  [1, 2, 4, 6, 118],
];

/* ------------------------------------------------------------------ */
/*  Mini sparkline component                                           */
/* ------------------------------------------------------------------ */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ x: i, y: v }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="y"
          stroke={color}
          fill={`url(#spark-${color.replace('#', '')})`}
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom scatter dot                                                 */
/* ------------------------------------------------------------------ */
function CustomScatterDot(props: any) {
  const { cx, cy, payload } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={payload.color} fillOpacity={0.3} />
      <circle cx={cx} cy={cy} r={4} fill={payload.color} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom scatter tooltip                                             */
/* ------------------------------------------------------------------ */
function ScatterTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        ...tooltipStyle,
        padding: '8px 12px',
      }}
    >
      <p className="text-nexus-text font-medium text-xs">{d.name}</p>
      <p className="text-nexus-muted text-[10px]">Params: {d.params >= 1000 ? `${(d.params / 1000).toFixed(0)}B` : `${d.params}M`}</p>
      <p className="text-nexus-muted text-[10px]">Accuracy: {d.accuracy}%</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Best checkpoint annotation component                               */
/* ------------------------------------------------------------------ */
function BestCheckpointDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.bestCheckpoint) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#10B981" stroke="#10B981" strokeWidth={2} fillOpacity={0.3} />
      <circle cx={cx} cy={cy} r={3} fill="#10B981" />
      <text x={cx + 10} y={cy - 8} fill="#10B981" fontSize={9} fontWeight={600}>
        Best
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function AIModels() {
  const { setCurrentPage } = useStore();

  useEffect(() => {
    setCurrentPage('/ai-models');
  }, [setCurrentPage]);

  const activeTraining = models.filter((m) => m.trainingProgress !== null).length;
  const globalAccuracy = useMemo(
    () => +(models.reduce((s, m) => s + m.accuracy, 0) / models.length).toFixed(1),
    [],
  );
  const totalSamples = 2_847_391;

  /* Max value in confusion matrix for heatmap intensity */
  const confMax = Math.max(...confusionMatrix.flat());

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ════════════════════════════════════════════════════════════ */}
      {/*  1. PAGE HEADER                                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div
        variants={item}
        className="relative overflow-hidden rounded-2xl border border-nexus-border bg-gradient-to-br from-nexus-primary/10 via-nexus-surface to-nexus-secondary/10 p-6"
      >
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-nexus-primary/5 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-nexus-secondary/5 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-nexus-primary/20"
            >
              <Brain size={28} className="text-nexus-primary" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold">
                <span className="gradient-text">AI Models & Training</span>
              </h1>
              <p className="text-sm text-nexus-muted mt-0.5">
                <Sparkles size={14} className="inline mr-1 text-nexus-accent" />
                {models.length} models registered · {activeTraining} training sessions active
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="md" icon={Play}>
              Start Training
            </Button>
            <Button variant="secondary" size="md" icon={Download}>
              Export Models
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  2. MODEL OVERVIEW STATS                                   */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Models */}
        <Card variant="glow" size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
              <Layers size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider">Total Models</p>
              <AnimatedNumber value={models.length} className="text-2xl font-bold text-nexus-text" />
            </div>
          </div>
        </Card>

        {/* Active Training */}
        <Card variant="glow" size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
              <Activity size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider">Active Training</p>
              <div className="flex items-center gap-2">
                <AnimatedNumber value={activeTraining} className="text-2xl font-bold text-nexus-text" />
                <Badge variant="success" dot pulse>Live</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Global Accuracy */}
        <Card variant="glow" size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
              <Target size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider">Global Accuracy</p>
              <div className="flex items-center gap-1.5">
                <AnimatedNumber value={globalAccuracy} format="percent" className="text-2xl font-bold text-nexus-text" />
                <span className="flex items-center text-[10px] text-emerald-400">
                  <TrendingUp size={10} /> +2.3%
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Total Training Samples */}
        <Card variant="glow" size="sm" hoverable>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
              <Database size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-nexus-muted uppercase tracking-wider">Training Samples</p>
              <AnimatedNumber value={totalSamples} format="compact" className="text-2xl font-bold text-nexus-text" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  3. MODEL PERFORMANCE OVER TIME (AreaChart)                */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-nexus-primary" />
              <span>Model Performance Over Training Epochs</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={epochData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="accG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="valAccG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lossG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="valLossG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="epoch" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} label={{ value: 'Epoch', position: 'insideBottomRight', offset: -5, fill: '#888', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} domain={[0, 1]} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
              <Area type="monotone" dataKey="accuracy" stroke="#3B82F6" fill="url(#accG)" strokeWidth={2} name="Accuracy" />
              <Area type="monotone" dataKey="val_accuracy" stroke="#06B6D4" fill="url(#valAccG)" strokeWidth={2} name="Val Accuracy" strokeDasharray="5 3" />
              <Area type="monotone" dataKey="loss" stroke="#EF4444" fill="url(#lossG)" strokeWidth={2} name="Loss" />
              <Area type="monotone" dataKey="val_loss" stroke="#F59E0B" fill="url(#valLossG)" strokeWidth={2} name="Val Loss" strokeDasharray="5 3" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  4. MODEL CARDS GRID                                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <h2 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cpu size={14} className="text-nexus-primary" /> Registered Models
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {models.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div key={m.id} whileHover={{ scale: 1.01 }}>
                <Card variant="default" size="sm" hoverable className="h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${m.color}20`, color: m.color }}
                      >
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-nexus-text">{m.name}</p>
                        <p className="text-[10px] text-nexus-muted">{m.type} · {m.params} params</p>
                      </div>
                    </div>
                    <Badge
                      variant={m.status === 'active' ? 'success' : 'neutral'}
                      dot
                      pulse={m.status === 'active'}
                    >
                      {m.status}
                    </Badge>
                  </div>

                  {/* Sparkline */}
                  <div className="mb-3">
                    <MiniSparkline data={m.sparkline} color={m.color} />
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Accuracy', val: m.accuracy },
                      { label: 'Precision', val: m.precision },
                      { label: 'Recall', val: m.recall },
                      { label: 'F1', val: m.f1 },
                    ].map((metric) => (
                      <div key={metric.label} className="text-center">
                        <p className="text-[9px] text-nexus-muted uppercase">{metric.label}</p>
                        <p className="text-xs font-bold text-nexus-text">{metric.val}%</p>
                      </div>
                    ))}
                  </div>

                  {/* Training progress */}
                  {m.trainingProgress !== null && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] text-nexus-muted mb-1">
                        <span>Training Progress</span>
                        <span>{m.trainingProgress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-nexus-border/50 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${m.color}, ${m.color}CC)`,
                            boxShadow: `0 0 8px ${m.color}80`,
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${m.trainingProgress}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-nexus-border/30">
                    <span className="text-[10px] text-nexus-muted flex items-center gap-1">
                      <Clock size={10} /> {m.lastTrained}
                    </span>
                    <span className="text-[10px] text-nexus-muted flex items-center gap-1">
                      <Gauge size={10} /> {m.inferenceTime}ms
                    </span>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  5. RADAR + BAR SIDE BY SIDE                               */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RadarChart — metric comparison */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Target size={16} className="text-nexus-secondary" />
                <span>Model Metrics Comparison</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#888', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#666', fontSize: 9 }} axisLine={false} />
                {models.map((m, i) => (
                  <Radar
                    key={m.id}
                    name={m.name}
                    dataKey={m.id}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.08}
                    strokeWidth={1.5}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
                <RechartsTooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Horizontal BarChart — inference times */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                <span>Inference Time Comparison (ms)</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={inferenceData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#ccc', fontSize: 11 }} axisLine={false} width={80} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="time" radius={[0, 6, 6, 0]} barSize={20} name="Inference (ms)">
                  {inferenceData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="time" position="right" fill="#888" fontSize={10} formatter={(v: number) => `${v}ms`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  6. TRAINING HISTORY TIMELINE (ComposedChart)              */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-nexus-accent" />
              <span>Training History (Last 30 Days)</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trainingHistory} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="cumAccGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 9 }} axisLine={false} interval={4} />
              <YAxis yAxisId="left" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} domain={[80, 100]} label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} label={{ value: 'Sessions', angle: 90, position: 'insideRight', fill: '#888', fontSize: 10 }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
              <Bar yAxisId="right" dataKey="sessions" fill="#8B5CF6" fillOpacity={0.5} radius={[3, 3, 0, 0]} name="Training Sessions" barSize={12} />
              <Area yAxisId="left" type="monotone" dataKey="cumAccuracy" stroke="#10B981" fill="url(#cumAccGrad)" strokeWidth={2} name="Cumulative Accuracy" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  7. GPU / RESOURCE UTILIZATION (AreaChart)                  */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-cyan-400" />
              <span>GPU & Resource Utilization During Training</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={gpuData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gpuUtilG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gpuMemG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cpuTrG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} domain={[0, 100]} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
              <Area type="monotone" dataKey="gpuUtil" stackId="1" stroke="#3B82F6" fill="url(#gpuUtilG)" strokeWidth={2} name="GPU Utilization %" />
              <Area type="monotone" dataKey="gpuMemory" stackId="2" stroke="#8B5CF6" fill="url(#gpuMemG)" strokeWidth={2} name="GPU Memory %" />
              <Area type="monotone" dataKey="cpuUtil" stackId="3" stroke="#06B6D4" fill="url(#cpuTrG)" strokeWidth={2} name="CPU %" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  8. LOSS FUNCTION ANALYSIS (LineChart)                     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-red-400" />
              <span>Loss Function Analysis</span>
              <Badge variant="success" className="ml-auto">Converged</Badge>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lossData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="epoch" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} label={{ value: 'Epoch', position: 'insideBottomRight', offset: -5, fill: '#888', fontSize: 11 }} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#888' }} />
              <Line type="monotone" dataKey="train_loss" stroke="#EF4444" strokeWidth={2} dot={false} name="Training Loss" />
              <Line type="monotone" dataKey="val_loss" stroke="#F59E0B" strokeWidth={2} dot={<BestCheckpointDot />} name="Validation Loss" />
              <Line type="monotone" dataKey="test_loss" stroke="#F97316" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Test Loss" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  9. MODEL SIZE VS PERFORMANCE (ScatterChart)               */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-nexus-primary" />
              <span>Model Size vs. Performance</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                dataKey="params"
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                name="Parameters (M)"
                label={{ value: 'Parameters (M)', position: 'insideBottomRight', offset: -10, fill: '#888', fontSize: 11 }}
                scale="log"
                domain={['auto', 'auto']}
              />
              <YAxis
                type="number"
                dataKey="accuracy"
                tick={{ fill: '#888', fontSize: 10 }}
                axisLine={false}
                name="Accuracy"
                domain={[85, 100]}
                label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="speed" range={[60, 400]} name="Speed Score" />
              <RechartsTooltip content={<ScatterTooltipContent />} />
              <Scatter data={scatterData} shape={<CustomScatterDot />}>
                <LabelList dataKey="name" position="top" fill="#aaa" fontSize={9} offset={12} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  10. TRAINING QUEUE + 11. DATA PIPELINE (side by side)     */}
      {/* ════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Queue */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-nexus-accent" />
                <span>Training Queue & Schedule</span>
                <Badge variant="info" className="ml-auto">{trainingQueue.length} queued</Badge>
              </div>
            }
          >
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {trainingQueue.map((tq, idx) => (
                <motion.div
                  key={tq.model}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="rounded-lg border border-nexus-border/50 bg-nexus-card/40 p-3"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-nexus-text">{tq.model}</p>
                    <Badge
                      variant={tq.priority === 'high' ? 'error' : tq.priority === 'medium' ? 'warning' : 'neutral'}
                    >
                      {tq.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-nexus-muted mb-2">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {tq.scheduled}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {tq.duration}</span>
                  </div>
                  {tq.progress !== null ? (
                    <div>
                      <div className="flex justify-between text-[10px] text-nexus-muted mb-1">
                        <span>Training…</span>
                        <span>{tq.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-nexus-border/50 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-nexus-primary to-nexus-secondary"
                          initial={{ width: 0 }}
                          animate={{ width: `${tq.progress}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{ boxShadow: '0 0 8px rgba(59,130,246,0.5)' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-nexus-muted italic">Queued — waiting</p>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Data Pipeline Stats */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Database size={16} className="text-emerald-400" />
                <span>Data Pipeline Distribution</span>
              </div>
            }
          >
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-1/2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pipelineData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pipelineData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#888' }}
                      formatter={(value: string) => <span className="text-nexus-muted">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                <div className="rounded-lg border border-nexus-border/30 bg-nexus-surface/50 p-3">
                  <p className="text-[10px] text-nexus-muted uppercase tracking-wider mb-1">Total Samples</p>
                  <AnimatedNumber value={totalSamples} format="compact" className="text-xl font-bold text-nexus-text" />
                </div>
                <div className="rounded-lg border border-nexus-border/30 bg-nexus-surface/50 p-3">
                  <p className="text-[10px] text-nexus-muted uppercase tracking-wider mb-1">Data Quality Score</p>
                  <div className="flex items-center gap-2">
                    <AnimatedNumber value={96.4} format="percent" className="text-xl font-bold text-emerald-400" />
                    <CircularProgress value={96.4} size={36} strokeWidth={3} className="text-emerald-400" />
                  </div>
                </div>
                <div className="rounded-lg border border-nexus-border/30 bg-nexus-surface/50 p-3">
                  <p className="text-[10px] text-nexus-muted uppercase tracking-wider mb-1">Preprocessing Rate</p>
                  <div className="flex items-center gap-1">
                    <AnimatedNumber value={12840} format="compact" className="text-xl font-bold text-nexus-text" />
                    <span className="text-xs text-nexus-muted">samples/sec</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  12. CONFUSION MATRIX HEATMAP                              */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-violet-400" />
              <span>Confusion Matrix — Sentiment-BERT</span>
              <Badge variant="info" className="ml-auto">5-class classification</Badge>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <div className="min-w-[420px] mx-auto max-w-2xl">
              {/* Column headers */}
              <div className="flex mb-1 pl-20">
                {confusionLabels.map((label) => (
                  <div key={label} className="flex-1 text-center">
                    <span className="text-[9px] text-nexus-muted uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-nexus-muted text-center mb-2 uppercase tracking-wider">Predicted</p>

              {/* Rows */}
              <div className="space-y-1">
                {confusionMatrix.map((row, ri) => (
                  <div key={ri} className="flex items-center gap-1">
                    <div className="w-20 text-right pr-2">
                      <span className="text-[9px] text-nexus-muted uppercase tracking-wider">{confusionLabels[ri]}</span>
                    </div>
                    {row.map((val, ci) => {
                      const intensity = val / confMax;
                      const isDiag = ri === ci;
                      return (
                        <motion.div
                          key={ci}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (ri * 5 + ci) * 0.02 }}
                          className="flex-1 aspect-square flex items-center justify-center rounded-md border border-nexus-border/20 relative"
                          style={{
                            backgroundColor: isDiag
                              ? `rgba(16, 185, 129, ${0.15 + intensity * 0.6})`
                              : `rgba(239, 68, 68, ${intensity * 0.4})`,
                          }}
                          title={`${confusionLabels[ri]} → ${confusionLabels[ci]}: ${val}`}
                        >
                          <span
                            className={`text-xs font-bold ${
                              isDiag ? 'text-emerald-300' : intensity > 0.3 ? 'text-red-300' : 'text-nexus-muted'
                            }`}
                          >
                            {val}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-nexus-muted mt-2 uppercase tracking-wider flex items-center gap-1">
                <span className="transform -rotate-90 text-[8px]">Actual</span>
              </p>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: 'rgba(16,185,129,0.5)' }} />
                  <span className="text-[10px] text-nexus-muted">Correct (Diagonal)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.3)' }} />
                  <span className="text-[10px] text-nexus-muted">Misclassified</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  13. MODEL ARCHITECTURE SUMMARY                            */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-nexus-primary" />
              <span>Model Architecture Overview</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {models.map((m) => {
              const Icon = m.icon;
              const layers = Math.round(m.paramsNum * 0.012 + 12);
              const attentionHeads = m.paramsNum > 100 ? 32 : m.paramsNum > 40 ? 16 : 8;
              const vocabSize = m.type.includes('Language') ? '32K' : m.type.includes('Speech') ? '16K' : m.type.includes('Text') ? '30K' : '-';
              const embeddingDim = m.paramsNum > 100 ? 4096 : m.paramsNum > 40 ? 2048 : 768;

              return (
                <motion.div
                  key={m.id}
                  whileHover={{ scale: 1.01 }}
                  className="rounded-lg border border-nexus-border/40 bg-nexus-surface/30 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${m.color}15`, color: m.color }}
                    >
                      <Icon size={14} />
                    </div>
                    <p className="text-xs font-semibold text-nexus-text">{m.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[9px] text-nexus-muted">Layers</span>
                      <span className="text-[9px] font-medium text-nexus-text">{layers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-nexus-muted">Attention Heads</span>
                      <span className="text-[9px] font-medium text-nexus-text">{attentionHeads}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-nexus-muted">Embedding Dim</span>
                      <span className="text-[9px] font-medium text-nexus-text">{embeddingDim}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-nexus-muted">Vocab Size</span>
                      <span className="text-[9px] font-medium text-nexus-text">{vocabSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-nexus-muted">Framework</span>
                      <span className="text-[9px] font-medium text-nexus-text">PyTorch 2.x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px] text-nexus-muted">Quantization</span>
                      <span className="text-[9px] font-medium text-nexus-text">{m.paramsNum > 100 ? 'INT8' : 'FP16'}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* ════════════════════════════════════════════════════════════ */}
      {/*  14. TRAINING INSIGHTS & KEY METRICS                       */}
      {/* ════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <FlaskConical size={16} className="text-pink-400" />
              <span>Training Insights</span>
            </div>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Training Hours', value: 1247, icon: Clock, color: '#3B82F6', format: 'none' as const },
              { label: 'Experiments Run', value: 342, icon: FlaskConical, color: '#8B5CF6', format: 'none' as const },
              { label: 'Best Epoch Avg', value: 24.6, icon: Star, color: '#F59E0B', format: 'none' as const },
              { label: 'GPU Hours Used', value: 892, icon: Cpu, color: '#06B6D4', format: 'none' as const },
            ].map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="rounded-lg border border-nexus-border/30 bg-nexus-surface/30 p-4 text-center"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg mx-auto mb-2"
                    style={{ backgroundColor: `${metric.color}15`, color: metric.color }}
                  >
                    <MetricIcon size={18} />
                  </div>
                  <AnimatedNumber
                    value={metric.value}
                    format={metric.format}
                    className="text-xl font-bold text-nexus-text"
                  />
                  <p className="text-[9px] text-nexus-muted uppercase tracking-wider mt-1">{metric.label}</p>
                </div>
              );
            })}
          </div>

          {/* Insights list */}
          <div className="mt-4 space-y-2">
            {[
              { text: 'Anomaly-Detector achieved best-in-class accuracy at 97.3% with only 15M parameters', badge: 'success' as const },
              { text: 'Voice-Transformer convergence time improved by 18% with new learning rate scheduler', badge: 'info' as const },
              { text: 'Recommendation-Engine may benefit from additional training data — recall below target', badge: 'warning' as const },
              { text: 'GPU utilization peaked at 94% during Nexus-7B training — consider scaling resources', badge: 'warning' as const },
              { text: 'All models passed validation checks — no overfitting detected in latest runs', badge: 'success' as const },
            ].map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 rounded-lg p-2 hover:bg-white/5 transition-colors"
              >
                <ChevronRight size={12} className="text-nexus-muted mt-0.5 shrink-0" />
                <p className="text-xs text-nexus-text flex-1">{insight.text}</p>
                <Badge variant={insight.badge} className="shrink-0">
                  {insight.badge === 'success' ? 'OK' : insight.badge === 'info' ? 'Note' : 'Alert'}
                </Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
