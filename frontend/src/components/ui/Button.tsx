import React, { forwardRef, useCallback, useRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2, type LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-nexus-primary/20 text-nexus-primary border-nexus-primary/40 hover:bg-nexus-primary/30 hover:border-nexus-primary/60 neon-blue',
  secondary:
    'bg-nexus-secondary/20 text-nexus-secondary border-nexus-secondary/40 hover:bg-nexus-secondary/30 hover:border-nexus-secondary/60 neon-violet',
  accent:
    'bg-nexus-accent/20 text-nexus-accent border-nexus-accent/40 hover:bg-nexus-accent/30 hover:border-nexus-accent/60 neon-cyan',
  ghost:
    'bg-transparent text-nexus-muted border-transparent hover:bg-nexus-card/5 hover:text-nexus-text',
  danger:
    'bg-nexus-error/20 text-nexus-error border-nexus-error/40 hover:bg-nexus-error/30 hover:border-nexus-error/60',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-md',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
};

const iconSizes: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

/* ------------------------------------------------------------------ */
/*  Ripple helper                                                      */
/* ------------------------------------------------------------------ */
function useRipple() {
  const ref = useRef<HTMLButtonElement | null>(null);

  const createRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'absolute rounded-full bg-nexus-card/20 pointer-events-none animate-scale-in';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.animation = 'ripple 0.5s ease-out forwards';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }, []);

  return { ref, createRipple };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconRight: IconRight,
      children,
      className = '',
      disabled,
      onClick,
      ...rest
    },
    forwardedRef,
  ) => {
    const { ref: rippleRef, createRipple } = useRipple();
    const iSize = iconSizes[size];

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(e);
      onClick?.(e);
    };

    return (
      <motion.button
        ref={(node) => {
          rippleRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        disabled={disabled || loading}
        onClick={handleClick}
        className={`
          relative inline-flex items-center justify-center overflow-hidden border font-medium
          transition-all duration-200 focus-ring select-none
          disabled:pointer-events-none disabled:opacity-50
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}
        `}
        {...rest}
      >
        {loading ? (
          <Loader2 size={iSize} className="animate-spin" />
        ) : Icon ? (
          <Icon size={iSize} />
        ) : null}
        {children && <span>{children}</span>}
        {!loading && IconRight && <IconRight size={iSize} />}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
export default Button;

/* inline ripple keyframe (injected once) */
if (typeof document !== 'undefined' && !document.getElementById('nexus-ripple-style')) {
  const s = document.createElement('style');
  s.id = 'nexus-ripple-style';
  s.textContent = `@keyframes ripple{0%{transform:scale(0);opacity:.35}100%{transform:scale(2.5);opacity:0}}`;
  document.head.appendChild(s);
}
