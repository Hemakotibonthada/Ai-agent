/* ===================================================================
   Nexus AI OS — Theme Editor
   Fully integrated with the global useTheme system.
   Selecting a preset applies it globally in real-time.
   =================================================================== */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Moon, Sun, Eye, Check,
  Download, Copy, Sliders,
  Type, SquareEqual as Rounded, Sparkles,
  Save, RotateCcw,
} from 'lucide-react';
import { useTheme, THEMES, type ThemeColors } from '@/hooks/useTheme';

/* ------------------------------------------------------------------ */
/*  Helpers: convert between hex and space-separated RGB               */
/* ------------------------------------------------------------------ */
function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.split(' ').map(Number);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '0 0 0';
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

/* ------------------------------------------------------------------ */
/*  Local UI config (not part of the global theme)                     */
/* ------------------------------------------------------------------ */
interface UIConfig {
  radius: string;
  fontFamily: string;
  fontSize: string;
  animation: 'none' | 'subtle' | 'full';
  glassEnabled: boolean;
}

const fontOptions = ['Inter', 'JetBrains Mono', 'Fira Code', 'Space Grotesk', 'IBM Plex Sans', 'DM Sans'];
const radiusOptions = ['none', 'sm', 'md', 'lg', 'xl', '2xl', 'full'];
const fontSizeOptions = ['12px', '13px', '14px', '15px', '16px'];

/* All CSS custom property keys managed by the theme system */
const COLOR_KEYS: (keyof ThemeColors)[] = [
  'surface', 'bg', 'card', 'border', 'text', 'muted',
  'primary', 'secondary', 'accent', 'success', 'warning', 'error',
];

/* Friendly labels / descriptions for each color key */
const COLOR_META: Record<keyof ThemeColors, { label: string; desc: string }> = {
  primary:   { label: 'Primary',    desc: 'Main brand color for buttons and links' },
  secondary: { label: 'Secondary',  desc: 'Supporting brand color' },
  accent:    { label: 'Accent',     desc: 'Highlight and call-to-action color' },
  bg:        { label: 'Background', desc: 'Page background' },
  surface:   { label: 'Surface',    desc: 'Elevated surface areas' },
  card:      { label: 'Card',       desc: 'Card and panel backgrounds' },
  text:      { label: 'Text',       desc: 'Primary text color' },
  muted:     { label: 'Muted',      desc: 'Secondary / placeholder text' },
  border:    { label: 'Border',     desc: 'Border and divider color' },
  success:   { label: 'Success',    desc: 'Success state color' },
  warning:   { label: 'Warning',    desc: 'Warning state color' },
  error:     { label: 'Error',      desc: 'Error / danger state color' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function ThemeEditor() {
  const { theme: activeThemeId, themeDef, setTheme, isDark } = useTheme();

  const [tab, setTab] = useState<'presets' | 'colors' | 'typography' | 'effects'>('presets');
  const [showExport, setShowExport] = useState(false);

  /* Custom overrides — start from the current theme's colors */
  const [customColors, setCustomColors] = useState<Record<keyof ThemeColors, string> | null>(null);

  /* UI preferences (local to this page) */
  const [uiConfig, setUIConfig] = useState<UIConfig>({
    radius: 'xl',
    fontFamily: 'Inter',
    fontSize: '14px',
    animation: 'full',
    glassEnabled: true,
  });

  /* ---- Derived: the "live" color set (theme colors or custom overrides) ---- */
  const liveColors: Record<keyof ThemeColors, string> = useMemo(() => {
    const base: Record<string, string> = {};
    COLOR_KEYS.forEach((k) => {
      base[k] = customColors ? customColors[k] : themeDef.colors[k];
    });
    return base as Record<keyof ThemeColors, string>;
  }, [customColors, themeDef]);

  /* ---- Apply a global theme preset ---- */
  const applyPreset = useCallback(
    (id: string) => {
      setCustomColors(null); // reset custom overrides
      setTheme(id); // triggers useTheme → applies CSS vars globally
    },
    [setTheme],
  );

  /* ---- Update a single custom color and apply it live ---- */
  const updateColor = useCallback(
    (key: keyof ThemeColors, hexValue: string) => {
      const rgbValue = hexToRgb(hexValue);
      // Build new custom color map
      const newColors = { ...(customColors ?? { ...themeDef.colors }), [key]: rgbValue };
      setCustomColors(newColors as Record<keyof ThemeColors, string>);
      // Apply immediately to the document
      document.documentElement.style.setProperty(`--nexus-${key}`, rgbValue);
    },
    [customColors, themeDef],
  );

  /* ---- CSS export snippet ---- */
  const cssVars = useMemo(() => {
    const lines = COLOR_KEYS.map((k) => `  --nexus-${k}: ${liveColors[k]};`);
    return `:root {\n${lines.join('\n')}\n}`;
  }, [liveColors]);

  /* ---- Preview hex colors for the live preview panel ---- */
  const previewHex = useMemo(() => {
    const out: Record<string, string> = {};
    COLOR_KEYS.forEach((k) => {
      out[k] = rgbToHex(liveColors[k]);
    });
    return out;
  }, [liveColors]);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-nexus-bg p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Palette className="text-nexus-primary" /> Theme Editor
          </h1>
          <p className="text-nexus-muted mt-1">Customize the look and feel of your Nexus AI interface</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowExport(!showExport)}
            className="flex items-center gap-2 rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-2 text-sm text-nexus-muted hover:text-nexus-text"
          >
            <Download size={16} /> Export
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-nexus-primary hover:opacity-90 px-4 py-2 text-sm text-white">
            <Save size={16} /> Save Theme
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Editor Panel ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Bar */}
          <div className="flex gap-1 bg-nexus-surface rounded-xl p-1">
            {(['presets', 'colors', 'typography', 'effects'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2 text-sm rounded-lg capitalize transition-colors ${
                  tab === t ? 'bg-nexus-primary text-white' : 'text-nexus-muted hover:text-nexus-text'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ═══════════ Presets Tab ═══════════ */}
          {tab === 'presets' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {THEMES.map((t, i) => {
                const isActive = activeThemeId === t.id && !customColors;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => applyPreset(t.id)}
                    className={`rounded-2xl border p-4 cursor-pointer transition-all hover:border-nexus-primary/40 ${
                      isActive
                        ? 'ring-2 ring-nexus-primary/50 border-nexus-primary/30 scale-[1.02]'
                        : 'border-nexus-border/30 bg-nexus-card/40'
                    }`}
                  >
                    {/* Color preview dots */}
                    <div className="flex gap-1 mb-3">
                      {[t.preview.primary, t.preview.secondary, t.preview.accent, t.preview.bg, t.preview.card].map(
                        (c, j) => (
                          <div key={j} className="h-6 flex-1 rounded-md" style={{ background: c }} />
                        ),
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-nexus-text">{t.name}</span>
                      {isActive && <Check size={14} className="text-nexus-primary" />}
                    </div>
                    <span className="text-[10px] text-nexus-muted capitalize">{t.mode} Mode</span>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* ═══════════ Colors Tab ═══════════ */}
          {tab === 'colors' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {COLOR_KEYS.map((key) => {
                const hex = rgbToHex(liveColors[key]);
                const meta = COLOR_META[key];
                return (
                  <div key={key} className="flex items-center gap-4 p-4 rounded-xl bg-nexus-card/50 border border-nexus-border/30">
                    <div className="h-10 w-10 rounded-xl border border-nexus-border/30 cursor-pointer overflow-hidden relative">
                      <input
                        type="color"
                        value={hex}
                        onChange={(e) => updateColor(key, e.target.value)}
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      />
                      <div className="h-full w-full" style={{ background: hex }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-nexus-text">{meta.label}</p>
                      <p className="text-xs text-nexus-muted">{meta.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-nexus-muted">{hex}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(hex)}
                        className="p-1 hover:text-nexus-primary text-nexus-muted"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Quick palette */}
              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-4">
                <h4 className="text-sm font-medium text-nexus-text mb-3">Quick Palette</h4>
                <div className="flex gap-2 flex-wrap">
                  {[
                    '#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1',
                    '#14B8A6', '#F97316', '#A855F7', '#84CC16', '#0EA5E9', '#D946EF', '#F43F5E', '#22C55E',
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateColor('primary', color)}
                      className="h-8 w-8 rounded-lg border border-white/10 hover:scale-110 transition-transform"
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>

              {customColors && (
                <button
                  onClick={() => {
                    setCustomColors(null);
                    // Re-apply the base theme
                    const root = document.documentElement;
                    COLOR_KEYS.forEach((k) => root.style.setProperty(`--nexus-${k}`, themeDef.colors[k]));
                  }}
                  className="flex items-center gap-2 text-sm text-nexus-muted hover:text-nexus-text"
                >
                  <RotateCcw size={14} /> Reset to theme defaults
                </button>
              )}
            </motion.div>
          )}

          {/* ═══════════ Typography Tab ═══════════ */}
          {tab === 'typography' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2">
                  <Type size={16} /> Font Family
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {fontOptions.map((font) => (
                    <button
                      key={font}
                      onClick={() => setUIConfig((p) => ({ ...p, fontFamily: font }))}
                      className={`p-3 rounded-xl text-left transition-colors ${
                        uiConfig.fontFamily === font
                          ? 'bg-nexus-primary/10 border border-nexus-primary/30'
                          : 'bg-nexus-surface border border-nexus-border/30 hover:border-nexus-primary/20'
                      }`}
                    >
                      <span className="text-sm text-nexus-text" style={{ fontFamily: font }}>
                        {font}
                      </span>
                      <p className="text-xs text-nexus-muted mt-1" style={{ fontFamily: font }}>
                        The quick brown fox
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4">Base Font Size</h4>
                <div className="flex gap-2">
                  {fontSizeOptions.map((size) => (
                    <button
                      key={size}
                      onClick={() => setUIConfig((p) => ({ ...p, fontSize: size }))}
                      className={`px-4 py-2 rounded-xl text-sm ${
                        uiConfig.fontSize === size ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2">
                  <Rounded size={16} /> Border Radius
                </h4>
                <div className="flex gap-2">
                  {radiusOptions.map((r) => (
                    <button
                      key={r}
                      onClick={() => setUIConfig((p) => ({ ...p, radius: r }))}
                      className={`px-3 py-2 rounded-xl text-xs ${
                        uiConfig.radius === r ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════════ Effects Tab ═══════════ */}
          {tab === 'effects' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2">
                  <Sparkles size={16} /> Animation Level
                </h4>
                <div className="flex gap-2">
                  {(['none', 'subtle', 'full'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setUIConfig((p) => ({ ...p, animation: level }))}
                      className={`flex-1 px-4 py-3 rounded-xl text-sm capitalize ${
                        uiConfig.animation === level ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'
                      }`}
                    >
                      {level === 'none' && '🚫 None'}
                      {level === 'subtle' && '✨ Subtle'}
                      {level === 'full' && '🎆 Full'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-nexus-text">Glassmorphism</p>
                    <p className="text-xs text-nexus-muted">Frosted glass effect on cards and panels</p>
                  </div>
                  <button
                    onClick={() => setUIConfig((p) => ({ ...p, glassEnabled: !p.glassEnabled }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      uiConfig.glassEnabled ? 'bg-nexus-primary' : 'bg-nexus-border'
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        uiConfig.glassEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-nexus-card/50 border border-nexus-border/30 p-6">
                <h4 className="text-sm font-medium text-nexus-text mb-4 flex items-center gap-2">
                  {isDark ? <Moon size={16} /> : <Sun size={16} />} Color Mode
                </h4>
                <p className="text-xs text-nexus-muted mb-3">
                  Switch between dark and light by selecting a preset on the Presets tab. Light presets:
                  Daylight, Rosé.
                </p>
                <div className="flex gap-2">
                  <div
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm ${
                      isDark ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'
                    }`}
                  >
                    <Moon size={16} /> Dark
                  </div>
                  <div
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm ${
                      !isDark ? 'bg-nexus-primary text-white' : 'bg-nexus-surface text-nexus-muted'
                    }`}
                  >
                    <Sun size={16} /> Light
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Preview Panel ── */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-nexus-card/50 border border-nexus-border/30 p-6"
          >
            <h3 className="font-bold text-nexus-text mb-4 flex items-center gap-2">
              <Eye size={16} /> Live Preview
            </h3>

            {/* Mini preview */}
            <div
              className="rounded-xl overflow-hidden border border-nexus-border/30"
              style={{ background: previewHex.bg }}
            >
              {/* Mini nav */}
              <div
                className="h-8 flex items-center gap-2 px-3"
                style={{ background: previewHex.surface, borderBottom: `1px solid ${previewHex.border}` }}
              >
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-400" />
                  <div className="h-2 w-2 rounded-full bg-yellow-400" />
                  <div className="h-2 w-2 rounded-full bg-green-400" />
                </div>
                <span className="text-[8px] ml-2" style={{ color: previewHex.muted }}>
                  Nexus AI
                </span>
              </div>

              <div className="p-3 space-y-2">
                <div>
                  <span className="text-xs font-bold" style={{ color: previewHex.text }}>
                    Dashboard
                  </span>
                  <p className="text-[8px]" style={{ color: previewHex.muted }}>
                    Welcome back, Admin
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {['CPU: 34%', 'Memory: 67%', 'Agents: 12', 'Tasks: 48'].map((label) => (
                    <div
                      key={label}
                      className="p-1.5 rounded-md"
                      style={{ background: previewHex.card, border: `1px solid ${previewHex.border}` }}
                    >
                      <span className="text-[7px] block" style={{ color: previewHex.muted }}>
                        {label.split(':')[0]}
                      </span>
                      <span className="text-[9px] font-bold" style={{ color: previewHex.text }}>
                        {label.split(':')[1]}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  className="w-full py-1 rounded-md text-[8px] text-white"
                  style={{ background: previewHex.primary }}
                >
                  View Details
                </button>

                <div
                  className="flex items-center gap-1 p-1.5 rounded-md"
                  style={{ background: `${previewHex.accent}15` }}
                >
                  <div className="h-2 w-2 rounded-full" style={{ background: previewHex.accent }} />
                  <span className="text-[7px]" style={{ color: previewHex.accent }}>
                    System Online
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Current Theme Info */}
          <div className="rounded-2xl bg-nexus-card/50 border border-nexus-border/30 p-6">
            <h3 className="font-bold text-nexus-text mb-4">Current Theme</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Name</span>
                <span className="text-nexus-text">{customColors ? 'Custom' : themeDef.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Mode</span>
                <span className="text-nexus-text capitalize">{isDark ? 'Dark' : 'Light'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Font</span>
                <span className="text-nexus-text">{uiConfig.fontFamily}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Font Size</span>
                <span className="text-nexus-text">{uiConfig.fontSize}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Radius</span>
                <span className="text-nexus-text">{uiConfig.radius}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Animations</span>
                <span className="text-nexus-text capitalize">{uiConfig.animation}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-nexus-muted">Glass</span>
                <span className="text-nexus-text">{uiConfig.glassEnabled ? 'On' : 'Off'}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-1">
              {COLOR_KEYS.slice(0, 8).map((k) => (
                <div
                  key={k}
                  className="h-5 w-5 rounded-md border border-white/10"
                  style={{ background: previewHex[k] }}
                />
              ))}
            </div>
          </div>

          {/* Export CSS */}
          <AnimatePresence>
            {showExport && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl bg-nexus-card/50 border border-nexus-border/30 p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-nexus-text text-sm">CSS Variables</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(cssVars)}
                    className="text-xs text-nexus-primary flex items-center gap-1"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                <pre className="text-[10px] text-nexus-muted bg-nexus-surface rounded-xl p-3 overflow-x-auto font-mono">
                  {cssVars}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset */}
          <button
            onClick={() => applyPreset('midnight')}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-nexus-surface border border-nexus-border/30 px-4 py-3 text-sm text-nexus-muted hover:text-nexus-text"
          >
            <RotateCcw size={14} /> Reset to Default
          </button>
        </div>
      </div>
    </motion.div>
  );
}
