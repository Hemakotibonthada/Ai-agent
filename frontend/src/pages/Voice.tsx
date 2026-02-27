/* ===================================================================
   Nexus AI OS — Voice Page
   Voice assistant interface with waveform, microphone, and voice controls
   =================================================================== */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Waves,
  Radio,
  Zap,
  MessageSquare,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Switch from '@/components/ui/Switch';
import Slider from '@/components/ui/Slider';
import StatusIndicator from '@/components/shared/StatusIndicator';
import useStore from '@/lib/store';
import { voiceApi } from '@/lib/api';
import { useIsDemoAccount } from '@/hooks/useDemoData';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */
const container = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

/* ------------------------------------------------------------------ */
/*  Waveform Bar Component                                             */
/* ------------------------------------------------------------------ */
function WaveformBar({ index, active }: { index: number; active: boolean }) {
  const baseHeight = 8 + Math.random() * 6;
  return (
    <motion.div
      className={`w-1 rounded-full ${
        active ? 'bg-nexus-primary' : 'bg-nexus-border'
      }`}
      animate={
        active
          ? {
              height: [baseHeight, 20 + Math.random() * 28, baseHeight],
              opacity: [0.6, 1, 0.6],
            }
          : { height: baseHeight, opacity: 0.3 }
      }
      transition={
        active
          ? {
              duration: 0.4 + Math.random() * 0.5,
              repeat: Infinity,
              repeatType: 'mirror',
              delay: index * 0.03,
            }
          : { duration: 0.5 }
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Audio Level Meter                                                   */
/* ------------------------------------------------------------------ */
function AudioLevelMeter({ level, label }: { level: number; label: string }) {
  const segments = 20;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-nexus-muted uppercase tracking-wider">{label}</span>
        <span className="text-[11px] text-nexus-muted">{Math.round(level * 100)}%</span>
      </div>
      <div className="flex gap-px h-3">
        {Array.from({ length: segments }).map((_, i) => {
          const filled = i / segments < level;
          const color =
            i / segments > 0.85
              ? 'bg-red-500'
              : i / segments > 0.65
              ? 'bg-amber-500'
              : 'bg-emerald-500';
          return (
            <div
              key={i}
              className={`flex-1 rounded-sm transition-colors duration-150 ${
                filled ? color : 'bg-nexus-border/40'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Voice Command Entry                                                */
/* ------------------------------------------------------------------ */
interface VoiceEntry {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

function VoiceEntryBubble({ entry }: { entry: VoiceEntry }) {
  const isUser = entry.type === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
          isUser
            ? 'bg-nexus-primary/20 border border-nexus-primary/30 text-nexus-text'
            : 'bg-nexus-card border border-nexus-border text-nexus-text'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {isUser ? (
            <Mic size={11} className="text-nexus-primary" />
          ) : (
            <Volume2 size={11} className="text-nexus-accent" />
          )}
          <span className="text-[10px] text-nexus-muted">
            {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p>{entry.text}</p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status mapping                                                     */
/* ------------------------------------------------------------------ */
type VoiceStatus = 'ready' | 'listening' | 'processing' | 'speaking';

const statusConfig: Record<VoiceStatus, { label: string; color: string; badge: 'success' | 'warning' | 'info' | 'error'; indicator: 'active' | 'idle' | 'warning' | 'inactive' }> = {
  ready: { label: 'Ready', color: 'text-emerald-400', badge: 'success', indicator: 'idle' },
  listening: { label: 'Listening...', color: 'text-blue-400', badge: 'info', indicator: 'active' },
  processing: { label: 'Processing...', color: 'text-amber-400', badge: 'warning', indicator: 'warning' },
  speaking: { label: 'Speaking', color: 'text-violet-400', badge: 'info', indicator: 'active' },
};

/* ------------------------------------------------------------------ */
/*  Mock history                                                       */
/* ------------------------------------------------------------------ */
const mockHistory: VoiceEntry[] = [
  { id: '1', type: 'user', text: "Hey Nexus, what's the weather like today?", timestamp: new Date(Date.now() - 120000) },
  { id: '2', type: 'ai', text: 'It\'s 24°C and partly cloudy. Perfect for an evening walk.', timestamp: new Date(Date.now() - 115000) },
  { id: '3', type: 'user', text: 'Turn on the living room lights', timestamp: new Date(Date.now() - 60000) },
  { id: '4', type: 'ai', text: 'Done! I\'ve turned on the living room lights and set them to warm white.', timestamp: new Date(Date.now() - 55000) },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Voice() {
  const isDemo = useIsDemoAccount();
  const {
    setCurrentPage,
    isListening,
    isSpeaking,
    transcript,
    confidence,
    voiceEnabled,
    wakeWordActive,
    setIsListening,
    setIsSpeaking,
    setVoiceEnabled,
    setWakeWordActive,
  } = useStore();

  const [status, setStatus] = useState<VoiceStatus>('ready');
  const [history, setHistory] = useState<VoiceEntry[]>(isDemo ? mockHistory : []);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [pitch, setPitch] = useState([1.0]);
  const [speed, setSpeed] = useState([1.0]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage('/voice');
  }, [setCurrentPage]);

  /* Derive status from store */
  useEffect(() => {
    if (isSpeaking) setStatus('speaking');
    else if (isListening) setStatus('listening');
    else setStatus('ready');
  }, [isListening, isSpeaking]);

  /* Simulate input level when listening */
  useEffect(() => {
    if (!isListening) {
      setInputLevel(0);
      return;
    }
    const iv = setInterval(() => setInputLevel(0.3 + Math.random() * 0.6), 100);
    return () => clearInterval(iv);
  }, [isListening]);

  /* Simulate output level when speaking */
  useEffect(() => {
    if (!isSpeaking) {
      setOutputLevel(0);
      return;
    }
    const iv = setInterval(() => setOutputLevel(0.2 + Math.random() * 0.7), 100);
    return () => clearInterval(iv);
  }, [isSpeaking]);

  /* Scroll conversation to bottom */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      setIsListening(false);
      /* simulate processing → speaking */
      setStatus('processing');
      setTimeout(() => {
        setHistory((h) => [
          ...h,
          { id: String(Date.now()), type: 'user', text: transcript || 'Turn off bedroom lights', timestamp: new Date() },
        ]);
        setTimeout(() => {
          setHistory((h) => [
            ...h,
            { id: String(Date.now() + 1), type: 'ai', text: 'Bedroom lights are now off. Is there anything else?', timestamp: new Date() },
          ]);
          setIsSpeaking(true);
          setTimeout(() => setIsSpeaking(false), 3000);
        }, 800);
      }, 1200);
    } else {
      setIsListening(true);
    }
  }, [isListening, transcript, setIsListening, setIsSpeaking]);

  const cfg = statusConfig[status];
  const barCount = 48;

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="space-y-6 pb-8"
    >
      {/* ── Header ── */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
            <Mic size={24} className="text-nexus-primary" />
            Voice Assistant
          </h1>
          <p className="text-sm text-nexus-muted mt-0.5">Speak to control Nexus</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator status={cfg.indicator} label={cfg.label} />
          <Badge variant={cfg.badge} pulse={status === 'listening'}>
            {cfg.label}
          </Badge>
        </div>
      </motion.div>

      {/* ── Main Area: Two columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column: Mic + Waveform ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Microphone Hero */}
          <motion.div variants={item}>
            <Card variant="glow" className="flex flex-col items-center justify-center py-10 relative overflow-hidden">
              {/* Waveform behind mic */}
              <div className="absolute inset-0 flex items-center justify-center gap-[3px] pointer-events-none opacity-30">
                {Array.from({ length: barCount }).map((_, i) => (
                  <WaveformBar key={i} index={i} active={isListening || isSpeaking} />
                ))}
              </div>

              {/* Pulse rings */}
              <AnimatePresence>
                {isListening && (
                  <>
                    {[0, 1, 2].map((ring) => (
                      <motion.div
                        key={ring}
                        initial={{ scale: 0.8, opacity: 0.6 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: ring * 0.6,
                        }}
                        className="absolute w-24 h-24 rounded-full border-2 border-nexus-primary/40"
                      />
                    ))}
                  </>
                )}
              </AnimatePresence>

              {/* Mic Button */}
              <motion.button
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.05 }}
                onClick={toggleListening}
                disabled={!voiceEnabled}
                className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isListening
                    ? 'bg-nexus-primary shadow-nexus shadow-nexus-primary/50 neon-blue'
                    : isSpeaking
                    ? 'bg-violet-600 shadow-nexus shadow-violet-500/50 neon-violet'
                    : 'bg-nexus-card border-2 border-nexus-border hover:border-nexus-primary/50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {status === 'processing' ? (
                  <Loader2 size={36} className="text-white animate-spin" />
                ) : isListening ? (
                  <MicOff size={36} className="text-white" />
                ) : (
                  <Mic size={36} className={isSpeaking ? 'text-white' : 'text-nexus-muted'} />
                )}
              </motion.button>

              <p className={`mt-4 text-sm font-medium ${cfg.color} z-10`}>{cfg.label}</p>

              {transcript && isListening && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-sm text-nexus-text/80 italic z-10 max-w-xs text-center"
                >
                  "{transcript}"
                </motion.p>
              )}

              {confidence > 0 && (
                <p className="text-[11px] text-nexus-muted mt-1 z-10">
                  Confidence: {Math.round(confidence * 100)}%
                </p>
              )}
            </Card>
          </motion.div>

          {/* Audio Levels */}
          <motion.div variants={item}>
            <Card>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2">
                  <Waves size={14} className="text-nexus-accent" />
                  Audio Levels
                </h3>
                <AudioLevelMeter level={inputLevel} label="Input" />
                <AudioLevelMeter level={outputLevel} label="Output" />
              </div>
            </Card>
          </motion.div>

          {/* Conversation History */}
          <motion.div variants={item}>
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2">
                  <MessageSquare size={14} className="text-nexus-primary" />
                  Voice Conversation
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => setHistory([])}
                >
                  Clear
                </Button>
              </div>

              <div
                ref={scrollRef}
                className="max-h-64 overflow-y-auto scrollbar-thin space-y-3"
              >
                {history.length === 0 ? (
                  <p className="text-xs text-nexus-muted text-center py-6">
                    No voice commands yet. Tap the mic to begin.
                  </p>
                ) : (
                  history.map((e) => <VoiceEntryBubble key={e.id} entry={e} />)
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* ── Right Column: Controls ── */}
        <div className="space-y-6">
          {/* Quick Controls */}
          <motion.div variants={item}>
            <Card>
              <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2 mb-3">
                <Settings size={14} className="text-nexus-muted" />
                Controls
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nexus-text">Voice Enabled</span>
                  <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nexus-text">Wake Word</span>
                  <Switch checked={wakeWordActive} onCheckedChange={setWakeWordActive} />
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Voice Settings */}
          <motion.div variants={item}>
            <Card>
              <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2 mb-3">
                <Volume2 size={14} className="text-nexus-accent" />
                Voice Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-nexus-muted">Voice</label>
                  <select className="mt-1.5 w-full rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text focus-ring">
                    <option>Alloy (Neutral)</option>
                    <option>Echo (Male)</option>
                    <option>Fable (Female)</option>
                    <option>Onyx (Deep)</option>
                    <option>Nova (Soft)</option>
                  </select>
                </div>

                <Slider
                  value={speed}
                  onValueChange={setSpeed}
                  min={0.5}
                  max={2}
                  step={0.1}
                  label="Speed"
                  showValue
                />

                <Slider
                  value={pitch}
                  onValueChange={setPitch}
                  min={0.5}
                  max={2}
                  step={0.1}
                  label="Pitch"
                  showValue
                />
              </div>
            </Card>
          </motion.div>

          {/* Wake Word Config */}
          <motion.div variants={item}>
            <Card>
              <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2 mb-3">
                <Radio size={14} className="text-nexus-primary" />
                Wake Word
              </h3>
              <p className="text-xs text-nexus-muted mb-2">
                Say the wake word to activate voice commands
              </p>
              <div className="rounded-lg border border-nexus-primary/20 bg-nexus-primary/5 px-3 py-2 text-sm text-nexus-text font-mono text-center">
                "Hey Nexus"
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-nexus-muted">
                <CheckCircle2 size={12} className="text-emerald-400" />
                Wake word detection active
              </div>
            </Card>
          </motion.div>

          {/* Trigger Words */}
          <motion.div variants={item}>
            <Card>
              <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2 mb-3">
                <Zap size={14} className="text-amber-400" />
                Quick Commands
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Turn on lights',
                  'Lock doors',
                  'Set alarm',
                  'Play music',
                  'Weather update',
                  'Read messages',
                  'Start timer',
                ].map((cmd) => (
                  <Badge key={cmd} variant="neutral">
                    {cmd}
                  </Badge>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Voice Training */}
          <motion.div variants={item}>
            <Card>
              <h3 className="text-sm font-semibold text-nexus-text flex items-center gap-2 mb-3">
                <Mic size={14} className="text-violet-400" />
                Voice Training
              </h3>
              <p className="text-xs text-nexus-muted mb-3">
                Train Nexus to better recognize your voice and commands
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-nexus-muted">Training phrases recorded</span>
                  <span className="text-nexus-text font-medium">12 / 20</span>
                </div>
                <div className="h-1.5 rounded-full bg-nexus-border/30 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-nexus-primary to-nexus-accent"
                    initial={{ width: 0 }}
                    animate={{ width: '60%' }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <Button variant="secondary" size="sm" icon={Mic} className="w-full mt-2">
                  Record Phrase
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
