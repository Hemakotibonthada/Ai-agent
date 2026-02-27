import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type Status = 'active' | 'inactive' | 'warning' | 'error' | 'idle';

interface StatusIndicatorProps {
  status?: Status;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Maps                                                               */
/* ------------------------------------------------------------------ */
const colorMap: Record<Status, string> = {
  active:   'bg-emerald-400',
  inactive: 'bg-gray-500',
  warning:  'bg-amber-400',
  error:    'bg-red-500',
  idle:     'bg-nexus-muted',
};

const sizeMap: Record<string, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function StatusIndicator({
  status = 'inactive',
  label,
  size = 'md',
  className = '',
}: StatusIndicatorProps) {
  const isAnimated = status === 'active';
  const color = colorMap[status];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`relative flex ${sizeMap[size]}`}>
        {isAnimated && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />
        )}
        <span className={`relative inline-flex rounded-full ${sizeMap[size]} ${color}`} />
      </span>
      {label && <span className="text-xs text-nexus-muted">{label}</span>}
    </span>
  );
}
