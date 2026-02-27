/**
 * Accordion Component - Collapsible content panels with smooth animations
 * Features: Single/multi expand, animated chevron, customizable styling
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/* ── Types ──────────────────────────────────────────────────────────── */
export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

export interface AccordionProps {
  items: AccordionItem[];
  type?: 'single' | 'multiple';
  defaultExpanded?: string[];
  className?: string;
  variant?: 'default' | 'bordered' | 'separated' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  onChange?: (expanded: string[]) => void;
}

/* ── Sub-components ─────────────────────────────────────────────────── */
const AccordionContent: React.FC<{
  isOpen: boolean;
  children: React.ReactNode;
  animated: boolean;
}> = ({ isOpen, children, animated }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [children, isOpen]);

  if (!animated) {
    return isOpen ? <div className="px-4 pb-4">{children}</div> : null;
  }

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
          className="overflow-hidden"
        >
          <div ref={contentRef} className="px-4 pb-4 pt-1">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ── Variant Styles ─────────────────────────────────────────────────── */
const variantStyles = {
  default: {
    container: 'divide-y divide-white/10',
    item: 'bg-white/5',
    header: 'hover:bg-white/5',
  },
  bordered: {
    container: 'border border-white/10 rounded-xl divide-y divide-white/10 overflow-hidden',
    item: '',
    header: 'hover:bg-white/5',
  },
  separated: {
    container: 'space-y-2',
    item: 'border border-white/10 rounded-xl overflow-hidden',
    header: 'hover:bg-white/5',
  },
  ghost: {
    container: '',
    item: '',
    header: 'hover:bg-white/5 rounded-lg',
  },
};

const sizeStyles = {
  sm: { header: 'py-2 px-3 text-sm', content: 'text-sm' },
  md: { header: 'py-3 px-4 text-base', content: 'text-sm' },
  lg: { header: 'py-4 px-5 text-lg', content: 'text-base' },
};

/* ── Main Component ─────────────────────────────────────────────────── */
export const Accordion: React.FC<AccordionProps> = ({
  items,
  type = 'single',
  defaultExpanded = [],
  className,
  variant = 'default',
  size = 'md',
  animated = true,
  onChange,
}) => {
  const [expanded, setExpanded] = useState<string[]>(defaultExpanded);
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        let next: string[];
        if (type === 'single') {
          next = prev.includes(id) ? [] : [id];
        } else {
          next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
        }
        onChange?.(next);
        return next;
      });
    },
    [type, onChange]
  );

  return (
    <div className={cn(styles.container, className)}>
      {items.map((item) => {
        const isOpen = expanded.includes(item.id);

        return (
          <div key={item.id} className={styles.item}>
            <button
              onClick={() => !item.disabled && toggle(item.id)}
              disabled={item.disabled}
              className={cn(
                'w-full flex items-center justify-between gap-3 text-left transition-colors',
                sizes.header,
                styles.header,
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${item.id}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {item.icon && (
                  <span className="text-cyan-400 flex-shrink-0">{item.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-xs text-white/50 mt-0.5 truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-medium">
                    {item.badge}
                  </span>
                )}
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4 text-white/50" />
                </motion.div>
              </div>
            </button>

            <div id={`accordion-content-${item.id}`} role="region">
              <AccordionContent isOpen={isOpen} animated={animated}>
                <div className={cn('text-white/70', sizes.content)}>
                  {item.content}
                </div>
              </AccordionContent>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;
