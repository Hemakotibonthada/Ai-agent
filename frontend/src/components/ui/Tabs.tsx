import React from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface TabItem {
  value: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'horizontal' | 'vertical';
  children: React.ReactNode;
  className?: string;
}

interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Tabs({
  items,
  value,
  onValueChange,
  variant = 'horizontal',
  children,
  className = '',
}: TabsProps) {
  const isVertical = variant === 'vertical';

  return (
    <RadixTabs.Root
      value={value}
      onValueChange={onValueChange}
      orientation={isVertical ? 'vertical' : 'horizontal'}
      className={`${isVertical ? 'flex gap-4' : 'flex flex-col gap-3'} ${className}`}
    >
      <RadixTabs.List
        className={`relative flex ${
          isVertical
            ? 'flex-col gap-1 border-r border-nexus-border/40 pr-3'
            : 'gap-1 border-b border-nexus-border/40 pb-px'
        }`}
      >
        {items.map((item) => {
          const active = value === item.value;
          return (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={`
                relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors
                disabled:opacity-40 disabled:pointer-events-none
                ${active ? 'text-nexus-primary' : 'text-nexus-muted hover:text-nexus-text hover:bg-white/5'}
              `}
            >
              {item.icon && <item.icon size={16} />}
              <span>{item.label}</span>
              {active && (
                <motion.span
                  layoutId="tab-indicator"
                  className={`absolute ${
                    isVertical
                      ? 'right-[-13px] top-0 h-full w-0.5'
                      : 'bottom-[-1px] left-0 h-0.5 w-full'
                  } rounded-full bg-nexus-primary`}
                  style={{ boxShadow: '0 0 8px rgba(59,130,246,.6)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>

      <div className="flex-1">{children}</div>
    </RadixTabs.Root>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab Content Pane                                                   */
/* ------------------------------------------------------------------ */
export function TabContent({ value, children, className = '' }: TabContentProps) {
  return (
    <RadixTabs.Content value={value} className={className}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </RadixTabs.Content>
  );
}
