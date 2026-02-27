import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, Search, Layers, ZoomIn, ZoomOut, Maximize2,
  MapPin, Navigation, Building2, Thermometer, Cloud,
  Wind, Droplets, Eye, Wifi, Car, Train, Ship,
  Globe, AlertTriangle, CheckCircle, X, Settings,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useIsDemoAccount } from '@/hooks/useDemoData';

interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'device' | 'sensor' | 'alert' | 'poi' | 'vehicle';
  status: 'active' | 'warning' | 'offline' | 'moving';
  description: string;
  lastUpdate: string;
  metadata: Record<string, string>;
}

interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  icon: string;
  color: string;
  markerCount: number;
}

const sampleMarkers: MapMarker[] = [
  { id: '1', name: 'Home Hub', lat: 37.7749, lng: -122.4194, type: 'device', status: 'active', description: 'Primary home automation hub', lastUpdate: '10s ago', metadata: { firmware: 'v2.4.1', uptime: '45d 12h', signal: '-42 dBm' } },
  { id: '2', name: 'Weather Station', lat: 37.7760, lng: -122.4180, type: 'sensor', status: 'active', description: 'Outdoor weather monitoring', lastUpdate: '1m ago', metadata: { temp: '22°C', humidity: '65%', pressure: '1013 hPa' } },
  { id: '3', name: 'Garage Door', lat: 37.7745, lng: -122.4200, type: 'device', status: 'active', description: 'Smart garage door controller', lastUpdate: '30s ago', metadata: { state: 'Closed', battery: '92%', events: '142' } },
  { id: '4', name: 'Motion Sensor A', lat: 37.7755, lng: -122.4188, type: 'sensor', status: 'warning', description: 'Front yard motion detection', lastUpdate: '5s ago', metadata: { triggered: 'Yes', sensitivity: 'High', zone: 'Front' } },
  { id: '5', name: 'Alert: Perimeter', lat: 37.7752, lng: -122.4196, type: 'alert', status: 'warning', description: 'Perimeter breach detected', lastUpdate: '2m ago', metadata: { severity: 'Medium', camera: 'CAM-03', zone: 'East' } },
  { id: '6', name: 'EV Charger', lat: 37.7740, lng: -122.4205, type: 'poi', status: 'active', description: 'Tesla Wall Connector', lastUpdate: '1m ago', metadata: { power: '11.5 kW', charged: '78%', range: '245 mi' } },
  { id: '7', name: 'Drone Alpha', lat: 37.7770, lng: -122.4170, type: 'vehicle', status: 'moving', description: 'Surveillance drone patrol', lastUpdate: '2s ago', metadata: { altitude: '50m', speed: '12 km/h', battery: '67%' } },
  { id: '8', name: 'Air Quality', lat: 37.7748, lng: -122.4192, type: 'sensor', status: 'active', description: 'Indoor air quality monitor', lastUpdate: '30s ago', metadata: { aqi: '42', co2: '410 ppm', pm25: '12 µg/m³' } },
  { id: '9', name: 'Mailbox Sensor', lat: 37.7742, lng: -122.4198, type: 'sensor', status: 'offline', description: 'Smart mailbox notification', lastUpdate: '2h ago', metadata: { battery: '3%', lastMail: 'Yesterday', status: 'Low Battery' } },
  { id: '10', name: 'Vehicle Tracker', lat: 37.7800, lng: -122.4150, type: 'vehicle', status: 'active', description: 'Family car GPS tracker', lastUpdate: '30s ago', metadata: { speed: '0 km/h', fuel: '62%', odometer: '34,521 mi' } },
];

const defaultLayers: MapLayer[] = [
  { id: 'devices', name: 'Devices', visible: true, icon: 'wifi', color: '#6366F1', markerCount: 2 },
  { id: 'sensors', name: 'Sensors', visible: true, icon: 'thermometer', color: '#10B981', markerCount: 4 },
  { id: 'alerts', name: 'Alerts', visible: true, icon: 'alert', color: '#EF4444', markerCount: 1 },
  { id: 'poi', name: 'Points of Interest', visible: true, icon: 'pin', color: '#F59E0B', markerCount: 1 },
  { id: 'vehicles', name: 'Vehicles', visible: true, icon: 'car', color: '#3B82F6', markerCount: 2 },
];

const typeIcons: Record<string, React.ReactNode> = {
  device: <Wifi size={14} />,
  sensor: <Thermometer size={14} />,
  alert: <AlertTriangle size={14} />,
  poi: <MapPin size={14} />,
  vehicle: <Car size={14} />,
};

const statusColors = {
  active: { color: 'text-green-400', bg: 'bg-green-500/10', dot: '#10B981' },
  warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', dot: '#F59E0B' },
  offline: { color: 'text-nexus-muted', bg: 'bg-gray-500/10', dot: '#6B7280' },
  moving: { color: 'text-blue-400', bg: 'bg-blue-500/10', dot: '#3B82F6' },
};

const typeDistribution = [
  { name: 'Devices', value: 2, color: '#6366F1' },
  { name: 'Sensors', value: 4, color: '#10B981' },
  { name: 'Alerts', value: 1, color: '#EF4444' },
  { name: 'POIs', value: 1, color: '#F59E0B' },
  { name: 'Vehicles', value: 2, color: '#3B82F6' },
];

export default function MapView() {
  const isDemo = useIsDemoAccount();
  const [markers] = useState(isDemo ? sampleMarkers : []);
  const [layers, setLayers] = useState(defaultLayers);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(15);
  const [showLayers, setShowLayers] = useState(true);

  const visibleTypes = useMemo(() => new Set(layers.filter(l => l.visible).map(l => {
    if (l.id === 'poi') return 'poi';
    return l.id.replace(/s$/, '');
  })), [layers]);

  const filteredMarkers = useMemo(() => {
    let m = markers.filter(mk => visibleTypes.has(mk.type));
    if (searchQuery) m = m.filter(mk => mk.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return m;
  }, [markers, visibleTypes, searchQuery]);

  const toggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Map className="text-nexus-primary" /> Map View</h1>
          <p className="text-sm text-nexus-muted mt-1">{filteredMarkers.length} markers · Zoom {zoom}x</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setZoom(z => Math.min(z + 1, 20))} className="p-2 rounded-lg bg-nexus-surface text-nexus-muted hover:text-nexus-text"><ZoomIn size={16} /></button>
          <button onClick={() => setZoom(z => Math.max(z - 1, 1))} className="p-2 rounded-lg bg-nexus-surface text-nexus-muted hover:text-nexus-text"><ZoomOut size={16} /></button>
          <button onClick={() => setShowLayers(!showLayers)} className={`p-2 rounded-lg ${showLayers ? 'bg-nexus-primary/10 text-nexus-primary' : 'bg-nexus-surface text-nexus-muted'}`}><Layers size={16} /></button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-80 shrink-0 space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search markers..." className="w-full pl-9 pr-3 py-2 bg-nexus-surface border border-nexus-border/20 rounded-xl text-sm text-nexus-text" />
          </div>

          {/* Layers Panel */}
          <AnimatePresence>
            {showLayers && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-4 overflow-hidden">
                <h3 className="text-sm font-semibold text-nexus-text mb-3 flex items-center gap-2"><Layers size={14} /> Layers</h3>
                <div className="space-y-2">
                  {layers.map(l => (
                    <button key={l.id} onClick={() => toggleLayer(l.id)} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${l.visible ? 'bg-nexus-surface/80' : 'opacity-50'}`}>
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: l.visible ? l.color : '#4B5563' }} />
                      <span className="text-xs text-nexus-text flex-1 text-left">{l.name}</span>
                      <span className="text-[10px] text-nexus-muted">{l.markerCount}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Distribution */}
          <div className="glass rounded-2xl border border-nexus-border/30 p-4">
            <h3 className="text-sm font-semibold text-nexus-text mb-3">Distribution</h3>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={typeDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3} dataKey="value">
                  {typeDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Marker List */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filteredMarkers.map((m, i) => {
              const sc = statusColors[m.status];
              return (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedMarker(selectedMarker?.id === m.id ? null : m)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selectedMarker?.id === m.id ? 'bg-nexus-surface border border-nexus-primary/30' : 'hover:bg-nexus-surface/50'}`}
                >
                  <div className={`p-1.5 rounded-lg ${sc.bg} ${sc.color}`}>{typeIcons[m.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-nexus-text truncate">{m.name}</p>
                    <p className="text-[10px] text-nexus-muted">{m.lastUpdate}</p>
                  </div>
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: sc.dot }} />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 glass rounded-2xl border border-nexus-border/30 overflow-hidden relative" style={{ minHeight: 600 }}>
          {/* Simulated map grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)
            `,
            backgroundSize: `${zoom * 3}px ${zoom * 3}px`,
          }} />

          {/* Map markers rendered as positioned dots */}
          {filteredMarkers.map((m, i) => {
            const x = 10 + ((m.lng + 122.425) * 4000) % 80;
            const y = 10 + ((37.785 - m.lat) * 4000) % 80;
            const sc = statusColors[m.status];
            return (
              <motion.div
                key={m.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedMarker(m)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute cursor-pointer group"
              >
                <div className={`p-2 rounded-full ${sc.bg} ${sc.color} border border-current/20 shadow-lg backdrop-blur-sm`}>
                  {typeIcons[m.type]}
                </div>
                {m.status === 'moving' && (
                  <motion.div animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-full bg-blue-400/30" />
                )}
                {m.status === 'warning' && (
                  <motion.div animate={{ scale: [1, 1.3], opacity: [0.5, 0] }} transition={{ duration: 1, repeat: Infinity }} className="absolute inset-0 rounded-full bg-yellow-400/30" />
                )}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-nexus-bg/95 text-[10px] text-nexus-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-nexus-border/30 shadow-xl">
                  {m.name}
                </div>
              </motion.div>
            );
          })}

          {/* Selected marker detail overlay */}
          <AnimatePresence>
            {selectedMarker && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-4 left-4 right-4 glass rounded-2xl border border-nexus-border/30 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${statusColors[selectedMarker.status].bg} ${statusColors[selectedMarker.status].color}`}>
                      {typeIcons[selectedMarker.type]}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-nexus-text">{selectedMarker.name}</h3>
                      <p className="text-xs text-nexus-muted">{selectedMarker.description}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedMarker(null)} className="p-1 rounded-lg hover:bg-nexus-surface"><X size={14} className="text-nexus-muted" /></button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-nexus-surface/50 rounded-lg p-2">
                    <p className="text-[10px] text-nexus-muted">Status</p>
                    <p className={`text-xs font-medium ${statusColors[selectedMarker.status].color}`}>{selectedMarker.status}</p>
                  </div>
                  <div className="bg-nexus-surface/50 rounded-lg p-2">
                    <p className="text-[10px] text-nexus-muted">Coordinates</p>
                    <p className="text-xs font-mono text-nexus-text">{selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}</p>
                  </div>
                  <div className="bg-nexus-surface/50 rounded-lg p-2">
                    <p className="text-[10px] text-nexus-muted">Last Update</p>
                    <p className="text-xs text-nexus-text">{selectedMarker.lastUpdate}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedMarker.metadata).map(([k, v]) => (
                    <div key={k} className="px-2 py-1 bg-nexus-surface/50 rounded-md text-[10px]">
                      <span className="text-nexus-muted">{k}: </span>
                      <span className="text-nexus-text font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compass */}
          <div className="absolute top-4 right-4 p-2 rounded-xl bg-nexus-bg/80 border border-nexus-border/20">
            <Navigation size={20} className="text-nexus-primary" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
