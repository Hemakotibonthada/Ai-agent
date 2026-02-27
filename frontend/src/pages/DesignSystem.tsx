import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Eye, Sliders, Monitor, Moon, Sun, Paintbrush,
  RotateCcw, Check, Copy, Sparkles, Layout, Type, Layers,
  Contrast, Droplets, Grid3x3, Maximize2, ChevronDown,
  Download, Upload, Code2, Search, AlertTriangle, XCircle
} from 'lucide-react';

interface ColorToken {
  name: string;
  variable: string;
  value: string;
  category: string;
}

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  border: string;
  mode: 'dark' | 'light';
}

const presets: ThemePreset[] = [
  { id: 'midnight', name: 'Midnight', description: 'Deep dark theme with blue accents',
    primary: '#6366f1', secondary: '#3b82f6', accent: '#06b6d4',
    background: '#030712', surface: '#111827', text: '#f9fafb', border: '#1f2937', mode: 'dark' },
  { id: 'aurora', name: 'Aurora', description: 'Inspired by northern lights',
    primary: '#10b981', secondary: '#06b6d4', accent: '#8b5cf6',
    background: '#0a0e1a', surface: '#131a2e', text: '#e2e8f0', border: '#1e293b', mode: 'dark' },
  { id: 'sunset', name: 'Sunset', description: 'Warm amber and orange tones',
    primary: '#f59e0b', secondary: '#ef4444', accent: '#f97316',
    background: '#0c0a09', surface: '#1c1917', text: '#fafaf9', border: '#292524', mode: 'dark' },
  { id: 'ocean', name: 'Ocean', description: 'Calm blue ocean palette',
    primary: '#0ea5e9', secondary: '#38bdf8', accent: '#67e8f9',
    background: '#0c1222', surface: '#0f172a', text: '#e2e8f0', border: '#1e293b', mode: 'dark' },
  { id: 'forest', name: 'Forest', description: 'Natural green earth tones',
    primary: '#22c55e', secondary: '#16a34a', accent: '#4ade80',
    background: '#052e16', surface: '#14532d', text: '#f0fdf4', border: '#166534', mode: 'dark' },
  { id: 'rose', name: 'Rose', description: 'Elegant rose and pink',
    primary: '#f43f5e', secondary: '#ec4899', accent: '#fb7185',
    background: '#0f0507', surface: '#1a0a10', text: '#fce7f3', border: '#2a1018', mode: 'dark' },
  { id: 'snow', name: 'Snow', description: 'Clean light theme',
    primary: '#6366f1', secondary: '#3b82f6', accent: '#06b6d4',
    background: '#ffffff', surface: '#f8fafc', text: '#0f172a', border: '#e2e8f0', mode: 'light' },
  { id: 'paper', name: 'Paper', description: 'Warm light academic theme',
    primary: '#d97706', secondary: '#b91c1c', accent: '#0369a1',
    background: '#fffbeb', surface: '#fef3c7', text: '#1c1917', border: '#d6d3d1', mode: 'light' },
];

const fontOptions = [
  { name: 'Inter', value: 'Inter, system-ui, sans-serif', category: 'Sans-serif' },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', category: 'Monospace' },
  { name: 'Fira Code', value: '"Fira Code", monospace', category: 'Monospace' },
  { name: 'DM Sans', value: '"DM Sans", sans-serif', category: 'Sans-serif' },
  { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif', category: 'Sans-serif' },
  { name: 'Source Serif', value: '"Source Serif 4", serif', category: 'Serif' },
];

const borderRadiusOptions = [
  { name: 'None', value: '0px' },
  { name: 'Small', value: '4px' },
  { name: 'Medium', value: '8px' },
  { name: 'Large', value: '12px' },
  { name: 'XL', value: '16px' },
  { name: 'Full', value: '9999px' },
];

export default function DesignSystem() {
  const [activePreset, setActivePreset] = useState<ThemePreset>(presets[0]);
  const [activeTab, setActiveTab] = useState<'presets' | 'colors' | 'typography' | 'components' | 'spacing'>('presets');
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState(fontOptions[0].value);
  const [borderRadius, setBorderRadius] = useState('8px');
  const [glassmorphism, setGlassmorphism] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  const colors: ColorToken[] = useMemo(() => [
    { name: 'Primary', variable: '--color-primary', value: customColors.primary || activePreset.primary, category: 'Brand' },
    { name: 'Secondary', variable: '--color-secondary', value: customColors.secondary || activePreset.secondary, category: 'Brand' },
    { name: 'Accent', variable: '--color-accent', value: customColors.accent || activePreset.accent, category: 'Brand' },
    { name: 'Background', variable: '--color-bg', value: customColors.background || activePreset.background, category: 'Surface' },
    { name: 'Surface', variable: '--color-surface', value: customColors.surface || activePreset.surface, category: 'Surface' },
    { name: 'Text', variable: '--color-text', value: customColors.text || activePreset.text, category: 'Text' },
    { name: 'Border', variable: '--color-border', value: customColors.border || activePreset.border, category: 'Border' },
    { name: 'Success', variable: '--color-success', value: '#10b981', category: 'Semantic' },
    { name: 'Warning', variable: '--color-warning', value: '#f59e0b', category: 'Semantic' },
    { name: 'Error', variable: '--color-error', value: '#ef4444', category: 'Semantic' },
    { name: 'Info', variable: '--color-info', value: '#3b82f6', category: 'Semantic' },
  ], [activePreset, customColors]);

  const handleCopyColor = useCallback((hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 1500);
  }, []);

  const handleColorChange = useCallback((name: string, value: string) => {
    setCustomColors(prev => ({ ...prev, [name.toLowerCase()]: value }));
  }, []);

  const handleResetColors = useCallback(() => {
    setCustomColors({});
  }, []);

  const exportTheme = useCallback(() => {
    const theme = {
      name: activePreset.name,
      mode: activePreset.mode,
      colors: Object.fromEntries(colors.map(c => [c.variable, c.value])),
      typography: { fontFamily, fontSize, fontOptions: fontOptions.find(f => f.value === fontFamily)?.name },
      borderRadius,
      glassmorphism,
      animations,
    };
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `nexus-theme-${activePreset.id}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [activePreset, colors, fontFamily, fontSize, borderRadius, glassmorphism, animations]);

  const tabs = [
    { id: 'presets' as const, label: 'Presets', icon: Palette },
    { id: 'colors' as const, label: 'Colors', icon: Droplets },
    { id: 'typography' as const, label: 'Typography', icon: Type },
    { id: 'components' as const, label: 'Components', icon: Layout },
    { id: 'spacing' as const, label: 'Spacing', icon: Grid3x3 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6 text-white">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Design System
            </h1>
            <p className="text-gray-400 mt-1">Customize themes, colors, typography, and components</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportTheme}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={handleResetColors}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>
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

      {/* Presets Tab */}
      {activeTab === 'presets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {presets.map(preset => (
              <motion.div key={preset.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => { setActivePreset(preset); setCustomColors({}); }}
                className={`relative rounded-xl border cursor-pointer overflow-hidden transition-all ${
                  activePreset.id === preset.id ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-white/10 hover:border-white/20'
                }`}>
                <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary}, ${preset.accent})` }}>
                  {activePreset.id === preset.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-8" style={{
                    background: `linear-gradient(transparent, ${preset.background})` }} />
                </div>
                <div className="p-3" style={{ backgroundColor: preset.surface }}>
                  <div className="font-semibold text-sm" style={{ color: preset.text }}>{preset.name}</div>
                  <div className="text-xs mt-0.5 opacity-60" style={{ color: preset.text }}>{preset.description}</div>
                  <div className="flex gap-1 mt-2">
                    {[preset.primary, preset.secondary, preset.accent, preset.background, preset.surface].map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: activePreset.background }}>
            <div className="p-4 border-b" style={{ borderColor: activePreset.border, backgroundColor: activePreset.surface }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-xs ml-2 opacity-60" style={{ color: activePreset.text }}>Preview — {activePreset.name}</span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <h3 className="text-lg font-bold mb-2" style={{ color: activePreset.text }}>Dashboard Overview</h3>
                  <p className="text-sm opacity-60 mb-4" style={{ color: activePreset.text }}>Welcome back. Here's your daily summary.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Active Users', value: '2,845', color: activePreset.primary },
                      { label: 'API Calls', value: '12.4k', color: activePreset.secondary },
                      { label: 'Uptime', value: '99.98%', color: activePreset.accent },
                    ].map(card => (
                      <div key={card.label} className="rounded-lg p-3" style={{
                        backgroundColor: activePreset.surface,
                        borderLeft: `3px solid ${card.color}`,
                      }}>
                        <div className="text-xs opacity-60" style={{ color: activePreset.text }}>{card.label}</div>
                        <div className="text-xl font-bold mt-1" style={{ color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <button className="w-full py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: activePreset.primary, borderRadius }}>
                    Primary Button
                  </button>
                  <button className="w-full py-2 rounded-lg text-sm font-medium border"
                    style={{ borderColor: activePreset.border, color: activePreset.text, borderRadius }}>
                    Secondary Button
                  </button>
                  <div className="rounded-lg p-3" style={{ backgroundColor: activePreset.surface, border: `1px solid ${activePreset.border}`, borderRadius }}>
                    <div className="text-xs opacity-60" style={{ color: activePreset.text }}>Card Element</div>
                    <div className="text-sm mt-1" style={{ color: activePreset.text }}>Sample content with theme styling</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {['Brand', 'Surface', 'Text', 'Border', 'Semantic'].map(category => {
            const categoryColors = colors.filter(c => c.category === category);
            return (
              <div key={category} className="mb-8">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">{category} Colors</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {categoryColors.map(color => (
                    <div key={color.name} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                      <div className="h-20 relative cursor-pointer group" style={{ backgroundColor: color.value }}
                        onClick={() => handleCopyColor(color.value)}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                          {copiedColor === color.value ? (
                            <Check className="w-5 h-5 text-white" />
                          ) : (
                            <Copy className="w-5 h-5 text-white" />
                          )}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{color.name}</span>
                          <input type="color" value={color.value}
                            onChange={e => handleColorChange(color.name, e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" />
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-1">{color.value}</div>
                        <div className="text-xs text-gray-600 font-mono">{color.variable}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Typography Tab */}
      {activeTab === 'typography' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Font Family</h3>
              <div className="space-y-2">
                {fontOptions.map(font => (
                  <button key={font.name} onClick={() => setFontFamily(font.value)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      fontFamily === font.value ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:bg-white/5'
                    }`}>
                    <span className="text-sm font-medium" style={{ fontFamily: font.value }}>{font.name}</span>
                    <span className="text-xs text-gray-500 ml-2">{font.category}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Font Size: {fontSize}px</h3>
              <input type="range" min="10" max="20" value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-full mb-6" />

              <h3 className="text-sm font-semibold text-gray-300 mb-4">Border Radius</h3>
              <div className="grid grid-cols-3 gap-2">
                {borderRadiusOptions.map(br => (
                  <button key={br.name} onClick={() => setBorderRadius(br.value)}
                    className={`p-2 text-xs rounded-lg border transition-all ${
                      borderRadius === br.value ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:bg-white/5'
                    }`}>
                    <div className="w-8 h-8 bg-purple-500/20 border border-purple-500/30 mx-auto mb-1"
                      style={{ borderRadius: br.value }} />
                    {br.name}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <label className="flex items-center justify-between cursor-pointer" onClick={() => setGlassmorphism(!glassmorphism)}>
                  <span className="text-sm text-gray-300 flex items-center gap-2"><Sparkles className="w-4 h-4" /> Glassmorphism</span>
                  <div className={`w-10 h-5 rounded-full transition-colors ${glassmorphism ? 'bg-purple-500' : 'bg-gray-600'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${glassmorphism ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
                <label className="flex items-center justify-between cursor-pointer" onClick={() => setAnimations(!animations)}>
                  <span className="text-sm text-gray-300 flex items-center gap-2"><Layers className="w-4 h-4" /> Animations</span>
                  <div className={`w-10 h-5 rounded-full transition-colors ${animations ? 'bg-purple-500' : 'bg-gray-600'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${animations ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Type Scale Preview */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Type Scale</h3>
            <div className="space-y-4" style={{ fontFamily }}>
              {[
                { level: 'H1', size: fontSize * 2.5, weight: 800, sample: 'The quick brown fox' },
                { level: 'H2', size: fontSize * 2, weight: 700, sample: 'jumps over the lazy dog' },
                { level: 'H3', size: fontSize * 1.5, weight: 700, sample: 'Pack my box with five dozen liquor jugs' },
                { level: 'H4', size: fontSize * 1.25, weight: 600, sample: 'How vexingly quick daft zebras jump' },
                { level: 'Body', size: fontSize, weight: 400, sample: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.' },
                { level: 'Small', size: fontSize * 0.875, weight: 400, sample: 'Smaller text for captions and secondary content' },
                { level: 'Caption', size: fontSize * 0.75, weight: 400, sample: 'CAPTION TEXT · ALL CAPS · MONOSPACE ALTERNATIVE' },
              ].map(item => (
                <div key={item.level} className="flex items-baseline gap-4 border-b border-white/5 pb-4">
                  <span className="text-xs text-gray-500 w-16 shrink-0 font-mono">{item.level}</span>
                  <span className="text-xs text-gray-600 w-16 shrink-0">{item.size.toFixed(0)}px</span>
                  <span style={{ fontSize: item.size, fontWeight: item.weight }}>{item.sample}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Components Tab */}
      {activeTab === 'components' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Buttons */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Buttons</h3>
              <div className="space-y-3">
                <button className="w-full py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: activePreset.primary, borderRadius }}>Primary</button>
                <button className="w-full py-2 rounded-lg text-sm font-medium border"
                  style={{ borderColor: activePreset.border, color: activePreset.text, borderRadius }}>Outline</button>
                <button className="w-full py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: `${activePreset.primary}20`, color: activePreset.primary, borderRadius }}>Ghost</button>
                <button className="w-full py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400"
                  style={{ borderRadius }}>Destructive</button>
                <button className="w-full py-2 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
                  style={{ backgroundColor: activePreset.surface, color: activePreset.text, borderRadius }}>Disabled</button>
              </div>
            </div>

            {/* Inputs */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Inputs</h3>
              <div className="space-y-3">
                <input type="text" placeholder="Default input" className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-gray-500"
                  style={{ borderRadius, fontSize }} />
                <input type="text" value="Filled input" readOnly className="w-full px-3 py-2 bg-white/5 border text-white"
                  style={{ borderRadius, borderColor: activePreset.primary, fontSize }} />
                <div className="relative">
                  <input type="text" placeholder="With icon" className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 text-white placeholder:text-gray-500"
                    style={{ borderRadius, fontSize }} />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                </div>
                <select className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white"
                  style={{ borderRadius, fontSize }}>
                  <option>Select option</option>
                  <option>Option A</option>
                  <option>Option B</option>
                </select>
              </div>
            </div>

            {/* Cards */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Cards</h3>
              <div className="space-y-3">
                <div className="p-4 border" style={{
                  backgroundColor: glassmorphism ? 'rgba(255,255,255,0.03)' : activePreset.surface,
                  borderColor: activePreset.border,
                  borderRadius,
                  backdropFilter: glassmorphism ? 'blur(12px)' : 'none',
                }}>
                  <div className="text-sm font-medium" style={{ color: activePreset.text }}>Card Title</div>
                  <div className="text-xs mt-1 opacity-60" style={{ color: activePreset.text }}>Card description text</div>
                </div>
                <div className="p-4 border-l-4" style={{
                  backgroundColor: activePreset.surface,
                  borderColor: activePreset.primary,
                  borderRadius,
                }}>
                  <div className="text-sm font-medium" style={{ color: activePreset.primary }}>Accent Card</div>
                  <div className="text-xs mt-1 opacity-60" style={{ color: activePreset.text }}>With left border</div>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Badges & Tags</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Active', color: '#10b981' },
                  { label: 'Warning', color: '#f59e0b' },
                  { label: 'Error', color: '#ef4444' },
                  { label: 'Info', color: '#3b82f6' },
                  { label: 'Primary', color: activePreset.primary },
                  { label: 'v2.1.0', color: '#8b5cf6' },
                  { label: 'Beta', color: '#ec4899' },
                ].map(badge => (
                  <span key={badge.label} className="px-2.5 py-1 text-xs font-medium" style={{
                    backgroundColor: `${badge.color}20`,
                    color: badge.color,
                    borderRadius,
                  }}>{badge.label}</span>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Alerts</h3>
              <div className="space-y-3">
                {[
                  { type: 'Success', color: '#10b981', icon: Check },
                  { type: 'Warning', color: '#f59e0b', icon: AlertTriangle },
                  { type: 'Error', color: '#ef4444', icon: XCircle },
                ].map(alert => {
                  const Icon = alert.icon;
                  return (
                    <div key={alert.type} className="flex items-center gap-2 p-3 text-xs" style={{
                      backgroundColor: `${alert.color}10`,
                      border: `1px solid ${alert.color}30`,
                      borderRadius,
                      color: alert.color,
                    }}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {alert.type} alert message
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Progress</h3>
              <div className="space-y-4">
                {[30, 60, 85].map(pct => (
                  <div key={pct}>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-white/5 overflow-hidden" style={{ borderRadius }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full"
                        style={{ backgroundColor: pct > 80 ? '#10b981' : pct > 50 ? activePreset.primary : activePreset.secondary, borderRadius }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CSS Output */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Code2 className="w-4 h-4" /> CSS Variables</h3>
              <button onClick={() => navigator.clipboard.writeText(
                `:root {\n${colors.map(c => `  ${c.variable}: ${c.value};`).join('\n')}\n  --font-family: ${fontFamily};\n  --font-size: ${fontSize}px;\n  --radius: ${borderRadius};\n}`
              )} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="text-xs font-mono text-gray-400 bg-black/20 rounded-lg p-4 overflow-x-auto">
              {`:root {\n${colors.map(c => `  ${c.variable}: ${c.value};`).join('\n')}\n  --font-family: ${fontFamily};\n  --font-size: ${fontSize}px;\n  --radius: ${borderRadius};\n}`}
            </pre>
          </div>
        </motion.div>
      )}

      {/* Spacing Tab */}
      {activeTab === 'spacing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-6">Spacing Scale</h3>
            <div className="space-y-3">
              {[
                { name: 'xs', value: 4 }, { name: 'sm', value: 8 }, { name: 'md', value: 16 },
                { name: 'lg', value: 24 }, { name: 'xl', value: 32 }, { name: '2xl', value: 48 },
                { name: '3xl', value: 64 }, { name: '4xl', value: 96 },
              ].map(space => (
                <div key={space.name} className="flex items-center gap-4">
                  <span className="text-xs text-gray-500 w-8 font-mono">{space.name}</span>
                  <span className="text-xs text-gray-600 w-12">{space.value}px</span>
                  <div className="h-4 rounded" style={{
                    width: space.value * 2,
                    backgroundColor: activePreset.primary,
                    opacity: 0.6,
                    borderRadius,
                  }} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-6">Grid System</h3>
            <div className="space-y-4">
              {[12, 6, 4, 3, 2].map(cols => (
                <div key={cols}>
                  <div className="text-xs text-gray-500 mb-1">{cols} columns</div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                    {Array.from({ length: cols }, (_, i) => (
                      <div key={i} className="h-8 flex items-center justify-center text-xs text-gray-400" style={{
                        backgroundColor: `${activePreset.primary}15`,
                        border: `1px solid ${activePreset.primary}30`,
                        borderRadius,
                      }}>{i + 1}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
