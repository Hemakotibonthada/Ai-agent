import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: 'none' | 'currency' | 'percent' | 'compact';
  locale?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */
const formatters: Record<string, (v: number, locale: string) => string> = {
  none: (v) => Math.round(v).toLocaleString(),
  currency: (v, l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v),
  percent: (v) => `${v.toFixed(1)}%`,
  compact: (v, l) => new Intl.NumberFormat(l, { notation: 'compact', maximumFractionDigits: 1 }).format(v),
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function AnimatedNumber({
  value,
  duration = 0.8,
  format = 'none',
  locale = 'en-US',
  className = '',
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    motionVal.set(value);
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = formatters[format](latest, locale);
      }
    });
    return unsubscribe;
  }, [spring, format, locale]);

  return (
    <motion.span
      ref={ref}
      className={`tabular-nums ${className}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {formatters[format](0, locale)}
    </motion.span>
  );
}
