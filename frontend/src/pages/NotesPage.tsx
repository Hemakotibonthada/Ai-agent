import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StickyNote, Plus, Search, Grid3X3, List, Star, Clock,
  Tag, Trash2, Edit3, Pin, Archive, MoreVertical,
  Bold, Italic, Underline, Code, Link, Image, ListOrdered,
  AlignLeft, X, ChevronRight, Hash, Bookmark, Eye
} from 'lucide-react';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Note {
  id: string;
  title: string;
  content: string;
  preview: string;
  tags: string[];
  color: string;
  pinned: boolean;
  starred: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  category: string;
  wordCount: number;
}

const noteColors = [
  'bg-nexus-card', 'bg-yellow-50 dark:bg-yellow-900/20',
  'bg-blue-50 dark:bg-blue-900/20', 'bg-green-50 dark:bg-green-900/20',
  'bg-pink-50 dark:bg-pink-900/20', 'bg-purple-50 dark:bg-purple-900/20',
  'bg-orange-50 dark:bg-orange-900/20', 'bg-cyan-50 dark:bg-cyan-900/20',
];

const notesData: Note[] = [
  { id: 'n1', title: 'AI Architecture Plans', content: 'Multi-agent orchestration with specialized agents for different domains. Each agent has its own memory context and can communicate through the message bus.', preview: 'Multi-agent orchestration with specialized agents...', tags: ['architecture', 'ai'], color: noteColors[1]!, pinned: true, starred: true, archived: false, createdAt: '2024-03-10', updatedAt: '2 hours ago', category: 'Engineering', wordCount: 342 },
  { id: 'n2', title: 'Sprint Planning Notes', content: 'Sprint 24 goals: Complete plugin marketplace, implement A/B testing framework, optimize database queries, and deploy monitoring dashboard.', preview: 'Sprint 24 goals: Complete plugin marketplace...', tags: ['sprint', 'planning'], color: noteColors[0]!, pinned: true, starred: false, archived: false, createdAt: '2024-03-08', updatedAt: '1 day ago', category: 'Project', wordCount: 189 },
  { id: 'n3', title: 'Meeting: Client Requirements', content: 'Key requirements from client meeting: Real-time dashboard, voice commands, mobile app with offline support, biometric authentication, custom reporting.', preview: 'Key requirements from client meeting...', tags: ['meeting', 'client'], color: noteColors[2]!, pinned: false, starred: true, archived: false, createdAt: '2024-03-07', updatedAt: '3 days ago', category: 'Meetings', wordCount: 567 },
  { id: 'n4', title: 'Security Audit Checklist', content: 'OWASP Top 10 review, penetration testing schedule, SSL certificate management, API rate limiting configuration, data encryption at rest checklist.', preview: 'OWASP Top 10 review, penetration testing...', tags: ['security', 'audit'], color: noteColors[4]!, pinned: false, starred: false, archived: false, createdAt: '2024-03-05', updatedAt: '5 days ago', category: 'Security', wordCount: 423 },
  { id: 'n5', title: 'Database Schema Changes', content: 'New tables needed: feature_flags, ab_tests, plugin_registry, workflow_executions. Migration plan: Phase 1 - create tables, Phase 2 - migrate data.', preview: 'New tables needed: feature_flags, ab_tests...', tags: ['database', 'migration'], color: noteColors[3]!, pinned: false, starred: false, archived: false, createdAt: '2024-03-04', updatedAt: '6 days ago', category: 'Engineering', wordCount: 278 },
  { id: 'n6', title: 'Performance Optimization Ideas', content: 'Implement Redis caching for frequent queries, add connection pooling, lazy load frontend modules, optimize image compression, implement CDN for static assets.', preview: 'Implement Redis caching for frequent queries...', tags: ['performance', 'optimization'], color: noteColors[5]!, pinned: false, starred: true, archived: false, createdAt: '2024-03-03', updatedAt: '1 week ago', category: 'Engineering', wordCount: 345 },
  { id: 'n7', title: 'IoT Device Protocol Notes', content: 'MQTT vs WebSocket comparison for IoT devices. MQTT: Lower overhead, QoS levels. WebSocket: Bidirectional, browser compatible. Recommendation: MQTT for sensors, WS for UI.', preview: 'MQTT vs WebSocket comparison for IoT devices...', tags: ['iot', 'protocol'], color: noteColors[6]!, pinned: false, starred: false, archived: false, createdAt: '2024-03-01', updatedAt: '10 days ago', category: 'Research', wordCount: 412 },
  { id: 'n8', title: 'Release v3.0 Changelog', content: 'Major features: Plugin marketplace, workflow builder, A/B testing, advanced analytics, terminal emulator, kanban board, calendar views, feature flags system.', preview: 'Major features: Plugin marketplace, workflow...', tags: ['release', 'changelog'], color: noteColors[7]!, pinned: false, starred: false, archived: false, createdAt: '2024-02-28', updatedAt: '2 weeks ago', category: 'Release', wordCount: 890 },
  { id: 'n9', title: 'API Design Guidelines', content: 'RESTful conventions: Use nouns for resources, HTTP methods for actions. Versioning via URL prefix. Pagination with cursor-based approach. Rate limiting headers.', preview: 'RESTful conventions: Use nouns for resources...', tags: ['api', 'guidelines'], color: noteColors[0]!, pinned: false, starred: false, archived: true, createdAt: '2024-02-20', updatedAt: '3 weeks ago', category: 'Engineering', wordCount: 678 },
];

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState(isDemo ? notesData : []);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  const togglePin = (id: string) => setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  const toggleStar = (id: string) => setNotes(prev => prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n));

  const categories = useMemo(() => {
    const cats = [...new Set(notes.map(n => n.category))];
    return ['all', ...cats];
  }, [notes]);

  const filtered = useMemo(() => {
    return notes
      .filter(n => {
        const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()) || n.tags.some(t => t.includes(search.toLowerCase()));
        const matchCategory = filterCategory === 'all' || n.category === filterCategory;
        const matchArchived = showArchived ? n.archived : !n.archived;
        return matchSearch && matchCategory && matchArchived;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return 0;
      });
  }, [notes, search, filterCategory, showArchived]);

  const stats = useMemo(() => ({
    total: notes.filter(n => !n.archived).length,
    pinned: notes.filter(n => n.pinned).length,
    starred: notes.filter(n => n.starred).length,
    archived: notes.filter(n => n.archived).length,
  }), [notes]);

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <StickyNote className="text-yellow-500" size={32} />
              Notes
            </h1>
            <p className="text-nexus-muted mt-1">{stats.total} notes · {stats.pinned} pinned · {stats.starred} starred</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 shadow-lg shadow-yellow-500/25">
            <Plus size={18} /> New Note
          </motion.button>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input type="text" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-nexus-card border border-nexus-border text-nexus-text focus:ring-2 focus:ring-yellow-500 outline-none" />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-nexus-card border border-nexus-border text-sm outline-none text-nexus-text">
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-nexus-surface' : 'hover:bg-nexus-surface'}`}>
              <Grid3X3 size={16} className={view === 'grid' ? 'text-nexus-text' : 'text-nexus-muted'} />
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-nexus-surface' : 'hover:bg-nexus-surface'}`}>
              <List size={16} className={view === 'list' ? 'text-nexus-text' : 'text-nexus-muted'} />
            </button>
            <button onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${showArchived ? 'bg-nexus-surface text-nexus-text' : 'text-nexus-muted hover:bg-nexus-surface'}`}>
              <Archive size={14} /> {showArchived ? 'Archived' : 'Active'}
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Notes Grid/List */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -4, boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
              onClick={() => setSelectedNote(note)}
              className={`${note.color} rounded-2xl p-5 border border-nexus-border cursor-pointer group relative`}
            >
              {note.pinned && (
                <div className="absolute -top-1.5 -right-1.5">
                  <Pin size={16} className="text-red-500 fill-red-500 rotate-45" />
                </div>
              )}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-nexus-text text-sm line-clamp-1 flex-1">{note.title}</h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); toggleStar(note.id); }}
                    className={note.starred ? 'text-yellow-400' : 'text-nexus-muted'}>
                    <Star size={14} fill={note.starred ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-nexus-muted line-clamp-3 mb-3">{note.preview}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {note.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded bg-nexus-border/30 text-nexus-muted text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-nexus-border/50 text-xs text-nexus-muted">
                <span className="flex items-center gap-1"><Clock size={10} /> {note.updatedAt}</span>
                <span>{note.wordCount} words</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-nexus-card rounded-2xl border border-nexus-border divide-y divide-nexus-border">
          {filtered.map((note, i) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedNote(note)}
              className="flex items-center gap-4 p-4 hover:bg-nexus-surface/60/30 cursor-pointer group transition-colors"
            >
              {note.pinned && <Pin size={14} className="text-red-500 fill-red-500 rotate-45 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm text-nexus-text truncate">{note.title}</h4>
                  {note.starred && <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                </div>
                <p className="text-xs text-nexus-muted truncate mt-0.5">{note.preview}</p>
              </div>
              <span className="text-xs text-nexus-muted px-2 py-0.5 rounded-full bg-nexus-surface flex-shrink-0">{note.category}</span>
              <span className="text-xs text-nexus-muted flex-shrink-0">{note.updatedAt}</span>
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <StickyNote size={48} className="text-nexus-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-nexus-text mb-2">No notes found</h3>
          <p className="text-nexus-muted">Create a new note or adjust your filters.</p>
        </div>
      )}

      {/* Note Detail Modal */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedNote(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className={`${selectedNote.color} rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl border border-nexus-border`}>
              <div className="p-6">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => togglePin(selectedNote.id)}
                      className={`p-1.5 rounded-lg ${selectedNote.pinned ? 'text-red-500' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                      <Pin size={16} className={selectedNote.pinned ? 'fill-red-500 rotate-45' : ''} />
                    </button>
                    <button onClick={() => toggleStar(selectedNote.id)}
                      className={`p-1.5 rounded-lg ${selectedNote.starred ? 'text-yellow-400' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                      <Star size={16} fill={selectedNote.starred ? 'currentColor' : 'none'} />
                    </button>
                    <span className="text-xs text-nexus-muted px-2 py-0.5 bg-nexus-border/30 rounded-full">{selectedNote.category}</span>
                  </div>
                  <button onClick={() => setSelectedNote(null)} className="p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-600/50">
                    <X size={16} className="text-nexus-muted" />
                  </button>
                </div>
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 mb-4 pb-3 border-b border-nexus-border/50">
                  {[Bold, Italic, Underline, Code, Link, Image, ListOrdered, AlignLeft].map((Icon, i) => (
                    <button key={i} className="p-1.5 rounded-lg text-nexus-muted hover:text-nexus-muted hover:bg-gray-200/50 dark:hover:bg-gray-600/50">
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
                <h1 className="text-2xl font-bold text-nexus-text mb-4">{selectedNote.title}</h1>
                <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                  <p className="text-nexus-text whitespace-pre-wrap leading-relaxed">{selectedNote.content}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedNote.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 rounded-full bg-nexus-border/30 text-nexus-muted text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-nexus-muted pt-3 border-t border-nexus-border/50">
                  <span>Created: {selectedNote.createdAt}</span>
                  <span>Updated: {selectedNote.updatedAt}</span>
                  <span>{selectedNote.wordCount} words</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotesPage;
