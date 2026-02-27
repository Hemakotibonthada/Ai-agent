import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, AlertTriangle, Eye, Activity, Globe,
  Key, Users, FileWarning, CheckCircle, XCircle,
  Clock, Search, Filter, Download, RefreshCw,
  Fingerprint, Wifi, Server, Bug, AlertCircle as AlertIcon,
  ChevronRight, Monitor, MapPin, TrendingUp, BarChart3
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { FadeIn } from '../lib/animations';

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'access_denied' | 'anomaly' | 'scan' | 'policy_violation' | 'brute_force';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  source: string;
  timestamp: string;
  details?: string;
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-500' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-500' },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-500' },
  low: { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-500' },
  info: { color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700/50', border: 'border-gray-500' },
};

const threatData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  threats: Math.floor(Math.random() * 15),
  blocked: Math.floor(Math.random() * 12),
  allowed: Math.floor(Math.random() * 3),
}));

const loginData = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (6 - i));
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
    success: 20 + Math.floor(Math.random() * 30),
    failed: Math.floor(Math.random() * 8),
  };
});

const attackTypeData = [
  { name: 'Brute Force', value: 34, color: '#ef4444' },
  { name: 'Port Scan', value: 22, color: '#f97316' },
  { name: 'SQL Injection', value: 8, color: '#eab308' },
  { name: 'XSS Attempt', value: 5, color: '#8b5cf6' },
  { name: 'DDoS', value: 15, color: '#3b82f6' },
  { name: 'Other', value: 16, color: '#6b7280' },
];

const geoData = [
  { country: 'United States', attacks: 45, flag: '🇺🇸' },
  { country: 'Russia', attacks: 28, flag: '🇷🇺' },
  { country: 'China', attacks: 22, flag: '🇨🇳' },
  { country: 'Brazil', attacks: 12, flag: '🇧🇷' },
  { country: 'India', attacks: 8, flag: '🇮🇳' },
  { country: 'Germany', attacks: 6, flag: '🇩🇪' },
  { country: 'Nigeria', attacks: 5, flag: '🇳🇬' },
];

const securityEvents: SecurityEvent[] = [
  { id: '1', type: 'brute_force', severity: 'critical', message: 'Brute force attack detected on SSH port 22', source: '194.67.89.123', timestamp: '2 min ago', details: '142 failed attempts in 5 minutes' },
  { id: '2', type: 'access_denied', severity: 'high', message: 'Unauthorized API access attempt with expired token', source: '10.0.0.45', timestamp: '15 min ago', details: 'Token expired 2 hours ago' },
  { id: '3', type: 'anomaly', severity: 'high', message: 'Unusual data exfiltration pattern detected', source: 'Internal', timestamp: '30 min ago', details: '2.4GB outbound to unknown endpoint' },
  { id: '4', type: 'scan', severity: 'medium', message: 'Port scan detected from external IP', source: '103.45.67.89', timestamp: '1 hour ago', details: 'Scanned ports 1-1024' },
  { id: '5', type: 'login_attempt', severity: 'medium', message: 'Multiple failed login attempts for admin account', source: '192.168.1.50', timestamp: '2 hours ago', details: '5 failed attempts, account temporarily locked' },
  { id: '6', type: 'policy_violation', severity: 'low', message: 'Password policy violation: weak password detected', source: 'user: demo_user', timestamp: '3 hours ago' },
  { id: '7', type: 'login_attempt', severity: 'info', message: 'Successful login from new device', source: '192.168.1.100', timestamp: '4 hours ago', details: 'Chrome on Windows 11' },
  { id: '8', type: 'scan', severity: 'medium', message: 'Vulnerability scan completed: 2 issues found', source: 'System', timestamp: '6 hours ago', details: '2 medium severity vulnerabilities' },
  { id: '9', type: 'anomaly', severity: 'high', message: 'Spike in API error rates detected', source: 'API Gateway', timestamp: '8 hours ago', details: 'Error rate jumped from 0.1% to 5.2%' },
  { id: '10', type: 'brute_force', severity: 'critical', message: 'Distributed brute force attack from botnet', source: 'Multiple IPs', timestamp: '12 hours ago', details: '2,400 attempts from 89 unique IPs' },
];

const SecurityDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'compliance' | 'threats'>('overview');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const securityScore = 87;
  const filteredEvents = useMemo(() =>
    securityEvents.filter(e => severityFilter === 'all' || e.severity === severityFilter),
  [severityFilter]);

  const stats = {
    totalEvents: securityEvents.length,
    critical: securityEvents.filter(e => e.severity === 'critical').length,
    blocked: 156,
    activeThreats: 3,
  };

  const complianceItems = [
    { name: 'Password Policy', status: 'pass', detail: 'Min 12 chars, uppercase, number, symbol', score: 100 },
    { name: 'Two-Factor Auth', status: 'pass', detail: 'Enabled for all admin accounts', score: 100 },
    { name: 'Data Encryption', status: 'pass', detail: 'AES-256 at rest, TLS 1.3 in transit', score: 100 },
    { name: 'Access Control', status: 'pass', detail: 'RBAC with 5 roles, least privilege', score: 95 },
    { name: 'Audit Logging', status: 'pass', detail: 'All actions logged with 90-day retention', score: 100 },
    { name: 'Vulnerability Scan', status: 'warning', detail: '2 medium vulnerabilities found', score: 75 },
    { name: 'Backup Policy', status: 'pass', detail: 'Daily backups, 30-day retention', score: 100 },
    { name: 'Certificate Management', status: 'warning', detail: 'SSL cert expires in 15 days', score: 60 },
    { name: 'Network Segmentation', status: 'pass', detail: 'Proper VLAN separation', score: 90 },
    { name: 'Incident Response Plan', status: 'pass', detail: 'Documented and tested quarterly', score: 85 },
  ];

  return (
    <div className="space-y-6 p-6">
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Shield className="text-green-500" size={32} />
              Security Dashboard
            </h1>
            <p className="text-gray-500 mt-1">Real-time security monitoring and threat analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium">
              <AlertTriangle size={14} /> {stats.activeThreats} Active Threats
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium">
              <Download size={14} /> Export
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {(['overview', 'events', 'compliance', 'threats'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
            }`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Security Score + Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <FadeIn delay={0.05} className="md:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center">
                <h3 className="text-sm font-semibold text-gray-500 mb-4">Security Score</h3>
                <div className="relative w-32 h-32 mx-auto mb-4">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <motion.circle cx="60" cy="60" r="52" fill="none"
                      stroke={securityScore >= 80 ? '#10b981' : securityScore >= 60 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="10" strokeLinecap="round"
                      initial={{ strokeDasharray: '0 327' }}
                      animate={{ strokeDasharray: `${securityScore * 3.27} 327` }}
                      transition={{ duration: 1.5 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{securityScore}</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium">Good</span>
              </div>
            </FadeIn>
            {[
              { label: 'Total Events (24h)', value: stats.totalEvents, icon: <Activity size={18} />, color: 'text-blue-500', bg: 'from-blue-500 to-cyan-500' },
              { label: 'Critical Alerts', value: stats.critical, icon: <AlertTriangle size={18} />, color: 'text-red-500', bg: 'from-red-500 to-orange-500' },
              { label: 'Threats Blocked', value: stats.blocked, icon: <Shield size={18} />, color: 'text-green-500', bg: 'from-green-500 to-emerald-500' },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={0.1 + i * 0.05}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.bg} text-white w-fit mb-3`}>{stat.icon}</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FadeIn delay={0.15}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-red-500" /> Threat Activity (24h)
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={threatData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Threats" />
                    <Area type="monotone" dataKey="blocked" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Blocked" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Lock size={16} className="text-blue-500" /> Login Activity (7 days)
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={loginData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                    <Bar dataKey="success" fill="#10b981" radius={[4, 4, 0, 0]} name="Success" />
                    <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>
          </div>

          {/* Recent Events Preview */}
          <FadeIn delay={0.25}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent Security Events</h3>
                <button onClick={() => setActiveTab('events')} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  View All <ChevronRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {securityEvents.slice(0, 5).map(event => (
                  <div key={event.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <div className={`w-2 h-2 rounded-full ${SEVERITY_CONFIG[event.severity].border.replace('border', 'bg')}`} />
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SEVERITY_CONFIG[event.severity].bg} ${SEVERITY_CONFIG[event.severity].color}`}>
                      {event.severity.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">{event.message}</span>
                    <span className="text-xs text-gray-500">{event.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </>
      )}

      {activeTab === 'events' && (
        <FadeIn delay={0.1}>
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {['all', 'critical', 'high', 'medium', 'low', 'info'].map(sev => (
                <button key={sev} onClick={() => setSeverityFilter(sev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    severityFilter === sev
                      ? sev === 'all' ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900'
                      : `${SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG].bg} ${SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG].color}`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                  }`}>{sev} {sev !== 'all' && `(${securityEvents.filter(e => e.severity === sev).length})`}</button>
              ))}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {filteredEvents.map(event => (
                <motion.div key={event.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                  className={`px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 border-l-3 ${SEVERITY_CONFIG[event.severity].border}`}
                  style={{ borderLeftWidth: '3px' }}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SEVERITY_CONFIG[event.severity].bg} ${SEVERITY_CONFIG[event.severity].color}`}>
                      {event.severity.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{event.message}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{event.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Globe size={10} /> {event.source}</span>
                    <span className="capitalize">{event.type.replace('_', ' ')}</span>
                  </div>
                  <AnimatePresence>
                    {selectedEvent?.id === event.id && event.details && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-600 dark:text-gray-400">
                          {event.details}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {activeTab === 'compliance' && (
        <FadeIn delay={0.1}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Security Compliance Checklist</h3>
              <p className="text-xs text-gray-500 mt-1">Overall compliance: {Math.round(complianceItems.reduce((s, i) => s + i.score, 0) / complianceItems.length)}%</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {complianceItems.map(item => (
                <div key={item.name} className="px-5 py-4 flex items-center gap-4">
                  {item.status === 'pass' ? (
                    <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                      <span className={`text-sm font-bold ${item.score >= 90 ? 'text-green-500' : item.score >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {item.score}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
                    <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full mt-2 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${item.score}%` }} transition={{ duration: 1 }}
                        className={`h-full rounded-full ${item.score >= 90 ? 'bg-green-500' : item.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {activeTab === 'threats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FadeIn delay={0.1}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Attack Types Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={attackTypeData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {attackTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3">
                {attackTypeData.map(item => (
                  <span key={item.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name} ({item.value}%)
                  </span>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-red-500" /> Threats by Origin
              </h3>
              <div className="space-y-3">
                {geoData.map(item => (
                  <div key={item.country} className="flex items-center gap-3">
                    <span className="text-lg">{item.flag}</span>
                    <span className="text-sm text-gray-900 dark:text-white flex-1">{item.country}</span>
                    <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full"
                        style={{ width: `${(item.attacks / geoData[0].attacks) * 100}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-8 text-right">{item.attacks}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;
