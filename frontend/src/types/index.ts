/* ===================================================================
   Nexus AI OS — TypeScript Types & Interfaces
   =================================================================== */

/* ------------------------------------------------------------------ */
/*  Chat & Messaging                                                   */
/* ------------------------------------------------------------------ */
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  agent?: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  url: string;
  size: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
  agents_used: string[];
  pinned: boolean;
}

/* ------------------------------------------------------------------ */
/*  Agents                                                             */
/* ------------------------------------------------------------------ */
export type AgentStatus = 'active' | 'idle' | 'error' | 'disabled';

export interface Agent {
  name: string;
  display_name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  icon: string;
  tasks_completed: number;
  uptime_seconds: number;
  error_rate: number;
}

/* ------------------------------------------------------------------ */
/*  Home Automation                                                    */
/* ------------------------------------------------------------------ */
export type DeviceType = 'light' | 'switch' | 'thermostat' | 'lock' | 'camera' | 'sensor' | 'speaker' | 'blind';
export type DeviceStatus = 'online' | 'offline' | 'error';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  room_id: string;
  status: DeviceStatus;
  state: Record<string, unknown>;
  is_on: boolean;
  last_seen: string;
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
  min_value?: number;
  max_value?: number;
  history: SensorReading[];
}

export interface SensorReading {
  timestamp: string;
  value: number;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  device_count: number;
  temperature?: number;
  humidity?: number;
  devices: Device[];
}

export interface Scene {
  id: string;
  name: string;
  icon: string;
  actions: SceneAction[];
  is_active: boolean;
}

export interface SceneAction {
  device_id: string;
  action: string;
  params: Record<string, unknown>;
}

export interface EnergyUsage {
  current_watts: number;
  daily_kwh: number;
  monthly_kwh: number;
  cost_estimate: number;
  history: { timestamp: string; watts: number }[];
}

/* ------------------------------------------------------------------ */
/*  Health & Wellness                                                   */
/* ------------------------------------------------------------------ */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface HealthMetric {
  id: string;
  type: 'mood' | 'exercise' | 'sleep' | 'heart_rate' | 'weight' | 'steps';
  value: number;
  unit: string;
  timestamp: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface MoodEntry {
  id: string;
  level: MoodLevel;
  notes: string;
  tags: string[];
  timestamp: string;
}

export interface ExerciseEntry {
  id: string;
  type: string;
  duration_minutes: number;
  calories_burned: number;
  intensity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface SleepEntry {
  id: string;
  duration_hours: number;
  quality: number;
  deep_sleep_hours: number;
  rem_sleep_hours: number;
  date: string;
}

export interface HealthSummary {
  mood_avg: number;
  exercise_minutes_week: number;
  sleep_avg_hours: number;
  trends: HealthTrend[];
  recommendations: string[];
}

export interface HealthTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change_percent: number;
  period: string;
}

/* ------------------------------------------------------------------ */
/*  Finance                                                            */
/* ------------------------------------------------------------------ */
export type TransactionType = 'income' | 'expense' | 'transfer' | 'investment';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  description: string;
  date: string;
  account?: string;
  tags: string[];
  recurring: boolean;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  progress_percent: number;
}

export interface FinancialSummary {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  top_categories: { category: string; amount: number }[];
  budgets: Budget[];
  goals: FinancialGoal[];
}

/* ------------------------------------------------------------------ */
/*  Tasks & Projects                                                   */
/* ------------------------------------------------------------------ */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  project_id?: string;
  sprint_id?: string;
  assignee?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  task_count: number;
  completed_count: number;
  progress_percent: number;
  created_at: string;
}

export interface Sprint {
  id: string;
  name: string;
  project_id: string;
  start_date: string;
  end_date: string;
  tasks: Task[];
  velocity: number;
}

export interface KanbanBoard {
  columns: { status: TaskStatus; tasks: Task[] }[];
}

/* ------------------------------------------------------------------ */
/*  System                                                             */
/* ------------------------------------------------------------------ */
export interface SystemInfo {
  version: string;
  uptime_seconds: number;
  agents_active: number;
  agents_total: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  python_version: string;
  platform: string;
}

export interface SystemResources {
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
    speed_mbps?: number;
  };
  network_speed_mbps: number;
  network_speed_percent: number;
  network_link_speed_mbps: number;
  network_sent_mb?: number;
  network_recv_mb?: number;
  gpu_percent?: number;
  process_count?: number;
  timestamp?: string;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  action_url?: string;
  agent?: string;
}

/* ------------------------------------------------------------------ */
/*  Voice                                                              */
/* ------------------------------------------------------------------ */
export interface VoiceSettings {
  voice_id: string;
  language: string;
  speed: number;
  pitch: number;
  enabled: boolean;
  wake_word: string;
  available_voices: { id: string; name: string; lang: string }[];
}

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */
export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportFormat = 'pdf' | 'html' | 'json' | 'markdown';

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  format: ReportFormat;
  created_at: string;
  sections: string[];
  download_url?: string;
  size_bytes?: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
  default_format: ReportFormat;
}

/* ------------------------------------------------------------------ */
/*  User Profile                                                       */
/* ------------------------------------------------------------------ */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  timezone: string;
  language: string;
  preferences: Record<string, unknown>;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  API Request / Response types                                       */
/* ------------------------------------------------------------------ */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  agent?: string;
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  message: Message;
  conversation_id: string;
  agent_used: string;
  processing_time_ms: number;
}

export interface DeviceControlRequest {
  device_id: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  project_id?: string;
  tags?: string[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  tags?: string[];
}

export interface CreateBudgetRequest {
  name: string;
  category: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
}

export interface GenerateReportRequest {
  type: ReportType;
  format: ReportFormat;
  sections: string[];
  date_range?: { start: string; end: string };
}

export interface MoodLogRequest {
  level: MoodLevel;
  notes?: string;
  tags?: string[];
}

export interface ExerciseLogRequest {
  type: string;
  duration_minutes: number;
  calories_burned?: number;
  intensity?: 'low' | 'medium' | 'high';
}

export interface SleepLogRequest {
  duration_hours: number;
  quality: number;
  deep_sleep_hours?: number;
  rem_sleep_hours?: number;
  date: string;
}

export interface TransactionRequest {
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date?: string;
  tags?: string[];
}

export interface SceneCreateRequest {
  name: string;
  icon?: string;
  actions: SceneAction[];
}
