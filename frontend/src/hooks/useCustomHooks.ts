/**
 * Custom Hooks Library - useDebounce, useLocalStorage, useMediaQuery, useIntersection,
 * useClickOutside, useClipboard, useCountUp, useToggle, useAsync, usePrevious,
 * useInterval, useTimeout, useHover, useLockScroll, useOnlineStatus, useWindowSize
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ── useDebounce ────────────────────────────────────────────────────── */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ── useDebouncedCallback ───────────────────────────────────────────── */
export function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    ((...args: any[]) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    }) as T,
    [delay]
  );
}

/* ── useLocalStorage ────────────────────────────────────────────────── */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch (e) {
          console.warn('useLocalStorage: Failed to set', e);
        }
        return next;
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStored(initialValue);
    } catch (e) {
      console.warn('useLocalStorage: Failed to remove', e);
    }
  }, [key, initialValue]);

  return [stored, setValue, removeValue];
}

/* ── useSessionStorage ──────────────────────────────────────────────── */
export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch (e) {
          console.warn('useSessionStorage: Failed', e);
        }
        return next;
      });
    },
    [key]
  );

  return [stored, setValue];
}

/* ── useMediaQuery ──────────────────────────────────────────────────── */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/* ── useBreakpoint ──────────────────────────────────────────────────── */
export function useBreakpoint() {
  const sm = useMediaQuery('(min-width: 640px)');
  const md = useMediaQuery('(min-width: 768px)');
  const lg = useMediaQuery('(min-width: 1024px)');
  const xl = useMediaQuery('(min-width: 1280px)');
  const xxl = useMediaQuery('(min-width: 1536px)');

  return useMemo(
    () => ({
      isMobile: !sm,
      isTablet: sm && !lg,
      isDesktop: lg,
      isLargeDesktop: xl,
      breakpoint: xxl ? '2xl' : xl ? 'xl' : lg ? 'lg' : md ? 'md' : sm ? 'sm' : 'xs',
      sm,
      md,
      lg,
      xl,
      xxl,
    }),
    [sm, md, lg, xl, xxl]
  );
}

/* ── useIntersectionObserver ─────────────────────────────────────────── */
export function useIntersectionObserver(
  options?: IntersectionObserverInit
): [React.RefObject<HTMLElement>, boolean, IntersectionObserverEntry | undefined] {
  const ref = useRef<HTMLElement>(null!);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([e]) => {
      setIsIntersecting(e.isIntersecting);
      setEntry(e);
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.threshold, options?.root, options?.rootMargin]);

  return [ref, isIntersecting, entry];
}

/* ── useClickOutside ────────────────────────────────────────────────── */
export function useClickOutside<T extends HTMLElement>(handler: () => void): React.RefObject<T> {
  const ref = useRef<T>(null!);

  useEffect(() => {
    const listener = (e: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler]);

  return ref;
}

/* ── useClipboard ───────────────────────────────────────────────────── */
export function useClipboard(timeout = 2000): {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  error: Error | null;
} {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setError(null);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), timeout);
      } catch (e) {
        setError(e as Error);
        setCopied(false);
      }
    },
    [timeout]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { copy, copied, error };
}

/* ── useCountUp ─────────────────────────────────────────────────────── */
export function useCountUp(end: number, duration = 2000, start = 0): number {
  const [count, setCount] = useState(start);
  const startRef = useRef(start);

  useEffect(() => {
    const startTime = Date.now();
    const startVal = startRef.current;
    const diff = end - startVal;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(startVal + diff * eased);

      if (progress < 1) requestAnimationFrame(animate);
      else startRef.current = end;
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
}

/* ── useToggle ──────────────────────────────────────────────────────── */
export function useToggle(initial = false): [boolean, () => void, (value: boolean) => void] {
  const [state, setState] = useState(initial);
  const toggle = useCallback(() => setState((s) => !s), []);
  return [state, toggle, setState];
}

/* ── useAsync ───────────────────────────────────────────────────────── */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(asyncFn: () => Promise<T>, deps: any[] = []): AsyncState<T> & { execute: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const data = await asyncFn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { ...state, execute };
}

/* ── usePrevious ────────────────────────────────────────────────────── */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

/* ── useInterval ────────────────────────────────────────────────────── */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

/* ── useTimeout ─────────────────────────────────────────────────────── */
export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

/* ── useHover ───────────────────────────────────────────────────────── */
export function useHover<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null!);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    };
  }, []);

  return [ref, hovered];
}

/* ── useLockBodyScroll ──────────────────────────────────────────────── */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [locked]);
}

/* ── useOnlineStatus ────────────────────────────────────────────────── */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

/* ── useWindowSize ──────────────────────────────────────────────────── */
export function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setSize({ width: window.innerWidth, height: window.innerHeight }), 100);
    };
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      clearTimeout(timer);
    };
  }, []);

  return size;
}

/* ── useScrollPosition ──────────────────────────────────────────────── */
export function useScrollPosition() {
  const [position, setPosition] = useState({ x: 0, y: 0, direction: 'up' as 'up' | 'down' });
  const prevY = useRef(0);

  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      setPosition({
        x: window.scrollX,
        y,
        direction: y > prevY.current ? 'down' : 'up',
      });
      prevY.current = y;
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return position;
}

/* ── useKeyPress ────────────────────────────────────────────────────── */
export function useKeyPress(targetKey: string, handler?: () => void): boolean {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === targetKey) {
        setPressed(true);
        handler?.();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === targetKey) setPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [targetKey, handler]);

  return pressed;
}

/* ── useMounted ─────────────────────────────────────────────────────── */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

/* ── useDocumentTitle ───────────────────────────────────────────────── */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

/* ── useFavicon ─────────────────────────────────────────────────────── */
export function useFavicon(href: string) {
  useEffect(() => {
    const link: HTMLLinkElement = document.querySelector('link[rel*="icon"]') ?? document.createElement('link');
    link.type = 'image/x-icon';
    link.rel = 'shortcut icon';
    link.href = href;
    document.head.appendChild(link);
  }, [href]);
}

/* ── useEventListener ───────────────────────────────────────────────── */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element?: HTMLElement | Window
) {
  const savedHandler = useRef(handler);
  useEffect(() => { savedHandler.current = handler; }, [handler]);

  useEffect(() => {
    const target = element ?? window;
    const listener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    target.addEventListener(eventName, listener);
    return () => target.removeEventListener(eventName, listener);
  }, [eventName, element]);
}

/* ── useReducedMotion ───────────────────────────────────────────────── */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/* ── useDarkMode ────────────────────────────────────────────────────── */
export function useDarkMode(): [boolean, () => void] {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [isDark, setIsDark] = useLocalStorage('dark-mode', prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((prev) => !prev), [setIsDark]);
  return [isDark, toggle];
}

/* ── useFullscreen ──────────────────────────────────────────────────── */
export function useFullscreen<T extends HTMLElement>(): {
  ref: React.RefObject<T>;
  isFullscreen: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
} {
  const ref = useRef<T>(null!);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const enter = useCallback(() => ref.current?.requestFullscreen(), []);
  const exit = useCallback(() => document.exitFullscreen(), []);
  const toggle = useCallback(() => (isFullscreen ? exit() : enter()), [isFullscreen, enter, exit]);

  return { ref, isFullscreen, enter, exit, toggle };
}

/* ── useGeolocation ─────────────────────────────────────────────────── */
export function useGeolocation(options?: PositionOptions) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError({ code: 0, message: 'Geolocation not supported', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as any);
      return;
    }
    const id = navigator.geolocation.watchPosition(setPosition, setError, options);
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { position, error };
}

/* ── useNetworkStatus ───────────────────────────────────────────────── */
export function useNetworkStatus() {
  const [status, setStatus] = useState(() => {
    const conn = (navigator as any).connection;
    return {
      online: navigator.onLine,
      downlink: conn?.downlink ?? null,
      effectiveType: conn?.effectiveType ?? null,
      rtt: conn?.rtt ?? null,
      saveData: conn?.saveData ?? false,
    };
  });

  useEffect(() => {
    const update = () => {
      const conn = (navigator as any).connection;
      setStatus({
        online: navigator.onLine,
        downlink: conn?.downlink ?? null,
        effectiveType: conn?.effectiveType ?? null,
        rtt: conn?.rtt ?? null,
        saveData: conn?.saveData ?? false,
      });
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    (navigator as any).connection?.addEventListener('change', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      (navigator as any).connection?.removeEventListener('change', update);
    };
  }, []);

  return status;
}

/* ── useBattery ─────────────────────────────────────────────────────── */
export function useBattery() {
  const [battery, setBattery] = useState<{ charging: boolean; level: number; chargingTime: number; dischargingTime: number } | null>(null);

  useEffect(() => {
    let batt: any;
    const update = () => {
      if (batt) {
        setBattery({
          charging: batt.charging,
          level: batt.level,
          chargingTime: batt.chargingTime,
          dischargingTime: batt.dischargingTime,
        });
      }
    };

    (navigator as any).getBattery?.().then((b: any) => {
      batt = b;
      update();
      b.addEventListener('chargingchange', update);
      b.addEventListener('levelchange', update);
    });

    return () => {
      if (batt) {
        batt.removeEventListener('chargingchange', update);
        batt.removeEventListener('levelchange', update);
      }
    };
  }, []);

  return battery;
}

/* ── usePageVisibility ──────────────────────────────────────────────── */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  return visible;
}
