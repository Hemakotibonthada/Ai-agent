import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Plus, Play, Pause, Square, RefreshCw, ArrowUp,
  ArrowDown, Clock, AlertCircle, CheckCircle, Search,
  Settings, Trash2, Copy, ExternalLink, Activity, Globe,
  Lock, ChevronRight, MoreVertical, Terminal, GitBranch,
  Package, Layers, Cpu, HardDrive, Wifi, Shield, Zap,
  BarChart3, X, Upload, Download
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface Deployment {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'development';
  status: 'running' | 'deploying' | 'stopped' | 'failed' | 'rollback';
  version: string;
  branch: string;
  commit: string;
  deployedAt: string;
  deployedBy: string;
  instances: number;
  cpu: number;
  memory: number;
  uptime: string;
  healthChecks: { name: string; status: 'pass' | 'fail' | 'warn' }[];
  metrics: { time: string; requests: number; latency: number; errors: number }[];
}

const deployments: Deployment[] = [
  {
    id: '1', name: 'nexus-api', environment: 'production', status: 'running', version: 'v2.4.1',
    branch: 'main', commit: '82bd257', deployedAt: '2 hours ago', deployedBy: 'CI/CD Pipeline',
    instances: 3, cpu: 34, memory: 62, uptime: '14d 6h 32m',
    healthChecks: [
      { name: 'HTTP /health', status: 'pass' },
      { name: 'Database', status: 'pass' },
      { name: 'Redis', status: 'pass' },
      { name: 'MQTT Broker', status: 'pass' },
    ],
    metrics: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`, requests: 200 + Math.random() * 300, latency: 20 + Math.random() * 50, errors: Math.random() * 5,
    })),
  },
  {
    id: '2', name: 'nexus-frontend', environment: 'production', status: 'running', version: 'v2.4.1',
    branch: 'main', commit: '82bd257', deployedAt: '2 hours ago', deployedBy: 'CI/CD Pipeline',
    instances: 2, cpu: 12, memory: 38, uptime: '14d 6h 32m',
    healthChecks: [
      { name: 'HTTP /health', status: 'pass' },
      { name: 'CDN', status: 'pass' },
      { name: 'WebSocket', status: 'pass' },
    ],
    metrics: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`, requests: 500 + Math.random() * 500, latency: 10 + Math.random() * 20, errors: Math.random() * 2,
    })),
  },
  {
    id: '3', name: 'nexus-api', environment: 'staging', status: 'deploying', version: 'v2.5.0-rc1',
    branch: 'feature/mega-features', commit: 'a3f2d9e', deployedAt: 'Just now', deployedBy: 'admin',
    instances: 1, cpu: 67, memory: 45, uptime: '0m',
    healthChecks: [
      { name: 'HTTP /health', status: 'warn' },
      { name: 'Database', status: 'pass' },
      { name: 'Redis', status: 'pass' },
    ],
    metrics: Array.from({ length: 10 }, (_, i) => ({
      time: `${i}:00`, requests: 50 + Math.random() * 100, latency: 30 + Math.random() * 80, errors: Math.random() * 10,
    })),
  },
  {
    id: '4', name: 'nexus-workers', environment: 'production', status: 'running', version: 'v2.4.0',
    branch: 'main', commit: '7cd91a2', deployedAt: '3 days ago', deployedBy: 'CI/CD Pipeline',
    instances: 4, cpu: 78, memory: 71, uptime: '3d 12h 4m',
    healthChecks: [
      { name: 'Queue Worker', status: 'pass' },
      { name: 'Scheduler', status: 'pass' },
      { name: 'Pipeline Engine', status: 'warn' },
    ],
    metrics: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`, requests: 100 + Math.random() * 200, latency: 50 + Math.random() * 100, errors: Math.random() * 3,
    })),
  },
  {
    id: '5', name: 'nexus-ml', environment: 'development', status: 'stopped', version: 'v0.3.0-dev',
    branch: 'feature/ml-pipeline', commit: 'e4f7b3c', deployedAt: '1 week ago', deployedBy: 'admin',
    instances: 0, cpu: 0, memory: 0, uptime: '-',
    healthChecks: [
      { name: 'Model Server', status: 'fail' },
      { name: 'GPU Worker', status: 'fail' },
    ],
    metrics: [],
  },
  {
    id: '6', name: 'nexus-api', environment: 'development', status: 'failed', version: 'v2.5.0-dev',
    branch: 'feature/new-auth', commit: 'b1d8e5f', deployedAt: '4 hours ago', deployedBy: 'admin',
    instances: 0, cpu: 0, memory: 0, uptime: '-',
    healthChecks: [
      { name: 'HTTP /health', status: 'fail' },
      { name: 'Database', status: 'fail' },
    ],
    metrics: [],
  },
];

const statusConfig = {
  running: { color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', dot: 'bg-green-500', label: 'Running' },
  deploying: { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', dot: 'bg-blue-500 animate-pulse', label: 'Deploying' },
  stopped: { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10', dot: 'bg-gray-400', label: 'Stopped' },
  failed: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10', dot: 'bg-red-500', label: 'Failed' },
  rollback: { color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', dot: 'bg-orange-500', label: 'Rolling Back' },
};

const envConfig = {
  production: { color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  staging: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  development: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
};

const DeploymentManager: React.FC = () => {
  const [envFilter, setEnvFilter] = useState('all');
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(deployments[0]);
  const [detailTab, setDetailTab] = useState<'overview' | 'health' | 'metrics' | 'logs'>('overview');

  const filtered = useMemo(() =>
    deployments.filter(d => envFilter === 'all' || d.environment === envFilter),
  [envFilter]);

  const recentLogs = [
    { time: '14:32:01', level: 'info', message: 'Health check passed: HTTP /health (200 OK, 12ms)' },
    { time: '14:31:58', level: 'info', message: 'Request completed: POST /api/chat (200, 1.2s)' },
    { time: '14:31:45', level: 'warn', message: 'Slow query detected: SELECT * FROM agents (320ms)' },
    { time: '14:31:30', level: 'info', message: 'WebSocket connection established: client_42' },
    { time: '14:31:15', level: 'info', message: 'Cache hit ratio: 94.2% (last 5 minutes)' },
    { time: '14:30:58', level: 'debug', message: 'Agent orchestrator: routing to PersonalAgent' },
    { time: '14:30:45', level: 'info', message: 'MQTT message received: home/temperature (22.5°C)' },
    { time: '14:30:30', level: 'error', message: 'Rate limit exceeded for API key: sk_***9f2a' },
    { time: '14:30:15', level: 'info', message: 'Scheduled job completed: daily_backup (45s)' },
    { time: '14:30:00', level: 'info', message: 'Health check passed: Database (PostgreSQL, 5ms)' },
  ];

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Server className="text-blue-500" size={32} />
              Deployments
            </h1>
            <p className="text-gray-500 mt-1">Manage service deployments and infrastructure</p>
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
              <RefreshCw size={14} /> Refresh
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-medium">
              <Upload size={14} /> Deploy
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: deployments.length, color: 'text-blue-500' },
            { label: 'Running', value: deployments.filter(d => d.status === 'running').length, color: 'text-green-500' },
            { label: 'Deploying', value: deployments.filter(d => d.status === 'deploying').length, color: 'text-blue-500' },
            { label: 'Instances', value: deployments.reduce((s, d) => s + d.instances, 0), color: 'text-purple-500' },
            { label: 'Failed', value: deployments.filter(d => d.status === 'failed').length, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Filter */}
      <FadeIn delay={0.1}>
        <div className="flex gap-2">
          {['all', 'production', 'staging', 'development'].map(env => (
            <button key={env} onClick={() => setEnvFilter(env)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                envFilter === env ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              }`}>{env}</button>
          ))}
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployment List */}
        <div className="space-y-2">
          {filtered.map(dep => {
            const sc = statusConfig[dep.status];
            const ec = envConfig[dep.environment];
            return (
              <motion.div key={dep.id} whileHover={{ x: 4 }}
                onClick={() => { setSelectedDeployment(dep); setDetailTab('overview'); }}
                className={`bg-white dark:bg-gray-800 rounded-xl p-3 border cursor-pointer transition-all ${
                  selectedDeployment?.id === dep.id
                    ? 'border-blue-300 dark:border-blue-600 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{dep.name}</h3>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ec.color}`}>{dep.environment}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 ml-4">
                  <span>{dep.version}</span>
                  <span className="flex items-center gap-0.5"><GitBranch size={9} /> {dep.branch}</span>
                  <span>{dep.deployedAt}</span>
                </div>
                {dep.status === 'running' && (
                  <div className="flex gap-3 mt-2 ml-4">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Cpu size={9} className="text-blue-500" />
                      <span className="text-gray-500">{dep.cpu}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <HardDrive size={9} className="text-purple-500" />
                      <span className="text-gray-500">{dep.memory}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Layers size={9} className="text-green-500" />
                      <span className="text-gray-500">{dep.instances} instances</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedDeployment ? (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                {(['overview', 'health', 'metrics', 'logs'] as const).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      detailTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                    }`}>{tab}</button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {detailTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{selectedDeployment.name}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Version', value: selectedDeployment.version },
                        { label: 'Branch', value: selectedDeployment.branch },
                        { label: 'Commit', value: selectedDeployment.commit },
                        { label: 'Deployed By', value: selectedDeployment.deployedBy },
                        { label: 'Deployed At', value: selectedDeployment.deployedAt },
                        { label: 'Uptime', value: selectedDeployment.uptime },
                        { label: 'Instances', value: String(selectedDeployment.instances) },
                        { label: 'Status', value: statusConfig[selectedDeployment.status].label },
                      ].map(item => (
                        <div key={item.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                          <div className="text-[10px] text-gray-500 uppercase">{item.label}</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium flex items-center gap-1"><Play size={12} /> Restart</button>
                      <button className="px-3 py-1.5 rounded-lg bg-yellow-500 text-white text-xs font-medium flex items-center gap-1"><RefreshCw size={12} /> Rollback</button>
                      <button className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium flex items-center gap-1"><Square size={12} /> Stop</button>
                      <button className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium flex items-center gap-1"><ArrowUp size={12} /> Scale Up</button>
                    </div>
                  </motion.div>
                )}

                {detailTab === 'health' && (
                  <motion.div key="health" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Health Checks</h3>
                    <div className="space-y-3">
                      {selectedDeployment.healthChecks.map(check => (
                        <div key={check.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                          {check.status === 'pass' && <CheckCircle size={16} className="text-green-500" />}
                          {check.status === 'fail' && <X size={16} className="text-red-500" />}
                          {check.status === 'warn' && <AlertCircle size={16} className="text-yellow-500" />}
                          <span className="text-sm text-gray-900 dark:text-white flex-1">{check.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            check.status === 'pass' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' :
                            check.status === 'fail' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                          }`}>{check.status}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {detailTab === 'metrics' && selectedDeployment.metrics.length > 0 && (
                  <motion.div key="metrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Requests (24h)</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={selectedDeployment.metrics}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }} />
                          <Area type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Latency & Errors</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={selectedDeployment.metrics}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 11 }} />
                          <Line type="monotone" dataKey="latency" name="Latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="errors" name="Errors" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}

                {detailTab === 'logs' && (
                  <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="bg-gray-900 rounded-2xl p-4 border border-gray-700 font-mono text-xs">
                    <div className="space-y-1">
                      {recentLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-gray-500">{log.time}</span>
                          <span className={
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-yellow-400' :
                            log.level === 'debug' ? 'text-gray-500' : 'text-green-400'
                          }>[{log.level.padEnd(5)}]</span>
                          <span className="text-gray-300">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 text-sm">Select a deployment to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeploymentManager;
