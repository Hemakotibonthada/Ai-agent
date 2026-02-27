import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Workflow, Play, Pause, Plus, Trash2, Settings2, Copy,
  ChevronRight, Clock, CheckCircle2, XCircle, AlertTriangle,
  Zap, Bell, Mail, Database, GitBranch, ArrowRight,
  MoreVertical, Search, Filter, Eye, Edit3, Download, Layers,
  Timer, Repeat, Code, Globe, Shield, FileText, BarChart2
} from 'lucide-react';
import { FadeIn, ScaleIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';
import EmptyState from '@/components/shared/EmptyState';

// ─── Types ──────────────────────────────────────────────────────────
interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  icon: string;
  color: string;
  config: Record<string, any>;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'paused' | 'error';
  nodes: WorkflowNode[];
  lastRun?: string;
  nextRun?: string;
  runs: number;
  successRate: number;
  avgDuration: string;
  tags: string[];
  createdBy: string;
}

// ─── Sample Workflows ──────────────────────────────────────────────
const sampleWorkflows: WorkflowData[] = [
  {
    id: 'wf-1',
    name: 'Daily Morning Routine',
    description: 'Automated morning briefing with weather, calendar, and task summary',
    status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', name: 'Schedule (7:00 AM)', icon: 'clock', color: 'blue', config: {} },
      { id: 'n2', type: 'action', name: 'Get Weather', icon: 'cloud', color: 'cyan', config: {} },
      { id: 'n3', type: 'action', name: 'Get Calendar', icon: 'calendar', color: 'purple', config: {} },
      { id: 'n4', type: 'action', name: 'Summarize Tasks', icon: 'list', color: 'indigo', config: {} },
      { id: 'n5', type: 'notification', name: 'Send Briefing', icon: 'bell', color: 'green', config: {} },
    ],
    lastRun: '2 hours ago',
    nextRun: 'Tomorrow 7:00 AM',
    runs: 145,
    successRate: 99.3,
    avgDuration: '12s',
    tags: ['daily', 'productivity', 'automated'],
    createdBy: 'System',
  },
  {
    id: 'wf-2',
    name: 'Security Alert Pipeline',
    description: 'Monitor security events and escalate critical alerts',
    status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', name: 'Security Event', icon: 'shield', color: 'red', config: {} },
      { id: 'n2', type: 'condition', name: 'Check Severity', icon: 'git-branch', color: 'yellow', config: {} },
      { id: 'n3', type: 'action', name: 'Log Event', icon: 'file-text', color: 'gray', config: {} },
      { id: 'n4', type: 'notification', name: 'Alert Admin', icon: 'bell', color: 'red', config: {} },
      { id: 'n5', type: 'action', name: 'Lock System', icon: 'lock', color: 'red', config: {} },
    ],
    lastRun: '15 min ago',
    nextRun: 'On event',
    runs: 892,
    successRate: 100,
    avgDuration: '3s',
    tags: ['security', 'critical', 'real-time'],
    createdBy: 'Admin',
  },
  {
    id: 'wf-3',
    name: 'Smart Home Automation',
    description: 'Adjust home devices based on occupancy and time of day',
    status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', name: 'Motion Sensor', icon: 'eye', color: 'green', config: {} },
      { id: 'n2', type: 'condition', name: 'Time Check', icon: 'clock', color: 'blue', config: {} },
      { id: 'n3', type: 'action', name: 'Adjust Lights', icon: 'sun', color: 'yellow', config: {} },
      { id: 'n4', type: 'action', name: 'Set HVAC', icon: 'thermometer', color: 'orange', config: {} },
    ],
    lastRun: '5 min ago',
    nextRun: 'On event',
    runs: 2341,
    successRate: 98.7,
    avgDuration: '1s',
    tags: ['smart-home', 'iot', 'automated'],
    createdBy: 'System',
  },
  {
    id: 'wf-4',
    name: 'Weekly Report Generator',
    description: 'Compile and send weekly analytics reports every Monday',
    status: 'active',
    nodes: [
      { id: 'n1', type: 'trigger', name: 'Monday 9:00 AM', icon: 'clock', color: 'blue', config: {} },
      { id: 'n2', type: 'action', name: 'Gather Metrics', icon: 'bar-chart', color: 'indigo', config: {} },
      { id: 'n3', type: 'transform', name: 'Generate Report', icon: 'file-text', color: 'purple', config: {} },
      { id: 'n4', type: 'action', name: 'Send Email', icon: 'mail', color: 'green', config: {} },
    ],
    lastRun: '3 days ago',
    nextRun: 'Monday 9:00 AM',
    runs: 24,
    successRate: 95.8,
    avgDuration: '45s',
    tags: ['weekly', 'reports', 'email'],
    createdBy: 'Admin',
  },
  {
    id: 'wf-5',
    name: 'Health Check Pipeline',
    description: 'Monitor vital signs and alert if anomalies detected',
    status: 'paused',
    nodes: [
      { id: 'n1', type: 'trigger', name: 'Every 30 min', icon: 'clock', color: 'blue', config: {} },
      { id: 'n2', type: 'action', name: 'Collect Vitals', icon: 'heart', color: 'red', config: {} },
      { id: 'n3', type: 'condition', name: 'Check Thresholds', icon: 'git-branch', color: 'yellow', config: {} },
      { id: 'n4', type: 'notification', name: 'Alert Doctor', icon: 'bell', color: 'red', config: {} },
    ],
    lastRun: '1 day ago',
    nextRun: 'Paused',
    runs: 567,
    successRate: 97.2,
    avgDuration: '8s',
    tags: ['health', 'monitoring', 'alerts'],
    createdBy: 'System',
  },
  {
    id: 'wf-6',
    name: 'Data Backup Automation',
    description: 'Automated daily backup of all data with verification',
    status: 'draft',
    nodes: [
      { id: 'n1', type: 'trigger', name: 'Daily 2:00 AM', icon: 'clock', color: 'blue', config: {} },
      { id: 'n2', type: 'action', name: 'Create Backup', icon: 'database', color: 'green', config: {} },
      { id: 'n3', type: 'action', name: 'Verify Integrity', icon: 'check', color: 'blue', config: {} },
      { id: 'n4', type: 'action', name: 'Upload to Cloud', icon: 'cloud', color: 'cyan', config: {} },
      { id: 'n5', type: 'notification', name: 'Confirm Success', icon: 'bell', color: 'green', config: {} },
    ],
    lastRun: 'Never',
    nextRun: 'Not scheduled',
    runs: 0,
    successRate: 0,
    avgDuration: '-',
    tags: ['backup', 'data', 'cloud'],
    createdBy: 'Admin',
  },
];

// ─── Status Badge ───────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  const icons: Record<string, React.ReactNode> = {
    active: <CheckCircle2 size={12} />,
    paused: <Pause size={12} />,
    draft: <Edit3 size={12} />,
    error: <XCircle size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ─── Node Type Icon ─────────────────────────────────────────────────
const nodeTypeIcons: Record<string, React.ReactNode> = {
  trigger: <Clock size={14} />,
  condition: <GitBranch size={14} />,
  action: <Zap size={14} />,
  notification: <Bell size={14} />,
  transform: <Code size={14} />,
  loop: <Repeat size={14} />,
  delay: <Timer size={14} />,
};

const nodeTypeColors: Record<string, string> = {
  trigger: 'bg-blue-500',
  condition: 'bg-yellow-500',
  action: 'bg-purple-500',
  notification: 'bg-green-500',
  transform: 'bg-indigo-500',
  loop: 'bg-cyan-500',
  delay: 'bg-orange-500',
};

// ─── Workflow Card ──────────────────────────────────────────────────
const WorkflowCard: React.FC<{
  workflow: WorkflowData;
  onClick: () => void;
  onRun: () => void;
  index: number;
}> = ({ workflow, onClick, onRun, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
    onClick={onClick}
    className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 cursor-pointer group"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-500/10">
          <Workflow size={20} className="text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-500 transition-colors">
            {workflow.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
            {workflow.description}
          </p>
        </div>
      </div>
      <StatusBadge status={workflow.status} />
    </div>

    {/* Node Pipeline Preview */}
    <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
      {workflow.nodes.map((node, i) => (
        <React.Fragment key={node.id}>
          <motion.div
            whileHover={{ scale: 1.1 }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white ${nodeTypeColors[node.type] || 'bg-gray-500'} whitespace-nowrap`}
            title={node.name}
          >
            {nodeTypeIcons[node.type]}
            <span className="max-w-[80px] truncate">{node.name}</span>
          </motion.div>
          {i < workflow.nodes.length - 1 && (
            <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>

    {/* Stats */}
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <div className="text-lg font-bold text-gray-900 dark:text-white">{workflow.runs}</div>
        <div className="text-xs text-gray-500">Total Runs</div>
      </div>
      <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <div className="text-lg font-bold text-green-500">{workflow.successRate}%</div>
        <div className="text-xs text-gray-500">Success</div>
      </div>
      <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
        <div className="text-lg font-bold text-gray-900 dark:text-white">{workflow.avgDuration}</div>
        <div className="text-xs text-gray-500">Avg Time</div>
      </div>
    </div>

    {/* Footer */}
    <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock size={14} />
        <span>Last: {workflow.lastRun}</span>
      </div>
      <div className="flex items-center gap-2">
        {workflow.tags.slice(0, 2).map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs">
            {tag}
          </span>
        ))}
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => { e.stopPropagation(); onRun(); }}
        disabled={workflow.status === 'draft'}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Play size={14} /> Run
      </motion.button>
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Copy size={14} />
      </button>
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <Settings2 size={14} />
      </button>
      <button
        onClick={(e) => e.stopPropagation()}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </motion.div>
);

// ─── Workflow Detail Panel ──────────────────────────────────────────
const WorkflowDetail: React.FC<{
  workflow: WorkflowData;
  onClose: () => void;
}> = ({ workflow, onClose }) => (
  <motion.div
    initial={{ opacity: 0, x: 300 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 300 }}
    className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-50 overflow-y-auto"
  >
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{workflow.name}</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <XCircle size={20} className="text-gray-400" />
        </button>
      </div>

      <p className="text-gray-500 dark:text-gray-400 mb-6">{workflow.description}</p>

      <div className="flex items-center gap-3 mb-6">
        <StatusBadge status={workflow.status} />
        <span className="text-sm text-gray-500">Created by {workflow.createdBy}</span>
      </div>

      {/* Pipeline Visualization */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Pipeline Steps</h3>
        <div className="space-y-3">
          {workflow.nodes.map((node, i) => (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative"
            >
              {i > 0 && (
                <div className="absolute -top-3 left-5 w-0.5 h-3 bg-gray-200 dark:bg-gray-600" />
              )}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                <div className={`p-2 rounded-lg ${nodeTypeColors[node.type]} text-white`}>
                  {nodeTypeIcons[node.type]}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{node.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{node.type}</div>
                </div>
                <div className="text-xs text-gray-400">Step {i + 1}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Statistics</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{workflow.runs}</div>
            <div className="text-sm text-gray-500">Total Runs</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div className="text-2xl font-bold text-green-500">{workflow.successRate}%</div>
            <div className="text-sm text-gray-500">Success Rate</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{workflow.avgDuration}</div>
            <div className="text-sm text-gray-500">Avg Duration</div>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
            <div className="text-2xl font-bold text-indigo-500">{workflow.nodes.length}</div>
            <div className="text-sm text-gray-500">Steps</div>
          </div>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Schedule</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <span className="text-sm text-gray-500">Last Run</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{workflow.lastRun}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <span className="text-sm text-gray-500">Next Run</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{workflow.nextRun}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Tags</h3>
        <div className="flex flex-wrap gap-2">
          {workflow.tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-colors"
        >
          <Play size={18} /> Run Now
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <Edit3 size={18} /> Edit
        </motion.button>
      </div>
    </div>
  </motion.div>
);

// ─── Main Workflows Page ────────────────────────────────────────────
const Workflows: React.FC = () => {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No workflows" description="Create automated workflows to streamline your processes." /></div>;
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredWorkflows = useMemo(() => {
    return sampleWorkflows.filter(wf => {
      const matchesSearch = !searchQuery ||
        wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || wf.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: sampleWorkflows.length,
    active: sampleWorkflows.filter(w => w.status === 'active').length,
    totalRuns: sampleWorkflows.reduce((sum, w) => sum + w.runs, 0),
    avgSuccess: Math.round(sampleWorkflows.reduce((sum, w) => sum + w.successRate, 0) / sampleWorkflows.length * 10) / 10,
  }), []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Workflow className="text-indigo-500" size={32} />
              Workflow Builder
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Create, manage, and monitor automated workflows
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 shadow-lg shadow-indigo-500/25 transition-colors"
          >
            <Plus size={18} /> Create Workflow
          </motion.button>
        </div>
      </FadeIn>

      {/* Stats Cards */}
      <FadeIn delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Workflows', value: stats.total, icon: <Layers size={18} className="text-indigo-500" />, color: 'bg-indigo-500/10' },
            { label: 'Active', value: stats.active, icon: <CheckCircle2 size={18} className="text-green-500" />, color: 'bg-green-500/10' },
            { label: 'Total Executions', value: stats.totalRuns.toLocaleString(), icon: <Play size={18} className="text-blue-500" />, color: 'bg-blue-500/10' },
            { label: 'Avg Success Rate', value: `${stats.avgSuccess}%`, icon: <BarChart2 size={18} className="text-purple-500" />, color: 'bg-purple-500/10' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>{stat.icon}</div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.2}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            {['all', 'active', 'paused', 'draft'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                  filterStatus === status
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredWorkflows.map((workflow, index) => (
          <WorkflowCard
            key={workflow.id}
            workflow={workflow}
            index={index}
            onClick={() => setSelectedWorkflow(workflow)}
            onRun={() => {}}
          />
        ))}
      </div>

      {filteredWorkflows.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <Workflow size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No workflows found</h3>
          <p className="text-gray-500">Try adjusting your search or create a new workflow.</p>
        </motion.div>
      )}

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedWorkflow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWorkflow(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <WorkflowDetail
              workflow={selectedWorkflow}
              onClose={() => setSelectedWorkflow(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Workflows;
