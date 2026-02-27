import React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface TooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayMs?: number;
  children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Tooltip({
  content,
  side = 'top',
  delayMs = 300,
  children,
}: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayMs}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-[100] rounded-lg border border-white/10 bg-nexus-surface/90 px-3 py-1.5
                       text-xs font-medium text-nexus-text shadow-lg backdrop-blur-md
                       animate-fade-in select-none"
          >
            {content}
            <RadixTooltip.Arrow className="fill-nexus-surface/90" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
