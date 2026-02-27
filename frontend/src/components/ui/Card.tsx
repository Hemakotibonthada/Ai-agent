import React, { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type CardVariant = 'default' | 'glow' | 'gradient';
type CardSize = 'sm' | 'md' | 'lg';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  size?: CardSize;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  hoverable?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */
const sizeStyles: Record<CardSize, string> = {
  sm: 'p-3 rounded-lg',
  md: 'p-5 rounded-xl',
  lg: 'p-7 rounded-2xl',
};

const variantBase =
  'border border-nexus-border bg-nexus-card/80 backdrop-blur-md transition-all duration-300';

const variantStyles: Record<CardVariant, string> = {
  default: variantBase,
  glow: `${variantBase} neon-blue`,
  gradient: `${variantBase} animated-border`,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      size = 'md',
      header,
      footer,
      loading = false,
      hoverable = false,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const hoverClass = hoverable
      ? 'hover:border-nexus-primary/40 hover:shadow-nexus hover:-translate-y-0.5 cursor-pointer'
      : '';

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`${variantStyles[variant]} ${sizeStyles[size]} ${hoverClass} ${className}`}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="skeleton h-5 w-2/5 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {header && (
                <div className="mb-4 border-b border-nexus-border/50 pb-3 font-semibold text-nexus-text">
                  {header}
                </div>
              )}
              <div>{children}</div>
              {footer && (
                <div className="mt-4 border-t border-nexus-border/50 pt-3 text-sm text-nexus-muted">
                  {footer}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  },
);

Card.displayName = 'Card';
export default Card;
