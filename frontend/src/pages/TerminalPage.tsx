import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal as TerminalIcon, Plus, X, Maximize2, Minimize2,
  Copy, Download, Settings2, Search, ChevronRight, Trash2,
  Square, Play, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'success' | 'warning';
  content: string;
  timestamp: string;
}

interface TerminalTab {
  id: string;
  name: string;
  lines: TerminalLine[];
  currentDir: string;
  isRunning: boolean;
}

const COMMANDS: Record<string, { desc: string; handler: (args: string[], cwd: string) => { output: TerminalLine[]; newCwd?: string } }> = {
  help: {
    desc: 'Show available commands',
    handler: () => ({
      output: [
        { id: crypto.randomUUID(), type: 'info', content: '╔══════════════════════════════════════════════╗', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '║        NEXUS AI - Terminal v3.0               ║', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '╠══════════════════════════════════════════════╣', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  help          - Show this help message', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  clear         - Clear terminal', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  ls            - List directory contents', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  cd <dir>      - Change directory', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  pwd           - Print working directory', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  cat <file>    - Display file contents', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  echo <text>   - Print text', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  date          - Show current date/time', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  whoami        - Show current user', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  uname         - Show system information', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  status        - Show agent status', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  agents        - List all agents', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  health        - System health check', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  neofetch      - System info display', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'output', content: '  history       - Command history', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '╚══════════════════════════════════════════════╝', timestamp: new Date().toLocaleTimeString() },
      ]
    }),
  },
  ls: {
    desc: 'List files',
    handler: (_, cwd) => {
      const dirs: Record<string, string[]> = {
        '~': ['agents/', 'services/', 'config/', 'data/', 'logs/', 'models/', '.env', 'README.md', 'package.json'],
        '~/agents': ['orchestrator.py', 'personal_agent.py', 'security_agent.py', 'health_agent.py', 'home_agent.py', 'work_agent.py', 'voice_agent.py', 'vision_agent.py'],
        '~/services': ['ai_service.py', 'email_service.py', 'voice_service.py', 'mqtt_service.py', 'scheduler_service.py', 'auth_service.py', 'cache_service.py'],
        '~/config': ['settings.json', 'database.json', 'agents.json', 'routes.json'],
        '~/data': ['profiles/', 'embeddings/', 'backups/', 'exports/', 'models/'],
        '~/logs': ['nexus.log', 'agents.log', 'security.log', 'errors.log'],
        '~/models': ['embeddings.py', 'fine_tuner.py', 'local_llm.py', 'rag_engine.py'],
      };
      const items = dirs[cwd] || ['(empty directory)'];
      return {
        output: items.map(item => ({
          id: crypto.randomUUID(),
          type: 'output' as const,
          content: item.endsWith('/') ? `\x1b[34m${item}\x1b[0m` : item,
          timestamp: new Date().toLocaleTimeString(),
        })),
      };
    },
  },
  cd: {
    desc: 'Change directory',
    handler: (args, cwd) => {
      const target = args[0] || '~';
      if (target === '..') {
        const parts = cwd.split('/').filter(Boolean);
        parts.pop();
        return { output: [], newCwd: parts.length > 0 ? parts.join('/') : '~' };
      }
      if (target === '~' || target === '/') return { output: [], newCwd: '~' };
      const validDirs = ['agents', 'services', 'config', 'data', 'logs', 'models'];
      const cleanTarget = target.replace(/\/$/, '');
      if (validDirs.includes(cleanTarget)) {
        return { output: [], newCwd: `${cwd === '~' ? '~' : cwd}/${cleanTarget}` };
      }
      return {
        output: [{ id: crypto.randomUUID(), type: 'error', content: `cd: ${target}: No such directory`, timestamp: new Date().toLocaleTimeString() }],
      };
    },
  },
  pwd: { desc: 'Print working directory', handler: (_, cwd) => ({ output: [{ id: crypto.randomUUID(), type: 'output', content: `/home/nexus/${cwd.replace('~', '')}`, timestamp: new Date().toLocaleTimeString() }] }) },
  echo: { desc: 'Print text', handler: (args) => ({ output: [{ id: crypto.randomUUID(), type: 'output', content: args.join(' '), timestamp: new Date().toLocaleTimeString() }] }) },
  date: { desc: 'Show date', handler: () => ({ output: [{ id: crypto.randomUUID(), type: 'output', content: new Date().toString(), timestamp: new Date().toLocaleTimeString() }] }) },
  whoami: { desc: 'Show user', handler: () => ({ output: [{ id: crypto.randomUUID(), type: 'success', content: 'nexus-admin (root)', timestamp: new Date().toLocaleTimeString() }] }) },
  uname: {
    desc: 'System info',
    handler: () => ({ output: [{ id: crypto.randomUUID(), type: 'output', content: 'NexusOS 3.0.0 (Futuristic-AI-Agent) x86_64 GNU/Linux', timestamp: new Date().toLocaleTimeString() }] }),
  },
  status: {
    desc: 'Agent status',
    handler: () => ({
      output: [
        { id: crypto.randomUUID(), type: 'info', content: '🟢 System Status: OPERATIONAL', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  CPU: 23% | Memory: 4.2GB/16GB | Agents: 15/15', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  Uptime: 47d 12h 34m | Requests: 1.2M/day', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  Active Sessions: 3 | WebSocket Connections: 12', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  Last Backup: 2h ago | Next Backup: in 4h', timestamp: new Date().toLocaleTimeString() },
      ],
    }),
  },
  agents: {
    desc: 'List agents',
    handler: () => ({
      output: [
        { id: crypto.randomUUID(), type: 'info', content: '┌─────────────────────────┬──────────┬──────────┐', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '│ Agent                   │ Status   │ Tasks    │', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '├─────────────────────────┼──────────┼──────────┤', timestamp: new Date().toLocaleTimeString() },
        ...[
          ['Orchestrator', '🟢 Active', '1,245'],
          ['Personal Agent', '🟢 Active', '892'],
          ['Security Agent', '🟢 Active', '2,341'],
          ['Health Agent', '🟢 Active', '567'],
          ['Home Agent', '🟢 Active', '1,890'],
          ['Work Agent', '🟢 Active', '743'],
          ['Voice Agent', '🟢 Active', '456'],
          ['Vision Agent', '🟡 Idle', '128'],
          ['Financial Agent', '🟢 Active', '345'],
          ['Learning Agent', '🟢 Active', '234'],
        ].map(([name, status, tasks]) => ({
          id: crypto.randomUUID(),
          type: 'output' as const,
          content: `│ ${name!.padEnd(23)} │ ${status!.padEnd(8)} │ ${tasks!.padStart(8)} │`,
          timestamp: new Date().toLocaleTimeString(),
        })),
        { id: crypto.randomUUID(), type: 'info', content: '└─────────────────────────┴──────────┴──────────┘', timestamp: new Date().toLocaleTimeString() },
      ],
    }),
  },
  health: {
    desc: 'Health check',
    handler: () => ({
      output: [
        { id: crypto.randomUUID(), type: 'info', content: '🔍 Running health checks...', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  ✓ Database: Connected (latency: 2ms)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  ✓ Redis Cache: Connected (latency: 1ms)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  ✓ AI Service: Running (model: GPT-4)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  ✓ WebSocket: Active (12 connections)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  ✓ MQTT Broker: Connected (5 topics)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'warning', content: '  ⚠ Disk Space: 72% used (warn at 80%)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'success', content: '  ✓ SSL Certificate: Valid (expires in 89d)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '🏥 Overall: HEALTHY (6/7 checks passed)', timestamp: new Date().toLocaleTimeString() },
      ],
    }),
  },
  neofetch: {
    desc: 'System display',
    handler: () => ({
      output: [
        { id: crypto.randomUUID(), type: 'info', content: '         ╔═══════════════╗', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         ║   N E X U S   ║      OS: NexusOS 3.0.0', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         ║   ◈  ◈  ◈     ║      Kernel: 6.1.0-nexus', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         ║      AI       ║      Uptime: 47d 12h 34m', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         ║   ◈  ◈  ◈     ║      Shell: nexus-sh 2.0', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         ╚═══════════════╝      CPU: Xeon E5 (23%)', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '                                Memory: 4.2/16 GB', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         Agents: 15 | Active: 14', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         Services: 18 | Plugins: 5', timestamp: new Date().toLocaleTimeString() },
        { id: crypto.randomUUID(), type: 'info', content: '         Requests: 1.2M/day', timestamp: new Date().toLocaleTimeString() },
      ],
    }),
  },
  cat: {
    desc: 'Display file',
    handler: (args) => {
      const files: Record<string, string> = {
        'README.md': '# Nexus AI Agent\n\nA futuristic AI-powered personal assistant OS.\n\n## Features\n- 15 specialized AI agents\n- Voice & vision capabilities\n- Smart home integration\n- Financial management\n- Health monitoring',
        '.env': 'NEXUS_ENV=production\nAI_MODEL=gpt-4\nDATABASE_URL=sqlite:///nexus.db\nREDIS_URL=redis://localhost:6379\nMQTT_BROKER=localhost:1883\nSECRET_KEY=***REDACTED***',
        'package.json': '{\n  "name": "nexus-ai-agent",\n  "version": "3.0.0",\n  "description": "Futuristic AI Agent",\n  "engines": { "node": ">=18" }\n}',
      };
      const file = args[0];
      if (!file) return { output: [{ id: crypto.randomUUID(), type: 'error', content: 'cat: missing operand', timestamp: new Date().toLocaleTimeString() }] };
      const content = files[file];
      if (!content) return { output: [{ id: crypto.randomUUID(), type: 'error', content: `cat: ${file}: No such file`, timestamp: new Date().toLocaleTimeString() }] };
      return { output: content.split('\n').map(line => ({ id: crypto.randomUUID(), type: 'output' as const, content: line, timestamp: new Date().toLocaleTimeString() })) };
    },
  },
};

const TerminalPage: React.FC = () => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'tab-1', name: 'Terminal 1', lines: [
      { id: 'welcome', type: 'info', content: '🌟 Welcome to Nexus AI Terminal v3.0', timestamp: new Date().toLocaleTimeString() },
      { id: 'welcome2', type: 'info', content: 'Type "help" for available commands.', timestamp: new Date().toLocaleTimeString() },
      { id: 'welcome3', type: 'output', content: '', timestamp: new Date().toLocaleTimeString() },
    ], currentDir: '~', isRunning: false },
  ]);
  const [activeTab, setActiveTab] = useState('tab-1');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const activeTerminal = tabs.find(t => t.id === activeTab);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeTerminal?.lines]);

  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    const inputLine: TerminalLine = {
      id: crypto.randomUUID(),
      type: 'input',
      content: `${activeTerminal?.currentDir || '~'} $ ${trimmed}`,
      timestamp: new Date().toLocaleTimeString(),
    };

    if (trimmed === 'clear') {
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, lines: [] } : t));
      return;
    }

    if (trimmed === 'history') {
      const histLines: TerminalLine[] = history.map((h, i) => ({
        id: crypto.randomUUID(), type: 'output' as const,
        content: `  ${String(i + 1).padStart(4)}  ${h}`,
        timestamp: new Date().toLocaleTimeString(),
      }));
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, lines: [...t.lines, inputLine, ...histLines] } : t));
      return;
    }

    const [cmdName, ...args] = trimmed.split(/\s+/);
    const command = COMMANDS[cmdName!];

    if (command) {
      const result = command.handler(args, activeTerminal?.currentDir || '~');
      setTabs(prev => prev.map(t => t.id === activeTab ? {
        ...t,
        lines: [...t.lines, inputLine, ...result.output],
        currentDir: result.newCwd || t.currentDir,
      } : t));
    } else {
      const errorLine: TerminalLine = {
        id: crypto.randomUUID(), type: 'error',
        content: `nexus: command not found: ${cmdName}. Type "help" for available commands.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, lines: [...t.lines, inputLine, errorLine] } : t));
    }
  }, [activeTab, activeTerminal, history]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) { setHistoryIndex(-1); setInput(''); }
        else { setHistoryIndex(newIndex); setInput(history[newIndex] || ''); }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const partial = input.trim();
      const matches = Object.keys(COMMANDS).filter(c => c.startsWith(partial));
      if (matches.length === 1) setInput(matches[0]!);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, lines: [] } : t));
    }
  };

  const addTab = () => {
    const id = `tab-${Date.now()}`;
    setTabs(prev => [...prev, {
      id, name: `Terminal ${prev.length + 1}`,
      lines: [{ id: 'w', type: 'info', content: '🌟 New terminal session', timestamp: new Date().toLocaleTimeString() }],
      currentDir: '~', isRunning: false,
    }]);
    setActiveTab(id);
  };

  const closeTab = (id: string) => {
    if (tabs.length <= 1) return;
    setTabs(prev => prev.filter(t => t.id !== id));
    if (activeTab === id) setActiveTab(tabs[0]?.id === id ? tabs[1]!.id : tabs[0]!.id);
  };

  const lineColors: Record<string, string> = {
    input: 'text-green-400',
    output: 'text-nexus-muted',
    error: 'text-red-400',
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <TerminalIcon className="text-green-500" size={32} />
              Terminal
            </h1>
            <p className="text-nexus-muted mt-1">Interactive system terminal with command execution</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 rounded-lg hover:bg-nexus-surface">
              {isFullscreen ? <Minimize2 size={18} className="text-nexus-muted" /> : <Maximize2 size={18} className="text-nexus-muted" />}
            </button>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className={`bg-nexus-bg rounded-2xl overflow-hidden border border-nexus-border ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
          {/* Title Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-nexus-card border-b border-nexus-border">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer" />
                <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 cursor-pointer" />
                <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 cursor-pointer" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs transition-colors ${
                    activeTab === tab.id ? 'bg-nexus-surface text-white' : 'text-nexus-muted hover:text-nexus-muted hover:bg-nexus-surface/50'
                  }`}
                >
                  <TerminalIcon size={12} />
                  {tab.name}
                  {tabs.length > 1 && (
                    <X size={10} className="hover:text-red-400" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} />
                  )}
                </button>
              ))}
              <button onClick={addTab} className="p-1 rounded text-nexus-muted hover:text-white hover:bg-nexus-surface">
                <Plus size={14} />
              </button>
            </div>
            <div className="text-xs text-nexus-muted font-mono">nexus@ai-agent</div>
          </div>

          {/* Terminal Content */}
          <div
            ref={terminalRef}
            onClick={() => inputRef.current?.focus()}
            className={`font-mono text-sm p-4 overflow-y-auto cursor-text ${isFullscreen ? 'h-[calc(100%-80px)]' : 'h-[500px]'}`}
          >
            {activeTerminal?.lines.map((line) => (
              <div key={line.id} className={`leading-6 ${lineColors[line.type] || 'text-nexus-muted'}`}>
                <span className="select-text whitespace-pre-wrap">{line.content}</span>
              </div>
            ))}

            {/* Input Line */}
            <div className="flex items-center leading-6">
              <span className="text-green-400 mr-2">{activeTerminal?.currentDir || '~'} $</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-gray-100 caret-green-400 font-mono text-sm"
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-nexus-card border-t border-nexus-border text-xs text-nexus-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-400" /> Connected</span>
              <span>cwd: {activeTerminal?.currentDir}</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{activeTerminal?.lines.length || 0} lines</span>
              <span>{history.length} in history</span>
              <span><Clock size={10} className="inline" /> {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Quick Commands */}
      <FadeIn delay={0.2}>
        <div className="bg-nexus-card rounded-2xl p-5 border border-nexus-border">
          <h3 className="font-semibold text-nexus-text mb-3 flex items-center gap-2">
            <Zap size={16} className="text-green-500" /> Quick Commands
          </h3>
          <div className="flex flex-wrap gap-2">
            {['status', 'health', 'agents', 'neofetch', 'help'].map(cmd => (
              <motion.button
                key={cmd}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setInput(cmd); executeCommand(cmd); }}
                className="px-3 py-1.5 bg-nexus-surface rounded-lg text-sm font-mono text-nexus-text hover:bg-nexus-surface transition-colors"
              >
                $ {cmd}
              </motion.button>
            ))}
          </div>
        </div>
      </FadeIn>
    </div>
  );
};

export default TerminalPage;
