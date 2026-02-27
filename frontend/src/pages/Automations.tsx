import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Play, Pause, Clock, Plus, Search, Filter,
  Settings, ChevronRight, Repeat, Calendar, Sun,
  Moon, Thermometer, Home, Lock, Bell, Wifi,
  Power, Timer, ArrowRight, CheckCircle, XCircle,
  AlertTriangle, Trash2, Edit3, Copy, ToggleLeft,
  Brain, Eye, Volume2, Mail, Shield, Cpu, Activity
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: { type: string; icon: React.ReactNode; label: string; config: string };
  conditions: { label: string; operator: string; value: string }[];
  actions: { icon: React.ReactNode; label: string; detail: string; color: string }[];
  enabled: boolean;
  lastRun?: string;
  runs: number;
  category: string;
}

const automations: Automation[] = [
  {
    id: '1', name: 'Morning Routine', description: 'Starts your perfect morning automatically',
    trigger: { type: 'time', icon: <Sun size={16} />, label: 'Every day at 6:30 AM', config: 'cron: 30 6 * * *' },
    conditions: [{ label: 'Day', operator: 'is weekday', value: 'Mon-Fri' }],
    actions: [
      { icon: <Home size={14} />, label: 'Turn on lights', detail: 'Living room - 50% warm', color: 'bg-yellow-500' },
      { icon: <Thermometer size={14} />, label: 'Set temperature', detail: 'HVAC - 72°F', color: 'bg-orange-500' },
      { icon: <Volume2 size={14} />, label: 'Play briefing', detail: 'News + Weather + Calendar', color: 'bg-blue-500' },
      { icon: <Bell size={14} />, label: 'Send notification', detail: 'Morning tasks summary', color: 'bg-purple-500' },
    ],
    enabled: true, lastRun: '6:30 AM today', runs: 245, category: 'Daily',
  },
  {
    id: '2', name: 'Security Alert Response', description: 'Responds to detected security threats',
    trigger: { type: 'event', icon: <Shield size={16} />, label: 'Security threat detected', config: 'event: security.threat_detected' },
    conditions: [{ label: 'Severity', operator: '>=', value: 'high' }],
    actions: [
      { icon: <Lock size={14} />, label: 'Lock all doors', detail: 'Smart locks activated', color: 'bg-red-500' },
      { icon: <Eye size={14} />, label: 'Enable cameras', detail: 'All cameras - HD recording', color: 'bg-cyan-500' },
      { icon: <Bell size={14} />, label: 'Alert notification', detail: 'Push + SMS + Email', color: 'bg-orange-500' },
      { icon: <Cpu size={14} />, label: 'Analyze threat', detail: 'AI security analysis', color: 'bg-purple-500' },
    ],
    enabled: true, lastRun: '2 days ago', runs: 12, category: 'Security',
  },
  {
    id: '3', name: 'Good Night', description: 'Prepare house for bedtime',
    trigger: { type: 'time', icon: <Moon size={16} />, label: 'Every day at 10:30 PM', config: 'cron: 30 22 * * *' },
    conditions: [],
    actions: [
      { icon: <Home size={14} />, label: 'Dim lights', detail: 'All rooms - 10%', color: 'bg-yellow-500' },
      { icon: <Lock size={14} />, label: 'Lock doors', detail: 'Front + Back + Garage', color: 'bg-red-500' },
      { icon: <Thermometer size={14} />, label: 'Set temperature', detail: 'HVAC - 68°F night mode', color: 'bg-blue-500' },
      { icon: <Power size={14} />, label: 'Turn off devices', detail: 'TV + Kitchen appliances', color: 'bg-gray-500' },
    ],
    enabled: true, lastRun: '10:30 PM yesterday', runs: 189, category: 'Daily',
  },
  {
    id: '4', name: 'High CPU Alert', description: 'Alert when system resources are strained',
    trigger: { type: 'metric', icon: <Activity size={16} />, label: 'CPU > 85% for 5 min', config: 'metric: system.cpu > 85 duration: 5m' },
    conditions: [{ label: 'Sustained', operator: '>', value: '5 minutes' }],
    actions: [
      { icon: <Bell size={14} />, label: 'Send alert', detail: 'Admin notification', color: 'bg-orange-500' },
      { icon: <Cpu size={14} />, label: 'Scale resources', detail: 'Auto-scale workers', color: 'bg-blue-500' },
      { icon: <Activity size={14} />, label: 'Log event', detail: 'Performance log entry', color: 'bg-green-500' },
    ],
    enabled: true, lastRun: '3 hours ago', runs: 28, category: 'System',
  },
  {
    id: '5', name: 'Weekly Report', description: 'Generate and deliver weekly activity report',
    trigger: { type: 'schedule', icon: <Calendar size={16} />, label: 'Every Sunday at 8 PM', config: 'cron: 0 20 * * 0' },
    conditions: [],
    actions: [
      { icon: <Activity size={14} />, label: 'Compile analytics', detail: 'Aggregate weekly data', color: 'bg-purple-500' },
      { icon: <Brain size={14} />, label: 'AI summary', detail: 'Generate insights', color: 'bg-indigo-500' },
      { icon: <Mail size={14} />, label: 'Email report', detail: 'Send to admin@nexusai.local', color: 'bg-cyan-500' },
    ],
    enabled: true, lastRun: 'Last Sunday', runs: 12, category: 'Reports',
  },
  {
    id: '6', name: 'Guest Welcome', description: 'Activate welcome routine when guests arrive',
    trigger: { type: 'event', icon: <Wifi size={16} />, label: 'New device detected on network', config: 'event: network.new_device' },
    conditions: [{ label: 'Known guest', operator: '=', value: 'true' }],
    actions: [
      { icon: <Home size={14} />, label: 'Set guest mode', detail: 'WiFi + lighting preset', color: 'bg-green-500' },
      { icon: <Volume2 size={14} />, label: 'Welcome message', detail: 'Play greeting via speakers', color: 'bg-blue-500' },
      { icon: <Bell size={14} />, label: 'Notify host', detail: 'Push notification', color: 'bg-orange-500' },
    ],
    enabled: false, lastRun: '2 weeks ago', runs: 5, category: 'Home',
  },
  {
    id: '7', name: 'Health Anomaly Detection', description: 'Monitor health metrics for anomalies',
    trigger: { type: 'metric', icon: <Activity size={16} />, label: 'Health metric out of range', config: 'metric: health.* out_of_range' },
    conditions: [{ label: 'Deviation', operator: '>', value: '2 std dev' }],
    actions: [
      { icon: <Bell size={14} />, label: 'Health alert', detail: 'Push + in-app notification', color: 'bg-red-500' },
      { icon: <Brain size={14} />, label: 'AI analysis', detail: 'Pattern recognition check', color: 'bg-purple-500' },
      { icon: <Activity size={14} />, label: 'Log reading', detail: 'Store in health records', color: 'bg-green-500' },
    ],
    enabled: true, lastRun: '1 day ago', runs: 34, category: 'Health',
  },
  {
    id: '8', name: 'Auto Backup', description: 'Daily database and config backup',
    trigger: { type: 'schedule', icon: <Clock size={16} />, label: 'Daily at 3:00 AM', config: 'cron: 0 3 * * *' },
    conditions: [],
    actions: [
      { icon: <Cpu size={14} />, label: 'Backup database', detail: 'Full PostgreSQL dump', color: 'bg-blue-500' },
      { icon: <Cpu size={14} />, label: 'Backup configs', detail: 'Archive config files', color: 'bg-indigo-500' },
      { icon: <Cpu size={14} />, label: 'Upload to cloud', detail: 'Encrypt + S3 upload', color: 'bg-cyan-500' },
      { icon: <Bell size={14} />, label: 'Confirm backup', detail: 'Log completion status', color: 'bg-green-500' },
    ],
    enabled: true, lastRun: '3:00 AM today', runs: 89, category: 'System',
  },
];

const CATEGORIES = ['All', 'Daily', 'Security', 'System', 'Reports', 'Home', 'Health'];

const Automations: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [localAutomations, setLocalAutomations] = useState(automations);

  const filteredAutomations = localAutomations.filter(a => {
    if (category !== 'All' && a.category !== category) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleEnabled = (id: string) => {
    setLocalAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const stats = {
    total: localAutomations.length,
    active: localAutomations.filter(a => a.enabled).length,
    totalRuns: localAutomations.reduce((sum, a) => sum + a.runs, 0),
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Zap className="text-yellow-500" size={32} />
              Automations
            </h1>
            <p className="text-gray-500 mt-1">{stats.active}/{stats.total} active · {stats.totalRuns.toLocaleString()} total runs</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> New Automation
          </motion.button>
        </div>
      </FadeIn>

      {/* Stats */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Automations', value: stats.total, icon: <Zap size={16} />, color: 'text-yellow-500' },
            { label: 'Active', value: stats.active, icon: <CheckCircle size={16} />, color: 'text-green-500' },
            { label: 'Total Runs', value: stats.totalRuns.toLocaleString(), icon: <Repeat size={16} />, color: 'text-blue-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className={`${stat.color} mb-1`}>{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Search & Filter */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search automations..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === cat ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                }`}>{cat}</button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Automation List */}
      <div className="space-y-4">
        {filteredAutomations.map((auto, i) => (
          <FadeIn key={auto.id} delay={0.15 + i * 0.03}>
            <motion.div whileHover={{ y: -2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${auto.enabled ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                      <Zap size={18} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{auto.name}</h3>
                      <p className="text-xs text-gray-500">{auto.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      auto.category === 'Security' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      auto.category === 'Daily' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      auto.category === 'System' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>{auto.category}</span>
                    <button onClick={() => toggleEnabled(auto.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${auto.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <motion.div animate={{ x: auto.enabled ? 20 : 2 }}
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                    </button>
                  </div>
                </div>

                {/* Flow Visualization */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {/* Trigger */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex-shrink-0">
                    <span className="text-blue-500">{auto.trigger.icon}</span>
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">{auto.trigger.label}</span>
                  </div>

                  {/* Conditions */}
                  {auto.conditions.map((cond, ci) => (
                    <React.Fragment key={ci}>
                      <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                      <div className="px-3 py-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex-shrink-0">
                        <span className="text-xs text-yellow-700 dark:text-yellow-300">{cond.label} {cond.operator} {cond.value}</span>
                      </div>
                    </React.Fragment>
                  ))}

                  {/* Actions */}
                  <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                  <div className="flex items-center gap-1">
                    {auto.actions.map((action, ai) => (
                      <div key={ai} className={`w-7 h-7 rounded-lg ${action.color} text-white flex items-center justify-center flex-shrink-0`}
                        title={action.label}>
                        {action.icon}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  {auto.lastRun && <span className="flex items-center gap-1"><Clock size={10} /> Last: {auto.lastRun}</span>}
                  <span className="flex items-center gap-1"><Repeat size={10} /> {auto.runs} runs</span>
                  <button onClick={() => setSelectedAutomation(auto)} className="ml-auto text-blue-500 hover:text-blue-600 flex items-center gap-1">
                    Details <ChevronRight size={10} />
                  </button>
                </div>
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAutomation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedAutomation(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedAutomation.name}</h3>
                <button onClick={() => setSelectedAutomation(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <XCircle size={16} className="text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{selectedAutomation.description}</p>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Trigger</h4>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500">{selectedAutomation.trigger.icon}</span>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{selectedAutomation.trigger.label}</span>
                    </div>
                    <code className="text-xs text-blue-500 mt-1 block">{selectedAutomation.trigger.config}</code>
                  </div>
                </div>

                {selectedAutomation.conditions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Conditions</h4>
                    {selectedAutomation.conditions.map((cond, i) => (
                      <div key={i} className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-sm text-yellow-700 dark:text-yellow-300">
                        {cond.label} {cond.operator} {cond.value}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Actions ({selectedAutomation.actions.length})</h4>
                  <div className="space-y-2">
                    {selectedAutomation.actions.map((action, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                        <div className={`p-1.5 rounded-lg ${action.color} text-white`}>{action.icon}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{action.label}</div>
                          <div className="text-xs text-gray-500">{action.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium">
                  <Play size={14} /> Run Now
                </button>
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
                  <Edit3 size={14} />
                </button>
                <button className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-red-500 rounded-xl text-sm font-medium">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Automations;
