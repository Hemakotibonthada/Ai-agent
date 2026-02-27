/**
 * Form validation utilities for Nexus AI
 * Comprehensive validation library with composable validators
 */

// ============================================================
// Types
// ============================================================
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type Validator<T = any> = (value: T) => ValidationResult;

export type ValidationRules<T> = {
  [K in keyof T]?: Validator<T[K]>[];
};

export interface FormErrors<T> {
  [K: string]: string[];
}

// ============================================================
// Core Validators
// ============================================================

export function required(message = 'This field is required'): Validator<any> {
  return (value) => {
    const valid = value !== null && value !== undefined && String(value).trim().length > 0;
    return { valid, errors: valid ? [] : [message] };
  };
}

export function minLength(min: number, message?: string): Validator<string> {
  return (value) => {
    const valid = String(value || '').length >= min;
    return { valid, errors: valid ? [] : [message || `Must be at least ${min} characters`] };
  };
}

export function maxLength(max: number, message?: string): Validator<string> {
  return (value) => {
    const valid = String(value || '').length <= max;
    return { valid, errors: valid ? [] : [message || `Must be at most ${max} characters`] };
  };
}

export function minValue(min: number, message?: string): Validator<number> {
  return (value) => {
    const valid = Number(value) >= min;
    return { valid, errors: valid ? [] : [message || `Must be at least ${min}`] };
  };
}

export function maxValue(max: number, message?: string): Validator<number> {
  return (value) => {
    const valid = Number(value) <= max;
    return { valid, errors: valid ? [] : [message || `Must be at most ${max}`] };
  };
}

export function pattern(regex: RegExp, message = 'Invalid format'): Validator<string> {
  return (value) => {
    const valid = regex.test(String(value || ''));
    return { valid, errors: valid ? [] : [message] };
  };
}

export function email(message = 'Invalid email address'): Validator<string> {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern(emailRegex, message);
}

export function url(message = 'Invalid URL'): Validator<string> {
  const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
  return pattern(urlRegex, message);
}

export function numeric(message = 'Must be a number'): Validator<any> {
  return (value) => {
    const valid = !isNaN(Number(value)) && value !== '' && value !== null;
    return { valid, errors: valid ? [] : [message] };
  };
}

export function integer(message = 'Must be a whole number'): Validator<any> {
  return (value) => {
    const valid = Number.isInteger(Number(value));
    return { valid, errors: valid ? [] : [message] };
  };
}

export function alphanumeric(message = 'Must contain only letters and numbers'): Validator<string> {
  return pattern(/^[a-zA-Z0-9]+$/, message);
}

export function slug(message = 'Must be a valid slug (lowercase, hyphens, numbers)'): Validator<string> {
  return pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/, message);
}

export function ip(message = 'Invalid IP address'): Validator<string> {
  return pattern(
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    message
  );
}

export function hex(message = 'Invalid hex value'): Validator<string> {
  return pattern(/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, message);
}

export function strongPassword(message?: string): Validator<string> {
  return (value) => {
    const str = String(value || '');
    const errors: string[] = [];
    if (str.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(str)) errors.push('At least one uppercase letter');
    if (!/[a-z]/.test(str)) errors.push('At least one lowercase letter');
    if (!/[0-9]/.test(str)) errors.push('At least one number');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(str)) errors.push('At least one special character');
    return { valid: errors.length === 0, errors: message ? (errors.length > 0 ? [message] : []) : errors };
  };
}

export function oneOf<T>(options: T[], message?: string): Validator<T> {
  return (value) => {
    const valid = options.includes(value);
    return { valid, errors: valid ? [] : [message || `Must be one of: ${options.join(', ')}`] };
  };
}

export function matches(fieldName: string, formValues: () => Record<string, any>, message?: string): Validator<any> {
  return (value) => {
    const valid = value === formValues()[fieldName];
    return { valid, errors: valid ? [] : [message || `Must match ${fieldName}`] };
  };
}

export function arrayMinLength(min: number, message?: string): Validator<any[]> {
  return (value) => {
    const valid = Array.isArray(value) && value.length >= min;
    return { valid, errors: valid ? [] : [message || `Must have at least ${min} items`] };
  };
}

export function arrayMaxLength(max: number, message?: string): Validator<any[]> {
  return (value) => {
    const valid = Array.isArray(value) && value.length <= max;
    return { valid, errors: valid ? [] : [message || `Must have at most ${max} items`] };
  };
}

export function json(message = 'Invalid JSON'): Validator<string> {
  return (value) => {
    try {
      JSON.parse(String(value));
      return { valid: true, errors: [] };
    } catch {
      return { valid: false, errors: [message] };
    }
  };
}

export function dateAfter(date: Date | string, message?: string): Validator<string | Date> {
  return (value) => {
    const d = new Date(value);
    const min = new Date(date);
    const valid = d > min;
    return { valid, errors: valid ? [] : [message || `Must be after ${min.toLocaleDateString()}`] };
  };
}

export function dateBefore(date: Date | string, message?: string): Validator<string | Date> {
  return (value) => {
    const d = new Date(value);
    const max = new Date(date);
    const valid = d < max;
    return { valid, errors: valid ? [] : [message || `Must be before ${max.toLocaleDateString()}`] };
  };
}

export function custom<T>(fn: (value: T) => boolean, message: string): Validator<T> {
  return (value) => {
    const valid = fn(value);
    return { valid, errors: valid ? [] : [message] };
  };
}

// ============================================================
// Composition Utilities
// ============================================================

/**
 * Compose multiple validators into one
 */
export function compose<T>(...validators: Validator<T>[]): Validator<T> {
  return (value) => {
    const errors: string[] = [];
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) errors.push(...result.errors);
    }
    return { valid: errors.length === 0, errors };
  };
}

/**
 * Run validators only if the value is present (not empty/null/undefined)
 */
export function optional<T>(...validators: Validator<T>[]): Validator<T> {
  return (value) => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return { valid: true, errors: [] };
    }
    return compose(...validators)(value);
  };
}

/**
 * Validate an entire form object against a set of rules
 */
export function validateForm<T extends Record<string, any>>(
  values: T,
  rules: ValidationRules<T>
): { valid: boolean; errors: FormErrors<T> } {
  const errors: FormErrors<T> = {};
  let valid = true;

  for (const [field, fieldValidators] of Object.entries(rules)) {
    if (!fieldValidators) continue;
    const fieldErrors: string[] = [];
    for (const validator of fieldValidators as Validator[]) {
      const result = validator((values as any)[field]);
      if (!result.valid) fieldErrors.push(...result.errors);
    }
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
      valid = false;
    }
  }

  return { valid, errors };
}

/**
 * Get the first error for a field, useful for displaying single error messages
 */
export function getFieldError<T>(errors: FormErrors<T>, field: keyof T): string | undefined {
  const fieldErrors = errors[field as string];
  return fieldErrors && fieldErrors.length > 0 ? fieldErrors[0] : undefined;
}

/**
 * Check if a field has errors
 */
export function hasFieldError<T>(errors: FormErrors<T>, field: keyof T): boolean {
  return (errors[field as string]?.length ?? 0) > 0;
}

// ============================================================
// Data Formatters
// ============================================================

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function formatRelativeTime(timestamp: number | Date): string {
  const now = Date.now();
  const ts = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
  const diff = now - ts;

  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function truncateText(text: string, maxLength: number, ellipsis = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function titleCase(text: string): string {
  return text.split(/[\s_-]+/).map(capitalize).join(' ');
}

export function camelToTitle(text: string): string {
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + 's'}`;
}

export function generateId(prefix = '', length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const rand = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return prefix ? `${prefix}_${rand}` : rand;
}

export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function stringToColor(str: string): string {
  const hash = hashCode(str);
  const h = hash % 360;
  return `hsl(${h}, 65%, 55%)`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function throttle<T extends (...args: any[]) => any>(fn: T, limit: number): T {
  let inThrottle = false;
  return ((...args: any[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  }) as T;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => { result[key] = obj[key]; });
  return result;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => delete result[key]);
  return result;
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function uniqueBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortBy<T>(array: T[], keyFn: (item: T) => number | string, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    const cmp = typeof aVal === 'string' ? aVal.localeCompare(String(bVal)) : (aVal as number) - (bVal as number);
    return order === 'asc' ? cmp : -cmp;
  });
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}
