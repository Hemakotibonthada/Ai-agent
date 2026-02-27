/* ===================================================================
   Nexus AI OS — Reports Page
   Templates, generation, history, preview, export
   =================================================================== */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Plus,
  Filter,
  Search,
  Sparkles,
  BarChart3,
  Heart,
  Home,
  Activity,
  Zap,
  Settings,
  Eye,
  Trash2,
  FileJson,
  FileCode,
  FileSpreadsheet,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import useStore from '@/lib/store';
import { reportsApi } from '@/lib/api';
import type { Report, ReportTemplate, ReportFormat, ReportType } from '@/types';

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
                    : 'border-nexus-border bg-nexus-card/40 text-nexus-muted hover:bg-white/5'
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
                    : 'border-nexus-border bg-nexus-card/40 text-nexus-muted hover:bg-white/5'
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
  const { setCurrentPage } = useStore();
  const [reports, setReports] = useState<Report[]>(mockReportHistory);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templateCards[0] | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  useEffect(() => {
    setCurrentPage('/reports');
    reportsApi.list().then(setReports).catch(() => {});
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
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors items-center"
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
                      className="p-1.5 rounded hover:bg-white/10 text-nexus-muted hover:text-nexus-text transition-colors"
                      title="Preview"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => handleDownload(report.id)}
                      className="p-1.5 rounded hover:bg-white/10 text-nexus-muted hover:text-nexus-text transition-colors"
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
                className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-white/5 transition-colors"
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
