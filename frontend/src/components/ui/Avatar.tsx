import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarStatus = 'online' | 'offline' | 'away' | 'dnd';

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  glow?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Maps                                                               */
/* ------------------------------------------------------------------ */
const sizeMap: Record<AvatarSize, { container: string; text: string; dot: string }> = {
  xs: { container: 'h-6 w-6',   text: 'text-[10px]', dot: 'h-1.5 w-1.5 border' },
  sm: { container: 'h-8 w-8',   text: 'text-xs',     dot: 'h-2 w-2 border' },
  md: { container: 'h-10 w-10', text: 'text-sm',     dot: 'h-2.5 w-2.5 border-2' },
  lg: { container: 'h-12 w-12', text: 'text-base',   dot: 'h-3 w-3 border-2' },
  xl: { container: 'h-16 w-16', text: 'text-lg',     dot: 'h-3.5 w-3.5 border-2' },
};

const statusColor: Record<AvatarStatus, string> = {
  online:  'bg-emerald-400',
  offline: 'bg-gray-500',
  away:    'bg-amber-400',
  dnd:     'bg-red-500',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function getInitials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Avatar({
  src,
  alt,
  fallback,
  size = 'md',
  status,
  glow = false,
  className = '',
}: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`
          ${s.container} flex items-center justify-center overflow-hidden rounded-full
          border border-nexus-border bg-nexus-surface font-semibold text-nexus-muted
          ${glow ? 'ring-2 ring-nexus-primary/40 animate-glow-ring' : ''}
        `}
      >
        {src ? (
          <img src={src} alt={alt ?? ''} className="h-full w-full object-cover" />
        ) : (
          <span className={s.text}>{getInitials(fallback ?? alt)}</span>
        )}
      </div>

      {status && (
        <span
          className={`
            absolute bottom-0 right-0 ${s.dot} rounded-full border-nexus-bg
            ${statusColor[status]}
          `}
        />
      )}
    </div>
  );
}
