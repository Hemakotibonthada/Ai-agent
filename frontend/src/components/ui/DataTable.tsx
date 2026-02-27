/**
 * DataTable Component - Advanced sortable, filterable, paginated data table
 * Features: Column sorting, search, pagination, row selection, export, responsive
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Download, Filter, X, Check, Columns, RefreshCw,
  ArrowUpDown, MoreHorizontal, Eye, Trash2, Edit2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/* ── Types ──────────────────────────────────────────────────────────── */
export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T = any> {
  key: string;
  title: string;
  width?: string | number;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  hidden?: boolean;
  sticky?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  sortFn?: (a: T, b: T) => number;
  filterFn?: (value: any, filter: string) => boolean;
  exportFn?: (value: any, row: T) => string;
}

export interface DataTableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyField?: string;
  className?: string;
  variant?: 'default' | 'striped' | 'bordered' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  selectable?: boolean;
  searchable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  stickyHeader?: boolean;
  maxHeight?: string | number;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  actions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  onSelectionChange?: (selected: T[]) => void;
  onExport?: (data: T[], format: 'csv' | 'json') => void;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  rowClassName?: (row: T, index: number) => string;
  expandable?: boolean;
  renderExpanded?: (row: T) => React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/* ── Skeleton Row Component ──────────────────────────────────────────── */
const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-nexus-card/10 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

/* ── Pagination Component ────────────────────────────────────────────── */
const Pagination: React.FC<{
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}> = ({ page, totalPages, pageSize, totalItems, pageSizeOptions, onPageChange, onPageSizeChange }) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/50">
          Showing {start}-{end} of {totalItems}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="bg-nexus-card/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size} className="bg-nexus-bg">
              {size} / page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-nexus-card/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-nexus-card/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                'w-8 h-8 rounded-lg text-sm font-medium transition-all',
                pageNum === page
                  ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
                  : 'hover:bg-nexus-card/10 text-white/70'
              )}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-nexus-card/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-nexus-card/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ── Sort Icon Component ──────────────────────────────────────────────── */
const SortIcon: React.FC<{ direction: SortDirection }> = ({ direction }) => {
  if (!direction) return <ChevronsUpDown className="w-3.5 h-3.5 text-white/30" />;
  return direction === 'asc' ? (
    <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
  );
};

/* ── Main Component ─────────────────────────────────────────────────── */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  keyField = 'id',
  className,
  variant = 'default',
  size = 'md',
  selectable = false,
  searchable = true,
  paginated = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  stickyHeader = true,
  maxHeight,
  emptyMessage = 'No data available',
  actions,
  onRowClick,
  onSelectionChange,
  onExport,
  toolbar,
  footer,
  rowClassName,
  expandable = false,
  renderExpanded,
  refreshing = false,
  onRefresh,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(columns.filter((c) => !c.hidden).map((c) => c.key))
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const tableRef = useRef<HTMLDivElement>(null);

  // Visible columns
  const displayColumns = useMemo(
    () => columns.filter((c) => visibleCols.has(c.key)),
    [columns, visibleCols]
  );

  // Filter data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      const searchCols = columns.filter((c) => c.searchable !== false);
      result = result.filter((row) =>
        searchCols.some((col) => {
          const val = row[col.key];
          return val != null && String(val).toLowerCase().includes(searchLower);
        })
      );
    }

    // Column filters
    Object.entries(activeFilters).forEach(([key, filterVal]) => {
      if (!filterVal) return;
      const col = columns.find((c) => c.key === key);
      result = result.filter((row) => {
        if (col?.filterFn) return col.filterFn(row[key], filterVal);
        return String(row[key] ?? '').toLowerCase().includes(filterVal.toLowerCase());
      });
    });

    return result;
  }, [data, search, activeFilters, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    return [...filteredData].sort((a, b) => {
      if (col?.sortFn) {
        const result = col.sortFn(a, b);
        return sortDir === 'desc' ? -result : result;
      }
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = typeof aVal === 'number' ? aVal - (bVal as number) : String(aVal).localeCompare(String(bVal));
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredData, sortKey, sortDir, columns]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = paginated ? sortedData.slice((page - 1) * pageSize, page * pageSize) : sortedData;

  // Reset page on search/filter change
  useEffect(() => { setPage(1); }, [search, activeFilters, pageSize]);

  // Selection handlers
  const toggleSelectAll = useCallback(() => {
    if (selected.size === paginatedData.length) {
      setSelected(new Set());
      onSelectionChange?.([]);
    } else {
      const newSelected = new Set(paginatedData.map((r) => r[keyField]));
      setSelected(newSelected);
      onSelectionChange?.(paginatedData);
    }
  }, [paginatedData, selected, keyField, onSelectionChange]);

  const toggleSelect = useCallback(
    (row: T) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const key = row[keyField];
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onSelectionChange?.(data.filter((r) => next.has(r[keyField])));
        return next;
      });
    },
    [data, keyField, onSelectionChange]
  );

  const toggleExpand = useCallback((key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'));
        if (sortDir === 'desc') setSortKey(null);
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey, sortDir]
  );

  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      if (onExport) {
        onExport(sortedData, format);
        return;
      }

      if (format === 'csv') {
        const headers = displayColumns.map((c) => c.title).join(',');
        const rows = sortedData.map((row) =>
          displayColumns.map((c) => {
            if (c.exportFn) return c.exportFn(row[c.key], row);
            const val = row[c.key];
            return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const json = JSON.stringify(sortedData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [sortedData, displayColumns, onExport]
  );

  /* ── Size styles ───────────────────────────────────────────── */
  const sizeStyles = {
    sm: { cell: 'px-3 py-2 text-xs', header: 'px-3 py-2 text-xs' },
    md: { cell: 'px-4 py-3 text-sm', header: 'px-4 py-2.5 text-xs' },
    lg: { cell: 'px-5 py-4 text-base', header: 'px-5 py-3 text-sm' },
  };

  const s = sizeStyles[size];

  const allSelected = paginatedData.length > 0 && selected.size === paginatedData.length;

  return (
    <div className={cn('rounded-xl border border-white/10 overflow-hidden bg-nexus-card/[0.02]', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 flex-1">
          {searchable && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-8 py-2 bg-nexus-card/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-nexus-card/10"
                >
                  <X className="w-3.5 h-3.5 text-white/40" />
                </button>
              )}
            </div>
          )}

          {selected.size > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium"
            >
              {selected.size} selected
            </motion.span>
          )}

          {toolbar}
        </div>

        <div className="flex items-center gap-1.5">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={cn(
                'p-2 rounded-lg hover:bg-nexus-card/10 transition-colors',
                refreshing && 'animate-spin'
              )}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-white/50" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="p-2 rounded-lg hover:bg-nexus-card/10 transition-colors"
              title="Toggle columns"
            >
              <Columns className="w-4 h-4 text-white/50" />
            </button>

            <AnimatePresence>
              {showColumnPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 top-full mt-1 w-48 bg-nexus-bg border border-white/10 rounded-xl shadow-2xl z-50 py-1"
                >
                  {columns.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => {
                        setVisibleCols((prev) => {
                          const next = new Set(prev);
                          if (next.has(col.key) && next.size > 1) next.delete(col.key);
                          else next.add(col.key);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:bg-nexus-card/5 transition-colors"
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          visibleCols.has(col.key)
                            ? 'bg-cyan-500 border-cyan-500'
                            : 'border-white/20'
                        )}
                      >
                        {visibleCols.has(col.key) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {col.title}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => handleExport('csv')}
            className="p-2 rounded-lg hover:bg-nexus-card/10 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4 text-white/50" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="overflow-auto"
        style={{ maxHeight: maxHeight ?? 'auto' }}
      >
        <table className="w-full">
          <thead className={cn(stickyHeader && 'sticky top-0 z-10 bg-gray-900/95 backdrop-blur')}>
            <tr className="border-b border-white/10">
              {selectable && (
                <th className={cn(s.header, 'w-10')}>
                  <button
                    onClick={toggleSelectAll}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                      allSelected ? 'bg-cyan-500 border-cyan-500' : 'border-white/20 hover:border-white/40'
                    )}
                  >
                    {allSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                </th>
              )}
              {expandable && <th className={cn(s.header, 'w-10')} />}
              {displayColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    s.header,
                    'font-semibold text-white/60 uppercase tracking-wider whitespace-nowrap',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    col.sortable !== false && 'cursor-pointer select-none hover:text-white/80',
                    col.sticky && 'sticky left-0 bg-gray-900/95'
                  )}
                  style={{
                    width: col.width ?? 'auto',
                    minWidth: col.minWidth ?? 'auto',
                  }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className={cn('flex items-center gap-1.5', col.align === 'right' && 'justify-end')}>
                    {col.headerRender ? col.headerRender() : col.title}
                    {col.sortable !== false && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                  </div>
                </th>
              ))}
              {actions && <th className={cn(s.header, 'w-16 text-right font-semibold text-white/60 uppercase tracking-wider')}>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow
                  key={i}
                  cols={displayColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (actions ? 1 : 0)}
                />
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={displayColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (actions ? 1 : 0)}
                  className="py-12 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-nexus-card/5 flex items-center justify-center">
                      <Search className="w-5 h-5 text-white/30" />
                    </div>
                    <p className="text-white/50 text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const rowKey = row[keyField] ?? idx;
                const isSelected = selected.has(rowKey);
                const isExpanded = expandedRows.has(String(rowKey));

                return (
                  <React.Fragment key={rowKey}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => onRowClick?.(row, idx)}
                      className={cn(
                        'border-b border-white/5 transition-colors',
                        onRowClick && 'cursor-pointer',
                        isSelected && 'bg-cyan-500/5',
                        variant === 'striped' && idx % 2 === 1 && 'bg-nexus-card/[0.02]',
                        'hover:bg-nexus-card/[0.04]',
                        rowClassName?.(row, idx)
                      )}
                    >
                      {selectable && (
                        <td className={cn(s.cell, 'w-10')} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSelect(row)}
                            className={cn(
                              'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-cyan-500 border-cyan-500'
                                : 'border-white/20 hover:border-white/40'
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                      )}
                      {expandable && (
                        <td className={cn(s.cell, 'w-10')} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleExpand(String(rowKey))}
                            className="p-1 rounded hover:bg-nexus-card/10 transition-colors"
                          >
                            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                              <ChevronRight className="w-4 h-4 text-white/50" />
                            </motion.div>
                          </button>
                        </td>
                      )}
                      {displayColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            s.cell,
                            'text-white/80',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right',
                            col.sticky && 'sticky left-0 bg-gray-900/80 backdrop-blur'
                          )}
                        >
                          {col.render ? col.render(row[col.key], row, idx) : (row[col.key] ?? '—')}
                        </td>
                      ))}
                      {actions && (
                        <td className={cn(s.cell, 'text-right')} onClick={(e) => e.stopPropagation()}>
                          {actions(row)}
                        </td>
                      )}
                    </motion.tr>

                    {/* Expanded row */}
                    <AnimatePresence>
                      {expandable && isExpanded && renderExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td
                            colSpan={displayColumns.length + (selectable ? 1 : 0) + 1 + (actions ? 1 : 0)}
                            className="px-4 py-3 bg-nexus-card/[0.02]"
                          >
                            {renderExpanded(row)}
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && !loading && sortedData.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedData.length}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {/* Footer */}
      {footer && (
        <div className="px-4 py-3 border-t border-white/10">{footer}</div>
      )}
    </div>
  );
}

export default DataTable;
