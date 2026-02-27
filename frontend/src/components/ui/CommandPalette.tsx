import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Command,
  LayoutDashboard,
  MessageSquare,
  ListTodo,
  HomeIcon,
  Heart,
  DollarSign,
  FileText,
  Settings,
  Mic,
  Bot,
  ShieldCheck,
  Zap,
  Brain,
  ArrowRight,
  Clock,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: LucideIcon;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (path: string) => void;
  extraCommands?: CommandItem[];
}

/* ------------------------------------------------------------------ */
/*  Default commands                                                   */
/* ------------------------------------------------------------------ */
function buildDefaultCommands(navigate: (p: string) => void): CommandItem[] {
  return [
    // Navigation
    { id: 'nav-dashboard', label: 'Go to Dashboard',  category: 'Navigation', icon: LayoutDashboard, shortcut: 'G D', action: () => navigate('/') },
    { id: 'nav-chat',      label: 'Go to Chat',       category: 'Navigation', icon: MessageSquare,   shortcut: 'G C', action: () => navigate('/chat') },
    { id: 'nav-tasks',     label: 'Go to Tasks',      category: 'Navigation', icon: ListTodo,        shortcut: 'G T', action: () => navigate('/tasks') },
    { id: 'nav-home',      label: 'Go to Home Control', category: 'Navigation', icon: HomeIcon,      action: () => navigate('/home') },
    { id: 'nav-health',    label: 'Go to Health',     category: 'Navigation', icon: Heart,           action: () => navigate('/health') },
    { id: 'nav-finance',   label: 'Go to Finance',    category: 'Navigation', icon: DollarSign,      action: () => navigate('/finance') },
    { id: 'nav-reports',   label: 'Go to Reports',    category: 'Navigation', icon: FileText,        action: () => navigate('/reports') },
    { id: 'nav-settings',  label: 'Go to Settings',   category: 'Navigation', icon: Settings,        shortcut: 'G S', action: () => navigate('/settings') },
    { id: 'nav-voice',     label: 'Go to Voice',      category: 'Navigation', icon: Mic,             action: () => navigate('/voice') },
    // Actions
    { id: 'act-new-chat',  label: 'New Conversation', category: 'Actions', icon: MessageSquare,   shortcut: 'N', action: () => navigate('/chat?new=1') },
    { id: 'act-new-task',  label: 'Create Task',      category: 'Actions', icon: ListTodo,        action: () => navigate('/tasks?new=1') },
    { id: 'act-voice',     label: 'Activate Voice',   category: 'Actions', icon: Mic,             shortcut: 'V', action: () => navigate('/voice?listen=1') },
    // Agents
    { id: 'agt-personal',  label: 'Personal Agent',   category: 'Agents', icon: Bot,             action: () => navigate('/chat?agent=personal') },
    { id: 'agt-security',  label: 'Security Agent',   category: 'Agents', icon: ShieldCheck,     action: () => navigate('/chat?agent=security') },
    { id: 'agt-automation',label: 'Automation Agent',  category: 'Agents', icon: Zap,             action: () => navigate('/chat?agent=automation') },
    { id: 'agt-learning',  label: 'Learning Agent',   category: 'Agents', icon: Brain,           action: () => navigate('/chat?agent=learning') },
    // Settings
    { id: 'set-theme',     label: 'Toggle Theme',     category: 'Settings', icon: Settings,       action: () => {} },
  ];
}

/* ------------------------------------------------------------------ */
/*  Fuzzy match helper                                                 */
/* ------------------------------------------------------------------ */
function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

/* ------------------------------------------------------------------ */
/*  Overlay / backdrop variants                                        */
/* ------------------------------------------------------------------ */
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const panelVariants = {
  hidden: { opacity: 0, y: -20, scale: 0.96, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, scale: 0.98, filter: 'blur(4px)' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
  extraCommands = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback((path: string) => {
    onNavigate?.(path);
    onOpenChange(false);
  }, [onNavigate, onOpenChange]);

  const allCommands = useMemo(
    () => [...buildDefaultCommands(navigate), ...extraCommands],
    [navigate, extraCommands],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    return allCommands.filter(
      (c) => fuzzyMatch(c.label, query) || fuzzyMatch(c.category, query),
    );
  }, [query, allCommands]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filtered]);

  // Flatten for keyboard nav
  const flatItems = useMemo(() => filtered, [filtered]);

  // Reset on open/query change
  useEffect(() => { setActiveIndex(0); }, [query]);
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % flatItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
          break;
        case 'Enter':
          e.preventDefault();
          flatItems[activeIndex]?.action();
          onOpenChange(false);
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    },
    [flatItems, activeIndex, onOpenChange],
  );

  let runningIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.15 }}
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            className="fixed left-1/2 top-[18%] z-[91] w-full max-w-xl -translate-x-1/2
                       glass-heavy rounded-2xl border border-nexus-border shadow-2xl"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-nexus-border/50 px-4 py-3">
              <Search size={18} className="text-nexus-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search…"
                className="flex-1 bg-transparent text-sm text-nexus-text placeholder:text-nexus-muted/60 outline-none"
              />
              <kbd className="hidden rounded border border-nexus-border bg-nexus-surface px-1.5 py-0.5 text-[10px] text-nexus-muted sm:inline">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
              {flatItems.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-nexus-muted">
                  No results for "{query}"
                </p>
              )}

              {[...grouped.entries()].map(([category, items]) => (
                <div key={category} className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-nexus-muted/60">
                    {category}
                  </p>
                  {items.map((item) => {
                    runningIndex++;
                    const idx = runningIndex;
                    const isActive = idx === activeIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => { item.action(); onOpenChange(false); }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`
                          flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors
                          ${isActive ? 'bg-nexus-primary/15 text-nexus-primary' : 'text-nexus-text hover:bg-nexus-card/5'}
                        `}
                      >
                        <Icon size={16} className={isActive ? 'text-nexus-primary' : 'text-nexus-muted'} />
                        <span className="flex-1">{item.label}</span>
                        {item.shortcut && (
                          <kbd className="rounded border border-nexus-border bg-nexus-surface px-1.5 py-0.5 text-[10px] text-nexus-muted">
                            {item.shortcut}
                          </kbd>
                        )}
                        {isActive && <ArrowRight size={14} className="text-nexus-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 border-t border-nexus-border/50 px-4 py-2 text-[10px] text-nexus-muted/60">
              <span className="flex items-center gap-1"><Clock size={10} /> Recent</span>
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>Esc Close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
