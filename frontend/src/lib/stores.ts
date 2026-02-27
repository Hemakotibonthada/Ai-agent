import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import axios from 'axios';

// ============================================================
// Auth Store
// ============================================================
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer' | 'demo' | 'api';
  avatar?: string;
  mfaEnabled: boolean;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: number;
  sessionExpiresAt: number | null;
  isDemoAccount: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => void;
  setError: (error: string | null) => void;
  hasPermission: (permission: string) => boolean;
  checkSessionExpiry: () => boolean;
  touchActivity: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastActivity: Date.now(),
        sessionExpiresAt: null,
        isDemoAccount: false,

        login: async (username: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
            const { access_token, refresh_token, expires_in, user: profile } = res.data;
            const isDemo = profile.role === 'demo';
            localStorage.setItem('nexus_token', access_token);
            set({
              user: {
                id: profile.id,
                name: profile.display_name || profile.username,
                email: profile.email,
                role: profile.role,
                avatar: profile.avatar_url || profile.display_name?.split(' ').map((w: string) => w[0]).join('').toUpperCase(),
                mfaEnabled: profile.two_factor_enabled ?? false,
                permissions: profile.permissions ?? (isDemo ? ['read'] : ['all']),
              },
              token: access_token,
              refreshToken: refresh_token,
              isAuthenticated: true,
              isLoading: false,
              isDemoAccount: isDemo,
              lastActivity: Date.now(),
              sessionExpiresAt: Date.now() + (expires_in ?? 86400) * 1000,
            });
          } catch (err: any) {
            const msg = err?.response?.data?.detail ?? err.message ?? 'Login failed';
            set({ isLoading: false, error: msg });
            throw new Error(msg);
          }
        },

        logout: () => {
          localStorage.removeItem('nexus_token');
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isDemoAccount: false,
            sessionExpiresAt: null,
          });
        },

        refreshSession: async () => {
          const { refreshToken } = get();
          if (!refreshToken) return;
          set({ isLoading: true });
          try {
            const res = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
            const { access_token, expires_in } = res.data;
            localStorage.setItem('nexus_token', access_token);
            set({
              token: access_token,
              sessionExpiresAt: Date.now() + (expires_in ?? 86400) * 1000,
              isLoading: false,
            });
          } catch {
            set({ isLoading: false });
          }
        },

        updateProfile: (updates) => {
          const { user } = get();
          if (user) set({ user: { ...user, ...updates } });
        },

        setError: (error) => set({ error }),

        hasPermission: (permission: string) => {
          const { user } = get();
          if (!user) return false;
          return user.permissions.includes('all') || user.permissions.includes(permission);
        },

        checkSessionExpiry: () => {
          const { sessionExpiresAt } = get();
          if (!sessionExpiresAt) return true;
          return Date.now() > sessionExpiresAt;
        },

        touchActivity: () => set({ lastActivity: Date.now() }),
      }),
      { name: 'nexus-auth' }
    ),
    { name: 'AuthStore' }
  )
);

// ============================================================
// Notification Store
// ============================================================
interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  source?: string;
  icon?: string;
  persistent?: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  filter: 'all' | 'unread' | 'info' | 'warning' | 'error';
  maxNotifications: number;
  soundEnabled: boolean;

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setFilter: (filter: NotificationState['filter']) => void;
  toggleOpen: () => void;
  toggleSound: () => void;
  getFiltered: () => Notification[];
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [
          { id: 'n1', type: 'success', title: 'Backup Complete', message: 'Daily backup finished successfully', timestamp: Date.now() - 300000, read: false, source: 'Backup Service' },
          { id: 'n2', type: 'warning', title: 'High CPU Usage', message: 'CPU usage exceeded 90% for 5 minutes', timestamp: Date.now() - 600000, read: false, source: 'System Monitor' },
          { id: 'n3', type: 'info', title: 'New Update Available', message: 'Nexus AI v2.5.0 is ready to install', timestamp: Date.now() - 900000, read: false, source: 'Update Service' },
          { id: 'n4', type: 'error', title: 'Service Down', message: 'Vision service failed health check', timestamp: Date.now() - 1200000, read: true, source: 'Health Monitor' },
          { id: 'n5', type: 'system', title: 'Scheduled Maintenance', message: 'Database maintenance at 02:00 UTC', timestamp: Date.now() - 1800000, read: true, source: 'Scheduler' },
        ],
        unreadCount: 3,
        isOpen: false,
        filter: 'all',
        maxNotifications: 100,
        soundEnabled: true,

        addNotification: (notification) => {
          const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const newNotif: Notification = {
            ...notification,
            id,
            timestamp: Date.now(),
            read: false,
          };
          set((state) => {
            const notifications = [newNotif, ...state.notifications].slice(0, state.maxNotifications);
            return { notifications, unreadCount: state.unreadCount + 1 };
          });
        },

        markAsRead: (id) => {
          set((state) => {
            const notifications = state.notifications.map(n =>
              n.id === id && !n.read ? { ...n, read: true } : n
            );
            const unreadCount = notifications.filter(n => !n.read).length;
            return { notifications, unreadCount };
          });
        },

        markAllAsRead: () => {
          set((state) => ({
            notifications: state.notifications.map(n => ({ ...n, read: true })),
            unreadCount: 0,
          }));
        },

        removeNotification: (id) => {
          set((state) => {
            const notifications = state.notifications.filter(n => n.id !== id);
            const unreadCount = notifications.filter(n => !n.read).length;
            return { notifications, unreadCount };
          });
        },

        clearAll: () => set({ notifications: [], unreadCount: 0 }),

        setFilter: (filter) => set({ filter }),
        toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
        toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),

        getFiltered: () => {
          const { notifications, filter } = get();
          if (filter === 'all') return notifications;
          if (filter === 'unread') return notifications.filter(n => !n.read);
          return notifications.filter(n => n.type === filter);
        },
      }),
      { name: 'nexus-notifications' }
    ),
    { name: 'NotificationStore' }
  )
);

// ============================================================
// Preferences Store
// ============================================================
interface ThemeConfig {
  mode: 'dark' | 'light' | 'system';
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: 'sm' | 'md' | 'lg';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animationLevel: 'none' | 'subtle' | 'full';
  glassmorphism: boolean;
  particleBackground: boolean;
}

interface PreferencesState {
  theme: ThemeConfig;
  sidebar: {
    collapsed: boolean;
    position: 'left' | 'right';
    width: number;
  };
  dashboard: {
    defaultView: 'grid' | 'list';
    refreshInterval: number;
    showWelcome: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    fontSize: number;
    keyboardShortcuts: boolean;
  };
  locale: {
    language: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
  };
  privacy: {
    telemetry: boolean;
    crashReports: boolean;
    usageAnalytics: boolean;
  };

  updateTheme: (updates: Partial<ThemeConfig>) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  updateDashboard: (updates: Partial<PreferencesState['dashboard']>) => void;
  updateAccessibility: (updates: Partial<PreferencesState['accessibility']>) => void;
  updateLocale: (updates: Partial<PreferencesState['locale']>) => void;
  updatePrivacy: (updates: Partial<PreferencesState['privacy']>) => void;
  resetToDefaults: () => void;
}

const defaultPreferences: Omit<PreferencesState, 'updateTheme' | 'toggleSidebar' | 'setSidebarWidth' | 'updateDashboard' | 'updateAccessibility' | 'updateLocale' | 'updatePrivacy' | 'resetToDefaults'> = {
  theme: {
    mode: 'dark',
    primaryColor: '#6366F1',
    accentColor: '#8B5CF6',
    fontFamily: 'Inter',
    fontSize: 'md',
    borderRadius: 'lg',
    animationLevel: 'full',
    glassmorphism: true,
    particleBackground: true,
  },
  sidebar: { collapsed: false, position: 'left', width: 280 },
  dashboard: { defaultView: 'grid', refreshInterval: 30, showWelcome: true },
  accessibility: { reducedMotion: false, highContrast: false, fontSize: 14, keyboardShortcuts: true },
  locale: { language: 'en', timezone: 'America/Los_Angeles', dateFormat: 'YYYY-MM-DD', numberFormat: 'en-US' },
  privacy: { telemetry: true, crashReports: true, usageAnalytics: false },
};

export const usePreferencesStore = create<PreferencesState>()(
  devtools(
    persist(
      (set) => ({
        ...defaultPreferences,

        updateTheme: (updates) => set((state) => ({ theme: { ...state.theme, ...updates } })),
        toggleSidebar: () => set((state) => ({ sidebar: { ...state.sidebar, collapsed: !state.sidebar.collapsed } })),
        setSidebarWidth: (width) => set((state) => ({ sidebar: { ...state.sidebar, width } })),
        updateDashboard: (updates) => set((state) => ({ dashboard: { ...state.dashboard, ...updates } })),
        updateAccessibility: (updates) => set((state) => ({ accessibility: { ...state.accessibility, ...updates } })),
        updateLocale: (updates) => set((state) => ({ locale: { ...state.locale, ...updates } })),
        updatePrivacy: (updates) => set((state) => ({ privacy: { ...state.privacy, ...updates } })),
        resetToDefaults: () => set(defaultPreferences),
      }),
      { name: 'nexus-preferences' }
    ),
    { name: 'PreferencesStore' }
  )
);

// ============================================================
// Search Store
// ============================================================
interface SearchResult {
  id: string;
  type: 'page' | 'task' | 'agent' | 'setting' | 'command' | 'file' | 'note';
  title: string;
  description: string;
  url: string;
  icon?: string;
  score: number;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  isOpen: boolean;
  recentSearches: string[];
  selectedIndex: number;
  maxRecentSearches: number;

  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clearResults: () => void;
  toggleOpen: () => void;
  close: () => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setSelectedIndex: (index: number) => void;
  moveSelection: (direction: 'up' | 'down') => void;
  getSelectedResult: () => SearchResult | undefined;
}

const allSearchableItems: SearchResult[] = [
  { id: 's1', type: 'page', title: 'Dashboard', description: 'Main dashboard overview', url: '/', score: 0 },
  { id: 's2', type: 'page', title: 'Chat', description: 'AI Chat interface', url: '/chat', score: 0 },
  { id: 's3', type: 'page', title: 'Tasks', description: 'Task management', url: '/tasks', score: 0 },
  { id: 's4', type: 'page', title: 'Agents', description: 'AI Agent management', url: '/agents', score: 0 },
  { id: 's5', type: 'page', title: 'Analytics', description: 'System analytics and metrics', url: '/analytics', score: 0 },
  { id: 's6', type: 'page', title: 'Settings', description: 'Application settings', url: '/settings', score: 0 },
  { id: 's7', type: 'page', title: 'Health', description: 'Health monitoring', url: '/health', score: 0 },
  { id: 's8', type: 'page', title: 'Finance', description: 'Financial dashboard', url: '/finance', score: 0 },
  { id: 's9', type: 'page', title: 'Reports', description: 'Report generation', url: '/reports', score: 0 },
  { id: 's10', type: 'page', title: 'AI Models', description: 'Model management', url: '/ai-models', score: 0 },
  { id: 's11', type: 'page', title: 'Security', description: 'Security dashboard', url: '/security', score: 0 },
  { id: 's12', type: 'page', title: 'Workflows', description: 'Workflow automation', url: '/workflows', score: 0 },
  { id: 's13', type: 'command', title: 'Toggle Dark Mode', description: 'Switch between light and dark themes', url: '#theme-toggle', score: 0 },
  { id: 's14', type: 'command', title: 'Clear Cache', description: 'Clear application cache', url: '#clear-cache', score: 0 },
  { id: 's15', type: 'command', title: 'Export Data', description: 'Export current data to file', url: '#export', score: 0 },
  { id: 's16', type: 'agent', title: 'Personal Agent', description: 'Your personal AI assistant', url: '/agents?id=personal', score: 0 },
  { id: 's17', type: 'agent', title: 'Security Agent', description: 'Security monitoring agent', url: '/agents?id=security', score: 0 },
  { id: 's18', type: 'agent', title: 'Home Agent', description: 'Smart home automation', url: '/agents?id=home', score: 0 },
  { id: 's19', type: 'setting', title: 'Notification Preferences', description: 'Configure notification settings', url: '/settings?tab=notifications', score: 0 },
  { id: 's20', type: 'setting', title: 'API Keys', description: 'Manage API keys', url: '/api-keys', score: 0 },
  { id: 's21', type: 'page', title: 'Terminal', description: 'Built-in terminal', url: '/terminal', score: 0 },
  { id: 's22', type: 'page', title: 'Network Topology', description: 'Network device map', url: '/network-topology', score: 0 },
  { id: 's23', type: 'page', title: 'Kanban Board', description: 'Project board view', url: '/kanban', score: 0 },
  { id: 's24', type: 'page', title: 'File Manager', description: 'File browser and manager', url: '/files', score: 0 },
];

export const useSearchStore = create<SearchState>()(
  devtools(
    (set, get) => ({
      query: '',
      results: [],
      isSearching: false,
      isOpen: false,
      recentSearches: [],
      selectedIndex: -1,
      maxRecentSearches: 10,

      setQuery: (query) => set({ query }),

      search: async (query) => {
        if (!query.trim()) {
          set({ results: [], isSearching: false });
          return;
        }
        set({ isSearching: true, query });

        await new Promise(resolve => setTimeout(resolve, 100));

        const q = query.toLowerCase();
        const results = allSearchableItems
          .map(item => {
            let score = 0;
            const title = item.title.toLowerCase();
            const desc = item.description.toLowerCase();
            if (title === q) score = 100;
            else if (title.startsWith(q)) score = 80;
            else if (title.includes(q)) score = 60;
            else if (desc.includes(q)) score = 40;
            else score = 0;
            return { ...item, score };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);

        set({ results, isSearching: false, selectedIndex: results.length > 0 ? 0 : -1 });
      },

      clearResults: () => set({ results: [], query: '', selectedIndex: -1 }),
      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen, query: '', results: [], selectedIndex: -1 })),
      close: () => set({ isOpen: false, query: '', results: [], selectedIndex: -1 }),

      addRecentSearch: (query) => {
        set((state) => {
          const searches = [query, ...state.recentSearches.filter(s => s !== query)].slice(0, state.maxRecentSearches);
          return { recentSearches: searches };
        });
      },

      clearRecentSearches: () => set({ recentSearches: [] }),
      setSelectedIndex: (index) => set({ selectedIndex: index }),

      moveSelection: (direction) => {
        const { results, selectedIndex } = get();
        if (results.length === 0) return;
        const newIndex = direction === 'down'
          ? Math.min(selectedIndex + 1, results.length - 1)
          : Math.max(selectedIndex - 1, 0);
        set({ selectedIndex: newIndex });
      },

      getSelectedResult: () => {
        const { results, selectedIndex } = get();
        return results[selectedIndex];
      },
    }),
    { name: 'SearchStore' }
  )
);

// ============================================================
// Agent Store
// ============================================================
interface AgentInstance {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'busy' | 'offline' | 'error';
  currentTask: string | null;
  tasksCompleted: number;
  uptime: number;
  confidence: number;
  lastResponse: string;
  memoryUsage: number;
  responseTime: number;
}

interface AgentState {
  agents: AgentInstance[];
  selectedAgentId: string | null;
  isLoading: boolean;

  setAgents: (agents: AgentInstance[]) => void;
  selectAgent: (id: string | null) => void;
  updateAgent: (id: string, updates: Partial<AgentInstance>) => void;
  getAgent: (id: string) => AgentInstance | undefined;
  getActiveAgents: () => AgentInstance[];
  getBusyAgents: () => AgentInstance[];
}

export const useAgentStore = create<AgentState>()(
  devtools(
    (set, get) => ({
      agents: [
        { id: 'personal', name: 'Personal Agent', type: 'personal', status: 'active', currentTask: null, tasksCompleted: 342, uptime: 99.8, confidence: 94, lastResponse: 'Task list updated', memoryUsage: 128, responseTime: 45 },
        { id: 'security', name: 'Security Agent', type: 'security', status: 'active', currentTask: 'Network scan', tasksCompleted: 1205, uptime: 99.99, confidence: 97, lastResponse: 'All clear', memoryUsage: 256, responseTime: 12 },
        { id: 'home', name: 'Home Agent', type: 'home', status: 'idle', currentTask: null, tasksCompleted: 890, uptime: 99.5, confidence: 92, lastResponse: 'Lights adjusted', memoryUsage: 96, responseTime: 30 },
        { id: 'health', name: 'Health Agent', type: 'health', status: 'active', currentTask: null, tasksCompleted: 156, uptime: 99.7, confidence: 88, lastResponse: 'Vitals normal', memoryUsage: 64, responseTime: 55 },
        { id: 'finance', name: 'Financial Agent', type: 'financial', status: 'busy', currentTask: 'Report generation', tasksCompleted: 78, uptime: 99.6, confidence: 91, lastResponse: 'Budget updated', memoryUsage: 192, responseTime: 120 },
        { id: 'work', name: 'Work Agent', type: 'work', status: 'active', currentTask: null, tasksCompleted: 445, uptime: 99.3, confidence: 95, lastResponse: 'Meeting scheduled', memoryUsage: 112, responseTime: 38 },
        { id: 'learning', name: 'Learning Agent', type: 'learning', status: 'busy', currentTask: 'Model fine-tuning', tasksCompleted: 234, uptime: 98.9, confidence: 86, lastResponse: 'Training batch complete', memoryUsage: 512, responseTime: 200 },
        { id: 'orchestrator', name: 'Orchestrator', type: 'orchestrator', status: 'active', currentTask: null, tasksCompleted: 5670, uptime: 99.99, confidence: 99, lastResponse: 'Routing complete', memoryUsage: 64, responseTime: 5 },
      ],
      selectedAgentId: null,
      isLoading: false,

      setAgents: (agents) => set({ agents }),
      selectAgent: (id) => set({ selectedAgentId: id }),
      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map(a => a.id === id ? { ...a, ...updates } : a),
        }));
      },
      getAgent: (id) => get().agents.find(a => a.id === id),
      getActiveAgents: () => get().agents.filter(a => a.status === 'active'),
      getBusyAgents: () => get().agents.filter(a => a.status === 'busy'),
    }),
    { name: 'AgentStore' }
  )
);

// ============================================================
// Task Store (global task state)
// ============================================================
interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  dueDate: string;
  tags: string[];
  progress: number;
}

interface TaskState {
  tasks: Task[];
  filter: { status: string; priority: string; search: string };
  sortBy: 'dueDate' | 'priority' | 'status' | 'title';
  sortOrder: 'asc' | 'desc';

  addTask: (task: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setFilter: (filter: Partial<TaskState['filter']>) => void;
  setSort: (sortBy: TaskState['sortBy'], sortOrder: TaskState['sortOrder']) => void;
  getFiltered: () => Task[];
  getByStatus: (status: Task['status']) => Task[];
  getOverdue: () => Task[];
}

export const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      (set, get) => ({
        tasks: [
          { id: 't1', title: 'Implement voice recognition', status: 'in-progress', priority: 'high', assignedTo: 'Alex', dueDate: '2024-03-25', tags: ['voice', 'ai'], progress: 65 },
          { id: 't2', title: 'Setup ESP32 sensors', status: 'todo', priority: 'medium', assignedTo: 'David', dueDate: '2024-03-28', tags: ['iot', 'hardware'], progress: 0 },
          { id: 't3', title: 'Write API documentation', status: 'review', priority: 'medium', assignedTo: 'Sarah', dueDate: '2024-03-22', tags: ['docs'], progress: 90 },
          { id: 't4', title: 'Deploy ML model v2', status: 'done', priority: 'critical', assignedTo: 'Lisa', dueDate: '2024-03-20', tags: ['ml', 'deployment'], progress: 100 },
          { id: 't5', title: 'Fix WebSocket memory leak', status: 'in-progress', priority: 'critical', assignedTo: 'Alex', dueDate: '2024-03-21', tags: ['bug', 'websocket'], progress: 40 },
          { id: 't6', title: 'Add dark mode toggle', status: 'done', priority: 'low', assignedTo: 'Maria', dueDate: '2024-03-19', tags: ['ui', 'theme'], progress: 100 },
        ],
        filter: { status: '', priority: '', search: '' },
        sortBy: 'dueDate',
        sortOrder: 'asc',

        addTask: (task) => {
          const id = `t_${Date.now()}`;
          set((state) => ({ tasks: [...state.tasks, { ...task, id }] }));
        },

        updateTask: (id, updates) => {
          set((state) => ({
            tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
          }));
        },

        deleteTask: (id) => {
          set((state) => ({ tasks: state.tasks.filter(t => t.id !== id) }));
        },

        setFilter: (filter) => {
          set((state) => ({ filter: { ...state.filter, ...filter } }));
        },

        setSort: (sortBy, sortOrder) => set({ sortBy, sortOrder }),

        getFiltered: () => {
          const { tasks, filter, sortBy, sortOrder } = get();
          let result = [...tasks];
          if (filter.status) result = result.filter(t => t.status === filter.status);
          if (filter.priority) result = result.filter(t => t.priority === filter.priority);
          if (filter.search) {
            const q = filter.search.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q)));
          }
          result.sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortOrder === 'asc' ? cmp : -cmp;
          });
          return result;
        },

        getByStatus: (status) => get().tasks.filter(t => t.status === status),
        getOverdue: () => get().tasks.filter(t => t.status !== 'done' && new Date(t.dueDate) < new Date()),
      }),
      { name: 'nexus-tasks' }
    ),
    { name: 'TaskStore' }
  )
);
