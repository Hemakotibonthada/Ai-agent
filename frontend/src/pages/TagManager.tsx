import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Plus, Search, Trash2, Edit3, Check, X, Hash,
  TrendingUp, BarChart3, Palette, Filter, Grid, List,
  FolderOpen, FileText, Bot, Zap, Star, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface TagItem {
  id: string;
  name: string;
  color: string;
  count: number;
  category: string;
  description: string;
  createdAt: string;
}

const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#84CC16'];

const sampleTags: TagItem[] = [
  { id: '1', name: 'frontend', color: '#3B82F6', count: 42, category: 'Tech', description: 'Frontend development items', createdAt: '2024-01-10' },
  { id: '2', name: 'backend', color: '#8B5CF6', count: 38, category: 'Tech', description: 'Backend development items', createdAt: '2024-01-10' },
  { id: '3', name: 'urgent', color: '#EF4444', count: 12, category: 'Priority', description: 'Urgent priority items', createdAt: '2024-01-12' },
  { id: '4', name: 'feature', color: '#10B981', count: 56, category: 'Type', description: 'New feature requests', createdAt: '2024-01-15' },
  { id: '5', name: 'bug', color: '#EC4899', count: 23, category: 'Type', description: 'Bug reports and fixes', createdAt: '2024-01-15' },
  { id: '6', name: 'ai-agent', color: '#6366F1', count: 31, category: 'Tech', description: 'AI agent related items', createdAt: '2024-01-20' },
  { id: '7', name: 'automation', color: '#F59E0B', count: 19, category: 'Tech', description: 'Automation workflows', createdAt: '2024-02-01' },
  { id: '8', name: 'security', color: '#EF4444', count: 15, category: 'Domain', description: 'Security-related items', createdAt: '2024-02-05' },
  { id: '9', name: 'performance', color: '#14B8A6', count: 27, category: 'Quality', description: 'Performance optimization', createdAt: '2024-02-10' },
  { id: '10', name: 'documentation', color: '#F97316', count: 34, category: 'Type', description: 'Documentation tasks', createdAt: '2024-02-15' },
  { id: '11', name: 'iot', color: '#84CC16', count: 18, category: 'Domain', description: 'IoT and smart home', createdAt: '2024-02-20' },
  { id: '12', name: 'api', color: '#3B82F6', count: 29, category: 'Tech', description: 'API endpoints and services', createdAt: '2024-03-01' },
  { id: '13', name: 'testing', color: '#8B5CF6', count: 21, category: 'Quality', description: 'Testing and QA', createdAt: '2024-03-05' },
  { id: '14', name: 'deploy', color: '#10B981', count: 16, category: 'DevOps', description: 'Deployment related', createdAt: '2024-03-10' },
  { id: '15', name: 'ml-model', color: '#EC4899', count: 13, category: 'Tech', description: 'Machine learning models', createdAt: '2024-03-15' },
  { id: '16', name: 'low-priority', color: '#6366F1', count: 44, category: 'Priority', description: 'Low priority items', createdAt: '2024-03-20' },
];

const tagCategories = ['All', 'Tech', 'Type', 'Priority', 'Quality', 'Domain', 'DevOps'];

export default function TagManager() {
  const [tags, setTags] = useState(sampleTags);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: colors[0], category: 'Tech', description: '' });

  const filtered = useMemo(() => {
    let items = tags;
    if (selectedCategory !== 'All') items = items.filter(t => t.category === selectedCategory);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(t => t.name.includes(q) || t.description.toLowerCase().includes(q));
    }
    return items.sort((a, b) => b.count - a.count);
  }, [tags, search, selectedCategory]);

  const chartData = useMemo(() => {
    const byCategory: Record<string, number> = {};
    tags.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.count; });
    return Object.entries(byCategory).map(([name, value]) => ({ name, value }));
  }, [tags]);

  const topTags = useMemo(() => [...tags].sort((a, b) => b.count - a.count).slice(0, 8), [tags]);

  const deleteTag = (id: string) => setTags(prev => prev.filter(t => t.id !== id));

  const createTag = () => {
    if (!newTag.name) return;
    const tag: TagItem = {
      id: String(Date.now()),
      name: newTag.name.toLowerCase().replace(/\s+/g, '-'),
      color: newTag.color,
      count: 0,
      category: newTag.category,
      description: newTag.description,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTags(prev => [...prev, tag]);
    setNewTag({ name: '', color: colors[0], category: 'Tech', description: '' });
    setShowCreate(false);
  };

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
            <Tag className="text-nexus-primary" /> Tag Manager
          </h1>
          <p className="text-nexus-muted mt-1">{tags.length} tags · {tags.reduce((s, t) => s + t.count, 0)} total uses</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-xl bg-nexus-primary px-4 py-2 text-white font-medium"
        >
          <Plus size={18} /> Create Tag
        </motion.button>
      </div>

      {/* Create Tag Panel */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl border border-nexus-border/30 p-6 mb-6 overflow-hidden"
          >
            <h3 className="font-semibold text-nexus-text mb-4">Create New Tag</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} placeholder="Tag name" className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
              <select value={newTag.category} onChange={e => setNewTag({ ...newTag, category: e.target.value })} className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text">
                {tagCategories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
              <div className="flex gap-2">
                {colors.map(c => (
                  <button key={c} onClick={() => setNewTag({ ...newTag, color: c })} className={`w-6 h-6 rounded-full transition-transform ${newTag.color === c ? 'scale-125 ring-2 ring-white/50' : ''}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={createTag} className="flex-1 bg-nexus-primary text-white rounded-xl px-4 py-2 text-sm">Create</button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-nexus-muted">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-2xl border border-nexus-border/30 p-6"
        >
          <h3 className="font-semibold text-nexus-text mb-4 flex items-center gap-2"><BarChart3 size={16} /> Tag Uses by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Bar dataKey="value" fill="#3B82F6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Top Tags */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass rounded-2xl border border-nexus-border/30 p-6"
        >
          <h3 className="font-semibold text-nexus-text mb-4 flex items-center gap-2"><TrendingUp size={16} /> Most Used Tags</h3>
          <div className="space-y-3">
            {topTags.map((tag, i) => (
              <div key={tag.id} className="flex items-center gap-3">
                <span className="text-xs text-nexus-muted w-4">{i + 1}</span>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="text-sm text-nexus-text flex-1">#{tag.name}</span>
                <div className="flex-1 h-2 bg-nexus-surface rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(tag.count / topTags[0].count) * 100}%` }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                </div>
                <span className="text-xs font-mono text-nexus-muted w-8 text-right">{tag.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tags..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {tagCategories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${selectedCategory === cat ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{cat}</button>
          ))}
        </div>
        <div className="flex rounded-xl border border-nexus-border/30 overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-nexus-primary/10 text-nexus-primary' : 'text-nexus-muted'}`}><Grid size={16} /></button>
          <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-nexus-primary/10 text-nexus-primary' : 'text-nexus-muted'}`}><List size={16} /></button>
        </div>
      </div>

      {/* Tags */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
        <AnimatePresence>
          {filtered.map((tag, i) => (
            <motion.div
              key={tag.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: i * 0.03 }}
              className={`glass rounded-2xl border border-nexus-border/30 p-4 hover:border-nexus-primary/30 transition-all group ${viewMode === 'list' ? 'flex items-center gap-4' : ''}`}
            >
              <div className={`flex items-center gap-3 ${viewMode === 'grid' ? 'mb-3' : ''}`}>
                <div className="w-4 h-4 rounded-full ring-2 ring-offset-2 ring-offset-nexus-bg" style={{ backgroundColor: tag.color, ringColor: tag.color }} />
                <span className="font-semibold text-nexus-text flex-1">#{tag.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1 hover:text-nexus-primary"><Edit3 size={12} /></button>
                  <button onClick={() => deleteTag(tag.id)} className="p-1 hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              </div>
              {viewMode === 'grid' && <p className="text-xs text-nexus-muted mb-2">{tag.description}</p>}
              <div className="flex items-center gap-2 text-[10px] text-nexus-muted">
                <span className="px-2 py-0.5 rounded-full bg-nexus-surface">{tag.category}</span>
                <span>{tag.count} uses</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Tag size={48} className="mx-auto text-nexus-muted/30 mb-4" />
          <p className="text-nexus-muted">No tags found</p>
        </div>
      )}
    </motion.div>
  );
}
