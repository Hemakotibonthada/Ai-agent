/* ===================================================================
   Nexus AI OS — Mobile API Client
   Axios-based with auto-discover / configurable base URL
   =================================================================== */

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ------------------------------------------------------------------ */
/*  Storage keys                                                       */
/* ------------------------------------------------------------------ */
const STORAGE_KEY_BASE_URL = '@nexus/base_url';
const STORAGE_KEY_TOKEN = '@nexus/auth_token';
const DEFAULT_BASE_URL = 'http://10.0.2.2:8000/api'; // Android emulator → host
const IOS_DEFAULT = 'http://localhost:8000/api';

/* ------------------------------------------------------------------ */
/*  Create Axios instance                                              */
/* ------------------------------------------------------------------ */
let baseURL = DEFAULT_BASE_URL;

const api: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/* ---- Initialise base URL from storage ---- */
export async function initApiBaseUrl(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY_BASE_URL);
  if (stored) {
    api.defaults.baseURL = stored;
  }
}

export async function setApiBaseUrl(url: string): Promise<void> {
  api.defaults.baseURL = url;
  await AsyncStorage.setItem(STORAGE_KEY_BASE_URL, url);
}

export async function getApiBaseUrl(): Promise<string> {
  return (await AsyncStorage.getItem(STORAGE_KEY_BASE_URL)) ?? DEFAULT_BASE_URL;
}

/* ---- Request interceptor — attach token ---- */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* ---- Response interceptor ---- */
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status;
    if (status === 401) {
      await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    return Promise.reject(error);
  },
);

/* ------------------------------------------------------------------ */
/*  Chat                                                               */
/* ------------------------------------------------------------------ */
export const chatApi = {
  send: (data: { message: string; conversation_id?: string; agent?: string }) =>
    api.post('/chat/message', data).then((r) => r.data),
  history: (conversationId: string, limit = 50, offset = 0) =>
    api.get(`/chat/history/${conversationId}`, { params: { limit, offset } }).then((r) => r.data),
  conversations: () =>
    api.get('/chat/conversations').then((r) => r.data),
  deleteConversation: (id: string) =>
    api.delete(`/chat/conversations/${id}`).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Agents                                                             */
/* ------------------------------------------------------------------ */
export const agentsApi = {
  list: () => api.get('/agents').then((r) => r.data),
  health: () => api.get('/agents/health').then((r) => r.data),
  status: (name: string) => api.get(`/agents/${name}/status`).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Home Automation                                                    */
/* ------------------------------------------------------------------ */
export const homeApi = {
  devices: (roomId?: string) =>
    api.get('/home/devices', { params: roomId ? { room_id: roomId } : {} }).then((r) => r.data),
  controlDevice: (data: { device_id: string; action: string; params?: Record<string, unknown> }) =>
    api.post('/home/devices/control', data).then((r) => r.data),
  sensors: (roomId?: string) =>
    api.get('/home/sensors', { params: roomId ? { room_id: roomId } : {} }).then((r) => r.data),
  energy: (period?: string) =>
    api.get('/home/energy', { params: period ? { period } : {} }).then((r) => r.data),
  rooms: () => api.get('/home/rooms').then((r) => r.data),
  dashboard: () => api.get('/home/dashboard').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Health & Wellness                                                  */
/* ------------------------------------------------------------------ */
export const healthApi = {
  logMood: (data: { mood: number; note?: string }) =>
    api.post('/health/mood', data).then((r) => r.data),
  logExercise: (data: { type: string; duration: number; calories?: number }) =>
    api.post('/health/exercise', data).then((r) => r.data),
  logSleep: (data: { hours: number; quality?: number }) =>
    api.post('/health/sleep', data).then((r) => r.data),
  summary: (period?: string) =>
    api.get('/health/summary', { params: period ? { period } : {} }).then((r) => r.data),
  trends: (metric?: string, days?: number) =>
    api.get('/health/trends', { params: { metric, days } }).then((r) => r.data),
  dashboard: () => api.get('/health/dashboard').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Tasks                                                              */
/* ------------------------------------------------------------------ */
export const tasksApi = {
  list: (status?: string, priority?: string) =>
    api.get('/tasks', { params: { status, priority } }).then((r) => r.data),
  create: (data: { title: string; description?: string; priority?: string }) =>
    api.post('/tasks', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/tasks/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/tasks/${id}`).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  System                                                             */
/* ------------------------------------------------------------------ */
export const systemApi = {
  info: () => api.get('/system/info').then((r) => r.data),
  resources: () => api.get('/system/resources').then((r) => r.data),
  healthCheck: () => api.get('/system/health').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Voice                                                              */
/* ------------------------------------------------------------------ */
export const voiceApi = {
  processCommand: (text: string) =>
    api.post('/voice/command', { text }).then((r) => r.data),
  settings: () => api.get('/voice/settings').then((r) => r.data),
};

export default api;
