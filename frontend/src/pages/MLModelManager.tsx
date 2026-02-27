import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Search, Filter, Plus, Play, Pause, Trash2, Download,
  Upload, TrendingUp, TrendingDown, Activity, BarChart3,
  Clock, Zap, Database, GitBranch, Eye, Settings,
  RefreshCw, AlertCircle, CheckCircle, Info, Target,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

interface MLModel {
  id: string;
  name: string;
  version: string;
  type: string;
  framework: string;
  status: 'deployed' | 'training' | 'ready' | 'failed' | 'archived';
  accuracy: number;
  latency: number; // ms
  size: string;
  lastTrained: string;
  requests: number;
  endpoint: string;
  description: string;
  metrics: { date: string; accuracy: number; loss: number; latency: number }[];
  tags: string[];
  parameters: number;
}

const sampleModels: MLModel[] = [
  {
    id: '1', name: 'nexus-nlp-v3', version: '3.2.1', type: 'NLP', framework: 'PyTorch',
    status: 'deployed', accuracy: 94.7, latency: 45, size: '1.2 GB', lastTrained: '2024-03-18',
    requests: 125000, endpoint: '/api/ml/nlp/predict', description: 'Natural language processing model for chat and command understanding',
    tags: ['production', 'nlp', 'chat'], parameters: 124_000_000,
    metrics: Array.from({ length: 20 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 82 + Math.min(i * 0.7, 12.7) + Math.random() * 0.5, loss: 0.45 - Math.min(i * 0.02, 0.38) + Math.random() * 0.01, latency: 40 + Math.random() * 10 })),
  },
  {
    id: '2', name: 'nexus-vision-v2', version: '2.1.0', type: 'Computer Vision', framework: 'TensorFlow',
    status: 'deployed', accuracy: 91.3, latency: 120, size: '2.8 GB', lastTrained: '2024-03-15',
    requests: 45000, endpoint: '/api/ml/vision/analyze', description: 'Object detection and scene analysis for cameras',
    tags: ['production', 'vision', 'camera'], parameters: 85_000_000,
    metrics: Array.from({ length: 20 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 78 + Math.min(i * 0.8, 13.3) + Math.random() * 0.8, loss: 0.52 - Math.min(i * 0.023, 0.4) + Math.random() * 0.015, latency: 110 + Math.random() * 20 })),
  },
  {
    id: '3', name: 'nexus-anomaly-v1', version: '1.4.2', type: 'Anomaly Detection', framework: 'Scikit-learn',
    status: 'deployed', accuracy: 88.9, latency: 12, size: '85 MB', lastTrained: '2024-03-10',
    requests: 890000, endpoint: '/api/ml/anomaly/detect', description: 'Anomaly detection for IoT sensor data',
    tags: ['production', 'iot', 'security'], parameters: 2_500_000,
    metrics: Array.from({ length: 20 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 80 + Math.min(i * 0.5, 8.9) + Math.random() * 0.5, loss: 0.38 - Math.min(i * 0.016, 0.28) + Math.random() * 0.01, latency: 10 + Math.random() * 5 })),
  },
  {
    id: '4', name: 'nexus-recommender', version: '2.0.0-beta', type: 'Recommendation', framework: 'PyTorch',
    status: 'training', accuracy: 76.2, latency: 0, size: '900 MB', lastTrained: 'In Progress',
    requests: 0, endpoint: '/api/ml/recommend', description: 'Personalized recommendation engine for actions and routines',
    tags: ['beta', 'personalization'], parameters: 45_000_000,
    metrics: Array.from({ length: 12 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 62 + i * 1.2 + Math.random() * 2, loss: 0.65 - i * 0.03 + Math.random() * 0.02, latency: 0 })),
  },
  {
    id: '5', name: 'nexus-sentiment', version: '1.1.0', type: 'NLP', framework: 'Hugging Face',
    status: 'ready', accuracy: 92.1, latency: 28, size: '440 MB', lastTrained: '2024-03-12',
    requests: 0, endpoint: '/api/ml/sentiment', description: 'Sentiment analysis for notifications and messages',
    tags: ['ready', 'nlp', 'sentiment'], parameters: 66_000_000,
    metrics: Array.from({ length: 20 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 78 + Math.min(i * 0.75, 14.1) + Math.random() * 0.5, loss: 0.48 - Math.min(i * 0.02, 0.36) + Math.random() * 0.012, latency: 25 + Math.random() * 8 })),
  },
  {
    id: '6', name: 'nexus-tts-v1', version: '1.0.3', type: 'Speech', framework: 'PyTorch',
    status: 'deployed', accuracy: 87.5, latency: 200, size: '3.4 GB', lastTrained: '2024-03-05',
    requests: 22000, endpoint: '/api/ml/tts/synthesize', description: 'Text-to-speech synthesis model',
    tags: ['production', 'voice', 'tts'], parameters: 180_000_000,
    metrics: Array.from({ length: 20 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 72 + Math.min(i * 0.85, 15.5) + Math.random() * 1, loss: 0.55 - Math.min(i * 0.024, 0.42) + Math.random() * 0.02, latency: 180 + Math.random() * 40 })),
  },
  {
    id: '7', name: 'nexus-forecast', version: '1.2.0', type: 'Time Series', framework: 'Prophet',
    status: 'failed', accuracy: 0, latency: 0, size: '120 MB', lastTrained: 'Failed',
    requests: 0, endpoint: '/api/ml/forecast', description: 'Financial and energy consumption forecasting',
    tags: ['error', 'forecasting'], parameters: 8_000_000,
    metrics: Array.from({ length: 8 }, (_, i) => ({ date: `Epoch ${i + 1}`, accuracy: 55 + i * 2 + Math.random() * 5, loss: 0.8 - i * 0.03 + Math.random() * 0.05, latency: 0 })),
  },
];

const statusConfig = {
  deployed: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'Deployed' },
  training: { color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Training' },
  ready: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Ready' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
  archived: { color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Archived' },
};

export default function MLModelManager() {
  const [models] = useState(sampleModels);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'metrics' | 'config'>('overview');

  const filtered = useMemo(() => {
    let items = models;
    if (statusFilter !== 'All') items = items.filter(m => m.status === statusFilter.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(m => m.name.includes(q) || m.type.toLowerCase().includes(q) || m.framework.toLowerCase().includes(q));
    }
    return items;
  }, [models, search, statusFilter]);

  const radarData = useMemo(() => {
    if (!selectedModel) return [];
    return [
      { metric: 'Accuracy', value: selectedModel.accuracy },
      { metric: 'Speed', value: Math.max(0, 100 - selectedModel.latency / 3) },
      { metric: 'Size', value: Math.max(0, 100 - (parseFloat(selectedModel.size) * (selectedModel.size.includes('GB') ? 10 : 0.1))) },
      { metric: 'Requests', value: Math.min(100, selectedModel.requests / 10000) },
      { metric: 'Stability', value: selectedModel.status === 'deployed' ? 95 : selectedModel.status === 'failed' ? 20 : 70 },
    ];
  }, [selectedModel]);

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
            <Cpu className="text-nexus-primary" /> ML Model Manager
          </h1>
          <p className="text-nexus-muted mt-1">{models.length} models · {models.filter(m => m.status === 'deployed').length} in production</p>
        </div>
        <div className="flex gap-3">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text">
            <Upload size={16} /> Import
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-2 rounded-xl bg-nexus-primary px-4 py-2 text-white font-medium">
            <Plus size={18} /> Train New
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Deployed', value: models.filter(m => m.status === 'deployed').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Training', value: models.filter(m => m.status === 'training').length, icon: RefreshCw, color: 'text-blue-400' },
          { label: 'Avg Accuracy', value: `${(models.filter(m => m.accuracy > 0).reduce((s, m) => s + m.accuracy, 0) / Math.max(1, models.filter(m => m.accuracy > 0).length)).toFixed(1)}%`, icon: Target, color: 'text-purple-400' },
          { label: 'Total Requests', value: `${(models.reduce((s, m) => s + m.requests, 0) / 1000).toFixed(0)}K`, icon: Activity, color: 'text-cyan-400' },
          { label: 'Parameters', value: `${(models.reduce((s, m) => s + m.parameters, 0) / 1_000_000).toFixed(0)}M`, icon: Database, color: 'text-amber-400' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="glass rounded-2xl border border-nexus-border/30 p-4">
            <div className="flex items-center gap-3">
              <stat.icon size={18} className={stat.color} />
              <div>
                <p className="text-xl font-bold text-nexus-text">{stat.value}</p>
                <p className="text-xs text-nexus-muted">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search models..." className="w-full rounded-xl bg-nexus-surface border border-nexus-border/30 pl-10 pr-4 py-2 text-sm text-nexus-text focus:outline-none focus:ring-2 focus:ring-nexus-primary/50" />
        </div>
        <div className="flex gap-1">
          {['All', 'Deployed', 'Training', 'Ready', 'Failed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${statusFilter === s ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted hover:text-nexus-text'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Model Grid + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model List */}
        <div className={`space-y-3 ${selectedModel ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
          {filtered.map((model, i) => {
            const sc = statusConfig[model.status];
            return (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setSelectedModel(model); setDetailTab('overview'); }}
                className={`glass rounded-2xl border p-4 cursor-pointer transition-all hover:border-nexus-primary/30 ${selectedModel?.id === model.id ? 'border-nexus-primary/50 bg-nexus-primary/5' : 'border-nexus-border/30'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-nexus-text">{model.name}</h4>
                      <span className="text-[10px] text-nexus-muted font-mono">v{model.version}</span>
                    </div>
                    <p className="text-xs text-nexus-muted mb-2">{model.description}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-nexus-muted">
                  <span>{model.type}</span>
                  <span>{model.framework}</span>
                  {model.accuracy > 0 && <span className="text-green-400">{model.accuracy}%</span>}
                  <span>{model.size}</span>
                  {model.latency > 0 && <span>{model.latency}ms</span>}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedModel && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-2 glass rounded-2xl border border-nexus-border/30 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-nexus-text">{selectedModel.name}</h3>
                  <p className="text-xs text-nexus-muted">{selectedModel.description}</p>
                </div>
                <button onClick={() => setSelectedModel(null)} className="p-1 hover:text-nexus-primary">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-nexus-border/30 mb-6">
                {(['overview', 'metrics', 'config'] as const).map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)} className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 ${detailTab === tab ? 'border-nexus-primary text-nexus-primary' : 'border-transparent text-nexus-muted hover:text-nexus-text'}`}>{tab}</button>
                ))}
              </div>

              {detailTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-nexus-surface rounded-xl p-3"><p className="text-xs text-nexus-muted">Accuracy</p><p className="text-lg font-bold text-nexus-text">{selectedModel.accuracy}%</p></div>
                    <div className="bg-nexus-surface rounded-xl p-3"><p className="text-xs text-nexus-muted">Latency</p><p className="text-lg font-bold text-nexus-text">{selectedModel.latency}ms</p></div>
                    <div className="bg-nexus-surface rounded-xl p-3"><p className="text-xs text-nexus-muted">Size</p><p className="text-lg font-bold text-nexus-text">{selectedModel.size}</p></div>
                    <div className="bg-nexus-surface rounded-xl p-3"><p className="text-xs text-nexus-muted">Requests</p><p className="text-lg font-bold text-nexus-text">{(selectedModel.requests / 1000).toFixed(0)}K</p></div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#2E2E45" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <PolarRadiusAxis tick={false} />
                      <Radar name="Performance" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {detailTab === 'metrics' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-nexus-text mb-3">Training Accuracy</h4>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={selectedModel.metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                        <Line type="monotone" dataKey="accuracy" stroke="#10B981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-nexus-text mb-3">Training Loss</h4>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={selectedModel.metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2E2E45" />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2E2E45', borderRadius: 12, color: '#e2e8f0' }} />
                        <Area type="monotone" dataKey="loss" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {detailTab === 'config' && (
                <div className="space-y-4">
                  {[
                    ['Model Name', selectedModel.name],
                    ['Version', selectedModel.version],
                    ['Framework', selectedModel.framework],
                    ['Type', selectedModel.type],
                    ['Parameters', `${(selectedModel.parameters / 1_000_000).toFixed(1)}M`],
                    ['Endpoint', selectedModel.endpoint],
                    ['Last Trained', selectedModel.lastTrained],
                    ['Tags', selectedModel.tags.join(', ')],
                  ].map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-nexus-border/20">
                      <span className="text-sm text-nexus-muted">{key}</span>
                      <span className="text-sm font-mono text-nexus-text">{val}</span>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-6">
                    <button className="flex items-center gap-2 rounded-xl bg-nexus-primary/10 px-4 py-2 text-sm text-nexus-primary"><Download size={14} /> Export</button>
                    <button className="flex items-center gap-2 rounded-xl bg-nexus-surface px-4 py-2 text-sm text-nexus-muted"><RefreshCw size={14} /> Retrain</button>
                    <button className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-400"><Trash2 size={14} /> Delete</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
