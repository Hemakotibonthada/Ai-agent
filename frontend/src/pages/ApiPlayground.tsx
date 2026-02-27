import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Send, Copy, Code, ChevronDown, Plus, Trash2,
  Clock, CheckCircle, XCircle, Loader2, Globe, Lock,
  Key, Settings, BookOpen, Download, Upload, Wifi,
  Hash, AlignLeft, List, ToggleLeft, X, FileJson
} from 'lucide-react';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type ParamType = 'query' | 'header' | 'body';

interface RequestParam {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  type: ParamType;
}

interface RequestHistory {
  id: string;
  method: HttpMethod;
  url: string;
  status: number;
  time: number;
  timestamp: string;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PATCH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const sampleEndpoints = [
  { method: 'GET' as HttpMethod, path: '/api/agents', description: 'List all agents' },
  { method: 'GET' as HttpMethod, path: '/api/system/health', description: 'System health check' },
  { method: 'POST' as HttpMethod, path: '/api/chat', description: 'Send chat message' },
  { method: 'GET' as HttpMethod, path: '/api/tasks', description: 'List tasks' },
  { method: 'POST' as HttpMethod, path: '/api/tasks', description: 'Create task' },
  { method: 'GET' as HttpMethod, path: '/api/analytics/dashboard', description: 'Get dashboard analytics' },
  { method: 'GET' as HttpMethod, path: '/api/plugins', description: 'List plugins' },
  { method: 'POST' as HttpMethod, path: '/api/search', description: 'Full text search' },
  { method: 'GET' as HttpMethod, path: '/api/workflows', description: 'List workflows' },
  { method: 'PUT' as HttpMethod, path: '/api/feature-flags/dark-mode-v2', description: 'Update feature flag' },
  { method: 'GET' as HttpMethod, path: '/api/pipelines', description: 'List data pipelines' },
  { method: 'DELETE' as HttpMethod, path: '/api/tasks/1', description: 'Delete task' },
];

const sampleHistory: RequestHistory[] = [
  { id: '1', method: 'GET', url: '/api/agents', status: 200, time: 42, timestamp: '10:30 AM' },
  { id: '2', method: 'POST', url: '/api/chat', status: 200, time: 1250, timestamp: '10:28 AM' },
  { id: '3', method: 'GET', url: '/api/system/health', status: 200, time: 15, timestamp: '10:25 AM' },
  { id: '4', method: 'DELETE', url: '/api/tasks/5', status: 404, time: 23, timestamp: '10:20 AM' },
  { id: '5', method: 'PUT', url: '/api/feature-flags/test', status: 200, time: 89, timestamp: '10:15 AM' },
];

const ApiPlayground: React.FC = () => {
  const isDemo = useIsDemoAccount();
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('/api/agents');
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
  const [params, setParams] = useState<RequestParam[]>([
    { id: '1', key: 'limit', value: '10', enabled: true, type: 'query' },
    { id: '2', key: 'offset', value: '0', enabled: true, type: 'query' },
  ]);
  const [headers, setHeaders] = useState<RequestParam[]>([
    { id: '1', key: 'Content-Type', value: 'application/json', enabled: true, type: 'header' },
    { id: '2', key: 'Authorization', value: 'Bearer <token>', enabled: false, type: 'header' },
  ]);
  const [body, setBody] = useState('{\n  "message": "Hello, NexusAI!",\n  "context": {\n    "agent": "personal"\n  }\n}');
  const [responseData, setResponseData] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RequestHistory[]>(isDemo ? sampleHistory : []);
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [responseTab, setResponseTab] = useState<'body' | 'headers' | 'cookies'>('body');

  const simulateRequest = useCallback(async () => {
    setLoading(true);
    setResponseData(null);
    const startTime = Date.now();

    await new Promise(r => setTimeout(r, 300 + Math.random() * 700));

    const time = Date.now() - startTime;
    const status = Math.random() > 0.1 ? 200 : 404;

    const mockResponses: Record<string, any> = {
      '/api/agents': { agents: [{ id: 1, name: 'Personal Agent', status: 'active', capability_count: 12 }, { id: 2, name: 'Security Agent', status: 'active', capability_count: 8 }], total: 15 },
      '/api/system/health': { status: 'healthy', uptime: '72h 14m', cpu: '23%', memory: '41%', services: { ai: 'running', mqtt: 'running', scheduler: 'running' } },
      '/api/tasks': { tasks: [{ id: 1, title: 'Review security logs', status: 'pending', priority: 'high' }], total: 42 },
      '/api/analytics/dashboard': { total_events: 15420, active_users: 3, avg_response_time: '142ms', top_agents: ['personal', 'security', 'home'] },
    };

    const data = mockResponses[url] || { message: `${method} ${url} executed successfully`, timestamp: new Date().toISOString() };
    setResponseData(JSON.stringify(data, null, 2));
    setResponseStatus(status);
    setResponseTime(time);
    setLoading(false);

    setHistory(prev => [{
      id: Date.now().toString(), method, url, status, time,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }, ...prev].slice(0, 20));
  }, [method, url]);

  const addParam = (type: ParamType) => {
    const item: RequestParam = { id: Date.now().toString(), key: '', value: '', enabled: true, type };
    if (type === 'header') setHeaders(prev => [...prev, item]);
    else setParams(prev => [...prev, item]);
  };

  const updateParam = (list: RequestParam[], setList: any, id: string, field: string, value: any) => {
    setList(list.map((p: RequestParam) => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeParam = (list: RequestParam[], setList: any, id: string) => {
    setList(list.filter((p: RequestParam) => p.id !== id));
  };

  const paramTable = (items: RequestParam[], setItems: any, type: ParamType) => (
    <div className="space-y-2">
      {items.map(param => (
        <div key={param.id} className="flex items-center gap-2">
          <input type="checkbox" checked={param.enabled}
            onChange={e => updateParam(items, setItems, param.id, 'enabled', e.target.checked)}
            className="rounded border-gray-300 text-blue-500" />
          <input type="text" placeholder="Key" value={param.key}
            onChange={e => updateParam(items, setItems, param.id, 'key', e.target.value)}
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="text" placeholder="Value" value={param.value}
            onChange={e => updateParam(items, setItems, param.id, 'value', e.target.value)}
            className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={() => removeParam(items, setItems, param.id)} className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={() => addParam(type)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1">
        <Plus size={12} /> Add {type}
      </button>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Globe className="text-blue-500" size={32} />
              API Playground
            </h1>
            <p className="text-gray-500 mt-1">Test and explore API endpoints interactively</p>
          </div>
          <div className="relative">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowEndpoints(!showEndpoints)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
              <BookOpen size={16} /> Endpoints
            </motion.button>
            <AnimatePresence>
              {showEndpoints && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                  className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Available Endpoints</h3>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                    {sampleEndpoints.map((ep, i) => (
                      <button key={i}
                        onClick={() => { setMethod(ep.method); setUrl(ep.path); setShowEndpoints(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{ep.path}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </FadeIn>

      {/* Request Bar */}
      <FadeIn delay={0.05}>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-2xl p-2 border border-gray-200 dark:border-gray-700">
          <select value={method} onChange={e => setMethod(e.target.value as HttpMethod)}
            className={`px-3 py-2.5 rounded-xl text-sm font-bold ${METHOD_COLORS[method]} border-0 outline-none cursor-pointer`}>
            {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)}
            className="flex-1 px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-white bg-transparent outline-none"
            placeholder="/api/endpoint" />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={simulateRequest} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send
          </motion.button>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Config */}
        <div className="lg:col-span-2 space-y-4">
          <FadeIn delay={0.1}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {(['params', 'headers', 'body', 'auth'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}>
                    {tab === 'params' && <Hash size={12} className="inline mr-1" />}
                    {tab === 'headers' && <AlignLeft size={12} className="inline mr-1" />}
                    {tab === 'body' && <FileJson size={12} className="inline mr-1" />}
                    {tab === 'auth' && <Lock size={12} className="inline mr-1" />}
                    {tab} {tab === 'params' && `(${params.length})`} {tab === 'headers' && `(${headers.length})`}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === 'params' && paramTable(params, setParams, 'query')}
                {activeTab === 'headers' && paramTable(headers, setHeaders, 'header')}
                {activeTab === 'body' && (
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
                    className="w-full px-4 py-3 bg-gray-900 text-green-400 rounded-xl text-sm font-mono outline-none resize-none" />
                )}
                {activeTab === 'auth' && (
                  <div className="space-y-3">
                    <select className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white outline-none">
                      <option>No Auth</option>
                      <option>Bearer Token</option>
                      <option>API Key</option>
                      <option>Basic Auth</option>
                    </select>
                    <input type="text" placeholder="Enter token or API key..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white outline-none" />
                  </div>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Response */}
          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Response</h3>
                  {responseStatus !== null && (
                    <>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${responseStatus < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {responseStatus} {responseStatus < 400 ? 'OK' : 'Not Found'}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={10} /> {responseTime}ms
                      </span>
                    </>
                  )}
                </div>
                {responseData && (
                  <button onClick={() => navigator.clipboard.writeText(responseData || '')}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    <Copy size={12} /> Copy
                  </button>
                )}
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                  </div>
                ) : responseData ? (
                  <div>
                    <div className="flex gap-2 mb-3">
                      {(['body', 'headers', 'cookies'] as const).map(t => (
                        <button key={t} onClick={() => setResponseTab(t)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${
                            responseTab === t ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' : 'text-gray-500'
                          }`}>{t}</button>
                      ))}
                    </div>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap">
                      {responseTab === 'body' ? responseData : responseTab === 'headers' ? JSON.stringify({
                        'content-type': 'application/json',
                        'x-request-id': 'req_' + Date.now(),
                        'x-response-time': responseTime + 'ms',
                        'cache-control': 'no-cache',
                      }, null, 2) : '{}'}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Send size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Send a request to see the response</p>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* History Sidebar */}
        <FadeIn delay={0.2}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock size={14} /> History
              </h3>
              <button onClick={() => setHistory([])} className="text-xs text-gray-500 hover:text-red-500">Clear</button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {history.map(item => (
                <button key={item.id}
                  onClick={() => { setMethod(item.method as HttpMethod); setUrl(item.url); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${METHOD_COLORS[item.method as HttpMethod]}`}>
                      {item.method}
                    </span>
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">{item.url}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className={item.status < 400 ? 'text-green-500' : 'text-red-500'}>{item.status}</span>
                    <span>{item.time}ms</span>
                    <span>{item.timestamp}</span>
                  </div>
                </button>
              ))}
              {history.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">No history yet</div>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
};

export default ApiPlayground;
