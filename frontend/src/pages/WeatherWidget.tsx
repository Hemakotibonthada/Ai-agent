import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CloudSun, Thermometer, Wind, Droplets, Eye, Compass,
  Sunrise, Sunset, Cloud, CloudRain, CloudSnow, Sun,
  CloudLightning, CloudDrizzle, MapPin, RefreshCw,
  TrendingUp, ArrowUp, ArrowDown, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface WeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  visibility: number;
  pressure: number;
  uvIndex: number;
  condition: string;
  icon: string;
  sunrise: string;
  sunset: string;
  high: number;
  low: number;
}

interface ForecastDay {
  day: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipitation: number;
  humidity: number;
  wind: number;
}

interface HourlyForecast {
  time: string;
  temp: number;
  precipitation: number;
  humidity: number;
  wind: number;
}

const currentWeather: WeatherData = {
  location: 'Smart Home Hub',
  temperature: 22,
  feelsLike: 24,
  humidity: 58,
  windSpeed: 12,
  windDirection: 'NNW',
  visibility: 10,
  pressure: 1013,
  uvIndex: 6,
  condition: 'Partly Cloudy',
  icon: '⛅',
  sunrise: '06:32',
  sunset: '18:45',
  high: 26,
  low: 14,
};

const forecast: ForecastDay[] = [
  { day: 'Today', high: 26, low: 14, condition: 'Partly Cloudy', icon: '⛅', precipitation: 10, humidity: 58, wind: 12 },
  { day: 'Tomorrow', high: 28, low: 16, condition: 'Sunny', icon: '☀️', precipitation: 0, humidity: 45, wind: 8 },
  { day: 'Wed', high: 24, low: 15, condition: 'Rain', icon: '🌧️', precipitation: 75, humidity: 78, wind: 20 },
  { day: 'Thu', high: 20, low: 12, condition: 'Thunderstorm', icon: '⛈️', precipitation: 90, humidity: 85, wind: 25 },
  { day: 'Fri', high: 22, low: 13, condition: 'Cloudy', icon: '☁️', precipitation: 30, humidity: 65, wind: 15 },
  { day: 'Sat', high: 25, low: 15, condition: 'Partly Cloudy', icon: '⛅', precipitation: 15, humidity: 55, wind: 10 },
  { day: 'Sun', high: 27, low: 16, condition: 'Sunny', icon: '☀️', precipitation: 5, humidity: 42, wind: 7 },
];

const hourlyForecast: HourlyForecast[] = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  temp: 14 + Math.sin((i - 6) * Math.PI / 12) * 6 + Math.random() * 2,
  precipitation: i >= 14 && i <= 18 ? 20 + Math.random() * 30 : Math.random() * 10,
  humidity: 50 + Math.sin(i * Math.PI / 12) * 15 + Math.random() * 5,
  wind: 8 + Math.sin(i * Math.PI / 8) * 5 + Math.random() * 3,
}));

const temperatureHistory = Array.from({ length: 30 }, (_, i) => ({
  date: `Mar ${i + 1}`,
  high: 22 + Math.random() * 8,
  low: 10 + Math.random() * 6,
  avg: 16 + Math.random() * 5,
}));

const conditionIcons = {
  'Sunny': <Sun size={20} className="text-yellow-400" />,
  'Partly Cloudy': <CloudSun size={20} className="text-blue-300" />,
  'Cloudy': <Cloud size={20} className="text-gray-400" />,
  'Rain': <CloudRain size={20} className="text-blue-400" />,
  'Thunderstorm': <CloudLightning size={20} className="text-purple-400" />,
  'Snow': <CloudSnow size={20} className="text-blue-200" />,
  'Drizzle': <CloudDrizzle size={20} className="text-blue-300" />,
};

export default function WeatherWidget() {
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'history'>('hourly');
  const [unit, setUnit] = useState<'C' | 'F'>('C');

  const toUnit = (temp: number) => unit === 'F' ? Math.round(temp * 9 / 5 + 32) : Math.round(temp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-nexus-bg p-6"
    >
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <CloudSun className="text-nexus-primary" /> Weather
          </h1>
          <p className="text-nexus-muted mt-1 flex items-center gap-2"><MapPin size={14} /> {currentWeather.location}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-nexus-border/30 overflow-hidden">
            <button onClick={() => setUnit('C')} className={`px-3 py-1.5 text-xs ${unit === 'C' ? 'bg-nexus-primary text-white' : 'text-nexus-muted'}`}>°C</button>
            <button onClick={() => setUnit('F')} className={`px-3 py-1.5 text-xs ${unit === 'F' ? 'bg-nexus-primary text-white' : 'text-nexus-muted'}`}>°F</button>
          </div>
          <button className="p-2 rounded-xl bg-nexus-surface border border-nexus-border/30 text-nexus-muted hover:text-nexus-primary">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Current Weather Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-3xl border border-nexus-border/30 p-8 mb-6 relative overflow-hidden"
      >
        {/* Animated gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-cyan-500/5" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="text-center">
            <span className="text-8xl">{currentWeather.icon}</span>
            <p className="text-lg text-nexus-muted mt-2">{currentWeather.condition}</p>
          </div>
          <div className="text-center md:text-left">
            <div className="flex items-start gap-2">
              <span className="text-7xl font-light text-nexus-text">{toUnit(currentWeather.temperature)}</span>
              <span className="text-2xl text-nexus-muted mt-2">°{unit}</span>
            </div>
            <p className="text-nexus-muted">Feels like {toUnit(currentWeather.feelsLike)}°{unit}</p>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-red-400 flex items-center gap-1"><ArrowUp size={12} />{toUnit(currentWeather.high)}°</span>
              <span className="text-blue-400 flex items-center gap-1"><ArrowDown size={12} />{toUnit(currentWeather.low)}°</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Droplets, label: 'Humidity', value: `${currentWeather.humidity}%`, color: 'text-blue-400' },
              { icon: Wind, label: 'Wind', value: `${currentWeather.windSpeed} km/h`, color: 'text-teal-400' },
              { icon: Eye, label: 'Visibility', value: `${currentWeather.visibility} km`, color: 'text-indigo-400' },
              { icon: Compass, label: 'Pressure', value: `${currentWeather.pressure} hPa`, color: 'text-purple-400' },
              { icon: Sun, label: 'UV Index', value: `${currentWeather.uvIndex}`, color: 'text-yellow-400' },
              { icon: Wind, label: 'Direction', value: currentWeather.windDirection, color: 'text-cyan-400' },
              { icon: Sunrise, label: 'Sunrise', value: currentWeather.sunrise, color: 'text-orange-400' },
              { icon: Sunset, label: 'Sunset', value: currentWeather.sunset, color: 'text-pink-400' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2"
              >
                <item.icon size={16} className={item.color} />
                <div>
                  <p className="text-[10px] text-nexus-muted">{item.label}</p>
                  <p className="text-sm font-medium text-nexus-text">{item.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        {(['hourly', 'daily', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm capitalize rounded-xl transition-colors ${activeTab === tab ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{tab}</button>
        ))}
      </div>

      {/* Hourly Tab */}
      {activeTab === 'hourly' && (
        <div className="space-y-6">
          {/* Hourly Temp Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
            <h3 className="font-semibold text-nexus-text mb-4">24-Hour Temperature</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlyForecast}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} formatter={(val: number) => [`${toUnit(val)}°${unit}`, 'Temperature']} />
                <Area type="monotone" dataKey="temp" stroke="#F59E0B" fill="url(#tempGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Hourly cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {hourlyForecast.filter((_, i) => i % 2 === 0).map((h, i) => (
              <motion.div
                key={h.time}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-2xl border border-nexus-border/30 p-4 min-w-[100px] text-center shrink-0"
              >
                <p className="text-xs text-nexus-muted mb-2">{h.time}</p>
                <p className="text-xl font-bold text-nexus-text">{toUnit(h.temp)}°</p>
                <div className="flex items-center justify-center gap-1 mt-2 text-[10px]">
                  <Droplets size={10} className="text-blue-400" />
                  <span className="text-nexus-muted">{Math.round(h.precipitation)}%</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Precipitation & Wind */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
              <h3 className="font-semibold text-nexus-text mb-4 flex items-center gap-2"><Droplets size={16} className="text-blue-400" /> Precipitation</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={hourlyForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={5} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                  <Bar dataKey="precipitation" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
              <h3 className="font-semibold text-nexus-text mb-4 flex items-center gap-2"><Wind size={16} className="text-teal-400" /> Wind Speed</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={hourlyForecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                  <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={5} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                  <Line type="monotone" dataKey="wind" stroke="#14B8A6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </div>
      )}

      {/* Daily Forecast Tab */}
      {activeTab === 'daily' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {forecast.map((day, i) => (
            <motion.div
              key={day.day}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`glass rounded-2xl border p-5 text-center ${i === 0 ? 'border-nexus-primary/50 bg-nexus-primary/5' : 'border-nexus-border/30'}`}
            >
              <p className={`text-sm font-semibold mb-3 ${i === 0 ? 'text-nexus-primary' : 'text-nexus-text'}`}>{day.day}</p>
              <span className="text-4xl">{day.icon}</span>
              <p className="text-xs text-nexus-muted mt-2 mb-3">{day.condition}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold text-nexus-text">{toUnit(day.high)}°</span>
                <span className="text-sm text-nexus-muted">{toUnit(day.low)}°</span>
              </div>
              <div className="mt-3 pt-3 border-t border-nexus-border/20 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-nexus-muted">Rain</span>
                  <span className="text-blue-400">{day.precipitation}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-nexus-muted">Humidity</span>
                  <span className="text-teal-400">{day.humidity}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-nexus-muted">Wind</span>
                  <span className="text-purple-400">{day.wind} km/h</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
          <h3 className="font-semibold text-nexus-text mb-4">30-Day Temperature History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={temperatureHistory}>
              <defs>
                <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/><stop offset="95%" stopColor="#EF4444" stopOpacity={0}/></linearGradient>
                <linearGradient id="lowGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={4} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
              <Area type="monotone" dataKey="high" stroke="#EF4444" fill="url(#highGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="avg" stroke="#F59E0B" fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
              <Area type="monotone" dataKey="low" stroke="#3B82F6" fill="url(#lowGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4 text-xs text-nexus-muted">
            <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-red-400 inline-block" /> High</span>
            <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-yellow-400 inline-block" style={{ borderBottom: '2px dashed' }} /> Average</span>
            <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> Low</span>
          </div>
        </motion.div>
      )}

      {/* Smart Home Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl border border-nexus-border/30 p-6 mt-6"
      >
        <h3 className="font-semibold text-nexus-text mb-4">🏠 Weather-Triggered Automations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { trigger: 'Temperature > 28°C', action: 'Turn on AC, close blinds', status: 'Armed', color: 'text-green-400' },
            { trigger: 'Rain probability > 70%', action: 'Close windows, retract awning', status: 'Armed', color: 'text-green-400' },
            { trigger: 'UV Index > 8', action: 'Close outdoor blinds, notification', status: 'Disabled', color: 'text-gray-400' },
          ].map((auto, i) => (
            <div key={i} className="bg-nexus-surface rounded-xl p-4">
              <p className="text-sm font-medium text-nexus-text mb-1">{auto.trigger}</p>
              <p className="text-xs text-nexus-muted mb-2">→ {auto.action}</p>
              <span className={`text-[10px] ${auto.color}`}>● {auto.status}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
