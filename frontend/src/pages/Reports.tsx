/* ===================================================================
   Nexus AI OS — Reports Page
   Templates, generation, history, preview, export & analytics
   =================================================================== */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Sparkles,
  BarChart3,
  Heart,
  Home,
  Activity,
  Zap,
  Settings,
  Eye,
  FileJson,
  FileCode,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Target,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';

import useStore from '@/lib/store';
import { reportsApi } from '@/lib/api';
import type { Report, ReportFormat, ReportType } from '@/types';
import { useIsDemoAccount } from '@/hooks/useDemoData';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ------------------------------------------------------------------ */
/*  Color palette & tooltip style                                      */
/* ------------------------------------------------------------------ */
const COLORS = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
  '#EC4899', '#EF4444', '#F97316', '#14B8A6', '#A855F7',
];

const tooltipStyle = {
  backgroundColor: '#1E1E2E',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
};

/* ------------------------------------------------------------------ */
/*  Template config                                                    */
/* ------------------------------------------------------------------ */
const templateCards: {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  sections: string[];
}[] = [
  {
    id: 'financial',
    name: 'Financial Report',
    description: 'Income, expenses, budget analysis & savings goals.',
    icon: BarChart3,
    color: '#10B981',
    sections: ['income', 'expenses', 'budget', 'goals'],
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    description: 'Mood trends, sleep quality, exercise & vitals overview.',
    icon: Heart,
    color: '#EC4899',
    sections: ['mood', 'sleep', 'exercise', 'vitals'],
  },
  {
    id: 'home_energy',
    name: 'Home Energy',
    description: 'Power consumption, device usage & efficiency metrics.',
    icon: Home,
    color: '#F59E0B',
    sections: ['power', 'devices', 'efficiency'],
  },
  {
    id: 'activity',
    name: 'Activity Summary',
    description: 'Tasks completed, agent interactions & productivity score.',
    icon: Activity,
    color: '#3B82F6',
    sections: ['tasks', 'agents', 'productivity'],
  },
  {
    id: 'custom',
    name: 'Custom Report',
    description: 'Build a report with custom sections and parameters.',
    icon: Settings,
    color: '#8B5CF6',
    sections: [],
  },
];

const formatOptions: { value: ReportFormat; label: string; icon: React.ElementType }[] = [
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'markdown', label: 'Markdown', icon: FileCode },
  { value: 'json', label: 'JSON', icon: FileJson },
  { value: 'html', label: 'HTML', icon: FileSpreadsheet },
];

/* ------------------------------------------------------------------ */
/*  Mock history                                                       */
/* ------------------------------------------------------------------ */
const mockReportHistory: Report[] = [
  { id: 'rpt1', title: 'February Financial Report', type: 'monthly', format: 'pdf', created_at: '2026-02-25T14:30:00Z', sections: ['income', 'expenses', 'budget'], size_bytes: 245_000 },
  { id: 'rpt2', title: 'Weekly Activity Summary', type: 'weekly', format: 'markdown', created_at: '2026-02-23T09:00:00Z', sections: ['tasks', 'agents'], size_bytes: 12_400 },
  { id: 'rpt3', title: 'Health & Wellness — Jan', type: 'monthly', format: 'pdf', created_at: '2026-02-01T10:00:00Z', sections: ['mood', 'sleep', 'exercise'], size_bytes: 180_000 },
  { id: 'rpt4', title: 'Home Energy Analysis', type: 'monthly', format: 'html', created_at: '2026-01-30T16:00:00Z', sections: ['power', 'efficiency'], size_bytes: 78_000 },
  { id: 'rpt5', title: 'Daily Report — Feb 24', type: 'daily', format: 'json', created_at: '2026-02-24T23:59:00Z', sections: ['tasks', 'agents', 'mood'], size_bytes: 5_600 },
];

/* ------------------------------------------------------------------ */
/*  Chart mock data                                                    */
/* ------------------------------------------------------------------ */

/* Analytics stats */
const analyticsStats = [
  { label: 'Total Reports Generated', value: 156, icon: FileText, color: '#3B82F6', change: '+12%' },
  { label: 'Reports This Week', value: 12, icon: TrendingUp, color: '#10B981', change: '+3' },
  { label: 'Avg Generation Time', value: '2.3s', icon: Clock, color: '#F59E0B', change: '-0.4s' },
  { label: 'Auto-Generated', value: '67%', icon: Zap, color: '#8B5CF6', change: '+5%' },
];

/* Report generation trend — 12 months */
const generationTrendData = [
  { month: 'Mar', reports: 8 },
  { month: 'Apr', reports: 12 },
  { month: 'May', reports: 10 },
  { month: 'Jun', reports: 15 },
  { month: 'Jul', reports: 18 },
  { month: 'Aug', reports: 14 },
  { month: 'Sep', reports: 20 },
  { month: 'Oct', reports: 17 },
  { month: 'Nov', reports: 22 },
  { month: 'Dec', reports: 19 },
  { month: 'Jan', reports: 25 },
  { month: 'Feb', reports: 21 },
];

/* Report type distribution — PieChart */
const reportTypeDistribution = [
  { name: 'Financial', value: 30, color: '#10B981' },
  { name: 'Health', value: 22, color: '#EC4899' },
  { name: 'Home Energy', value: 18, color: '#F59E0B' },
  { name: 'Activity', value: 15, color: '#3B82F6' },
  { name: 'Custom', value: 15, color: '#8B5CF6' },
];

/* Avg pages per report type — BarChart */
const avgPagesData = [
  { type: 'Financial', pages: 12 },
  { type: 'Health', pages: 8 },
  { type: 'Home Energy', pages: 6 },
  { type: 'Activity', pages: 10 },
  { type: 'Custom', pages: 14 },
];

/* Quality metrics — RadarChart */
const qualityMetrics = [
  { metric: 'Accuracy', score: 92 },
  { metric: 'Completeness', score: 87 },
  { metric: 'Timeliness', score: 95 },
  { metric: 'Formatting', score: 89 },
  { metric: 'Relevance', score: 91 },
  { metric: 'Actionability', score: 84 },
];

/* Report size analysis — ScatterChart */
const reportSizeData = [
  { genTime: 1.2, size: 24, type: 'Financial' },
  { genTime: 2.1, size: 180, type: 'Financial' },
  { genTime: 3.4, size: 245, type: 'Financial' },
  { genTime: 1.8, size: 120, type: 'Health' },
  { genTime: 2.5, size: 160, type: 'Health' },
  { genTime: 0.8, size: 12, type: 'Activity' },
  { genTime: 1.5, size: 56, type: 'Activity' },
  { genTime: 2.9, size: 210, type: 'Home Energy' },
  { genTime: 1.1, size: 35, type: 'Home Energy' },
  { genTime: 3.8, size: 320, type: 'Custom' },
  { genTime: 4.2, size: 410, type: 'Custom' },
  { genTime: 2.0, size: 145, type: 'Financial' },
  { genTime: 1.6, size: 78, type: 'Health' },
  { genTime: 0.9, size: 5, type: 'Activity' },
  { genTime: 3.1, size: 280, type: 'Home Energy' },
  { genTime: 2.7, size: 195, type: 'Custom' },
  { genTime: 1.3, size: 42, type: 'Financial' },
  { genTime: 2.3, size: 155, type: 'Health' },
  { genTime: 3.6, size: 300, type: 'Custom' },
  { genTime: 1.9, size: 98, type: 'Activity' },
];

const scatterColorMap: Record<string, string> = {
  Financial: '#10B981',
  Health: '#EC4899',
  'Home Energy': '#F59E0B',
  Activity: '#3B82F6',
  Custom: '#8B5CF6',
};

/* Format usage — PieChart */
const formatUsageData = [
  { name: 'PDF', value: 45, color: '#3B82F6' },
  { name: 'Markdown', value: 25, color: '#10B981' },
  { name: 'JSON', value: 18, color: '#F59E0B' },
  { name: 'HTML', value: 12, color: '#EC4899' },
];

/* ------------------------------------------------------------------ */
/*  Generate Report Modal                                              */
/* ------------------------------------------------------------------ */
function GenerateReportModal({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template: typeof templateCards[0] | null;
}) {
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [type, setType] = useState<ReportType>('monthly');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    if (!template) return;
    setGenerating(true);
    try {
      await reportsApi.generate({
        type,
        format,
        sections: template.sections,
      });
    } catch {
      /* handled by interceptor */
    }
    setTimeout(() => {
      setGenerating(false);
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1500);
    }, 2000);
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={`Generate ${template?.name ?? 'Report'}`} size="md">
      <div className="space-y-5">
        {/* Template info */}
        {template && (
          <div className="flex items-center gap-3 rounded-lg border border-nexus-border bg-nexus-card/40 p-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: `${template.color}20`, color: template.color }}
            >
              <template.icon size={20} />
            </span>
            <div>
              <p className="text-sm font-medium text-nexus-text">{template.name}</p>
              <p className="text-[11px] text-nexus-muted">{template.description}</p>
            </div>
          </div>
        )}

        {/* Report type */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Report Period</label>
          <div className="flex gap-2 mt-1.5">
            {(['daily', 'weekly', 'monthly', 'custom'] as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-all ${
                  type === t
                    ? 'border-nexus-primary/50 bg-nexus-primary/10 text-nexus-primary'
                    : 'border-nexus-border bg-nexus-card/40 text-nexus-muted hover:bg-nexus-card/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Format selector */}
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Format</label>
          <div className="grid grid-cols-4 gap-2 mt-1.5">
            {formatOptions.map((f) => (
              <button
                key={f.value}
                onClick={() => setFormat(f.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border py-3 transition-all ${
                  format === f.value
                    ? 'border-nexus-primary/50 bg-nexus-primary/10 text-nexus-primary'
                    : 'border-nexus-border bg-nexus-card/40 text-nexus-muted hover:bg-nexus-card/5'
                }`}
              >
                <f.icon size={18} />
                <span className="text-[10px] font-medium">{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        {template && template.sections.length > 0 && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Sections</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {template.sections.map((s) => (
                <Badge key={s} variant="info" className="capitalize">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            loading={generating}
            disabled={generating || done}
            icon={done ? CheckCircle2 : Sparkles}
          >
            {done ? 'Generated!' : generating ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Reports() {
  const isDemo = useIsDemoAccount();
  const { setCurrentPage } = useStore();
  const [reports, setReports] = useState<Report[]>(isDemo ? mockReportHistory : []);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templateCards[0] | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  useEffect(() => {
    setCurrentPage('/reports');
    reportsApi.list()
      .then((data) => { if (Array.isArray(data)) setReports(data); })
      .catch(() => {});
  }, [setCurrentPage]);

  const filtered = reports.filter((r) =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectTemplate = (tmpl: typeof templateCards[0]) => {
    setSelectedTemplate(tmpl);
    setShowGenerateModal(true);
  };

  const handleDownload = async (id: string) => {
    try {
      const blob = await reportsApi.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* handled */
    }
  };

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /* Group scatter data by type for colored rendering */
  const scatterByType = Object.entries(
    reportSizeData.reduce<Record<string, typeof reportSizeData>>((acc, d) => {
      (acc[d.type] ??= []).push(d);
      return acc;
    }, {}),
  );

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ── Header ── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
            <FileText size={24} className="text-nexus-primary" />
            Reports
          </h1>
          <p className="text-sm text-nexus-muted mt-0.5">Generate, view & download reports</p>
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw}>
          Refresh
        </Button>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          1. ANALYTICS OVERVIEW — 4 stat cards
         ══════════════════════════════════════════════════════════════ */}
      {isDemo && (
      <motion.div variants={item}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {analyticsStats.map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ scale: 1.03, y: -2 }}
              className="rounded-2xl border border-nexus-border bg-nexus-card/60 backdrop-blur-sm p-5 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${stat.color}18`, color: stat.color }}
                >
                  <stat.icon size={20} />
                </span>
                <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-400">
                  <ArrowUpRight size={12} />
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-2xl font-bold text-nexus-text">{stat.value}</p>
                <p className="text-[11px] text-nexus-muted mt-0.5">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      )}

      {/* ── Template Cards ── */}
      <motion.div variants={item}>
        <h2 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider mb-3">Report Templates</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {templateCards.map((tmpl) => (
            <motion.button
              key={tmpl.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleSelectTemplate(tmpl)}
              className="flex flex-col items-center gap-2 rounded-xl border border-nexus-border bg-nexus-card/60 backdrop-blur-sm p-5 text-center transition-shadow hover:shadow-nexus hover:border-nexus-primary/30"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${tmpl.color}20`, color: tmpl.color }}
              >
                <tmpl.icon size={24} />
              </span>
              <span className="text-sm font-medium text-nexus-text">{tmpl.name}</span>
              <span className="text-[10px] text-nexus-muted line-clamp-2">{tmpl.description}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          2. REPORT GENERATION TREND — AreaChart (12 months)
         ══════════════════════════════════════════════════════════════ */}
      {isDemo && (<>
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-nexus-primary" />
              <span>Report Generation Trend</span>
              <Badge variant="info">12 months</Badge>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={generationTrendData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="reportTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="reports"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fill="url(#reportTrendGradient)"
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: '#3B82F6', strokeWidth: 2, fill: '#1E1E2E' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          3. REPORT TYPE DISTRIBUTION — PieChart + BarChart side by side
         ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: PieChart donut */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-nexus-accent" />
              <span>Report Type Distribution</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reportTypeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {reportTypeDistribution.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number) => [`${value}%`, 'Share']}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ color: '#ccc', fontSize: 11 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* RIGHT: Horizontal BarChart — avg pages */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-nexus-secondary" />
              <span>Avg Pages per Report Type</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={avgPagesData} layout="vertical" margin={{ top: 10, right: 30, bottom: 0, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="type"
                tick={{ fill: '#ccc', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={85}
              />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pages" radius={[0, 6, 6, 0]} barSize={24}>
                {avgPagesData.map((entry, idx) => (
                  <Cell
                    key={entry.type}
                    fill={reportTypeDistribution.find((r) => r.name === entry.type)?.color ?? COLORS[idx]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          4. QUALITY METRICS — RadarChart
          5. REPORT SIZE ANALYSIS — ScatterChart
         ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RadarChart */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Target size={16} className="text-nexus-primary" />
              <span>Quality Metrics</span>
              <Badge variant="success">Avg 89.7</Badge>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={qualityMetrics} outerRadius="70%">
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: '#aaa', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: '#666', fontSize: 10 }}
                axisLine={false}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#8B5CF6"
                fill="#8B5CF6"
                fillOpacity={0.25}
                strokeWidth={2}
                dot={{ r: 3, fill: '#8B5CF6' }}
              />
              <RechartsTooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        {/* ScatterChart */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-nexus-accent" />
              <span>Report Size Analysis</span>
              <Badge variant="neutral">20 reports</Badge>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                dataKey="genTime"
                name="Gen Time"
                unit="s"
                tick={{ fill: '#888', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'Generation Time (s)', position: 'insideBottom', offset: -5, fill: '#666', fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="size"
                name="File Size"
                unit=" KB"
                tick={{ fill: '#888', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'File Size (KB)', angle: -90, position: 'insideLeft', offset: 10, fill: '#666', fontSize: 10 }}
              />
              <ZAxis range={[50, 200]} />
              <RechartsTooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, name: string) => {
                  if (name === 'Gen Time') return [`${value}s`, name];
                  if (name === 'File Size') return [`${value} KB`, name];
                  return [value, name];
                }}
              />
              {scatterByType.map(([typeName, data]) => (
                <Scatter
                  key={typeName}
                  name={typeName}
                  data={data}
                  fill={scatterColorMap[typeName] ?? '#888'}
                />
              ))}
              <Legend
                verticalAlign="top"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span style={{ color: '#ccc', fontSize: 11 }}>{value}</span>
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════
          6. FORMAT USAGE — small PieChart + Legend
         ══════════════════════════════════════════════════════════════ */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-nexus-secondary" />
              <span>Format Usage</span>
            </div>
          }
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <ResponsiveContainer width="100%" height={220} className="max-w-[280px]">
              <PieChart>
                <Pie
                  data={formatUsageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {formatUsageData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value}%`, 'Usage']}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend breakdown */}
            <div className="flex-1 grid grid-cols-2 gap-4 w-full">
              {formatUsageData.map((fmt) => (
                <div
                  key={fmt.name}
                  className="flex items-center gap-3 rounded-xl border border-nexus-border/50 bg-nexus-card/30 p-3"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: fmt.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nexus-text">{fmt.name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-nexus-card/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${fmt.value}%`, backgroundColor: fmt.color }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-nexus-text">{fmt.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>
      </>)}

      {/* ── Report History ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-nexus-accent" />
                <span>Report History</span>
                <Badge variant="neutral">{filtered.length}</Badge>
              </div>
              <Input
                variant="search"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48"
              />
            </div>
          }
        >
          <div className="space-y-1">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-nexus-muted font-semibold border-b border-nexus-border/40">
              <span className="col-span-4">Title</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2">Format</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-nexus-muted">No reports found.</div>
            ) : (
              filtered.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-nexus-card/5 transition-colors items-center"
                >
                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-nexus-muted shrink-0" />
                    <span className="text-sm text-nexus-text truncate">{report.title}</span>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="info" className="capitalize">{report.type}</Badge>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="neutral" className="uppercase text-[10px]">{report.format}</Badge>
                  </div>
                  <div className="col-span-2 text-xs text-nexus-muted">
                    {new Date(report.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {report.size_bytes && (
                      <span className="ml-1 text-[10px]">({formatBytes(report.size_bytes)})</span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    <button
                      onClick={() => setPreviewReport(report)}
                      className="p-1.5 rounded hover:bg-nexus-card/10 text-nexus-muted hover:text-nexus-text transition-colors"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => handleDownload(report.id)}
                      className="p-1.5 rounded hover:bg-nexus-card/10 text-nexus-muted hover:text-nexus-text transition-colors"
                      title="Download"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </motion.div>

      {/* ── Report Preview ── */}
      <AnimatePresence>
        {previewReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card
              variant="glow"
              header={
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-nexus-primary" />
                    <span>Preview: {previewReport.title}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewReport(null)}>
                    Close
                  </Button>
                </div>
              }
            >
              <div className="rounded-lg border border-nexus-border bg-nexus-bg/60 p-6 min-h-[200px]">
                <h3 className="text-lg font-bold text-nexus-text mb-2">{previewReport.title}</h3>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="info" className="capitalize">{previewReport.type}</Badge>
                  <Badge variant="neutral" className="uppercase">{previewReport.format}</Badge>
                  <span className="text-xs text-nexus-muted">
                    {new Date(previewReport.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-nexus-border/50 pt-4">
                  <p className="text-sm text-nexus-muted mb-2">Sections:</p>
                  <div className="flex flex-wrap gap-2">
                    {previewReport.sections.map((s) => (
                      <Badge key={s} variant="info" className="capitalize">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <Button variant="primary" icon={Download} onClick={() => handleDownload(previewReport.id)}>
                    Download
                  </Button>
                  <Button variant="ghost" icon={RefreshCw}>
                    Regenerate
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scheduled Reports ── */}
      {isDemo && (
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-nexus-secondary" />
              <span>Scheduled Reports</span>
            </div>
          }
        >
          <div className="space-y-2">
            {[
              { name: 'Weekly Activity', schedule: 'Every Sunday 8:00 PM', format: 'PDF', active: true },
              { name: 'Monthly Finance', schedule: '1st of every month', format: 'PDF', active: true },
              { name: 'Daily Health', schedule: 'Every day 10:00 PM', format: 'Markdown', active: false },
            ].map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-nexus-card/5 transition-colors"
              >
                <Calendar size={14} className="text-nexus-muted" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nexus-text">{s.name}</p>
                  <p className="text-[10px] text-nexus-muted">{s.schedule} · {s.format}</p>
                </div>
                <Badge variant={s.active ? 'success' : 'neutral'} dot>
                  {s.active ? 'Active' : 'Paused'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
      )}

      {/* ── Generate Modal ── */}
      <GenerateReportModal
        open={showGenerateModal}
        onClose={() => {
          setShowGenerateModal(false);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />
    </motion.div>
  );
}
