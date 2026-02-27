import React, { forwardRef } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, label, disabled = false, className = '' }, ref) => {
    return (
      <label className={`inline-flex cursor-pointer items-center gap-3 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
        <RadixSwitch.Root
          ref={ref}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={`
            relative h-6 w-11 rounded-full border transition-colors duration-200 focus-ring
            ${checked
              ? 'border-nexus-primary/60 bg-nexus-primary/20'
              : 'border-nexus-border bg-nexus-surface/60'
            }
          `}
          style={checked ? { boxShadow: '0 0 10px rgba(59,130,246,.4)' } : undefined}
        >
          <RadixSwitch.Thumb asChild>
            <motion.span
              className={`
                block h-4 w-4 rounded-full shadow-sm
                ${checked ? 'bg-nexus-primary' : 'bg-nexus-muted'}
              `}
              animate={{ x: checked ? 22 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </RadixSwitch.Thumb>
        </RadixSwitch.Root>
        {label && <span className="text-sm text-nexus-text">{label}</span>}
      </label>
    );
  },
);

Switch.displayName = 'Switch';
export default Switch;
