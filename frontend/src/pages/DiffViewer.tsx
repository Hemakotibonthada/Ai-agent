import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Search, Clock, User, ChevronRight,
  Plus, Minus, ArrowLeft, ArrowRight, Copy,
  FileText, Code, GitCommit, Settings,
  Eye, EyeOff, AlignLeft,
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface DiffFile {
  id: string;
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: 'context' | 'addition' | 'deletion';
  lineOld?: number;
  lineNew?: number;
  content: string;
}

const sampleFiles: DiffFile[] = [
  {
    id: '1', path: 'src/agents/orchestrator.py', additions: 45, deletions: 12, status: 'modified',
    hunks: [
      {
        header: '@@ -23,8 +23,12 @@ class AgentOrchestrator:',
        lines: [
          { type: 'context', lineOld: 23, lineNew: 23, content: '    def __init__(self, config: OrchestratorConfig):' },
          { type: 'context', lineOld: 24, lineNew: 24, content: '        self.config = config' },
          { type: 'context', lineOld: 25, lineNew: 25, content: '        self.agents = {}' },
          { type: 'deletion', lineOld: 26, content: '        self.max_agents = 10' },
          { type: 'deletion', lineOld: 27, content: '        self.timeout = 30' },
          { type: 'addition', lineNew: 26, content: '        self.max_agents = config.max_agents or 50' },
          { type: 'addition', lineNew: 27, content: '        self.timeout = config.timeout or 60' },
          { type: 'addition', lineNew: 28, content: '        self.retry_policy = RetryPolicy(' },
          { type: 'addition', lineNew: 29, content: '            max_retries=3,' },
          { type: 'addition', lineNew: 30, content: '            backoff_factor=2.0' },
          { type: 'addition', lineNew: 31, content: '        )' },
          { type: 'context', lineOld: 28, lineNew: 32, content: '        self.logger = get_logger(__name__)' },
          { type: 'context', lineOld: 29, lineNew: 33, content: '        self._initialize_agents()' },
        ],
      },
      {
        header: '@@ -56,6 +60,18 @@ class AgentOrchestrator:',
        lines: [
          { type: 'context', lineOld: 56, lineNew: 60, content: '    async def route_message(self, message: Message):' },
          { type: 'context', lineOld: 57, lineNew: 61, content: '        agent = self._select_agent(message)' },
          { type: 'addition', lineNew: 62, content: '        if not agent:' },
          { type: 'addition', lineNew: 63, content: '            self.logger.warn(f"No agent found for: {message.intent}")' },
          { type: 'addition', lineNew: 64, content: '            return FallbackResponse(message)' },
          { type: 'addition', lineNew: 65, content: '' },
          { type: 'addition', lineNew: 66, content: '        # Apply rate limiting' },
          { type: 'addition', lineNew: 67, content: '        if self.rate_limiter.is_exceeded(message.user_id):' },
          { type: 'addition', lineNew: 68, content: '            raise RateLimitExceeded(message.user_id)' },
          { type: 'context', lineOld: 58, lineNew: 69, content: '        response = await agent.process(message)' },
          { type: 'context', lineOld: 59, lineNew: 70, content: '        return response' },
        ],
      },
    ],
  },
  {
    id: '2', path: 'src/services/cache_service.py', additions: 120, deletions: 0, status: 'added',
    hunks: [
      {
        header: '@@ -0,0 +1,15 @@',
        lines: [
          { type: 'addition', lineNew: 1, content: 'from dataclasses import dataclass' },
          { type: 'addition', lineNew: 2, content: 'from typing import Any, Optional' },
          { type: 'addition', lineNew: 3, content: 'import time' },
          { type: 'addition', lineNew: 4, content: '' },
          { type: 'addition', lineNew: 5, content: '@dataclass' },
          { type: 'addition', lineNew: 6, content: 'class CacheEntry:' },
          { type: 'addition', lineNew: 7, content: '    key: str' },
          { type: 'addition', lineNew: 8, content: '    value: Any' },
          { type: 'addition', lineNew: 9, content: '    ttl: int' },
          { type: 'addition', lineNew: 10, content: '    created_at: float = time.time()' },
          { type: 'addition', lineNew: 11, content: '' },
          { type: 'addition', lineNew: 12, content: '    @property' },
          { type: 'addition', lineNew: 13, content: '    def is_expired(self) -> bool:' },
          { type: 'addition', lineNew: 14, content: '        return time.time() - self.created_at > self.ttl' },
        ],
      },
    ],
  },
  {
    id: '3', path: 'src/core/config.py', additions: 3, deletions: 8, status: 'modified',
    hunks: [
      {
        header: '@@ -10,11 +10,6 @@ class AppConfig:',
        lines: [
          { type: 'context', lineOld: 10, lineNew: 10, content: '    debug: bool = False' },
          { type: 'context', lineOld: 11, lineNew: 11, content: '    log_level: str = "INFO"' },
          { type: 'deletion', lineOld: 12, content: '    legacy_mode: bool = True' },
          { type: 'deletion', lineOld: 13, content: '    deprecated_api: bool = True' },
          { type: 'deletion', lineOld: 14, content: '    old_auth_provider: str = "basic"' },
          { type: 'deletion', lineOld: 15, content: '    # TODO: Remove legacy settings' },
          { type: 'deletion', lineOld: 16, content: '    compat_mode: bool = True' },
          { type: 'addition', lineNew: 12, content: '    auth_provider: str = "oauth2"' },
          { type: 'context', lineOld: 17, lineNew: 13, content: '    max_workers: int = 4' },
          { type: 'context', lineOld: 18, lineNew: 14, content: '    host: str = "0.0.0.0"' },
        ],
      },
    ],
  },
  {
    id: '4', path: 'src/models/legacy_compat.py', additions: 0, deletions: 85, status: 'deleted',
    hunks: [
      {
        header: '@@ -1,6 +0,0 @@',
        lines: [
          { type: 'deletion', lineOld: 1, content: '"""Legacy compatibility module - deprecated."""' },
          { type: 'deletion', lineOld: 2, content: 'import warnings' },
          { type: 'deletion', lineOld: 3, content: '' },
          { type: 'deletion', lineOld: 4, content: 'warnings.warn("legacy_compat is deprecated", DeprecationWarning)' },
          { type: 'deletion', lineOld: 5, content: '' },
          { type: 'deletion', lineOld: 6, content: '# ... 79 more lines removed' },
        ],
      },
    ],
  },
];

export default function DiffViewer() {
  const isDemo = useIsDemoAccount();
  const [files] = useState(isDemo ? sampleFiles : []);
  const [selectedFile, setSelectedFile] = useState<DiffFile>(sampleFiles[0]);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedHunks, setExpandedHunks] = useState<Set<string>>(new Set(files.flatMap(f => f.hunks.map((_, i) => `${f.id}-${i}`))));

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);
  const filteredFiles = searchQuery ? files.filter(f => f.path.toLowerCase().includes(searchQuery.toLowerCase())) : files;

  const toggleHunk = (key: string) => {
    const s = new Set(expandedHunks);
    s.has(key) ? s.delete(key) : s.add(key);
    setExpandedHunks(s);
  };

  const statusColors = { added: 'text-green-400', modified: 'text-yellow-400', deleted: 'text-red-400', renamed: 'text-blue-400' };
  const statusBg = { added: 'bg-green-500/10', modified: 'bg-yellow-500/10', deleted: 'bg-red-500/10', renamed: 'bg-blue-500/10' };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><GitBranch className="text-nexus-primary" /> Diff Viewer</h1>
        <p className="text-sm text-nexus-muted mt-1">
          <span className="text-green-400">+{totalAdditions}</span>
          <span className="mx-2 text-red-400">-{totalDeletions}</span>
          · {files.length} files changed
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter files..." className="w-full pl-9 pr-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-sm text-nexus-text" />
        </div>
        <div className="flex gap-1 bg-nexus-surface rounded-lg p-0.5">
          <button onClick={() => setViewMode('unified')} className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'unified' ? 'bg-nexus-primary text-white' : 'text-nexus-muted'}`}><AlignLeft size={12} className="inline mr-1" /> Unified</button>
          <button onClick={() => setViewMode('split')} className={`px-3 py-1.5 text-xs rounded-md ${viewMode === 'split' ? 'bg-nexus-primary text-white' : 'text-nexus-muted'}`}><Code size={12} className="inline mr-1" /> Split</button>
        </div>
        <button onClick={() => setShowLineNumbers(!showLineNumbers)} className={`p-2 rounded-lg text-xs ${showLineNumbers ? 'bg-nexus-primary/10 text-nexus-primary' : 'bg-nexus-surface text-nexus-muted'}`}>
          {showLineNumbers ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      <div className="flex gap-6">
        {/* File List */}
        <div className="w-72 shrink-0 space-y-1">
          {filteredFiles.map((f, i) => (
            <motion.button
              key={f.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedFile(f)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selectedFile.id === f.id ? 'bg-nexus-surface border border-nexus-primary/30' : 'hover:bg-nexus-surface/50'}`}
            >
              <FileText size={14} className={statusColors[f.status]} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-nexus-text truncate">{f.path.split('/').pop()}</p>
                <p className="text-[10px] text-nexus-muted truncate">{f.path}</p>
              </div>
              <div className="text-[10px] text-right">
                {f.additions > 0 && <span className="text-green-400">+{f.additions}</span>}
                {f.deletions > 0 && <span className="text-red-400 ml-1">-{f.deletions}</span>}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Diff Content */}
        <div className="flex-1 glass rounded-2xl border border-nexus-border/30 overflow-hidden">
          {/* File Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-nexus-border/20 bg-nexus-surface/50">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${statusBg[selectedFile.status]} ${statusColors[selectedFile.status]}`}>{selectedFile.status}</span>
              <span className="text-sm font-mono text-nexus-text">{selectedFile.path}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-green-400">+{selectedFile.additions}</span>
              <span className="text-red-400">-{selectedFile.deletions}</span>
              <button className="p-1.5 rounded-md hover:bg-nexus-surface"><Copy size={12} className="text-nexus-muted" /></button>
            </div>
          </div>

          {/* Diff Hunks */}
          <div className="font-mono text-xs">
            {selectedFile.hunks.map((hunk, hi) => {
              const key = `${selectedFile.id}-${hi}`;
              const expanded = expandedHunks.has(key);
              return (
                <div key={hi}>
                  <button onClick={() => toggleHunk(key)} className="w-full flex items-center gap-2 px-4 py-2 bg-blue-500/5 border-y border-blue-500/10 text-blue-400 hover:bg-blue-500/10">
                    <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    <span>{hunk.header}</span>
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        {hunk.lines.map((line, li) => (
                          <div key={li} className={`flex ${line.type === 'addition' ? 'bg-green-500/5' : line.type === 'deletion' ? 'bg-red-500/5' : ''} hover:bg-nexus-surface/30`}>
                            {showLineNumbers && (
                              <>
                                <span className="w-12 text-right pr-2 text-nexus-muted/50 select-none shrink-0 py-0.5">{line.lineOld || ''}</span>
                                <span className="w-12 text-right pr-2 text-nexus-muted/50 select-none shrink-0 py-0.5">{line.lineNew || ''}</span>
                              </>
                            )}
                            <span className={`w-5 text-center select-none shrink-0 py-0.5 ${line.type === 'addition' ? 'text-green-400' : line.type === 'deletion' ? 'text-red-400' : 'text-nexus-muted/30'}`}>
                              {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                            </span>
                            <span className={`flex-1 py-0.5 px-2 ${line.type === 'addition' ? 'text-green-300' : line.type === 'deletion' ? 'text-red-300' : 'text-nexus-text/80'}`}>
                              {line.content}
                            </span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
