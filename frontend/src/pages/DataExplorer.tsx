import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Table, Search, Filter, ChevronDown, ChevronRight,
  Plus, Trash2, Edit3, Copy, Download, RefreshCw, Play,
  Eye, Columns, ArrowUp, ArrowDown, BarChart3, Clock,
  HardDrive, Layers, Key, Hash, Type, Calendar, ToggleLeft,
  Link2, Zap, AlertTriangle, CheckCircle, Code2
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'uuid' | 'enum' | 'relation';

interface Field {
  name: string;
  type: FieldType;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  indexed: boolean;
  default?: string;
  references?: string;
}

interface TableInfo {
  name: string;
  schema: string;
  rows: number;
  size: string;
  fields: Field[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
  lastModified: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  executionTime: number;
  rowCount: number;
}

const fieldTypeIcons: Record<FieldType, React.ElementType> = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  json: Code2,
  uuid: Key,
  enum: Layers,
  relation: Link2,
};

const fieldTypeColors: Record<FieldType, string> = {
  string: '#10b981',
  number: '#3b82f6',
  boolean: '#f59e0b',
  date: '#8b5cf6',
  json: '#ec4899',
  uuid: '#6366f1',
  enum: '#06b6d4',
  relation: '#f97316',
};

const tables: TableInfo[] = [
  {
    name: 'users', schema: 'public', rows: 15432, size: '24.5 MB', lastModified: '2025-07-14T09:30:00Z',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: true, indexed: true, default: 'gen_random_uuid()' },
      { name: 'email', type: 'string', nullable: false, primaryKey: false, unique: true, indexed: true },
      { name: 'username', type: 'string', nullable: false, primaryKey: false, unique: true, indexed: true },
      { name: 'password_hash', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: false },
      { name: 'role', type: 'enum', nullable: false, primaryKey: false, unique: false, indexed: true, default: "'user'" },
      { name: 'is_active', type: 'boolean', nullable: false, primaryKey: false, unique: false, indexed: true, default: 'true' },
      { name: 'last_login', type: 'date', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'metadata', type: 'json', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'created_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: true, default: 'now()' },
      { name: 'updated_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: false, default: 'now()' },
    ],
    indexes: [
      { name: 'users_pkey', columns: ['id'], unique: true },
      { name: 'users_email_idx', columns: ['email'], unique: true },
      { name: 'users_username_idx', columns: ['username'], unique: true },
      { name: 'users_role_active_idx', columns: ['role', 'is_active'], unique: false },
    ],
  },
  {
    name: 'tasks', schema: 'public', rows: 45678, size: '67.2 MB', lastModified: '2025-07-14T09:28:00Z',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: true, indexed: true },
      { name: 'title', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: true },
      { name: 'description', type: 'string', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'status', type: 'enum', nullable: false, primaryKey: false, unique: false, indexed: true, default: "'pending'" },
      { name: 'priority', type: 'number', nullable: false, primaryKey: false, unique: false, indexed: true, default: '0' },
      { name: 'assignee_id', type: 'uuid', nullable: true, primaryKey: false, unique: false, indexed: true, references: 'users.id' },
      { name: 'due_date', type: 'date', nullable: true, primaryKey: false, unique: false, indexed: true },
      { name: 'tags', type: 'json', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'created_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: true },
    ],
    indexes: [
      { name: 'tasks_pkey', columns: ['id'], unique: true },
      { name: 'tasks_status_idx', columns: ['status'], unique: false },
      { name: 'tasks_assignee_idx', columns: ['assignee_id'], unique: false },
      { name: 'tasks_due_date_idx', columns: ['due_date'], unique: false },
    ],
  },
  {
    name: 'sessions', schema: 'public', rows: 8923, size: '12.1 MB', lastModified: '2025-07-14T09:25:00Z',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: true, indexed: true },
      { name: 'user_id', type: 'uuid', nullable: false, primaryKey: false, unique: false, indexed: true, references: 'users.id' },
      { name: 'token', type: 'string', nullable: false, primaryKey: false, unique: true, indexed: true },
      { name: 'ip_address', type: 'string', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'user_agent', type: 'string', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'expires_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: true },
      { name: 'created_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: false },
    ],
    indexes: [
      { name: 'sessions_pkey', columns: ['id'], unique: true },
      { name: 'sessions_token_idx', columns: ['token'], unique: true },
      { name: 'sessions_user_idx', columns: ['user_id'], unique: false },
    ],
  },
  {
    name: 'api_keys', schema: 'public', rows: 234, size: '1.8 MB', lastModified: '2025-07-14T08:00:00Z',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: true, indexed: true },
      { name: 'user_id', type: 'uuid', nullable: false, primaryKey: false, unique: false, indexed: true, references: 'users.id' },
      { name: 'name', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: false },
      { name: 'key_hash', type: 'string', nullable: false, primaryKey: false, unique: true, indexed: true },
      { name: 'scopes', type: 'json', nullable: false, primaryKey: false, unique: false, indexed: false },
      { name: 'rate_limit', type: 'number', nullable: false, primaryKey: false, unique: false, indexed: false, default: '1000' },
      { name: 'is_active', type: 'boolean', nullable: false, primaryKey: false, unique: false, indexed: true, default: 'true' },
      { name: 'last_used', type: 'date', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'expires_at', type: 'date', nullable: true, primaryKey: false, unique: false, indexed: false },
    ],
    indexes: [
      { name: 'api_keys_pkey', columns: ['id'], unique: true },
      { name: 'api_keys_hash_idx', columns: ['key_hash'], unique: true },
    ],
  },
  {
    name: 'audit_logs', schema: 'public', rows: 289456, size: '156.3 MB', lastModified: '2025-07-14T09:32:00Z',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: true, indexed: true },
      { name: 'user_id', type: 'uuid', nullable: true, primaryKey: false, unique: false, indexed: true, references: 'users.id' },
      { name: 'action', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: true },
      { name: 'resource_type', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: true },
      { name: 'resource_id', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: true },
      { name: 'changes', type: 'json', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'ip_address', type: 'string', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'created_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: true },
    ],
    indexes: [
      { name: 'audit_logs_pkey', columns: ['id'], unique: true },
      { name: 'audit_logs_user_idx', columns: ['user_id'], unique: false },
      { name: 'audit_logs_action_idx', columns: ['action', 'resource_type'], unique: false },
      { name: 'audit_logs_created_at_idx', columns: ['created_at'], unique: false },
    ],
  },
  {
    name: 'notifications', schema: 'public', rows: 78901, size: '34.7 MB', lastModified: '2025-07-14T09:20:00Z',
    fields: [
      { name: 'id', type: 'uuid', nullable: false, primaryKey: true, unique: true, indexed: true },
      { name: 'user_id', type: 'uuid', nullable: false, primaryKey: false, unique: false, indexed: true, references: 'users.id' },
      { name: 'type', type: 'enum', nullable: false, primaryKey: false, unique: false, indexed: true },
      { name: 'title', type: 'string', nullable: false, primaryKey: false, unique: false, indexed: false },
      { name: 'body', type: 'string', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'is_read', type: 'boolean', nullable: false, primaryKey: false, unique: false, indexed: true, default: 'false' },
      { name: 'metadata', type: 'json', nullable: true, primaryKey: false, unique: false, indexed: false },
      { name: 'created_at', type: 'date', nullable: false, primaryKey: false, unique: false, indexed: true },
    ],
    indexes: [
      { name: 'notifications_pkey', columns: ['id'], unique: true },
      { name: 'notifications_user_read_idx', columns: ['user_id', 'is_read'], unique: false },
    ],
  },
];

const sampleQuery: QueryResult = {
  columns: ['id', 'email', 'username', 'role', 'is_active', 'last_login'],
  rows: [
    { id: 'a1b2c3d4...', email: 'sarah@nexus.ai', username: 'sarah.chen', role: 'admin', is_active: true, last_login: '2025-07-14 09:15' },
    { id: 'e5f6g7h8...', email: 'alex@nexus.ai', username: 'alex.r', role: 'engineer', is_active: true, last_login: '2025-07-14 08:30' },
    { id: 'i9j0k1l2...', email: 'jordan@nexus.ai', username: 'jkim', role: 'devops', is_active: true, last_login: '2025-07-13 22:45' },
    { id: 'm3n4o5p6...', email: 'maya@nexus.ai', username: 'maya.p', role: 'designer', is_active: true, last_login: '2025-07-14 07:00' },
    { id: 'q7r8s9t0...', email: 'test@nexus.ai', username: 'test_user', role: 'user', is_active: false, last_login: '2025-06-01 12:00' },
  ],
  executionTime: 12.4,
  rowCount: 15432,
};

export default function DataExplorer() {
  const isDemo = useIsDemoAccount();
  const [selectedTable, setSelectedTable] = useState<TableInfo>(tables[0]);
  const [activeTab, setActiveTab] = useState<'schema' | 'data' | 'query' | 'indexes'>('schema');
  const [query, setQuery] = useState("SELECT id, email, username, role, is_active, last_login\nFROM users\nWHERE is_active = true\nORDER BY last_login DESC\nLIMIT 50;");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [expandedTable, setExpandedTable] = useState<string>('users');
  const [searchTables, setSearchTables] = useState('');

  const filteredTables = tables.filter(t => !searchTables || t.name.toLowerCase().includes(searchTables.toLowerCase()));

  const totalRows = tables.reduce((s, t) => s + t.rows, 0);
  const totalSize = tables.reduce((s, t) => s + parseFloat(t.size), 0).toFixed(1);

  const executeQuery = () => {
    setQueryResult(sampleQuery);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex">
      {/* Sidebar - Table List */}
      <div className="w-72 border-r border-white/10 flex flex-col bg-black/20">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" /> Data Explorer
          </h2>
          <div className="text-xs text-gray-500 mt-1">{tables.length} tables · {totalRows.toLocaleString()} rows · {totalSize} MB</div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="text" value={searchTables} onChange={e => setSearchTables(e.target.value)}
              placeholder="Search tables..." className="w-full pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredTables.map(table => (
            <div key={table.name}>
              <button onClick={() => { setSelectedTable(table); setExpandedTable(expandedTable === table.name ? '' : table.name); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  selectedTable.name === table.name ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'
                }`}>
                <ChevronRight className={`w-3 h-3 transition-transform ${expandedTable === table.name ? 'rotate-90' : ''}`} />
                <Table className="w-4 h-4 text-cyan-400" />
                <span className="flex-1 text-left text-xs font-medium">{table.name}</span>
                <span className="text-[10px] text-gray-600">{table.rows.toLocaleString()}</span>
              </button>
              <AnimatePresence>
                {expandedTable === table.name && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="ml-8 space-y-0.5 overflow-hidden">
                    {table.fields.map(field => {
                      const Icon = fieldTypeIcons[field.type];
                      return (
                        <div key={field.name} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
                          <Icon className="w-3 h-3" style={{ color: fieldTypeColors[field.type] }} />
                          <span className={field.primaryKey ? 'text-yellow-400 font-medium' : ''}>{field.name}</span>
                          {field.primaryKey && <Key className="w-2.5 h-2.5 text-yellow-400" />}
                          {field.references && <Link2 className="w-2.5 h-2.5 text-orange-400" />}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-black/10">
          <div className="flex items-center gap-3">
            <Table className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-semibold text-sm">{selectedTable.schema}.{selectedTable.name}</h3>
              <div className="text-xs text-gray-500">{selectedTable.rows.toLocaleString()} rows · {selectedTable.size} · {selectedTable.fields.length} columns</div>
            </div>
          </div>
          <div className="flex gap-1">
            {(['schema', 'data', 'query', 'indexes'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-all ${
                  activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
                }`}>{tab}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* Schema Tab */}
          {activeTab === 'schema' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Column</th>
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Type</th>
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Nullable</th>
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Default</th>
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Constraints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTable.fields.map((field, i) => {
                      const Icon = fieldTypeIcons[field.type];
                      return (
                        <motion.tr key={field.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {field.primaryKey && <Key className="w-3.5 h-3.5 text-yellow-400" />}
                              <span className="text-sm font-medium font-mono">{field.name}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5" style={{ color: fieldTypeColors[field.type] }} />
                              <span className="text-xs px-2 py-0.5 rounded" style={{
                                backgroundColor: `${fieldTypeColors[field.type]}15`,
                                color: fieldTypeColors[field.type],
                              }}>{field.type}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`text-xs ${field.nullable ? 'text-gray-500' : 'text-yellow-400'}`}>
                              {field.nullable ? 'YES' : 'NOT NULL'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs font-mono text-gray-400">{field.default || '—'}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {field.primaryKey && <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-[10px]">PK</span>}
                              {field.unique && <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[10px]">UQ</span>}
                              {field.indexed && <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px]">IDX</span>}
                              {field.references && (
                                <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded text-[10px]">FK → {field.references}</span>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      {sampleQuery.columns.map(col => (
                        <th key={col} className="text-left p-3 text-xs text-gray-500 font-medium whitespace-nowrap cursor-pointer hover:text-white">
                          <span className="flex items-center gap-1">{col} <ArrowDown className="w-3 h-3" /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleQuery.rows.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                        {sampleQuery.columns.map(col => (
                          <td key={col} className="p-3 text-xs font-mono whitespace-nowrap">
                            {typeof row[col] === 'boolean' ? (
                              <span className={row[col] ? 'text-green-400' : 'text-red-400'}>{String(row[col])}</span>
                            ) : row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>Showing 5 of {selectedTable.rows.toLocaleString()} rows</span>
                <div className="flex gap-1">
                  {[1, 2, 3, '...', 100].map((p, i) => (
                    <button key={i} className={`px-2 py-1 rounded ${p === 1 ? 'bg-white/10 text-white' : 'hover:bg-white/5'}`}>{p}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Query Tab */}
          {activeTab === 'query' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                  <span className="text-xs text-gray-400">SQL Query</span>
                  <div className="flex gap-2">
                    <button onClick={executeQuery}
                      className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs hover:bg-green-500/30 transition-colors">
                      <Play className="w-3 h-3" /> Execute
                    </button>
                  </div>
                </div>
                <textarea value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full p-4 bg-transparent text-sm text-green-300 font-mono resize-none outline-none min-h-[140px]"
                  spellCheck={false} />
              </div>

              {queryResult && (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" /> Success</span>
                      <span>{queryResult.rowCount.toLocaleString()} rows</span>
                      <span>{queryResult.executionTime}ms</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          {queryResult.columns.map(col => (
                            <th key={col} className="text-left p-3 text-xs text-gray-500 font-medium font-mono">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, i) => (
                          <tr key={i} className="border-b border-white/5">
                            {queryResult.columns.map(col => (
                              <td key={col} className="p-3 text-xs font-mono">
                                {typeof row[col] === 'boolean' ? (
                                  <span className={row[col] ? 'text-green-400' : 'text-red-400'}>{String(row[col])}</span>
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
            </motion.div>
          )}

          {/* Indexes Tab */}
          {activeTab === 'indexes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Name</th>
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Columns</th>
                      <th className="text-left p-3 text-xs text-gray-500 font-medium">Unique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTable.indexes.map((idx, i) => (
                      <motion.tr key={idx.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="p-3 text-xs font-mono text-cyan-400">{idx.name}</td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {idx.columns.map(col => (
                              <span key={col} className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono">{col}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {idx.unique ? (
                            <span className="text-xs text-purple-400">UNIQUE</span>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
