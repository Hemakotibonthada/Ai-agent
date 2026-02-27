import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  pulse?: boolean;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Color map                                                          */
/* ------------------------------------------------------------------ */
const styles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  warning: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400' },
  error:   { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', dot: 'bg-red-400' },
  info:    { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400' },
  neutral: { bg: 'bg-white/5 border-white/10', text: 'text-nexus-muted', dot: 'bg-nexus-muted' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Badge({
  variant = 'info',
  pulse = false,
  dot = false,
  children,
  className = '',
}: BadgeProps) {
  const s = styles[variant];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium
        ${s.bg} ${s.text} ${className}
      `}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`}
            />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
        </span>
      )}
      {children}
    </span>
  );
}
