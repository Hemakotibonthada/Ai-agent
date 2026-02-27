import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark, Star, Trash2, ExternalLink, Search, Filter,
  Plus, FolderOpen, Globe, Code, FileText, Clock,
  Tag, MoreVertical, Grid, List, Copy, Share2,
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  starred: boolean;
  createdAt: string;
  visits: number;
  favicon: string;
}

const sampleBookmarks: BookmarkItem[] = [
  { id: '1', title: 'React Documentation', url: 'https://react.dev', description: 'Official React docs with hooks, components, and API reference', category: 'Development', tags: ['react', 'frontend', 'docs'], starred: true, createdAt: '2024-01-15', visits: 45, favicon: '⚛️' },
  { id: '2', title: 'FastAPI Guide', url: 'https://fastapi.tiangolo.com', description: 'Modern Python web framework for building APIs', category: 'Development', tags: ['python', 'api', 'backend'], starred: true, createdAt: '2024-01-20', visits: 32, favicon: '🚀' },
  { id: '3', title: 'TailwindCSS', url: 'https://tailwindcss.com', description: 'Utility-first CSS framework for rapid UI development', category: 'Design', tags: ['css', 'design', 'frontend'], starred: false, createdAt: '2024-02-01', visits: 28, favicon: '🎨' },
  { id: '4', title: 'GitHub Repository', url: 'https://github.com', description: 'Source code and version control', category: 'Tools', tags: ['git', 'code', 'vcs'], starred: true, createdAt: '2024-02-05', visits: 67, favicon: '🐙' },
  { id: '5', title: 'PostgreSQL Docs', url: 'https://postgresql.org/docs', description: 'Advanced open source relational database', category: 'Database', tags: ['sql', 'database', 'postgres'], starred: false, createdAt: '2024-02-10', visits: 19, favicon: '🐘' },
  { id: '6', title: 'Docker Hub', url: 'https://hub.docker.com', description: 'Container image registry and management', category: 'DevOps', tags: ['docker', 'containers', 'deploy'], starred: false, createdAt: '2024-02-15', visits: 22, favicon: '🐳' },
  { id: '7', title: 'TypeScript Handbook', url: 'https://typescriptlang.org', description: 'TypeScript language documentation and playground', category: 'Development', tags: ['typescript', 'types', 'frontend'], starred: true, createdAt: '2024-03-01', visits: 38, favicon: '📘' },
  { id: '8', title: 'Figma Design System', url: 'https://figma.com', description: 'Collaborative interface design tool', category: 'Design', tags: ['design', 'ui', 'prototyping'], starred: false, createdAt: '2024-03-05', visits: 15, favicon: '🖌️' },
  { id: '9', title: 'Redis Documentation', url: 'https://redis.io/docs', description: 'In-memory data store for caching and messaging', category: 'Database', tags: ['cache', 'redis', 'nosql'], starred: false, createdAt: '2024-03-10', visits: 11, favicon: '🔴' },
  { id: '10', title: 'Prometheus Monitoring', url: 'https://prometheus.io', description: 'Systems monitoring and alerting toolkit', category: 'DevOps', tags: ['monitoring', 'metrics', 'alerts'], starred: true, createdAt: '2024-03-15', visits: 9, favicon: '📊' },
  { id: '11', title: 'MQTT Protocol Spec', url: 'https://mqtt.org', description: 'Lightweight messaging protocol for IoT', category: 'IoT', tags: ['mqtt', 'iot', 'messaging'], starred: false, createdAt: '2024-03-20', visits: 7, favicon: '📡' },
  { id: '12', title: 'OpenAI API Reference', url: 'https://platform.openai.com', description: 'AI model API documentation and guides', category: 'AI/ML', tags: ['ai', 'llm', 'api'], starred: true, createdAt: '2024-03-25', visits: 53, favicon: '🤖' },
];

const categories = ['All', 'Development', 'Design', 'Database', 'DevOps', 'IoT', 'AI/ML', 'Tools'];

const categoryIcons: Record<string, React.ReactNode> = {
  'Development': <Code size={14} />,
  'Design': <Globe size={14} />,
  'Database': <FolderOpen size={14} />,
  'DevOps': <FileText size={14} />,
  'IoT': <Globe size={14} />,
  'AI/ML': <Code size={14} />,
  'Tools': <FolderOpen size={14} />,
};

export default function BookmarksPage() {
  const isDemo = useIsDemoAccount();
  const [bookmarks, setBookmarks] = useState(isDemo ? sampleBookmarks : []);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showStarred, setShowStarred] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    let items = bookmarks;
    if (category !== 'All') items = items.filter(b => b.category === category);
    if (showStarred) items = items.filter(b => b.starred);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.tags.some(t => t.includes(q))
      );
    }
    return items;
  }, [bookmarks, search, category, showStarred]);

  const toggleStar = (id: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, starred: !b.starred } : b));
  };

  const deleteBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
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
            <Bookmark className="text-nexus-primary" /> Bookmarks
          </h1>
          <p className="text-nexus-muted mt-1">{bookmarks.length} saved links across {categories.length - 1} categories</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-xl bg-nexus-primary px-4 py-2 text-white font-medium"
        >
          <Plus size={18} /> Add Bookmark
        </motion.button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: bookmarks.length, icon: Bookmark },
          { label: 'Starred', value: bookmarks.filter(b => b.starred).length, icon: Star },
          { label: 'Categories', value: categories.length - 1, icon: FolderOpen },
          { label: 'Total Visits', value: bookmarks.reduce((s, b) => s + b.visits, 0), icon: ExternalLink },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-2xl p-4 border border-nexus-border/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-nexus-primary/10">
                <stat.icon size={18} className="text-nexus-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-nexus-text">{stat.value}</p>
                <p className="text-xs text-nexus-muted">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text"
        >
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowStarred(!showStarred)}
          className={`flex items-center gap-1 rounded-xl px-3 py-2 text-sm border transition-colors ${showStarred ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-nexus-surface border-nexus-border/30 text-nexus-muted'}`}
        >
          <Star size={14} fill={showStarred ? 'currentColor' : 'none'} /> Starred
        </button>
        <div className="flex rounded-xl border border-nexus-border/30 overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-nexus-primary/10 text-nexus-primary' : 'text-nexus-muted'}`}><Grid size={16} /></button>
          <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-nexus-primary/10 text-nexus-primary' : 'text-nexus-muted'}`}><List size={16} /></button>
        </div>
      </div>

      {/* Add Bookmark form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl border border-nexus-border/30 p-6 mb-6 overflow-hidden"
          >
            <h3 className="font-semibold text-nexus-text mb-4">Add New Bookmark</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Title" className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
              <input placeholder="URL" className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
              <input placeholder="Description" className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
              <select className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text">
                {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Tags (comma separated)" className="rounded-xl bg-nexus-bg border border-nexus-border/30 px-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50 md:col-span-2" />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text">Cancel</button>
              <button className="px-4 py-2 text-sm bg-nexus-primary text-white rounded-xl">Save</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bookmarks Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
        <AnimatePresence>
          {filtered.map((bookmark, i) => (
            <motion.div
              key={bookmark.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.04 }}
              className={`glass rounded-2xl border border-nexus-border/30 p-4 hover:border-nexus-primary/30 transition-all group ${viewMode === 'list' ? 'flex items-center gap-4' : ''}`}
            >
              {/* Favicon */}
              <div className={`flex items-center justify-center text-2xl ${viewMode === 'list' ? 'w-10 h-10' : 'w-12 h-12 mb-3'} rounded-xl bg-nexus-surface`}>
                {bookmark.favicon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-nexus-text truncate">{bookmark.title}</h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => toggleStar(bookmark.id)} className="p-1 hover:text-yellow-400"><Star size={14} fill={bookmark.starred ? 'currentColor' : 'none'} className={bookmark.starred ? 'text-yellow-400' : ''} /></button>
                    <button className="p-1 hover:text-nexus-primary"><Copy size={14} /></button>
                    <button className="p-1 hover:text-nexus-primary"><Share2 size={14} /></button>
                    <button onClick={() => deleteBookmark(bookmark.id)} className="p-1 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-xs text-nexus-primary truncate">{bookmark.url}</p>
                {viewMode === 'grid' && <p className="text-xs text-nexus-muted mt-1 line-clamp-2">{bookmark.description}</p>}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-nexus-primary/10 text-nexus-primary">{bookmark.category}</span>
                  {bookmark.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-nexus-surface text-nexus-muted">#{tag}</span>
                  ))}
                  <span className="text-[10px] text-nexus-muted ml-auto flex items-center gap-1"><Clock size={10} />{bookmark.visits} visits</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Bookmark size={48} className="mx-auto text-nexus-muted/30 mb-4" />
          <p className="text-nexus-muted">No bookmarks found</p>
        </div>
      )}
    </motion.div>
  );
}
