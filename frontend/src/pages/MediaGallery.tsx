import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image, Search, Grid, List, Upload, Download,
  Trash2, Star, StarOff, FolderOpen, Film,
  Music, FileImage, Eye, MoreHorizontal, Plus,
  Filter, SortAsc, ZoomIn, Heart, Share2,
  ImagePlus, X, Check, Copy,
} from 'lucide-react';

interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail: string;
  size: string;
  dimensions?: string;
  duration?: string;
  createdAt: string;
  tags: string[];
  starred: boolean;
  folder: string;
  color: string;
}

const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#6366F1', '#F97316', '#14B8A6', '#A855F7', '#84CC16'];

const sampleMedia: MediaItem[] = [
  { id: '1', name: 'nexus-dashboard-v2.png', type: 'image', url: '', thumbnail: '', size: '2.4 MB', dimensions: '1920x1080', createdAt: '2024-03-20', tags: ['screenshot', 'dashboard'], starred: true, folder: 'Screenshots', color: colors[0] },
  { id: '2', name: 'agent-demo-recording.mp4', type: 'video', url: '', thumbnail: '', size: '45.2 MB', duration: '3:42', createdAt: '2024-03-19', tags: ['demo', 'agents'], starred: false, folder: 'Videos', color: colors[1] },
  { id: '3', name: 'notification-sound.mp3', type: 'audio', url: '', thumbnail: '', size: '420 KB', duration: '0:03', createdAt: '2024-03-18', tags: ['sound', 'notification'], starred: false, folder: 'Audio', color: colors[2] },
  { id: '4', name: 'architecture-diagram.png', type: 'image', url: '', thumbnail: '', size: '1.8 MB', dimensions: '2560x1440', createdAt: '2024-03-18', tags: ['diagram', 'architecture'], starred: true, folder: 'Diagrams', color: colors[3] },
  { id: '5', name: 'onboarding-tutorial.mp4', type: 'video', url: '', thumbnail: '', size: '120.5 MB', duration: '12:30', createdAt: '2024-03-17', tags: ['tutorial', 'onboarding'], starred: false, folder: 'Videos', color: colors[4] },
  { id: '6', name: 'profile-avatar.jpg', type: 'image', url: '', thumbnail: '', size: '85 KB', dimensions: '256x256', createdAt: '2024-03-17', tags: ['avatar', 'profile'], starred: false, folder: 'Avatars', color: colors[5] },
  { id: '7', name: 'smart-home-overview.png', type: 'image', url: '', thumbnail: '', size: '3.1 MB', dimensions: '3840x2160', createdAt: '2024-03-16', tags: ['home', 'iot'], starred: true, folder: 'Screenshots', color: colors[6] },
  { id: '8', name: 'voice-sample-greeting.wav', type: 'audio', url: '', thumbnail: '', size: '1.2 MB', duration: '0:08', createdAt: '2024-03-16', tags: ['voice', 'tts'], starred: false, folder: 'Audio', color: colors[7] },
  { id: '9', name: 'deployment-flow.png', type: 'image', url: '', thumbnail: '', size: '950 KB', dimensions: '1600x900', createdAt: '2024-03-15', tags: ['diagram', 'ci-cd'], starred: false, folder: 'Diagrams', color: colors[8] },
  { id: '10', name: 'ml-model-training.mp4', type: 'video', url: '', thumbnail: '', size: '89.7 MB', duration: '8:15', createdAt: '2024-03-15', tags: ['ml', 'training'], starred: false, folder: 'Videos', color: colors[9] },
  { id: '11', name: 'analytics-chart.svg', type: 'image', url: '', thumbnail: '', size: '42 KB', dimensions: '800x600', createdAt: '2024-03-14', tags: ['chart', 'svg'], starred: false, folder: 'Icons', color: colors[10] },
  { id: '12', name: 'background-music.mp3', type: 'audio', url: '', thumbnail: '', size: '5.4 MB', duration: '3:22', createdAt: '2024-03-14', tags: ['music', 'ambient'], starred: true, folder: 'Audio', color: colors[11] },
  { id: '13', name: 'error-log-screenshot.png', type: 'image', url: '', thumbnail: '', size: '1.1 MB', dimensions: '1920x1080', createdAt: '2024-03-13', tags: ['debug', 'logs'], starred: false, folder: 'Screenshots', color: colors[0] },
  { id: '14', name: 'api-flow-diagram.png', type: 'image', url: '', thumbnail: '', size: '780 KB', dimensions: '1440x900', createdAt: '2024-03-13', tags: ['api', 'diagram'], starred: false, folder: 'Diagrams', color: colors[3] },
  { id: '15', name: 'feature-walkthrough.mp4', type: 'video', url: '', thumbnail: '', size: '210 MB', duration: '18:45', createdAt: '2024-03-12', tags: ['feature', 'walkthrough'], starred: true, folder: 'Videos', color: colors[4] },
  { id: '16', name: 'nexus-logo.svg', type: 'image', url: '', thumbnail: '', size: '12 KB', dimensions: '512x512', createdAt: '2024-03-12', tags: ['logo', 'brand'], starred: true, folder: 'Icons', color: colors[6] },
];

const typeIcons = { image: FileImage, video: Film, audio: Music };
const typeColors = { image: 'text-blue-400', video: 'text-purple-400', audio: 'text-green-400' };

export default function MediaGallery() {
  const [items, setItems] = useState(sampleMedia);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [folderFilter, setFolderFilter] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');

  const folders = useMemo(() => ['All', ...new Set(items.map(i => i.folder))], [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'all') list = list.filter(i => i.type === typeFilter);
    if (folderFilter !== 'All') list = list.filter(i => i.folder === folderFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.tags.some(t => t.includes(q)));
    }
    return list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return b.createdAt.localeCompare(a.createdAt);
      return parseFloat(b.size) - parseFloat(a.size);
    });
  }, [items, search, typeFilter, folderFilter, sortBy]);

  const toggleStar = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, starred: !i.starred } : i));
  const toggleSelect = (id: string) => setSelectedItems(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const stats = useMemo(() => ({
    total: items.length, images: items.filter(i => i.type === 'image').length,
    videos: items.filter(i => i.type === 'video').length, audio: items.filter(i => i.type === 'audio').length,
  }), [items]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Image className="text-nexus-primary" /> Media Gallery</h1>
          <p className="text-nexus-muted mt-1">{stats.total} items · {stats.images} images, {stats.videos} videos, {stats.audio} audio</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-xl bg-nexus-primary hover:bg-nexus-primary/90 px-4 py-2 text-sm text-white"><Upload size={16} /> Upload</button>
          {selectedItems.size > 0 && (
            <button onClick={() => setItems(prev => prev.filter(i => !selectedItems.has(i.id)))} className="flex items-center gap-2 rounded-xl bg-red-500/10 text-red-400 px-4 py-2 text-sm"><Trash2 size={16} /> Delete ({selectedItems.size})</button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search media..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <div className="flex gap-1">
          {(['all', 'image', 'video', 'audio'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs rounded-lg capitalize ${typeFilter === t ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>{t === 'all' ? 'All Types' : `${t}s`}</button>
          ))}
        </div>
        <select value={folderFilter} onChange={e => setFolderFilter(e.target.value)} className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text">
          {folders.map(f => <option key={f}>{f}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-sm text-nexus-text">
          <option value="date">Newest</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>
        <div className="flex gap-1 bg-nexus-surface rounded-xl p-1">
          <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg ${view === 'grid' ? 'bg-nexus-primary text-white' : 'text-nexus-muted'}`}><Grid size={14} /></button>
          <button onClick={() => setView('list')} className={`p-1.5 rounded-lg ${view === 'list' ? 'bg-nexus-primary text-white' : 'text-nexus-muted'}`}><List size={14} /></button>
        </div>
      </div>

      <div className={`grid gap-6 ${selectedItem ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Media Grid / List */}
        <div className={selectedItem ? 'lg:col-span-2' : ''}>
          {view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((item, i) => {
                const TypeIcon = typeIcons[item.type];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedItem(item)}
                    className={`group glass rounded-2xl border overflow-hidden cursor-pointer transition-all hover:border-nexus-primary/30 ${selectedItem?.id === item.id ? 'ring-2 ring-nexus-primary/50 border-nexus-primary/30' : 'border-nexus-border/30'}`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square relative flex items-center justify-center" style={{ background: `${item.color}15` }}>
                      <TypeIcon size={32} style={{ color: item.color }} className="opacity-60" />
                      {item.type === 'video' && item.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded">{item.duration}</span>
                      )}
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); toggleSelect(item.id); }} className={`p-1 rounded ${selectedItems.has(item.id) ? 'bg-nexus-primary text-white' : 'bg-black/50 text-white'}`}>
                          <Check size={10} />
                        </button>
                      </div>
                      <div className="absolute top-1 right-1">
                        <button onClick={e => { e.stopPropagation(); toggleStar(item.id); }} className="p-1">
                          {item.starred ? <Star size={12} className="text-yellow-400 fill-yellow-400" /> : <StarOff size={12} className="text-white/30 opacity-0 group-hover:opacity-100" />}
                        </button>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-nexus-text truncate">{item.name}</p>
                      <p className="text-[10px] text-nexus-muted">{item.size}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item, i) => {
                const TypeIcon = typeIcons[item.type];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setSelectedItem(item)}
                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-nexus-surface/50 ${selectedItem?.id === item.id ? 'bg-nexus-primary/5 border border-nexus-primary/30' : ''}`}
                  >
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${item.color}15` }}>
                      <TypeIcon size={18} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-nexus-text truncate">{item.name}</p>
                      <p className="text-xs text-nexus-muted">{item.folder} · {item.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${typeColors[item.type]}`}>{item.type}</span>
                      <span className="text-xs text-nexus-muted">{item.size}</span>
                      {item.dimensions && <span className="text-xs text-nexus-muted">{item.dimensions}</span>}
                      {item.duration && <span className="text-xs text-nexus-muted">{item.duration}</span>}
                      <button onClick={e => { e.stopPropagation(); toggleStar(item.id); }}>
                        {item.starred ? <Star size={14} className="text-yellow-400 fill-yellow-400" /> : <StarOff size={14} className="text-nexus-muted" />}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-nexus-text">Details</h3>
                <button onClick={() => setSelectedItem(null)} className="p-1 hover:text-nexus-primary text-nexus-muted"><X size={16} /></button>
              </div>

              {/* Preview */}
              <div className="aspect-video mb-4 rounded-xl flex items-center justify-center" style={{ background: `${selectedItem.color}10` }}>
                {React.createElement(typeIcons[selectedItem.type], { size: 48, style: { color: selectedItem.color }, className: 'opacity-60' })}
              </div>

              <h4 className="font-medium text-nexus-text text-sm mb-4 break-all">{selectedItem.name}</h4>

              <div className="space-y-3 mb-6">
                {[
                  ['Type', selectedItem.type],
                  ['Size', selectedItem.size],
                  selectedItem.dimensions ? ['Dimensions', selectedItem.dimensions] : null,
                  selectedItem.duration ? ['Duration', selectedItem.duration] : null,
                  ['Folder', selectedItem.folder],
                  ['Created', selectedItem.createdAt],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-xs">
                    <span className="text-nexus-muted">{k}</span>
                    <span className="text-nexus-text">{v}</span>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <h5 className="text-xs text-nexus-muted mb-2">Tags</h5>
                <div className="flex flex-wrap gap-1">
                  {selectedItem.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-nexus-primary/10 text-nexus-primary text-[10px]">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="flex items-center justify-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-xs text-nexus-muted hover:text-nexus-text"><Download size={12} /> Download</button>
                <button className="flex items-center justify-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-xs text-nexus-muted hover:text-nexus-text"><Share2 size={12} /> Share</button>
                <button className="flex items-center justify-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-3 py-2 text-xs text-nexus-muted hover:text-nexus-text"><Copy size={12} /> Copy URL</button>
                <button className="flex items-center justify-center gap-2 rounded-xl bg-red-500/10 text-red-400 px-3 py-2 text-xs"><Trash2 size={12} /> Delete</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
