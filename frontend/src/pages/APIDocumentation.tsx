import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Search, Copy, Play, ChevronRight, ChevronDown, ExternalLink,
  Lock, Unlock, Code, Hash, Loader, Check, X, AlertTriangle,
  Globe, Shield, Zap, Tag, Server, ArrowRight, Eye, Download
} from 'lucide-react';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary: string;
  description: string;
  tags: string[];
  auth: boolean;
  params: { name: string; in: string; type: string; required: boolean; description: string }[];
  responseExample: string;
  responseStatus: number;
}

interface ApiGroup { tag: string; endpoints: Endpoint[]; }

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  PATCH: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const SAMPLE_GROUPS: ApiGroup[] = [
  { tag: 'Authentication', endpoints: [
    { method: 'POST', path: '/api/v1/auth/login', summary: 'User login', description: 'Authenticate a user with email and password. Returns JWT access and refresh tokens.', tags: ['Authentication'], auth: false,
      params: [{ name: 'email', in: 'body', type: 'string', required: true, description: 'User email address' }, { name: 'password', in: 'body', type: 'string', required: true, description: 'User password' }],
      responseExample: '{\n  "access_token": "eyJhbGciOiJIUzI1NiIs...",\n  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",\n  "token_type": "bearer",\n  "expires_in": 3600\n}', responseStatus: 200 },
    { method: 'POST', path: '/api/v1/auth/register', summary: 'Register new user', description: 'Create a new user account.', tags: ['Authentication'], auth: false,
      params: [{ name: 'email', in: 'body', type: 'string', required: true, description: 'User email' }, { name: 'password', in: 'body', type: 'string', required: true, description: 'Password (min 8 chars)' }, { name: 'name', in: 'body', type: 'string', required: true, description: 'Display name' }],
      responseExample: '{\n  "id": "usr_abc123",\n  "email": "user@example.com",\n  "name": "John Doe",\n  "created_at": "2024-01-15T10:30:00Z"\n}', responseStatus: 201 },
    { method: 'POST', path: '/api/v1/auth/refresh', summary: 'Refresh token', description: 'Get a new access token using refresh token.', tags: ['Authentication'], auth: true,
      params: [{ name: 'refresh_token', in: 'body', type: 'string', required: true, description: 'Valid refresh token' }],
      responseExample: '{\n  "access_token": "eyJhbGciOiJIUzI1NiIs...",\n  "expires_in": 3600\n}', responseStatus: 200 },
  ]},
  { tag: 'Agents', endpoints: [
    { method: 'GET', path: '/api/v1/agents', summary: 'List all agents', description: 'Retrieve list of all available AI agents with their current status.', tags: ['Agents'], auth: true,
      params: [{ name: 'status', in: 'query', type: 'string', required: false, description: 'Filter by status (active, paused, error)' }, { name: 'limit', in: 'query', type: 'integer', required: false, description: 'Max results (default: 20)' }],
      responseExample: '{\n  "agents": [\n    { "id": "agent_01", "name": "Orchestrator", "status": "active", "uptime": "14d 7h" },\n    { "id": "agent_02", "name": "Health Agent", "status": "active", "uptime": "14d 7h" }\n  ],\n  "total": 15\n}', responseStatus: 200 },
    { method: 'POST', path: '/api/v1/agents/{agent_id}/command', summary: 'Send command to agent', description: 'Execute a natural language command through the specified agent.', tags: ['Agents'], auth: true,
      params: [{ name: 'agent_id', in: 'path', type: 'string', required: true, description: 'Agent identifier' }, { name: 'command', in: 'body', type: 'string', required: true, description: 'Natural language command' }],
      responseExample: '{\n  "task_id": "task_xyz789",\n  "agent": "personal",\n  "status": "processing",\n  "estimated_time": 2.5\n}', responseStatus: 202 },
    { method: 'GET', path: '/api/v1/agents/{agent_id}/metrics', summary: 'Get agent metrics', description: 'Retrieve performance metrics for a specific agent.', tags: ['Agents'], auth: true,
      params: [{ name: 'agent_id', in: 'path', type: 'string', required: true, description: 'Agent identifier' }, { name: 'period', in: 'query', type: 'string', required: false, description: 'Time period (1h, 24h, 7d, 30d)' }],
      responseExample: '{\n  "agent_id": "agent_01",\n  "requests": 15420,\n  "avg_response_time_ms": 245,\n  "error_rate": 0.02,\n  "cpu_usage": 18.5\n}', responseStatus: 200 },
  ]},
  { tag: 'Tasks', endpoints: [
    { method: 'GET', path: '/api/v1/tasks', summary: 'List tasks', description: 'Get all tasks with optional filtering.', tags: ['Tasks'], auth: true,
      params: [{ name: 'status', in: 'query', type: 'string', required: false, description: 'Filter by status' }, { name: 'priority', in: 'query', type: 'string', required: false, description: 'Filter by priority' }],
      responseExample: '{\n  "tasks": [\n    { "id": "t1", "title": "Review report", "status": "pending", "priority": "high" }\n  ],\n  "total": 42\n}', responseStatus: 200 },
    { method: 'POST', path: '/api/v1/tasks', summary: 'Create task', description: 'Create a new task or schedule one for the future.', tags: ['Tasks'], auth: true,
      params: [{ name: 'title', in: 'body', type: 'string', required: true, description: 'Task title' }, { name: 'priority', in: 'body', type: 'string', required: false, description: 'Priority level' }, { name: 'due_date', in: 'body', type: 'string', required: false, description: 'ISO date' }],
      responseExample: '{\n  "id": "t_new123",\n  "title": "Review report",\n  "status": "pending",\n  "created_at": "2024-01-15T10:30:00Z"\n}', responseStatus: 201 },
    { method: 'DELETE', path: '/api/v1/tasks/{task_id}', summary: 'Delete task', description: 'Permanently delete a task.', tags: ['Tasks'], auth: true,
      params: [{ name: 'task_id', in: 'path', type: 'string', required: true, description: 'Task identifier' }],
      responseExample: '{\n  "deleted": true,\n  "id": "t1"\n}', responseStatus: 200 },
  ]},
  { tag: 'Settings', endpoints: [
    { method: 'GET', path: '/api/v1/settings', summary: 'Get settings', description: 'Retrieve all user/system settings.', tags: ['Settings'], auth: true,
      params: [],
      responseExample: '{\n  "theme": "dark",\n  "language": "en",\n  "notifications": true,\n  "ai_model": "gpt-4"\n}', responseStatus: 200 },
    { method: 'PUT', path: '/api/v1/settings', summary: 'Update settings', description: 'Update user/system settings.', tags: ['Settings'], auth: true,
      params: [{ name: 'theme', in: 'body', type: 'string', required: false, description: 'UI theme' }, { name: 'language', in: 'body', type: 'string', required: false, description: 'Language code' }],
      responseExample: '{\n  "updated": true,\n  "settings": { "theme": "dark", "language": "en" }\n}', responseStatus: 200 },
  ]},
];

export default function APIDocumentation() {
  const isDemo = useIsDemoAccount();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(SAMPLE_GROUPS.map(g => g.tag)));
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tryItData, setTryItData] = useState<Record<string, string>>({});
  const [tryItResponse, setTryItResponse] = useState<string | null>(null);
  const [tryItLoading, setTryItLoading] = useState(false);

  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);

  const toggleEndpoint = (key: string) => setExpandedEndpoints(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const toggleGroup = (tag: string) => setExpandedGroups(prev => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next; });

  const filteredGroups = SAMPLE_GROUPS.filter(g => !selectedTag || g.tag === selectedTag).map(g => ({
    ...g,
    endpoints: g.endpoints.filter(ep => !search || ep.path.toLowerCase().includes(search.toLowerCase()) || ep.summary.toLowerCase().includes(search.toLowerCase())),
  })).filter(g => g.endpoints.length > 0);

  const totalEndpoints = SAMPLE_GROUPS.reduce((sum, g) => sum + g.endpoints.length, 0);

  const tryEndpoint = (ep: Endpoint) => {
    setTryItLoading(true);
    setTimeout(() => {
      setTryItResponse(ep.responseExample);
      setTryItLoading(false);
    }, 600);
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-indigo-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="p-3 bg-indigo-500/20 rounded-xl">
              <BookOpen className="w-7 h-7 text-indigo-400" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">API Documentation</h1>
              <p className="text-nexus-muted text-sm">NexusAI REST API v1.0 · {totalEndpoints} endpoints</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg flex items-center gap-1"><Zap className="w-3 h-3" /> Live</span>
            <span className="text-xs text-nexus-muted">Base URL: https://api.nexus.local/v1</span>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 shrink-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nexus-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search endpoints..."
                className="w-full pl-8 pr-3 py-2 bg-gray-800/30 border border-gray-700/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="space-y-1">
              <button onClick={() => setSelectedTag(null)} className={`w-full text-left px-3 py-2 text-xs rounded-lg ${!selectedTag ? 'bg-indigo-500/20 text-indigo-300' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                All Endpoints ({totalEndpoints})
              </button>
              {SAMPLE_GROUPS.map(g => (
                <button key={g.tag} onClick={() => setSelectedTag(g.tag === selectedTag ? null : g.tag)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between ${selectedTag === g.tag ? 'bg-indigo-500/20 text-indigo-300' : 'text-nexus-muted hover:text-nexus-muted'}`}>
                  <span>{g.tag}</span>
                  <span className="text-[10px] opacity-60">{g.endpoints.length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-4">
            {filteredGroups.map(group => (
              <motion.div key={group.tag} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800/20 border border-gray-700/50 rounded-xl overflow-hidden">
                <button onClick={() => toggleGroup(group.tag)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-800/40 transition-colors">
                  <div className="flex items-center gap-2">
                    {expandedGroups.has(group.tag) ? <ChevronDown className="w-4 h-4 text-nexus-muted" /> : <ChevronRight className="w-4 h-4 text-nexus-muted" />}
                    <Tag className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium text-white">{group.tag}</span>
                    <span className="text-xs text-nexus-muted">{group.endpoints.length} endpoints</span>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedGroups.has(group.tag) && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="border-t border-gray-700/30">
                        {group.endpoints.map((ep, i) => {
                          const key = `${ep.method}:${ep.path}`;
                          const isExpanded = expandedEndpoints.has(key);
                          return (
                            <div key={key} className="border-b border-gray-700/20 last:border-b-0">
                              <button onClick={() => toggleEndpoint(key)} className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                                <code className="text-sm text-nexus-muted font-mono">{ep.path}</code>
                                <span className="text-xs text-nexus-muted ml-auto">{ep.summary}</span>
                                {ep.auth && <Lock className="w-3 h-3 text-amber-500" />}
                              </button>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden">
                                    <div className="px-5 pb-4 space-y-4">
                                      <p className="text-sm text-nexus-muted">{ep.description}</p>
                                      {ep.params.length > 0 && (
                                        <div>
                                          <h4 className="text-xs text-nexus-muted uppercase tracking-wider mb-2">Parameters</h4>
                                          <table className="w-full text-xs">
                                            <thead><tr className="text-nexus-muted border-b border-gray-700/30">
                                              <th className="text-left py-1.5 pr-3">Name</th><th className="text-left py-1.5 pr-3">In</th><th className="text-left py-1.5 pr-3">Type</th><th className="text-center py-1.5 pr-3">Required</th><th className="text-left py-1.5">Description</th>
                                            </tr></thead>
                                            <tbody>
                                              {ep.params.map(p => (
                                                <tr key={p.name} className="border-b border-gray-700/15">
                                                  <td className="py-1.5 pr-3 text-indigo-400 font-mono">{p.name}</td>
                                                  <td className="py-1.5 pr-3 text-nexus-muted">{p.in}</td>
                                                  <td className="py-1.5 pr-3 text-cyan-400 font-mono">{p.type}</td>
                                                  <td className="py-1.5 pr-3 text-center">{p.required ? <Check className="w-3 h-3 text-green-400 mx-auto" /> : <span className="text-nexus-muted">—</span>}</td>
                                                  <td className="py-1.5 text-nexus-muted">{p.description}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                      <div className="flex gap-4">
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs text-nexus-muted uppercase tracking-wider">Response ({ep.responseStatus})</h4>
                                            <button onClick={() => copyToClipboard(ep.responseExample)} className="text-nexus-muted hover:text-nexus-muted"><Copy className="w-3.5 h-3.5" /></button>
                                          </div>
                                          <pre className="bg-gray-900/80 border border-gray-700/30 rounded-lg p-3 text-xs text-green-400 font-mono overflow-auto max-h-48">{ep.responseExample}</pre>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 pt-2 border-t border-gray-700/30">
                                        <button onClick={() => tryEndpoint(ep)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors">
                                          <Play className="w-3 h-3" /> Try It
                                        </button>
                                        <button onClick={() => copyToClipboard(`curl -X ${ep.method} https://api.nexus.local${ep.path}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-nexus-surface hover:bg-gray-600 text-nexus-muted text-xs rounded-lg transition-colors">
                                          <Code className="w-3 h-3" /> cURL
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Try It Response Modal */}
        <AnimatePresence>
          {tryItResponse && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 w-96 bg-nexus-card border border-nexus-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-nexus-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white font-medium">Response</span>
                </div>
                <button onClick={() => setTryItResponse(null)} className="text-nexus-muted hover:text-nexus-muted"><X className="w-4 h-4" /></button>
              </div>
              <pre className="p-4 text-xs text-green-400 font-mono overflow-auto max-h-64">{tryItResponse}</pre>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
