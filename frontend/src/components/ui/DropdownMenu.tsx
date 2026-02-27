/**
 * Dropdown Menu Component - Animated context menu / dropdown
 * Features: Nested menus, icons, separators, keyboard navigation, search
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

/* ── Types ──────────────────────────────────────────────────────────── */
export interface DropdownMenuItem {
  type?: 'item' | 'separator' | 'label' | 'group';
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  children?: DropdownMenuItem[];
  onClick?: () => void;
  description?: string;
  badge?: string | number;
}

export interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  menuClassName?: string;
  searchable?: boolean;
  width?: number | string;
  onOpenChange?: (open: boolean) => void;
}

/* ── Menu Item Renderer ──────────────────────────────────────────────── */
const MenuItem: React.FC<{
  item: DropdownMenuItem;
  index: number;
  focused: number;
  onFocus: (i: number) => void;
  onClose: () => void;
  depth?: number;
}> = ({ item, index, focused, onFocus, onClose, depth = 0 }) => {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  if (item.type === 'separator') {
    return <div className="my-1 h-px bg-nexus-card/10" />;
  }

  if (item.type === 'label') {
    return (
      <div className="px-3 py-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider">
        {item.label}
      </div>
    );
  }

  const hasChildren = item.children && item.children.length > 0;
  const isFocused = focused === index;

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        onFocus(index);
        if (hasChildren) {
          clearTimeout(timeoutRef.current);
          setSubmenuOpen(true);
        }
      }}
      onMouseLeave={() => {
        if (hasChildren) {
          timeoutRef.current = setTimeout(() => setSubmenuOpen(false), 150);
        }
      }}
    >
      <button
        onClick={() => {
          if (item.disabled || hasChildren) return;
          item.onClick?.();
          onClose();
        }}
        disabled={item.disabled}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left',
          isFocused && !item.disabled && 'bg-nexus-card/10',
          item.disabled && 'opacity-40 cursor-not-allowed',
          item.danger && 'text-red-400 hover:text-red-300',
          !item.danger && 'text-white/80'
        )}
      >
        {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="truncate">{item.label}</div>
          {item.description && (
            <div className="text-xs text-white/40 mt-0.5 truncate">{item.description}</div>
          )}
        </div>
        {item.badge !== undefined && (
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs">
            {item.badge}
          </span>
        )}
        {item.checked !== undefined && (
          <div className={cn(
            'w-4 h-4 rounded border flex items-center justify-center',
            item.checked ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'
          )}>
            {item.checked && <Check className="w-3 h-3 text-white" />}
          </div>
        )}
        {item.shortcut && (
          <span className="text-xs text-white/30 ml-auto pl-4">{item.shortcut}</span>
        )}
        {hasChildren && <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
      </button>

      {/* Submenu */}
      <AnimatePresence>
        {hasChildren && submenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -5, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full top-0 ml-1 min-w-[180px] p-1.5 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl z-50"
          >
            {item.children!.map((child, ci) => (
              <MenuItem
                key={child.id ?? ci}
                item={child}
                index={ci}
                focused={-1}
                onFocus={() => {}}
                onClose={onClose}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Main Component ─────────────────────────────────────────────────── */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  className,
  menuClassName,
  searchable = false,
  width = 220,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    return items.filter(
      (item) =>
        item.type === 'separator' ||
        item.type === 'label' ||
        item.label?.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      onOpenChange?.(next);
      if (next) {
        setFocused(-1);
        setSearch('');
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      return next;
    });
  }, [onOpenChange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const actionableItems = filteredItems.filter((i) => i.type !== 'separator' && i.type !== 'label' && !i.disabled);
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocused((prev) => {
            let next = prev + 1;
            while (next < filteredItems.length && (filteredItems[next].type === 'separator' || filteredItems[next].type === 'label' || filteredItems[next].disabled)) next++;
            return next >= filteredItems.length ? prev : next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocused((prev) => {
            let next = prev - 1;
            while (next >= 0 && (filteredItems[next].type === 'separator' || filteredItems[next].type === 'label' || filteredItems[next].disabled)) next--;
            return next < 0 ? prev : next;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (focused >= 0 && focused < filteredItems.length) {
            const item = filteredItems[focused];
            if (!item.disabled && item.type !== 'separator' && item.type !== 'label') {
              item.onClick?.();
              setOpen(false);
              onOpenChange?.(false);
            }
          }
          break;
        case 'Escape':
          setOpen(false);
          onOpenChange?.(false);
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, focused, filteredItems, onOpenChange]);

  const alignClass = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  const sideClass = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
    left: 'right-full mr-1 top-0',
    right: 'left-full ml-1 top-0',
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      <div onClick={toggleOpen} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -5 : 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -5 : 5 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute z-50 p-1.5 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden',
              alignClass[align],
              sideClass[side],
              menuClassName
            )}
            style={{ width }}
          >
            {searchable && (
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 bg-nexus-card/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-white/40 text-center">No items found</div>
              ) : (
                filteredItems.map((item, i) => (
                  <MenuItem
                    key={item.id ?? i}
                    item={item}
                    index={i}
                    focused={focused}
                    onFocus={setFocused}
                    onClose={() => {
                      setOpen(false);
                      onOpenChange?.(false);
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DropdownMenu;
