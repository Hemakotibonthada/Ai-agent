/* ===================================================================
   Nexus AI OS — Axios API Client
   Typed functions for every backend endpoint
   =================================================================== */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import type {
  Agent,
  ApiResponse,
  Budget,
  ChatRequest,
  ChatResponse,
  Conversation,
  CreateBudgetRequest,
  CreateTaskRequest,
  Device,
  DeviceControlRequest,
  EnergyUsage,
  ExerciseLogRequest,
  FinancialSummary,
  GenerateReportRequest,
  HealthSummary,
  HealthTrend,
  KanbanBoard,
  Message,
  MoodLogRequest,
  Report,
  ReportTemplate,
  Room,
  SceneCreateRequest,
  Scene,
  Sensor,
  SleepLogRequest,
  SystemInfo,
  SystemResources,
  Task,
  TransactionRequest,
  Transaction,
  UpdateTaskRequest,
  VoiceSettings,
  FinancialGoal,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  Base Axios instance                                                */
/* ------------------------------------------------------------------ */

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

/* ---- Request interceptor ---- */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('nexus_token');
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
  (error: AxiosError<{ detail?: string }>) => {
    const message = error.response?.data?.detail ?? error.message ?? 'An error occurred';
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem('nexus_token');
      toast.error('Session expired — please log in again');
    } else if (status === 429) {
      toast.error('Rate limited — slow down a bit');
    } else if (status && status >= 500) {
      toast.error("Server error — we're looking into it");
    }

    console.error(`[Nexus API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status}: ${message}`);
    return Promise.reject(error);
  },
);

/* ------------------------------------------------------------------ */
/*  Chat                                                               */
/* ------------------------------------------------------------------ */

export const chatApi = {
  send: (data: ChatRequest) =>
    api.post<ChatResponse>('/chat/message', data).then((r) => r.data),

  history: (conversationId: string, limit = 50, offset = 0) =>
    api.get<Message[]>(`/chat/history/${conversationId}`, { params: { limit, offset } }).then((r) => r.data),

  conversations: () =>
    api.get<Conversation[]>('/chat/conversations').then((r) => r.data),

  deleteConversation: (id: string) =>
    api.delete(`/chat/conversations/${id}`).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Agents                                                             */
/* ------------------------------------------------------------------ */

export const agentsApi = {
  list: () =>
    api.get<{ total: number; agents: Agent[] }>('/agents').then((r) => r.data.agents ?? r.data),

  health: () =>
    api.get<ApiResponse>('/agents/health').then((r) => r.data),

  status: (name: string) =>
    api.get<Agent>(`/agents/${name}/status`).then((r) => r.data),

  action: (name: string, action: string, params?: Record<string, unknown>) =>
    api.post(`/agents/${name}/action`, { action, params }).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Home Automation                                                    */
/* ------------------------------------------------------------------ */

export const homeApi = {
  devices: (roomId?: string) =>
    api.get<Device[]>('/home/devices', { params: roomId ? { room_id: roomId } : {} }).then((r) => r.data),

  controlDevice: (data: DeviceControlRequest) =>
    api.post('/home/devices/control', data).then((r) => r.data),

  sensors: (roomId?: string) =>
    api.get<Sensor[]>('/home/sensors', { params: roomId ? { room_id: roomId } : {} }).then((r) => r.data),

  energy: (period?: string) =>
    api.get<EnergyUsage>('/home/energy', { params: period ? { period } : {} }).then((r) => r.data),

  rooms: () =>
    api.get<Room[]>('/home/rooms').then((r) => r.data),

  createScene: (data: SceneCreateRequest) =>
    api.post<Scene>('/home/scenes', data).then((r) => r.data),

  dashboard: () =>
    api.get('/home/dashboard').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Health & Wellness                                                  */
/* ------------------------------------------------------------------ */

export const healthApi = {
  logMood: (data: MoodLogRequest) =>
    api.post('/health/mood', data).then((r) => r.data),

  logExercise: (data: ExerciseLogRequest) =>
    api.post('/health/exercise', data).then((r) => r.data),

  logSleep: (data: SleepLogRequest) =>
    api.post('/health/sleep', data).then((r) => r.data),

  summary: (period?: string) =>
    api.get<HealthSummary>('/health/summary', { params: period ? { period } : {} }).then((r) => r.data),

  trends: (metric?: string, days?: number) =>
    api.get<HealthTrend[]>('/health/trends', { params: { metric, days } }).then((r) => r.data),

  dashboard: () =>
    api.get('/health/dashboard').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Finance                                                            */
/* ------------------------------------------------------------------ */

export const financeApi = {
  addTransaction: (data: TransactionRequest) =>
    api.post<Transaction>('/finance/transactions', data).then((r) => r.data),

  summary: (period?: string) =>
    api.get<FinancialSummary>('/finance/summary', { params: period ? { period } : {} }).then((r) => r.data),

  budget: (period?: string) =>
    api.get<Budget[]>('/finance/budget', { params: period ? { period } : {} }).then((r) => r.data),

  createBudget: (data: CreateBudgetRequest) =>
    api.post<Budget>('/finance/budget', data).then((r) => r.data),

  goals: () =>
    api.get<FinancialGoal[]>('/finance/goals').then((r) => r.data),

  dashboard: () =>
    api.get('/finance/dashboard').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Tasks                                                              */
/* ------------------------------------------------------------------ */

export const tasksApi = {
  create: (data: CreateTaskRequest) =>
    api.post<Task>('/tasks', data).then((r) => r.data),

  list: (status?: string, priority?: string) =>
    api.get<Task[]>('/tasks', { params: { status, priority } }).then((r) => r.data),

  update: (id: string, data: UpdateTaskRequest) =>
    api.put<Task>(`/tasks/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    api.delete(`/tasks/${id}`).then((r) => r.data),

  kanban: () =>
    api.get<KanbanBoard>('/tasks/kanban').then((r) => r.data),

  productivity: (period?: string) =>
    api.get('/tasks/productivity', { params: period ? { period } : {} }).then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  System                                                             */
/* ------------------------------------------------------------------ */

export const systemApi = {
  info: () =>
    api.get<SystemInfo>('/system/info').then((r) => r.data),

  resources: () =>
    api.get<SystemResources>('/system/resources').then((r) => r.data),

  logs: (level?: string, limit?: number) =>
    api.get('/system/logs', { params: { level, limit } }).then((r) => r.data),

  updateSettings: (settings: Record<string, unknown>) =>
    api.put('/system/settings', settings).then((r) => r.data),

  healthCheck: () =>
    api.get('/system/health').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Voice                                                              */
/* ------------------------------------------------------------------ */

export const voiceApi = {
  speechToText: (audio: Blob) => {
    const form = new FormData();
    form.append('audio', audio, 'recording.webm');
    return api.post<{ text: string }>('/voice/stt', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  textToSpeech: (text: string, voiceId?: string) =>
    api.post('/voice/tts', { text, voice_id: voiceId }, { responseType: 'blob' }).then((r) => r.data as Blob),

  processCommand: (text: string) =>
    api.post('/voice/command', { text }).then((r) => r.data),

  settings: () =>
    api.get<VoiceSettings>('/voice/settings').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */

export const reportsApi = {
  generate: (data: GenerateReportRequest) =>
    api.post<Report>('/reports/generate', data).then((r) => r.data),

  list: (type?: string) =>
    api.get<Report[]>('/reports', { params: type ? { type } : {} }).then((r) => r.data),

  download: (id: string) =>
    api.get(`/reports/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),

  templates: () =>
    api.get<ReportTemplate[]>('/reports/templates').then((r) => r.data),
};

/* ------------------------------------------------------------------ */
/*  Default export                                                     */
/* ------------------------------------------------------------------ */

export default api;
