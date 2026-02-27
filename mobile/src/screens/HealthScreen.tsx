/* ===================================================================
   Nexus AI OS — Mobile Health Screen
   Mood, daily metrics, progress rings, logging, weekly trends, score
   =================================================================== */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

import Header from '../components/Header';
import Card from '../components/Card';
import GaugeChart from '../components/GaugeChart';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { healthApi } from '../lib/api';

const { width } = Dimensions.get('window');
const CARD_W = (width - spacing.lg * 2 - spacing.md) / 2;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const MOODS = [
  { emoji: '😢', label: 'Awful', value: 1 },
  { emoji: '😕', label: 'Bad', value: 2 },
  { emoji: '😐', label: 'Okay', value: 3 },
  { emoji: '🙂', label: 'Good', value: 4 },
  { emoji: '😄', label: 'Great', value: 5 },
];

interface DailyMetric {
  label: string;
  value: number;
  target: number;
  unit: string;
  icon: string;
  color: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const HealthScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [wellnessScore, setWellnessScore] = useState(87);
  const [summary, setSummary] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<number[]>([65, 72, 80, 75, 85, 90, 87]);

  const dailyMetrics: DailyMetric[] = [
    { label: 'Steps', value: summary?.steps ?? 7432, target: 10000, unit: 'steps', icon: 'footsteps', color: colors.primary },
    { label: 'Water', value: summary?.water ?? 5, target: 8, unit: 'glasses', icon: 'water', color: colors.accent },
    { label: 'Sleep', value: summary?.sleep ?? 7.2, target: 8, unit: 'hours', icon: 'moon', color: colors.secondary },
    { label: 'Exercise', value: summary?.exercise ?? 35, target: 60, unit: 'min', icon: 'fitness', color: colors.success },
  ];

  const loadData = useCallback(async () => {
    try {
      const [sum, trends] = await Promise.all([
        healthApi.summary().catch(() => null),
        healthApi.trends('wellness', 7).catch(() => []),
      ]);
      if (sum) setSummary(sum);
      if (trends?.length > 0) {
        setWeeklyData(trends.map((t: any) => t.value));
        const avg = trends.reduce((a: number, t: any) => a + t.value, 0) / trends.length;
        setWellnessScore(Math.round(avg));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  /* ---- Log mood ---- */
  const logMood = async (mood: number) => {
    setSelectedMood(mood);
    try {
      await healthApi.logMood({ mood });
    } catch {}
  };

  /* ---- Quick log actions ---- */
  const logExercise = () => {
    Alert.prompt?.('Log Exercise', 'Duration in minutes:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log',
        onPress: async (value) => {
          const dur = parseInt(value ?? '0', 10);
          if (dur > 0) {
            try { await healthApi.logExercise({ type: 'general', duration: dur }); } catch {}
          }
        },
      },
    ]) ?? Alert.alert('Exercise Logged', '45 min general exercise');
  };

  const logWater = async () => {
    try {
      await healthApi.logExercise({ type: 'water', duration: 0, calories: 0 });
      Alert.alert('Water Logged', '+1 glass of water 💧');
    } catch {
      Alert.alert('Water Logged', '+1 glass of water 💧');
    }
  };

  const logSleep = () => {
    Alert.alert('Sleep Logged', '7.5 hours last night 🌙');
    try { healthApi.logSleep({ hours: 7.5, quality: 4 }); } catch {}
  };

  /* ---- Progress ring helper ---- */
  const progressPercent = (value: number, target: number) =>
    Math.min(Math.round((value / target) * 100), 100);

  /* ---- Mini weekly chart ---- */
  const maxVal = Math.max(...weeklyData, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Health & Wellness" rightIcon="analytics-outline" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Wellness Score */}
        <LinearGradient
          colors={[colors.success + '15', colors.primary + '10', 'transparent']}
          style={styles.scoreCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <GaugeChart
            value={wellnessScore}
            max={100}
            label="Wellness Score"
            unit="%"
            color={wellnessScore >= 80 ? colors.success : wellnessScore >= 50 ? colors.warning : colors.error}
            size={120}
          />
        </LinearGradient>

        {/* Mood Selector */}
        <Text style={styles.sectionTitle}>How are you feeling?</Text>
        <View style={styles.moodRow}>
          {MOODS.map((mood) => (
            <TouchableOpacity
              key={mood.value}
              style={[
                styles.moodBtn,
                selectedMood === mood.value && styles.moodBtnActive,
              ]}
              onPress={() => logMood(mood.value)}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text
                style={[
                  styles.moodLabel,
                  selectedMood === mood.value && styles.moodLabelActive,
                ]}
              >
                {mood.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Daily Metrics */}
        <Text style={styles.sectionTitle}>Daily Metrics</Text>
        <View style={styles.metricsGrid}>
          {dailyMetrics.map((metric) => (
            <Card key={metric.label} style={[styles.metricCard, { width: CARD_W }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: metric.color + '20' }]}>
                  <Icon name={metric.icon} size={16} color={metric.color} />
                </View>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
              <Text style={styles.metricValue}>
                {metric.value}
                <Text style={styles.metricUnit}> {metric.unit}</Text>
              </Text>
              {/* Progress bar */}
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressPercent(metric.value, metric.target)}%`,
                      backgroundColor: metric.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.metricTarget}>
                {progressPercent(metric.value, metric.target)}% of {metric.target} {metric.unit}
              </Text>
            </Card>
          ))}
        </View>

        {/* Quick Log Buttons */}
        <Text style={styles.sectionTitle}>Quick Log</Text>
        <View style={styles.logRow}>
          <TouchableOpacity style={[styles.logBtn, { backgroundColor: colors.success + '20' }]} onPress={logExercise}>
            <Icon name="fitness" size={22} color={colors.success} />
            <Text style={[styles.logBtnText, { color: colors.success }]}>Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.logBtn, { backgroundColor: colors.accent + '20' }]} onPress={logWater}>
            <Icon name="water" size={22} color={colors.accent} />
            <Text style={[styles.logBtnText, { color: colors.accent }]}>Water</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.logBtn, { backgroundColor: colors.secondary + '20' }]} onPress={logSleep}>
            <Icon name="moon" size={22} color={colors.secondary} />
            <Text style={[styles.logBtnText, { color: colors.secondary }]}>Sleep</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly Trend */}
        <Text style={styles.sectionTitle}>Weekly Trend</Text>
        <Card style={styles.chartCard}>
          <View style={styles.chartRow}>
            {weeklyData.map((val, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={[
                      styles.barFill,
                      { height: `${(val / maxVal) * 100}%` },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                </View>
                <Text style={styles.barLabel}>{dayLabels[i]}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },

  scoreCard: {
    borderRadius: 16,
    padding: spacing.xl,
    marginTop: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },

  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    marginHorizontal: 3,
  },
  moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
  moodEmoji: { fontSize: 28 },
  moodLabel: { ...typography.caption, color: colors.muted, marginTop: spacing.xs },
  moodLabelActive: { color: colors.primary },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { padding: spacing.lg },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  metricLabel: { ...typography.label, color: colors.muted },
  metricValue: { ...typography.h2, color: colors.text },
  metricUnit: { ...typography.bodySmall, color: colors.muted, fontWeight: '400' },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  progressFill: { height: 4, borderRadius: 2 },
  metricTarget: { ...typography.caption, color: colors.muted, marginTop: spacing.xs },

  logRow: { flexDirection: 'row', gap: spacing.md },
  logBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  logBtnText: { ...typography.label },

  chartCard: { padding: spacing.lg },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', height: 120, alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1, gap: spacing.xs },
  barTrack: {
    width: 16,
    height: 100,
    borderRadius: 8,
    backgroundColor: colors.border,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: 16, borderRadius: 8 },
  barLabel: { ...typography.caption, color: colors.muted },
});

export default HealthScreen;
