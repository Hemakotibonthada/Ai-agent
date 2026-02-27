/**
 * Toast Notification System - Beautiful animated toast notifications
 * Features: Multiple positions, types, auto-dismiss, progress bar, actions, stacking
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, AlertTriangle, Info, X,
  Loader2, Bell, Sparkles, Shield, Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';

/* ── Types ──────────────────────────────────────────────────────────── */
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'custom';
export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  position?: ToastPosition;
  icon?: React.ReactNode;
  actions?: ToastAction[];
  dismissible?: boolean;
  progress?: boolean;
  className?: string;
  onDismiss?: () => void;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  loading: (title: string, description?: string) => string;
  promise: <T>(promise: Promise<T>, msgs: { loading: string; success: string; error: string }) => Promise<T>;
}

/* ── Icons ──────────────────────────────────────────────────────────── */
const typeIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
  error: <XCircle className="w-5 h-5 text-red-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  info: <Info className="w-5 h-5 text-blue-400" />,
  loading: <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />,
  custom: <Sparkles className="w-5 h-5 text-purple-400" />,
};

const typeStyles: Record<ToastType, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/5',
  error: 'border-red-500/30 bg-red-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-blue-500/30 bg-blue-500/5',
  loading: 'border-cyan-500/30 bg-cyan-500/5',
  custom: 'border-purple-500/30 bg-purple-500/5',
};

const progressColors: Record<ToastType, string> = {
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  warning: 'bg-amber-400',
  info: 'bg-blue-400',
  loading: 'bg-cyan-400',
  custom: 'bg-purple-400',
};

/* ── Position Styles ────────────────────────────────────────────────── */
const positionStyles: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

const slideVariants: Record<string, any> = {
  'top-right': { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 100, opacity: 0 } },
  'top-left': { initial: { x: -100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -100, opacity: 0 } },
  'top-center': { initial: { y: -50, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -50, opacity: 0 } },
  'bottom-right': { initial: { x: 100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 100, opacity: 0 } },
  'bottom-left': { initial: { x: -100, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -100, opacity: 0 } },
  'bottom-center': { initial: { y: 50, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 50, opacity: 0 } },
};

/* ── Toast Item Component ─────────────────────────────────────────── */
const ToastItem: React.FC<{
  toast: Toast;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());
  const remainRef = useRef(toast.duration ?? 5000);
  const position = toast.position ?? 'top-right';
  const variants = slideVariants[position];

  useEffect(() => {
    if (toast.type === 'loading' || toast.duration === Infinity) return;

    const duration = toast.duration ?? 5000;
    const tick = 50;

    const startTimer = () => {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startRef.current;
        const remaining = remainRef.current - elapsed;
        if (remaining <= 0) {
          onDismiss();
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setProgress((remaining / duration) * 100);
        }
      }, tick);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [toast.duration, toast.type, onDismiss]);

  const handlePause = () => {
    if (toast.type === 'loading') return;
    setIsPaused(true);
    remainRef.current -= (Date.now() - startRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleResume = () => {
    if (toast.type === 'loading') return;
    setIsPaused(false);
    startRef.current = Date.now();
    const duration = toast.duration ?? 5000;
    const tick = 50;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = remainRef.current - elapsed;
      if (remaining <= 0) {
        onDismiss();
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setProgress((remaining / duration) * 100);
      }
    }, tick);
  };

  return (
    <motion.div
      layout
      {...variants}
      transition={{ type: 'spring', damping: 25, stiffness: 350, mass: 0.8 }}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      className={cn(
        'relative w-80 rounded-xl border shadow-2xl backdrop-blur-xl overflow-hidden',
        typeStyles[toast.type],
        toast.className
      )}
    >
      <div className="flex gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {toast.icon ?? typeIcons[toast.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{toast.title}</p>
          {toast.description && (
            <p className="text-white/60 text-xs mt-1 leading-relaxed">{toast.description}</p>
          )}
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {toast.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => { action.onClick(); onDismiss(); }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    action.variant === 'primary' && 'bg-cyan-500 text-white hover:bg-cyan-600',
                    action.variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
                    (!action.variant || action.variant === 'default') && 'bg-nexus-card/10 text-white/80 hover:bg-nexus-card/20'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {(toast.dismissible ?? true) && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-nexus-card/10 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-white/40" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {(toast.progress ?? true) && toast.type !== 'loading' && toast.duration !== Infinity && (
        <div className="h-0.5 bg-nexus-card/5">
          <motion.div
            className={cn('h-full', progressColors[toast.type])}
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
      )}
    </motion.div>
  );
};

/* ── Context & Provider ──────────────────────────────────────────────── */
const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastCounter = 0;

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  position?: ToastPosition;
  limit?: number;
}> = ({ children, position = 'top-right', limit = 5 }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${++toastCounter}-${Date.now()}`;
      const newToast: Toast = { ...toast, id, position: toast.position ?? position };
      setToasts((prev) => {
        const next = [newToast, ...prev];
        return next.slice(0, limit);
      });
      return id;
    },
    [position, limit]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const clearAll = useCallback(() => setToasts([]), []);

  const success = useCallback(
    (title: string, description?: string) => addToast({ type: 'success', title, description }),
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string) => addToast({ type: 'error', title, description }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, description?: string) => addToast({ type: 'warning', title, description }),
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string) => addToast({ type: 'info', title, description }),
    [addToast]
  );

  const loadingToast = useCallback(
    (title: string, description?: string) =>
      addToast({ type: 'loading', title, description, duration: Infinity, dismissible: false }),
    [addToast]
  );

  const promiseToast = useCallback(
    async <T,>(promise: Promise<T>, msgs: { loading: string; success: string; error: string }) => {
      const id = loadingToast(msgs.loading);
      try {
        const result = await promise;
        updateToast(id, { type: 'success', title: msgs.success, duration: 3000, dismissible: true });
        return result;
      } catch (err) {
        updateToast(id, { type: 'error', title: msgs.error, duration: 5000, dismissible: true });
        throw err;
      }
    },
    [loadingToast, updateToast]
  );

  // Group toasts by position
  const groupedToasts = toasts.reduce((acc, t) => {
    const pos = t.position ?? position;
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(t);
    return acc;
  }, {} as Record<ToastPosition, Toast[]>);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        updateToast,
        clearAll,
        success,
        error,
        warning,
        info,
        loading: loadingToast,
        promise: promiseToast,
      }}
    >
      {children}

      {/* Toast Containers by position */}
      {Object.entries(groupedToasts).map(([pos, posToasts]) => (
        <div
          key={pos}
          className={cn(
            'fixed z-[9999] flex flex-col gap-2 pointer-events-none',
            positionStyles[pos as ToastPosition],
            pos.includes('bottom') ? 'flex-col-reverse' : 'flex-col'
          )}
        >
          <AnimatePresence mode="popLayout">
            {posToasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <ToastItem
                  toast={toast}
                  onDismiss={() => {
                    removeToast(toast.id);
                    toast.onDismiss?.();
                  }}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </ToastContext.Provider>
  );
};

/* ── Hook ────────────────────────────────────────────────────────────── */
export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export default ToastProvider;
