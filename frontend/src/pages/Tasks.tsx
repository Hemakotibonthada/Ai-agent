/* ===================================================================
   Nexus AI OS — Tasks Page
   Kanban board, list view, task creation, filters & statistics
   =================================================================== */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  ListTodo,
  LayoutGrid,
  Calendar as CalendarIcon,
  GitBranch,
  Tag,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  GripVertical,
  CheckCircle2,
  Circle,
  Timer,
  Eye,
  Trash2,
  X,
  Target,
  TrendingUp,
  Zap,
  BarChart3,
  Flag,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Progress from '@/components/ui/Progress';
import Tabs from '@/components/ui/Tabs';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import useStore from '@/lib/store';
import { tasksApi } from '@/lib/api';
import type { Task, TaskStatus, TaskPriority } from '@/types';
import { useIsDemoAccount } from '@/hooks/useDemoData';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const columns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: '#6B7280' },
  { status: 'todo', label: 'To Do', color: '#3B82F6' },
  { status: 'in_progress', label: 'In Progress', color: '#F59E0B' },
  { status: 'review', label: 'Review', color: '#8B5CF6' },
  { status: 'done', label: 'Done', color: '#10B981' },
];

const priorityConfig: Record<TaskPriority, { label: string; color: string; variant: 'error' | 'warning' | 'info' | 'neutral' }> = {
  critical: { label: 'Critical', color: '#EF4444', variant: 'error' },
  high: { label: 'High', color: '#F59E0B', variant: 'warning' },
  medium: { label: 'Medium', color: '#3B82F6', variant: 'info' },
  low: { label: 'Low', color: '#6B7280', variant: 'neutral' },
};

const tabItems = [
  { value: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: ListTodo },
  { value: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { value: 'timeline', label: 'Timeline', icon: GitBranch },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const mockTasks: Task[] = [
  { id: '1', title: 'Design dashboard wireframes', description: 'Create high-fidelity mockups for the main dashboard', status: 'done', priority: 'high', tags: ['design', 'ui'], created_at: '2026-02-20T10:00:00Z', updated_at: '2026-02-24T14:30:00Z', completed_at: '2026-02-24T14:30:00Z', due_date: '2026-02-25T00:00:00Z' },
  { id: '2', title: 'Implement authentication flow', description: 'Add JWT-based auth with refresh tokens', status: 'in_progress', priority: 'critical', tags: ['backend', 'security'], created_at: '2026-02-21T09:00:00Z', updated_at: '2026-02-26T08:00:00Z', due_date: '2026-02-28T00:00:00Z' },
  { id: '3', title: 'Setup CI/CD pipeline', description: 'Configure GitHub Actions for automated deployment', status: 'review', priority: 'high', tags: ['devops'], created_at: '2026-02-22T11:00:00Z', updated_at: '2026-02-25T16:00:00Z', due_date: '2026-03-01T00:00:00Z' },
  { id: '4', title: 'Write unit tests for API', description: 'Cover all endpoint handlers with pytest', status: 'todo', priority: 'medium', tags: ['backend', 'testing'], created_at: '2026-02-23T08:00:00Z', updated_at: '2026-02-23T08:00:00Z', due_date: '2026-03-05T00:00:00Z' },
  { id: '5', title: 'Integrate IoT MQTT service', description: 'Connect ESP32 devices through MQTT broker', status: 'backlog', priority: 'medium', tags: ['iot', 'backend'], created_at: '2026-02-24T07:00:00Z', updated_at: '2026-02-24T07:00:00Z' },
  { id: '6', title: 'Mobile responsive polish', description: 'Fix layout issues on small viewports', status: 'todo', priority: 'low', tags: ['frontend', 'ui'], created_at: '2026-02-25T10:00:00Z', updated_at: '2026-02-25T10:00:00Z', due_date: '2026-03-10T00:00:00Z' },
  { id: '7', title: 'Add voice command parser', description: 'Natural language intent detection for voice control', status: 'in_progress', priority: 'high', tags: ['ai', 'voice'], created_at: '2026-02-19T09:00:00Z', updated_at: '2026-02-26T12:00:00Z', due_date: '2026-02-27T00:00:00Z' },
  { id: '8', title: 'Database migration script', description: 'Migrate from SQLite to PostgreSQL', status: 'backlog', priority: 'low', tags: ['backend', 'database'], created_at: '2026-02-18T11:00:00Z', updated_at: '2026-02-18T11:00:00Z' },
];

const productivityData = [
  { day: 'Mon', completed: 5, hours: 6 },
  { day: 'Tue', completed: 3, hours: 7 },
  { day: 'Wed', completed: 7, hours: 8 },
  { day: 'Thu', completed: 4, hours: 5 },
  { day: 'Fri', completed: 6, hours: 7 },
  { day: 'Sat', completed: 2, hours: 3 },
  { day: 'Sun', completed: 1, hours: 2 },
];

/* ------------------------------------------------------------------ */
/*  Task Card (Kanban)                                                 */
/* ------------------------------------------------------------------ */
function TaskCard({
  task,
  onSelect,
}: {
  task: Task;
  onSelect: (task: Task) => void;
}) {
  const prio = priorityConfig[task.priority];

  return (
    <motion.div
      layout
      variants={fadeIn}
      whileHover={{ scale: 1.02 }}
      onClick={() => onSelect(task)}
      className="cursor-pointer rounded-lg border border-nexus-border bg-nexus-card/60 backdrop-blur-sm p-3 transition-shadow hover:shadow-nexus group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-nexus-text line-clamp-2">{task.title}</h4>
        <button className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all">
          <MoreHorizontal size={14} className="text-nexus-muted" />
        </button>
      </div>

      {task.description && (
        <p className="text-[11px] text-nexus-muted line-clamp-2 mb-2">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] bg-white/5 text-nexus-muted border border-nexus-border/30"
          >
            <Tag size={8} />
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Badge variant={prio.variant}>
          <Flag size={10} />
          {prio.label}
        </Badge>
        {task.due_date && (
          <span className="text-[10px] text-nexus-muted flex items-center gap-1">
            <Clock size={10} />
            {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban Column                                                      */
/* ------------------------------------------------------------------ */
function KanbanColumn({
  status,
  label,
  color,
  tasks,
  onSelectTask,
}: {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}) {
  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px] flex-1">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold text-nexus-text">{label}</span>
        <span className="ml-auto text-xs text-nexus-muted bg-white/5 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin"
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onSelect={onSelectTask} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-nexus-border/40 p-4 text-center text-xs text-nexus-muted">
            No tasks
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task Detail Sidebar                                                */
/* ------------------------------------------------------------------ */
function TaskDetailPanel({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const prio = priorityConfig[task.priority];
  const col = columns.find((c) => c.status === task.status);

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 z-40 h-full w-[380px] border-l border-nexus-border bg-nexus-surface/95 backdrop-blur-lg shadow-2xl overflow-y-auto"
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold text-nexus-text pr-4">{task.title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-nexus-muted transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Status & Priority */}
        <div className="flex items-center gap-2">
          <Badge variant={prio.variant}>
            <Flag size={10} /> {prio.label}
          </Badge>
          <Badge variant={task.status === 'done' ? 'success' : 'info'} dot>
            {col?.label ?? task.status}
          </Badge>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-nexus-muted">Description</label>
            <p className="text-sm text-nexus-text/90 mt-1 leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          {task.due_date && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-nexus-muted">Due Date</label>
              <p className="text-sm text-nexus-text mt-0.5 flex items-center gap-1">
                <CalendarIcon size={12} className="text-nexus-primary" />
                {new Date(task.due_date).toLocaleDateString()}
              </p>
            </div>
          )}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-nexus-muted">Created</label>
            <p className="text-sm text-nexus-text mt-0.5">
              {new Date(task.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-nexus-muted">Tags</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="neutral">
                  <Tag size={10} /> {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-nexus-border/50">
          <Button variant="primary" size="sm" className="flex-1">
            <CheckCircle2 size={14} /> Mark Complete
          </Button>
          <Button variant="danger" size="sm" icon={Trash2}>
            Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Task Modal                                                  */
/* ------------------------------------------------------------------ */
function CreateTaskModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Task>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title,
      description,
      priority,
      due_date: dueDate || undefined,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      status: 'todo',
    });
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setTagsInput('');
    onClose();
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Create Task" size="lg">
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="Task title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task..."
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text placeholder:text-nexus-muted/60 focus-ring resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
            >
              {Object.entries(priorityConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring"
            />
          </div>
        </div>

        <Input
          label="Tags"
          placeholder="Comma-separated tags..."
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!title.trim()}>
            Create Task
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Tasks() {
  const isDemo = useIsDemoAccount();
  const {
    tasks: storeTasks,
    viewMode,
    setTasks,
    addTask,
    updateTask,
    setViewMode,
    setCurrentPage,
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('kanban');

  const allTasks = storeTasks.length > 0 ? storeTasks : (isDemo ? mockTasks : []);

  useEffect(() => {
    setCurrentPage('/tasks');
    tasksApi.list()
      .then((data) => { if (Array.isArray(data) && data.length > 0) setTasks(data); })
      .catch(() => { if (isDemo) setTasks(mockTasks); });
  }, [setCurrentPage, setTasks]);

  /* Filtered tasks */
  const filtered = useMemo(() => {
    return allTasks.filter((t) => {
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      return true;
    });
  }, [allTasks, searchQuery, filterPriority, filterStatus]);

  /* Stats */
  const stats = useMemo(() => {
    const total = allTasks.length;
    const done = allTasks.filter((t) => t.status === 'done').length;
    const inProgress = allTasks.filter((t) => t.status === 'in_progress').length;
    const overdue = allTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done',
    ).length;
    return { total, done, inProgress, overdue, productivity: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [allTasks]);

  const handleCreateTask = useCallback(
    (data: Partial<Task>) => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: data.title!,
        description: data.description ?? '',
        status: data.status ?? 'todo',
        priority: data.priority ?? 'medium',
        tags: data.tags ?? [],
        due_date: data.due_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      addTask(newTask);
    },
    [addTask],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-8"
    >
      {/* ── Statistics Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks', value: stats.total, icon: ListTodo, color: '#3B82F6' },
          { label: 'In Progress', value: stats.inProgress, icon: Timer, color: '#F59E0B' },
          { label: 'Completed', value: stats.done, icon: CheckCircle2, color: '#10B981' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: '#EF4444' },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card hoverable size="sm">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}
                >
                  <s.icon size={20} />
                </span>
                <div>
                  <p className="text-[11px] text-nexus-muted uppercase tracking-wider">{s.label}</p>
                  <p className="text-xl font-bold text-nexus-text">
                    <AnimatedNumber value={s.value} />
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Productivity + Sprint ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          variant="glow"
          header={
            <div className="flex items-center gap-2">
              <Target size={16} className="text-nexus-primary" />
              <span>Productivity Score</span>
            </div>
          }
        >
          <div className="flex items-center justify-center py-4">
            <CircularProgress value={stats.productivity} size={100} strokeWidth={8} />
          </div>
          <p className="text-center text-xs text-nexus-muted">
            {stats.done} of {stats.total} tasks completed
          </p>
        </Card>

        {isDemo && (
        <Card
          className="lg:col-span-2"
          header={
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span>Sprint Progress</span>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-nexus-text font-medium">Sprint 4 — Feb 17 – Mar 2</span>
              <span className="text-nexus-muted">{stats.productivity}%</span>
            </div>
            <Progress value={stats.productivity} label />
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={productivityData}>
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
                <Bar dataKey="completed" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <div />
        </Tabs>

        <div className="flex-1" />

        <Input
          variant="search"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-56"
        />

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
          className="rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-xs text-nexus-text focus-ring"
        >
          <option value="all">All Priority</option>
          {Object.entries(priorityConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
          className="rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-xs text-nexus-text focus-ring"
        >
          <option value="all">All Status</option>
          {columns.map((c) => (
            <option key={c.status} value={c.status}>{c.label}</option>
          ))}
        </select>

        <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
          New Task
        </Button>
      </div>

      {/* ── Kanban Board ── */}
      {activeTab === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
          {columns.map((col) => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              color={col.color}
              tasks={filtered.filter((t) => t.status === col.status)}
              onSelectTask={setSelectedTask}
            />
          ))}
        </div>
      )}

      {/* ── List View ── */}
      {activeTab === 'list' && (
        <Card>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-nexus-muted font-semibold border-b border-nexus-border/40">
              <span className="col-span-5">Title</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2">Priority</span>
              <span className="col-span-2">Due Date</span>
              <span className="col-span-1" />
            </div>
            {filtered.map((task) => {
              const prio = priorityConfig[task.priority];
              const col = columns.find((c) => c.status === task.status);
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedTask(task)}
                  className="grid grid-cols-12 gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors items-center"
                >
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    {task.status === 'done' ? (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Circle size={14} className="text-nexus-muted shrink-0" />
                    )}
                    <span className="text-sm text-nexus-text truncate">{task.title}</span>
                  </div>
                  <div className="col-span-2">
                    <Badge variant={task.status === 'done' ? 'success' : 'info'} dot>
                      {col?.label}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <Badge variant={prio.variant}>
                      <Flag size={10} /> {prio.label}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-xs text-nexus-muted">
                    {task.due_date
                      ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <ChevronRight size={14} className="text-nexus-muted" />
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-nexus-muted">
                No tasks match your filters.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Calendar View (placeholder) ── */}
      {activeTab === 'calendar' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarIcon size={48} className="text-nexus-muted/30 mb-4" />
            <h3 className="text-lg font-semibold text-nexus-text mb-1">Calendar View</h3>
            <p className="text-sm text-nexus-muted">Coming soon — visualize tasks on a calendar timeline.</p>
          </div>
        </Card>
      )}

      {/* ── Timeline View (placeholder) ── */}
      {activeTab === 'timeline' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitBranch size={48} className="text-nexus-muted/30 mb-4" />
            <h3 className="text-lg font-semibold text-nexus-text mb-1">Timeline View</h3>
            <p className="text-sm text-nexus-muted">Coming soon — Gantt-style task timeline.</p>
          </div>
        </Card>
      )}

      {/* ── Task Detail Sidebar ── */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            />
            <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />
          </>
        )}
      </AnimatePresence>

      {/* ── Create Task Modal ── */}
      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTask}
      />
    </motion.div>
  );
}
