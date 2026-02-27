import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Clock, Zap, Brain, Shield, Home, Heart,
  DollarSign, Mic, Camera, Wifi, MessageSquare, Target,
  TrendingUp, TrendingDown, Minus, RefreshCw, Calendar,
  Users, FileText, BarChart3, Globe, Bell, ChevronRight,
  X, AlertCircle, CheckCircle, Settings, Star
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FadeIn } from '../lib/animations';

interface TimelineEvent {
  id: string;
  type: 'agent' | 'system' | 'user' | 'automation' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ReactNode;
  color: string;
  metadata?: Record<string, string>;
}

const generatePerformanceData = () =>
  Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    responseTime: 50 + Math.random() * 200,
    throughput: 100 + Math.random() * 400,
    errorRate: Math.random() * 3,
  }));

const timelineEvents: TimelineEvent[] = [
  { id: '1', type: 'agent', title: 'Personal Agent completed morning briefing', description: 'Compiled news, weather, and calendar summary', timestamp: '8:30 AM',
    icon: <Brain size={14} />, color: 'bg-blue-500', metadata: { duration: '12s', items: '15' } },
  { id: '2', type: 'automation', title: 'Smart Thermostat adjusted temperature', description: 'Changed from 68°F to 72°F based on occupancy', timestamp: '8:45 AM',
    icon: <Home size={14} />, color: 'bg-green-500', metadata: { trigger: 'Occupancy sensor' } },
  { id: '3', type: 'alert', title: 'Port scan detected from external IP', description: 'Security agent blocked 103.45.67.89', timestamp: '9:12 AM',
    icon: <Shield size={14} />, color: 'bg-red-500', metadata: { severity: 'medium', blocked: 'true' } },
  { id: '4', type: 'user', title: 'Voice command: Schedule meeting', description: 'Added "Team standup" to calendar at 10:00 AM', timestamp: '9:30 AM',
    icon: <Mic size={14} />, color: 'bg-purple-500', metadata: { confidence: '98%' } },
  { id: '5', type: 'system', title: 'Automatic backup completed', description: 'Full database backup: 145MB compressed', timestamp: '10:00 AM',
    icon: <Settings size={14} />, color: 'bg-gray-500', metadata: { size: '145MB', duration: '45s' } },
  { id: '6', type: 'agent', title: 'Health agent: Step goal reached', description: 'You have reached 8,000 steps today!', timestamp: '10:30 AM',
    icon: <Heart size={14} />, color: 'bg-pink-500', metadata: { steps: '8,000', goal: '10,000' } },
  { id: '7', type: 'agent', title: 'Financial agent: Budget alert', description: 'Dining category at 85% of monthly budget', timestamp: '11:00 AM',
    icon: <DollarSign size={14} />, color: 'bg-yellow-500', metadata: { spent: '$425', budget: '$500' } },
  { id: '8', type: 'automation', title: 'Pipeline "user-analytics" completed', description: 'Processed 15,420 records in 23 seconds', timestamp: '11:15 AM',
    icon: <Activity size={14} />, color: 'bg-cyan-500', metadata: { records: '15,420', time: '23s' } },
  { id: '9', type: 'system', title: 'Model inference cache refreshed', description: 'Embedding index rebuilt: 45,000 vectors', timestamp: '11:45 AM',
    icon: <Brain size={14} />, color: 'bg-indigo-500', metadata: { vectors: '45,000' } },
  { id: '10', type: 'user', title: 'Chat: Query about project status', description: 'Personal agent provided comprehensive update', timestamp: '12:00 PM',
    icon: <MessageSquare size={14} />, color: 'bg-blue-500', metadata: { response_time: '1.2s' } },
  { id: '11', type: 'alert', title: 'High memory usage detected', description: 'System memory at 87% - cleared cache', timestamp: '12:30 PM',
    icon: <AlertCircle size={14} />, color: 'bg-orange-500', metadata: { before: '87%', after: '62%' } },
  { id: '12', type: 'automation', title: 'Weekly report generated', description: 'Activity summary emailed to admin', timestamp: '1:00 PM',
    icon: <FileText size={14} />, color: 'bg-teal-500', metadata: { pages: '12', charts: '8' } },
];

const ActivityFeed: React.FC = () => {
  const [filter, setFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [performanceData] = useState(generatePerformanceData);

  const filteredEvents = useMemo(() =>
    timelineEvents.filter(e => filter === 'all' || e.type === filter),
  [filter]);

  const agentActivity = [
    { name: 'Personal', interactions: 45, success: 98 },
    { name: 'Security', interactions: 28, success: 100 },
    { name: 'Home', interactions: 67, success: 96 },
    { name: 'Health', interactions: 34, success: 99 },
    { name: 'Finance', interactions: 22, success: 97 },
    { name: 'Work', interactions: 38, success: 95 },
    { name: 'Voice', interactions: 52, success: 94 },
  ];

  const quickStats = [
    { label: 'Events Today', value: '156', trend: '+12%', icon: <Activity size={16} />, color: 'text-blue-500' },
    { label: 'Automations Run', value: '34', trend: '+5%', icon: <Zap size={16} />, color: 'text-yellow-500' },
    { label: 'Agent Queries', value: '89', trend: '+18%', icon: <Brain size={16} />, color: 'text-purple-500' },
    { label: 'Alerts', value: '7', trend: '-23%', icon: <Bell size={16} />, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Activity className="text-blue-500" size={32} />
              Activity Feed
            </h1>
            <p className="text-gray-500 mt-1">System activity timeline and performance metrics</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
            <RefreshCw size={14} /> Refresh
          </motion.button>
        </div>
      </FadeIn>

      {/* Quick Stats */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickStats.map(stat => (
            <motion.div key={stat.label} whileHover={{ y: -4 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className={stat.color}>{stat.icon}</span>
                <span className={`text-xs font-medium ${stat.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {stat.trend}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter */}
          <FadeIn delay={0.1}>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All' },
                { key: 'agent', label: 'Agents' },
                { key: 'automation', label: 'Automations' },
                { key: 'system', label: 'System' },
                { key: 'user', label: 'User' },
                { key: 'alert', label: 'Alerts' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f.key ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}>{f.label}</button>
              ))}
            </div>
          </FadeIn>

          {/* Events */}
          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="space-y-0">
                {filteredEvents.map((event, i) => (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full ${event.color} text-white flex items-center justify-center flex-shrink-0`}>
                        {event.icon}
                      </div>
                      {i < filteredEvents.length - 1 && (
                        <div className="w-px h-full bg-gray-200 dark:bg-gray-700 my-1 min-h-[20px]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-6 flex-1" onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}>
                      <div className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-xl p-3 -ml-2 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{event.title}</h4>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{event.timestamp}</span>
                        </div>
                        <p className="text-xs text-gray-500">{event.description}</p>

                        <AnimatePresence>
                          {selectedEvent?.id === event.id && event.metadata && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="flex flex-wrap gap-2 mt-2">
                                {Object.entries(event.metadata).map(([k, v]) => (
                                  <span key={k} className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-600 dark:text-gray-400">
                                    {k}: <span className="font-medium text-gray-900 dark:text-white">{v}</span>
                                  </span>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Performance Chart */}
          <FadeIn delay={0.2}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">Response Time (24h)</h3>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={performanceData}>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="responseTime" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>

          {/* Agent Activity */}
          <FadeIn delay={0.25}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Agent Activity Today</h3>
              <div className="space-y-3">
                {agentActivity.map(agent => (
                  <div key={agent.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{agent.name}</span>
                      <span className="text-gray-500">{agent.interactions} calls · {agent.success}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${agent.success}%` }} transition={{ duration: 0.5 }}
                        className="h-full bg-blue-500 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Hot Actions */}
          <FadeIn delay={0.3}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'Run all health checks', icon: <Heart size={14} />, color: 'text-pink-500' },
                  { label: 'Trigger security scan', icon: <Shield size={14} />, color: 'text-green-500' },
                  { label: 'Generate daily report', icon: <FileText size={14} />, color: 'text-blue-500' },
                  { label: 'Clear system cache', icon: <RefreshCw size={14} />, color: 'text-orange-500' },
                ].map(action => (
                  <button key={action.label}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors">
                    <span className={action.color}>{action.icon}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{action.label}</span>
                    <ChevronRight size={12} className="ml-auto text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;
