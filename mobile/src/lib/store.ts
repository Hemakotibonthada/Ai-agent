/* ===================================================================
   Nexus AI OS — Mobile Zustand Store
   Sliced state with AsyncStorage persistence
   =================================================================== */

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------------------------------------------ */
/*  AsyncStorage adapter for Zustand                                   */
/* ------------------------------------------------------------------ */
const asyncStorageAdapter: StateStorage = {
  getItem: async (name) => await AsyncStorage.getItem(name),
  setItem: async (name, value) => await AsyncStorage.setItem(name, value),
  removeItem: async (name) => await AsyncStorage.removeItem(name),
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agent?: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  room_id: string;
  status: 'online' | 'offline' | 'error';
  is_on: boolean;
  state: Record<string, unknown>;
  battery_level?: number;
}

export interface Sensor {
  id: string;
  name: string;
  type: string;
  room_id: string;
  value: number;
  unit: string;
  last_updated: string;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  device_count: number;
  temperature?: number;
  humidity?: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Store interface                                                     */
/* ------------------------------------------------------------------ */
interface NexusMobileStore {
  /* UI */
  theme: 'dark' | 'light';
  currentTab: string;
  setTheme: (theme: 'dark' | 'light') => void;
  setCurrentTab: (tab: string) => void;

  /* Chat */
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

  /* Home */
  devices: Device[];
  sensors: Sensor[];
  rooms: Room[];
  selectedRoomId: string | null;
  setDevices: (devices: Device[]) => void;
  updateDevice: (id: string, patch: Partial<Device>) => void;
  setSensors: (sensors: Sensor[]) => void;
  setRooms: (rooms: Room[]) => void;
  setSelectedRoom: (id: string | null) => void;

  /* Notifications */
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifs: Notification[]) => void;
  addNotification: (notif: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;

  /* Settings */
  serverUrl: string;
  notificationsEnabled: boolean;
  voiceEnabled: boolean;
  setServerUrl: (url: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;

  /* Hydration helper */
  _hydrated: boolean;
  loadPersistedState: () => void;
}

/* ------------------------------------------------------------------ */
/*  Store creation                                                     */
/* ------------------------------------------------------------------ */
export const useStore = create<NexusMobileStore>()(
  persist(
    (set) => ({
      /* ---- UI ---- */
      theme: 'dark',
      currentTab: 'Dashboard',
      setTheme: (theme) => set({ theme }),
      setCurrentTab: (tab) => set({ currentTab: tab }),

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

      /* ---- Notifications ---- */
      notifications: [],
      unreadCount: 0,
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

      /* ---- Settings ---- */
      serverUrl: 'http://localhost:8000',
      notificationsEnabled: true,
      voiceEnabled: true,
      setServerUrl: (url) => set({ serverUrl: url }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),

      /* ---- Hydration ---- */
      _hydrated: false,
      loadPersistedState: () => set({ _hydrated: true }),
    }),
    {
      name: 'nexus-mobile-store',
      storage: createJSONStorage(() => asyncStorageAdapter),
      partialize: (state) => ({
        theme: state.theme,
        serverUrl: state.serverUrl,
        notificationsEnabled: state.notificationsEnabled,
        voiceEnabled: state.voiceEnabled,
      }),
    },
  ),
);

export default useStore;
