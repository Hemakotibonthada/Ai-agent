import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, GitBranch, GitCommit, GitMerge, Search,
  Filter, Eye, RefreshCw, Clock, User, FileText,
  Plus, Minus, ChevronRight, Tag, ArrowLeft,
  ArrowRight, Download, Copy, AlertCircle,
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface VersionEntry {
  id: string;
  hash: string;
  message: string;
  author: string;
  date: string;
  type: 'commit' | 'merge' | 'tag' | 'release';
  branch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  tags: string[];
  files: { name: string; status: 'added' | 'modified' | 'deleted'; changes: number }[];
}

const sampleVersions: VersionEntry[] = [
  {
    id: '1', hash: '82bd257', message: 'feat: add enhanced UI charts across all pages',
    author: 'Nexus AI', date: '2024-03-20 14:30', type: 'merge', branch: 'feature/enhanced-ui-charts',
    filesChanged: 24, additions: 3200, deletions: 450, tags: ['v2.1.0'],
    files: [
      { name: 'frontend/src/pages/Dashboard.tsx', status: 'modified', changes: 180 },
      { name: 'frontend/src/pages/Analytics.tsx', status: 'added', changes: 420 },
      { name: 'frontend/src/components/ui/Charts.tsx', status: 'added', changes: 350 },
      { name: 'backend/services/analytics_service.py', status: 'added', changes: 500 },
    ],
  },
  {
    id: '2', hash: 'a4f2e81', message: 'feat: implement agent orchestration with priority queue',
    author: 'Nexus AI', date: '2024-03-19 16:45', type: 'commit', branch: 'main',
    filesChanged: 8, additions: 890, deletions: 120, tags: [],
    files: [
      { name: 'backend/agents/orchestrator.py', status: 'modified', changes: 340 },
      { name: 'backend/agents/base_agent.py', status: 'modified', changes: 85 },
      { name: 'backend/core/engine.py', status: 'modified', changes: 190 },
    ],
  },
  {
    id: '3', hash: 'f1c3d9e', message: 'fix: resolve WebSocket reconnection loop in voice agent',
    author: 'Nexus AI', date: '2024-03-19 10:20', type: 'commit', branch: 'main',
    filesChanged: 3, additions: 45, deletions: 28, tags: [],
    files: [
      { name: 'frontend/src/hooks/useWebSocket.ts', status: 'modified', changes: 32 },
      { name: 'backend/api/websocket.py', status: 'modified', changes: 18 },
    ],
  },
  {
    id: '4', hash: 'b7e2f44', message: 'feat: add smart home MQTT integration with ESP32',
    author: 'Nexus AI', date: '2024-03-18 09:15', type: 'merge', branch: 'feature/mqtt-integration',
    filesChanged: 15, additions: 2100, deletions: 300, tags: ['v2.0.0'],
    files: [
      { name: 'backend/services/mqtt_service.py', status: 'added', changes: 450 },
      { name: 'esp32/src/mqtt_handler.cpp', status: 'added', changes: 280 },
      { name: 'backend/agents/home_agent.py', status: 'modified', changes: 190 },
    ],
  },
  {
    id: '5', hash: 'c9d4a12', message: 'refactor: modularize frontend state with Zustand stores',
    author: 'Nexus AI', date: '2024-03-17 14:00', type: 'commit', branch: 'main',
    filesChanged: 12, additions: 680, deletions: 420, tags: [],
    files: [
      { name: 'frontend/src/lib/store.ts', status: 'modified', changes: 280 },
      { name: 'frontend/src/hooks/useTheme.ts', status: 'modified', changes: 45 },
    ],
  },
  {
    id: '6', hash: 'e5f1b78', message: 'feat: implement RAG engine with local embeddings',
    author: 'Nexus AI', date: '2024-03-16 11:30', type: 'commit', branch: 'main',
    filesChanged: 6, additions: 1200, deletions: 0, tags: [],
    files: [
      { name: 'backend/models/rag_engine.py', status: 'added', changes: 550 },
      { name: 'backend/models/embeddings.py', status: 'added', changes: 380 },
    ],
  },
  {
    id: '7', hash: '3a8c5d1', message: 'release: v1.5.0 - multi-agent system launch',
    author: 'Nexus AI', date: '2024-03-15 08:00', type: 'release', branch: 'main',
    filesChanged: 45, additions: 8500, deletions: 1200, tags: ['v1.5.0'],
    files: [
      { name: 'backend/agents/', status: 'added', changes: 4500 },
      { name: 'frontend/src/pages/Agents.tsx', status: 'added', changes: 1001 },
    ],
  },
  {
    id: '8', hash: 'd2e7f9a', message: 'fix: database connection pooling memory leak',
    author: 'Nexus AI', date: '2024-03-14 16:20', type: 'commit', branch: 'main',
    filesChanged: 2, additions: 35, deletions: 12, tags: [],
    files: [
      { name: 'backend/database/connection.py', status: 'modified', changes: 47 },
    ],
  },
  {
    id: '9', hash: 'f8a1c3b', message: 'feat: add voice command recognition with wake word detection',
    author: 'Nexus AI', date: '2024-03-13 12:45', type: 'merge', branch: 'feature/voice-commands',
    filesChanged: 10, additions: 1800, deletions: 200, tags: ['v1.4.0'],
    files: [
      { name: 'backend/agents/voice_agent.py', status: 'added', changes: 420 },
      { name: 'backend/services/voice_service.py', status: 'added', changes: 380 },
      { name: 'frontend/src/pages/Voice.tsx', status: 'added', changes: 550 },
    ],
  },
  {
    id: '10', hash: '1b4d6e2', message: 'chore: initial project setup with FastAPI + React + Vite',
    author: 'Nexus AI', date: '2024-03-10 09:00', type: 'commit', branch: 'main',
    filesChanged: 35, additions: 5200, deletions: 0, tags: ['v1.0.0'],
    files: [
      { name: 'backend/main.py', status: 'added', changes: 250 },
      { name: 'frontend/src/App.tsx', status: 'added', changes: 120 },
      { name: 'docker-compose.yml', status: 'added', changes: 45 },
    ],
  },
];

const typeConfig = {
  commit: { icon: GitCommit, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  merge: { icon: GitMerge, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  tag: { icon: Tag, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  release: { icon: Tag, color: 'text-green-400', bg: 'bg-green-500/10' },
};

export default function VersionHistory() {
  const isDemo = useIsDemoAccount();
  const [versions] = useState(isDemo ? sampleVersions : []);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null);

  const filtered = useMemo(() => {
    let items = versions;
    if (typeFilter !== 'All') items = items.filter(v => v.type === typeFilter.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(v => v.message.toLowerCase().includes(q) || v.hash.includes(q) || v.branch.includes(q));
    }
    return items;
  }, [versions, search, typeFilter]);

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
            <History className="text-nexus-primary" /> Version History
          </h1>
          <p className="text-nexus-muted mt-1">{versions.length} versions · {versions.reduce((s, v) => s + v.additions, 0).toLocaleString()} additions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Commits', value: versions.length, icon: GitCommit, color: 'text-blue-400' },
          { label: 'Releases', value: versions.filter(v => v.type === 'release').length, icon: Tag, color: 'text-green-400' },
          { label: 'Lines Added', value: `${(versions.reduce((s, v) => s + v.additions, 0) / 1000).toFixed(1)}K`, icon: Plus, color: 'text-emerald-400' },
          { label: 'Files Changed', value: versions.reduce((s, v) => s + v.filesChanged, 0), icon: FileText, color: 'text-purple-400' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass rounded-2xl border border-nexus-border/30 p-4">
            <div className="flex items-center gap-3">
              <stat.icon size={18} className={stat.color} />
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search commits, hashes..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <div className="flex gap-1">
          {['All', 'Commit', 'Merge', 'Release'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${typeFilter === t ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className={`space-y-0 ${selectedVersion ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          {filtered.map((version, i) => {
            const tc = typeConfig[version.type];
            const TypeIcon = tc.icon;
            return (
              <motion.div
                key={version.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                {/* Timeline line */}
                {i < filtered.length - 1 && <div className="absolute left-6 top-12 bottom-0 w-px bg-nexus-border/30" />}

                <div
                  onClick={() => setSelectedVersion(version)}
                  className={`flex gap-4 p-4 rounded-2xl cursor-pointer transition-all hover:bg-nexus-surface/50 ${selectedVersion?.id === version.id ? 'bg-nexus-primary/5 border border-nexus-primary/30' : ''}`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tc.bg}`}>
                    <TypeIcon size={16} className={tc.color} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nexus-text line-clamp-1">{version.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-nexus-muted">
                      <span className="font-mono text-nexus-primary">{version.hash}</span>
                      <span className="flex items-center gap-1"><GitBranch size={10} />{version.branch}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{version.date}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      <span className="text-green-400">+{version.additions}</span>
                      <span className="text-red-400">-{version.deletions}</span>
                      <span className="text-nexus-muted">{version.filesChanged} files</span>
                      {version.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedVersion && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-2 glass rounded-2xl border border-nexus-border/30 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-nexus-text">{selectedVersion.message}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-nexus-muted">
                    <span className="font-mono text-nexus-primary">{selectedVersion.hash}</span>
                    <span>{selectedVersion.author}</span>
                    <span>{selectedVersion.date}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedVersion(null)} className="p-1 hover:text-nexus-primary">✕</button>
              </div>

              {/* Change Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-nexus-surface rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-green-400">+{selectedVersion.additions}</p>
                  <p className="text-xs text-nexus-muted">Additions</p>
                </div>
                <div className="bg-nexus-surface rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-red-400">-{selectedVersion.deletions}</p>
                  <p className="text-xs text-nexus-muted">Deletions</p>
                </div>
                <div className="bg-nexus-surface rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-nexus-text">{selectedVersion.filesChanged}</p>
                  <p className="text-xs text-nexus-muted">Files Changed</p>
                </div>
              </div>

              {/* Changes bar */}
              <div className="mb-6">
                <div className="flex h-2 rounded-full overflow-hidden bg-nexus-surface">
                  <div className="bg-green-500" style={{ width: `${(selectedVersion.additions / (selectedVersion.additions + selectedVersion.deletions)) * 100}%` }} />
                  <div className="bg-red-500" style={{ width: `${(selectedVersion.deletions / (selectedVersion.additions + selectedVersion.deletions)) * 100}%` }} />
                </div>
              </div>

              {/* Files */}
              <h4 className="font-semibold text-nexus-text mb-3">Changed Files</h4>
              <div className="space-y-2">
                {selectedVersion.files.map((file, i) => (
                  <motion.div
                    key={file.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-nexus-surface/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${file.status === 'added' ? 'bg-green-500/10 text-green-400' : file.status === 'deleted' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M'}
                      </span>
                      <span className="text-sm text-nexus-text font-mono truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-nexus-muted shrink-0">±{file.changes}</span>
                  </motion.div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-nexus-border/30">
                <button className="flex items-center gap-2 rounded-xl bg-nexus-primary/10 px-4 py-2 text-sm text-nexus-primary"><Eye size={14} /> View Diff</button>
                <button className="flex items-center gap-2 rounded-xl bg-nexus-surface px-4 py-2 text-sm text-nexus-muted"><Copy size={14} /> Copy Hash</button>
                <button className="flex items-center gap-2 rounded-xl bg-nexus-surface px-4 py-2 text-sm text-nexus-muted"><Download size={14} /> Download</button>
                <button className="flex items-center gap-2 rounded-xl bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400"><RefreshCw size={14} /> Revert</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
