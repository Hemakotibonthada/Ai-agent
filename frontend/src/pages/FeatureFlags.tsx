import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag, ToggleLeft, ToggleRight, Plus, Search, Filter,
  Users, Clock, Target, BarChart2, Activity, Settings2,
  ChevronRight, Check, X, AlertTriangle, Percent,
  Calendar, Shield, FlaskConical, Zap, Globe, Eye,
  TrendingUp, Hash, Edit3, Trash2, Copy
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  type: 'boolean' | 'percentage' | 'user_list' | 'ab_test' | 'gradual_rollout' | 'time_based' | 'environment';
  enabled: boolean;
  value: any;
  percentage?: number;
  variants?: { name: string; weight: number; conversions: number }[];
  targetUsers?: number;
  environment?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

const flagsData: FeatureFlag[] = [
  { id: 'ff-1', name: 'dark-mode-v2', description: 'Enhanced dark mode with OLED support and custom accents', type: 'boolean', enabled: true, value: true, tags: ['ui', 'theme'], createdAt: '2024-01-15', updatedAt: '2024-03-10', createdBy: 'Admin' },
  { id: 'ff-2', name: 'ai-suggestions', description: 'AI-powered contextual suggestions in all input fields', type: 'percentage', enabled: true, value: true, percentage: 75, tags: ['ai', 'ux'], createdAt: '2024-02-01', updatedAt: '2024-03-08', createdBy: 'System' },
  { id: 'ff-3', name: 'new-dashboard', description: 'Redesigned dashboard with widget customization', type: 'ab_test', enabled: true, value: true, variants: [{ name: 'Control', weight: 50, conversions: 1250 }, { name: 'Variant A', weight: 30, conversions: 1480 }, { name: 'Variant B', weight: 20, conversions: 1120 }], tags: ['ab-test', 'dashboard'], createdAt: '2024-01-20', updatedAt: '2024-03-12', createdBy: 'Admin' },
  { id: 'ff-4', name: 'voice-commands-v3', description: 'Next-gen voice commands with natural language understanding', type: 'gradual_rollout', enabled: true, value: true, percentage: 45, tags: ['voice', 'ai', 'rollout'], createdAt: '2024-02-15', updatedAt: '2024-03-11', createdBy: 'System' },
  { id: 'ff-5', name: 'real-time-collab', description: 'Real-time collaborative editing for shared workspaces', type: 'user_list', enabled: true, value: true, targetUsers: 150, tags: ['collaboration', 'beta'], createdAt: '2024-03-01', updatedAt: '2024-03-09', createdBy: 'Admin' },
  { id: 'ff-6', name: 'advanced-analytics', description: 'Advanced analytics dashboard with custom metrics', type: 'environment', enabled: true, value: true, environment: 'production', tags: ['analytics', 'env'], createdAt: '2024-02-10', updatedAt: '2024-03-07', createdBy: 'System' },
  { id: 'ff-7', name: 'plugin-marketplace', description: 'Full plugin marketplace with ratings and reviews', type: 'boolean', enabled: true, value: true, tags: ['plugins', 'marketplace'], createdAt: '2024-01-25', updatedAt: '2024-03-06', createdBy: 'Admin' },
  { id: 'ff-8', name: '3d-visualization', description: '3D data visualization for network and home layouts', type: 'percentage', enabled: false, value: false, percentage: 0, tags: ['3d', 'visualization'], createdAt: '2024-03-05', updatedAt: '2024-03-05', createdBy: 'System' },
  { id: 'ff-9', name: 'smart-notifications', description: 'AI-prioritized notification system with batching', type: 'gradual_rollout', enabled: true, value: true, percentage: 80, tags: ['notifications', 'ai'], createdAt: '2024-01-10', updatedAt: '2024-03-10', createdBy: 'Admin' },
  { id: 'ff-10', name: 'biometric-auth', description: 'Fingerprint and face recognition authentication', type: 'time_based', enabled: false, value: false, tags: ['security', 'auth'], createdAt: '2024-03-08', updatedAt: '2024-03-08', createdBy: 'System' },
  { id: 'ff-11', name: 'workflow-builder', description: 'Visual workflow builder with drag-and-drop', type: 'boolean', enabled: true, value: true, tags: ['workflow', 'automation'], createdAt: '2024-02-20', updatedAt: '2024-03-11', createdBy: 'Admin' },
  { id: 'ff-12', name: 'auto-backup', description: 'Automated encrypted backups every 6 hours', type: 'boolean', enabled: true, value: true, tags: ['backup', 'security'], createdAt: '2024-01-05', updatedAt: '2024-03-09', createdBy: 'System' },
];

const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  boolean: { icon: <ToggleRight size={14} />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Boolean' },
  percentage: { icon: <Percent size={14} />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'Percentage' },
  user_list: { icon: <Users size={14} />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'User List' },
  ab_test: { icon: <FlaskConical size={14} />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'A/B Test' },
  gradual_rollout: { icon: <TrendingUp size={14} />, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', label: 'Gradual Rollout' },
  time_based: { icon: <Clock size={14} />, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Time-Based' },
  environment: { icon: <Globe size={14} />, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Environment' },
};

const abTestData = [
  { name: 'Control', conversions: 1250, color: '#6366f1' },
  { name: 'Variant A', conversions: 1480, color: '#10b981' },
  { name: 'Variant B', conversions: 1120, color: '#f59e0b' },
];

const FeatureFlags: React.FC = () => {
  const [flags, setFlags] = useState(isDemo ? flagsData : []);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);

  const toggleFlag = (id: string) => {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const filtered = useMemo(() => flags.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || f.type === filterType;
    const matchEnabled = filterEnabled === 'all' || (filterEnabled === 'enabled' ? f.enabled : !f.enabled);
    return matchSearch && matchType && matchEnabled;
  }), [flags, search, filterType, filterEnabled]);

  const stats = useMemo(() => ({
    total: flags.length,
    enabled: flags.filter(f => f.enabled).length,
    abTests: flags.filter(f => f.type === 'ab_test').length,
    rollouts: flags.filter(f => f.type === 'gradual_rollout').length,
  }), [flags]);

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Flag className="text-orange-500" size={32} />
              Feature Flags
            </h1>
            <p className="text-gray-500 mt-1">Manage feature rollouts, A/B tests, and configurations</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 shadow-lg shadow-orange-500/25">
            <Plus size={18} /> New Flag
          </motion.button>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Flags', value: stats.total, icon: <Flag size={18} className="text-orange-500" />, bg: 'bg-orange-500/10' },
            { label: 'Enabled', value: stats.enabled, icon: <Check size={18} className="text-green-500" />, bg: 'bg-green-500/10' },
            { label: 'A/B Tests', value: stats.abTests, icon: <FlaskConical size={18} className="text-purple-500" />, bg: 'bg-purple-500/10' },
            { label: 'Rollouts', value: stats.rollouts, icon: <TrendingUp size={18} className="text-cyan-500" />, bg: 'bg-cyan-500/10' },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}>{s.icon}</div>
                <div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </FadeIn>

      {/* A/B Test Results Chart */}
      <FadeIn delay={0.15}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FlaskConical size={18} className="text-orange-500" />
            A/B Test: New Dashboard — Conversion Results
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={abTestData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="conversions" radius={[0, 6, 6, 0]}>
                {abTestData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.2}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search flags..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none text-gray-700 dark:text-gray-300">
            <option value="all">All Types</option>
            {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
            {(['all', 'enabled', 'disabled'] as const).map(s => (
              <button key={s} onClick={() => setFilterEnabled(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filterEnabled === s ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Flags Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Flag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rollout</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((flag, i) => (
                <motion.tr
                  key={flag.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedFlag(flag)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{flag.name}</div>
                    <div className="text-xs text-gray-500 line-clamp-1 max-w-xs">{flag.description}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeConfig[flag.type]?.color || ''}`}>
                      {typeConfig[flag.type]?.icon}
                      {typeConfig[flag.type]?.label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button onClick={e => { e.stopPropagation(); toggleFlag(flag.id); }}
                      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${flag.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <motion.span animate={{ x: flag.enabled ? 20 : 2 }}
                        className="inline-block w-5 h-5 bg-white rounded-full shadow-md mt-0.5" />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    {flag.percentage !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${flag.percentage}%` }}
                            className="h-full bg-orange-500 rounded-full" />
                        </div>
                        <span className="text-xs text-gray-500">{flag.percentage}%</span>
                      </div>
                    )}
                    {flag.targetUsers && <span className="text-xs text-gray-500">{flag.targetUsers} users</span>}
                    {flag.environment && <span className="text-xs text-gray-500">{flag.environment}</span>}
                    {flag.type === 'boolean' && <span className="text-xs text-gray-500">{flag.enabled ? '100%' : '0%'}</span>}
                    {flag.variants && <span className="text-xs text-gray-500">{flag.variants.length} variants</span>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      {flag.tags.slice(0, 2).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">{flag.updatedAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><Edit3 size={14} /></button>
                      <button onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><Copy size={14} /></button>
                      <button onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Flag size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No flags found</h3>
          <p className="text-gray-500">Try adjusting your filters.</p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedFlag && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedFlag(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedFlag.name}</h2>
                <button onClick={() => setSelectedFlag(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <p className="text-gray-500 mb-4">{selectedFlag.description}</p>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-500">Type</span>
                  <span className={`text-sm font-medium ${typeConfig[selectedFlag.type]?.color}`}>{typeConfig[selectedFlag.type]?.label}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className={`text-sm font-medium ${selectedFlag.enabled ? 'text-green-500' : 'text-red-500'}`}>{selectedFlag.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-500">Created</span>
                  <span className="text-sm text-gray-900 dark:text-white">{selectedFlag.createdAt}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span className="text-sm text-gray-500">Created By</span>
                  <span className="text-sm text-gray-900 dark:text-white">{selectedFlag.createdBy}</span>
                </div>
              </div>
              {selectedFlag.variants && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Variants</h3>
                  <div className="space-y-2">
                    {selectedFlag.variants.map(v => (
                      <div key={v.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{v.name} ({v.weight}%)</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{v.conversions} conversions</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { toggleFlag(selectedFlag.id); setSelectedFlag({ ...selectedFlag, enabled: !selectedFlag.enabled }); }}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium ${selectedFlag.enabled ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                  {selectedFlag.enabled ? 'Disable Flag' : 'Enable Flag'}
                </motion.button>
                <button className="px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium">
                  <Edit3 size={18} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FeatureFlags;
