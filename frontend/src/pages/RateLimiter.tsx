import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge, Shield, AlertTriangle, Search, Plus, RefreshCw, Clock, Activity,
  Ban, Check, X, Loader, Filter, ChevronRight, Settings, Users, Globe,
  BarChart3, TrendingUp, ArrowUpRight, Zap, Eye, Edit, Trash2, ToggleLeft,
  ToggleRight, Hash, Server
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

interface RateLimitRule { id: string; name: string; endpoint_pattern: string; requests_per_window: number; window_seconds: number; burst_limit: number; enabled: boolean; current_hits: number; blocked_count: number; }
interface RateLimitEvent { id: string; endpoint: string; key: string; blocked: boolean; timestamp: string; rule_name: string; remaining: number; }
interface QuotaPlan { id: string; name: string; requests_per_day: number; requests_per_minute: number; burst_limit: number; active_users: number; }

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } } };

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function RateLimiter() {
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [events, setEvents] = useState<RateLimitEvent[]>([]);
  const [quotaPlans, setQuotaPlans] = useState<QuotaPlan[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'events' | 'analytics' | 'quotas'>('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRules([
        { id: 'r1', name: 'API Global Limit', endpoint_pattern: '/api/*', requests_per_window: 1000, window_seconds: 60, burst_limit: 50, enabled: true, current_hits: 742, blocked_count: 23 },
        { id: 'r2', name: 'Auth Rate Limit', endpoint_pattern: '/api/v1/auth/*', requests_per_window: 10, window_seconds: 60, burst_limit: 3, enabled: true, current_hits: 8, blocked_count: 156 },
        { id: 'r3', name: 'Chat Endpoint', endpoint_pattern: '/api/v1/chat/*', requests_per_window: 30, window_seconds: 60, burst_limit: 5, enabled: true, current_hits: 24, blocked_count: 12 },
        { id: 'r4', name: 'File Upload', endpoint_pattern: '/api/v1/files/upload', requests_per_window: 20, window_seconds: 300, burst_limit: 5, enabled: true, current_hits: 6, blocked_count: 3 },
        { id: 'r5', name: 'Search Endpoint', endpoint_pattern: '/api/v1/search/*', requests_per_window: 60, window_seconds: 60, burst_limit: 10, enabled: true, current_hits: 45, blocked_count: 8 },
        { id: 'r6', name: 'Webhook Calls', endpoint_pattern: '/api/v1/webhooks/*', requests_per_window: 100, window_seconds: 60, burst_limit: 20, enabled: false, current_hits: 0, blocked_count: 0 },
        { id: 'r7', name: 'Admin API', endpoint_pattern: '/api/v1/admin/*', requests_per_window: 200, window_seconds: 60, burst_limit: 30, enabled: true, current_hits: 18, blocked_count: 0 },
      ]);
      setEvents(Array.from({ length: 20 }, (_, i) => ({
        id: `evt-${i}`,
        endpoint: ['/api/v1/auth/login', '/api/v1/chat/send', '/api/v1/search/query', '/api/v1/files/upload', '/api/v1/agents/list'][i % 5],
        key: `user-${(i % 8) + 1}`,
        blocked: i % 4 === 0,
        timestamp: new Date(Date.now() - i * 120000).toISOString(),
        rule_name: ['Auth Rate Limit', 'Chat Endpoint', 'Search Endpoint', 'File Upload', 'API Global Limit'][i % 5],
        remaining: Math.max(0, Math.floor(Math.random() * 50)),
      })));
      setQuotaPlans([
        { id: 'q1', name: 'Free', requests_per_day: 1000, requests_per_minute: 10, burst_limit: 3, active_users: 1245 },
        { id: 'q2', name: 'Pro', requests_per_day: 50000, requests_per_minute: 100, burst_limit: 20, active_users: 328 },
        { id: 'q3', name: 'Enterprise', requests_per_day: 500000, requests_per_minute: 1000, burst_limit: 100, active_users: 45 },
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const totalBlocked = useMemo(() => rules.reduce((s, r) => s + r.blocked_count, 0), [rules]);
  const totalHits = useMemo(() => rules.reduce((s, r) => s + r.current_hits, 0), [rules]);
  const blockRate = useMemo(() => totalHits > 0 ? ((totalBlocked / (totalHits + totalBlocked)) * 100).toFixed(1) : '0', [totalHits, totalBlocked]);

  const ruleChartData = useMemo(() => rules.filter(r => r.enabled).map(r => ({
    name: r.name.length > 12 ? r.name.slice(0, 12) + '...' : r.name,
    hits: r.current_hits,
    blocked: r.blocked_count,
    limit: r.requests_per_window,
  })), [rules]);

  const pieData = useMemo(() => {
    const blocked = events.filter(e => e.blocked).length;
    const allowed = events.length - blocked;
    return [{ name: 'Allowed', value: allowed }, { name: 'Blocked', value: blocked }];
  }, [events]);

  const timeSeriesData = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    time: `${(i + 1) * 5}m`,
    requests: Math.floor(Math.random() * 800 + 200),
    blocked: Math.floor(Math.random() * 50),
  })), []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = e.endpoint.includes(searchQuery) || e.key.includes(searchQuery);
      const matchBlocked = showBlockedOnly ? e.blocked : true;
      return matchSearch && matchBlocked;
    });
  }, [events, searchQuery, showBlockedOnly]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader className="w-8 h-8 text-violet-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-violet-950/20 to-gray-950 p-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.1 }} className="p-3 bg-violet-500/20 rounded-xl"><Gauge className="w-7 h-7 text-violet-400" /></motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Rate Limiter</h1>
              <p className="text-gray-400 text-sm">API rate limiting & quota management</p>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> New Rule</motion.button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Requests', value: totalHits.toLocaleString(), icon: <Activity className="w-5 h-5" />, color: 'violet', sub: 'Last 60 seconds' },
            { label: 'Blocked', value: totalBlocked.toLocaleString(), icon: <Ban className="w-5 h-5" />, color: 'red', sub: 'Requests blocked' },
            { label: 'Block Rate', value: `${blockRate}%`, icon: <Shield className="w-5 h-5" />, color: 'amber', sub: 'Of total traffic' },
            { label: 'Active Rules', value: rules.filter(r => r.enabled).length.toString(), icon: <Settings className="w-5 h-5" />, color: 'green', sub: `${rules.length} total rules` },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className={`p-2 bg-${stat.color}-500/20 rounded-lg`}><span className={`text-${stat.color}-400`}>{stat.icon}</span></div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                  <p className="text-xs text-gray-500">{stat.sub}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/30 rounded-xl p-1 border border-gray-700/50">
          {[
            { key: 'rules' as const, label: 'Rules', icon: <Settings className="w-4 h-4" />, count: rules.length },
            { key: 'events' as const, label: 'Events', icon: <Activity className="w-4 h-4" />, count: events.length },
            { key: 'analytics' as const, label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
            { key: 'quotas' as const, label: 'Quota Plans', icon: <Users className="w-4 h-4" />, count: quotaPlans.length },
          ].map(tab => (
            <motion.button key={tab.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}>
              {tab.icon}<span>{tab.label}</span>
              {'count' in tab && tab.count !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-violet-500/50' : 'bg-gray-700/50'}`}>{tab.count}</span>}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <motion.div key="rules" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-2">
              {rules.map(rule => {
                const usagePercent = rule.requests_per_window > 0 ? (rule.current_hits / rule.requests_per_window) * 100 : 0;
                return (
                  <motion.div key={rule.id} variants={itemVariants} className={`p-4 bg-gray-800/30 border rounded-xl transition-all ${!rule.enabled ? 'border-gray-800 opacity-60' : usagePercent > 80 ? 'border-red-500/30' : 'border-gray-700/50 hover:border-gray-600'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <motion.button whileHover={{ scale: 1.1 }} className={`p-2 rounded-lg ${rule.enabled ? 'bg-violet-500/20' : 'bg-gray-700/50'}`}>
                          {rule.enabled ? <ToggleRight className="w-5 h-5 text-violet-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                        </motion.button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{rule.name}</span>
                            {!rule.enabled && <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">disabled</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <code className="font-mono text-violet-300">{rule.endpoint_pattern}</code>
                            <span>{rule.requests_per_window} req/{rule.window_seconds}s</span>
                            <span>Burst: {rule.burst_limit}</span>
                          </div>
                        </div>
                      </div>
                      {rule.enabled && (
                        <div className="flex items-center gap-6">
                          <div className="w-40">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-500">Usage</span>
                              <span className={usagePercent > 80 ? 'text-red-400' : usagePercent > 50 ? 'text-yellow-400' : 'text-green-400'}>
                                {rule.current_hits}/{rule.requests_per_window}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(usagePercent, 100)}%` }} transition={{ duration: 1 }}
                                className={`h-full rounded-full ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-violet-500'}`} />
                            </div>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <span className="text-sm font-medium text-red-400">{rule.blocked_count}</span>
                            <p className="text-xs text-gray-500">blocked</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1 ml-4">
                        <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-gray-700/50 rounded-lg"><Edit className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} className="p-1.5 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Search events..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500" />
                </div>
                <motion.button whileHover={{ scale: 1.05 }} onClick={() => setShowBlockedOnly(!showBlockedOnly)}
                  className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${showBlockedOnly ? 'bg-red-600/50 text-red-200' : 'bg-gray-800/50 text-gray-400 border border-gray-700'}`}>
                  <Ban className="w-4 h-4" /> Blocked Only
                </motion.button>
              </div>
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-700/50 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left p-3">Status</th><th className="text-left p-3">Endpoint</th><th className="text-left p-3">Key</th><th className="text-left p-3">Rule</th><th className="text-right p-3">Remaining</th><th className="text-right p-3">Time</th>
                  </tr></thead>
                  <tbody>
                    {filteredEvents.map(evt => (
                      <motion.tr key={evt.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-gray-700/30 hover:bg-gray-800/50 text-sm">
                        <td className="p-3">{evt.blocked ? <span className="flex items-center gap-1 text-red-400"><Ban className="w-3.5 h-3.5" /> Blocked</span> : <span className="flex items-center gap-1 text-green-400"><Check className="w-3.5 h-3.5" /> Allowed</span>}</td>
                        <td className="p-3"><code className="font-mono text-xs text-violet-300">{evt.endpoint}</code></td>
                        <td className="p-3 text-gray-400">{evt.key}</td>
                        <td className="p-3 text-gray-400">{evt.rule_name}</td>
                        <td className="p-3 text-right text-gray-400">{evt.remaining}</td>
                        <td className="p-3 text-right text-gray-500 text-xs">{new Date(evt.timestamp).toLocaleTimeString()}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4">Requests vs Blocked by Rule</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ruleChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Bar dataKey="hits" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="blocked" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4">Allowed vs Blocked</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b981' : '#ef4444'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="col-span-2 p-5 bg-gray-800/30 border border-gray-700/50 rounded-xl">
                <h3 className="text-sm font-medium text-white mb-4">Traffic Over Time (Last Hour)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }} />
                    <Legend />
                    <Line type="monotone" dataKey="requests" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="blocked" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Quotas Tab */}
          {activeTab === 'quotas' && (
            <motion.div key="quotas" variants={containerVariants} initial="hidden" animate="visible" exit="hidden" className="grid grid-cols-3 gap-4">
              {quotaPlans.map((plan, i) => (
                <motion.div key={plan.id} variants={itemVariants} className={`p-6 bg-gray-800/30 border rounded-xl relative overflow-hidden ${i === 2 ? 'border-violet-500/50' : 'border-gray-700/50'}`}>
                  {i === 2 && <div className="absolute top-0 right-0 px-3 py-1 bg-violet-600 text-white text-xs font-medium rounded-bl-lg">Popular</div>}
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{plan.active_users.toLocaleString()} active users</p>
                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Daily requests</span><span className="text-white font-medium">{plan.requests_per_day.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Per minute</span><span className="text-white font-medium">{plan.requests_per_minute}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Burst limit</span><span className="text-white font-medium">{plan.burst_limit}</span></div>
                  </div>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    className="w-full mt-6 py-2 bg-violet-600/50 hover:bg-violet-600 text-white rounded-lg text-sm font-medium transition-colors">
                    Edit Plan
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
