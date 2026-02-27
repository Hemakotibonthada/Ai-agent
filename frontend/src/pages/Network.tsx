/* ===================================================================
   Nexus AI OS — Network Security Dashboard
   Interfaces, connections, threats, anomalies, firewall, devices
   =================================================================== */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Wifi,
  Globe,
  AlertTriangle,
  Activity,
  Lock,
  Server,
  Monitor,
  Smartphone,
  Router,
  BarChart3,
  Clock,
  Search,
  Download,
  Upload,
  Ban,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Network,
  Zap,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useIsDemoAccount } from '@/hooks/useDemoData';
import EmptyState from '@/components/shared/EmptyState';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */
interface NetworkInterface {
  id: string;
  name: string;
  type: string;
  ip: string;
  mac: string;
  speed: string;
  bytesSent: string;
  bytesRecv: string;
  packetsSent: number;
  packetsRecv: number;
  status: 'up' | 'down';
  icon: React.ElementType;
}

interface Connection {
  id: string;
  localAddr: string;
  remoteAddr: string;
  protocol: 'TCP' | 'UDP';
  status: 'ESTABLISHED' | 'LISTEN' | 'TIME_WAIT' | 'CLOSE_WAIT' | 'SYN_SENT';
  pid: number;
  process: string;
}

interface Threat {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  sourceIp: string;
  targetPort: number;
  timestamp: string;
  blocked: boolean;
}

interface Anomaly {
  id: string;
  metric: string;
  currentValue: string;
  baselineValue: string;
  deviationScore: number;
  severity: 'critical' | 'warning' | 'info';
}

interface FirewallRule {
  id: string;
  action: 'Allow' | 'Block' | 'Rate-Limit';
  direction: 'Inbound' | 'Outbound';
  protocol: string;
  source: string;
  destination: string;
  port: string;
  hitCount: number;
  enabled: boolean;
}

interface NetworkDevice {
  id: string;
  hostname: string;
  ip: string;
  mac: string;
  manufacturer: string;
  os: string;
  firstSeen: string;
  lastSeen: string;
  trusted: boolean;
  icon: React.ElementType;
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const mockInterfaces: NetworkInterface[] = [
  {
    id: 'if-1', name: 'Wi-Fi', type: 'Wireless', ip: '192.168.1.42', mac: 'A4:CF:12:D8:56:7E',
    speed: '866 Mbps', bytesSent: '4.2 GB', bytesRecv: '12.8 GB',
    packetsSent: 3_420_100, packetsRecv: 8_910_200, status: 'up', icon: Wifi,
  },
  {
    id: 'if-2', name: 'Ethernet', type: 'Wired', ip: '192.168.1.10', mac: 'B8:27:EB:3C:91:A0',
    speed: '1 Gbps', bytesSent: '1.1 GB', bytesRecv: '3.6 GB',
    packetsSent: 980_300, packetsRecv: 2_150_700, status: 'up', icon: Globe,
  },
  {
    id: 'if-3', name: 'Loopback', type: 'Virtual', ip: '127.0.0.1', mac: '00:00:00:00:00:00',
    speed: 'N/A', bytesSent: '256 KB', bytesRecv: '256 KB',
    packetsSent: 14_200, packetsRecv: 14_200, status: 'up', icon: Network,
  },
];

const mockConnections: Connection[] = [
  { id: 'c-1',  localAddr: '192.168.1.42:52341', remoteAddr: '142.250.80.46:443',   protocol: 'TCP', status: 'ESTABLISHED', pid: 8124,  process: 'chrome.exe' },
  { id: 'c-2',  localAddr: '192.168.1.42:52342', remoteAddr: '142.250.80.46:443',   protocol: 'TCP', status: 'ESTABLISHED', pid: 8124,  process: 'chrome.exe' },
  { id: 'c-3',  localAddr: '192.168.1.42:55100', remoteAddr: '52.114.128.40:443',   protocol: 'TCP', status: 'ESTABLISHED', pid: 4520,  process: 'ms-teams.exe' },
  { id: 'c-4',  localAddr: '0.0.0.0:8000',       remoteAddr: '0.0.0.0:0',           protocol: 'TCP', status: 'LISTEN',      pid: 12040, process: 'uvicorn' },
  { id: 'c-5',  localAddr: '0.0.0.0:5173',       remoteAddr: '0.0.0.0:0',           protocol: 'TCP', status: 'LISTEN',      pid: 9980,  process: 'node.exe' },
  { id: 'c-6',  localAddr: '192.168.1.42:52400', remoteAddr: '151.101.1.69:443',    protocol: 'TCP', status: 'ESTABLISHED', pid: 8124,  process: 'chrome.exe' },
  { id: 'c-7',  localAddr: '192.168.1.42:52401', remoteAddr: '185.199.108.133:443', protocol: 'TCP', status: 'TIME_WAIT',   pid: 0,     process: '-' },
  { id: 'c-8',  localAddr: '192.168.1.42:52412', remoteAddr: '20.190.159.2:443',    protocol: 'TCP', status: 'ESTABLISHED', pid: 3300,  process: 'Code.exe' },
  { id: 'c-9',  localAddr: '192.168.1.42:52450', remoteAddr: '104.18.32.7:443',     protocol: 'TCP', status: 'ESTABLISHED', pid: 8124,  process: 'chrome.exe' },
  { id: 'c-10', localAddr: '192.168.1.42:52460', remoteAddr: '34.117.65.55:443',    protocol: 'TCP', status: 'CLOSE_WAIT',  pid: 4520,  process: 'ms-teams.exe' },
  { id: 'c-11', localAddr: '127.0.0.1:27017',    remoteAddr: '0.0.0.0:0',           protocol: 'TCP', status: 'LISTEN',      pid: 6620,  process: 'mongod.exe' },
  { id: 'c-12', localAddr: '192.168.1.42:52500', remoteAddr: '140.82.114.26:443',   protocol: 'TCP', status: 'ESTABLISHED', pid: 3300,  process: 'Code.exe' },
  { id: 'c-13', localAddr: '192.168.1.42:137',   remoteAddr: '0.0.0.0:0',           protocol: 'UDP', status: 'LISTEN',      pid: 4,     process: 'System' },
  { id: 'c-14', localAddr: '192.168.1.42:5353',  remoteAddr: '0.0.0.0:0',           protocol: 'UDP', status: 'LISTEN',      pid: 1820,  process: 'mDNSResponder' },
  { id: 'c-15', localAddr: '192.168.1.42:52510', remoteAddr: '13.107.42.14:443',    protocol: 'TCP', status: 'SYN_SENT',    pid: 3300,  process: 'Code.exe' },
];

const mockThreats: Threat[] = [
  { id: 't-1', severity: 'critical', type: 'Port Scan',          sourceIp: '45.33.32.156',   targetPort: 22,   timestamp: '10:41 AM', blocked: true },
  { id: 't-2', severity: 'critical', type: 'Brute Force',        sourceIp: '185.220.101.34', targetPort: 3389, timestamp: '10:38 AM', blocked: true },
  { id: 't-3', severity: 'warning',  type: 'Suspicious DNS',     sourceIp: '192.168.1.105',  targetPort: 53,   timestamp: '10:32 AM', blocked: false },
  { id: 't-4', severity: 'critical', type: 'DDoS Attempt',       sourceIp: '103.224.182.244',targetPort: 80,   timestamp: '10:28 AM', blocked: true },
  { id: 't-5', severity: 'warning',  type: 'Malware Signature',  sourceIp: '192.168.1.67',   targetPort: 443,  timestamp: '10:15 AM', blocked: true },
  { id: 't-6', severity: 'info',     type: 'Unusual Outbound',   sourceIp: '192.168.1.42',   targetPort: 8443, timestamp: '10:04 AM', blocked: false },
  { id: 't-7', severity: 'warning',  type: 'Port Scan',          sourceIp: '91.189.89.199',  targetPort: 445,  timestamp: '09:55 AM', blocked: true },
  { id: 't-8', severity: 'info',     type: 'Suspicious DNS',     sourceIp: '192.168.1.20',   targetPort: 53,   timestamp: '09:40 AM', blocked: false },
];

const mockAnomalies: Anomaly[] = [
  { id: 'an-1', metric: 'Unusual outbound traffic volume',  currentValue: '240 MB/min', baselineValue: '45 MB/min',  deviationScore: 4.3, severity: 'critical' },
  { id: 'an-2', metric: 'DNS query spike',                  currentValue: '1,820/min',  baselineValue: '320/min',    deviationScore: 3.7, severity: 'warning' },
  { id: 'an-3', metric: 'New device on network',            currentValue: '1 device',   baselineValue: '0',          deviationScore: 2.1, severity: 'info' },
  { id: 'an-4', metric: 'ICMP flood pattern',               currentValue: '5,200/min',  baselineValue: '40/min',     deviationScore: 5.8, severity: 'critical' },
  { id: 'an-5', metric: 'TLS certificate mismatch',         currentValue: '3 hosts',    baselineValue: '0',          deviationScore: 2.9, severity: 'warning' },
];

const mockFirewallRules: FirewallRule[] = [
  { id: 'fw-1', action: 'Allow',      direction: 'Inbound',  protocol: 'TCP', source: 'Any',           destination: '192.168.1.42', port: '443',  hitCount: 14_320, enabled: true },
  { id: 'fw-2', action: 'Allow',      direction: 'Inbound',  protocol: 'TCP', source: '192.168.1.0/24',destination: '192.168.1.42', port: '8000', hitCount: 8_640,  enabled: true },
  { id: 'fw-3', action: 'Block',      direction: 'Inbound',  protocol: 'TCP', source: 'Any',           destination: 'Any',          port: '22',   hitCount: 3_410,  enabled: true },
  { id: 'fw-4', action: 'Block',      direction: 'Inbound',  protocol: 'TCP', source: 'Any',           destination: 'Any',          port: '3389', hitCount: 1_880,  enabled: true },
  { id: 'fw-5', action: 'Rate-Limit', direction: 'Inbound',  protocol: 'ICMP',source: 'Any',           destination: 'Any',          port: '*',    hitCount: 920,    enabled: true },
  { id: 'fw-6', action: 'Allow',      direction: 'Outbound', protocol: 'TCP', source: '192.168.1.42',  destination: 'Any',          port: '443',  hitCount: 42_100, enabled: true },
  { id: 'fw-7', action: 'Block',      direction: 'Outbound', protocol: 'TCP', source: '192.168.1.105', destination: 'Any',          port: '*',    hitCount: 210,    enabled: false },
];

const mockDevices: NetworkDevice[] = [
  { id: 'nd-1', hostname: 'nexus-workstation', ip: '192.168.1.42',  mac: 'A4:CF:12:D8:56:7E', manufacturer: 'Dell',      os: 'Windows 11',    firstSeen: 'Jan 5',  lastSeen: 'Now',      trusted: true,  icon: Monitor },
  { id: 'nd-2', hostname: 'raspberrypi',       ip: '192.168.1.10',  mac: 'B8:27:EB:3C:91:A0', manufacturer: 'Raspberry', os: 'Raspbian',      firstSeen: 'Feb 12', lastSeen: 'Now',      trusted: true,  icon: Server },
  { id: 'nd-3', hostname: 'iphone-harsha',     ip: '192.168.1.20',  mac: 'F0:18:98:A1:CC:04', manufacturer: 'Apple',     os: 'iOS 18',        firstSeen: 'Jan 5',  lastSeen: 'Now',      trusted: true,  icon: Smartphone },
  { id: 'nd-4', hostname: 'nest-hub',          ip: '192.168.1.67',  mac: '48:D6:D5:2A:EE:10', manufacturer: 'Google',    os: 'ChromeOS',      firstSeen: 'Mar 1',  lastSeen: '5 min ago',trusted: true,  icon: Monitor },
  { id: 'nd-5', hostname: 'unknown-device',    ip: '192.168.1.105', mac: 'DE:AD:BE:EF:CA:FE', manufacturer: 'Unknown',   os: 'Unknown',       firstSeen: 'Today',  lastSeen: 'Now',      trusted: false, icon: AlertTriangle },
  { id: 'nd-6', hostname: 'tp-link-router',    ip: '192.168.1.1',   mac: '50:C7:BF:12:34:56', manufacturer: 'TP-Link',   os: 'Firmware 3.2',  firstSeen: 'Jan 5',  lastSeen: 'Now',      trusted: true,  icon: Router },
];

/* ------------------------------------------------------------------ */
/*  Traffic protocol data                                              */
/* ------------------------------------------------------------------ */
const trafficProtocols = [
  { name: 'HTTPS', pct: 40, color: '#10b981' },
  { name: 'HTTP',  pct: 35, color: '#3b82f6' },
  { name: 'DNS',   pct: 10, color: '#f59e0b' },
  { name: 'TCP Other', pct: 8, color: '#8b5cf6' },
  { name: 'UDP',   pct: 5, color: '#06b6d4' },
  { name: 'ICMP',  pct: 2, color: '#ec4899' },
];

const topTalkers = [
  { ip: '192.168.1.42',  bandwidth: '4.2 GB' },
  { ip: '192.168.1.10',  bandwidth: '1.1 GB' },
  { ip: '192.168.1.67',  bandwidth: '680 MB' },
  { ip: '192.168.1.20',  bandwidth: '420 MB' },
  { ip: '192.168.1.105', bandwidth: '190 MB' },
];

/* ------------------------------------------------------------------ */
/*  Quick Actions                                                      */
/* ------------------------------------------------------------------ */
const quickActions = [
  { label: 'Scan Network',  icon: Search,   color: '#3b82f6' },
  { label: 'Block Threat',  icon: Ban,      color: '#ef4444' },
  { label: 'Add Rule',      icon: Shield,   color: '#10b981' },
  { label: 'Export Logs',   icon: Download,  color: '#f59e0b' },
  { label: 'View DNS Log',  icon: Globe,    color: '#8b5cf6' },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const connStatusColor = (status: Connection['status']): 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
  switch (status) {
    case 'ESTABLISHED': return 'success';
    case 'LISTEN':      return 'info';
    case 'TIME_WAIT':   return 'warning';
    case 'CLOSE_WAIT':  return 'warning';
    case 'SYN_SENT':    return 'neutral';
    default:            return 'neutral';
  }
};

const threatSeverityBadge = (severity: Threat['severity']) => {
  const map: Record<Threat['severity'], 'error' | 'warning' | 'info'> = {
    critical: 'error',
    warning:  'warning',
    info:     'info',
  };
  return map[severity];
};

const fwActionColor = (action: FirewallRule['action']) => {
  switch (action) {
    case 'Allow':      return 'success';
    case 'Block':      return 'error';
    case 'Rate-Limit': return 'warning';
  }
};

const healthScore = 87;

const healthColor = (score: number) => {
  if (score >= 80) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function NetworkPage() {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No network data" description="Connect your network monitoring tools to see interfaces, connections, and threats." /></div>;
  const [connFilter, setConnFilter] = useState<string>('');

  const filteredConnections = useMemo(
    () =>
      mockConnections.filter(
        (c) =>
          !connFilter ||
          c.process.toLowerCase().includes(connFilter.toLowerCase()) ||
          c.localAddr.includes(connFilter) ||
          c.remoteAddr.includes(connFilter) ||
          c.status.toLowerCase().includes(connFilter.toLowerCase()),
      ),
    [connFilter],
  );

  /* ---------------------------------------------------------------- */
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 p-4 md:p-6"
    >
      {/* ---- Page Title ---- */}
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nexus-primary/20">
          <Shield size={22} className="text-nexus-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">Network Security</h1>
          <p className="text-sm text-nexus-muted">Real-time monitoring &amp; threat intelligence</p>
        </div>
      </motion.div>

      {/* ---- Health Score + Interface Cards ---- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health Score */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <Activity size={18} className="text-nexus-primary" />
                Network Health
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4">
              {/* Circular gauge */}
              <div className="relative flex h-36 w-36 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
                  {/* Background circle */}
                  <circle cx="70" cy="70" r="56" fill="none" stroke="currentColor" strokeWidth="10" className="text-nexus-border" />
                  {/* Score arc */}
                  <circle
                    cx="70" cy="70" r="56"
                    fill="none"
                    stroke={healthColor(healthScore)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(healthScore / 100) * 352} 352`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-black text-nexus-text">{healthScore}</span>
                  <span className="text-[10px] uppercase tracking-widest text-nexus-muted">Score</span>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid w-full grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-nexus-muted">Latency</p>
                  <p className="text-sm font-bold text-nexus-text">12 ms</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-nexus-muted">Packet Loss</p>
                  <p className="text-sm font-bold text-nexus-text">0.02%</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-nexus-muted">Jitter</p>
                  <p className="text-sm font-bold text-nexus-text">3.1 ms</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-nexus-muted">BW Util</p>
                  <p className="text-sm font-bold text-nexus-text">34%</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Interface Cards */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-nexus-text font-semibold">
                  <Network size={18} className="text-nexus-secondary" />
                  Network Interfaces
                </div>
                <Badge variant="success" dot pulse>{mockInterfaces.filter((i) => i.status === 'up').length} Up</Badge>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {mockInterfaces.map((iface) => (
                <motion.div
                  key={iface.id}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-xl border border-nexus-border bg-white/5 p-3 transition-all hover:border-nexus-primary/30"
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iface.status === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      <iface.icon size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-nexus-text">{iface.name}</p>
                      <p className="text-[10px] text-nexus-muted">{iface.type}</p>
                    </div>
                    <div className="ml-auto">
                      <Badge variant={iface.status === 'up' ? 'success' : 'error'} dot pulse>{iface.status.toUpperCase()}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-nexus-muted">
                    <div className="flex justify-between"><span>IP</span><span className="text-nexus-text font-mono">{iface.ip}</span></div>
                    <div className="flex justify-between"><span>MAC</span><span className="text-nexus-text font-mono text-[10px]">{iface.mac}</span></div>
                    <div className="flex justify-between"><span>Speed</span><span className="text-nexus-text">{iface.speed}</span></div>
                  </div>

                  <div className="mt-3 flex gap-2 text-[10px]">
                    <div className="flex flex-1 items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-400">
                      <Upload size={10} /> {iface.bytesSent}
                    </div>
                    <div className="flex flex-1 items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-blue-400">
                      <Download size={10} /> {iface.bytesRecv}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ---- Active Connections ---- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <Globe size={18} className="text-nexus-accent" />
                Active Connections
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-nexus-muted" />
                  <input
                    type="text"
                    placeholder="Filter..."
                    value={connFilter}
                    onChange={(e) => setConnFilter(e.target.value)}
                    className="h-8 w-48 rounded-lg border border-nexus-border bg-white/5 pl-8 pr-3 text-xs text-nexus-text placeholder-nexus-muted outline-none focus:border-nexus-primary/50"
                  />
                </div>
                <Badge variant="info">{filteredConnections.length}</Badge>
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-nexus-card/95 backdrop-blur-sm">
                <tr className="border-b border-nexus-border text-[10px] uppercase tracking-wider text-nexus-muted">
                  <th className="pb-2 pr-3">Local</th>
                  <th className="pb-2 pr-3">Remote</th>
                  <th className="pb-2 pr-3">Proto</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">PID</th>
                  <th className="pb-2">Process</th>
                </tr>
              </thead>
              <tbody>
                {filteredConnections.map((conn) => (
                  <tr key={conn.id} className="border-b border-nexus-border/30 transition-colors hover:bg-white/5">
                    <td className="py-1.5 pr-3 font-mono text-nexus-text">{conn.localAddr}</td>
                    <td className="py-1.5 pr-3 font-mono text-nexus-muted">{conn.remoteAddr}</td>
                    <td className="py-1.5 pr-3"><Badge variant="neutral">{conn.protocol}</Badge></td>
                    <td className="py-1.5 pr-3"><Badge variant={connStatusColor(conn.status)}>{conn.status}</Badge></td>
                    <td className="py-1.5 pr-3 text-nexus-muted">{conn.pid || '-'}</td>
                    <td className="py-1.5 text-nexus-text">{conn.process}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* ---- Threats + Anomalies ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Threat Monitor */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-nexus-text font-semibold">
                  <AlertOctagon size={18} className="text-red-400" />
                  Threat Monitor
                </div>
                <Badge variant="error" dot pulse>{mockThreats.filter((t) => t.severity === 'critical').length} Critical</Badge>
              </div>
            }
          >
            <div className="space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
              {mockThreats.map((threat) => (
                <motion.div
                  key={threat.id}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-3 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      threat.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : threat.severity === 'warning'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {threat.severity === 'critical' ? <AlertOctagon size={16} /> : <AlertTriangle size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-nexus-text">{threat.type}</span>
                      <Badge variant={threatSeverityBadge(threat.severity)} dot>{threat.severity}</Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-nexus-muted">
                      <span>Source: <span className="font-mono text-nexus-text">{threat.sourceIp}</span></span>
                      <span>Port: {threat.targetPort}</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{threat.timestamp}</span>
                    </div>
                  </div>
                  <div>
                    {threat.blocked ? (
                      <Badge variant="success" dot>Blocked</Badge>
                    ) : (
                      <Badge variant="warning" dot>Active</Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Anomaly Detection */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <Zap size={18} className="text-amber-400" />
                Anomaly Detection
              </div>
            }
          >
            <div className="space-y-2">
              {mockAnomalies.map((anomaly) => (
                <motion.div
                  key={anomaly.id}
                  whileHover={{ x: 4 }}
                  className="rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-nexus-text">{anomaly.metric}</span>
                    <Badge variant={threatSeverityBadge(anomaly.severity)} dot>{anomaly.severity}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-nexus-muted">Current</p>
                      <p className="font-semibold text-nexus-text">{anomaly.currentValue}</p>
                    </div>
                    <div>
                      <p className="text-nexus-muted">Baseline</p>
                      <p className="font-semibold text-nexus-text">{anomaly.baselineValue}</p>
                    </div>
                    <div>
                      <p className="text-nexus-muted">Deviation</p>
                      <p className={`font-bold ${anomaly.deviationScore >= 4 ? 'text-red-400' : anomaly.deviationScore >= 3 ? 'text-amber-400' : 'text-blue-400'}`}>
                        {anomaly.deviationScore.toFixed(1)}x
                      </p>
                    </div>
                  </div>
                  {/* Deviation bar */}
                  <div className="mt-2 h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(anomaly.deviationScore * 15, 100)}%`,
                        backgroundColor: anomaly.deviationScore >= 4 ? '#ef4444' : anomaly.deviationScore >= 3 ? '#f59e0b' : '#3b82f6',
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ---- Traffic Analysis + Firewall Rules ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Traffic Analysis */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <BarChart3 size={18} className="text-nexus-secondary" />
                Traffic Analysis
              </div>
            }
          >
            {/* Stacked bar */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-nexus-muted">Protocol Distribution</p>
              <div className="flex h-6 overflow-hidden rounded-full">
                {trafficProtocols.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-center text-[9px] font-bold text-white transition-all"
                    style={{ width: `${p.pct}%`, backgroundColor: p.color }}
                    title={`${p.name}: ${p.pct}%`}
                  >
                    {p.pct >= 8 ? `${p.pct}%` : ''}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-nexus-muted">
                {trafficProtocols.map((p) => (
                  <span key={p.name} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name} {p.pct}%
                  </span>
                ))}
              </div>
            </div>

            {/* Top Talkers */}
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-nexus-muted">Top Talkers</p>
              <div className="space-y-1.5">
                {topTalkers.map((t, i) => (
                  <div key={t.ip} className="flex items-center gap-3 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-nexus-muted bg-white/10">
                      {i + 1}
                    </span>
                    <span className="font-mono text-nexus-text flex-1">{t.ip}</span>
                    <span className="font-semibold text-nexus-text">{t.bandwidth}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Firewall Rules */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-nexus-text font-semibold">
                  <Lock size={18} className="text-nexus-primary" />
                  Firewall Rules
                </div>
                <Badge variant="info">{mockFirewallRules.length} rules</Badge>
              </div>
            }
          >
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-nexus-card/95 backdrop-blur-sm">
                  <tr className="border-b border-nexus-border text-[9px] uppercase tracking-wider text-nexus-muted">
                    <th className="pb-2 pr-2">Action</th>
                    <th className="pb-2 pr-2">Dir</th>
                    <th className="pb-2 pr-2">Proto</th>
                    <th className="pb-2 pr-2">Source</th>
                    <th className="pb-2 pr-2">Dest</th>
                    <th className="pb-2 pr-2">Port</th>
                    <th className="pb-2 pr-2">Hits</th>
                    <th className="pb-2">On</th>
                  </tr>
                </thead>
                <tbody>
                  {mockFirewallRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-nexus-border/30 transition-colors hover:bg-white/5">
                      <td className="py-1.5 pr-2">
                        <Badge variant={fwActionColor(rule.action) as any}>{rule.action}</Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-nexus-muted">{rule.direction}</td>
                      <td className="py-1.5 pr-2 text-nexus-text">{rule.protocol}</td>
                      <td className="py-1.5 pr-2 font-mono text-nexus-muted text-[10px]">{rule.source}</td>
                      <td className="py-1.5 pr-2 font-mono text-nexus-muted text-[10px]">{rule.destination}</td>
                      <td className="py-1.5 pr-2 text-nexus-text">{rule.port}</td>
                      <td className="py-1.5 pr-2 text-nexus-muted">{rule.hitCount.toLocaleString()}</td>
                      <td className="py-1.5">
                        <span className={`inline-block h-3 w-3 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-red-500/50'}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ---- Connected Devices ---- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <Router size={18} className="text-nexus-accent" />
                Connected Devices
              </div>
              <Badge variant="info" dot>{mockDevices.length} devices</Badge>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mockDevices.map((dev) => (
              <motion.div
                key={dev.id}
                whileHover={{ scale: 1.02, y: -2 }}
                className={`rounded-xl border p-3 transition-all ${
                  dev.trusted
                    ? 'border-nexus-border hover:border-nexus-primary/30 bg-white/5'
                    : 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${dev.trusted ? 'bg-nexus-primary/20 text-nexus-primary' : 'bg-red-500/20 text-red-400'}`}>
                    <dev.icon size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-nexus-text truncate">{dev.hostname}</p>
                    <p className="text-[10px] text-nexus-muted">{dev.manufacturer} &middot; {dev.os}</p>
                  </div>
                  {dev.trusted ? (
                    <CheckCircle size={16} className="shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={16} className="shrink-0 text-red-400" />
                  )}
                </div>

                <div className="mt-2 space-y-0.5 text-[10px] text-nexus-muted">
                  <div className="flex justify-between"><span>IP</span><span className="font-mono text-nexus-text">{dev.ip}</span></div>
                  <div className="flex justify-between"><span>MAC</span><span className="font-mono text-nexus-text">{dev.mac}</span></div>
                  <div className="flex justify-between"><span>First seen</span><span className="text-nexus-text">{dev.firstSeen}</span></div>
                  <div className="flex justify-between"><span>Last seen</span><span className="text-nexus-text">{dev.lastSeen}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* ---- Quick Actions ---- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2 text-nexus-text font-semibold">
              <Zap size={18} className="text-nexus-accent" />
              Quick Actions
            </div>
          }
        >
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <motion.button
                key={action.label}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 rounded-xl border border-nexus-border bg-white/5 px-4 py-2.5 text-sm font-medium text-nexus-text transition-colors hover:border-nexus-primary/40 hover:bg-white/10"
              >
                <action.icon size={16} style={{ color: action.color }} />
                {action.label}
              </motion.button>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
