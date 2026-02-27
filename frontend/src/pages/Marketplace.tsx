import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Package, Star, Download, ChevronRight, Search, Filter,
  Grid3X3, List, Shield, Check, ExternalLink, ArrowUpRight,
  Zap, TrendingUp, Users, Clock, Tag, Heart, Code,
  BarChart2, MessageSquare, Settings2, RefreshCw, Globe,
  Calendar, Lock, Cpu, Cloud, Mail, GitBranch, Activity,
  Palette, BrainCircuit, Dumbbell, Database, FileText,
  Image, Music, Video, Mic, Camera, Wifi
} from 'lucide-react';
import { FadeIn, ScaleIn } from '../lib/animations';
import { useIsDemoAccount } from '@/hooks/useDemoData';

// ─── Types ──────────────────────────────────────────────────────────
interface Plugin {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  version: string;
  author: string;
  rating: number;
  reviews: number;
  downloads: number;
  installed: boolean;
  active: boolean;
  verified: boolean;
  premium: boolean;
  icon: React.ReactNode;
  color: string;
  tags: string[];
  lastUpdated: string;
  size: string;
  compatibility: string;
  features: string[];
}

// ─── Categories ─────────────────────────────────────────────────────
const categories = [
  { id: 'all', name: 'All Plugins', icon: <Grid3X3 size={16} />, count: 0 },
  { id: 'ai', name: 'AI & ML', icon: <BrainCircuit size={16} />, count: 8 },
  { id: 'automation', name: 'Automation', icon: <Zap size={16} />, count: 6 },
  { id: 'communication', name: 'Communication', icon: <MessageSquare size={16} />, count: 5 },
  { id: 'data', name: 'Data & Analytics', icon: <BarChart2 size={16} />, count: 7 },
  { id: 'security', name: 'Security', icon: <Shield size={16} />, count: 4 },
  { id: 'smart-home', name: 'Smart Home', icon: <Wifi size={16} />, count: 6 },
  { id: 'health', name: 'Health & Fitness', icon: <Dumbbell size={16} />, count: 4 },
  { id: 'productivity', name: 'Productivity', icon: <TrendingUp size={16} />, count: 5 },
  { id: 'media', name: 'Media', icon: <Video size={16} />, count: 3 },
  { id: 'themes', name: 'Themes & UI', icon: <Palette size={16} />, count: 4 },
  { id: 'developer', name: 'Developer Tools', icon: <Code size={16} />, count: 5 },
];

// ─── Plugins Data ───────────────────────────────────────────────────
const pluginsData: Plugin[] = [
  {
    id: 'p-1', name: 'Smart Weather Pro', description: 'Advanced weather forecasting with AI-powered predictions',
    longDescription: 'Get hyper-local weather forecasts, severe weather alerts, and AI-powered predictions up to 14 days ahead.',
    category: 'smart-home', version: '3.2.1', author: 'WeatherTech', rating: 4.8, reviews: 1250,
    downloads: 45000, installed: true, active: true, verified: true, premium: false,
    icon: <Cloud size={24} />, color: 'from-blue-500 to-cyan-500',
    tags: ['weather', 'forecast', 'smart-home'], lastUpdated: '2 days ago', size: '2.4 MB',
    compatibility: 'v2.0+', features: ['14-day forecast', 'Severe weather alerts', 'Historical data', 'API access'],
  },
  {
    id: 'p-2', name: 'Calendar Sync Pro', description: 'Sync calendars across Google, Outlook, and Apple',
    longDescription: 'Seamlessly synchronize your calendars across multiple platforms with conflict detection.',
    category: 'productivity', version: '2.8.0', author: 'SyncLabs', rating: 4.6, reviews: 890,
    downloads: 32000, installed: true, active: true, verified: true, premium: false,
    icon: <Calendar size={24} />, color: 'from-purple-500 to-indigo-500',
    tags: ['calendar', 'sync', 'productivity'], lastUpdated: '1 week ago', size: '1.8 MB',
    compatibility: 'v2.0+', features: ['Multi-platform sync', 'Conflict detection', 'Smart scheduling', 'Reminders'],
  },
  {
    id: 'p-3', name: 'Slack Integration', description: 'Full Slack workspace integration with AI features',
    longDescription: 'Connect your Slack workspace for seamless communication with AI-powered message summarization.',
    category: 'communication', version: '4.1.2', author: 'CommHub', rating: 4.9, reviews: 2100,
    downloads: 78000, installed: true, active: false, verified: true, premium: false,
    icon: <MessageSquare size={24} />, color: 'from-green-500 to-emerald-500',
    tags: ['slack', 'messaging', 'team'], lastUpdated: '3 days ago', size: '3.1 MB',
    compatibility: 'v1.5+', features: ['Real-time sync', 'AI summaries', 'Channel management', 'Bot commands'],
  },
  {
    id: 'p-4', name: 'GitHub Assistant', description: 'AI-powered code review and PR management',
    longDescription: 'Automate your GitHub workflow with AI code reviews, PR summaries, and issue management.',
    category: 'developer', version: '5.0.0', author: 'DevTools Inc', rating: 4.7, reviews: 3200,
    downloads: 95000, installed: false, active: false, verified: true, premium: true,
    icon: <GitBranch size={24} />, color: 'from-gray-600 to-gray-800',
    tags: ['github', 'code-review', 'developer'], lastUpdated: '1 day ago', size: '4.2 MB',
    compatibility: 'v2.0+', features: ['AI code review', 'PR automation', 'Issue tracking', 'CI/CD integration'],
  },
  {
    id: 'p-5', name: 'Smart Home Hub', description: 'Unified control for all smart home devices',
    longDescription: 'Control and automate all your smart home devices from a single dashboard.',
    category: 'smart-home', version: '3.5.0', author: 'HomeAI', rating: 4.5, reviews: 1800,
    downloads: 56000, installed: false, active: false, verified: true, premium: false,
    icon: <Wifi size={24} />, color: 'from-teal-500 to-cyan-500',
    tags: ['smart-home', 'iot', 'automation'], lastUpdated: '5 days ago', size: '5.6 MB',
    compatibility: 'v2.0+', features: ['Device discovery', 'Scene automation', 'Voice control', 'Energy monitoring'],
  },
  {
    id: 'p-6', name: 'Crypto Portfolio', description: 'Real-time cryptocurrency tracking and analytics',
    longDescription: 'Track your crypto portfolio with real-time prices, alerts, and advanced analytics.',
    category: 'data', version: '2.3.1', author: 'CryptoVerse', rating: 4.4, reviews: 670,
    downloads: 23000, installed: false, active: false, verified: true, premium: true,
    icon: <TrendingUp size={24} />, color: 'from-yellow-500 to-orange-500',
    tags: ['crypto', 'finance', 'trading'], lastUpdated: '4 days ago', size: '3.8 MB',
    compatibility: 'v2.0+', features: ['Real-time prices', 'Portfolio tracking', 'Price alerts', 'Tax reports'],
  },
  {
    id: 'p-7', name: 'AI Code Review', description: 'Automated code quality analysis with ML',
    longDescription: 'Get intelligent code suggestions and quality improvements powered by machine learning.',
    category: 'ai', version: '1.9.0', author: 'MLTools', rating: 4.3, reviews: 450,
    downloads: 15000, installed: false, active: false, verified: true, premium: true,
    icon: <Code size={24} />, color: 'from-violet-500 to-purple-500',
    tags: ['ai', 'code', 'quality'], lastUpdated: '1 week ago', size: '12.4 MB',
    compatibility: 'v2.5+', features: ['Code analysis', 'Bug detection', 'Style suggestions', 'Security scanning'],
  },
  {
    id: 'p-8', name: 'Fitness Tracker Pro', description: 'Comprehensive fitness and workout tracking',
    longDescription: 'Track workouts, nutrition, and health goals with AI-powered coaching.',
    category: 'health', version: '2.1.0', author: 'FitTech', rating: 4.6, reviews: 980,
    downloads: 34000, installed: false, active: false, verified: true, premium: false,
    icon: <Dumbbell size={24} />, color: 'from-red-500 to-pink-500',
    tags: ['fitness', 'health', 'workout'], lastUpdated: '3 days ago', size: '4.1 MB',
    compatibility: 'v2.0+', features: ['Workout tracking', 'Nutrition log', 'AI coaching', 'Progress reports'],
  },
  {
    id: 'p-9', name: 'Data Visualizer', description: 'Beautiful charts and data visualization tools',
    longDescription: 'Create stunning data visualizations with drag-and-drop chart builder.',
    category: 'data', version: '3.0.0', author: 'VizPro', rating: 4.8, reviews: 1500,
    downloads: 62000, installed: false, active: false, verified: true, premium: false,
    icon: <BarChart2 size={24} />, color: 'from-indigo-500 to-blue-500',
    tags: ['charts', 'data', 'visualization'], lastUpdated: '2 days ago', size: '6.2 MB',
    compatibility: 'v2.0+', features: ['30+ chart types', 'Drag & drop builder', 'Real-time data', 'Export options'],
  },
  {
    id: 'p-10', name: 'Cloud Backup', description: 'Automated cloud backup with encryption',
    longDescription: 'Secure automated backups to multiple cloud providers with AES-256 encryption.',
    category: 'security', version: '2.5.0', author: 'SecureVault', rating: 4.7, reviews: 1100,
    downloads: 41000, installed: true, active: true, verified: true, premium: false,
    icon: <Cloud size={24} />, color: 'from-emerald-500 to-green-500',
    tags: ['backup', 'cloud', 'security'], lastUpdated: '1 week ago', size: '2.9 MB',
    compatibility: 'v1.5+', features: ['Automated backups', 'AES-256 encryption', 'Multi-cloud support', 'Version history'],
  },
  {
    id: 'p-11', name: 'Midnight Theme', description: 'Beautiful dark theme with customizable accents',
    longDescription: 'An elegant dark theme with customizable accent colors, font options, and more.',
    category: 'themes', version: '1.4.0', author: 'ThemeCraft', rating: 4.9, reviews: 3400,
    downloads: 120000, installed: true, active: true, verified: true, premium: false,
    icon: <Palette size={24} />, color: 'from-gray-700 to-gray-900',
    tags: ['theme', 'dark-mode', 'ui'], lastUpdated: '2 weeks ago', size: '0.8 MB',
    compatibility: 'v1.0+', features: ['Dark mode', 'Custom accents', 'Font options', 'Reduced motion'],
  },
  {
    id: 'p-12', name: 'Email Parser Pro', description: 'AI-powered email parsing and categorization',
    longDescription: 'Automatically parse, categorize, and extract information from emails with AI.',
    category: 'communication', version: '2.2.0', author: 'MailAI', rating: 4.5, reviews: 780,
    downloads: 28000, installed: false, active: false, verified: true, premium: true,
    icon: <Mail size={24} />, color: 'from-sky-500 to-blue-500',
    tags: ['email', 'parsing', 'ai'], lastUpdated: '6 days ago', size: '3.5 MB',
    compatibility: 'v2.0+', features: ['Auto-categorization', 'Data extraction', 'Smart replies', 'Priority sorting'],
  },
  {
    id: 'p-13', name: 'Voice Commander', description: 'Advanced voice control and custom commands',
    longDescription: 'Create custom voice commands, manage voice profiles, and control everything by voice.',
    category: 'ai', version: '3.1.0', author: 'VoiceAI Labs', rating: 4.4, reviews: 620,
    downloads: 19000, installed: false, active: false, verified: true, premium: false,
    icon: <Mic size={24} />, color: 'from-pink-500 to-rose-500',
    tags: ['voice', 'control', 'commands'], lastUpdated: '4 days ago', size: '8.7 MB',
    compatibility: 'v2.0+', features: ['Custom commands', 'Multi-language', 'Voice profiles', 'Wake word'],
  },
  {
    id: 'p-14', name: 'Security Scanner', description: 'Real-time vulnerability scanning and alerts',
    longDescription: 'Comprehensive security scanning for all connected devices and services.',
    category: 'security', version: '4.0.0', author: 'CyberShield', rating: 4.8, reviews: 1900,
    downloads: 72000, installed: false, active: false, verified: true, premium: true,
    icon: <Shield size={24} />, color: 'from-red-600 to-red-800',
    tags: ['security', 'scanning', 'protection'], lastUpdated: '1 day ago', size: '7.3 MB',
    compatibility: 'v2.5+', features: ['Real-time scanning', 'Vulnerability alerts', 'Firewall rules', 'Threat reports'],
  },
  {
    id: 'p-15', name: 'Database Manager', description: 'Visual database management and query builder',
    longDescription: 'Manage databases visually with a drag-and-drop query builder and ERD viewer.',
    category: 'developer', version: '2.7.0', author: 'DataOps', rating: 4.6, reviews: 530,
    downloads: 17000, installed: false, active: false, verified: true, premium: false,
    icon: <Database size={24} />, color: 'from-amber-500 to-orange-500',
    tags: ['database', 'sql', 'management'], lastUpdated: '5 days ago', size: '5.1 MB',
    compatibility: 'v2.0+', features: ['Visual query builder', 'ERD viewer', 'Migration tools', 'Backup manager'],
  },
  {
    id: 'p-16', name: 'Camera AI', description: 'Smart camera with object detection and face recognition',
    longDescription: 'Turn your security cameras into intelligent monitoring systems with AI.',
    category: 'smart-home', version: '2.0.0', author: 'VisionTech', rating: 4.3, reviews: 410,
    downloads: 13000, installed: false, active: false, verified: true, premium: true,
    icon: <Camera size={24} />, color: 'from-cyan-600 to-teal-600',
    tags: ['camera', 'ai', 'security'], lastUpdated: '1 week ago', size: '15.2 MB',
    compatibility: 'v2.5+', features: ['Object detection', 'Face recognition', 'Motion zones', 'Night vision'],
  },
];

// ─── Star Rating ────────────────────────────────────────────────────
const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        size={size}
        className={i <= Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}
      />
    ))}
    <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">{rating}</span>
  </div>
);

// ─── Plugin Card – Grid ─────────────────────────────────────────────
const PluginGridCard: React.FC<{
  plugin: Plugin;
  index: number;
  onSelect: (p: Plugin) => void;
  onToggle: (id: string) => void;
}> = ({ plugin, index, onSelect, onToggle }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03 }}
    whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}
    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden group cursor-pointer"
    onClick={() => onSelect(plugin)}
  >
    {/* Header Gradient */}
    <div className={`h-24 bg-gradient-to-br ${plugin.color} relative flex items-center justify-center`}>
      <div className="absolute inset-0 bg-black/10" />
      <div className="text-white relative z-10 opacity-90">{plugin.icon}</div>
      {plugin.premium && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full"
        >
          PRO
        </motion.span>
      )}
      {plugin.verified && (
        <div className="absolute top-2 left-2">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs">
            <Check size={10} /> Verified
          </div>
        </div>
      )}
    </div>

    <div className="p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-500 transition-colors">
        {plugin.name}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{plugin.description}</p>

      <div className="flex items-center gap-2 mt-3">
        <StarRating rating={plugin.rating} size={12} />
        <span className="text-xs text-gray-400">({plugin.reviews})</span>
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><Download size={12} /> {(plugin.downloads / 1000).toFixed(0)}k</span>
        <span className="flex items-center gap-1"><Tag size={12} /> {plugin.version}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {plugin.lastUpdated}</span>
      </div>

      <div className="flex flex-wrap gap-1 mt-3">
        {plugin.tags.slice(0, 3).map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-400">by {plugin.author}</span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(plugin.id);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            plugin.installed
              ? plugin.active
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
        >
          {plugin.installed ? (plugin.active ? 'Active' : 'Inactive') : 'Install'}
        </motion.button>
      </div>
    </div>
  </motion.div>
);

// ─── Plugin Detail Modal ────────────────────────────────────────────
const PluginDetailModal: React.FC<{
  plugin: Plugin;
  onClose: () => void;
  onToggle: (id: string) => void;
}> = ({ plugin, onClose, onToggle }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
    >
      {/* Hero */}
      <div className={`h-40 bg-gradient-to-br ${plugin.color} relative flex items-center justify-center`}>
        <div className="text-white scale-150">{plugin.icon}</div>
        {plugin.premium && (
          <span className="absolute top-4 right-4 px-3 py-1 bg-yellow-400 text-yellow-900 text-sm font-bold rounded-full">
            PREMIUM
          </span>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{plugin.name}</h2>
            <p className="text-gray-500 mt-1">by {plugin.author} · v{plugin.version}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggle(plugin.id)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              plugin.installed
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/25'
            }`}
          >
            {plugin.installed ? 'Uninstall' : 'Install'}
          </motion.button>
        </div>

        <p className="text-gray-600 dark:text-gray-300 mb-6">{plugin.longDescription}</p>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Downloads', value: `${(plugin.downloads / 1000).toFixed(0)}k` },
            { label: 'Rating', value: plugin.rating.toString() },
            { label: 'Reviews', value: plugin.reviews.toString() },
            { label: 'Size', value: plugin.size },
          ].map(stat => (
            <div key={stat.label} className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Features</h3>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {plugin.features.map(feature => (
            <div key={feature} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Check size={14} className="text-green-500 flex-shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <StarRating rating={plugin.rating} />
          <span className="text-sm text-gray-500">{plugin.reviews} reviews</span>
          <span className="text-sm text-gray-500">Updated {plugin.lastUpdated}</span>
          <span className="text-sm text-gray-500">Requires {plugin.compatibility}</span>
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// ─── Main Marketplace Page ──────────────────────────────────────────
const Marketplace: React.FC = () => {
  const [plugins, setPlugins] = useState<Plugin[]>(isDemo ? pluginsData : []);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterInstalled, setFilterInstalled] = useState<'all' | 'installed' | 'available'>('all');
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'newest'>('popularity');

  const handleToggle = useCallback((id: string) => {
    setPlugins(prev => prev.map(p => {
      if (p.id === id) {
        if (p.installed) {
          return { ...p, installed: false, active: false };
        } else {
          return { ...p, installed: true, active: true };
        }
      }
      return p;
    }));
  }, []);

  const filteredPlugins = useMemo(() => {
    let result = plugins.filter(p => {
      const matchesSearch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesInstalled = filterInstalled === 'all' ||
        (filterInstalled === 'installed' && p.installed) ||
        (filterInstalled === 'available' && !p.installed);
      return matchesSearch && matchesCategory && matchesInstalled;
    });

    if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'newest') result.sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated));
    else result.sort((a, b) => b.downloads - a.downloads);

    return result;
  }, [plugins, searchQuery, selectedCategory, filterInstalled, sortBy]);

  const stats = useMemo(() => ({
    total: plugins.length,
    installed: plugins.filter(p => p.installed).length,
    active: plugins.filter(p => p.active).length,
    premium: plugins.filter(p => p.premium).length,
  }), [plugins]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Store className="text-indigo-500" size={32} />
              Plugin Marketplace
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Discover and install plugins to extend your AI agent
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
              {stats.installed} installed
            </span>
            <span className="px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium">
              {stats.active} active
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Featured Banner */}
      <FadeIn delay={0.1}>
        <motion.div
          className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-8 overflow-hidden"
          whileHover={{ scale: 1.005 }}
        >
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="text-yellow-300" size={20} />
              <span className="text-yellow-300 font-semibold text-sm">FEATURED</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">AI Code Review Plugin</h2>
            <p className="text-white/80 max-w-xl mb-4">
              Get intelligent code suggestions and automated quality improvements powered by state-of-the-art machine learning models.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
            >
              Learn More
            </motion.button>
          </div>
        </motion.div>
      </FadeIn>

      <div className="flex gap-6">
        {/* Sidebar Categories */}
        <FadeIn delay={0.2} className="hidden lg:block w-56 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sticky top-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wider">Categories</h3>
            <ul className="space-y-0.5">
              {categories.map(cat => (
                <li key={cat.id}>
                  <button
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat.icon}
                    <span className="flex-1 text-left">{cat.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterInstalled}
                onChange={(e) => setFilterInstalled(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm outline-none"
              >
                <option value="all">All</option>
                <option value="installed">Installed</option>
                <option value="available">Available</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm outline-none"
              >
                <option value="popularity">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4">{filteredPlugins.length} plugins found</p>

          {/* Plugin Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin, i) => (
              <PluginGridCard
                key={plugin.id}
                plugin={plugin}
                index={i}
                onSelect={setSelectedPlugin}
                onToggle={handleToggle}
              />
            ))}
          </div>

          {filteredPlugins.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <Package size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No plugins found</h3>
              <p className="text-gray-500">Try adjusting your search or browse different categories.</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPlugin && (
          <PluginDetailModal
            plugin={selectedPlugin}
            onClose={() => setSelectedPlugin(null)}
            onToggle={handleToggle}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Marketplace;
