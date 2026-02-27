import React from 'react';
import { motion } from 'framer-motion';
import * as RadixProgress from '@radix-ui/react-progress';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface ProgressProps {
  value: number;
  max?: number;
  label?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Size map                                                           */
/* ------------------------------------------------------------------ */
const barHeight: Record<string, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

/* ------------------------------------------------------------------ */
/*  Linear Progress                                                    */
/* ------------------------------------------------------------------ */
export default function Progress({
  value,
  max = 100,
  label = false,
  size = 'md',
  className = '',
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="flex justify-between text-xs text-nexus-muted">
          <span>Progress</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <RadixProgress.Root
        value={pct}
        className={`relative w-full overflow-hidden rounded-full bg-nexus-border/50 ${barHeight[size]}`}
      >
        <RadixProgress.Indicator asChild>
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-nexus-primary to-nexus-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              boxShadow: '0 0 10px rgba(59,130,246,.5), 0 0 20px rgba(139,92,246,.25)',
            }}
          />
        </RadixProgress.Indicator>
      </RadixProgress.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Circular Progress                                                  */
/* ------------------------------------------------------------------ */
export function CircularProgress({
  value,
  size = 48,
  strokeWidth = 4,
  className = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-nexus-border/40"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="fill-none stroke-nexus-primary"
          style={{ filter: 'drop-shadow(0 0 4px rgba(59,130,246,.6))' }}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-nexus-text">
        {Math.round(pct)}%
      </span>
    </div>
  );
}
