import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// Breadcrumb Component
// ============================================================
interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items, separator = '/', maxItems, className = '',
}) => {
  const displayed = maxItems && items.length > maxItems
    ? [...items.slice(0, 1), { label: '...' }, ...items.slice(-(maxItems - 1))]
    : items;

  return (
    <nav className={`flex items-center gap-1.5 text-sm ${className}`} aria-label="Breadcrumb">
      {displayed.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-nexus-muted text-xs">{separator}</span>}
          {item.href ? (
            <a href={item.href}
              className="flex items-center gap-1 text-nexus-muted hover:text-blue-500 transition-colors">
              {item.icon} {item.label}
            </a>
          ) : (
            <span className={`flex items-center gap-1 ${i === displayed.length - 1 ? 'text-nexus-text font-medium' : 'text-nexus-muted'}`}>
              {item.icon} {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// ============================================================
// Stepper Component
// ============================================================
interface StepperStep {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  content?: React.ReactNode;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  onStepChange?: (step: number) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'dots' | 'numbered';
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps, currentStep, onStepChange, orientation = 'horizontal',
  variant = 'default', className = '',
}) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div className={`${isHorizontal ? 'flex items-start' : 'flex flex-col'} ${className}`}>
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;

        return (
          <div key={i}
            className={`flex ${isHorizontal ? 'flex-col items-center flex-1' : 'items-start gap-4'} ${i > 0 ? (isHorizontal ? '' : 'mt-4') : ''}`}>
            <div className={`flex ${isHorizontal ? 'items-center w-full' : 'flex-col items-center'}`}>
              {i > 0 && (
                <div className={`${isHorizontal ? 'flex-1 h-0.5' : 'w-0.5 h-6'} ${isCompleted ? 'bg-blue-500' : 'bg-nexus-surface'}`} />
              )}

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onStepChange?.(i)}
                className={`flex-shrink-0 flex items-center justify-center rounded-full transition-all ${
                  variant === 'dots' ? 'w-3 h-3' :
                  'w-10 h-10 text-sm font-medium'
                } ${
                  isActive ? 'bg-blue-500 text-white ring-4 ring-blue-100 dark:ring-blue-500/20' :
                  isCompleted ? 'bg-blue-500 text-white' :
                  'bg-nexus-surface text-nexus-muted'
                }`}
              >
                {variant !== 'dots' && (
                  isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : step.icon || i + 1
                )}
              </motion.button>

              {i < steps.length - 1 && (
                <div className={`${isHorizontal ? 'flex-1 h-0.5' : 'w-0.5 h-6'} ${i < currentStep ? 'bg-blue-500' : 'bg-nexus-surface'}`} />
              )}
            </div>

            <div className={`${isHorizontal ? 'text-center mt-2' : 'flex-1'}`}>
              <div className={`text-sm font-medium ${isActive ? 'text-blue-500' : isCompleted ? 'text-nexus-text' : 'text-nexus-muted'}`}>
                {step.label}
              </div>
              {step.description && (
                <div className="text-xs text-nexus-muted mt-0.5">{step.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Timeline Component
// ============================================================
interface TimelineItem {
  title: string;
  description?: string;
  time?: string;
  icon?: React.ReactNode;
  color?: string;
  content?: React.ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  variant?: 'default' | 'alternating' | 'compact';
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  items, variant = 'default', className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      {variant === 'alternating' ? (
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-nexus-surface" />
          {items.map((item, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, x: isLeft ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`flex items-center mb-8 ${isLeft ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-5/12 ${isLeft ? 'text-right pr-8' : 'pl-8'}`}>
                  <h4 className="text-sm font-semibold text-nexus-text">{item.title}</h4>
                  {item.description && <p className="text-xs text-nexus-muted mt-0.5">{item.description}</p>}
                  {item.time && <span className="text-[10px] text-nexus-muted">{item.time}</span>}
                </div>
                <div className={`w-8 h-8 rounded-full ${item.color || 'bg-blue-500'} text-white flex items-center justify-center z-10 flex-shrink-0`}>
                  {item.icon || <div className="w-2 h-2 bg-nexus-card rounded-full" />}
                </div>
                <div className="w-5/12" />
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((item, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-4"
            >
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full ${item.color || 'bg-blue-500'} text-white flex items-center justify-center flex-shrink-0 ${variant === 'compact' ? 'w-4 h-4' : ''}`}>
                  {variant !== 'compact' && (item.icon || <div className="w-1.5 h-1.5 bg-nexus-card rounded-full" />)}
                </div>
                {i < items.length - 1 && (
                  <div className="w-px flex-1 bg-nexus-surface my-1" />
                )}
              </div>
              <div className={`pb-6 ${variant === 'compact' ? 'pb-3' : ''}`}>
                <div className="flex items-center gap-2">
                  <h4 className={`font-medium text-nexus-text ${variant === 'compact' ? 'text-xs' : 'text-sm'}`}>{item.title}</h4>
                  {item.time && <span className="text-[10px] text-nexus-muted">{item.time}</span>}
                </div>
                {item.description && <p className={`text-nexus-muted mt-0.5 ${variant === 'compact' ? 'text-[10px]' : 'text-xs'}`}>{item.description}</p>}
                {item.content && <div className="mt-2">{item.content}</div>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// TreeView Component
// ============================================================
interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  data?: any;
}

interface TreeViewProps {
  nodes: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  selectedId?: string;
  defaultExpanded?: string[];
  className?: string;
}

const TreeNodeComponent: React.FC<{
  node: TreeNode; level: number; onSelect?: (node: TreeNode) => void;
  selectedId?: string; expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}> = ({ node, level, onSelect, selectedId, expandedIds, toggleExpand }) => {
  const hasChildren = (node.children?.length || 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <motion.div
        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer select-none transition-colors ${
          isSelected ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-nexus-text'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) toggleExpand(node.id);
          onSelect?.(node);
        }}
      >
        {hasChildren ? (
          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} className="text-nexus-muted">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </motion.div>
        ) : (
          <div className="w-3" />
        )}
        {node.icon && <span className="flex-shrink-0">{node.icon}</span>}
        <span className="text-sm truncate">{node.label}</span>
      </motion.div>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children!.map(child => (
              <TreeNodeComponent key={child.id} node={child} level={level + 1}
                onSelect={onSelect} selectedId={selectedId}
                expandedIds={expandedIds} toggleExpand={toggleExpand} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const TreeView: React.FC<TreeViewProps> = ({
  nodes, onSelect, selectedId, defaultExpanded = [], className = '',
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(defaultExpanded));

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className={`${className}`}>
      {nodes.map(node => (
        <TreeNodeComponent key={node.id} node={node} level={0}
          onSelect={onSelect} selectedId={selectedId}
          expandedIds={expandedIds} toggleExpand={toggleExpand} />
      ))}
    </div>
  );
};

// ============================================================
// ColorPicker Component
// ============================================================
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  showInput?: boolean;
  className?: string;
}

const defaultPresets = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6b7280',
  '#1e293b', '#ffffff',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value, onChange, presets = defaultPresets, showInput = true, className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-nexus-border bg-nexus-card hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
        <div className="w-6 h-6 rounded-lg border border-nexus-border shadow-inner" style={{ backgroundColor: value }} />
        <span className="text-sm text-nexus-text font-mono">{value}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute z-50 mt-2 p-3 bg-nexus-card rounded-xl shadow-2xl border border-nexus-border"
          >
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {presets.map(color => (
                <button key={color} onClick={() => { onChange(color); setIsOpen(false); }}
                  className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${
                    value === color ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : ''
                  }`}
                  style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #e5e7eb' : 'none' }}
                />
              ))}
            </div>
            {showInput && (
              <input type="text" value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-nexus-surface border border-nexus-border text-sm font-mono text-nexus-text focus:outline-none focus:ring-1 focus:ring-nexus-primary" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================
// FileUpload Component
// ============================================================
interface FileUploadProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  children?: React.ReactNode;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFiles, accept, multiple = false, maxSize, children, className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    let fileArray = Array.from(files);
    if (maxSize) fileArray = fileArray.filter(f => f.size <= maxSize);
    onFiles(fileArray);
  };

  return (
    <div
      className={`relative ${className}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
    >
      <input ref={fileInputRef} type="file" accept={accept} multiple={multiple}
        onChange={e => handleFiles(e.target.files)} className="hidden" />
      <motion.div
        animate={{ borderColor: isDragging ? '#3b82f6' : '#e5e7eb', backgroundColor: isDragging ? 'rgba(59,130,246,0.05)' : 'transparent' }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-blue-300 dark:hover:border-blue-600"
      >
        {children || (
          <div>
            <svg className="w-8 h-8 mx-auto text-nexus-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-nexus-muted">
              <span className="text-blue-500 font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-nexus-muted mt-1">
              {accept || 'Any file type'}{maxSize ? ` · Max ${(maxSize / 1024 / 1024).toFixed(0)}MB` : ''}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ============================================================
// Notification Panel Component
// ============================================================
interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface NotificationPanelProps {
  notifications: NotificationItem[];
  onMarkRead?: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
}

const typeStyles = {
  info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
  success: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30',
  warning: 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30',
  error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
};

const typeDots = { info: 'bg-blue-500', success: 'bg-green-500', warning: 'bg-yellow-500', error: 'bg-red-500' };

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications, onMarkRead, onClearAll, className = '',
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`bg-nexus-card rounded-2xl border border-nexus-border overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-nexus-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-nexus-text">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">{unreadCount}</span>
          )}
        </div>
        {onClearAll && (
          <button onClick={onClearAll} className="text-xs text-nexus-muted hover:text-nexus-text dark:hover:text-nexus-muted">
            Clear all
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-nexus-muted">No notifications</div>
        ) : (
          notifications.map(n => (
            <motion.div key={n.id} whileHover={{ backgroundColor: 'rgba(59,130,246,0.03)' }}
              className={`px-4 py-3 border-b border-nexus-border/50 cursor-pointer ${!n.read ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
              onClick={() => onMarkRead?.(n.id)}>
              <div className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${typeDots[n.type]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm ${!n.read ? 'font-semibold text-nexus-text' : 'text-nexus-text'}`}>{n.title}</h4>
                    <span className="text-[10px] text-nexus-muted ml-2 flex-shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-nexus-muted mt-0.5 truncate">{n.message}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================
// StatCard Component
// ============================================================
interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  chart?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title, value, change, changeLabel, icon, color = 'text-blue-500', chart, className = '',
}) => {
  return (
    <motion.div whileHover={{ y: -4 }}
      className={`bg-nexus-card rounded-2xl p-5 border border-nexus-border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        {icon && <div className={`${color}`}>{icon}</div>}
        {change !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            change >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
            'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
          }`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-nexus-text mb-1">{value}</div>
      <div className="text-sm text-nexus-muted">{title}</div>
      {changeLabel && <div className="text-xs text-nexus-muted mt-0.5">{changeLabel}</div>}
      {chart && <div className="mt-3">{chart}</div>}
    </motion.div>
  );
};

// ============================================================
// EmptyState Component
// ============================================================
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon, title, description, action, className = '',
}) => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {icon && <div className="text-nexus-muted dark:text-nexus-muted mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-nexus-text mb-1">{title}</h3>
      {description && <p className="text-sm text-nexus-muted max-w-sm">{description}</p>}
      {action && (
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
};

// ============================================================
// CommandBar Component
// ============================================================
interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category?: string;
}

interface CommandBarProps {
  items: CommandItem[];
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  items, isOpen, onClose, placeholder = 'Type a command...',
}) => {
  const [query, setQuery] = useState('');
  const filtered = items.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.description?.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="w-full max-w-lg bg-nexus-card rounded-2xl shadow-2xl border border-nexus-border overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-nexus-border">
            <svg className="w-5 h-5 text-nexus-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-nexus-text text-sm placeholder-gray-400 focus:outline-none" />
            <kbd className="hidden md:inline-flex px-2 py-0.5 bg-nexus-surface rounded text-[10px] text-nexus-muted">ESC</kbd>
          </div>
          <div className="max-h-72 overflow-y-auto py-2">
            {Object.entries(grouped).map(([category, catItems]) => (
              <div key={category}>
                <div className="px-4 py-1 text-[10px] font-medium text-nexus-muted uppercase tracking-wider">{category}</div>
                {catItems.map(item => (
                  <motion.button key={item.id}
                    whileHover={{ backgroundColor: 'rgba(59,130,246,0.08)' }}
                    onClick={() => { item.action(); onClose(); setQuery(''); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
                    {item.icon && <span className="text-nexus-muted">{item.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-nexus-text">{item.label}</div>
                      {item.description && <div className="text-xs text-nexus-muted truncate">{item.description}</div>}
                    </div>
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 bg-nexus-surface rounded text-[10px] text-nexus-muted font-mono">{item.shortcut}</kbd>
                    )}
                  </motion.button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-nexus-muted">No results found</div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
