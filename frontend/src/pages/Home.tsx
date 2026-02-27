/* ===================================================================
   Nexus AI OS — Home Automation Page
   Room grid, device controls, sensors, energy chart, scenes
   =================================================================== */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home as HomeIcon,
  Lightbulb,
  LightbulbOff,
  Thermometer,
  Droplets,
  Wind,
  Flame,
  Zap,
  Power,
  Sun,
  Moon,
  Tv,
  Fan,
  Lock,
  Unlock,
  Camera,
  Speaker,
  Blinds,
  Wifi,
  WifiOff,
  Plus,
  ChevronRight,
  Settings,
  Film,
  Coffee,
  Shield,
  BedDouble,
  Gauge,
  Activity,
  TrendingDown,
  DollarSign,
  Waves,
  Eye,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Switch from '@/components/ui/Switch';
import Slider from '@/components/ui/Slider';
import Progress from '@/components/ui/Progress';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import StatusIndicator from '@/components/shared/StatusIndicator';
import useStore from '@/lib/store';
import { homeApi } from '@/lib/api';
import type { Device, Room, Sensor, Scene } from '@/types';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const mockRooms: Room[] = [
  { id: 'r1', name: 'Living Room', icon: 'sofa', device_count: 6, temperature: 24.5, humidity: 48, devices: [] },
  { id: 'r2', name: 'Bedroom', icon: 'bed', device_count: 4, temperature: 23.0, humidity: 52, devices: [] },
  { id: 'r3', name: 'Kitchen', icon: 'utensils', device_count: 5, temperature: 25.2, humidity: 55, devices: [] },
  { id: 'r4', name: 'Office', icon: 'monitor', device_count: 3, temperature: 23.8, humidity: 45, devices: [] },
  { id: 'r5', name: 'Bathroom', icon: 'bath', device_count: 2, temperature: 26.0, humidity: 65, devices: [] },
  { id: 'r6', name: 'Garage', icon: 'car', device_count: 2, temperature: 20.1, humidity: 40, devices: [] },
];

const mockDevices: Device[] = [
  { id: 'd1', name: 'Main Light', type: 'light', room_id: 'r1', status: 'online', state: { brightness: 80 }, is_on: true, last_seen: '2026-02-26T10:00:00Z' },
  { id: 'd2', name: 'Smart AC', type: 'thermostat', room_id: 'r1', status: 'online', state: { temperature: 24, mode: 'cool' }, is_on: true, last_seen: '2026-02-26T10:00:00Z' },
  { id: 'd3', name: 'Ceiling Fan', type: 'switch', room_id: 'r1', status: 'online', state: { speed: 3 }, is_on: true, last_seen: '2026-02-26T10:00:00Z' },
  { id: 'd4', name: 'TV', type: 'switch', room_id: 'r1', status: 'online', state: {}, is_on: false, last_seen: '2026-02-26T10:00:00Z' },
  { id: 'd5', name: 'Bedroom Light', type: 'light', room_id: 'r2', status: 'online', state: { brightness: 40 }, is_on: false, last_seen: '2026-02-26T09:00:00Z' },
  { id: 'd6', name: 'Door Lock', type: 'lock', room_id: 'r1', status: 'online', state: { locked: true }, is_on: true, last_seen: '2026-02-26T10:00:00Z' },
  { id: 'd7', name: 'Security Camera', type: 'camera', room_id: 'r6', status: 'online', state: { recording: true }, is_on: true, last_seen: '2026-02-26T10:00:00Z' },
  { id: 'd8', name: 'Office Light', type: 'light', room_id: 'r4', status: 'online', state: { brightness: 100 }, is_on: true, last_seen: '2026-02-26T10:00:00Z' },
];

const mockSensors: Sensor[] = [
  { id: 's1', name: 'Temperature', type: 'temperature', room_id: 'r1', value: 24.5, unit: '°C', last_updated: '2026-02-26T10:00:00Z', min_value: 16, max_value: 40, history: [] },
  { id: 's2', name: 'Humidity', type: 'humidity', room_id: 'r1', value: 48, unit: '%', last_updated: '2026-02-26T10:00:00Z', min_value: 0, max_value: 100, history: [] },
  { id: 's3', name: 'Air Quality', type: 'aqi', room_id: 'r1', value: 42, unit: 'AQI', last_updated: '2026-02-26T10:00:00Z', min_value: 0, max_value: 500, history: [] },
  { id: 's4', name: 'Gas Level', type: 'gas', room_id: 'r3', value: 120, unit: 'ppm', last_updated: '2026-02-26T10:00:00Z', min_value: 0, max_value: 1000, history: [] },
];

const energyHistory = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  watts: 200 + Math.random() * 800,
  cost: (200 + Math.random() * 800) * 0.0001,
}));

const mockScenes: Scene[] = [
  { id: 'sc1', name: 'Movie Night', icon: 'film', actions: [], is_active: false },
  { id: 'sc2', name: 'Good Morning', icon: 'sunrise', actions: [], is_active: false },
  { id: 'sc3', name: 'Away Mode', icon: 'shield', actions: [], is_active: true },
  { id: 'sc4', name: 'Sleep', icon: 'moon', actions: [], is_active: false },
];

/* ------------------------------------------------------------------ */
/*  Device Icon Resolver                                               */
/* ------------------------------------------------------------------ */
function getDeviceIcon(type: string, isOn: boolean) {
  switch (type) {
    case 'light': return isOn ? <Lightbulb size={18} className="text-amber-400" /> : <LightbulbOff size={18} className="text-nexus-muted" />;
    case 'thermostat': return <Thermometer size={18} className={isOn ? 'text-cyan-400' : 'text-nexus-muted'} />;
    case 'switch': return <Power size={18} className={isOn ? 'text-emerald-400' : 'text-nexus-muted'} />;
    case 'lock': return isOn ? <Lock size={18} className="text-emerald-400" /> : <Unlock size={18} className="text-red-400" />;
    case 'camera': return <Camera size={18} className={isOn ? 'text-blue-400' : 'text-nexus-muted'} />;
    case 'speaker': return <Speaker size={18} className={isOn ? 'text-violet-400' : 'text-nexus-muted'} />;
    case 'blind': return <Blinds size={18} className={isOn ? 'text-amber-400' : 'text-nexus-muted'} />;
    default: return <Power size={18} className="text-nexus-muted" />;
  }
}

function getSceneIcon(icon: string) {
  switch (icon) {
    case 'film': return <Film size={22} />;
    case 'sunrise': return <Coffee size={22} />;
    case 'shield': return <Shield size={22} />;
    case 'moon': return <Moon size={22} />;
    default: return <Zap size={22} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Water Tank Visualization                                           */
/* ------------------------------------------------------------------ */
function WaterTank({ level }: { level: number }) {
  return (
    <div className="relative w-20 h-32 rounded-xl border-2 border-nexus-border bg-nexus-bg/60 overflow-hidden mx-auto">
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500/60 to-cyan-400/40 rounded-b-lg"
        initial={{ height: 0 }}
        animate={{ height: `${level}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        {/* Wave effect */}
        <div className="absolute top-0 left-0 right-0 h-2 overflow-hidden opacity-60">
          <motion.div
            className="h-4 w-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-50%', '0%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-nexus-text drop-shadow-lg">{level}%</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sensor Gauge                                                       */
/* ------------------------------------------------------------------ */
function SensorGauge({
  label,
  value,
  unit,
  icon: Icon,
  color,
  max = 100,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ElementType;
  color: string;
  max?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <CircularProgress value={(value / max) * 100} size={72} strokeWidth={5} />
      <div className="text-center">
        <div className="flex items-center gap-1 justify-center">
          <Icon size={13} style={{ color }} />
          <span className="text-sm font-bold text-nexus-text">{value}{unit}</span>
        </div>
        <span className="text-[10px] text-nexus-muted">{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Device Control Card                                                */
/* ------------------------------------------------------------------ */
function DeviceCard({
  device,
  onToggle,
}: {
  device: Device;
  onToggle: (id: string, on: boolean) => void;
}) {
  const [brightness, setBrightness] = useState(
    (device.state?.brightness as number) ?? 100,
  );
  const [temp, setTemp] = useState(
    (device.state?.temperature as number) ?? 24,
  );
  const [speed, setSpeed] = useState(
    (device.state?.speed as number) ?? 3,
  );

  return (
    <motion.div
      variants={item}
      className={`rounded-xl border p-3 transition-all duration-300 ${
        device.is_on
          ? 'border-nexus-primary/30 bg-nexus-primary/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
          : 'border-nexus-border bg-nexus-card/40'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getDeviceIcon(device.type, device.is_on)}
          <div>
            <p className="text-sm font-medium text-nexus-text">{device.name}</p>
            <StatusIndicator
              status={device.status === 'online' ? 'active' : 'error'}
              label={device.status}
              size="sm"
            />
          </div>
        </div>
        <Switch
          checked={device.is_on}
          onCheckedChange={(on) => onToggle(device.id, on)}
        />
      </div>

      {/* Brightness slider for lights */}
      {device.type === 'light' && device.is_on && (
        <Slider
          value={[brightness]}
          onValueChange={([v]) => setBrightness(v)}
          min={0}
          max={100}
          label="Brightness"
          showValue
          className="mt-2"
        />
      )}

      {/* Temp control for thermostat */}
      {device.type === 'thermostat' && device.is_on && (
        <Slider
          value={[temp]}
          onValueChange={([v]) => setTemp(v)}
          min={16}
          max={32}
          label="Temperature"
          showValue
          className="mt-2"
        />
      )}

      {/* Speed for fans/switches with speed */}
      {device.state?.speed !== undefined && device.is_on && (
        <Slider
          value={[speed]}
          onValueChange={([v]) => setSpeed(v)}
          min={1}
          max={5}
          label="Fan Speed"
          showValue
          className="mt-2"
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Home() {
  const {
    rooms: storeRooms,
    devices: storeDevices,
    sensors: storeSensors,
    selectedRoomId,
    setRooms,
    setDevices,
    updateDevice,
    setSensors,
    setSelectedRoom,
    setCurrentPage,
  } = useStore();

  const [loading, setLoading] = useState(true);

  const rooms = storeRooms.length > 0 ? storeRooms : mockRooms;
  const devices = storeDevices.length > 0 ? storeDevices : mockDevices;
  const sensors = storeSensors.length > 0 ? storeSensors : mockSensors;
  const selectedRoom = selectedRoomId ?? 'r1';

  useEffect(() => {
    setCurrentPage('/home');
    Promise.allSettled([
      homeApi.rooms().then((data) => { if (Array.isArray(data)) setRooms(data); }),
      homeApi.devices().then((data) => { if (Array.isArray(data)) setDevices(data); }),
      homeApi.sensors().then((data) => { if (Array.isArray(data)) setSensors(data); }),
    ]).finally(() => setLoading(false));
  }, [setCurrentPage, setRooms, setDevices, setSensors]);

  const handleToggleDevice = useCallback(
    (id: string, on: boolean) => {
      updateDevice(id, { is_on: on });
      homeApi.controlDevice({ device_id: id, action: on ? 'turn_on' : 'turn_off' }).catch(() => {});
    },
    [updateDevice],
  );

  const roomDevices = useMemo(
    () => devices.filter((d) => d.room_id === selectedRoom),
    [devices, selectedRoom],
  );

  const onlineDevices = devices.filter((d) => d.status === 'online').length;

  /* ── Energy stats ── */
  const totalWatts = 847;
  const dailyKwh = 12.4;
  const monthlyCost = 68;
  const efficiencyScore = 78;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ── Top Bar ── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
            <HomeIcon size={24} className="text-nexus-primary" />
            Smart Home
          </h1>
          <p className="text-sm text-nexus-muted mt-0.5">
            {onlineDevices} devices online · {rooms.length} rooms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot pulse>
            ESP32 Connected
          </Badge>
          <Button variant="ghost" size="sm" icon={RefreshCw}>
            Sync
          </Button>
        </div>
      </motion.div>

      {/* ── Room Grid ── */}
      <motion.div variants={item}>
        <h2 className="text-sm font-semibold text-nexus-muted uppercase tracking-wider mb-3">Rooms</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {rooms.map((room) => (
            <motion.button
              key={room.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedRoom(room.id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                selectedRoom === room.id
                  ? 'border-nexus-primary/50 bg-nexus-primary/10 shadow-nexus'
                  : 'border-nexus-border bg-nexus-card/40 hover:border-nexus-primary/20'
              }`}
            >
              <HomeIcon
                size={20}
                className={selectedRoom === room.id ? 'text-nexus-primary' : 'text-nexus-muted'}
              />
              <span className="text-xs font-medium text-nexus-text">{room.name}</span>
              <span className="text-[10px] text-nexus-muted">{room.device_count} devices</span>
              {room.temperature && (
                <span className="text-[10px] text-nexus-muted">{room.temperature}°C</span>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Room Devices + Sensors ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Devices */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center gap-2">
                <Power size={16} className="text-nexus-primary" />
                <span>
                  {rooms.find((r) => r.id === selectedRoom)?.name ?? 'Room'} Devices
                </span>
                <Badge variant="neutral" className="ml-auto">{roomDevices.length}</Badge>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {roomDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onToggle={handleToggleDevice}
                  />
                ))}
              </AnimatePresence>
              {roomDevices.length === 0 && (
                <div className="col-span-2 py-8 text-center text-sm text-nexus-muted">
                  No devices in this room.
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Sensor Gauges */}
        <motion.div variants={item} className="space-y-4">
          <Card
            header={
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-nexus-accent" />
                <span>Sensors</span>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <SensorGauge label="Temperature" value={sensors[0]?.value ?? 24.5} unit="°C" icon={Thermometer} color="#F97316" max={40} />
              <SensorGauge label="Humidity" value={sensors[1]?.value ?? 48} unit="%" icon={Droplets} color="#3B82F6" />
              <SensorGauge label="Air Quality" value={sensors[2]?.value ?? 42} unit=" AQI" icon={Wind} color="#10B981" max={500} />
              <SensorGauge label="Gas Level" value={sensors[3]?.value ?? 120} unit=" ppm" icon={Flame} color="#EF4444" max={1000} />
            </div>
          </Card>

          {/* Water Tank */}
          <Card
            header={
              <div className="flex items-center gap-2">
                <Waves size={16} className="text-blue-400" />
                <span>Water Tank</span>
              </div>
            }
          >
            <WaterTank level={72} />
            <p className="text-center text-xs text-nexus-muted mt-2">Level: 72% (540L / 750L)</p>
          </Card>

          {/* Room Comfort Score */}
          <Card size="sm" hoverable>
            <div className="flex items-center gap-3">
              <CircularProgress value={85} size={48} strokeWidth={4} />
              <div>
                <p className="text-xs text-nexus-muted uppercase tracking-wider">Comfort Score</p>
                <p className="text-lg font-bold text-nexus-text">85/100</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── Power Consumption Chart ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-amber-400" />
                <span>Power Consumption (24h)</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-nexus-muted">
                <span className="flex items-center gap-1">
                  <Zap size={12} className="text-amber-400" />
                  <AnimatedNumber value={totalWatts} className="font-semibold text-nexus-text" />W now
                </span>
                <span>
                  <AnimatedNumber value={dailyKwh} className="font-semibold text-nexus-text" /> kWh today
                </span>
                <span>
                  ≈ $<AnimatedNumber value={monthlyCost} className="font-semibold text-nexus-text" />/mo
                </span>
              </div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={energyHistory}>
              <defs>
                <linearGradient id="energyG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1E1E2E',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="watts" stroke="#F59E0B" fill="url(#energyG)" strokeWidth={2} name="Watts" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ── Smart Scenes + Energy Efficiency ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenes */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-nexus-secondary" />
                <span>Smart Scenes</span>
              </div>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mockScenes.map((scene) => (
                <motion.button
                  key={scene.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                    scene.is_active
                      ? 'border-nexus-secondary/50 bg-nexus-secondary/10 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                      : 'border-nexus-border bg-nexus-card/40 hover:border-nexus-secondary/20'
                  }`}
                >
                  <span className={scene.is_active ? 'text-nexus-secondary' : 'text-nexus-muted'}>
                    {getSceneIcon(scene.icon)}
                  </span>
                  <span className="text-xs font-medium text-nexus-text">{scene.name}</span>
                  {scene.is_active && (
                    <Badge variant="success" dot pulse>Active</Badge>
                  )}
                </motion.button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Energy Efficiency */}
        <motion.div variants={item}>
          <Card
            variant="glow"
            header={
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-emerald-400" />
                <span>Energy Efficiency</span>
              </div>
            }
          >
            <div className="flex flex-col items-center py-4">
              <CircularProgress value={efficiencyScore} size={100} strokeWidth={8} />
              <p className="text-sm font-semibold text-nexus-text mt-3">
                <AnimatedNumber value={efficiencyScore} /> / 100
              </p>
              <p className="text-xs text-nexus-muted mt-1">
                <TrendingDown size={12} className="inline text-emerald-400" /> 12% less than last week
              </p>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between text-xs text-nexus-muted">
                <span>Lights</span><span>₹240/mo</span>
              </div>
              <Progress value={45} size="sm" />
              <div className="flex justify-between text-xs text-nexus-muted">
                <span>AC/Heating</span><span>₹680/mo</span>
              </div>
              <Progress value={72} size="sm" />
              <div className="flex justify-between text-xs text-nexus-muted">
                <span>Others</span><span>₹180/mo</span>
              </div>
              <Progress value={28} size="sm" />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── ESP32 Connection Status ── */}
      <motion.div variants={item}>
        <Card size="sm">
          <div className="flex items-center gap-3">
            <Cpu size={20} className="text-nexus-accent" />
            <div className="flex-1">
              <p className="text-sm font-medium text-nexus-text">ESP32 Devices</p>
              <p className="text-xs text-nexus-muted">MQTT Broker: mqtt://192.168.1.100:1883</p>
            </div>
            <StatusIndicator status="active" label="Connected" />
            <Button variant="ghost" size="sm" icon={Settings}>
              Configure
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
