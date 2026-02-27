import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  LayoutGrid, Plus, Search, Filter, Clock, Tag, User,
  MessageSquare, CheckCircle2, Circle, AlertCircle, Zap,
  MoreHorizontal, GripVertical, Calendar, Flag, Star,
  ChevronDown, X, Edit3, Trash2, Eye
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface KanbanTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  assignee: string;
  dueDate?: string;
  comments: number;
  checklist: { done: number; total: number };
  starred: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  tasks: KanbanTask[];
}

const initialColumns: KanbanColumn[] = [
  {
    id: 'backlog', title: 'Backlog', color: 'bg-gray-500',
    tasks: [
      { id: 't1', title: 'Research new AI models', description: 'Evaluate GPT-5 and Claude compatibility', priority: 'medium', tags: ['research', 'ai'], assignee: 'Alex', dueDate: '2024-04-15', comments: 3, checklist: { done: 1, total: 4 }, starred: false },
      { id: 't2', title: 'Update documentation', description: 'Document new API endpoints and features', priority: 'low', tags: ['docs'], assignee: 'Sam', comments: 1, checklist: { done: 0, total: 3 }, starred: false },
      { id: 't3', title: 'Design mobile app screens', description: 'Create mockups for React Native app', priority: 'medium', tags: ['design', 'mobile'], assignee: 'Jordan', dueDate: '2024-04-20', comments: 5, checklist: { done: 2, total: 6 }, starred: true },
    ],
  },
  {
    id: 'todo', title: 'To Do', color: 'bg-blue-500',
    tasks: [
      { id: 't4', title: 'Implement WebSocket auth', description: 'Add JWT authentication to WebSocket connections', priority: 'high', tags: ['backend', 'security'], assignee: 'Alex', dueDate: '2024-04-10', comments: 7, checklist: { done: 2, total: 5 }, starred: true },
      { id: 't5', title: 'Add dark mode toggle animation', description: 'Smooth transition between light and dark themes', priority: 'medium', tags: ['frontend', 'ui'], assignee: 'Casey', comments: 2, checklist: { done: 0, total: 2 }, starred: false },
      { id: 't6', title: 'Setup CI/CD pipeline', description: 'Configure GitHub Actions for automated testing', priority: 'high', tags: ['devops'], assignee: 'Sam', dueDate: '2024-04-08', comments: 4, checklist: { done: 1, total: 3 }, starred: false },
    ],
  },
  {
    id: 'progress', title: 'In Progress', color: 'bg-yellow-500',
    tasks: [
      { id: 't7', title: 'Build analytics dashboard', description: 'Create interactive charts and metrics display', priority: 'high', tags: ['frontend', 'analytics'], assignee: 'Jordan', dueDate: '2024-04-05', comments: 12, checklist: { done: 4, total: 6 }, starred: true },
      { id: 't8', title: 'Optimize database queries', description: 'Add indexes and optimize slow queries', priority: 'urgent', tags: ['backend', 'performance'], assignee: 'Alex', comments: 8, checklist: { done: 3, total: 5 }, starred: false },
    ],
  },
  {
    id: 'review', title: 'Review', color: 'bg-purple-500',
    tasks: [
      { id: 't9', title: 'Plugin marketplace UI', description: 'Review plugin marketplace page design and functionality', priority: 'medium', tags: ['frontend', 'review'], assignee: 'Casey', comments: 6, checklist: { done: 3, total: 4 }, starred: false },
      { id: 't10', title: 'Security audit fixes', description: 'Review patches for identified vulnerabilities', priority: 'urgent', tags: ['security', 'review'], assignee: 'Sam', dueDate: '2024-04-03', comments: 15, checklist: { done: 5, total: 6 }, starred: true },
    ],
  },
  {
    id: 'done', title: 'Done', color: 'bg-green-500',
    tasks: [
      { id: 't11', title: 'User authentication system', description: 'JWT-based auth with 2FA support', priority: 'high', tags: ['backend', 'security'], assignee: 'Alex', comments: 20, checklist: { done: 8, total: 8 }, starred: false },
      { id: 't12', title: 'Voice command integration', description: 'Speech-to-text processing pipeline', priority: 'medium', tags: ['ai', 'voice'], assignee: 'Jordan', comments: 9, checklist: { done: 5, total: 5 }, starred: false },
      { id: 't13', title: 'ESP32 firmware update', description: 'OTA update mechanism for IoT devices', priority: 'medium', tags: ['iot', 'firmware'], assignee: 'Sam', comments: 7, checklist: { done: 4, total: 4 }, starred: false },
    ],
  },
];

const priorityConfig = {
  low: { color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: <Flag size={10} /> },
  medium: { color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: <Flag size={10} /> },
  high: { color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: <Flag size={10} /> },
  urgent: { color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', icon: <AlertCircle size={10} /> },
};

const avatarColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500'];

const TaskCard: React.FC<{
  task: KanbanTask;
  onStar: () => void;
  index: number;
}> = ({ task, onStar, index }) => {
  const progress = task.checklist.total > 0
    ? Math.round((task.checklist.done / task.checklist.total) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.02 }}
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${priorityConfig[task.priority].bg} ${priorityConfig[task.priority].color}`}>
            {priorityConfig[task.priority].icon}
            {task.priority}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onStar(); }}
            className={`p-0.5 rounded ${task.starred ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}>
            <Star size={14} fill={task.starred ? 'currentColor' : 'none'} />
          </button>
          <button className="p-0.5 rounded text-gray-300 hover:text-gray-500">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-1">{task.title}</h4>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {task.tags.map(tag => (
          <span key={tag} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs">
            {tag}
          </span>
        ))}
      </div>

      {/* Checklist Progress */}
      {task.checklist.total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={10} />
              {task.checklist.done}/{task.checklist.total}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full ${avatarColors[task.assignee.charCodeAt(0) % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold`}>
            {task.assignee[0]}
          </div>
          {task.dueDate && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <Calendar size={10} />
              {task.dueDate.split('-').slice(1).join('/')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-0.5"><MessageSquare size={10} /> {task.comments}</span>
        </div>
      </div>
    </motion.div>
  );
};

const KanbanBoard: React.FC = () => {
  const [columns, setColumns] = useState(initialColumns);
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const toggleStar = useCallback((taskId: string) => {
    setColumns(prev => prev.map(col => ({
      ...col,
      tasks: col.tasks.map(t => t.id === taskId ? { ...t, starred: !t.starred } : t),
    })));
  }, []);

  const filteredColumns = useMemo(() =>
    columns.map(col => ({
      ...col,
      tasks: col.tasks.filter(t => {
        const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
        const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
        return matchSearch && matchPriority;
      }),
    })),
  [columns, search, filterPriority]);

  const totalTasks = columns.reduce((s, c) => s + c.tasks.length, 0);
  const completedTasks = columns.find(c => c.id === 'done')?.tasks.length || 0;

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <LayoutGrid className="text-indigo-500" size={32} />
              Kanban Board
            </h1>
            <p className="text-gray-500 mt-1">
              {totalTasks} tasks · {completedTasks} completed
            </p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 shadow-lg shadow-indigo-500/25">
            <Plus size={18} /> Add Task
          </motion.button>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            {['all', 'urgent', 'high', 'medium', 'low'].map(p => (
              <button key={p} onClick={() => setFilterPriority(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  filterPriority === p ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {filteredColumns.map((column, colIndex) => (
          <FadeIn key={column.id} delay={0.1 + colIndex * 0.05} className="flex-shrink-0 w-72">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 min-h-[600px]">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{column.title}</h3>
                  <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-500">{column.tasks.length}</span>
                </div>
                <button className="p-1 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                  <Plus size={14} />
                </button>
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                <AnimatePresence>
                  {column.tasks.map((task, i) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      index={i}
                      onStar={() => toggleStar(task.id)}
                    />
                  ))}
                </AnimatePresence>

                {column.tasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <Circle size={24} className="mx-auto mb-2 opacity-30" />
                    No tasks
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;
