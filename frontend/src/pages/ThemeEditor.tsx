import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Moon, Sun, Monitor, Eye, Check,
  RefreshCw, Download, Upload, Copy, Sliders,
  Type, Layout, SquareEqual as Rounded, Zap,
  Droplets, Sparkles, PaintBucket, Paintbrush,
  ChevronRight, Save, RotateCcw,
} from 'lucide-react';

interface ThemeConfig {
  name: string;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  mode: 'dark' | 'light';
  radius: string;
  fontFamily: string;
  fontSize: string;
  animation: 'none' | 'subtle' | 'full';
  glassEnabled: boolean;
  particlesEnabled: boolean;
}

const presetThemes: { name: string; config: Partial<ThemeConfig> }[] = [
  { name: 'Nexus Default', config: { primary: '#8B5CF6', accent: '#06B6D4', background: '#0a0a1a', surface: '#1a1a2e', text: '#e2e8f0', muted: '#64748b', border: '#2E2E45', mode: 'dark' } },
  { name: 'Midnight Blue', config: { primary: '#3B82F6', accent: '#60A5FA', background: '#0c1222', surface: '#172038', text: '#e0e7ff', muted: '#6b7db3', border: '#243557', mode: 'dark' } },
  { name: 'Emerald Night', config: { primary: '#10B981', accent: '#34D399', background: '#0a150e', surface: '#142820', text: '#d1fae5', muted: '#6b9b86', border: '#1f4032', mode: 'dark' } },
  { name: 'Rose Gold', config: { primary: '#F43F5E', accent: '#FB7185', background: '#150a0d', surface: '#2e1a1f', text: '#fce7f3', muted: '#9b6b78', border: '#45242c', mode: 'dark' } },
  { name: 'Amber Glow', config: { primary: '#F59E0B', accent: '#FBBF24', background: '#15120a', surface: '#2e2810', text: '#fef3c7', muted: '#a39255', border: '#453a14', mode: 'dark' } },
  { name: 'Clean Light', config: { primary: '#6366F1', accent: '#818CF8', background: '#f8fafc', surface: '#ffffff', text: '#1e293b', muted: '#94a3b8', border: '#e2e8f0', mode: 'light' } },
  { name: 'Warm Light', config: { primary: '#DC2626', accent: '#F87171', background: '#fef7ed', surface: '#ffffff', text: '#292524', muted: '#a8a29e', border: '#e7e5e4', mode: 'light' } },
  { name: 'Ocean Light', config: { primary: '#0891B2', accent: '#22D3EE', background: '#f0f9ff', surface: '#ffffff', text: '#164e63', muted: '#67a3b3', border: '#cffafe', mode: 'light' } },
];

const fontOptions = ['Inter', 'JetBrains Mono', 'Fira Code', 'Space Grotesk', 'IBM Plex Sans', 'DM Sans'];
const radiusOptions = ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'];
const fontSizeOptions = ['12px', '13px', '14px', '15px', '16px'];

export default function ThemeEditor() {
  const [theme, setTheme] = useState<ThemeConfig>({
    name: 'Nexus Default',
    primary: '#8B5CF6',
    accent: '#06B6D4',
    background: '#0a0a1a',
    surface: '#1a1a2e',
    text: '#e2e8f0',
    muted: '#64748b',
    border: '#2E2E45',
    mode: 'dark',
    radius: 'xl',
    fontFamily: 'Inter',
    fontSize: '14px',
    animation: 'full',
    glassEnabled: true,
    particlesEnabled: true,
  });

  const [tab, setTab] = useState<'presets' | 'colors' | 'typography' | 'effects'>('presets');
  const [showExport, setShowExport] = useState(false);

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setTheme(prev => ({ ...prev, ...preset.config, name: preset.name }));
  };

  const updateColor = useCallback((key: keyof ThemeConfig, value: string) => {
    setTheme(prev => ({ ...prev, [key]: value, name: 'Custom' }));
  }, []);

  const cssVars = useMemo(() => {
    return `
:root {
  --nexus-primary: ${theme.primary};
  --nexus-accent: ${theme.accent};
  --nexus-bg: ${theme.background};
  --nexus-surface: ${theme.surface};
  --nexus-text: ${theme.text};
  --nexus-muted: ${theme.muted};
  --nexus-border: ${theme.border};
  --font-family: '${theme.fontFamily}', sans-serif;
  --font-size: ${theme.fontSize};
  --radius: var(--radius-${theme.radius});
}`.trim();
  }, [theme]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3"><Palette className="text-nexus-primary" /> Theme Editor</h1>
          <p className="text-nexus-muted mt-1">Customize the look and feel of your Nexus AI interface</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowExport(!showExport)} className="flex items-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"><Download size={16} /> Export</button>
          <button className="flex items-center gap-2 rounded-xl bg-nexus-primary hover:bg-nexus-primary/90 px-4 py-2 text-sm text-white"><Save size={16} /> Save Theme</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Bar */}
          <div className="flex gap-1 bg-nexus-surface rounded-xl p-1">
            {(['presets', 'colors', 'typography', 'effects'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 px-4 py-2 text-sm rounded-lg capitalize transition-colors ${tab === t ? 'bg-nexus-primary text-white' : 'text-nexus-muted hover:text-nexus-text'}`}>{t}</button>
            ))}
          </div>

          {/* Presets Tab */}
          {tab === 'presets' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {presetThemes.map((preset, i) => {
                const isActive = theme.name === preset.name;
                return (
                  <motion.div
                    key={preset.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => applyPreset(preset)}
                    className={`glass rounded-2xl border p-4 cursor-pointer transition-all hover:border-nexus-primary/30 ${isActive ? 'ring-2 ring-nexus-primary/50 border-nexus-primary/30' : 'border-nexus-border/30'}`}
                  >
                    {/* Color preview */}
                    <div className="flex gap-1 mb-3">
                      {[preset.config.primary!, preset.config.accent!, preset.config.background!, preset.config.surface!].map((c, j) => (
                        <div key={j} className="h-6 flex-1 rounded-md" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-nexus-text">{preset.name}</span>
                      {isActive && <Check size={14} className="text-nexus-primary" />}
                    </div>
                    <span className="text-[10px] text-nexus-muted capitalize">{preset.config.mode} mode</span>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Colors Tab */}
          {tab === 'colors' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {[
                { key: 'primary', label: 'Primary', desc: 'Main brand color for buttons, links, accents' },
                { key: 'accent', label: 'Accent', desc: 'Secondary accent color for highlights' },
                { key: 'background', label: 'Background', desc: 'Page background color' },
                { key: 'surface', label: 'Surface', desc: 'Card and panel backgrounds' },
                { key: 'text', label: 'Text', desc: 'Primary text color' },
                { key: 'muted', label: 'Muted', desc: 'Secondary and placeholder text' },
                { key: 'border', label: 'Border', desc: 'Border and divider color' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center gap-4 p-4 glass rounded-xl border border-nexus-border/30">
                  <div className="h-10 w-10 rounded-xl border border-nexus-border/30 cursor-pointer overflow-hidden relative">
                    <input type="color" value={(theme as any)[key]} onChange={e => updateColor(key as keyof ThemeConfig, e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                    <div className="h-full w-full" style={{ background: (theme as any)[key] }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-nexus-text">{label}</p>
                    <p className="text-xs text-nexus-muted">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-nexus-muted">{(theme as any)[key]}</span>
                    <button onClick={() => navigator.clipboard.writeText((theme as any)[key])} className="p-1 hover:text-nexus-primary text-nexus-muted"><Copy size={12} /></button>
                  </div>
                </div>
              ))}
              {/* Quick palette */}
              <div className="glass rounded-xl border border-nexus-border/30 p-4">
                <h4 className="text-sm font-medium text-nexus-text mb-3">Quick Palette</h4>
                <div className="flex gap-2 flex-wrap">
                  {['#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#A855F7', '#84CC16', '#0EA5E9', '#D946EF', '#F43F5E', '#22C55E'].map(color => (
                    <button key={color} onClick={() => updateColor('primary', color)} className="h-8 w-8 rounded-lg border border-white/10 hover:scale-110 transition-transform" style={{ background: color }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Typography Tab */}
          {tab === 'typography' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="glass rounded-xl border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2"><Type size={16} /> Font Family</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fontOptions.map(font => (
                    <button key={font} onClick={() => setTheme(prev => ({ ...prev, fontFamily: font }))} className={`p-3 rounded-xl text-left transition-colors ${theme.fontFamily === font ? 'bg-nexus-primary/10 border border-nexus-primary/30' : 'bg-nexus-surface border border-nexus-border/30 hover:border-nexus-primary/20'}`}>
                      <span className="text-sm text-nexus-text" style={{ fontFamily: font }}>{font}</span>
                      <p className="text-xs text-nexus-muted mt-1" style={{ fontFamily: font }}>The quick brown fox</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4">Base Font Size</h4>
                <div className="flex gap-2">
                  {fontSizeOptions.map(size => (
                    <button key={size} onClick={() => setTheme(prev => ({ ...prev, fontSize: size }))} className={`px-4 py-2 rounded-xl text-sm ${theme.fontSize === size ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>{size}</button>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2"><Rounded size={16} /> Border Radius</h4>
                <div className="flex gap-2">
                  {radiusOptions.map(r => (
                    <button key={r} onClick={() => setTheme(prev => ({ ...prev, radius: r }))} className={`px-3 py-2 rounded-xl text-xs ${theme.radius === r ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>{r}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Effects Tab */}
          {tab === 'effects' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="glass rounded-xl border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2"><Sparkles size={16} /> Animation Level</h4>
                <div className="flex gap-2">
                  {(['none', 'subtle', 'full'] as const).map(level => (
                    <button key={level} onClick={() => setTheme(prev => ({ ...prev, animation: level }))} className={`flex-1 px-4 py-3 rounded-xl text-sm capitalize ${theme.animation === level ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}>
                      {level === 'none' && '🚫 None'}
                      {level === 'subtle' && '✨ Subtle'}
                      {level === 'full' && '🎆 Full'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl border border-nexus-border/30 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-nexus-text">Glassmorphism</p>
                    <p className="text-xs text-nexus-muted">Frosted glass effect on cards and panels</p>
                  </div>
                  <button onClick={() => setTheme(prev => ({ ...prev, glassEnabled: !prev.glassEnabled }))} className={`w-12 h-6 rounded-full transition-colors ${theme.glassEnabled ? 'bg-nexus-primary' : 'bg-nexus-surface'}`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${theme.glassEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-nexus-text">Particle Background</p>
                    <p className="text-xs text-nexus-muted">Animated floating particles in the background</p>
                  </div>
                  <button onClick={() => setTheme(prev => ({ ...prev, particlesEnabled: !prev.particlesEnabled }))} className={`w-12 h-6 rounded-full transition-colors ${theme.particlesEnabled ? 'bg-nexus-primary' : 'bg-nexus-surface'}`}>
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${theme.particlesEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="glass rounded-xl border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2">{theme.mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />} Color Mode</h4>
                <div className="flex gap-2">
                  {[
                    { mode: 'dark' as const, icon: Moon, label: 'Dark' },
                    { mode: 'light' as const, icon: Sun, label: 'Light' },
                  ].map(({ mode, icon: Icon, label }) => (
                    <button key={mode} onClick={() => setTheme(prev => ({ ...prev, mode }))} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm ${theme.mode === mode ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'}`}><Icon size={16} /> {label}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
            <h3 className="font-bold text-nexus-text mb-4 flex items-center gap-2"><Eye size={16} /> Live Preview</h3>

            {/* Mini preview of theme */}
            <div className="rounded-xl overflow-hidden border border-nexus-border/30" style={{ background: theme.background }}>
              {/* Mini nav */}
              <div className="h-8 flex items-center gap-2 px-3" style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}` }}>
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <div className="h-2 w-2 rounded-full bg-yellow-400" />
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                </div>
                <span className="text-[8px] ml-2" style={{ color: theme.muted }}>Nexus AI</span>
              </div>

              <div className="p-3 space-y-2">
                {/* Mini header */}
                <div>
                  <span className="text-xs font-bold" style={{ color: theme.text }}>Dashboard</span>
                  <p className="text-[8px]" style={{ color: theme.muted }}>Welcome back, Admin</p>
                </div>

                {/* Mini cards */}
                <div className="grid grid-cols-2 gap-1.5">
                  {['CPU: 34%', 'Memory: 67%', 'Agents: 12', 'Tasks: 48'].map(label => (
                    <div key={label} className="p-1.5 rounded-md" style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                      <span className="text-[7px] block" style={{ color: theme.muted }}>{label.split(':')[0]}</span>
                      <span className="text-[9px] font-bold" style={{ color: theme.text }}>{label.split(':')[1]}</span>
                    </div>
                  ))}
                </div>

                {/* Mini button */}
                <button className="w-full py-1 rounded-md text-[8px] text-white" style={{ background: theme.primary }}>View Details</button>

                {/* Mini accent element */}
                <div className="flex items-center gap-1 p-1.5 rounded-md" style={{ background: `${theme.accent}15` }}>
                  <div className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
                  <span className="text-[7px]" style={{ color: theme.accent }}>System Online</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Current Theme Info */}
          <div className="glass rounded-2xl border border-nexus-border/30 p-6">
            <h3 className="font-bold text-nexus-text mb-4">Current Theme</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Name</span><span className="text-nexus-text">{theme.name}</span></div>
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Mode</span><span className="text-nexus-text capitalize">{theme.mode}</span></div>
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Font</span><span className="text-nexus-text">{theme.fontFamily}</span></div>
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Font Size</span><span className="text-nexus-text">{theme.fontSize}</span></div>
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Radius</span><span className="text-nexus-text">{theme.radius}</span></div>
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Animations</span><span className="text-nexus-text capitalize">{theme.animation}</span></div>
              <div className="flex justify-between text-xs"><span className="text-nexus-muted">Glass</span><span className="text-nexus-text">{theme.glassEnabled ? 'On' : 'Off'}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <div className="flex gap-1">
                {[theme.primary, theme.accent, theme.background, theme.surface, theme.text, theme.muted].map((c, i) => (
                  <div key={i} className="h-5 w-5 rounded-md border border-white/10" style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* Export CSS */}
          <AnimatePresence>
            {showExport && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="glass rounded-2xl border border-nexus-border/30 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-nexus-text text-sm">CSS Variables</h3>
                  <button onClick={() => navigator.clipboard.writeText(cssVars)} className="text-xs text-nexus-primary flex items-center gap-1"><Copy size={12} /> Copy</button>
                </div>
                <pre className="text-[10px] text-nexus-muted bg-nexus-surface rounded-xl p-3 overflow-x-auto font-mono">{cssVars}</pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset */}
          <button onClick={() => applyPreset(presetThemes[0])} className="flex items-center justify-center gap-2 w-full rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-3 text-sm text-nexus-muted hover:text-nexus-text">
            <RotateCcw size={14} /> Reset to Default
          </button>
        </div>
      </div>
    </motion.div>
  );
}
