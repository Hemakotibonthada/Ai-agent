import React, { useState, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../lib/stores';
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
    title: 'Main',
    items: [
      { label: 'Dashboard',  path: '/',        icon: LayoutDashboard },
      { label: 'Chat',       path: '/chat',     icon: MessageSquare, badge: 3 },
      { label: 'Tasks',      path: '/tasks',    icon: ListTodo,      badge: 5 },
      { label: 'Voice',      path: '/voice',    icon: Mic },
      { label: 'Agents',     path: '/agents',   icon: Bot },
      { label: 'AI Models',  path: '/ai-models', icon: Brain },
      { label: 'Analytics',  path: '/analytics', icon: BarChart3 },
      { label: 'Activity',   path: '/activity', icon: Activity },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Workflows',     path: '/workflows',     icon: GitBranch },
      { label: 'Automations',   path: '/automations',   icon: Zap },
      { label: 'Kanban Board',  path: '/kanban',         icon: Columns },
      { label: 'Calendar',      path: '/calendar',       icon: Calendar },
      { label: 'Notes',         path: '/notes',          icon: StickyNote },
      { label: 'Terminal',      path: '/terminal',       icon: Terminal },
      { label: 'API Playground', path: '/api-playground', icon: Code },
      { label: 'Cron Jobs',     path: '/cron-jobs',      icon: Clock },
      { label: 'Experiments',   path: '/experiments',    icon: FlaskConical },
      { label: 'Deployments',   path: '/deployments',    icon: Rocket },
      { label: 'Diff Viewer',   path: '/diff-viewer',    icon: GitCompareArrows },
      { label: 'Snippets',      path: '/snippets',       icon: Code2 },
      { label: 'Webhooks',      path: '/webhooks',       icon: Webhook },
      { label: 'Cmd Center',    path: '/command-center', icon: Command },
      { label: 'Widgets',       path: '/widgets',        icon: LayoutGrid },
      { label: 'Email',         path: '/email',          icon: Mail },
      { label: 'Code Editor',   path: '/code-editor',    icon: FileCode },
      { label: 'Chatbot Builder', path: '/chatbot-builder', icon: BotMessageSquare },
      { label: 'Form Builder',  path: '/form-builder',   icon: FormInput },
      { label: 'API Docs',      path: '/api-docs',       icon: BookOpenCheck },
      { label: 'SSH Terminal',  path: '/ssh',            icon: TerminalSquare },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'Pipelines',     path: '/data-pipelines', icon: Database },
      { label: 'File Manager',  path: '/files',          icon: FolderOpen },
      { label: 'Database',      path: '/database',       icon: Database },
      { label: 'Marketplace',   path: '/marketplace',    icon: Store },
      { label: 'Feature Flags', path: '/feature-flags',  icon: ToggleLeft },
      { label: 'ML Models',     path: '/ml-models',      icon: Cpu },
      { label: 'Media Gallery', path: '/media',          icon: Image },
      { label: 'Data Explorer', path: '/data-explorer',  icon: TableProperties },
      { label: 'Tags',          path: '/tags',           icon: Tag },
      { label: 'Bookmarks',     path: '/bookmarks',      icon: Bookmark },
      { label: 'Versions',      path: '/version-history', icon: History },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Home',          path: '/home',           icon: HomeIcon },
      { label: 'Health',        path: '/health',         icon: Heart },
      { label: 'Finance',       path: '/finance',        icon: DollarSign },
      { label: 'Reports',       path: '/reports',        icon: FileText },
      { label: 'Vision',        path: '/vision',         icon: Camera },
      { label: 'Network',       path: '/network',        icon: Globe },
      { label: 'Net Topology',  path: '/network-topology', icon: Network },
      { label: 'Net Devices',   path: '/network-devices', icon: Wifi },
      { label: 'Uptime',        path: '/uptime',          icon: HeartPulse },
      { label: 'Git Manager',  path: '/git',             icon: GitBranch },
      { label: 'Containers',   path: '/containers',      icon: Container },
      { label: 'Secrets',      path: '/secrets',         icon: Lock },
      { label: 'Rate Limits',  path: '/rate-limits',     icon: GaugeCircle },
      { label: 'Queues',       path: '/queues',          icon: Inbox },
      { label: 'Environments', path: '/environments',    icon: Layers },
      { label: 'Resources',    path: '/resources',       icon: ActivitySquare },
      { label: 'Service Mesh', path: '/service-mesh',    icon: Hexagon },
      { label: 'Cache',        path: '/cache',           icon: HardDrive },
      { label: 'Security Ctr',  path: '/security-center', icon: ShieldAlert },
      { label: 'Team Chat',     path: '/team-chat',       icon: MessagesSquare },
      { label: 'Map View',      path: '/map',            icon: Map },
      { label: 'Status Page',   path: '/status',         icon: CheckSquare },
      { label: 'Weather',       path: '/weather',        icon: CloudSun },
      { label: 'Security',      path: '/security',       icon: Shield },
      { label: 'Audit Log',     path: '/audit-log',      icon: ClipboardList },
      { label: 'Sys Monitor',   path: '/system-monitor', icon: Monitor },
      { label: 'Performance',   path: '/performance',    icon: Gauge },
      { label: 'Logs',          path: '/logs',           icon: ScrollText },
      { label: 'Integrations',  path: '/integrations',   icon: Link },
      { label: 'Notifications', path: '/notifications',  icon: Bell, badge: 8 },
      { label: 'Profile',       path: '/profile',        icon: User },
      { label: 'Theme Editor',  path: '/theme-editor',   icon: Palette },
      { label: 'Design System', path: '/design-system',  icon: Paintbrush },
      { label: 'Feedback',      path: '/feedback',       icon: MessageCircle },
      { label: 'Help Center',   path: '/help',           icon: HelpCircle },
      { label: 'Onboarding',    path: '/onboarding',     icon: Rocket },
      { label: 'Users',          path: '/users',          icon: UserCog },
      { label: 'Backups',        path: '/backups',        icon: Archive },
      { label: 'API Keys',       path: '/api-keys',       icon: Key },
      { label: 'Settings',       path: '/settings',       icon: Settings },
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
