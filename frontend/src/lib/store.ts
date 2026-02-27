/* ===================================================================
   Nexus AI OS — Zustand Global Store
   Sliced state with persist middleware
   =================================================================== */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Message,
  Conversation,
  Device,
  Sensor,
  Room,
  HealthMetric,
  MoodEntry,
  Transaction,
  Budget,
  FinancialGoal,
  Task,
  Project,
  Sprint,
  Notification,
  SystemResources,
  Agent,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  Slice: UI                                                          */
/* ------------------------------------------------------------------ */

interface UISlice {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: string;
  currentPage: string;
  commandPaletteOpen: boolean;
  helpOpen: boolean;
  modalStack: string[];

  toggleSidebar: () => void;
  collapseSidebar: (collapsed: boolean) => void;
  setTheme: (theme: string) => void;
  setCurrentPage: (page: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  pushModal: (id: string) => void;
  popModal: () => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: Chat                                                        */
/* ------------------------------------------------------------------ */

interface ChatSlice {
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;
  isTyping: boolean;
  typingAgent: string | null;
  inputDraft: string;

  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setConversations: (convos: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setTyping: (typing: boolean, agent?: string | null) => void;
  setInputDraft: (text: string) => void;
  clearChat: () => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: Home                                                        */
/* ------------------------------------------------------------------ */

interface HomeSlice {
  devices: Device[];
  sensors: Sensor[];
  rooms: Room[];
  selectedRoomId: string | null;

  setDevices: (devices: Device[]) => void;
  updateDevice: (id: string, patch: Partial<Device>) => void;
  setSensors: (sensors: Sensor[]) => void;
  setRooms: (rooms: Room[]) => void;
  setSelectedRoom: (id: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: Health                                                      */
/* ------------------------------------------------------------------ */

interface HealthSlice {
  moodEntries: MoodEntry[];
  metrics: HealthMetric[];
  currentMood: number | null;
  streakDays: number;

  addMoodEntry: (entry: MoodEntry) => void;
  setMetrics: (metrics: HealthMetric[]) => void;
  setCurrentMood: (mood: number | null) => void;
  setStreakDays: (days: number) => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: Finance                                                     */
/* ------------------------------------------------------------------ */

interface FinanceSlice {
  transactions: Transaction[];
  budgets: Budget[];
  goals: FinancialGoal[];
  selectedPeriod: string;

  setTransactions: (txns: Transaction[]) => void;
  addTransaction: (txn: Transaction) => void;
  setBudgets: (budgets: Budget[]) => void;
  setGoals: (goals: FinancialGoal[]) => void;
  setSelectedPeriod: (period: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: Tasks                                                       */
/* ------------------------------------------------------------------ */

interface TaskSlice {
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  activeProjectId: string | null;
  viewMode: 'list' | 'kanban' | 'calendar';

  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setProjects: (projects: Project[]) => void;
  setSprints: (sprints: Sprint[]) => void;
  setActiveProject: (id: string | null) => void;
  setViewMode: (mode: 'list' | 'kanban' | 'calendar') => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: System                                                      */
/* ------------------------------------------------------------------ */

interface SystemSlice {
  resources: SystemResources | null;
  notifications: Notification[];
  agents: Agent[];
  unreadCount: number;

  setResources: (res: SystemResources) => void;
  setNotifications: (notifs: Notification[]) => void;
  addNotification: (notif: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  setAgents: (agents: Agent[]) => void;
}

/* ------------------------------------------------------------------ */
/*  Slice: Voice                                                       */
/* ------------------------------------------------------------------ */

interface VoiceSlice {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  confidence: number;
  voiceEnabled: boolean;
  wakeWordActive: boolean;

  setListening: (active: boolean) => void;
  setSpeaking: (active: boolean) => void;
  setTranscript: (text: string, confidence?: number) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setWakeWordActive: (active: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Combined Store                                                     */
/* ------------------------------------------------------------------ */

type NexusStore =
  UISlice & ChatSlice & HomeSlice & HealthSlice &
  FinanceSlice & TaskSlice & SystemSlice & VoiceSlice;

export const useStore = create<NexusStore>()(
  persist(
    (set) => ({
      /* ---- UI ---- */
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: 'dark',
      currentPage: '/',
      commandPaletteOpen: false,
      helpOpen: false,
      modalStack: [],

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      collapseSidebar: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
      setCurrentPage: (page) => set({ currentPage: page }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      openHelp: () => set({ helpOpen: true }),
      closeHelp: () => set({ helpOpen: false }),
      pushModal: (id) => set((s) => ({ modalStack: [...s.modalStack, id] })),
      popModal: () => set((s) => ({ modalStack: s.modalStack.slice(0, -1) })),

      /* ---- Chat ---- */
      messages: [],
      conversations: [],
      activeConversationId: null,
      isTyping: false,
      typingAgent: null,
      inputDraft: '',

      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      setMessages: (messages) => set({ messages }),
      setConversations: (conversations) => set({ conversations }),
      setActiveConversation: (id) => set({ activeConversationId: id }),
      setTyping: (typing, agent = null) => set({ isTyping: typing, typingAgent: agent }),
      setInputDraft: (text) => set({ inputDraft: text }),
      clearChat: () => set({ messages: [], activeConversationId: null, inputDraft: '' }),

      /* ---- Home ---- */
      devices: [],
      sensors: [],
      rooms: [],
      selectedRoomId: null,

      setDevices: (devices) => set({ devices }),
      updateDevice: (id, patch) =>
        set((s) => ({
          devices: s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      setSensors: (sensors) => set({ sensors }),
      setRooms: (rooms) => set({ rooms }),
      setSelectedRoom: (id) => set({ selectedRoomId: id }),

      /* ---- Health ---- */
      moodEntries: [],
      metrics: [],
      currentMood: null,
      streakDays: 0,

      addMoodEntry: (entry) => set((s) => ({ moodEntries: [entry, ...s.moodEntries] })),
      setMetrics: (metrics) => set({ metrics }),
      setCurrentMood: (mood) => set({ currentMood: mood }),
      setStreakDays: (days) => set({ streakDays: days }),

      /* ---- Finance ---- */
      transactions: [],
      budgets: [],
      goals: [],
      selectedPeriod: 'monthly',

      setTransactions: (transactions) => set({ transactions }),
      addTransaction: (txn) => set((s) => ({ transactions: [txn, ...s.transactions] })),
      setBudgets: (budgets) => set({ budgets }),
      setGoals: (goals) => set({ goals }),
      setSelectedPeriod: (period) => set({ selectedPeriod: period }),

      /* ---- Tasks ---- */
      tasks: [],
      projects: [],
      sprints: [],
      activeProjectId: null,
      viewMode: 'kanban',

      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      setProjects: (projects) => set({ projects }),
      setSprints: (sprints) => set({ sprints }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setViewMode: (mode) => set({ viewMode: mode }),

      /* ---- System ---- */
      resources: null,
      notifications: [],
      agents: [],
      unreadCount: 0,

      setResources: (resources) => set({ resources }),
      setNotifications: (notifications) =>
        set({ notifications, unreadCount: notifications.filter((n) => !n.read).length }),
      addNotification: (notif) =>
        set((s) => ({
          notifications: [notif, ...s.notifications],
          unreadCount: s.unreadCount + 1,
        })),
      markRead: (id) =>
        set((s) => {
          const notifications = s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          );
          return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
        }),
      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      dismissNotification: (id) =>
        set((s) => {
          const notifications = s.notifications.filter((n) => n.id !== id);
          return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
        }),
      setAgents: (agents) => set({ agents }),

      /* ---- Voice ---- */
      isListening: false,
      isSpeaking: false,
      transcript: '',
      confidence: 0,
      voiceEnabled: true,
      wakeWordActive: false,

      setListening: (active) => set({ isListening: active }),
      setSpeaking: (active) => set({ isSpeaking: active }),
      setTranscript: (text, confidence = 0) => set({ transcript: text, confidence }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setWakeWordActive: (active) => set({ wakeWordActive: active }),
    }),
    {
      name: 'nexus-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these slices
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        viewMode: state.viewMode,
        selectedPeriod: state.selectedPeriod,
        voiceEnabled: state.voiceEnabled,
      }),
    },
  ),
);

export default useStore;
