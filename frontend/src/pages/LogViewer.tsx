import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, Filter, ChevronDown, Clock, AlertCircle,
  AlertTriangle, Info, Bug, CheckCircle, Download, RefreshCw,
  Pause, Play, X, ChevronRight, Terminal, Wifi, Shield,
  Cpu, HardDrive, Zap, Copy, Eye, Settings
} from 'lucide-react';
import { FadeIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

type LogLevel = 'info' | 'warning' | 'error' | 'debug' | 'success';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
  metadata?: Record<string, string>;
}

const LEVEL_CONFIG: Record<LogLevel, { icon: React.ReactNode; color: string; bg: string }> = {
  info: { icon: <Info size={14} />, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  warning: { icon: <AlertTriangle size={14} />, color: 'text-yellow-500', bg: 'bg-nexus-warning/15' },
  error: { icon: <AlertCircle size={14} />, color: 'text-red-500', bg: 'bg-nexus-error/15' },
  debug: { icon: <Bug size={14} />, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  success: { icon: <CheckCircle size={14} />, color: 'text-green-500', bg: 'bg-nexus-success/15' },
};

const SOURCES = ['System', 'AI Engine', 'Security', 'Network', 'Scheduler', 'Database', 'MQTT', 'API', 'Agent', 'Auth'];

const generateLogs = (count: number): LogEntry[] => {
  const messages: Record<LogLevel, string[]> = {
    info: [
      'Agent orchestrator initialized successfully',
      'WebSocket connection established from client',
      'Scheduler job "daily-backup" triggered',
      'Cache invalidated for key: user_preferences',
      'New API key generated for user admin',
      'Model embedding updated: 15420 vectors indexed',
      'MQTT topic subscribed: home/sensors/+',
      'Database connection pool resized to 10',
      'Plugin "weather-integration" loaded successfully',
      'Feature flag "dark-mode-v2" evaluated for 142 users',
    ],
    warning: [
      'High memory usage detected: 82% threshold exceeded',
      'Rate limit approaching for endpoint /api/chat (80/100)',
      'SSL certificate expires in 15 days',
      'Slow query detected: 2.3s on analytics aggregation',
      'MQTT broker reconnection attempt #3',
      'Disk space below 20% on /data volume',
      'API response time degraded: avg 450ms (threshold: 200ms)',
      'Token refresh failed for user: demo_user, retrying...',
    ],
    error: [
      'Failed to connect to external API: timeout after 30s',
      'Database migration rollback triggered on table: agent_logs',
      'Unhandled exception in voice_service: AudioDeviceError',
      'Authentication failed: invalid JWT signature',
      'Pipeline "transaction-etl" failed at step 3: validation error',
      'SMTP connection refused: email notification not sent',
    ],
    debug: [
      'Request parsed: GET /api/agents?limit=10&offset=0',
      'Cache hit for key: dashboard_metrics (TTL: 45s remaining)',
      'Agent decision tree evaluated: 12 nodes, 3 branches taken',
      'WebSocket frame sent: 1.2KB binary payload',
      'Token validated: exp=1710532800, iat=1710446400',
      'RAG engine query: cosine similarity threshold 0.78',
    ],
    success: [
      'Backup completed successfully: 145MB compressed',
      'All health checks passed (15/15 services)',
      'Model fine-tuning completed: accuracy 94.2%',
      'Security scan completed: 0 vulnerabilities found',
      'Data pipeline "user-analytics" completed: 15420 records processed',
    ],
  };

  const logs: LogEntry[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const levels: LogLevel[] = ['info', 'info', 'info', 'debug', 'debug', 'warning', 'warning', 'error', 'success'];
    const level = levels[Math.floor(Math.random() * levels.length)];
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const msgs = messages[level];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    const time = new Date(now.getTime() - i * (5000 + Math.random() * 30000));

    logs.push({
      id: `log-${i}`,
      timestamp: time.toISOString(),
      level,
      source,
      message: msg,
      details: Math.random() > 0.7 ? `Stack trace or additional details for log entry ${i}.\nLine 42: ${source.toLowerCase()}_service.py\nFunction: process_request()` : undefined,
      metadata: Math.random() > 0.5 ? {
        request_id: `req_${Math.random().toString(36).substr(2, 9)}`,
        duration: `${Math.floor(Math.random() * 2000)}ms`,
        user: Math.random() > 0.5 ? 'admin' : 'system',
      } : undefined,
    });
  }
  return logs;
};

const LogViewer: React.FC = () => {
  const isDemo = useIsDemoAccount();
  const [logs, setLogs] = useState<LogEntry[]>(() => isDemo ? generateLogs(100) : []);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Simulate live log streaming
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const newLog = generateLogs(1)[0];
      newLog.timestamp = new Date().toISOString();
      newLog.id = `log-live-${Date.now()}`;
      setLogs(prev => [newLog, ...prev].slice(0, 500));
    }, 3000);
    return () => clearInterval(interval);
  }, [paused]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase()) &&
          !log.source.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, levelFilter, sourceFilter, search]);

  const stats = useMemo(() => ({
    total: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    warning: logs.filter(l => l.level === 'warning').length,
    error: logs.filter(l => l.level === 'error').length,
    debug: logs.filter(l => l.level === 'debug').length,
    success: logs.filter(l => l.level === 'success').length,
  }), [logs]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      '.' + d.getMilliseconds().toString().padStart(3, '0');
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <Terminal className="text-green-500" size={32} />
              Log Viewer
            </h1>
            <p className="text-nexus-muted mt-1">Real-time system logs · {filteredLogs.length} entries</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                paused ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
              }`}>
              {paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setLogs([])}
              className="flex items-center gap-2 px-4 py-2 bg-nexus-surface text-nexus-text rounded-xl text-sm font-medium">
              <RefreshCw size={14} /> Clear
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-nexus-surface text-nexus-text rounded-xl text-sm font-medium">
              <Download size={14} /> Export
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Stats Bar */}
      {showStats && (
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: stats.total, color: 'text-nexus-muted' },
              { label: 'Info', value: stats.info, color: 'text-blue-500' },
              { label: 'Success', value: stats.success, color: 'text-green-500' },
              { label: 'Warning', value: stats.warning, color: 'text-yellow-500' },
              { label: 'Error', value: stats.error, color: 'text-red-500' },
              { label: 'Debug', value: stats.debug, color: 'text-purple-500' },
            ].map(stat => (
              <div key={stat.label} className="bg-nexus-card rounded-xl p-3 border border-nexus-border text-center">
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-nexus-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-nexus-card border border-nexus-border text-sm text-nexus-text outline-none focus:ring-2 focus:ring-nexus-primary" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'info', 'warning', 'error', 'debug', 'success'] as const).map(level => (
              <button key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  levelFilter === level
                    ? level === 'all' ? 'bg-nexus-card text-white dark:bg-white dark:text-nexus-text'
                    : `${LEVEL_CONFIG[level as LogLevel].bg} ${LEVEL_CONFIG[level as LogLevel].color}`
                    : 'bg-nexus-surface text-nexus-muted'
                }`}>
                {level !== 'all' && <span className="mr-1">{React.cloneElement(LEVEL_CONFIG[level as LogLevel].icon as React.ReactElement, { size: 10 })}</span>}
                {level}
              </button>
            ))}
          </div>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-nexus-card border border-nexus-border text-sm text-nexus-text outline-none">
            <option value="all">All Sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </FadeIn>

      {/* Log Stream */}
      <FadeIn delay={0.15}>
        <div className="bg-nexus-bg rounded-2xl border border-nexus-border overflow-hidden">
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-nexus-card border-b border-nexus-border">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-nexus-muted ml-2 font-mono">nexus-logs — {filteredLogs.length} entries</span>
            </div>
            <div className="flex items-center gap-2">
              {!paused && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  LIVE
                </span>
              )}
            </div>
          </div>

          {/* Log Entries */}
          <div ref={logContainerRef} className="max-h-[500px] overflow-y-auto font-mono text-xs">
            {filteredLogs.map((log, i) => (
              <motion.div key={log.id}
                initial={i === 0 ? { backgroundColor: 'rgba(59, 130, 246, 0.1)' } : {}}
                animate={{ backgroundColor: 'transparent' }}
                transition={{ duration: 2 }}
              >
                <div
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className={`flex items-start gap-2 px-4 py-1.5 hover:bg-gray-800/50 cursor-pointer border-l-2 ${
                    log.level === 'error' ? 'border-red-500' :
                    log.level === 'warning' ? 'border-yellow-500' :
                    log.level === 'success' ? 'border-green-500' :
                    log.level === 'debug' ? 'border-purple-500' :
                    'border-transparent'
                  }`}
                >
                  <span className="text-nexus-muted select-none flex-shrink-0 w-20">{formatTime(log.timestamp)}</span>
                  <span className={`flex-shrink-0 w-6 ${LEVEL_CONFIG[log.level].color}`}>{LEVEL_CONFIG[log.level].icon}</span>
                  <span className="text-cyan-400 flex-shrink-0 w-20 truncate">[{log.source}]</span>
                  <span className={`flex-1 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warning' ? 'text-yellow-300' :
                    log.level === 'success' ? 'text-green-400' :
                    log.level === 'debug' ? 'text-purple-300' :
                    'text-nexus-muted'
                  }`}>
                    {log.message}
                  </span>
                  {(log.details || log.metadata) && (
                    <ChevronRight size={12} className={`text-nexus-muted transition-transform flex-shrink-0 ${expandedLog === log.id ? 'rotate-90' : ''}`} />
                  )}
                </div>
                <AnimatePresence>
                  {expandedLog === log.id && (log.details || log.metadata) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-2 ml-28 bg-gray-800/50 rounded-lg my-1 mr-4 border border-nexus-border">
                        {log.details && <pre className="text-nexus-muted text-xs whitespace-pre-wrap mb-2">{log.details}</pre>}
                        {log.metadata && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(log.metadata).map(([key, val]) => (
                              <span key={key} className="px-2 py-0.5 rounded bg-nexus-surface text-nexus-muted text-[10px]">
                                {key}: <span className="text-blue-300">{val}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-nexus-muted">
                <FileText size={32} className="mx-auto mb-3 opacity-50" />
                <p>No logs match your filters</p>
              </div>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  );
};

export default LogViewer;
