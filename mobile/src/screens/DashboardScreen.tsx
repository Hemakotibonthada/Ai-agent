/* ===================================================================
   Nexus AI OS — Mobile Dashboard Screen
   Greeting, quick stats, system status, quick actions, activity
   =================================================================== */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';

import Card from '../components/Card';
import QuickAction from '../components/QuickAction';
import Header from '../components/Header';
import { colors, typography, spacing } from '../lib/theme';
import { systemApi, agentsApi } from '../lib/api';

const { width } = Dimensions.get('window');

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface StatCard {
  label: string;
  value: string;
  icon: string;
  color: string;
  trend?: string;
}

interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  time: string;
  color: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);

  const greeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [info, agentList] = await Promise.all([
        systemApi.resources().catch(() => null),
        agentsApi.list().catch(() => []),
      ]);
      if (info) setSystemInfo(info);
      if (agentList) setAgents(agentList);
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

  const stats: StatCard[] = [
    { label: 'Active Agents', value: `${agents.filter((a: any) => a.status === 'active').length}`, icon: 'pulse', color: colors.success, trend: '+2' },
    { label: 'Tasks Today', value: '12', icon: 'checkbox', color: colors.primary, trend: '3 left' },
    { label: 'Home Devices', value: '18', icon: 'home', color: colors.accent, trend: 'All OK' },
    { label: 'Wellness', value: '87%', icon: 'heart', color: colors.error, trend: '+5%' },
  ];

  const recentActivity: ActivityItem[] = [
    { id: '1', title: 'Living room lights adjusted', subtitle: 'Home Agent • Automated', icon: 'bulb', time: '2m ago', color: colors.warning },
    { id: '2', title: 'Meeting summary generated', subtitle: 'Work Agent • AI Report', icon: 'document-text', time: '15m ago', color: colors.primary },
    { id: '3', title: 'Exercise logged – 45min run', subtitle: 'Health Agent • Manual', icon: 'fitness', time: '1h ago', color: colors.success },
    { id: '4', title: 'Security scan completed', subtitle: 'Security Agent • All clear', icon: 'shield-checkmark', time: '2h ago', color: colors.accent },
    { id: '5', title: 'Monthly budget updated', subtitle: 'Financial Agent • Auto-sync', icon: 'wallet', time: '3h ago', color: colors.secondary },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Dashboard" rightIcon="notifications-outline" />

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
        {/* Greeting */}
        <LinearGradient
          colors={[colors.primary + '20', colors.secondary + '10', 'transparent']}
          style={styles.greetingCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.greetingText}>{greeting()}</Text>
          <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
          <View style={styles.systemRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={styles.systemText}>All systems operational</Text>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          {stats.map((stat, i) => (
            <Card key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.color + '20' }]}>
                <Icon name={stat.icon} size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {stat.trend && (
                <Text style={[styles.statTrend, { color: stat.color }]}>{stat.trend}</Text>
              )}
            </Card>
          ))}
        </ScrollView>

        {/* System Status mini */}
        <Text style={styles.sectionTitle}>System Status</Text>
        <Card style={styles.systemCard}>
          <View style={styles.systemStatusRow}>
            <View style={styles.sysItem}>
              <Icon name="speedometer" size={18} color={colors.primary} />
              <Text style={styles.sysValue}>{systemInfo?.cpu_percent ?? '—'}%</Text>
              <Text style={styles.sysLabel}>CPU</Text>
            </View>
            <View style={styles.sysItem}>
              <Icon name="hardware-chip" size={18} color={colors.secondary} />
              <Text style={styles.sysValue}>{systemInfo?.memory_percent ?? '—'}%</Text>
              <Text style={styles.sysLabel}>RAM</Text>
            </View>
            <View style={styles.sysItem}>
              <Icon name="server" size={18} color={colors.accent} />
              <Text style={styles.sysValue}>{systemInfo?.disk_percent ?? '—'}%</Text>
              <Text style={styles.sysLabel}>Disk</Text>
            </View>
            <View style={styles.sysItem}>
              <Icon name="thermometer" size={18} color={colors.warning} />
              <Text style={styles.sysValue}>{systemInfo?.temperature ?? '—'}°</Text>
              <Text style={styles.sysLabel}>Temp</Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <QuickAction icon="mic" label="Voice" color={colors.primary} onPress={() => navigation.navigate('Chat')} />
          <QuickAction icon="chatbubble-ellipses" label="Chat" color={colors.secondary} onPress={() => navigation.navigate('Chat')} />
          <QuickAction icon="add-circle" label="Task" color={colors.success} onPress={() => {}} />
          <QuickAction icon="home" label="Home" color={colors.accent} onPress={() => navigation.navigate('Home')} />
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentActivity.map((item) => (
          <Card key={item.id} style={styles.activityCard}>
            <View style={[styles.activityIcon, { backgroundColor: item.color + '20' }]}>
              <Icon name={item.icon} size={18} color={item.color} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.activityTime}>{item.time}</Text>
          </Card>
        ))}

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

  greetingCard: {
    borderRadius: 16,
    padding: spacing.xl,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  greetingText: { ...typography.h1, color: colors.text },
  dateText: { ...typography.body, color: colors.muted, marginTop: spacing.xs },
  systemRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  systemText: { ...typography.bodySmall, color: colors.success },

  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },

  statsRow: { paddingRight: spacing.lg, gap: spacing.md },
  statCard: {
    width: (width - spacing.lg * 2 - spacing.md * 3) / 2,
    minWidth: 140,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: { ...typography.h2, color: colors.text },
  statLabel: { ...typography.caption, color: colors.muted, marginTop: 2 },
  statTrend: { ...typography.caption, marginTop: spacing.xs },

  systemCard: { padding: spacing.lg },
  systemStatusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  sysItem: { alignItems: 'center', gap: spacing.xs },
  sysValue: { ...typography.h3, color: colors.text, marginTop: spacing.xs },
  sysLabel: { ...typography.caption, color: colors.muted },

  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },

  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: { flex: 1, marginLeft: spacing.md },
  activityTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  activitySubtitle: { ...typography.caption, color: colors.muted, marginTop: 2 },
  activityTime: { ...typography.caption, color: colors.muted },
});

export default DashboardScreen;
