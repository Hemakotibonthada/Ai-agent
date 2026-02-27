import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, Unlock, Eye, EyeOff, AlertTriangle, CheckCircle,
  XCircle, Key, FileText, Globe, Server, Clock, ChevronRight,
  Search, Filter, RefreshCw, Copy, Download, Upload, Settings,
  Activity, Fingerprint, Zap, BarChart3, Users, Wifi
} from 'lucide-react';

type CertStatus = 'valid' | 'expiring' | 'expired' | 'revoked';
type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Certificate {
  id: string;
  domain: string;
  issuer: string;
  type: 'EV' | 'OV' | 'DV' | 'Self-Signed';
  status: CertStatus;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  algorithm: string;
  keySize: number;
  sans: string[];
  autoRenew: boolean;
}

interface SecurityScan {
  id: string;
  type: string;
  severity: ScanSeverity;
  title: string;
  description: string;
  asset: string;
  discoveredAt: string;
  status: 'open' | 'fixed' | 'accepted' | 'false_positive';
  cve?: string;
  cvss?: number;
  remediation: string;
}

interface AccessLog {
  id: string;
  timestamp: string;
  source: string;
  action: string;
  result: 'allowed' | 'blocked' | 'flagged';
  details: string;
  location: string;
}

const certificates: Certificate[] = [
  { id: 'cert_1', domain: '*.nexus-ai.app', issuer: "Let's Encrypt R3", type: 'DV', status: 'valid',
    validFrom: '2025-04-01', validTo: '2025-09-28', serialNumber: '03:A1:B2:C3:D4:E5:F6:07',
    algorithm: 'RSA-SHA256', keySize: 2048, sans: ['nexus-ai.app', '*.nexus-ai.app', 'api.nexus-ai.app'], autoRenew: true },
  { id: 'cert_2', domain: 'api.nexus-ai.app', issuer: 'DigiCert SHA2', type: 'OV', status: 'valid',
    validFrom: '2025-01-15', validTo: '2026-01-15', serialNumber: '0F:B3:C7:D1:E9:A2:34:56',
    algorithm: 'ECDSA-P256', keySize: 256, sans: ['api.nexus-ai.app', 'api-v2.nexus-ai.app'], autoRenew: true },
  { id: 'cert_3', domain: 'admin.nexus-ai.app', issuer: 'DigiCert EV', type: 'EV', status: 'expiring',
    validFrom: '2024-08-01', validTo: '2025-08-01', serialNumber: '12:34:56:78:9A:BC:DE:F0',
    algorithm: 'RSA-SHA256', keySize: 4096, sans: ['admin.nexus-ai.app'], autoRenew: false },
  { id: 'cert_4', domain: 'staging.nexus-ai.app', issuer: 'Self-Signed', type: 'Self-Signed', status: 'expired',
    validFrom: '2024-06-01', validTo: '2025-06-01', serialNumber: 'AA:BB:CC:DD:EE:FF:00:11',
    algorithm: 'RSA-SHA256', keySize: 2048, sans: ['staging.nexus-ai.app', 'dev.nexus-ai.app'], autoRenew: false },
  { id: 'cert_5', domain: 'internal.nexus-ai.local', issuer: 'Internal CA', type: 'DV', status: 'valid',
    validFrom: '2025-03-01', validTo: '2026-03-01', serialNumber: '99:88:77:66:55:44:33:22',
    algorithm: 'ECDSA-P384', keySize: 384, sans: ['internal.nexus-ai.local', '*.internal.nexus-ai.local'], autoRenew: true },
];

const scans: SecurityScan[] = [
  { id: 'scan_1', type: 'Dependency', severity: 'critical', title: 'Remote Code Execution in lodash <4.17.21',
    description: 'Prototype pollution vulnerability allowing RCE via crafted object', asset: 'package.json',
    discoveredAt: '2025-07-14T06:00:00Z', status: 'open', cve: 'CVE-2021-23337', cvss: 9.8,
    remediation: 'Upgrade lodash to >=4.17.21' },
  { id: 'scan_2', type: 'Container', severity: 'high', title: 'OpenSSL Buffer Overflow',
    description: 'Buffer overflow in X.509 certificate verification', asset: 'docker/backend:latest',
    discoveredAt: '2025-07-13T12:00:00Z', status: 'fixed', cve: 'CVE-2022-3602', cvss: 7.5,
    remediation: 'Rebuild container with updated base image' },
  { id: 'scan_3', type: 'SAST', severity: 'medium', title: 'SQL Injection potential in query builder',
    description: 'User input concatenated directly into SQL query string', asset: 'backend/database/repositories.py:142',
    discoveredAt: '2025-07-12T09:00:00Z', status: 'open', cvss: 6.5,
    remediation: 'Use parameterized queries instead of string concatenation' },
  { id: 'scan_4', type: 'Secret', severity: 'high', title: 'Hardcoded API key detected',
    description: 'AWS access key found in configuration file', asset: 'backend/core/config.py:87',
    discoveredAt: '2025-07-11T15:00:00Z', status: 'fixed',
    remediation: 'Move to environment variables or secrets manager' },
  { id: 'scan_5', type: 'DAST', severity: 'low', title: 'Missing X-Content-Type-Options header',
    description: 'Response missing X-Content-Type-Options: nosniff header', asset: 'https://api.nexus-ai.app',
    discoveredAt: '2025-07-10T08:00:00Z', status: 'accepted',
    remediation: 'Add X-Content-Type-Options: nosniff to response headers' },
  { id: 'scan_6', type: 'SAST', severity: 'info', title: 'Console.log statement in production code',
    description: 'Debug logging statement left in production bundle', asset: 'frontend/src/lib/api.ts:45',
    discoveredAt: '2025-07-10T08:00:00Z', status: 'open',
    remediation: 'Remove or replace with structured logging' },
  { id: 'scan_7', type: 'Dependency', severity: 'medium', title: 'Regular Expression Denial of Service',
    description: 'ReDoS vulnerability in email validation regex', asset: 'package.json (validator)',
    discoveredAt: '2025-07-09T14:00:00Z', status: 'open', cve: 'CVE-2023-12345', cvss: 5.3,
    remediation: 'Update validator to >=13.9.0' },
];

const accessLogs: AccessLog[] = [
  { id: 'log_1', timestamp: '2025-07-14T09:15:33Z', source: '203.0.113.42', action: 'API Access /admin/settings',
    result: 'blocked', details: 'IP not in whitelist', location: 'Singapore' },
  { id: 'log_2', timestamp: '2025-07-14T09:10:22Z', source: '10.0.1.15', action: 'SSH Login',
    result: 'allowed', details: 'Key-based auth successful', location: 'Internal' },
  { id: 'log_3', timestamp: '2025-07-14T08:45:00Z', source: '192.168.1.100', action: 'Database Query (DROP TABLE)',
    result: 'flagged', details: 'Destructive query detected', location: 'Internal' },
  { id: 'log_4', timestamp: '2025-07-14T08:30:15Z', source: '198.51.100.23', action: 'Login Attempt',
    result: 'blocked', details: 'Brute force detected (15 failures)', location: 'Netherlands' },
  { id: 'log_5', timestamp: '2025-07-14T08:22:00Z', source: '10.0.2.30', action: 'Certificate renew',
    result: 'allowed', details: 'Auto-renewal triggered', location: 'Internal' },
  { id: 'log_6', timestamp: '2025-07-14T08:15:00Z', source: '172.16.0.5', action: 'Firewall rule update',
    result: 'allowed', details: 'Added IP range 10.0.3.0/24', location: 'Internal' },
  { id: 'log_7', timestamp: '2025-07-14T07:55:00Z', source: '45.33.32.156', action: 'Port scan detected',
    result: 'blocked', details: 'Nmap scan on ports 1-1024', location: 'United States' },
  { id: 'log_8', timestamp: '2025-07-14T07:30:00Z', source: '10.0.1.20', action: 'Secret rotation',
    result: 'allowed', details: 'Database credentials rotated', location: 'Internal' },
];

const severityColors: Record<ScanSeverity, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#6b7280',
};

const certStatusColors: Record<CertStatus, string> = {
  valid: '#10b981', expiring: '#f59e0b', expired: '#ef4444', revoked: '#6b7280',
};

const resultColors: Record<string, string> = {
  allowed: '#10b981', blocked: '#ef4444', flagged: '#f59e0b',
};

export default function SecurityCenter() {
  const [activeTab, setActiveTab] = useState<'overview' | 'certificates' | 'vulnerabilities' | 'access'>('overview');
  const [scanFilter, setScanFilter] = useState<ScanSeverity | 'all'>('all');
  const [expandedScan, setExpandedScan] = useState<string | null>(null);

  const securityScore = 78;
  const openVulns = scans.filter(s => s.status === 'open').length;
  const criticalVulns = scans.filter(s => s.severity === 'critical' && s.status === 'open').length;
  const validCerts = certificates.filter(c => c.status === 'valid').length;
  const expiringCerts = certificates.filter(c => c.status === 'expiring').length;

  const filteredScans = scans.filter(s => scanFilter === 'all' || s.severity === scanFilter);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Shield },
    { id: 'certificates' as const, label: 'Certificates', icon: Lock },
    { id: 'vulnerabilities' as const, label: 'Vulnerabilities', icon: AlertTriangle },
    { id: 'access' as const, label: 'Access Logs', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6 text-white">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
          Security Center
        </h1>
        <p className="text-gray-400 mt-1">Monitor certificates, vulnerabilities, and access patterns</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-8 border border-white/10">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                activeTab === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Security Score */}
            <motion.div whileHover={{ y: -2 }} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 col-span-1 md:col-span-2 lg:col-span-1">
              <div className="text-center">
                <div className="relative w-28 h-28 mx-auto mb-3">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none"
                      stroke={securityScore >= 80 ? '#10b981' : securityScore >= 60 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="8" strokeDasharray={`${securityScore * 2.64} 264`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold">{securityScore}</span>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-300">Security Score</div>
                <div className="text-xs text-gray-500">Good - Room for improvement</div>
              </div>
            </motion.div>

            {[
              { label: 'Open Vulnerabilities', value: openVulns, sub: `${criticalVulns} critical`, icon: AlertTriangle, color: openVulns > 0 ? '#ef4444' : '#10b981' },
              { label: 'Valid Certificates', value: `${validCerts}/${certificates.length}`, sub: `${expiringCerts} expiring`, icon: Lock, color: '#10b981' },
              { label: 'Blocked Today', value: accessLogs.filter(l => l.result === 'blocked').length, sub: 'Last 24h', icon: Shield, color: '#f59e0b' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.label} whileHover={{ y: -2 }} className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" style={{ color: stat.color }} />
                    <span className="text-xs text-gray-400">{stat.label}</span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.sub}</div>
                </motion.div>
              );
            })}
          </div>

          {/* Recent Threats */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="font-semibold text-gray-300 mb-4">Recent Threats & Events</h3>
            <div className="space-y-3">
              {[...scans.filter(s => s.status === 'open').slice(0, 3), ...accessLogs.filter(l => l.result === 'blocked').slice(0, 3)]
                .sort((a, b) => {
                  const ta = 'discoveredAt' in a ? a.discoveredAt : a.timestamp;
                  const tb = 'discoveredAt' in b ? b.discoveredAt : b.timestamp;
                  return new Date(tb).getTime() - new Date(ta).getTime();
                })
                .map((item, i) => {
                  const isScan = 'severity' in item;
                  const color = isScan ? severityColors[(item as SecurityScan).severity] : '#ef4444';
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {isScan ? (item as SecurityScan).title : (item as AccessLog).action}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isScan ? (item as SecurityScan).asset : `${(item as AccessLog).source} — ${(item as AccessLog).location}`}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{
                        backgroundColor: `${color}15`, color,
                      }}>
                        {isScan ? (item as SecurityScan).severity : 'blocked'}
                      </span>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </motion.div>
      )}

      {/* Certificates Tab */}
      {activeTab === 'certificates' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {certificates.map((cert, i) => (
            <motion.div key={cert.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${certStatusColors[cert.status]}15` }}>
                    {cert.status === 'valid' ? <Lock className="w-5 h-5 text-green-400" /> :
                     cert.status === 'expiring' ? <Clock className="w-5 h-5 text-yellow-400" /> :
                     <Unlock className="w-5 h-5 text-red-400" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{cert.domain}</h3>
                    <div className="text-xs text-gray-500">{cert.issuer} · {cert.type}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{
                    backgroundColor: `${certStatusColors[cert.status]}15`, color: certStatusColors[cert.status],
                  }}>{cert.status}</span>
                  {cert.autoRenew && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-xs">Auto-renew</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div><span className="text-gray-500">Valid From</span><div className="mt-0.5">{cert.validFrom}</div></div>
                <div><span className="text-gray-500">Valid To</span><div className="mt-0.5">{cert.validTo}</div></div>
                <div><span className="text-gray-500">Algorithm</span><div className="mt-0.5 font-mono">{cert.algorithm}</div></div>
                <div><span className="text-gray-500">Key Size</span><div className="mt-0.5">{cert.keySize} bits</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {cert.sans.map(san => (
                  <span key={san} className="px-2 py-0.5 bg-white/5 rounded text-xs text-gray-400 font-mono">{san}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Vulnerabilities Tab */}
      {activeTab === 'vulnerabilities' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10 mb-6 w-fit">
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map(f => (
              <button key={f} onClick={() => setScanFilter(f)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all capitalize ${scanFilter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredScans.map((scan, i) => (
              <motion.div key={scan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setExpandedScan(expandedScan === scan.id ? null : scan.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-full min-h-[40px] rounded-full" style={{ backgroundColor: severityColors[scan.severity] }} />
                      <div>
                        <h3 className="font-semibold text-sm">{scan.title}</h3>
                        <div className="text-xs text-gray-500 mt-0.5">{scan.asset}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {scan.cvss && (
                        <span className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono">CVSS {scan.cvss}</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{
                        backgroundColor: `${severityColors[scan.severity]}15`, color: severityColors[scan.severity],
                      }}>{scan.severity}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                        scan.status === 'fixed' ? 'bg-green-500/10 text-green-400' :
                        scan.status === 'accepted' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      }`}>{scan.status}</span>
                      <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expandedScan === scan.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>
                <AnimatePresence>
                  {expandedScan === scan.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5">
                      <div className="p-4 space-y-3">
                        <div className="text-sm text-gray-300">{scan.description}</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><span className="text-gray-500">Type</span><div className="mt-0.5">{scan.type}</div></div>
                          <div><span className="text-gray-500">Discovered</span><div className="mt-0.5">{new Date(scan.discoveredAt).toLocaleDateString()}</div></div>
                          {scan.cve && <div><span className="text-gray-500">CVE</span><div className="mt-0.5 font-mono text-red-400">{scan.cve}</div></div>}
                          {scan.cvss && <div><span className="text-gray-500">CVSS Score</span><div className="mt-0.5">{scan.cvss}/10</div></div>}
                        </div>
                        <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                          <div className="text-xs text-green-400 font-medium mb-1">Remediation</div>
                          <div className="text-sm text-gray-300">{scan.remediation}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Access Logs Tab */}
      {activeTab === 'access' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">Time</th>
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">Source</th>
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">Action</th>
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">Result</th>
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">Details</th>
                    <th className="text-left p-3 text-xs text-gray-500 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLogs.map((log, i) => (
                    <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="p-3 text-xs text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="p-3 text-xs font-mono">{log.source}</td>
                      <td className="p-3 text-xs">{log.action}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                          style={{ backgroundColor: `${resultColors[log.result]}15`, color: resultColors[log.result] }}>
                          {log.result}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-gray-400 max-w-[200px] truncate">{log.details}</td>
                      <td className="p-3 text-xs text-gray-400">{log.location}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
