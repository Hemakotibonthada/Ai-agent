/* ===================================================================
   Nexus AI OS — Vision & Security Cameras Page
   Camera grid, live feed, detection timeline, alerts, zone map, stats
   =================================================================== */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Video,
  Eye,
  Shield,
  AlertTriangle,
  Clock,
  Activity,
  Wifi,
  Moon,
  HardDrive,
  Play,
  Settings,
  MapPin,
  User,
  Car,
  Package,
  Dog,
  Bird,
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
interface CameraFeed {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'recording';
  resolution: string;
  fps: number;
  lastMotion: string;
  gradient: string;
}

interface Detection {
  id: string;
  timestamp: string;
  objectType: string;
  icon: React.ElementType;
  confidence: number;
  cameraName: string;
  color: string;
}

interface VisionAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  cameraSource: string;
  description: string;
}

interface Zone {
  id: string;
  name: string;
  status: 'normal' | 'motion' | 'alert';
  row: number;
  col: number;
  colSpan?: number;
  rowSpan?: number;
}

interface Recording {
  id: string;
  cameraName: string;
  startTime: string;
  duration: string;
  size: string;
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const mockCameras: CameraFeed[] = [
  {
    id: 'cam-1',
    name: 'Front Door',
    location: 'Main Entrance',
    status: 'recording',
    resolution: '1920x1080',
    fps: 30,
    lastMotion: '2 min ago',
    gradient: 'from-blue-600/30 via-indigo-500/20 to-purple-600/30',
  },
  {
    id: 'cam-2',
    name: 'Backyard',
    location: 'Garden Area',
    status: 'online',
    resolution: '2560x1440',
    fps: 24,
    lastMotion: '15 min ago',
    gradient: 'from-emerald-600/30 via-teal-500/20 to-cyan-600/30',
  },
  {
    id: 'cam-3',
    name: 'Garage',
    location: 'Side Entry',
    status: 'online',
    resolution: '1920x1080',
    fps: 24,
    lastMotion: '1 hr ago',
    gradient: 'from-amber-600/30 via-orange-500/20 to-red-600/30',
  },
  {
    id: 'cam-4',
    name: 'Driveway',
    location: 'Street View',
    status: 'offline',
    resolution: '1280x720',
    fps: 0,
    lastMotion: '3 hrs ago',
    gradient: 'from-gray-600/30 via-slate-500/20 to-zinc-600/30',
  },
];

const mockDetections: Detection[] = [
  { id: 'd-1', timestamp: '10:42 AM', objectType: 'Person', icon: User,    confidence: 94, cameraName: 'Front Door', color: '#3b82f6' },
  { id: 'd-2', timestamp: '10:38 AM', objectType: 'Vehicle', icon: Car,    confidence: 87, cameraName: 'Driveway',   color: '#f59e0b' },
  { id: 'd-3', timestamp: '10:31 AM', objectType: 'Package', icon: Package,confidence: 91, cameraName: 'Front Door', color: '#10b981' },
  { id: 'd-4', timestamp: '10:22 AM', objectType: 'Dog',     icon: Dog,    confidence: 78, cameraName: 'Backyard',   color: '#8b5cf6' },
  { id: 'd-5', timestamp: '10:15 AM', objectType: 'Person',  icon: User,   confidence: 96, cameraName: 'Front Door', color: '#3b82f6' },
  { id: 'd-6', timestamp: '10:08 AM', objectType: 'Bird',    icon: Bird,   confidence: 62, cameraName: 'Backyard',   color: '#ec4899' },
  { id: 'd-7', timestamp: '09:55 AM', objectType: 'Vehicle', icon: Car,    confidence: 89, cameraName: 'Driveway',   color: '#f59e0b' },
  { id: 'd-8', timestamp: '09:41 AM', objectType: 'Person',  icon: User,   confidence: 92, cameraName: 'Garage',     color: '#3b82f6' },
];

const mockAlerts: VisionAlert[] = [
  { id: 'a-1', type: 'Person Detected',    severity: 'info',     timestamp: '10:42 AM', cameraSource: 'Front Door', description: 'Known person identified at front entrance.' },
  { id: 'a-2', type: 'Unknown Person',      severity: 'warning',  timestamp: '10:15 AM', cameraSource: 'Front Door', description: 'Unrecognized face detected — review recommended.' },
  { id: 'a-3', type: 'Motion Detected',     severity: 'info',     timestamp: '10:08 AM', cameraSource: 'Backyard',   description: 'Movement in garden area. Likely animal.' },
  { id: 'a-4', type: 'Package Delivered',    severity: 'info',     timestamp: '10:31 AM', cameraSource: 'Front Door', description: 'Package placed at front door.' },
  { id: 'a-5', type: 'Motion — Restricted', severity: 'critical', timestamp: '09:55 AM', cameraSource: 'Garage',     description: 'Unexpected motion in restricted zone after hours.' },
  { id: 'a-6', type: 'Camera Offline',       severity: 'warning',  timestamp: '08:20 AM', cameraSource: 'Driveway',   description: 'Driveway camera lost connection.' },
];

const mockZones: Zone[] = [
  { id: 'z-1', name: 'Front Door',   status: 'motion', row: 0, col: 0, colSpan: 1, rowSpan: 1 },
  { id: 'z-2', name: 'Living Room',  status: 'normal', row: 0, col: 1, colSpan: 2, rowSpan: 1 },
  { id: 'z-3', name: 'Garage',       status: 'alert',  row: 1, col: 0, colSpan: 1, rowSpan: 1 },
  { id: 'z-4', name: 'Backyard',     status: 'motion', row: 1, col: 1, colSpan: 1, rowSpan: 1 },
  { id: 'z-5', name: 'Driveway',     status: 'normal', row: 1, col: 2, colSpan: 1, rowSpan: 1 },
];

const mockRecordings: Recording[] = [
  { id: 'r-1', cameraName: 'Front Door', startTime: '09:00 AM', duration: '1h 42m', size: '820 MB' },
  { id: 'r-2', cameraName: 'Backyard',   startTime: '08:30 AM', duration: '2h 10m', size: '640 MB' },
  { id: 'r-3', cameraName: 'Garage',     startTime: '07:45 AM', duration: '3h 00m', size: '540 MB' },
  { id: 'r-4', cameraName: 'Front Door', startTime: '06:00 AM', duration: '1h 00m', size: '210 MB' },
  { id: 'r-5', cameraName: 'Driveway',   startTime: '05:20 AM', duration: '0h 40m', size: '130 MB' },
  { id: 'r-6', cameraName: 'Backyard',   startTime: '04:00 AM', duration: '1h 20m', size: '310 MB' },
  { id: 'r-7', cameraName: 'Front Door', startTime: '02:15 AM', duration: '0h 25m', size: '80 MB'  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const statusBadge = (status: CameraFeed['status']) => {
  const map: Record<CameraFeed['status'], { variant: 'success' | 'warning' | 'error'; label: string }> = {
    online:    { variant: 'success', label: 'Online' },
    recording: { variant: 'warning', label: 'Recording' },
    offline:   { variant: 'error',   label: 'Offline' },
  };
  const s = map[status];
  return <Badge variant={s.variant} dot pulse>{s.label}</Badge>;
};

const severityBadge = (severity: VisionAlert['severity']) => {
  const map: Record<VisionAlert['severity'], { variant: 'success' | 'warning' | 'error' | 'info'; label: string }> = {
    info:     { variant: 'info',    label: 'Info' },
    warning:  { variant: 'warning', label: 'Warning' },
    critical: { variant: 'error',   label: 'Critical' },
  };
  const s = map[severity];
  return <Badge variant={s.variant} dot pulse>{s.label}</Badge>;
};

const zoneColor = (status: Zone['status']) => {
  switch (status) {
    case 'normal': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    case 'motion': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
    case 'alert':  return 'bg-red-500/20 border-red-500/40 text-red-400';
  }
};

/* ------------------------------------------------------------------ */
/*  Bounding-box overlays for mock live-feed detections                */
/* ------------------------------------------------------------------ */
const boundingBoxes = [
  { label: 'Person 94%', top: '22%', left: '18%', w: '20%', h: '52%', color: '#3b82f6' },
  { label: 'Vehicle 87%', top: '55%', left: '58%', w: '30%', h: '30%', color: '#f59e0b' },
  { label: 'Dog 78%', top: '60%', left: '8%', w: '14%', h: '18%', color: '#8b5cf6' },
];

/* ------------------------------------------------------------------ */
/*  Stats data                                                         */
/* ------------------------------------------------------------------ */
const stats = [
  { label: 'Total Cameras',     value: '4',      icon: Camera,      color: '#3b82f6' },
  { label: 'Active Detections', value: '12',     icon: Eye,         color: '#10b981' },
  { label: 'Alerts Today',      value: '3',      icon: AlertTriangle, color: '#f59e0b' },
  { label: 'Recordings',        value: '7',      icon: Video,       color: '#8b5cf6' },
  { label: 'Avg FPS',           value: '24.5',   icon: Activity,    color: '#06b6d4' },
  { label: 'Storage Used',      value: '2.4 GB', icon: HardDrive,   color: '#ec4899' },
];

/* ------------------------------------------------------------------ */
/*  Quick Actions                                                      */
/* ------------------------------------------------------------------ */
const quickActions = [
  { label: 'Capture All',      icon: Camera,   color: '#3b82f6' },
  { label: 'Start Recording',  icon: Play,     color: '#10b981' },
  { label: 'Night Mode',       icon: Moon,     color: '#8b5cf6' },
  { label: 'View Recordings',  icon: Video,    color: '#f59e0b' },
  { label: 'Configure Zones',  icon: Settings, color: '#06b6d4' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Vision() {
  const isDemo = useIsDemoAccount();
  if (!isDemo) return <div className="flex-1 p-6"><EmptyState title="No vision data" description="Connect cameras and configure video analytics to see detections." /></div>;
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [nightMode, setNightMode] = useState(false);

  const activeCam = useMemo(
    () => mockCameras.find((c) => c.id === selectedCamera) ?? null,
    [selectedCamera],
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
          <Camera size={22} className="text-nexus-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">Vision &amp; Security</h1>
          <p className="text-sm text-nexus-muted">Camera monitoring &amp; AI detection dashboard</p>
        </div>
      </motion.div>

      {/* ---- Stats Bar ---- */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} hoverable>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${s.color}20`, color: s.color }}
              >
                <s.icon size={18} />
              </span>
              <div>
                <p className="text-xs text-nexus-muted">{s.label}</p>
                <p className="text-lg font-bold text-nexus-text">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* ---- Camera Grid + Live Feed ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Camera Grid */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-nexus-text font-semibold">
                  <Camera size={18} className="text-nexus-primary" />
                  Camera Feeds
                </div>
                <Badge variant="info" dot>{mockCameras.filter((c) => c.status !== 'offline').length} Active</Badge>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              {mockCameras.map((cam) => {
                const isSelected = selectedCamera === cam.id;
                return (
                  <motion.div
                    key={cam.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedCamera(isSelected ? null : cam.id)}
                    className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all ${
                      isSelected
                        ? 'border-nexus-primary shadow-nexus'
                        : 'border-nexus-border hover:border-nexus-primary/40'
                    }`}
                  >
                    {/* Gradient placeholder */}
                    <div
                      className={`flex h-32 flex-col items-center justify-center bg-gradient-to-br ${cam.gradient}`}
                    >
                      <Camera size={28} className="mb-1 text-white/60" />
                      <span className="text-sm font-medium text-white/80">{cam.name}</span>
                      <span className="mt-0.5 text-[10px] text-white/50">{cam.resolution}</span>
                    </div>

                    {/* Info strip */}
                    <div className="bg-nexus-card/90 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-nexus-text truncate">{cam.location}</span>
                        {statusBadge(cam.status)}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-nexus-muted">
                        <span className="flex items-center gap-1">
                          <Activity size={10} /> {cam.fps} FPS
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {cam.lastMotion}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Live Feed Panel */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-nexus-text font-semibold">
                  <Eye size={18} className="text-nexus-accent" />
                  {activeCam ? `Live — ${activeCam.name}` : 'Live Feed'}
                </div>
                {activeCam && statusBadge(activeCam.status)}
              </div>
            }
          >
            {activeCam ? (
              <div className="relative overflow-hidden rounded-xl">
                {/* Large gradient placeholder */}
                <div
                  className={`flex h-64 items-center justify-center bg-gradient-to-br ${activeCam.gradient}`}
                >
                  <Camera size={48} className="text-white/40" />
                </div>

                {/* Bounding boxes */}
                {boundingBoxes.map((bb, i) => (
                  <div
                    key={i}
                    className="absolute flex items-start justify-start"
                    style={{
                      top: bb.top,
                      left: bb.left,
                      width: bb.w,
                      height: bb.h,
                      border: `2px solid ${bb.color}`,
                      borderRadius: 6,
                    }}
                  >
                    <span
                      className="rounded-br-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: bb.color }}
                    >
                      {bb.label}
                    </span>
                  </div>
                ))}

                {/* Overlay info */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/50 px-3 py-2 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs text-white/80">
                    <Wifi size={12} className="text-emerald-400" />
                    <span>{activeCam.resolution}</span>
                    <span>•</span>
                    <span>{activeCam.fps} FPS</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/60">
                    <Clock size={12} />
                    <span>Live</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-nexus-border text-nexus-muted">
                <Camera size={36} />
                <span className="text-sm">Select a camera to view live feed</span>
              </div>
            )}

            {/* Detection details when camera selected */}
            {activeCam && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-nexus-muted">
                  Recent Detections
                </p>
                {mockDetections
                  .filter((d) => d.cameraName === activeCam.name)
                  .slice(0, 3)
                  .map((det) => (
                    <div
                      key={det.id}
                      className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${det.color}25`, color: det.color }}
                      >
                        <det.icon size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nexus-text">{det.objectType}</p>
                        <p className="text-[10px] text-nexus-muted">{det.timestamp}</p>
                      </div>
                      <Badge variant="info">{det.confidence}%</Badge>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ---- Detection Timeline ---- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2 text-nexus-text font-semibold">
              <Activity size={18} className="text-nexus-secondary" />
              Detection Timeline
            </div>
          }
        >
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {mockDetections.map((det) => (
              <motion.div
                key={det.id}
                whileHover={{ y: -4, scale: 1.03 }}
                className="flex min-w-[160px] shrink-0 flex-col items-center gap-2 rounded-xl border border-nexus-border bg-white/5 p-3 transition-colors hover:border-nexus-primary/30"
              >
                {/* Thumbnail placeholder */}
                <div
                  className="flex h-16 w-full items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${det.color}15` }}
                >
                  <det.icon size={24} style={{ color: det.color }} />
                </div>

                <span className="text-sm font-semibold text-nexus-text">{det.objectType}</span>
                <Badge variant="info">{det.confidence}%</Badge>
                <div className="flex items-center gap-1 text-[10px] text-nexus-muted">
                  <Camera size={10} /> {det.cameraName}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-nexus-muted">
                  <Clock size={10} /> {det.timestamp}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* ---- Alerts + Zone Map ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Alert Panel */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-nexus-text font-semibold">
                  <AlertTriangle size={18} className="text-amber-400" />
                  Vision Alerts
                </div>
                <Badge variant="warning" dot>{mockAlerts.length}</Badge>
              </div>
            }
          >
            <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-thin pr-1">
              {mockAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  whileHover={{ x: 4 }}
                  className="flex items-start gap-3 rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      alert.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : alert.severity === 'warning'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {alert.severity === 'critical' ? (
                      <Shield size={16} />
                    ) : alert.severity === 'warning' ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-nexus-text">{alert.type}</span>
                      {severityBadge(alert.severity)}
                    </div>
                    <p className="mt-0.5 text-xs text-nexus-muted leading-relaxed">{alert.description}</p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-nexus-muted">
                      <span className="flex items-center gap-1"><Camera size={10} /> {alert.cameraSource}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {alert.timestamp}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Zone Map */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <MapPin size={18} className="text-nexus-primary" />
                Monitoring Zones
              </div>
            }
          >
            {/* Floor plan grid */}
            <div className="grid grid-cols-3 grid-rows-2 gap-2">
              {mockZones.map((zone) => (
                <motion.div
                  key={zone.id}
                  whileHover={{ scale: 1.04 }}
                  className={`relative flex h-28 flex-col items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${zoneColor(
                    zone.status,
                  )}`}
                  style={{
                    gridColumn: zone.colSpan && zone.colSpan > 1 ? `span ${zone.colSpan}` : undefined,
                    gridRow: zone.rowSpan && zone.rowSpan > 1 ? `span ${zone.rowSpan}` : undefined,
                  }}
                >
                  <MapPin size={20} className="mb-1" />
                  <span className="text-sm font-semibold">{zone.name}</span>
                  <span className="mt-0.5 text-[10px] capitalize opacity-70">{zone.status}</span>

                  {/* Animated pulse for alert/motion zones */}
                  {zone.status !== 'normal' && (
                    <span
                      className={`absolute inset-0 animate-pulse rounded-xl ${
                        zone.status === 'alert' ? 'bg-red-500/5' : 'bg-amber-500/5'
                      }`}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4 text-xs text-nexus-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Normal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Motion
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Alert
              </span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ---- Quick Actions ---- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2 text-nexus-text font-semibold">
              <Settings size={18} className="text-nexus-accent" />
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
                onClick={() => {
                  if (action.label === 'Night Mode') setNightMode((prev) => !prev);
                }}
                className="flex items-center gap-2 rounded-xl border border-nexus-border bg-white/5 px-4 py-2.5 text-sm font-medium text-nexus-text transition-colors hover:border-nexus-primary/40 hover:bg-white/10"
              >
                <action.icon size={16} style={{ color: action.color }} />
                {action.label === 'Night Mode'
                  ? nightMode
                    ? 'Day Mode'
                    : 'Night Mode'
                  : action.label}
              </motion.button>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* ---- Recordings ---- */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-nexus-text font-semibold">
                <Video size={18} className="text-nexus-secondary" />
                Recent Recordings
              </div>
              <Badge variant="info">{mockRecordings.length} files</Badge>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-nexus-border text-xs uppercase tracking-wider text-nexus-muted">
                  <th className="pb-2 pr-4">Camera</th>
                  <th className="pb-2 pr-4">Start</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2 pr-4">Size</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {mockRecordings.map((rec) => (
                  <tr
                    key={rec.id}
                    className="border-b border-nexus-border/40 transition-colors hover:bg-white/5"
                  >
                    <td className="py-2 pr-4 font-medium text-nexus-text">{rec.cameraName}</td>
                    <td className="py-2 pr-4 text-nexus-muted">{rec.startTime}</td>
                    <td className="py-2 pr-4 text-nexus-muted">{rec.duration}</td>
                    <td className="py-2 pr-4 text-nexus-muted">{rec.size}</td>
                    <td className="py-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-nexus-primary/20 text-nexus-primary transition-colors hover:bg-nexus-primary/30"
                      >
                        <Play size={14} />
                      </motion.button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
