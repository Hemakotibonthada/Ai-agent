/**
 * Utility functions - cn, formatters, validators, helpers
 */
import { type ClassValue, clsx } from 'clsx';

/* ── Class Name Merger ──────────────────────────────────────────────── */
export function cn(...inputs: ClassValue[]): string {
  // Simple implementation without tailwind-merge (avoids extra dependency)
  return clsx(inputs);
}

/* ── Date Formatters ────────────────────────────────────────────────── */
export function formatDate(date: Date | string | number, format: 'short' | 'long' | 'relative' | 'time' | 'datetime' = 'short'): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'long':
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    case 'time':
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    case 'datetime':
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    case 'relative':
      return getRelativeTime(d);
    default:
      return d.toISOString();
  }
}

export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

/* ── Number Formatters ──────────────────────────────────────────────── */
export function formatNumber(num: number, options?: { decimals?: number; compact?: boolean; currency?: string; percent?: boolean }): string {
  if (options?.currency) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: options.currency, minimumFractionDigits: options.decimals ?? 2 }).format(num);
  }
  if (options?.percent) {
    return `${(num * 100).toFixed(options.decimals ?? 1)}%`;
  }
  if (options?.compact) {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(options.decimals ?? 0);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: options?.decimals ?? 2 }).format(num);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/* ── String Helpers ─────────────────────────────────────────────────── */
export function truncate(str: string, length: number, suffix = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function titleCase(str: string): string {
  return str.replace(/([_-])/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function generateId(prefix = ''): string {
  const id = Math.random().toString(36).substring(2, 11);
  return prefix ? `${prefix}-${id}` : id;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? singular + 's')}`;
}

/* ── Color Helpers ──────────────────────────────────────────────────── */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'text-emerald-400',
    online: 'text-emerald-400',
    success: 'text-emerald-400',
    healthy: 'text-emerald-400',
    running: 'text-emerald-400',
    warning: 'text-amber-400',
    degraded: 'text-amber-400',
    pending: 'text-amber-400',
    error: 'text-red-400',
    offline: 'text-red-400',
    failed: 'text-red-400',
    critical: 'text-red-400',
    idle: 'text-blue-400',
    inactive: 'text-white/40',
    disabled: 'text-white/30',
  };
  return colors[status.toLowerCase()] ?? 'text-white/50';
}

export function getStatusBgColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/20',
    online: 'bg-emerald-500/20',
    success: 'bg-emerald-500/20',
    healthy: 'bg-emerald-500/20',
    running: 'bg-emerald-500/20',
    warning: 'bg-amber-500/20',
    degraded: 'bg-amber-500/20',
    pending: 'bg-amber-500/20',
    error: 'bg-red-500/20',
    offline: 'bg-red-500/20',
    failed: 'bg-red-500/20',
    critical: 'bg-red-500/20',
    idle: 'bg-blue-500/20',
    inactive: 'bg-white/5',
    disabled: 'bg-white/5',
  };
  return colors[status.toLowerCase()] ?? 'bg-white/5';
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ── Array Helpers ──────────────────────────────────────────────────── */
export function groupBy<T>(arr: T[], key: keyof T | ((item: T) => string)): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(arr: T[], key: keyof T | ((item: T) => any), direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const aVal = typeof key === 'function' ? key(a) : a[key];
    const bVal = typeof key === 'function' ? key(b) : b[key];
    const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal));
    return direction === 'desc' ? -cmp : cmp;
  });
}

export function uniqueBy<T>(arr: T[], key: keyof T | ((item: T) => any)): T[] {
  const seen = new Set();
  return arr.filter((item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
}

export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) result.push(i);
  return result;
}

/* ── Object Helpers ─────────────────────────────────────────────────── */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  const result = { ...target };
  for (const source of sources) {
    for (const key in source) {
      const val = source[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        result[key] = deepMerge(result[key] as any ?? {}, val as any);
      } else {
        (result as any)[key] = val;
      }
    }
  }
  return result;
}

export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => {
    if (key in obj) acc[key] = obj[key];
    return acc;
  }, {} as Pick<T, K>);
}

export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

/* ── Debounce & Throttle ────────────────────────────────────────────── */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const debounced = (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced as any;
}

export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let lastTime = 0;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastTime >= ms) {
      lastTime = now;
      fn(...args);
    }
  }) as T;
}

/* ── Storage Helpers ────────────────────────────────────────────────── */
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setToStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to remove from localStorage:', e);
  }
}

/* ── URL Helpers ─────────────────────────────────────────────────────── */
export function buildUrl(base: string, params: Record<string, any>): string {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      url.searchParams.set(key, String(val));
    }
  });
  return url.toString();
}

export function parseQueryParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((val, key) => { result[key] = val; });
  return result;
}

/* ── Clipboard ──────────────────────────────────────────────────────── */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  }
}

/* ── Download Helpers ───────────────────────────────────────────────── */
export function downloadFile(content: string, filename: string, type = 'text/plain'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: any, filename: string): void {
  downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
}

export function downloadCsv(data: Record<string, any>[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => {
    const val = row[h];
    return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
  }).join(','));
  downloadFile([headers.join(','), ...rows].join('\n'), filename, 'text/csv');
}

/* ── Validation Helpers ─────────────────────────────────────────────── */
export function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export function isUrl(str: string): boolean {
  try { new URL(str); return true; } catch { return false; }
}

export function isStrongPassword(password: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (password.length < 8) issues.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('At least one special character');
  return { valid: issues.length === 0, issues };
}

/* ── Math Helpers ───────────────────────────────────────────────────── */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function average(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

export function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function standardDeviation(nums: number[]): number {
  const avg = average(nums);
  const squareDiffs = nums.map((n) => Math.pow(n - avg, 2));
  return Math.sqrt(average(squareDiffs));
}
