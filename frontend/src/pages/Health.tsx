/* ===================================================================
   Nexus AI OS — Health & Wellness Page
   Mood tracker, vitals, charts, fitness, hydration, AI recommendations
   =================================================================== */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Brain,
  Activity,
  Moon,
  Moon as MoonIcon,
  Footprints,
  Flame,
  Droplets,
  Dumbbell,
  Smile,
  Meh,
  Frown,
  ThumbsUp,
  ThumbsDown,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  Calendar,
  Plus,
  AlertTriangle,
  Armchair,
  GlassWater,
  Stethoscope,
  Pencil,
  CheckCircle2,
  BarChart3,
  Zap,
  Apple,
  Scale,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { CircularProgress } from '@/components/ui/Progress';
import AnimatedNumber from '@/components/shared/AnimatedNumber';
import useStore from '@/lib/store';
import { healthApi } from '@/lib/api';
import type { MoodEntry, MoodLevel } from '@/types';
import { useIsDemoAccount } from '@/hooks/useDemoData';

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
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
/*  Shared tooltip style                                               */
/* ------------------------------------------------------------------ */
const tooltipStyle = {
  backgroundColor: '#1E1E2E',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  fontSize: 12,
};

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const moodEmojis: { level: MoodLevel; emoji: string; label: string; color: string }[] = [
  { level: 1, emoji: '😢', label: 'Awful', color: '#EF4444' },
  { level: 2, emoji: '😟', label: 'Bad', color: '#F59E0B' },
  { level: 3, emoji: '😐', label: 'Okay', color: '#6B7280' },
  { level: 4, emoji: '🙂', label: 'Good', color: '#3B82F6' },
  { level: 5, emoji: '😄', label: 'Great', color: '#10B981' },
];

const moodTrend = [
  { day: 'Mon', mood: 4, label: '🙂' },
  { day: 'Tue', mood: 3, label: '😐' },
  { day: 'Wed', mood: 5, label: '😄' },
  { day: 'Thu', mood: 4, label: '🙂' },
  { day: 'Fri', mood: 2, label: '😟' },
  { day: 'Sat', mood: 4, label: '🙂' },
  { day: 'Sun', mood: 5, label: '😄' },
];

const sleepData = [
  { day: 'Mon', hours: 7.2, quality: 80 },
  { day: 'Tue', hours: 6.5, quality: 65 },
  { day: 'Wed', hours: 8.0, quality: 92 },
  { day: 'Thu', hours: 7.0, quality: 75 },
  { day: 'Fri', hours: 5.5, quality: 55 },
  { day: 'Sat', hours: 8.5, quality: 88 },
  { day: 'Sun', hours: 7.8, quality: 85 },
];

const exerciseLog = [
  { day: 'Mon', type: 'Running', duration: 30, calories: 280 },
  { day: 'Tue', type: 'Yoga', duration: 45, calories: 150 },
  { day: 'Wed', type: 'Gym', duration: 60, calories: 420 },
  { day: 'Thu', type: 'Rest', duration: 0, calories: 0 },
  { day: 'Fri', type: 'Cycling', duration: 40, calories: 350 },
  { day: 'Sat', type: 'Swimming', duration: 45, calories: 400 },
  { day: 'Sun', type: 'Walking', duration: 25, calories: 120 },
];

const mentalHealthData = [
  { metric: 'Stress', value: 35 },
  { metric: 'Anxiety', value: 25 },
  { metric: 'Focus', value: 82 },
  { metric: 'Energy', value: 70 },
  { metric: 'Calm', value: 75 },
  { metric: 'Social', value: 60 },
];

/* -- Heart Rate (24-hour, hourly) ---------------------------------- */
const heartRateData = Array.from({ length: 24 }, (_, i) => {
  const base = i >= 0 && i < 6 ? 62 : i < 9 ? 70 : i < 12 ? 78 : i < 14 ? 74 : i < 18 ? 82 : i < 21 ? 76 : 68;
  return { hour: `${String(i).padStart(2, '0')}:00`, bpm: base + Math.round(Math.random() * 8 - 4) };
});

/* -- Nutrition Breakdown ------------------------------------------- */
const macroData = [
  { name: 'Protein', value: 30, color: '#3B82F6' },
  { name: 'Carbs', value: 45, color: '#F59E0B' },
  { name: 'Fat', value: 20, color: '#EF4444' },
  { name: 'Fiber', value: 5, color: '#10B981' },
];

const dailyCalorieData = [
  { day: 'Mon', calories: 1950 },
  { day: 'Tue', calories: 2100 },
  { day: 'Wed', calories: 1850 },
  { day: 'Thu', calories: 2200 },
  { day: 'Fri', calories: 1980 },
  { day: 'Sat', calories: 2350 },
  { day: 'Sun', calories: 1900 },
];

/* -- Exercise Intensity (Composed) --------------------------------- */
const exerciseIntensityData = [
  { day: 'Mon', cardio: 30, strength: 0, flexibility: 0, total: 30 },
  { day: 'Tue', cardio: 0, strength: 0, flexibility: 45, total: 45 },
  { day: 'Wed', cardio: 20, strength: 35, flexibility: 5, total: 60 },
  { day: 'Thu', cardio: 0, strength: 0, flexibility: 0, total: 0 },
  { day: 'Fri', cardio: 40, strength: 0, flexibility: 0, total: 40 },
  { day: 'Sat', cardio: 45, strength: 0, flexibility: 0, total: 45 },
  { day: 'Sun', cardio: 15, strength: 0, flexibility: 10, total: 25 },
];

/* -- Body Metrics (12 weeks) --------------------------------------- */
const bodyMetricsData = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  weight: 78 - i * 0.3 + Math.round(Math.random() * 6) / 10,
  bodyFat: 22 - i * 0.2 + Math.round(Math.random() * 4) / 10,
}));

/* -- Sleep Stages (7 days) ----------------------------------------- */
const sleepStagesData = [
  { day: 'Mon', deep: 1.8, light: 3.2, rem: 1.5, awake: 0.7 },
  { day: 'Tue', deep: 1.4, light: 3.0, rem: 1.2, awake: 0.9 },
  { day: 'Wed', deep: 2.2, light: 3.5, rem: 1.6, awake: 0.7 },
  { day: 'Thu', deep: 1.6, light: 3.1, rem: 1.4, awake: 0.9 },
  { day: 'Fri', deep: 1.0, light: 2.5, rem: 1.2, awake: 0.8 },
  { day: 'Sat', deep: 2.4, light: 3.6, rem: 1.8, awake: 0.7 },
  { day: 'Sun', deep: 2.0, light: 3.4, rem: 1.6, awake: 0.8 },
];

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */
function HealthStatCard({
  label,
  value,
  unit,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ElementType;
  color: string;
  trend?: { direction: 'up' | 'down'; value: string };
}) {
  return (
    <motion.div variants={item}>
      <Card hoverable size="sm">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-nexus-muted uppercase tracking-wider">{label}</p>
            <div className="flex items-baseline gap-1">
              <AnimatedNumber value={value} className="text-xl font-bold text-nexus-text" />
              <span className="text-xs text-nexus-muted">{unit}</span>
            </div>
          </div>
          {trend && (
            <span
              className={`text-[11px] flex items-center gap-0.5 ${
                trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value}
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hydration Tracker                                                  */
/* ------------------------------------------------------------------ */
function HydrationTracker() {
  const [glasses, setGlasses] = useState(5);
  const goal = 8;

  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <GlassWater size={16} className="text-blue-400" />
          <span>Hydration</span>
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: goal }, (_, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.85 }}
                onClick={() => setGlasses(i + 1)}
                className={`h-8 w-6 rounded-b-lg rounded-t border transition-all ${
                  i < glasses
                    ? 'bg-blue-400/30 border-blue-400/50 shadow-[0_0_6px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 border-nexus-border'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-nexus-muted mt-2">
            <span className="text-nexus-text font-semibold">{glasses}</span> / {goal} glasses
          </p>
        </div>
        <CircularProgress value={(glasses / goal) * 100} size={56} strokeWidth={4} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function Health() {
  const isDemo = useIsDemoAccount();
  const {
    moodEntries,
    currentMood,
    streakDays,
    addMoodEntry,
    setCurrentMood,
    setStreakDays,
    setCurrentPage,
  } = useStore();

  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [journalText, setJournalText] = useState('');
  const [showJournal, setShowJournal] = useState(false);

  useEffect(() => {
    setCurrentPage('/health');
    if (isDemo) setStreakDays(7);
  }, [setCurrentPage, setStreakDays, isDemo]);

  const handleLogMood = useCallback(() => {
    if (!selectedMood) return;
    const entry: MoodEntry = {
      id: crypto.randomUUID(),
      level: selectedMood,
      notes: journalText,
      tags: [],
      timestamp: new Date().toISOString(),
    };
    addMoodEntry(entry);
    setCurrentMood(selectedMood);
    healthApi.logMood({ level: selectedMood, notes: journalText }).catch(() => {});
    setSelectedMood(null);
    setJournalText('');
    setShowJournal(false);
  }, [selectedMood, journalText, addMoodEntry, setCurrentMood]);

  const wellnessScore = isDemo ? 78 : 0;
  const stressLevel = isDemo ? 35 : 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-8"
    >
      {/* ── Header ── */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
          <Heart size={24} className="text-pink-400" />
          Health & Wellness
        </h1>
        <p className="text-sm text-nexus-muted mt-0.5">
          Track your mood, fitness, and well-being
        </p>
      </motion.div>

      {/* ── Mood Tracker ── */}
      <motion.div variants={item}>
        <Card
          variant="glow"
          header={
            <div className="flex items-center gap-2">
              <Smile size={16} className="text-amber-400" />
              <span>How are you feeling?</span>
              <Badge variant="success" className="ml-auto">{streakDays}-day streak 🔥</Badge>
            </div>
          }
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Emoji selection */}
            <div className="flex gap-3">
              {moodEmojis.map((m) => (
                <motion.button
                  key={m.level}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setSelectedMood(m.level);
                    setShowJournal(true);
                  }}
                  className={`flex flex-col items-center gap-1 rounded-xl p-3 border transition-all ${
                    selectedMood === m.level
                      ? 'border-nexus-primary/50 bg-nexus-primary/10 shadow-nexus'
                      : currentMood === m.level
                      ? 'border-nexus-border bg-white/5'
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-nexus-muted">{m.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Journal entry */}
            <AnimatePresence>
              {showJournal && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 flex gap-2 overflow-hidden min-w-0"
                >
                  <textarea
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                    placeholder="How's your day going?"
                    rows={2}
                    className="flex-1 rounded-lg border border-nexus-border bg-nexus-surface/60 px-3 py-2 text-sm text-nexus-text placeholder:text-nexus-muted/60 resize-none focus-ring"
                  />
                  <Button variant="primary" size="sm" onClick={handleLogMood}>
                    Log
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* ── Daily Health Cards ── */}
      {isDemo && (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <HealthStatCard label="Sleep" value={7.5} unit="hrs" icon={Moon} color="#8B5CF6" trend={{ direction: 'up', value: '+0.5h' }} />
        <HealthStatCard label="Exercise" value={45} unit="min" icon={Dumbbell} color="#F59E0B" trend={{ direction: 'up', value: '+15m' }} />
        <HealthStatCard label="Water" value={5} unit="glasses" icon={Droplets} color="#3B82F6" />
        <HealthStatCard label="Steps" value={8420} unit="steps" icon={Footprints} color="#10B981" trend={{ direction: 'up', value: '+12%' }} />
        <HealthStatCard label="Calories" value={1820} unit="kcal" icon={Flame} color="#EF4444" />
      </div>
      )}

      {/* ── Wellness Score + Mental Health ── */}
      {isDemo && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wellness Score Ring */}
        <motion.div variants={item}>
          <Card
            variant="glow"
            header={
              <div className="flex items-center gap-2">
                <Target size={16} className="text-emerald-400" />
                <span>Wellness Score</span>
              </div>
            }
          >
            <div className="flex flex-col items-center py-4">
              <CircularProgress value={wellnessScore} size={120} strokeWidth={10} />
              <p className="text-sm font-semibold text-nexus-text mt-3">
                <AnimatedNumber value={wellnessScore} /> / 100
              </p>
              <p className="text-xs text-nexus-muted mt-1 flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-400" /> +5 from last week
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              {[
                { label: 'Physical', value: 82, color: '#3B82F6' },
                { label: 'Mental', value: 74, color: '#8B5CF6' },
                { label: 'Social', value: 68, color: '#10B981' },
              ].map((s) => (
                <div key={s.label}>
                  <CircularProgress value={s.value} size={40} strokeWidth={3} />
                  <p className="text-[10px] text-nexus-muted mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Mental Health Radar */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-violet-400" />
                <span>Mental Health</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={mentalHealthData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#888', fontSize: 10 }} />
                <Radar
                  dataKey="value"
                  stroke="#8B5CF6"
                  fill="#8B5CF6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Stress Level + Posture */}
        <motion.div variants={item} className="space-y-4">
          {/* Stress */}
          <Card size="sm" hoverable>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <Activity size={20} />
              </span>
              <div className="flex-1">
                <p className="text-[11px] text-nexus-muted uppercase tracking-wider">Stress Level</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={stressLevel} size="sm" className="flex-1" />
                  <span className="text-xs font-semibold text-nexus-text">{stressLevel}%</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-nexus-muted mt-1.5">
              {stressLevel < 40 ? '✨ Low stress — keep it up!' : '⚠️ Moderate — try a breathing exercise.'}
            </p>
          </Card>

          {/* Posture Reminder */}
          <Card size="sm" hoverable>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                <Armchair size={20} />
              </span>
              <div>
                <p className="text-sm font-medium text-nexus-text">Posture Check</p>
                <p className="text-[10px] text-nexus-muted">Last check: 28 min ago</p>
              </div>
              <Badge variant="success" className="ml-auto">Good</Badge>
            </div>
          </Card>

          {/* Fitness Plan */}
          <Card size="sm" hoverable>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                <Dumbbell size={20} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-nexus-text">Today's Plan</p>
                <p className="text-[10px] text-nexus-muted">30 min HIIT + 15 min stretching</p>
              </div>
              <CheckCircle2 size={16} className="text-nexus-muted" />
            </div>
          </Card>
        </motion.div>
      </div>
      )}

      {/* ── Charts Row ── */}
      {isDemo && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mood Trend */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Smile size={16} className="text-amber-400" />
                <span>Mood Trend (7 Days)</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={moodTrend}>
                <defs>
                  <linearGradient id="moodG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#888', fontSize: 10 }}
                  axisLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fill: '#888', fontSize: 10 }}
                  axisLine={false}
                />
                <RechartsTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => {
                    const m = moodEmojis.find((e) => e.level === value);
                    return [`${m?.emoji ?? ''} ${m?.label ?? value}`, 'Mood'];
                  }}
                />
                <Area type="monotone" dataKey="mood" stroke="#F59E0B" fill="url(#moodG)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Sleep Quality */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Moon size={16} className="text-indigo-400" />
                <span>Sleep Quality (7 Days)</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sleepData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Bar dataKey="hours" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>
      )}

      {/* ── Heart Rate Monitor ── */}
      {isDemo && (<>
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-rose-400" />
              <span>Heart Rate Monitor (24h)</span>
              <Badge variant="info" className="ml-auto">Current: 72 bpm</Badge>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={heartRateData}>
              <defs>
                <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: '#888', fontSize: 9 }} axisLine={false} interval={2} />
              <YAxis domain={[50, 110]} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} bpm`, 'Heart Rate']} />
              <ReferenceArea y1={60} y2={100} fill="#10B981" fillOpacity={0.06} label={{ value: 'Resting Zone', fill: '#10B981', fontSize: 10, position: 'insideTopRight' }} />
              <Area type="monotone" dataKey="bpm" stroke="transparent" fill="url(#hrGradient)" />
              <Line type="monotone" dataKey="bpm" stroke="#F43F5E" strokeWidth={2} dot={{ r: 2, fill: '#F43F5E' }} activeDot={{ r: 5 }} name="BPM" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ── Nutrition Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Macros PieChart (donut) */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Apple size={16} className="text-green-400" />
                <span>Macro Breakdown</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={macroData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  strokeWidth={0}
                >
                  {macroData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v}%`, name]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Daily Calorie BarChart */}
        <motion.div variants={item}>
          <Card
            header={
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-orange-400" />
                <span>Daily Calorie Intake</span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyCalorieData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <YAxis domain={[1500, 2500]} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
                <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} kcal`, 'Calories']} />
                <ReferenceLine y={2000} stroke="#10B981" strokeDasharray="6 3" label={{ value: 'Target 2000', fill: '#10B981', fontSize: 10, position: 'right' }} />
                <Bar dataKey="calories" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Calories" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* ── Activity / Exercise Intensity (ComposedChart) ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Dumbbell size={16} className="text-amber-400" />
              <span>Exercise Intensity (7 Days)</span>
              <div className="ml-auto flex items-center gap-3 text-[10px] text-nexus-muted">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Cardio</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" /> Strength</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Flexibility</span>
              </div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={exerciseIntensityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} label={{ value: 'min', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Bar dataKey="cardio" stackId="ex" fill="#F43F5E" radius={[0, 0, 0, 0]} name="Cardio" />
              <Bar dataKey="strength" stackId="ex" fill="#3B82F6" name="Strength" />
              <Bar dataKey="flexibility" stackId="ex" fill="#10B981" radius={[4, 4, 0, 0]} name="Flexibility" />
              <Line type="monotone" dataKey="total" stroke="#FBBF24" strokeWidth={2} dot={{ r: 3, fill: '#FBBF24' }} name="Total min" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ── Body Metrics Trend (dual Y-axis) ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-cyan-400" />
              <span>Body Metrics (12 Weeks)</span>
              <div className="ml-auto flex items-center gap-3 text-[10px] text-nexus-muted">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-400 inline-block" /> Weight</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Body Fat %</span>
              </div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={bodyMetricsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <YAxis
                yAxisId="left"
                domain={[72, 82]}
                tick={{ fill: '#06B6D4', fontSize: 10 }}
                axisLine={false}
                label={{ value: 'kg', angle: -90, position: 'insideLeft', fill: '#06B6D4', fontSize: 10 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[16, 24]}
                tick={{ fill: '#F59E0B', fontSize: 10 }}
                axisLine={false}
                label={{ value: '%', angle: 90, position: 'insideRight', fill: '#F59E0B', fontSize: 10 }}
              />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Line yAxisId="left" type="monotone" dataKey="weight" stroke="#06B6D4" strokeWidth={2} dot={{ r: 3, fill: '#06B6D4' }} name="Weight (kg)" />
              <Line yAxisId="right" type="monotone" dataKey="bodyFat" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} name="Body Fat (%)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ── Sleep Stages (stacked AreaChart) ── */}
      <motion.div variants={item}>
        <Card
          header={
            <div className="flex items-center gap-2">
              <MoonIcon size={16} className="text-indigo-400" />
              <span>Sleep Stages (7 Days)</span>
              <div className="ml-auto flex items-center gap-3 text-[10px] text-nexus-muted">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-400 inline-block" /> Deep</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-300 inline-block" /> Light</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-300 inline-block" /> REM</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-300 inline-block" /> Awake</span>
              </div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={sleepStagesData}>
              <defs>
                <linearGradient id="deepG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818CF8" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#818CF8" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="lightG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7DD3FC" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#7DD3FC" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="remG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C4B5FD" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#C4B5FD" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="awakeG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FDA4AF" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#FDA4AF" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} label={{ value: 'hrs', angle: -90, position: 'insideLeft', fill: '#888', fontSize: 10 }} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="deep" stackId="sleep" stroke="#818CF8" fill="url(#deepG)" strokeWidth={1.5} name="Deep" />
              <Area type="monotone" dataKey="light" stackId="sleep" stroke="#7DD3FC" fill="url(#lightG)" strokeWidth={1.5} name="Light" />
              <Area type="monotone" dataKey="rem" stackId="sleep" stroke="#C4B5FD" fill="url(#remG)" strokeWidth={1.5} name="REM" />
              <Area type="monotone" dataKey="awake" stackId="sleep" stroke="#FDA4AF" fill="url(#awakeG)" strokeWidth={1.5} name="Awake" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </motion.div>

      {/* ── Exercise Log + Hydration ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exercise Log */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card
            header={
              <div className="flex items-center gap-2">
                <Dumbbell size={16} className="text-amber-400" />
                <span>Exercise Log (Weekly)</span>
                <div className="ml-auto flex items-center gap-3 text-xs text-nexus-muted">
                  <span>Total: <strong className="text-nexus-text">
                    {exerciseLog.reduce((a, e) => a + e.duration, 0)} min
                  </strong></span>
                  <span>Burned: <strong className="text-nexus-text">
                    <AnimatedNumber value={exerciseLog.reduce((a, e) => a + e.calories, 0)} /> kcal
                  </strong></span>
                </div>
              </div>
            }
          >
            <div className="space-y-2">
              {exerciseLog.map((e) => (
                <div
                  key={e.day}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5 transition-colors"
                >
                  <span className="text-xs font-semibold text-nexus-muted w-8">{e.day}</span>
                  <span className="flex-1 text-sm text-nexus-text">{e.type}</span>
                  {e.duration > 0 ? (
                    <>
                      <Badge variant="info">{e.duration} min</Badge>
                      <Badge variant="warning">{e.calories} kcal</Badge>
                    </>
                  ) : (
                    <Badge variant="neutral">Rest Day</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Hydration */}
        <motion.div variants={item}>
          <HydrationTracker />
        </motion.div>
      </div>
      </>)}

      {/* ── AI Recommendations ── */}
      {isDemo && (
      <motion.div variants={item}>
        <Card
          variant="gradient"
          header={
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-nexus-accent" />
              <span>AI Health Recommendations</span>
            </div>
          }
        >
          <div className="space-y-3">
            {[
              { text: 'Your sleep quality dipped on Friday. Try avoiding screens 1 hour before bed.', icon: Moon, color: '#8B5CF6' },
              { text: 'Great exercise streak! Consider adding a rest day to prevent burnout.', icon: Dumbbell, color: '#F59E0B' },
              { text: 'You\'re 3 glasses short of your hydration goal. Drink water before your next meeting.', icon: Droplets, color: '#3B82F6' },
              { text: 'Stress levels are low this week. Maintain your meditation routine.', icon: Brain, color: '#10B981' },
            ].map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-3 rounded-lg p-2 hover:bg-white/5 transition-colors"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5"
                  style={{ backgroundColor: `${rec.color}20`, color: rec.color }}
                >
                  <rec.icon size={16} />
                </span>
                <p className="text-sm text-nexus-text/90 leading-relaxed">{rec.text}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
      )}
    </motion.div>
  );
}
