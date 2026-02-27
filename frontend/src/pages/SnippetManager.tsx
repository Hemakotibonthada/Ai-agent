import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, Search, Plus, Copy, Check, Star, StarOff,
  Folder, Tag, Clock, Trash2, Edit3, X,
  FileCode, Save, Download, Upload, Filter,
  Hash, Terminal, Globe, Database, Braces, Cpu,
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Snippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  folder: string;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

const langIcons: Record<string, { color: string; bg: string }> = {
  python: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  typescript: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
  javascript: { color: 'text-yellow-300', bg: 'bg-yellow-400/10' },
  bash: { color: 'text-green-400', bg: 'bg-green-500/10' },
  sql: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  json: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
  rust: { color: 'text-red-400', bg: 'bg-red-500/10' },
  go: { color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
};

const sampleSnippets: Snippet[] = [
  {
    id: '1', title: 'FastAPI CRUD Route', description: 'Generic CRUD endpoints with Pydantic models', language: 'python', folder: 'Backend',
    code: `from fastapi import APIRouter, HTTPException\nfrom pydantic import BaseModel\nfrom typing import List, Optional\n\nrouter = APIRouter()\n\nclass ItemCreate(BaseModel):\n    name: str\n    value: float\n    tags: List[str] = []\n\n@router.post("/items", response_model=dict)\nasync def create_item(item: ItemCreate):\n    return {"id": "new_id", **item.dict()}\n\n@router.get("/items/{item_id}")\nasync def get_item(item_id: str):\n    if not item_id:\n        raise HTTPException(404, "Not found")\n    return {"id": item_id, "name": "Sample"}`,
    tags: ['fastapi', 'crud', 'pydantic'], starred: true, createdAt: '2024-03-01', updatedAt: '2024-03-15', usageCount: 45,
  },
  {
    id: '2', title: 'React Custom Hook - useDebounce', description: 'Debounce hook for search inputs', language: 'typescript', folder: 'Frontend',
    code: `import { useState, useEffect } from 'react';\n\nexport function useDebounce<T>(value: T, delay: number): T {\n  const [debouncedValue, setDebouncedValue] = useState<T>(value);\n\n  useEffect(() => {\n    const handler = setTimeout(() => {\n      setDebouncedValue(value);\n    }, delay);\n\n    return () => clearTimeout(handler);\n  }, [value, delay]);\n\n  return debouncedValue;\n}`,
    tags: ['react', 'hooks', 'debounce'], starred: true, createdAt: '2024-02-20', updatedAt: '2024-03-10', usageCount: 38,
  },
  {
    id: '3', title: 'Docker Compose Service', description: 'Multi-service compose with health checks', language: 'bash', folder: 'DevOps',
    code: `version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - "8000:8000"\n    environment:\n      - DATABASE_URL=postgresql://user:pass@db:5432/app\n    depends_on:\n      db:\n        condition: service_healthy\n    healthcheck:\n      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]\n      interval: 30s\n      timeout: 10s\n      retries: 3\n  db:\n    image: postgres:15\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U user"]\n      interval: 10s\nvolumes:\n  pgdata:`,
    tags: ['docker', 'compose', 'postgres'], starred: false, createdAt: '2024-01-15', updatedAt: '2024-02-28', usageCount: 22,
  },
  {
    id: '4', title: 'SQL Window Functions', description: 'Common window function patterns', language: 'sql', folder: 'Database',
    code: `-- Running total\nSELECT\n  date,\n  amount,\n  SUM(amount) OVER (ORDER BY date) as running_total,\n  ROW_NUMBER() OVER (PARTITION BY category ORDER BY amount DESC) as rank,\n  LAG(amount) OVER (ORDER BY date) as prev_amount,\n  amount - LAG(amount) OVER (ORDER BY date) as change\nFROM transactions\nWHERE date >= '2024-01-01'\nORDER BY date;`,
    tags: ['sql', 'window-functions', 'analytics'], starred: false, createdAt: '2024-02-10', updatedAt: '2024-03-05', usageCount: 15,
  },
  {
    id: '5', title: 'Zustand Store Pattern', description: 'Type-safe Zustand store with middleware', language: 'typescript', folder: 'Frontend',
    code: `import { create } from 'zustand';\nimport { persist, devtools } from 'zustand/middleware';\n\ninterface AppState {\n  count: number;\n  items: string[];\n  increment: () => void;\n  addItem: (item: string) => void;\n  reset: () => void;\n}\n\nexport const useAppStore = create<AppState>()(\n  devtools(\n    persist(\n      (set) => ({\n        count: 0,\n        items: [],\n        increment: () => set((s) => ({ count: s.count + 1 })),\n        addItem: (item) => set((s) => ({ items: [...s.items, item] })),\n        reset: () => set({ count: 0, items: [] }),\n      }),\n      { name: 'app-store' }\n    )\n  )\n);`,
    tags: ['zustand', 'state', 'react'], starred: true, createdAt: '2024-03-05', updatedAt: '2024-03-18', usageCount: 32,
  },
  {
    id: '6', title: 'Framer Motion List Animation', description: 'Staggered list entrance animation', language: 'typescript', folder: 'Frontend',
    code: `const container = {\n  hidden: { opacity: 0 },\n  show: {\n    opacity: 1,\n    transition: {\n      staggerChildren: 0.05,\n      delayChildren: 0.1\n    }\n  }\n};\n\nconst item = {\n  hidden: { opacity: 0, y: 20 },\n  show: { opacity: 1, y: 0 }\n};\n\n<motion.ul variants={container} initial="hidden" animate="show">\n  {items.map(i => (\n    <motion.li key={i.id} variants={item}>\n      {i.name}\n    </motion.li>\n  ))}\n</motion.ul>`,
    tags: ['framer-motion', 'animation', 'react'], starred: false, createdAt: '2024-03-08', updatedAt: '2024-03-12', usageCount: 18,
  },
  {
    id: '7', title: 'Python Async Context Manager', description: 'Reusable async resource management', language: 'python', folder: 'Backend',
    code: `from contextlib import asynccontextmanager\nfrom typing import AsyncGenerator\nimport aiohttp\n\n@asynccontextmanager\nasync def managed_session() -> AsyncGenerator[aiohttp.ClientSession, None]:\n    session = aiohttp.ClientSession(\n        timeout=aiohttp.ClientTimeout(total=30),\n        headers={"User-Agent": "NexusAI/1.0"}\n    )\n    try:\n        yield session\n    finally:\n        await session.close()\n\n# Usage\nasync def fetch_data(url: str):\n    async with managed_session() as session:\n        async with session.get(url) as response:\n            return await response.json()`,
    tags: ['python', 'async', 'context-manager'], starred: true, createdAt: '2024-02-25', updatedAt: '2024-03-14', usageCount: 28,
  },
  {
    id: '8', title: 'Tailwind Glassmorphism Card', description: 'Reusable glass effect card component', language: 'typescript', folder: 'Frontend',
    code: `export function GlassCard({ \n  children, \n  className = "" \n}: { \n  children: React.ReactNode; \n  className?: string; \n}) {\n  return (\n    <div className={\`\n      bg-nexus-card/5 backdrop-blur-xl \n      border border-white/10 \n      rounded-2xl shadow-xl \n      hover:bg-nexus-card/8 \n      transition-all duration-300 \n      \${className}\n    \`}>\n      {children}\n    </div>\n  );\n}`,
    tags: ['tailwind', 'glassmorphism', 'component'], starred: false, createdAt: '2024-03-10', updatedAt: '2024-03-10', usageCount: 12,
  },
];

export default function SnippetManager() {
  const isDemo = useIsDemoAccount();
  const [snippets, setSnippets] = useState(isDemo ? sampleSnippets : []);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(sampleSnippets[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('All');
  const [langFilter, setLangFilter] = useState('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const folders = useMemo(() => ['All', ...new Set(snippets.map(s => s.folder))], [snippets]);
  const languages = useMemo(() => ['All', ...new Set(snippets.map(s => s.language))], [snippets]);

  const filtered = useMemo(() => {
    let f = snippets;
    if (folderFilter !== 'All') f = f.filter(s => s.folder === folderFilter);
    if (langFilter !== 'All') f = f.filter(s => s.language === langFilter);
    if (searchQuery) f = f.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.tags.some(t => t.includes(searchQuery.toLowerCase())));
    return f;
  }, [snippets, folderFilter, langFilter, searchQuery]);

  const copyCode = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.code);
    setCopiedId(snippet.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleStar = (id: string) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, starred: !s.starred } : s));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Code2 className="text-nexus-primary" /> Snippet Manager</h1>
          <p className="text-sm text-nexus-muted mt-1">{snippets.length} snippets · {snippets.filter(s => s.starred).length} starred</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-xs rounded-xl bg-nexus-primary text-white flex items-center gap-2"><Plus size={14} /> New Snippet</button>
          <button className="px-4 py-2 text-xs rounded-xl bg-nexus-surface text-nexus-muted flex items-center gap-2"><Upload size={14} /> Import</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search snippets or tags..." className="w-full pl-9 pr-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-sm text-nexus-text" />
        </div>
        <select value={folderFilter} onChange={e => setFolderFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          {folders.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={langFilter} onChange={e => setLangFilter(e.target.value)} className="px-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-xs text-nexus-text">
          {languages.map(l => <option key={l} value={l}>{l === 'All' ? 'All Languages' : l}</option>)}
        </select>
      </div>

      <div className="flex gap-6">
        {/* Snippet List */}
        <div className="w-80 shrink-0 space-y-2">
          {filtered.map((s, i) => {
            const lc = langIcons[s.language] || { color: 'text-nexus-muted', bg: 'bg-nexus-surface' };
            return (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedSnippet(s)}
                className={`w-full text-left p-3 rounded-xl transition-all ${selectedSnippet?.id === s.id ? 'bg-nexus-surface border border-nexus-primary/30' : 'hover:bg-nexus-surface/50'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded ${lc.bg} ${lc.color}`}><FileCode size={12} /></div>
                  <span className="text-xs font-medium text-nexus-text flex-1 truncate">{s.title}</span>
                  {s.starred && <Star size={10} className="text-yellow-400 fill-yellow-400" />}
                </div>
                <p className="text-[10px] text-nexus-muted truncate">{s.description}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {s.tags.slice(0, 3).map(t => (
                    <span key={t} className="px-1.5 py-0.5 text-[9px] bg-nexus-surface rounded text-nexus-muted">{t}</span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Code View */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {selectedSnippet && (
              <motion.div key={selectedSnippet.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass rounded-2xl border border-nexus-border/30 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-nexus-border/20">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${(langIcons[selectedSnippet.language] || { bg: 'bg-nexus-surface' }).bg} ${(langIcons[selectedSnippet.language] || { color: 'text-nexus-muted' }).color}`}><FileCode size={14} /></div>
                    <div>
                      <h3 className="text-sm font-semibold text-nexus-text">{selectedSnippet.title}</h3>
                      <p className="text-xs text-nexus-muted">{selectedSnippet.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleStar(selectedSnippet.id)} className="p-2 rounded-lg hover:bg-nexus-surface">
                      {selectedSnippet.starred ? <Star size={14} className="text-yellow-400 fill-yellow-400" /> : <StarOff size={14} className="text-nexus-muted" />}
                    </button>
                    <button onClick={() => copyCode(selectedSnippet)} className="px-3 py-1.5 text-xs rounded-lg bg-nexus-primary text-white flex items-center gap-1.5">
                      {copiedId === selectedSnippet.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                    <button className="p-2 rounded-lg hover:bg-nexus-surface"><Edit3 size={14} className="text-nexus-muted" /></button>
                  </div>
                </div>

                {/* Code block */}
                <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto bg-nexus-bg/50">
                  <pre className="text-nexus-text/90 whitespace-pre-wrap">
                    {selectedSnippet.code.split('\n').map((line, i) => (
                      <div key={i} className="flex hover:bg-nexus-surface/30">
                        <span className="w-8 text-right pr-3 text-nexus-muted/40 select-none shrink-0">{i + 1}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-nexus-border/20 bg-nexus-surface/30">
                  <div className="flex gap-3 text-[10px] text-nexus-muted">
                    <span className="flex items-center gap-1"><Hash size={10} />{selectedSnippet.language}</span>
                    <span className="flex items-center gap-1"><Folder size={10} />{selectedSnippet.folder}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> Updated {selectedSnippet.updatedAt}</span>
                    <span className="flex items-center gap-1"><Copy size={10} /> Used {selectedSnippet.usageCount}x</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {selectedSnippet.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 text-[10px] bg-nexus-primary/10 text-nexus-primary rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
