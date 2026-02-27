import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Camera,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Tooltip from '../ui/Tooltip';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/* ------------------------------------------------------------------ */
/*  Nav data                                                           */
/* ------------------------------------------------------------------ */
const sections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard',  path: '/',        icon: LayoutDashboard },
      { label: 'Chat',       path: '/chat',     icon: MessageSquare, badge: 3 },
      { label: 'Tasks',      path: '/tasks',    icon: ListTodo,      badge: 5 },
      { label: 'Voice',      path: '/voice',    icon: Mic },
    ],
  },
  {
    title: 'Agents',
    items: [
      { label: 'Personal',    path: '/chat?agent=personal',   icon: Bot },
      { label: 'Security',    path: '/chat?agent=security',   icon: ShieldCheck },
      { label: 'Automation',  path: '/chat?agent=automation', icon: Zap },
      { label: 'Learning',    path: '/chat?agent=learning',   icon: Brain },
      { label: 'Work',        path: '/chat?agent=work',       icon: Users },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Home',     path: '/home',     icon: HomeIcon },
      { label: 'Health',   path: '/health',   icon: Heart },
      { label: 'Finance',  path: '/finance',  icon: DollarSign },
      { label: 'Reports',  path: '/reports',  icon: FileText },
      { label: 'Vision',   path: '/vision',   icon: Camera },
      { label: 'Network',  path: '/network',  icon: Globe },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Sidebar animation variants                                         */
/* ------------------------------------------------------------------ */
const sidebarVariants = {
  expanded: { width: 240 },
  collapsed: { width: 68 },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path.split('?')[0]);
  };

  return (
    <motion.aside
      variants={sidebarVariants}
      animate={collapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative z-30 flex h-full flex-col border-r border-nexus-border/50 bg-nexus-surface/40
                 backdrop-blur-xl overflow-hidden select-none"
    >
      {/* ---- Logo ---- */}
      <div className="flex h-16 items-center gap-3 border-b border-nexus-border/30 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nexus-primary to-nexus-secondary neon-blue">
          <BookOpen size={18} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="gradient-text text-lg font-bold tracking-wide whitespace-nowrap"
            >
              Nexus AI
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Navigation sections ---- */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title} className="mb-3">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mb-1 px-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-nexus-muted/50"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>

            {section.items.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;

              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`
                    group relative mx-2 mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
                    transition-all duration-200
                    ${active
                      ? 'bg-nexus-primary/10 text-nexus-primary'
                      : 'text-nexus-muted hover:bg-white/5 hover:text-nexus-text'
                    }
                  `}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-nexus-primary"
                      style={{ boxShadow: '0 0 8px rgba(59,130,246,.6)' }}
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  <Icon
                    size={18}
                    className={`shrink-0 transition-all duration-200 ${
                      active ? 'text-nexus-primary drop-shadow-[0_0_6px_rgba(59,130,246,.6)]' : 'group-hover:text-nexus-text'
                    }`}
                  />

                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        className="flex-1 whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Badge */}
                  {item.badge && !collapsed && (
                    <Badge variant="info" dot pulse>
                      {item.badge}
                    </Badge>
                  )}
                  {item.badge && collapsed && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-nexus-primary animate-pulse" />
                  )}

                  {/* Hover glow */}
                  <span
                    className="absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"
                    style={{
                      background: 'radial-gradient(ellipse at center, rgba(59,130,246,.06) 0%, transparent 70%)',
                    }}
                  />
                </NavLink>
              );

              return collapsed ? (
                <Tooltip key={item.path} content={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      {/* ---- User profile ---- */}
      <div className="border-t border-nexus-border/30 p-3">
        <div className={`flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/5 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar fallback="NX" size="sm" status="online" glow />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="flex-1 overflow-hidden"
              >
                <p className="truncate text-sm font-medium text-nexus-text">Nexus User</p>
                <p className="truncate text-[10px] text-nexus-muted">Pro Plan</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ---- Collapse toggle ---- */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-40 flex h-6 w-6 items-center justify-center rounded-full
                   border border-nexus-border bg-nexus-surface text-nexus-muted shadow-md
                   transition hover:bg-nexus-primary/20 hover:text-nexus-primary focus-ring"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
