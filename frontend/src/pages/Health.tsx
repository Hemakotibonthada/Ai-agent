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
  Radar,
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
    setStreakDays(7);
  }, [setCurrentPage, setStreakDays]);

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

  const wellnessScore = 78;
  const stressLevel = 35;

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <HealthStatCard label="Sleep" value={7.5} unit="hrs" icon={Moon} color="#8B5CF6" trend={{ direction: 'up', value: '+0.5h' }} />
        <HealthStatCard label="Exercise" value={45} unit="min" icon={Dumbbell} color="#F59E0B" trend={{ direction: 'up', value: '+15m' }} />
        <HealthStatCard label="Water" value={5} unit="glasses" icon={Droplets} color="#3B82F6" />
        <HealthStatCard label="Steps" value={8420} unit="steps" icon={Footprints} color="#10B981" trend={{ direction: 'up', value: '+12%' }} />
        <HealthStatCard label="Calories" value={1820} unit="kcal" icon={Flame} color="#EF4444" />
      </div>

      {/* ── Wellness Score + Mental Health ── */}
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

      {/* ── Charts Row ── */}
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
                  contentStyle={{
                    backgroundColor: '#1E1E2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
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
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1E1E2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="hours" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

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

      {/* ── AI Recommendations ── */}
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
    </motion.div>
  );
}
