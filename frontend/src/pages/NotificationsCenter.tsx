import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, X, Clock, AlertCircle, CheckCircle, Info,
  MessageSquare, Shield, Zap, Settings, Trash2, Archive,
  Filter, MoreVertical, Volume2, VolumeX, ChevronDown,
  Star, Eye, EyeOff, RefreshCw, Brain, Home, Heart,
  DollarSign, Activity, Calendar
} from 'lucide-react';
import { FadeIn } from '../lib/animations';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'message';
  category: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  starred: boolean;
  source: string;
  icon: React.ReactNode;
  actions?: { label: string; variant: 'primary' | 'secondary' }[];
}

const initialNotifications: Notification[] = [
  { id: '1', type: 'warning', category: 'security', title: 'Unusual login attempt detected', body: 'A login attempt from IP 203.45.67.89 was blocked. Location: Unknown. Consider reviewing your security settings.',
    timestamp: '2 min ago', read: false, starred: false, source: 'Security Agent', icon: <Shield size={14} />,
    actions: [{ label: 'Review', variant: 'primary' }, { label: 'Dismiss', variant: 'secondary' }] },
  { id: '2', type: 'success', category: 'automation', title: 'Morning routine completed', body: 'All 8 tasks in your morning routine have been executed successfully. Lights, thermostat, and briefing ready.',
    timestamp: '15 min ago', read: false, starred: false, source: 'Home Agent', icon: <Home size={14} /> },
  { id: '3', type: 'info', category: 'health', title: 'Daily health summary ready', body: 'Your daily health report has been generated. Steps: 6,234 | Sleep: 7.5h | Heart rate avg: 72 BPM',
    timestamp: '1 hour ago', read: false, starred: true, source: 'Health Agent', icon: <Heart size={14} />,
    actions: [{ label: 'View Report', variant: 'primary' }] },
  { id: '4', type: 'error', category: 'system', title: 'Pipeline "data-sync" failed', body: 'Step 3 (Transform) failed with error: Schema validation failed for 23 records. Manual review required.',
    timestamp: '2 hours ago', read: true, starred: false, source: 'System', icon: <Activity size={14} />,
    actions: [{ label: 'View Logs', variant: 'primary' }, { label: 'Retry', variant: 'secondary' }] },
  { id: '5', type: 'info', category: 'finance', title: 'Monthly budget report', body: 'Your November spending is at 67% of budget. Top categories: Dining ($425), Transport ($312), Subscriptions ($89).',
    timestamp: '3 hours ago', read: true, starred: false, source: 'Financial Agent', icon: <DollarSign size={14} /> },
  { id: '6', type: 'message', category: 'ai', title: 'AI Model training complete', body: 'Fine-tuning completed for model "personal-assistant-v3". Accuracy improved from 92.1% to 94.8%.',
    timestamp: '4 hours ago', read: true, starred: true, source: 'Training Service', icon: <Brain size={14} /> },
  { id: '7', type: 'success', category: 'automation', title: 'Backup completed successfully', body: 'Full system backup completed. Size: 2.3GB compressed. Stored in /data/backups/2024-01-15.',
    timestamp: '5 hours ago', read: true, starred: false, source: 'System', icon: <CheckCircle size={14} /> },
  { id: '8', type: 'warning', category: 'system', title: 'Disk usage above 80%', body: 'Volume /data is at 83% capacity. Consider cleaning up old logs and temporary files.',
    timestamp: '6 hours ago', read: true, starred: false, source: 'System Monitor', icon: <AlertCircle size={14} />,
    actions: [{ label: 'Clean Up', variant: 'primary' }] },
  { id: '9', type: 'info', category: 'calendar', title: 'Upcoming meeting in 30 minutes', body: 'Team standup meeting at 10:00 AM. Participants: 6 team members. Location: Virtual.',
    timestamp: '6 hours ago', read: true, starred: false, source: 'Calendar', icon: <Calendar size={14} /> },
  { id: '10', type: 'success', category: 'automation', title: 'Smart lighting adjusted', body: 'Living room lights dimmed to 40% based on sunset schedule and ambient light sensor readings.',
    timestamp: '8 hours ago', read: true, starred: false, source: 'Home Agent', icon: <Zap size={14} /> },
  { id: '11', type: 'info', category: 'ai', title: 'New plugin available', body: 'Weather Integration v2.1 is available in the marketplace. Supports hourly forecasts and severe weather alerts.',
    timestamp: '10 hours ago', read: true, starred: false, source: 'Marketplace', icon: <Info size={14} /> },
  { id: '12', type: 'warning', category: 'security', title: 'SSL certificate expiring soon', body: 'Your SSL certificate for api.nexus.local will expire in 14 days. Consider renewing it.',
    timestamp: '12 hours ago', read: true, starred: false, source: 'Security Agent', icon: <Shield size={14} />,
    actions: [{ label: 'Renew', variant: 'primary' }] },
];

const typeConfig = {
  info: { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', dot: 'bg-blue-500', icon: <Info size={14} /> },
  success: { bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', dot: 'bg-green-500', icon: <CheckCircle size={14} /> },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30', dot: 'bg-yellow-500', icon: <AlertCircle size={14} /> },
  error: { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', dot: 'bg-red-500', icon: <X size={14} /> },
  message: { bg: 'bg-purple-50 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/30', dot: 'bg-purple-500', icon: <MessageSquare size={14} /> },
};

const NotificationsCenter: React.FC = () => {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [filter, setFilter] = useState('all');
  const [showReadOnly, setShowReadOnly] = useState<'all' | 'unread' | 'starred'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (filter !== 'all' && n.category !== filter) return false;
      if (showReadOnly === 'unread' && n.read) return false;
      if (showReadOnly === 'starred' && !n.starred) return false;
      return true;
    });
  }, [notifications, filter, showReadOnly]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const categories = [...new Set(notifications.map(n => n.category))];

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const toggleStar = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications(prev => prev.filter(n => n.starred));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-nexus-text flex items-center gap-3">
              <Bell className="text-blue-500" size={32} />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-nexus-muted mt-1">Manage your alerts, updates, and system messages</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setMuted(!muted)}
              className="p-2 rounded-lg bg-nexus-surface text-nexus-text">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-nexus-surface text-nexus-text text-sm">
              <Check size={14} /> Mark all read
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 text-sm">
              <Trash2 size={14} /> Clear
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Summary Cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: notifications.length, color: 'bg-gray-500' },
            { label: 'Unread', value: unreadCount, color: 'bg-blue-500' },
            { label: 'Warnings', value: notifications.filter(n => n.type === 'warning').length, color: 'bg-yellow-500' },
            { label: 'Errors', value: notifications.filter(n => n.type === 'error').length, color: 'bg-red-500' },
            { label: 'Starred', value: notifications.filter(n => n.starred).length, color: 'bg-purple-500' },
          ].map(s => (
            <div key={s.label} className="bg-nexus-card rounded-xl p-3 border border-nexus-border flex items-center gap-3">
              <div className={`w-2 h-8 rounded-full ${s.color}`} />
              <div>
                <div className="text-lg font-bold text-nexus-text">{s.value}</div>
                <div className="text-xs text-nexus-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowReadOnly('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showReadOnly === 'all' ? 'bg-blue-500 text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
              All
            </button>
            <button onClick={() => setShowReadOnly('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showReadOnly === 'unread' ? 'bg-blue-500 text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
              Unread
            </button>
            <button onClick={() => setShowReadOnly('starred')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showReadOnly === 'starred' ? 'bg-blue-500 text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
              Starred
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-purple-500 text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
              All Categories
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${filter === cat ? 'bg-purple-500 text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Notification List */}
      <FadeIn delay={0.15}>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map(notification => {
              const config = typeConfig[notification.type];
              return (
                <motion.div key={notification.id}
                  layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -200 }} transition={{ duration: 0.2 }}
                  className={`${config.bg} border ${config.border} rounded-xl overflow-hidden ${!notification.read ? 'ring-1 ring-blue-300 dark:ring-blue-600' : ''}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${config.dot} text-white flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        {notification.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-sm font-semibold ${!notification.read ? 'text-nexus-text' : 'text-nexus-text'}`}>
                            {notification.title}
                          </h4>
                          {!notification.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-nexus-muted mb-2">{notification.body}</p>
                        <div className="flex items-center gap-3 text-[10px] text-nexus-muted">
                          <span className="flex items-center gap-1"><Clock size={10} /> {notification.timestamp}</span>
                          <span>via {notification.source}</span>
                          <span className="capitalize px-1.5 py-0.5 rounded bg-nexus-card/50 dark:bg-black/20">{notification.category}</span>
                        </div>

                        {/* Expanded actions */}
                        <AnimatePresence>
                          {expandedId === notification.id && notification.actions && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="flex gap-2 mt-3 pt-3 border-t border-current/10">
                                {notification.actions.map(action => (
                                  <button key={action.label}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                                      action.variant === 'primary'
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-nexus-card text-nexus-text hover:bg-nexus-surface'
                                    } transition-colors`}>{action.label}</button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => toggleStar(notification.id)}
                          className={`p-1.5 rounded-lg hover:bg-nexus-card/50 dark:hover:bg-black/20 transition-colors ${notification.starred ? 'text-yellow-500' : 'text-nexus-muted'}`}>
                          <Star size={14} fill={notification.starred ? 'currentColor' : 'none'} />
                        </button>
                        {!notification.read && (
                          <button onClick={() => markAsRead(notification.id)}
                            className="p-1.5 rounded-lg hover:bg-nexus-card/50 dark:hover:bg-black/20 text-nexus-muted hover:text-blue-500 transition-colors">
                            <Eye size={14} />
                          </button>
                        )}
                        {notification.actions && (
                          <button onClick={() => setExpandedId(expandedId === notification.id ? null : notification.id)}
                            className="p-1.5 rounded-lg hover:bg-nexus-card/50 dark:hover:bg-black/20 text-nexus-muted transition-colors">
                            <ChevronDown size={14} className={`transition-transform ${expandedId === notification.id ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                        <button onClick={() => deleteNotification(notification.id)}
                          className="p-1.5 rounded-lg hover:bg-nexus-card/50 dark:hover:bg-black/20 text-nexus-muted hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredNotifications.length === 0 && (
            <div className="text-center py-12">
              <Bell size={48} className="mx-auto text-nexus-muted dark:text-nexus-muted mb-3" />
              <p className="text-nexus-muted text-sm">No notifications match your filters</p>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
};

export default NotificationsCenter;
