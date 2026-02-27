import React, { forwardRef, useId } from 'react';
import { motion } from 'framer-motion';
import { Search, AlertCircle, type LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefixIcon?: LucideIcon;
  suffixIcon?: LucideIcon;
  variant?: 'default' | 'search';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      prefixIcon: PrefixIcon,
      suffixIcon: SuffixIcon,
      variant = 'default',
      className = '',
      id: externalId,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const id = externalId ?? autoId;
    const isSearch = variant === 'search';
    const LeftIcon = isSearch ? Search : PrefixIcon;

    return (
      <div className={`relative flex flex-col gap-1.5 ${className}`}>
        {/* Floating label */}
        {label && (
          <motion.label
            htmlFor={id}
            className="text-xs font-medium uppercase tracking-wider text-nexus-muted"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {label}
          </motion.label>
        )}

        <div className="relative flex items-center">
          {LeftIcon && (
            <LeftIcon
              size={16}
              className="pointer-events-none absolute left-3 text-nexus-muted"
            />
          )}

          <input
            ref={ref}
            id={id}
            className={`
              w-full rounded-lg border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text
              placeholder:text-nexus-muted/60 transition-all duration-200 focus-ring
              ${LeftIcon ? 'pl-9' : ''}
              ${SuffixIcon ? 'pr-9' : ''}
              ${
                error
                  ? 'border-nexus-error/60 focus:border-nexus-error'
                  : 'border-nexus-border focus:border-nexus-primary/60'
              }
            `}
            {...rest}
          />

          {SuffixIcon && !error && (
            <SuffixIcon
              size={16}
              className="pointer-events-none absolute right-3 text-nexus-muted"
            />
          )}
          {error && (
            <AlertCircle
              size={16}
              className="pointer-events-none absolute right-3 text-nexus-error"
            />
          )}
        </div>

        {/* Error message */}
        {error && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-nexus-error"
          >
            {error}
          </motion.span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
export default Input;
