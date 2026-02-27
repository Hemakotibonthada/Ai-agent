import React from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = false,
  disabled = false,
  className = '',
}: SliderProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs text-nexus-muted">
          {label && <span className="font-medium uppercase tracking-wider">{label}</span>}
          {showValue && <span className="tabular-nums text-nexus-text">{value[0]}</span>}
        </div>
      )}

      <RadixSlider.Root
        value={value}
        onValueChange={onValueChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={`relative flex h-5 w-full touch-none select-none items-center ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        {/* Track */}
        <RadixSlider.Track className="relative h-1.5 w-full grow rounded-full bg-nexus-border/50">
          <RadixSlider.Range
            className="absolute h-full rounded-full bg-gradient-to-r from-nexus-primary to-nexus-secondary"
            style={{ boxShadow: '0 0 8px rgba(59,130,246,.5)' }}
          />
        </RadixSlider.Track>

        {/* Thumb */}
        <RadixSlider.Thumb
          className="block h-4 w-4 rounded-full border-2 border-nexus-primary bg-nexus-surface shadow-md
                     transition-transform hover:scale-125 focus-ring cursor-grab active:cursor-grabbing"
          style={{ boxShadow: '0 0 8px rgba(59,130,246,.6)' }}
        />
      </RadixSlider.Root>
    </div>
  );
}
