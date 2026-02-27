import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Play, Pause, BarChart3, TrendingUp, Users,
  Target, Clock, CheckCircle, XCircle, AlertCircle, Plus,
  Search, Filter, ChevronRight, ChevronDown, Settings,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Copy,
  Trash2, Edit, Eye, Code, Zap, Star, Archive, GitBranch,
  Percent, Activity, Layers
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  status: 'running' | 'completed' | 'paused' | 'draft';
  type: 'a/b' | 'multivariate' | 'feature-flag' | 'canary';
  metric: string;
  startDate: string;
  endDate?: string;
  traffic: number;
  variants: Variant[];
  results?: ExperimentResult;
}

interface Variant {
  id: string;
  name: string;
  traffic: number;
  color: string;
}

interface ExperimentResult {
  winner?: string;
  confidence: number;
  improvement: number;
  totalSamples: number;
  conversionData: { date: string; control: number; treatment: number }[];
}

const experiments: Experiment[] = [
  {
    id: '1', name: 'Dashboard Layout v2', hypothesis: 'A grid-based dashboard leads to higher feature discovery',
    status: 'running', type: 'a/b', metric: 'Feature clicks per session', startDate: '2024-01-10', traffic: 50,
    variants: [
      { id: 'ctrl', name: 'Control (Current)', traffic: 50, color: '#6b7280' },
      { id: 'var_a', name: 'Grid Layout', traffic: 50, color: '#3b82f6' },
    ],
    results: {
      confidence: 87.3, improvement: 12.4, totalSamples: 4520,
      conversionData: Array.from({ length: 14 }, (_, i) => ({
        date: `Jan ${i + 10}`, control: 15 + Math.random() * 5, treatment: 17 + Math.random() * 6,
      })),
    },
  },
  {
    id: '2', name: 'Voice Command Wake Word', hypothesis: 'Shorter wake words increase voice activation rate',
    status: 'completed', type: 'multivariate', metric: 'Activations per day', startDate: '2024-01-01', endDate: '2024-01-14', traffic: 100,
    variants: [
      { id: 'ctrl', name: 'Hey Nexus', traffic: 34, color: '#6b7280' },
      { id: 'var_a', name: 'Nexus', traffic: 33, color: '#3b82f6' },
      { id: 'var_b', name: 'Hey AI', traffic: 33, color: '#10b981' },
    ],
    results: {
      winner: 'var_a', confidence: 96.2, improvement: 28.7, totalSamples: 8930,
      conversionData: Array.from({ length: 14 }, (_, i) => ({
        date: `Jan ${i + 1}`, control: 5 + Math.random() * 3, treatment: 7 + Math.random() * 4,
      })),
    },
  },
  {
    id: '3', name: 'Notification Grouping', hypothesis: 'Grouped notifications reduce dismiss rate',
    status: 'running', type: 'a/b', metric: 'Notification engagement rate', startDate: '2024-01-12', traffic: 30,
    variants: [
      { id: 'ctrl', name: 'Individual', traffic: 50, color: '#6b7280' },
      { id: 'var_a', name: 'Grouped', traffic: 50, color: '#8b5cf6' },
    ],
    results: {
      confidence: 72.1, improvement: 8.9, totalSamples: 2180,
      conversionData: Array.from({ length: 10 }, (_, i) => ({
        date: `Jan ${i + 12}`, control: 40 + Math.random() * 10, treatment: 45 + Math.random() * 10,
      })),
    },
  },
  {
    id: '4', name: 'Agent Response Format', hypothesis: 'Markdown-formatted responses improve comprehension',
    status: 'paused', type: 'a/b', metric: 'User satisfaction score', startDate: '2024-01-08', traffic: 20,
    variants: [
      { id: 'ctrl', name: 'Plain Text', traffic: 50, color: '#6b7280' },
      { id: 'var_a', name: 'Rich Markdown', traffic: 50, color: '#f59e0b' },
    ],
    results: {
      confidence: 45.8, improvement: 3.2, totalSamples: 890,
      conversionData: Array.from({ length: 6 }, (_, i) => ({
        date: `Jan ${i + 8}`, control: 72 + Math.random() * 5, treatment: 73 + Math.random() * 6,
      })),
    },
  },
  {
    id: '5', name: 'API Rate Limiting Strategy', hypothesis: 'Token bucket algorithm improves API throughput',
    status: 'draft', type: 'canary', metric: 'Request success rate', startDate: '', traffic: 5,
    variants: [
      { id: 'ctrl', name: 'Fixed Window', traffic: 95, color: '#6b7280' },
      { id: 'var_a', name: 'Token Bucket', traffic: 5, color: '#ef4444' },
    ],
  },
  {
    id: '6', name: 'Smart Home Auto-Scene', hypothesis: 'Predictive scene changes improve user comfort ratings',
    status: 'completed', type: 'feature-flag', metric: 'Comfort survey score', startDate: '2024-01-05', endDate: '2024-01-18', traffic: 50,
    variants: [
      { id: 'ctrl', name: 'Manual Scenes', traffic: 50, color: '#6b7280' },
      { id: 'var_a', name: 'Auto Scenes', traffic: 50, color: '#10b981' },
    ],
    results: {
      winner: 'var_a', confidence: 94.1, improvement: 18.5, totalSamples: 6700,
      conversionData: Array.from({ length: 13 }, (_, i) => ({
        date: `Jan ${i + 5}`, control: 60 + Math.random() * 8, treatment: 70 + Math.random() * 10,
      })),
    },
  },
];

const statusConfig = {
  running: { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', icon: <Play size={12} /> },
  completed: { color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', icon: <CheckCircle size={12} /> },
  paused: { color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10', icon: <Pause size={12} /> },
  draft: { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10', icon: <Edit size={12} /> },
};

const COLORS = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const ExperimentTracker: React.FC = () => {
  const isDemo = useIsDemoAccount();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(experiments[0]);

  const filtered = useMemo(() =>
    experiments.filter(e =>
      (statusFilter === 'all' || e.status === statusFilter) &&
      (search === '' || e.name.toLowerCase().includes(search.toLowerCase()))
    ),
  [search, statusFilter]);

  if (!isDemo) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-2">
        <p className="text-nexus-muted text-sm">No experiments available</p>
        <p className="text-nexus-muted text-xs">Create an experiment to start tracking</p>
      </div>
    </div>
  );

  const summaryStats = {
    total: experiments.length,
    running: experiments.filter(e => e.status === 'running').length,
    completed: experiments.filter(e => e.status === 'completed').length,
    avgConfidence: Math.round(
      experiments.filter(e => e.results).reduce((sum, e) => sum + (e.results?.confidence || 0), 0) /
      experiments.filter(e => e.results).length
    ),
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FlaskConical className="text-purple-500" size={32} />
              Experiments
            </h1>
            <p className="text-gray-500 mt-1">A/B tests, feature flags, and experiment tracking</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium">
            <Plus size={14} /> New Experiment
          </motion.button>
        </div>
      </FadeIn>

      {/* Summary */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Experiments', value: summaryStats.total, icon: <FlaskConical size={16} />, color: 'text-purple-500' },
            { label: 'Running', value: summaryStats.running, icon: <Play size={16} />, color: 'text-blue-500' },
            { label: 'Completed', value: summaryStats.completed, icon: <CheckCircle size={16} />, color: 'text-green-500' },
            { label: 'Avg Confidence', value: `${summaryStats.avgConfidence}%`, icon: <Target size={16} />, color: 'text-orange-500' },
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
        {/* Experiment List */}
        <div className="lg:col-span-1 space-y-4">
          <FadeIn delay={0.1}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search experiments..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'running', 'completed', 'paused', 'draft'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    statusFilter === s ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}>{s}</button>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="space-y-2">
              {filtered.map(exp => {
                const sc = statusConfig[exp.status];
                return (
                  <motion.div key={exp.id} whileHover={{ x: 4 }}
                    onClick={() => setSelectedExperiment(exp)}
                    className={`bg-white dark:bg-gray-800 rounded-xl p-3 border cursor-pointer transition-colors ${
                      selectedExperiment?.id === exp.id
                        ? 'border-purple-300 dark:border-purple-600'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`${sc.color}`}>{sc.icon}</span>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{exp.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className={`px-1.5 py-0.5 rounded ${sc.bg} ${sc.color} font-medium capitalize`}>{exp.status}</span>
                      <span className="capitalize">{exp.type}</span>
                      {exp.results && <span>{exp.results.confidence.toFixed(0)}% conf</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </FadeIn>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {selectedExperiment ? (
              <motion.div key={selectedExperiment.id}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedExperiment.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">{selectedExperiment.hypothesis}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${statusConfig[selectedExperiment.status].bg} ${statusConfig[selectedExperiment.status].color}`}>
                      {selectedExperiment.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="text-[10px] text-gray-500 uppercase">Type</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white capitalize">{selectedExperiment.type}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="text-[10px] text-gray-500 uppercase">Metric</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedExperiment.metric}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="text-[10px] text-gray-500 uppercase">Traffic</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedExperiment.traffic}%</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <div className="text-[10px] text-gray-500 uppercase">Start Date</div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{selectedExperiment.startDate || 'Not started'}</div>
                    </div>
                  </div>
                </div>

                {/* Variants */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Variants</h3>
                  <div className="space-y-2">
                    {selectedExperiment.variants.map(variant => (
                      <div key={variant.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: variant.color }} />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{variant.name}</div>
                          <div className="text-[10px] text-gray-500">{variant.traffic}% traffic</div>
                        </div>
                        {selectedExperiment.results?.winner === variant.id && (
                          <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium flex items-center gap-1">
                            <Star size={10} /> Winner
                          </span>
                        )}
                        <div className="h-1.5 w-24 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${variant.traffic}%`, backgroundColor: variant.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Results Chart */}
                {selectedExperiment.results && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Results</h3>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Target size={12} className="text-blue-500" />
                          Confidence: <span className="font-bold">{selectedExperiment.results.confidence}%</span>
                        </span>
                        <span className="flex items-center gap-1">
                          {selectedExperiment.results.improvement >= 0
                            ? <ArrowUpRight size={12} className="text-green-500" />
                            : <ArrowDownRight size={12} className="text-red-500" />}
                          Improvement: <span className={`font-bold ${selectedExperiment.results.improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {selectedExperiment.results.improvement >= 0 ? '+' : ''}{selectedExperiment.results.improvement}%
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={12} className="text-gray-500" />
                          Samples: {selectedExperiment.results.totalSamples.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={selectedExperiment.results.conversionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }} />
                        <Area type="monotone" dataKey="control" name="Control" stroke="#6b7280" fill="#6b7280" fillOpacity={0.15} />
                        <Area type="monotone" dataKey="treatment" name="Treatment" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>

                    {/* Confidence Bar */}
                    <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-gray-500">Statistical Confidence</span>
                        <span className={`font-bold ${selectedExperiment.results.confidence >= 95 ? 'text-green-500' : selectedExperiment.results.confidence >= 80 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {selectedExperiment.results.confidence}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${selectedExperiment.results.confidence}%` }}
                          transition={{ duration: 1 }}
                          className={`h-full rounded-full ${
                            selectedExperiment.results.confidence >= 95 ? 'bg-green-500' :
                            selectedExperiment.results.confidence >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>0%</span>
                        <span className="text-yellow-500">80% threshold</span>
                        <span className="text-green-500">95% significant</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <FlaskConical size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 text-sm">Select an experiment to view details</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ExperimentTracker;
