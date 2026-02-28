import React, { useState, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../lib/stores';
import { useTheme } from '../../hooks/useTheme';
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
  BarChart3,
  GitBranch,
  Store,
  Database,
  ToggleLeft,
  Calendar,
  Terminal,
  Columns,
  StickyNote,
  FolderOpen,
  Code,
  ScrollText,
  Monitor,
  User,
  Shield,
  Activity,
  Bell,
  HelpCircle,
  Bookmark,
  Tag,
  Clock,
  Cpu,
  CloudSun,
  History,
  MessageCircle,
  ClipboardList,
  Gauge,
  Image,
  Palette,
  Rocket,
  Link,
  FlaskConical,
  Network,
  CheckSquare,
  GitCompareArrows,
  Map,
  LayoutGrid,
  Code2,
  UserCog,
  Archive,
  Key,
  Wifi,
  Paintbrush,
  Webhook,
  ShieldAlert,
  MessagesSquare,
  TableProperties,
  Command,
  HeartPulse,
  Container,
  Lock,
  Gauge as GaugeCircle,
  Inbox,
  Layers,
  Mail,
  FileCode,
  ActivitySquare,
  BotMessageSquare,
  FormInput,
  BookOpenCheck,
  TerminalSquare,
  Hexagon,
  HardDrive,
  LogOut,
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
    title: 'Core',
    items: [
      { label: 'Dashboard',     path: '/',              icon: LayoutDashboard },
      { label: 'Chat',          path: '/chat',          icon: MessageSquare, badge: 3 },
      { label: 'Tasks',         path: '/tasks',         icon: ListTodo,      badge: 5 },
      { label: 'Voice',         path: '/voice',         icon: Mic },
      { label: 'Calendar',      path: '/calendar',      icon: Calendar },
      { label: 'Notifications', path: '/notifications', icon: Bell, badge: 8 },
    ],
  },
  {
    title: 'AI & Agents',
    items: [
      { label: 'Agents',          path: '/agents',          icon: Bot },
      { label: 'AI Models',       path: '/ai-models',       icon: Brain },
      { label: 'ML Models',       path: '/ml-models',       icon: Cpu },
      { label: 'Workflows',       path: '/workflows',       icon: GitBranch },
      { label: 'Automations',     path: '/automations',     icon: Zap },
      { label: 'Chatbot Builder', path: '/chatbot-builder', icon: BotMessageSquare },
    ],
  },
  {
    title: 'Life',
    items: [
      { label: 'Home',     path: '/home',    icon: HomeIcon },
      { label: 'Health',   path: '/health',  icon: Heart },
      { label: 'Finance',  path: '/finance', icon: DollarSign },
      { label: 'Weather',  path: '/weather', icon: CloudSun },
      { label: 'Vision',   path: '/vision',  icon: Camera },
      { label: 'Map View', path: '/map',     icon: Map },
    ],
  },
  {
    title: 'Productivity',
    items: [
      { label: 'Kanban Board', path: '/kanban',       icon: Columns },
      { label: 'Notes',        path: '/notes',        icon: StickyNote },
      { label: 'Email',        path: '/email',        icon: Mail },
      { label: 'Reports',      path: '/reports',      icon: FileText },
      { label: 'Team Chat',    path: '/team-chat',    icon: MessagesSquare },
      { label: 'Form Builder', path: '/form-builder', icon: FormInput },
      { label: 'Widgets',      path: '/widgets',      icon: LayoutGrid },
    ],
  },
  {
    title: 'Developer',
    items: [
      { label: 'Terminal',       path: '/terminal',       icon: Terminal },
      { label: 'SSH Terminal',   path: '/ssh',            icon: TerminalSquare },
      { label: 'Code Editor',   path: '/code-editor',    icon: FileCode },
      { label: 'Snippets',      path: '/snippets',       icon: Code2 },
      { label: 'API Playground', path: '/api-playground', icon: Code },
      { label: 'API Docs',      path: '/api-docs',       icon: BookOpenCheck },
      { label: 'Diff Viewer',   path: '/diff-viewer',    icon: GitCompareArrows },
      { label: 'Experiments',   path: '/experiments',    icon: FlaskConical },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'Database',      path: '/database',        icon: Database },
      { label: 'Pipelines',     path: '/data-pipelines',  icon: Database },
      { label: 'File Manager',  path: '/files',           icon: FolderOpen },
      { label: 'Data Explorer', path: '/data-explorer',   icon: TableProperties },
      { label: 'Media Gallery', path: '/media',           icon: Image },
      { label: 'Marketplace',   path: '/marketplace',     icon: Store },
      { label: 'Tags',          path: '/tags',            icon: Tag },
      { label: 'Bookmarks',     path: '/bookmarks',       icon: Bookmark },
      { label: 'Versions',      path: '/version-history', icon: History },
    ],
  },
  {
    title: 'DevOps',
    items: [
      { label: 'Git Manager',   path: '/git',            icon: GitBranch },
      { label: 'Containers',    path: '/containers',     icon: Container },
      { label: 'Deployments',   path: '/deployments',    icon: Rocket },
      { label: 'Environments',  path: '/environments',   icon: Layers },
      { label: 'Service Mesh',  path: '/service-mesh',   icon: Hexagon },
      { label: 'Cron Jobs',     path: '/cron-jobs',      icon: Clock },
      { label: 'Webhooks',      path: '/webhooks',       icon: Webhook },
      { label: 'Cmd Center',    path: '/command-center', icon: Command },
      { label: 'Cache',         path: '/cache',          icon: HardDrive },
      { label: 'Queues',        path: '/queues',         icon: Inbox },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Analytics',    path: '/analytics',         icon: BarChart3 },
      { label: 'Activity',     path: '/activity',          icon: Activity },
      { label: 'Sys Monitor',  path: '/system-monitor',    icon: Monitor },
      { label: 'Performance',  path: '/performance',       icon: Gauge },
      { label: 'Uptime',       path: '/uptime',            icon: HeartPulse },
      { label: 'Logs',         path: '/logs',              icon: ScrollText },
      { label: 'Network',      path: '/network',           icon: Globe },
      { label: 'Net Topology', path: '/network-topology',  icon: Network },
      { label: 'Net Devices',  path: '/network-devices',   icon: Wifi },
      { label: 'Status Page',  path: '/status',            icon: CheckSquare },
      { label: 'Resources',    path: '/resources',         icon: ActivitySquare },
    ],
  },
  {
    title: 'Security',
    items: [
      { label: 'Security Ctr',  path: '/security-center', icon: ShieldAlert },
      { label: 'Security',      path: '/security',        icon: Shield },
      { label: 'Audit Log',     path: '/audit-log',       icon: ClipboardList },
      { label: 'Secrets',       path: '/secrets',         icon: Lock },
      { label: 'API Keys',      path: '/api-keys',        icon: Key },
      { label: 'Rate Limits',   path: '/rate-limits',     icon: GaugeCircle },
      { label: 'Backups',       path: '/backups',         icon: Archive },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings',      path: '/settings',       icon: Settings },
      { label: 'Profile',       path: '/profile',        icon: User },
      { label: 'Users',         path: '/users',          icon: UserCog },
      { label: 'Integrations',  path: '/integrations',   icon: Link },
      { label: 'Feature Flags', path: '/feature-flags',  icon: ToggleLeft },
      { label: 'Theme Editor',  path: '/theme-editor',   icon: Palette },
      { label: 'Design System', path: '/design-system',  icon: Paintbrush },
      { label: 'Onboarding',    path: '/onboarding',     icon: Rocket },
      { label: 'Feedback',      path: '/feedback',       icon: MessageCircle },
      { label: 'Help Center',   path: '/help',           icon: HelpCircle },
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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, themeDef, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
                      : 'text-nexus-muted hover:bg-nexus-card/5 hover:text-nexus-text'
                    }
                  `}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-nexus-primary shadow-nexus"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}

                  <Icon
                    size={18}
                    className={`shrink-0 transition-all duration-200 ${
                      active ? 'text-nexus-primary drop-shadow-[0_0_6px_rgb(var(--nexus-primary)/0.6)]' : 'group-hover:text-nexus-text'
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
                    className="absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none
                               bg-[radial-gradient(ellipse_at_center,_rgb(var(--nexus-primary)/0.06)_0%,_transparent_70%)]"
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

      {/* ---- Quick theme toggle ---- */}
      <div className="border-t border-nexus-border/30 px-3 py-2">
        {collapsed ? (
          <Tooltip content={`Theme: ${themeDef.name}`} side="right">
            <button
              onClick={toggleTheme}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg
                         text-nexus-muted transition-all duration-200
                         hover:bg-nexus-primary/10 hover:text-nexus-primary"
            >
              <Palette size={16} />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={toggleTheme}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm
                       text-nexus-muted transition-all duration-200
                       hover:bg-nexus-primary/10 hover:text-nexus-primary"
          >
            <Palette size={16} className="shrink-0" />
            <span className="flex-1 text-left text-xs font-medium">{themeDef.name}</span>
            <div className="flex gap-0.5">
              {[themeDef.preview.primary, themeDef.preview.secondary, themeDef.preview.accent].map((c, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </div>
          </button>
        )}
      </div>

      {/* ---- User profile ---- */}
      <div className="border-t border-nexus-border/30 p-3">
        <div className={`flex items-center gap-3 rounded-lg p-2 transition hover:bg-nexus-card/5 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar fallback={user?.username?.slice(0, 2).toUpperCase() ?? 'NX'} size="sm" status="online" glow />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className="flex-1 overflow-hidden"
              >
                <p className="truncate text-sm font-medium text-nexus-text">{user?.username ?? 'Nexus User'}</p>
                <p className="truncate text-[10px] text-nexus-muted capitalize">{user?.role ?? 'user'}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout button */}
          {!collapsed ? (
            <button
              onClick={handleLogout}
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                         text-nexus-muted transition-all duration-200
                         hover:bg-red-500/10 hover:text-red-400"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <Tooltip content="Sign out" side="right">
              <button
                onClick={handleLogout}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-lg
                           text-nexus-muted transition-all duration-200
                           hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={14} />
              </button>
            </Tooltip>
          )}
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
