import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Command, Search, Keyboard, Settings, Zap, FileText,
  Globe, Terminal, Layers, Code2, GitBranch, Play,
  ChevronRight, Clock, Star, Pin, ArrowRight, Hash,
  Users, Database, Shield, Mail, BarChart3, Activity,
  Home, Bot, Brain, Workflow, Palette, Bug
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ElementType;
  shortcut?: string;
  tags: string[];
  frequency: number;
  isRecent: boolean;
  isPinned: boolean;
}

interface ShortcutGroup {
  name: string;
  shortcuts: { keys: string[]; description: string; category: string }[];
}

const commands: CommandItem[] = [
  { id: 'c1', title: 'Open Dashboard', description: 'Navigate to main dashboard', category: 'Navigation', icon: Home, shortcut: 'Ctrl+Shift+D', tags: ['home', 'main', 'overview'], frequency: 42, isRecent: true, isPinned: true },
  { id: 'c2', title: 'New Chat', description: 'Start a new AI conversation', category: 'AI', icon: Bot, shortcut: 'Ctrl+N', tags: ['ai', 'chat', 'conversation'], frequency: 38, isRecent: true, isPinned: true },
  { id: 'c3', title: 'Run Task', description: 'Execute an automation task', category: 'Automation', icon: Play, shortcut: 'Ctrl+R', tags: ['run', 'execute', 'task'], frequency: 35, isRecent: true, isPinned: false },
  { id: 'c4', title: 'Open Terminal', description: 'Launch integrated terminal', category: 'Dev Tools', icon: Terminal, shortcut: 'Ctrl+`', tags: ['terminal', 'shell', 'console'], frequency: 30, isRecent: false, isPinned: true },
  { id: 'c5', title: 'Search Files', description: 'Search across all workspace files', category: 'Search', icon: FileText, shortcut: 'Ctrl+P', tags: ['find', 'files', 'search'], frequency: 28, isRecent: true, isPinned: false },
  { id: 'c6', title: 'Git Status', description: 'View current git status', category: 'Dev Tools', icon: GitBranch, shortcut: 'Ctrl+Shift+G', tags: ['git', 'version', 'control'], frequency: 25, isRecent: false, isPinned: false },
  { id: 'c7', title: 'Deploy Application', description: 'Deploy to production/staging', category: 'DevOps', icon: Zap, shortcut: 'Ctrl+Shift+P', tags: ['deploy', 'release', 'publish'], frequency: 15, isRecent: false, isPinned: false },
  { id: 'c8', title: 'View Agents', description: 'Monitor AI agent status', category: 'AI', icon: Brain, shortcut: 'Ctrl+A', tags: ['agents', 'ai', 'monitor'], frequency: 22, isRecent: true, isPinned: false },
  { id: 'c9', title: 'Open Settings', description: 'Configure application settings', category: 'System', icon: Settings, tags: ['settings', 'config', 'preferences'], frequency: 18, isRecent: false, isPinned: false },
  { id: 'c10', title: 'Database Explorer', description: 'Browse database tables', category: 'Data', icon: Database, shortcut: 'Ctrl+D', tags: ['database', 'sql', 'tables'], frequency: 20, isRecent: false, isPinned: false },
  { id: 'c11', title: 'Security Center', description: 'View security dashboard', category: 'Security', icon: Shield, tags: ['security', 'vulnerabilities', 'certs'], frequency: 12, isRecent: false, isPinned: false },
  { id: 'c12', title: 'Team Chat', description: 'Open team messaging', category: 'Communication', icon: Mail, shortcut: 'Ctrl+M', tags: ['chat', 'team', 'messaging'], frequency: 33, isRecent: true, isPinned: false },
  { id: 'c13', title: 'Analytics', description: 'View analytics dashboard', category: 'Data', icon: BarChart3, tags: ['analytics', 'metrics', 'data'], frequency: 16, isRecent: false, isPinned: false },
  { id: 'c14', title: 'System Monitor', description: 'CPU, memory, disk monitoring', category: 'System', icon: Activity, tags: ['system', 'monitor', 'performance'], frequency: 24, isRecent: true, isPinned: false },
  { id: 'c15', title: 'Workflow Builder', description: 'Create automation workflows', category: 'Automation', icon: Workflow, tags: ['workflow', 'automate', 'pipeline'], frequency: 14, isRecent: false, isPinned: false },
  { id: 'c16', title: 'Theme Editor', description: 'Customize UI theme', category: 'System', icon: Palette, tags: ['theme', 'design', 'colors'], frequency: 8, isRecent: false, isPinned: false },
  { id: 'c17', title: 'Debug Console', description: 'Open debug utility', category: 'Dev Tools', icon: Bug, shortcut: 'F12', tags: ['debug', 'console', 'dev'], frequency: 19, isRecent: false, isPinned: false },
  { id: 'c18', title: 'View Logs', description: 'Application and system logs', category: 'System', icon: Layers, tags: ['logs', 'history', 'events'], frequency: 21, isRecent: false, isPinned: false },
  { id: 'c19', title: 'User Management', description: 'Manage users and roles', category: 'Admin', icon: Users, tags: ['users', 'admin', 'roles'], frequency: 10, isRecent: false, isPinned: false },
  { id: 'c20', title: 'API Playground', description: 'Test API endpoints', category: 'Dev Tools', icon: Globe, shortcut: 'Ctrl+Shift+A', tags: ['api', 'test', 'playground'], frequency: 17, isRecent: false, isPinned: false },
];

const shortcutGroups: ShortcutGroup[] = [
  { name: 'General', shortcuts: [
    { keys: ['Ctrl', 'K'], description: 'Open Command Palette', category: 'Navigation' },
    { keys: ['Ctrl', 'Shift', 'P'], description: 'Deploy Application', category: 'DevOps' },
    { keys: ['Ctrl', '/'], description: 'Toggle Help Panel', category: 'System' },
    { keys: ['Esc'], description: 'Close current modal/panel', category: 'Navigation' },
    { keys: ['F11'], description: 'Toggle fullscreen', category: 'System' },
  ]},
  { name: 'Navigation', shortcuts: [
    { keys: ['Ctrl', 'Shift', 'D'], description: 'Dashboard', category: 'Navigation' },
    { keys: ['Ctrl', 'N'], description: 'New Chat', category: 'AI' },
    { keys: ['Ctrl', 'P'], description: 'Search Files', category: 'Search' },
    { keys: ['Ctrl', 'M'], description: 'Team Chat', category: 'Communication' },
    { keys: ['Ctrl', '`'], description: 'Terminal', category: 'Dev Tools' },
    { keys: ['Ctrl', 'D'], description: 'Database Explorer', category: 'Data' },
    { keys: ['Ctrl', 'A'], description: 'View Agents', category: 'AI' },
  ]},
  { name: 'Editor', shortcuts: [
    { keys: ['Ctrl', 'S'], description: 'Save current file', category: 'Editor' },
    { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'Editor' },
    { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo', category: 'Editor' },
    { keys: ['Ctrl', 'F'], description: 'Find in file', category: 'Editor' },
    { keys: ['Ctrl', 'H'], description: 'Find and replace', category: 'Editor' },
    { keys: ['Ctrl', 'Shift', 'F'], description: 'Find in workspace', category: 'Editor' },
    { keys: ['F12'], description: 'Debug Console', category: 'Dev Tools' },
  ]},
  { name: 'AI & Automation', shortcuts: [
    { keys: ['Ctrl', 'R'], description: 'Run Task', category: 'Automation' },
    { keys: ['Ctrl', 'Enter'], description: 'Send message', category: 'AI' },
    { keys: ['Ctrl', 'Shift', 'V'], description: 'Voice command', category: 'AI' },
    { keys: ['Ctrl', '.'], description: 'Quick actions', category: 'AI' },
  ]},
];

const categoryColors: Record<string, string> = {
  Navigation: '#6366f1',
  AI: '#8b5cf6',
  Automation: '#f59e0b',
  'Dev Tools': '#10b981',
  Search: '#3b82f6',
  DevOps: '#ef4444',
  Data: '#06b6d4',
  Security: '#f97316',
  Communication: '#ec4899',
  System: '#6b7280',
  Admin: '#14b8a6',
};

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<'commands' | 'shortcuts' | 'recent'>('commands');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedCommand, setSelectedCommand] = useState<CommandItem | null>(null);

  const categories = useMemo(() => {
    const cats = [...new Set(commands.map(c => c.category))];
    return ['all', ...cats];
  }, []);

  const filteredCommands = useMemo(() => {
    return commands
      .filter(c => {
        if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) ||
                 c.tags.some(t => t.includes(q));
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.frequency - a.frequency;
      });
  }, [search, categoryFilter]);

  const recentCommands = commands.filter(c => c.isRecent).sort((a, b) => b.frequency - a.frequency);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6 text-white">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent flex items-center gap-3">
          <Command className="w-8 h-8 text-indigo-400" /> Command Center
        </h1>
        <p className="text-nexus-muted mt-1">Quick access to all commands, shortcuts, and actions</p>
      </motion.div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nexus-muted" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search commands, shortcuts, and actions..."
          className="w-full pl-12 pr-4 py-3 bg-nexus-card/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-nexus-muted focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all" />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
          <span className="px-1.5 py-0.5 bg-nexus-card/5 rounded text-[10px] text-nexus-muted font-mono">Ctrl</span>
          <span className="px-1.5 py-0.5 bg-nexus-card/5 rounded text-[10px] text-nexus-muted font-mono">K</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-nexus-card/5 rounded-xl p-1 mb-6 border border-white/10 w-fit">
        {([
          { id: 'commands' as const, label: 'Commands', icon: Zap },
          { id: 'shortcuts' as const, label: 'Shortcuts', icon: Keyboard },
          { id: 'recent' as const, label: 'Recent', icon: Clock },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-nexus-card/10 text-white' : 'text-nexus-muted hover:text-white'
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Commands Tab */}
      {activeTab === 'commands' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${
                  categoryFilter === cat ? 'bg-nexus-card/10 text-white' : 'text-nexus-muted hover:text-white bg-nexus-card/[0.03]'
                }`}
                style={categoryFilter === cat && cat !== 'all' ? { backgroundColor: `${categoryColors[cat]}20`, color: categoryColors[cat] } : {}}>
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCommands.map((cmd, i) => {
              const Icon = cmd.icon;
              const color = categoryColors[cmd.category] || '#6b7280';
              return (
                <motion.div key={cmd.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCommand(selectedCommand?.id === cmd.id ? null : cmd)}
                  className={`bg-nexus-card/5 backdrop-blur-sm rounded-xl border p-4 cursor-pointer transition-all ${
                    selectedCommand?.id === cmd.id ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-white/10 hover:border-white/20'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{cmd.title}</h3>
                          {cmd.isPinned && <Pin className="w-3 h-3 text-yellow-400" />}
                        </div>
                        <p className="text-xs text-nexus-muted mt-0.5">{cmd.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <div className="flex gap-1">
                        {cmd.shortcut.split('+').map(key => (
                          <span key={key} className="px-1.5 py-0.5 bg-nexus-card/5 rounded text-[10px] text-nexus-muted font-mono border border-white/10">{key}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Shortcuts Tab */}
      {activeTab === 'shortcuts' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {shortcutGroups.map(group => (
            <div key={group.name} className="bg-nexus-card/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="font-semibold text-sm">{group.name}</h3>
              </div>
              <div className="divide-y divide-white/5">
                {group.shortcuts.map((shortcut, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-nexus-card/[0.02]">
                    <span className="text-sm text-nexus-muted">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map(key => (
                        <span key={key} className="px-2 py-1 bg-nexus-card/5 border border-white/10 rounded text-xs font-mono text-nexus-muted min-w-[28px] text-center">{key}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Recent Tab */}
      {activeTab === 'recent' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {recentCommands.map((cmd, i) => {
            const Icon = cmd.icon;
            const color = categoryColors[cmd.category] || '#6b7280';
            return (
              <motion.div key={cmd.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-3 bg-nexus-card/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-nexus-card/[0.07] cursor-pointer transition-all">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm">{cmd.title}</h3>
                  <p className="text-xs text-nexus-muted">{cmd.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-nexus-muted flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {cmd.frequency}x
                  </div>
                  {cmd.shortcut && (
                    <div className="flex gap-1">
                      {cmd.shortcut.split('+').map(key => (
                        <span key={key} className="px-1.5 py-0.5 bg-nexus-card/5 rounded text-[10px] text-nexus-muted font-mono">{key}</span>
                      ))}
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-nexus-muted" />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
