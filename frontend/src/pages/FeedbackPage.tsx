import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Star, Send, ThumbsUp, ThumbsDown,
  Bug, Lightbulb, HelpCircle, AlertTriangle, Paperclip,
  CheckCircle, Clock, ArrowUpRight, Heart, Smile,
  Frown, Meh, X, Image, Plus,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'question' | 'praise';
type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status = 'open' | 'in-review' | 'planned' | 'resolved' | 'closed';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  rating: number;
  votes: number;
  author: string;
  createdAt: string;
  tags: string[];
  replies: number;
}

const typeConfig = {
  bug: { icon: Bug, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Bug Report' },
  feature: { icon: Lightbulb, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Feature Request' },
  improvement: { icon: ArrowUpRight, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Improvement' },
  question: { icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Question' },
  praise: { icon: Heart, color: 'text-pink-400', bg: 'bg-pink-500/10', label: 'Praise' },
};

const statusConfig = {
  open: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  'in-review': { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  planned: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  resolved: { color: 'text-green-400', bg: 'bg-green-500/10' },
  closed: { color: 'text-nexus-muted', bg: 'bg-gray-500/10' },
};

const sampleFeedback: FeedbackItem[] = [
  { id: '1', type: 'feature', title: 'Add multi-language support for voice commands', description: 'Would love to use voice commands in Spanish and French.', status: 'planned', priority: 'medium', rating: 5, votes: 24, author: 'User A', createdAt: '2024-03-18', tags: ['voice', 'i18n'], replies: 8 },
  { id: '2', type: 'bug', title: 'Dashboard charts not refreshing on data update', description: 'The charts show stale data until manual page refresh.', status: 'in-review', priority: 'high', rating: 0, votes: 15, author: 'User B', createdAt: '2024-03-19', tags: ['dashboard', 'charts'], replies: 5 },
  { id: '3', type: 'improvement', title: 'Better dark mode contrast on sidebar', description: 'Some text is hard to read in dark mode.', status: 'resolved', priority: 'low', rating: 4, votes: 32, author: 'User C', createdAt: '2024-03-15', tags: ['ui', 'dark-mode'], replies: 12 },
  { id: '4', type: 'praise', title: 'Love the new AI agent system!', description: 'The orchestrator is incredibly smooth. Great work!', status: 'closed', priority: 'low', rating: 5, votes: 45, author: 'User D', createdAt: '2024-03-17', tags: ['agents', 'praise'], replies: 6 },
  { id: '5', type: 'question', title: 'How to configure ESP32 sensors?', description: 'Looking for documentation on setting up custom sensors.', status: 'resolved', priority: 'medium', rating: 3, votes: 8, author: 'User E', createdAt: '2024-03-16', tags: ['iot', 'docs'], replies: 3 },
  { id: '6', type: 'bug', title: 'WebSocket disconnect during heavy load', description: 'Connections drop when processing multiple agent queries.', status: 'open', priority: 'critical', rating: 0, votes: 19, author: 'User F', createdAt: '2024-03-20', tags: ['websocket', 'performance'], replies: 2 },
  { id: '7', type: 'feature', title: 'Calendar integration with Google Calendar', description: 'Sync events bidirectionally with Google Calendar.', status: 'open', priority: 'medium', rating: 4, votes: 38, author: 'User G', createdAt: '2024-03-14', tags: ['calendar', 'integration'], replies: 11 },
  { id: '8', type: 'improvement', title: 'Keyboard shortcuts for common actions', description: 'Add Ctrl+K for command palette, Ctrl+N for new task, etc.', status: 'planned', priority: 'medium', rating: 5, votes: 28, author: 'User H', createdAt: '2024-03-13', tags: ['ux', 'keyboard'], replies: 7 },
];

const satisfactionData = [
  { name: '⭐ 5', value: 45 },
  { name: '⭐ 4', value: 28 },
  { name: '⭐ 3', value: 15 },
  { name: '⭐ 2', value: 8 },
  { name: '⭐ 1', value: 4 },
];

const trendData = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
  feedback: 8 + Math.floor(Math.random() * 20),
  resolved: 5 + Math.floor(Math.random() * 15),
}));

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#6366F1'];

export default function FeedbackPage() {
  const isDemo = useIsDemoAccount();
  const [feedback] = useState(isDemo ? sampleFeedback : []);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedRating, setSelectedRating] = useState(0);
  const [formType, setFormType] = useState<FeedbackType>('feature');

  const filtered = feedback.filter(f => {
    if (typeFilter !== 'All' && f.type !== typeFilter) return false;
    if (statusFilter !== 'All' && f.status !== statusFilter) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-nexus-bg p-6"
    >
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <MessageCircle className="text-nexus-primary" /> Feedback & Ideas
          </h1>
          <p className="text-nexus-muted mt-1">{feedback.length} submissions · {feedback.filter(f => f.status === 'resolved').length} resolved</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-nexus-primary px-4 py-2 text-white font-medium"
        >
          <Plus size={18} /> Submit Feedback
        </motion.button>
      </div>

      {/* Submit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl border border-nexus-border/30 p-6 mb-6 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-nexus-text">Submit Feedback</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-nexus-muted hover:text-nexus-text"><X size={16} /></button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 mb-4">
              {(Object.keys(typeConfig) as FeedbackType[]).map(t => {
                const tc = typeConfig[t];
                const Icon = tc.icon;
                return (
                  <button key={t} onClick={() => setFormType(t)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${formType === t ? `${tc.bg} ${tc.color}` : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>
                    <Icon size={14} /> {tc.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              <input placeholder="Title" className="w-full rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
              <textarea placeholder="Describe your feedback in detail..." rows={4} className="w-full rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-3 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 resize-none" />

              {/* Rating */}
              <div>
                <p className="text-xs text-nexus-muted mb-2">How would you rate your experience?</p>
                <div className="flex gap-2">
                  {[
                    { icon: Frown, label: 'Poor', value: 1 },
                    { icon: Meh, label: 'Okay', value: 2 },
                    { icon: Meh, label: 'Fair', value: 3 },
                    { icon: Smile, label: 'Good', value: 4 },
                    { icon: Heart, label: 'Love it!', value: 5 },
                  ].map(r => (
                    <button key={r.value} onClick={() => setSelectedRating(r.value)} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs transition-colors ${selectedRating === r.value ? 'bg-nexus-primary/10 text-nexus-primary' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>
                      <r.icon size={20} />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button className="flex items-center gap-2 text-sm text-nexus-muted hover:text-nexus-text"><Paperclip size={14} /> Attach file</button>
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-nexus-muted">Cancel</button>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm bg-nexus-primary text-white rounded-xl"><Send size={14} /> Submit</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Open', value: feedback.filter(f => f.status === 'open').length, icon: Clock, color: 'text-blue-400' },
            { label: 'In Review', value: feedback.filter(f => f.status === 'in-review').length, icon: AlertTriangle, color: 'text-yellow-400' },
            { label: 'Resolved', value: feedback.filter(f => f.status === 'resolved').length, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Total Votes', value: feedback.reduce((s, f) => s + f.votes, 0), icon: ThumbsUp, color: 'text-purple-400' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl border border-nexus-border/30 p-4">
              <stat.icon size={18} className={stat.color} />
              <p className="text-2xl font-bold text-nexus-text mt-2">{stat.value}</p>
              <p className="text-xs text-nexus-muted">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Satisfaction Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">Satisfaction</h3>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={satisfactionData} innerRadius={35} outerRadius={65} dataKey="value" paddingAngle={3}>
                {satisfactionData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Monthly Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Bar dataKey="feedback" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {['All', 'bug', 'feature', 'improvement', 'question', 'praise'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${typeFilter === t ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{t}</button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {['All', 'open', 'in-review', 'planned', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${statusFilter === s ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((item, i) => {
            const tc = typeConfig[item.type];
            const TypeIcon = tc.icon;
            const sc = statusConfig[item.status];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl border border-nexus-border/30 p-5 hover:border-nexus-primary/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tc.bg}`}>
                    <TypeIcon size={18} className={tc.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-nexus-text">{item.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${sc.bg} ${sc.color}`}>{item.status}</span>
                      {item.priority === 'critical' && <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400">Critical</span>}
                    </div>
                    <p className="text-sm text-nexus-muted mb-3">{item.description}</p>
                    <div className="flex items-center gap-4 text-xs text-nexus-muted">
                      <span>{item.author}</span>
                      <span>{item.createdAt}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={12} />{item.replies}</span>
                      {item.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-nexus-surface">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button className="p-1 hover:text-nexus-primary"><ThumbsUp size={16} /></button>
                    <span className="text-sm font-bold text-nexus-text">{item.votes}</span>
                    <button className="p-1 hover:text-red-400"><ThumbsDown size={16} /></button>
                  </div>
                </div>
                {item.rating > 0 && (
                  <div className="mt-3 pt-3 border-t border-nexus-border/20 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} size={14} className={s < item.rating ? 'text-yellow-400' : 'text-nexus-muted/30'} fill={s < item.rating ? 'currentColor' : 'none'} />
                    ))}
                    <span className="text-xs text-nexus-muted ml-2">{item.rating}/5</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
