import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code, Play, Save, Copy, Download, Upload, Terminal, Settings,
  ChevronRight, ChevronDown, File, FolderOpen, Folder, Search,
  Plus, Trash2, Edit, Eye, Check, X, Loader, Maximize2, Minimize2,
  Sun, Moon, Type, Hash, Braces, FileCode, Zap, RotateCcw, MoreVertical,
  GitBranch, Clock, AlertCircle, CheckCircle
} from 'lucide-react';

interface FileItem { id: string; name: string; language: string; content: string; modified: boolean; }
interface ConsoleOutput { id: string; type: 'log' | 'error' | 'warn' | 'info'; message: string; timestamp: string; }

const languageColors: Record<string, string> = {
  javascript: 'text-yellow-400',
  typescript: 'text-blue-400',
  python: 'text-green-400',
  html: 'text-orange-400',
  css: 'text-pink-400',
  json: 'text-amber-400',
  markdown: 'text-gray-400',
  sql: 'text-cyan-400',
  rust: 'text-orange-500',
  go: 'text-cyan-500',
};

const defaultFiles: FileItem[] = [
  { id: 'f1', name: 'main.py', language: 'python', content: `import asyncio\nfrom fastapi import FastAPI\nfrom datetime import datetime\n\napp = FastAPI(title="NEXUS AI")\n\n\n@app.get("/")\nasync def root():\n    return {\n        "name": "NEXUS AI",\n        "version": "2.0.0",\n        "timestamp": datetime.now().isoformat()\n    }\n\n\n@app.get("/health")\nasync def health():\n    return {"status": "healthy"}\n\n\nif __name__ == "__main__":\n    import uvicorn\n    uvicorn.run(app, host="0.0.0.0", port=8000)`, modified: false },
  { id: 'f2', name: 'App.tsx', language: 'typescript', content: `import React, { useState, useEffect } from 'react';\nimport { BrowserRouter, Routes, Route } from 'react-router-dom';\n\ninterface AppState {\n  theme: 'light' | 'dark';\n  user: User | null;\n  loading: boolean;\n}\n\nconst App: React.FC = () => {\n  const [state, setState] = useState<AppState>({\n    theme: 'dark',\n    user: null,\n    loading: true,\n  });\n\n  useEffect(() => {\n    // Initialize app\n    setState(prev => ({ ...prev, loading: false }));\n  }, []);\n\n  return (\n    <BrowserRouter>\n      <Routes>\n        <Route path="/" element={<Dashboard />} />\n        <Route path="/settings" element={<Settings />} />\n      </Routes>\n    </BrowserRouter>\n  );\n};\n\nexport default App;`, modified: false },
  { id: 'f3', name: 'schema.sql', language: 'sql', content: `CREATE TABLE users (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  username VARCHAR(50) UNIQUE NOT NULL,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  password_hash VARCHAR(255) NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE TABLE tasks (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  user_id UUID REFERENCES users(id),\n  title VARCHAR(200) NOT NULL,\n  description TEXT,\n  status VARCHAR(20) DEFAULT 'pending',\n  priority INTEGER DEFAULT 0,\n  due_date TIMESTAMPTZ,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE INDEX idx_tasks_user ON tasks(user_id);\nCREATE INDEX idx_tasks_status ON tasks(status);`, modified: false },
  { id: 'f4', name: 'config.json', language: 'json', content: `{\n  "app": {\n    "name": "NEXUS AI",\n    "version": "2.0.0",\n    "port": 8000,\n    "debug": false\n  },\n  "database": {\n    "host": "localhost",\n    "port": 5432,\n    "name": "nexus_db"\n  },\n  "redis": {\n    "host": "localhost",\n    "port": 6379\n  },\n  "ai": {\n    "model": "gpt-4-turbo",\n    "temperature": 0.7,\n    "max_tokens": 4096\n  }\n}`, modified: false },
  { id: 'f5', name: 'README.md', language: 'markdown', content: `# NEXUS AI\n\n> A futuristic AI-powered operating system\n\n## Features\n\n- Real-time AI assistance\n- Task automation\n- Smart home integration\n- Health monitoring\n- Financial management\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Architecture\n\nThe system uses a microservices architecture with:\n- FastAPI backend\n- React frontend\n- PostgreSQL database\n- Redis cache`, modified: false },
];

export default function CodeEditor() {
  const [files, setFiles] = useState<FileItem[]>(defaultFiles);
  const [activeFile, setActiveFile] = useState<string>('f1');
  const [consoleOutput, setConsoleOutput] = useState<ConsoleOutput[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setConsoleOutput([
        { id: 'c1', type: 'info', message: 'NEXUS AI Code Editor v2.0.0 initialized', timestamp: new Date().toISOString() },
        { id: 'c2', type: 'log', message: 'Ready to code!', timestamp: new Date().toISOString() },
      ]);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const currentFile = useMemo(() => files.find(f => f.id === activeFile), [files, activeFile]);

  const updateContent = useCallback((content: string) => {
    setFiles(prev => prev.map(f => f.id === activeFile ? { ...f, content, modified: true } : f));
  }, [activeFile]);

  const runCode = useCallback(() => {
    if (!currentFile) return;
    setRunning(true);
    setConsoleOutput(prev => [...prev, { id: `r-${Date.now()}`, type: 'info', message: `Running ${currentFile.name}...`, timestamp: new Date().toISOString() }]);
    setTimeout(() => {
      const outputs: ConsoleOutput[] = [
        { id: `o-${Date.now()}-1`, type: 'log', message: `[${currentFile.language}] Execution started`, timestamp: new Date().toISOString() },
        { id: `o-${Date.now()}-2`, type: 'log', message: `Output: Program executed successfully`, timestamp: new Date().toISOString() },
        { id: `o-${Date.now()}-3`, type: 'info', message: `Execution time: ${(Math.random() * 200 + 50).toFixed(0)}ms`, timestamp: new Date().toISOString() },
      ];
      setConsoleOutput(prev => [...prev, ...outputs]);
      setRunning(false);
    }, 1200);
  }, [currentFile]);

  const lineCount = useMemo(() => currentFile ? currentFile.content.split('\n').length : 0, [currentFile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-green-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top Bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-green-400" />
            <span className="text-sm font-semibold text-white">NEXUS Code</span>
          </div>
          <div className="flex items-center gap-1 ml-4">
            {files.map(f => (
              <motion.button key={f.id} whileHover={{ scale: 1.02 }} onClick={() => setActiveFile(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs transition-all ${activeFile === f.id ? 'bg-gray-800 text-white border-t-2 border-green-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
                <FileCode className={`w-3 h-3 ${languageColors[f.language] || 'text-gray-400'}`} />
                <span>{f.name}</span>
                {f.modified && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </motion.button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={runCode} disabled={running}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${running ? 'bg-green-500/20 text-green-400' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
            {running ? <><Loader className="w-3 h-3 animate-spin" /> Running...</> : <><Play className="w-3 h-3" /> Run</>}
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400"><Save className="w-4 h-4" /></motion.button>
          <motion.button whileHover={{ scale: 1.05 }} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400"><Settings className="w-4 h-4" /></motion.button>
        </div>
      </motion.div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 200, opacity: 1 }} className="w-52 bg-gray-900/50 border-r border-gray-800 overflow-y-auto">
            <div className="p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Explorer</p>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400">
                  <ChevronDown className="w-3 h-3" /><FolderOpen className="w-3.5 h-3.5 text-blue-400" /> <span>src</span>
                </div>
                {files.map(f => (
                  <motion.button key={f.id} whileHover={{ x: 2 }} onClick={() => setActiveFile(f.id)}
                    className={`w-full flex items-center gap-1.5 px-4 py-1 text-xs rounded transition-all ${activeFile === f.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
                    <FileCode className={`w-3 h-3 ${languageColors[f.language] || 'text-gray-400'}`} />
                    <span>{f.name}</span>
                    {f.modified && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-auto" />}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex overflow-hidden">
            {/* Line Numbers */}
            {lineNumbers && (
              <div className="w-12 bg-gray-900/30 border-r border-gray-800/50 overflow-hidden pt-2 select-none">
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="px-2 text-right text-xs text-gray-600 leading-6">{i + 1}</div>
                ))}
              </div>
            )}
            {/* Code Area */}
            <textarea ref={textareaRef} value={currentFile?.content || ''} onChange={e => updateContent(e.target.value)}
              spellCheck={false}
              className="flex-1 p-2 bg-transparent text-gray-200 font-mono focus:outline-none resize-none leading-6 overflow-auto"
              style={{ fontSize, tabSize: 2, whiteSpace: wordWrap ? 'pre-wrap' : 'pre' }} />
          </div>

          {/* Console */}
          {showConsole && (
            <div className="h-48 bg-gray-900/50 border-t border-gray-800 flex flex-col">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">Console</span>
                  <span className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-500">{consoleOutput.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} onClick={() => setConsoleOutput([])} className="p-1 hover:bg-gray-800 rounded"><Trash2 className="w-3 h-3 text-gray-500" /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} onClick={() => setShowConsole(false)} className="p-1 hover:bg-gray-800 rounded"><Minimize2 className="w-3 h-3 text-gray-500" /></motion.button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-0.5">
                {consoleOutput.map(entry => (
                  <div key={entry.id} className={`px-2 py-0.5 rounded ${entry.type === 'error' ? 'text-red-400 bg-red-500/5' : entry.type === 'warn' ? 'text-yellow-400 bg-yellow-500/5' : entry.type === 'info' ? 'text-blue-400' : 'text-gray-300'}`}>
                    <span className="text-gray-600">[{new Date(entry.timestamp).toLocaleTimeString()}]</span> {entry.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-blue-600 text-white text-[11px]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> main</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 0 errors</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{currentFile?.language}</span>
          <span>Ln {lineCount}, Col 1</span>
          <span>UTF-8</span>
          <span>Spaces: 2</span>
        </div>
      </div>
    </div>
  );
}
