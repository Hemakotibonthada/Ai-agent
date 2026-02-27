import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Table2, Search, Plus, Trash2, Edit3,
  Eye, Download, Upload, RefreshCw, Filter, Settings,
  ChevronRight, ChevronDown, Copy, Check, X, Hash,
  Key, Calendar, ToggleLeft, Type, List, Code,
  AlertCircle, Clock, HardDrive, Layers, FileJson
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';
import EmptyState from '@/components/shared/EmptyState';

interface TableInfo {
  name: string;
  rows: number;
  size: string;
  columns: Column[];
  lastModified: string;
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primary?: boolean;
  foreign?: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  time: number;
  rowCount: number;
}

const tables: TableInfo[] = [
  {
    name: 'users', rows: 142, size: '2.4 MB', lastModified: '2 hours ago',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primary: true },
      { name: 'username', type: 'VARCHAR(100)', nullable: false },
      { name: 'email', type: 'VARCHAR(255)', nullable: false },
      { name: 'password_hash', type: 'VARCHAR(255)', nullable: false },
      { name: 'role', type: 'VARCHAR(50)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
      { name: 'last_login', type: 'TIMESTAMP', nullable: true },
      { name: 'is_active', type: 'BOOLEAN', nullable: false },
    ],
  },
  {
    name: 'agent_logs', rows: 15420, size: '45.8 MB', lastModified: '1 minute ago',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primary: true },
      { name: 'agent_name', type: 'VARCHAR(50)', nullable: false },
      { name: 'action', type: 'VARCHAR(200)', nullable: false },
      { name: 'result', type: 'TEXT', nullable: true },
      { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
      { name: 'user_id', type: 'INTEGER', nullable: true, foreign: 'users.id' },
    ],
  },
  {
    name: 'tasks', rows: 847, size: '4.2 MB', lastModified: '30 minutes ago',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primary: true },
      { name: 'title', type: 'VARCHAR(200)', nullable: false },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'status', type: 'VARCHAR(20)', nullable: false },
      { name: 'priority', type: 'VARCHAR(10)', nullable: false },
      { name: 'assigned_to', type: 'INTEGER', nullable: true, foreign: 'users.id' },
      { name: 'due_date', type: 'DATE', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'health_records', rows: 2340, size: '8.9 MB', lastModified: '4 hours ago',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primary: true },
      { name: 'user_id', type: 'INTEGER', nullable: false, foreign: 'users.id' },
      { name: 'metric_type', type: 'VARCHAR(50)', nullable: false },
      { name: 'value', type: 'FLOAT', nullable: false },
      { name: 'unit', type: 'VARCHAR(20)', nullable: false },
      { name: 'recorded_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'smart_home_events', rows: 45200, size: '128 MB', lastModified: '5 seconds ago',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primary: true },
      { name: 'device_id', type: 'VARCHAR(50)', nullable: false },
      { name: 'event_type', type: 'VARCHAR(50)', nullable: false },
      { name: 'payload', type: 'JSONB', nullable: true },
      { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'workflows', rows: 28, size: '0.5 MB', lastModified: '1 day ago',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primary: true },
      { name: 'name', type: 'VARCHAR(100)', nullable: false },
      { name: 'definition', type: 'JSONB', nullable: false },
      { name: 'status', type: 'VARCHAR(20)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'analytics_events', rows: 98450, size: '312 MB', lastModified: '10 seconds ago',
    columns: [
      { name: 'id', type: 'BIGINT', nullable: false, primary: true },
      { name: 'event_name', type: 'VARCHAR(100)', nullable: false },
      { name: 'properties', type: 'JSONB', nullable: true },
      { name: 'session_id', type: 'VARCHAR(50)', nullable: false },
      { name: 'timestamp', type: 'TIMESTAMP', nullable: false },
    ],
  },
  {
    name: 'api_keys', rows: 12, size: '0.1 MB', lastModified: '3 days ago',
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, primary: true },
      { name: 'user_id', type: 'INTEGER', nullable: false, foreign: 'users.id' },
      { name: 'key_hash', type: 'VARCHAR(255)', nullable: false },
      { name: 'name', type: 'VARCHAR(100)', nullable: false },
      { name: 'expires_at', type: 'TIMESTAMP', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
  },
];

const sampleQueryResults: QueryResult = {
  columns: ['id', 'username', 'email', 'role', 'is_active', 'last_login'],
  rows: [
    { id: 1, username: 'admin', email: 'admin@nexusai.local', role: 'admin', is_active: true, last_login: '2024-03-10 14:30:00' },
    { id: 2, username: 'demo_user', email: 'demo@nexusai.local', role: 'user', is_active: true, last_login: '2024-03-09 09:15:00' },
    { id: 3, username: 'agent_service', email: 'agent@nexusai.local', role: 'service', is_active: true, last_login: '2024-03-10 14:35:00' },
    { id: 4, username: 'viewer', email: 'viewer@nexusai.local', role: 'viewer', is_active: false, last_login: '2024-03-05 11:20:00' },
    { id: 5, username: 'developer', email: 'dev@nexusai.local', role: 'developer', is_active: true, last_login: '2024-03-10 13:45:00' },
  ],
  time: 12,
  rowCount: 5,
};

const typeColors: Record<string, string> = {
  INTEGER: 'text-blue-500', BIGINT: 'text-blue-500', FLOAT: 'text-blue-400',
  VARCHAR: 'text-green-500', TEXT: 'text-green-400',
  BOOLEAN: 'text-orange-500', TIMESTAMP: 'text-purple-500', DATE: 'text-purple-400',
  JSONB: 'text-yellow-500', JSON: 'text-yellow-500',
};

const sizeData = tables.map(t => ({ name: t.name, size: parseFloat(t.size) })).sort((a, b) => b.size - a.size);
const rowData = tables.map(t => ({ name: t.name, rows: t.rows })).sort((a, b) => b.rows - a.rows).slice(0, 5);

const DatabaseBrowser: React.FC = () => {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No database connected" description="Configure a database connection to browse tables and run queries." /></div>;
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [query, setQuery] = useState('SELECT id, username, email, role, is_active, last_login\nFROM users\nWHERE is_active = true\nLIMIT 10;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<'tables' | 'query' | 'stats'>('tables');
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const filteredTables = useMemo(() =>
    tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase())),
  [search]);

  const runQuery = () => {
    setQueryResult(sampleQueryResults);
  };

  const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
  const totalSize = tables.reduce((sum, t) => sum + parseFloat(t.size), 0);

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Database className="text-blue-500" size={32} />
              Database Browser
            </h1>
            <p className="text-gray-500 mt-1">{tables.length} tables · {totalRows.toLocaleString()} rows · {totalSize.toFixed(1)} MB</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">
              <Plus size={14} /> New Table
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
              <Upload size={14} /> Import
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* View Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(['tables', 'query', 'stats'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveView(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeView === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}>
            {tab === 'tables' && <Table2 size={14} className="inline mr-1" />}
            {tab === 'query' && <Code size={14} className="inline mr-1" />}
            {tab === 'stats' && <HardDrive size={14} className="inline mr-1" />}
            {tab}
          </button>
        ))}
      </div>

      {activeView === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table List */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search tables..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              {filteredTables.map(table => (
                <motion.div key={table.name} whileHover={{ x: 4 }}>
                  <button
                    onClick={() => { setSelectedTable(table); setExpandedTable(expandedTable === table.name ? null : table.name); }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selectedTable?.name === table.name
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Table2 size={14} className="text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">{table.name}</span>
                      <ChevronRight size={12} className={`ml-auto text-gray-400 transition-transform ${expandedTable === table.name ? 'rotate-90' : ''}`} />
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
                      <span>{table.rows.toLocaleString()} rows</span>
                      <span>{table.size}</span>
                      <span>{table.lastModified}</span>
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedTable === table.name && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="ml-4 mt-1 space-y-0.5">
                          {table.columns.map(col => (
                            <div key={col.name} className="flex items-center gap-2 px-2 py-1 text-xs">
                              {col.primary && <Key size={10} className="text-yellow-500" />}
                              {col.foreign && <ChevronRight size={10} className="text-blue-400" />}
                              {!col.primary && !col.foreign && <div className="w-2.5" />}
                              <span className="font-mono text-gray-700 dark:text-gray-300">{col.name}</span>
                              <span className={`font-mono text-[10px] ${typeColors[col.type.split('(')[0]] || 'text-gray-400'}`}>
                                {col.type}
                              </span>
                              {col.nullable && <span className="text-gray-400 text-[9px]">NULL</span>}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Table Detail / Schema */}
          <div className="lg:col-span-2">
            {selectedTable ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white font-mono">{selectedTable.name}</h3>
                    <p className="text-xs text-gray-500">{selectedTable.rows.toLocaleString()} rows · {selectedTable.columns.length} columns · {selectedTable.size}</p>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Eye size={14} /></button>
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Download size={14} /></button>
                    <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Column</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Nullable</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {selectedTable.columns.map(col => (
                      <tr key={col.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-white">{col.name}</td>
                        <td className={`px-4 py-2 text-sm font-mono ${typeColors[col.type.split('(')[0]] || 'text-gray-400'}`}>{col.type}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{col.nullable ? 'YES' : 'NO'}</td>
                        <td className="px-4 py-2 text-sm">
                          {col.primary && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded text-[10px] font-bold">PK</span>}
                          {col.foreign && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[10px] font-bold">FK → {col.foreign}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Database size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Select a Table</h3>
                <p className="text-sm text-gray-500 mt-1">Choose a table from the sidebar to view its schema</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'query' && (
        <FadeIn delay={0.1}>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <span className="text-xs font-semibold text-gray-500">SQL Editor</span>
                <div className="flex gap-2">
                  <button className="text-xs text-gray-500 hover:text-gray-700">Format</button>
                  <button className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
                </div>
              </div>
              <textarea value={query} onChange={e => setQuery(e.target.value)} rows={6}
                className="w-full px-4 py-3 bg-gray-900 text-green-400 text-sm font-mono outline-none resize-none" />
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">Ctrl+Enter to execute</span>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={runQuery}
                  className="flex items-center gap-2 px-4 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium">
                  ▶ Run Query
                </motion.button>
              </div>
            </div>

            {queryResult && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Results</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{queryResult.rowCount} rows</span>
                    <span>{queryResult.time}ms</span>
                    <button className="flex items-center gap-1 hover:text-gray-700"><Download size={10} /> CSV</button>
                    <button className="flex items-center gap-1 hover:text-gray-700"><FileJson size={10} /> JSON</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        {queryResult.columns.map(col => (
                          <th key={col} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 font-mono whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {queryResult.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          {queryResult.columns.map(col => (
                            <td key={col} className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-white whitespace-nowrap">
                              {typeof row[col] === 'boolean' ? (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${row[col] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {row[col].toString()}
                                </span>
                              ) : row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {activeView === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FadeIn delay={0.1}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Table Sizes (MB)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sizeData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#6b7280" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="#6b7280" width={120} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                  <Bar dataKey="size" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Top Tables by Rows</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rowData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                  <Bar dataKey="rows" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
};

export default DatabaseBrowser;
