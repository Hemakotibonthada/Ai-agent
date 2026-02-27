import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook, Plus, Play, Pause, Trash2, Settings, RefreshCw,
  CheckCircle, XCircle, Clock, AlertTriangle, Copy, Eye,
  Filter, Search, ArrowRight, Zap, Globe, Lock, Unlock,
  Activity, ChevronDown, ChevronRight, Code2, Link2, Edit3, RotateCcw
} from 'lucide-react';

type WebhookStatus = 'active' | 'paused' | 'error' | 'disabled';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface WebhookEvent {
  id: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending' | 'timeout';
  statusCode: number;
  duration: number;
  requestBody: string;
  responseBody: string;
  retries: number;
}

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  events: string[];
  status: WebhookStatus;
  secret: string;
  headers: Record<string, string>;
  retryPolicy: { maxRetries: number; backoffMs: number };
  createdAt: string;
  lastTriggered: string | null;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  recentEvents: WebhookEvent[];
}

const sampleWebhooks: WebhookConfig[] = [
  {
    id: 'wh_1', name: 'Deploy Notifier', url: 'https://hooks.slack.com/services/T00/B00/xxx',
    method: 'POST', events: ['deploy.success', 'deploy.failed'], status: 'active',
    secret: 'whsec_2f7d8a9b...', headers: { 'Content-Type': 'application/json' },
    retryPolicy: { maxRetries: 3, backoffMs: 1000 }, createdAt: '2025-01-15T10:30:00Z',
    lastTriggered: '2025-07-14T08:22:15Z', totalCalls: 342, successRate: 99.1, avgLatency: 245,
    recentEvents: [
      { id: 'evt_1', timestamp: '2025-07-14T08:22:15Z', status: 'success', statusCode: 200, duration: 189, requestBody: '{"event":"deploy.success","service":"api"}', responseBody: '{"ok":true}', retries: 0 },
      { id: 'evt_2', timestamp: '2025-07-14T06:15:30Z', status: 'success', statusCode: 200, duration: 234, requestBody: '{"event":"deploy.success","service":"frontend"}', responseBody: '{"ok":true}', retries: 0 },
      { id: 'evt_3', timestamp: '2025-07-13T22:45:10Z', status: 'failed', statusCode: 503, duration: 5023, requestBody: '{"event":"deploy.failed","service":"worker"}', responseBody: '{"error":"Service Unavailable"}', retries: 3 },
    ]
  },
  {
    id: 'wh_2', name: 'CI Pipeline Trigger', url: 'https://api.github.com/repos/org/repo/dispatches',
    method: 'POST', events: ['push.main', 'pr.merged'], status: 'active',
    secret: 'whsec_9c4e3f1a...', headers: { 'Authorization': 'Bearer ghp_xxx...', 'Accept': 'application/vnd.github+json' },
    retryPolicy: { maxRetries: 2, backoffMs: 2000 }, createdAt: '2025-02-20T14:00:00Z',
    lastTriggered: '2025-07-14T09:01:42Z', totalCalls: 1256, successRate: 97.8, avgLatency: 412,
    recentEvents: [
      { id: 'evt_4', timestamp: '2025-07-14T09:01:42Z', status: 'success', statusCode: 204, duration: 398, requestBody: '{"event_type":"ci-trigger","client_payload":{"branch":"main"}}', responseBody: '', retries: 0 },
      { id: 'evt_5', timestamp: '2025-07-14T07:33:18Z', status: 'success', statusCode: 204, duration: 325, requestBody: '{"event_type":"ci-trigger","client_payload":{"pr":142}}', responseBody: '', retries: 0 },
    ]
  },
  {
    id: 'wh_3', name: 'Error Tracker', url: 'https://sentry.io/api/0/projects/org/proj/hooks/',
    method: 'POST', events: ['error.new', 'error.resolved', 'error.regression'], status: 'paused',
    secret: 'whsec_7b2d5e8f...', headers: { 'Content-Type': 'application/json', 'X-Sentry-Token': 'sntrx_xxx...' },
    retryPolicy: { maxRetries: 5, backoffMs: 5000 }, createdAt: '2025-03-10T09:15:00Z',
    lastTriggered: '2025-07-12T16:45:00Z', totalCalls: 89, successRate: 93.3, avgLatency: 678,
    recentEvents: [
      { id: 'evt_6', timestamp: '2025-07-12T16:45:00Z', status: 'timeout', statusCode: 0, duration: 30000, requestBody: '{"event":"error.new","error_id":"ERR-9821"}', responseBody: '', retries: 5 },
    ]
  },
  {
    id: 'wh_4', name: 'User Activity Logger', url: 'https://analytics.internal.io/webhooks/events',
    method: 'POST', events: ['user.signup', 'user.login', 'user.upgrade'], status: 'active',
    secret: 'whsec_4a1c9d7e...', headers: { 'Content-Type': 'application/json' },
    retryPolicy: { maxRetries: 1, backoffMs: 500 }, createdAt: '2025-04-05T11:20:00Z',
    lastTriggered: '2025-07-14T09:15:33Z', totalCalls: 4521, successRate: 99.8, avgLatency: 156,
    recentEvents: [
      { id: 'evt_7', timestamp: '2025-07-14T09:15:33Z', status: 'success', statusCode: 200, duration: 143, requestBody: '{"event":"user.login","user_id":"u_287"}', responseBody: '{"received":true}', retries: 0 },
      { id: 'evt_8', timestamp: '2025-07-14T09:10:22Z', status: 'success', statusCode: 200, duration: 167, requestBody: '{"event":"user.signup","user_id":"u_1453"}', responseBody: '{"received":true}', retries: 0 },
    ]
  },
  {
    id: 'wh_5', name: 'Payment Gateway', url: 'https://api.stripe.com/v1/webhook_endpoints',
    method: 'POST', events: ['payment.success', 'payment.failed', 'refund.created'], status: 'error',
    secret: 'whsec_stripe_xxx...', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 'sig_xxx...' },
    retryPolicy: { maxRetries: 5, backoffMs: 10000 }, createdAt: '2025-01-01T00:00:00Z',
    lastTriggered: '2025-07-14T02:30:00Z', totalCalls: 7832, successRate: 85.2, avgLatency: 890,
    recentEvents: [
      { id: 'evt_9', timestamp: '2025-07-14T02:30:00Z', status: 'failed', statusCode: 500, duration: 1234, requestBody: '{"event":"payment.success","amount":4999}', responseBody: '{"error":"Internal Server Error"}', retries: 5 },
      { id: 'evt_10', timestamp: '2025-07-13T23:15:00Z', status: 'failed', statusCode: 502, duration: 2345, requestBody: '{"event":"payment.failed","amount":1299}', responseBody: 'Bad Gateway', retries: 5 },
    ]
  },
  {
    id: 'wh_6', name: 'Monitoring Alerts', url: 'https://hooks.pagerduty.com/v2/enqueue',
    method: 'POST', events: ['alert.critical', 'alert.warning', 'alert.resolved'], status: 'active',
    secret: 'whsec_pd_xxx...', headers: { 'Content-Type': 'application/json', 'X-Routing-Key': 'routing_xxx...' },
    retryPolicy: { maxRetries: 3, backoffMs: 3000 }, createdAt: '2025-02-14T16:30:00Z',
    lastTriggered: '2025-07-14T07:00:00Z', totalCalls: 156, successRate: 100, avgLatency: 310,
    recentEvents: [
      { id: 'evt_11', timestamp: '2025-07-14T07:00:00Z', status: 'success', statusCode: 202, duration: 298, requestBody: '{"routing_key":"xxx","event_action":"resolve"}', responseBody: '{"status":"success","dedup_key":"dk-001"}', retries: 0 },
    ]
  },
];

const statusConfig: Record<WebhookStatus, { color: string; icon: React.ElementType; label: string }> = {
  active: { color: '#10b981', icon: CheckCircle, label: 'Active' },
  paused: { color: '#f59e0b', icon: Pause, label: 'Paused' },
  error: { color: '#ef4444', icon: XCircle, label: 'Error' },
  disabled: { color: '#6b7280', icon: Lock, label: 'Disabled' },
};

const eventStatusColors: Record<string, string> = {
  success: '#10b981', failed: '#ef4444', pending: '#f59e0b', timeout: '#8b5cf6',
};

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(sampleWebhooks);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [filter, setFilter] = useState<WebhookStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showEventDetail, setShowEventDetail] = useState<WebhookEvent | null>(null);

  const filteredWebhooks = webhooks.filter(wh => {
    if (filter !== 'all' && wh.status !== filter) return false;
    if (search && !wh.name.toLowerCase().includes(search.toLowerCase()) && !wh.url.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: webhooks.length,
    active: webhooks.filter(w => w.status === 'active').length,
    errored: webhooks.filter(w => w.status === 'error').length,
    totalCalls: webhooks.reduce((s, w) => s + w.totalCalls, 0),
    avgSuccess: webhooks.length ? (webhooks.reduce((s, w) => s + w.successRate, 0) / webhooks.length).toFixed(1) : '0',
  };

  const toggleStatus = (id: string) => {
    setWebhooks(prev => prev.map(wh => {
      if (wh.id !== id) return wh;
      return { ...wh, status: wh.status === 'active' ? 'paused' : 'active' };
    }));
  };

  const deleteWebhook = (id: string) => {
    setWebhooks(prev => prev.filter(wh => wh.id !== id));
    if (selectedWebhook?.id === id) setSelectedWebhook(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6 text-white">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
              Webhook Manager
            </h1>
            <p className="text-gray-400 mt-1">Configure and monitor webhook endpoints</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> New Webhook
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total Webhooks', value: stats.total, icon: Webhook, color: '#6366f1' },
          { label: 'Active', value: stats.active, icon: CheckCircle, color: '#10b981' },
          { label: 'Errors', value: stats.errored, icon: AlertTriangle, color: '#ef4444' },
          { label: 'Total Calls', value: stats.totalCalls.toLocaleString(), icon: Activity, color: '#3b82f6' },
          { label: 'Avg Success', value: `${stats.avgSuccess}%`, icon: Zap, color: '#f59e0b' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} whileHover={{ y: -2 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-gray-400">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search webhooks..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500" />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
          {(['all', 'active', 'paused', 'error'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all capitalize ${filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webhook List */}
        <div className="lg:col-span-2 space-y-3">
          <AnimatePresence>
            {filteredWebhooks.map((wh, i) => {
              const StatusIcon = statusConfig[wh.status].icon;
              return (
                <motion.div key={wh.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedWebhook(wh)}
                  className={`bg-white/5 backdrop-blur-sm rounded-xl border p-4 cursor-pointer transition-all hover:bg-white/[0.07] ${
                    selectedWebhook?.id === wh.id ? 'border-orange-500/50 ring-1 ring-orange-500/20' : 'border-white/10'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${statusConfig[wh.status].color}15` }}>
                        <Webhook className="w-5 h-5" style={{ color: statusConfig[wh.status].color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{wh.name}</h3>
                        <div className="text-xs text-gray-500 font-mono truncate max-w-[300px]">{wh.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: `${statusConfig[wh.status].color}15`, color: statusConfig[wh.status].color }}>
                        <StatusIcon className="w-3 h-3" /> {statusConfig[wh.status].label}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {wh.events.map(evt => (
                      <span key={evt} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400 font-mono">{evt}</span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex gap-4">
                      <span>{wh.method}</span>
                      <span>{wh.totalCalls.toLocaleString()} calls</span>
                      <span className={wh.successRate >= 95 ? 'text-green-400' : wh.successRate >= 80 ? 'text-yellow-400' : 'text-red-400'}>
                        {wh.successRate}% success
                      </span>
                      <span>{wh.avgLatency}ms avg</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); toggleStatus(wh.id); }}
                        className="p-1 hover:bg-white/10 rounded transition-colors">
                        {wh.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteWebhook(wh.id); }}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selectedWebhook ? (
              <motion.div key={selectedWebhook.id}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5 sticky top-6">
                <h3 className="font-semibold text-lg mb-1">{selectedWebhook.name}</h3>
                <p className="text-xs text-gray-500 font-mono mb-4 break-all">{selectedWebhook.url}</p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Method</span>
                    <span className="px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded text-xs font-mono">{selectedWebhook.method}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Secret</span>
                    <span className="text-xs font-mono text-gray-500">{selectedWebhook.secret}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Retries</span>
                    <span className="text-xs">{selectedWebhook.retryPolicy.maxRetries}x / {selectedWebhook.retryPolicy.backoffMs}ms</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Created</span>
                    <span className="text-xs">{new Date(selectedWebhook.createdAt).toLocaleDateString()}</span></div>
                </div>

                <h4 className="text-sm font-semibold text-gray-300 mb-3">Headers</h4>
                <div className="bg-black/20 rounded-lg p-3 mb-6 text-xs font-mono space-y-1 max-h-32 overflow-y-auto">
                  {Object.entries(selectedWebhook.headers).map(([k, v]) => (
                    <div key={k}><span className="text-purple-400">{k}:</span> <span className="text-gray-400">{v.length > 30 ? v.slice(0, 30) + '...' : v}</span></div>
                  ))}
                </div>

                <h4 className="text-sm font-semibold text-gray-300 mb-3">Recent Events</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedWebhook.recentEvents.map(evt => (
                    <div key={evt.id} onClick={() => setShowEventDetail(showEventDetail?.id === evt.id ? null : evt)}
                      className="bg-black/20 rounded-lg p-3 cursor-pointer hover:bg-black/30 transition-colors">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: eventStatusColors[evt.status] }} />
                          {evt.status}
                        </span>
                        <span className="text-gray-500">{evt.statusCode || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{new Date(evt.timestamp).toLocaleString()}</span>
                        <span>{evt.duration}ms</span>
                      </div>
                      {showEventDetail?.id === evt.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          className="mt-2 pt-2 border-t border-white/5 space-y-2">
                          <div><div className="text-xs text-gray-500 mb-1">Request</div>
                            <pre className="text-xs text-gray-400 bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{evt.requestBody}</pre></div>
                          <div><div className="text-xs text-gray-500 mb-1">Response</div>
                            <pre className="text-xs text-gray-400 bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap">{evt.responseBody || '(empty)'}</pre></div>
                          {evt.retries > 0 && <div className="text-xs text-yellow-400">Retried {evt.retries} time(s)</div>}
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-8 text-center">
                <Webhook className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select a webhook to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
