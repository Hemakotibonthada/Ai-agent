import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Play, Pause, Plus, Trash2, Settings2, Check,
  ChevronRight, Clock, CheckCircle2, XCircle, AlertTriangle,
  Zap, ArrowRight, Eye, Edit3, Download, Layers, RefreshCw,
  Filter, GitMerge, BarChart2, Activity, FileText, Code,
  Search, ArrowDown, ArrowUp, Box, Terminal, Table2
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';
import EmptyState from '@/components/shared/EmptyState';

// ─── Types ──────────────────────────────────────────────────────────
interface PipelineStep {
  id: string;
  type: 'source' | 'filter' | 'transform' | 'aggregate' | 'validate' | 'sink';
  name: string;
  config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: string;
  recordsIn?: number;
  recordsOut?: number;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft' | 'error';
  steps: PipelineStep[];
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  runs: number;
  successRate: number;
  avgDuration: string;
  totalRecords: number;
  tags: string[];
}

// ─── Sample Pipelines ──────────────────────────────────────────────
const samplePipelines: Pipeline[] = [
  {
    id: 'dp-1',
    name: 'User Analytics ETL',
    description: 'Extract user behavior data, transform for analytics, load into warehouse',
    status: 'active',
    steps: [
      { id: 's1', type: 'source', name: 'User Events DB', config: {}, status: 'completed', duration: '2s', recordsIn: 15000, recordsOut: 15000 },
      { id: 's2', type: 'filter', name: 'Remove Bots', config: {}, status: 'completed', duration: '1s', recordsIn: 15000, recordsOut: 12500 },
      { id: 's3', type: 'transform', name: 'Enrich Data', config: {}, status: 'completed', duration: '3s', recordsIn: 12500, recordsOut: 12500 },
      { id: 's4', type: 'aggregate', name: 'Daily Summary', config: {}, status: 'completed', duration: '2s', recordsIn: 12500, recordsOut: 365 },
      { id: 's5', type: 'validate', name: 'Quality Check', config: {}, status: 'completed', duration: '0.5s', recordsIn: 365, recordsOut: 362 },
      { id: 's6', type: 'sink', name: 'Analytics DB', config: {}, status: 'completed', duration: '1s', recordsIn: 362, recordsOut: 362 },
    ],
    schedule: 'Every 6 hours',
    lastRun: '2 hours ago',
    nextRun: 'In 4 hours',
    runs: 487,
    successRate: 99.2,
    avgDuration: '12s',
    totalRecords: 7250000,
    tags: ['analytics', 'etl', 'scheduled'],
  },
  {
    id: 'dp-2',
    name: 'Transaction ETL Pipeline',
    description: 'Process financial transactions with fraud detection and reconciliation',
    status: 'active',
    steps: [
      { id: 's1', type: 'source', name: 'Transaction Feed', config: {}, status: 'completed', duration: '1s', recordsIn: 5000, recordsOut: 5000 },
      { id: 's2', type: 'transform', name: 'Normalize Currency', config: {}, status: 'completed', duration: '2s', recordsIn: 5000, recordsOut: 5000 },
      { id: 's3', type: 'validate', name: 'Fraud Detection', config: {}, status: 'completed', duration: '5s', recordsIn: 5000, recordsOut: 4950 },
      { id: 's4', type: 'aggregate', name: 'Account Totals', config: {}, status: 'completed', duration: '1s', recordsIn: 4950, recordsOut: 250 },
      { id: 's5', type: 'sink', name: 'Finance DB', config: {}, status: 'completed', duration: '1s', recordsIn: 250, recordsOut: 250 },
    ],
    schedule: 'Every hour',
    lastRun: '45 min ago',
    nextRun: 'In 15 min',
    runs: 2156,
    successRate: 99.8,
    avgDuration: '10s',
    totalRecords: 10750000,
    tags: ['finance', 'fraud', 'real-time'],
  },
  {
    id: 'dp-3',
    name: 'Sensor Data Pipeline',
    description: 'Process IoT sensor data with anomaly detection and aggregation',
    status: 'active',
    steps: [
      { id: 's1', type: 'source', name: 'MQTT Sensors', config: {}, status: 'completed', duration: '0.5s', recordsIn: 50000, recordsOut: 50000 },
      { id: 's2', type: 'filter', name: 'Remove Noise', config: {}, status: 'completed', duration: '2s', recordsIn: 50000, recordsOut: 45000 },
      { id: 's3', type: 'transform', name: 'Normalize Values', config: {}, status: 'running', duration: '3s', recordsIn: 45000, recordsOut: 45000 },
      { id: 's4', type: 'validate', name: 'Anomaly Detection', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
      { id: 's5', type: 'aggregate', name: '5-min Averages', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
      { id: 's6', type: 'sink', name: 'Time-Series DB', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
    ],
    schedule: 'Every 5 minutes',
    lastRun: '3 min ago',
    nextRun: 'In 2 min',
    runs: 12450,
    successRate: 98.5,
    avgDuration: '8s',
    totalRecords: 99600000,
    tags: ['iot', 'sensors', 'real-time'],
  },
  {
    id: 'dp-4',
    name: 'Email Processing',
    description: 'Parse, classify, and route incoming emails',
    status: 'paused',
    steps: [
      { id: 's1', type: 'source', name: 'IMAP Inbox', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
      { id: 's2', type: 'transform', name: 'Parse Content', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
      { id: 's3', type: 'transform', name: 'AI Classify', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
      { id: 's4', type: 'sink', name: 'Route to Teams', config: {}, status: 'pending', recordsIn: 0, recordsOut: 0 },
    ],
    schedule: 'Every 15 minutes',
    lastRun: '2 days ago',
    nextRun: 'Paused',
    runs: 890,
    successRate: 96.5,
    avgDuration: '15s',
    totalRecords: 890000,
    tags: ['email', 'ai', 'routing'],
  },
];

// ─── Step Type Styling ──────────────────────────────────────────────
const stepTypeConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  source: { color: 'text-blue-500', bgColor: 'bg-blue-500', icon: <Database size={14} /> },
  filter: { color: 'text-yellow-500', bgColor: 'bg-yellow-500', icon: <Filter size={14} /> },
  transform: { color: 'text-purple-500', bgColor: 'bg-purple-500', icon: <RefreshCw size={14} /> },
  aggregate: { color: 'text-indigo-500', bgColor: 'bg-indigo-500', icon: <GitMerge size={14} /> },
  validate: { color: 'text-green-500', bgColor: 'bg-green-500', icon: <Check size={14} /> },
  sink: { color: 'text-cyan-500', bgColor: 'bg-cyan-500', icon: <ArrowDown size={14} /> },
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={12} className="text-nexus-muted" />,
  running: <RefreshCw size={12} className="text-blue-500 animate-spin" />,
  completed: <CheckCircle2 size={12} className="text-green-500" />,
  failed: <XCircle size={12} className="text-red-500" />,
};

// ─── Chart Data ─────────────────────────────────────────────────────
const throughputData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  records: Math.floor(Math.random() * 50000 + 10000),
  errors: Math.floor(Math.random() * 100),
}));

const pipelineDistribution = [
  { name: 'Analytics', value: 40, color: '#6366f1' },
  { name: 'Finance', value: 25, color: '#10b981' },
  { name: 'IoT', value: 20, color: '#f59e0b' },
  { name: 'Email', value: 15, color: '#ef4444' },
];

// ─── Pipeline Card ──────────────────────────────────────────────────
const PipelineCard: React.FC<{
  pipeline: Pipeline;
  onClick: () => void;
  index: number;
}> = ({ pipeline, onClick, index }) => {
  const completedSteps = pipeline.steps.filter(s => s.status === 'completed').length;
  const progress = (completedSteps / pipeline.steps.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
      onClick={onClick}
      className="bg-nexus-card rounded-2xl p-6 border border-nexus-border cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10">
            <Database size={20} className="text-cyan-500" />
          </div>
          <div>
            <h3 className="font-semibold text-nexus-text">{pipeline.name}</h3>
            <p className="text-sm text-nexus-muted mt-0.5 line-clamp-1">{pipeline.description}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          pipeline.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
          pipeline.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
          pipeline.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
          'bg-nexus-surface text-nexus-text'
        }`}>
          {pipeline.status}
        </span>
      </div>

      {/* Pipeline Steps Visualization */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {pipeline.steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${
                step.status === 'completed' ? stepTypeConfig[step.type]?.bgColor || 'bg-gray-500' :
                step.status === 'running' ? 'bg-blue-500 animate-pulse' :
                'bg-nexus-border'
              }`}>
                {statusIcons[step.status] || stepTypeConfig[step.type]?.icon}
              </div>
            </div>
            {i < pipeline.steps.length - 1 && (
              <div className={`w-4 h-0.5 ${step.status === 'completed' ? 'bg-green-400' : 'bg-nexus-surface'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-nexus-muted mb-1">
          <span>{completedSteps}/{pipeline.steps.length} steps</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-nexus-surface rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, delay: index * 0.1 }}
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center">
          <div className="text-sm font-bold text-nexus-text">{pipeline.runs.toLocaleString()}</div>
          <div className="text-xs text-nexus-muted">Runs</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-green-500">{pipeline.successRate}%</div>
          <div className="text-xs text-nexus-muted">Success</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-nexus-text">{pipeline.avgDuration}</div>
          <div className="text-xs text-nexus-muted">Avg Time</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-nexus-text">
            {pipeline.totalRecords > 1000000 ? `${(pipeline.totalRecords / 1000000).toFixed(1)}M` : `${(pipeline.totalRecords / 1000).toFixed(0)}k`}
          </div>
          <div className="text-xs text-nexus-muted">Records</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-nexus-border text-xs text-nexus-muted">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>{pipeline.schedule}</span>
        </div>
        <div className="flex gap-1">
          {pipeline.tags.slice(0, 2).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Pipeline Detail Panel ──────────────────────────────────────────
const PipelineDetail: React.FC<{ pipeline: Pipeline; onClose: () => void }> = ({ pipeline, onClose }) => (
  <motion.div
    initial={{ opacity: 0, x: 300 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 300 }}
    className="fixed inset-y-0 right-0 w-full max-w-xl bg-nexus-card border-l border-nexus-border shadow-2xl z-50 overflow-y-auto"
  >
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-nexus-text">{pipeline.name}</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-nexus-surface">
          <XCircle size={20} className="text-nexus-muted" />
        </button>
      </div>

      <p className="text-nexus-muted mb-6">{pipeline.description}</p>

      {/* Data Flow Visualization */}
      <h3 className="text-sm font-semibold uppercase tracking-wider text-nexus-text mb-4">Data Flow</h3>
      <div className="space-y-3 mb-6">
        {pipeline.steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            {i > 0 && <div className="flex items-center gap-2 py-1 pl-6">
              <ArrowDown size={14} className="text-nexus-muted" />
              {step.recordsIn !== undefined && step.recordsIn > 0 && (
                <span className="text-xs text-nexus-muted">{step.recordsIn?.toLocaleString()} records</span>
              )}
            </div>}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              step.status === 'completed' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10' :
              step.status === 'running' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' :
              step.status === 'failed' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' :
              'border-nexus-border bg-nexus-surface/50'
            }`}>
              <div className={`p-2 rounded-lg ${stepTypeConfig[step.type]?.bgColor || 'bg-gray-500'} text-white`}>
                {stepTypeConfig[step.type]?.icon}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-nexus-text">{step.name}</div>
                <div className="text-xs text-nexus-muted capitalize">{step.type}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs">
                  {statusIcons[step.status]}
                  <span className="capitalize text-nexus-muted">{step.status}</span>
                </div>
                {step.duration && <div className="text-xs text-nexus-muted mt-0.5">{step.duration}</div>}
              </div>
              {step.recordsOut !== undefined && step.recordsOut > 0 && (
                <div className="text-right">
                  <div className="text-xs font-medium text-nexus-text">{step.recordsOut?.toLocaleString()}</div>
                  <div className="text-xs text-nexus-muted">out</div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Statistics */}
      <h3 className="text-sm font-semibold uppercase tracking-wider text-nexus-text mb-3">Statistics</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Total Runs', value: pipeline.runs.toLocaleString() },
          { label: 'Success Rate', value: `${pipeline.successRate}%` },
          { label: 'Avg Duration', value: pipeline.avgDuration },
          { label: 'Total Records', value: pipeline.totalRecords > 1000000 ? `${(pipeline.totalRecords / 1000000).toFixed(1)}M` : `${(pipeline.totalRecords / 1000).toFixed(0)}k` },
        ].map(stat => (
          <div key={stat.label} className="p-3 rounded-xl bg-nexus-surface/50">
            <div className="text-xl font-bold text-nexus-text">{stat.value}</div>
            <div className="text-xs text-nexus-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-xl font-medium"
        >
          <Play size={18} /> Execute
        </motion.button>
        <button className="px-4 py-3 bg-nexus-surface text-nexus-text rounded-xl font-medium">
          <Settings2 size={18} />
        </button>
      </div>
    </div>
  </motion.div>
);

// ─── Main DataPipelines Page ────────────────────────────────────────
const DataPipelines: React.FC = () => {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No data pipelines" description="Create a data pipeline to process and transform your data." /></div>;
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<'pipelines' | 'monitoring' | 'sources'>('pipelines');

  const filteredPipelines = useMemo(() =>
    samplePipelines.filter(p =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [searchQuery]);

  const totalStats = useMemo(() => ({
    pipelines: samplePipelines.length,
    active: samplePipelines.filter(p => p.status === 'active').length,
    totalRuns: samplePipelines.reduce((s, p) => s + p.runs, 0),
    totalRecords: samplePipelines.reduce((s, p) => s + p.totalRecords, 0),
  }), []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <Database className="text-cyan-500" size={32} />
              Data Pipelines
            </h1>
            <p className="text-nexus-muted mt-1">Build, manage, and monitor ETL pipelines</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 shadow-lg shadow-cyan-500/25"
          >
            <Plus size={18} /> New Pipeline
          </motion.button>
        </div>
      </FadeIn>

      {/* Stats */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pipelines', value: totalStats.pipelines, icon: <Layers size={18} className="text-cyan-500" />, color: 'bg-cyan-500/10' },
            { label: 'Active', value: totalStats.active, icon: <Activity size={18} className="text-green-500" />, color: 'bg-green-500/10' },
            { label: 'Total Executions', value: totalStats.totalRuns.toLocaleString(), icon: <Play size={18} className="text-blue-500" />, color: 'bg-blue-500/10' },
            { label: 'Records Processed', value: `${(totalStats.totalRecords / 1000000).toFixed(0)}M`, icon: <Table2 size={18} className="text-purple-500" />, color: 'bg-purple-500/10' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-nexus-card rounded-xl p-4 border border-nexus-border"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>{stat.icon}</div>
                <div>
                  <div className="text-xl font-bold text-nexus-text">{stat.value}</div>
                  <div className="text-xs text-nexus-muted">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </FadeIn>

      {/* Tabs */}
      <FadeIn delay={0.15}>
        <div className="flex items-center gap-1 bg-nexus-surface rounded-xl p-1 w-fit">
          {[
            { id: 'pipelines' as const, label: 'Pipelines', icon: <Layers size={14} /> },
            { id: 'monitoring' as const, label: 'Monitoring', icon: <Activity size={14} /> },
            { id: 'sources' as const, label: 'Data Sources', icon: <Database size={14} /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-nexus-text shadow-sm'
                  : 'text-nexus-muted hover:text-nexus-text'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {tab === 'pipelines' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input
              type="text"
              placeholder="Search pipelines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md pl-10 pr-4 py-2.5 rounded-xl bg-nexus-card border border-nexus-border text-nexus-text focus:ring-2 focus:ring-cyan-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredPipelines.map((pipeline, i) => (
              <PipelineCard
                key={pipeline.id}
                pipeline={pipeline}
                index={i}
                onClick={() => setSelectedPipeline(pipeline)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'monitoring' && (
        <FadeIn>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Throughput Chart */}
            <div className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
              <h3 className="font-semibold text-nexus-text mb-4">Records Throughput (24h)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={throughputData}>
                  <defs>
                    <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="records" stroke="#06b6d4" fill="url(#throughputGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Distribution Pie */}
            <div className="bg-nexus-card rounded-2xl p-6 border border-nexus-border">
              <h3 className="font-semibold text-nexus-text mb-4">Pipeline Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pipelineDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                    {pipelineDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {pipelineDistribution.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-nexus-muted">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Error Rate Chart */}
            <div className="bg-nexus-card rounded-2xl p-6 border border-nexus-border xl:col-span-2">
              <h3 className="font-semibold text-nexus-text mb-4">Error Rate (24h)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>
      )}

      {tab === 'sources' && (
        <FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'User Events DB', type: 'PostgreSQL', status: 'connected', records: '15.2M', icon: <Database size={20} /> },
              { name: 'Transaction Feed', type: 'Kafka', status: 'connected', records: '10.7M', icon: <Activity size={20} /> },
              { name: 'MQTT Sensors', type: 'MQTT Broker', status: 'connected', records: '99.6M', icon: <Zap size={20} /> },
              { name: 'IMAP Inbox', type: 'IMAP', status: 'disconnected', records: '890k', icon: <FileText size={20} /> },
              { name: 'Analytics DB', type: 'ClickHouse', status: 'connected', records: '7.2M', icon: <BarChart2 size={20} /> },
              { name: 'Time-Series DB', type: 'InfluxDB', status: 'connected', records: '45.3M', icon: <Activity size={20} /> },
            ].map((source, i) => (
              <motion.div
                key={source.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-nexus-card rounded-2xl p-5 border border-nexus-border"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">{source.icon}</div>
                  <div>
                    <h4 className="font-semibold text-nexus-text">{source.name}</h4>
                    <span className="text-xs text-nexus-muted">{source.type}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${
                    source.status === 'connected' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${source.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                    {source.status}
                  </span>
                  <span className="text-sm font-medium text-nexus-text">{source.records} records</span>
                </div>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedPipeline && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPipeline(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <PipelineDetail pipeline={selectedPipeline} onClose={() => setSelectedPipeline(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataPipelines;
