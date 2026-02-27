/* ===================================================================
   Nexus AI OS — Mobile Home Control Screen
   Room selector, device cards, sensors, scenes, energy summary
   =================================================================== */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

import Header from '../components/Header';
import Card from '../components/Card';
import DeviceCard from '../components/DeviceCard';
import GaugeChart from '../components/GaugeChart';
import { colors, typography, spacing, borderRadius } from '../lib/theme';
import { homeApi } from '../lib/api';
import { useStore } from '../lib/store';

const { width } = Dimensions.get('window');

/* ------------------------------------------------------------------ */
/*  Scene presets                                                      */
/* ------------------------------------------------------------------ */
const SCENES = [
  { id: 'morning', name: 'Morning', icon: 'sunny', color: colors.warning },
  { id: 'movie', name: 'Movie', icon: 'film', color: colors.secondary },
  { id: 'sleep', name: 'Sleep', icon: 'moon', color: colors.accent },
  { id: 'away', name: 'Away', icon: 'airplane', color: colors.error },
  { id: 'focus', name: 'Focus', icon: 'library', color: colors.primary },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const HomeScreen: React.FC = () => {
  const {
    devices, sensors, rooms, selectedRoomId,
    setDevices, setSensors, setRooms, setSelectedRoom, updateDevice,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [energyData, setEnergyData] = useState<any>(null);
  const [activeScene, setActiveScene] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [roomList, deviceList, sensorList, energy] = await Promise.all([
        homeApi.rooms().catch(() => []),
        homeApi.devices(selectedRoomId ?? undefined).catch(() => []),
        homeApi.sensors(selectedRoomId ?? undefined).catch(() => []),
        homeApi.energy().catch(() => null),
      ]);
      setRooms(roomList);
      setDevices(deviceList);
      setSensors(sensorList);
      if (energy) setEnergyData(energy);
    } catch {}
  }, [selectedRoomId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  /* ---- Toggle device ---- */
  const toggleDevice = async (deviceId: string, currentState: boolean) => {
    updateDevice(deviceId, { is_on: !currentState });
    try {
      await homeApi.controlDevice({
        device_id: deviceId,
        action: !currentState ? 'turn_on' : 'turn_off',
      });
    } catch {
      updateDevice(deviceId, { is_on: currentState }); // rollback
    }
  };

  /* ---- Active scene ---- */
  const activateScene = (sceneId: string) => {
    setActiveScene(sceneId === activeScene ? null : sceneId);
  };

  /* ---- Room icon mapping ---- */
  const getRoomIcon = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('living')) return 'tv';
    if (lower.includes('bed')) return 'bed';
    if (lower.includes('kitchen')) return 'restaurant';
    if (lower.includes('bath')) return 'water';
    if (lower.includes('office')) return 'desktop';
    if (lower.includes('garage')) return 'car';
    return 'cube';
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const filteredDevices = selectedRoomId
    ? devices.filter((d) => d.room_id === selectedRoomId)
    : devices;
  const filteredSensors = selectedRoomId
    ? sensors.filter((s) => s.room_id === selectedRoomId)
    : sensors;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Home Control" rightIcon="scan-outline" />

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
        {/* Room selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roomRow}
        >
          <TouchableOpacity
            style={[styles.roomChip, !selectedRoomId && styles.roomChipActive]}
            onPress={() => setSelectedRoom(null)}
          >
            <Icon name="apps" size={16} color={!selectedRoomId ? '#fff' : colors.muted} />
            <Text style={[styles.roomChipText, !selectedRoomId && styles.roomChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={[styles.roomChip, selectedRoomId === room.id && styles.roomChipActive]}
              onPress={() => setSelectedRoom(room.id)}
            >
              <Icon
                name={getRoomIcon(room.name)}
                size={16}
                color={selectedRoomId === room.id ? '#fff' : colors.muted}
              />
              <Text
                style={[
                  styles.roomChipText,
                  selectedRoomId === room.id && styles.roomChipTextActive,
                ]}
              >
                {room.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Room summary */}
        {selectedRoom && (
          <Card style={styles.roomSummary}>
            <View style={styles.roomSummaryRow}>
              {selectedRoom.temperature != null && (
                <View style={styles.roomMetric}>
                  <Icon name="thermometer" size={16} color={colors.warning} />
                  <Text style={styles.roomMetricValue}>{selectedRoom.temperature}°C</Text>
                </View>
              )}
              {selectedRoom.humidity != null && (
                <View style={styles.roomMetric}>
                  <Icon name="water" size={16} color={colors.accent} />
                  <Text style={styles.roomMetricValue}>{selectedRoom.humidity}%</Text>
                </View>
              )}
              <View style={styles.roomMetric}>
                <Icon name="hardware-chip" size={16} color={colors.primary} />
                <Text style={styles.roomMetricValue}>{selectedRoom.device_count} devices</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Devices */}
        <Text style={styles.sectionTitle}>Devices</Text>
        <View style={styles.devicesGrid}>
          {filteredDevices.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Icon name="hardware-chip-outline" size={32} color={colors.muted} />
              <Text style={styles.emptyText}>No devices found</Text>
            </Card>
          ) : (
            filteredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onToggle={() => toggleDevice(device.id, device.is_on)}
              />
            ))
          )}
        </View>

        {/* Sensor readings */}
        {filteredSensors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sensors</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gaugesRow}
            >
              {filteredSensors.map((sensor) => (
                <Card key={sensor.id} style={styles.gaugeCard}>
                  <GaugeChart
                    value={sensor.value}
                    max={sensor.type === 'temperature' ? 50 : 100}
                    label={sensor.name}
                    unit={sensor.unit}
                    color={
                      sensor.type === 'temperature'
                        ? colors.warning
                        : sensor.type === 'humidity'
                        ? colors.accent
                        : colors.primary
                    }
                    size={90}
                  />
                </Card>
              ))}
            </ScrollView>
          </>
        )}

        {/* Scenes */}
        <Text style={styles.sectionTitle}>Scenes</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scenesRow}
        >
          {SCENES.map((scene) => (
            <TouchableOpacity
              key={scene.id}
              style={[
                styles.sceneBtn,
                activeScene === scene.id && { borderColor: scene.color, borderWidth: 2 },
              ]}
              onPress={() => activateScene(scene.id)}
            >
              <View
                style={[
                  styles.sceneIconWrap,
                  { backgroundColor: scene.color + (activeScene === scene.id ? '40' : '20') },
                ]}
              >
                <Icon name={scene.icon} size={22} color={scene.color} />
              </View>
              <Text style={styles.sceneText}>{scene.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Energy summary */}
        <Text style={styles.sectionTitle}>Energy</Text>
        <Card style={styles.energyCard}>
          <LinearGradient
            colors={[colors.success + '10', colors.accent + '10']}
            style={styles.energyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.energyRow}>
              <View style={styles.energyItem}>
                <Icon name="flash" size={20} color={colors.warning} />
                <Text style={styles.energyValue}>
                  {energyData?.current_usage ?? '—'} kWh
                </Text>
                <Text style={styles.energyLabel}>Current</Text>
              </View>
              <View style={styles.energyDivider} />
              <View style={styles.energyItem}>
                <Icon name="trending-down" size={20} color={colors.success} />
                <Text style={styles.energyValue}>
                  {energyData?.daily_total ?? '—'} kWh
                </Text>
                <Text style={styles.energyLabel}>Today</Text>
              </View>
              <View style={styles.energyDivider} />
              <View style={styles.energyItem}>
                <Icon name="wallet" size={20} color={colors.primary} />
                <Text style={styles.energyValue}>
                  ${energyData?.cost_estimate ?? '—'}
                </Text>
                <Text style={styles.energyLabel}>Cost est.</Text>
              </View>
            </View>
          </LinearGradient>
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

  roomRow: { paddingVertical: spacing.md, gap: spacing.sm },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  roomChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roomChipText: { ...typography.label, color: colors.muted },
  roomChipTextActive: { color: '#fff' },

  roomSummary: { padding: spacing.md, marginTop: spacing.sm },
  roomSummaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  roomMetric: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  roomMetricValue: { ...typography.bodySmall, color: colors.text },

  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },

  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },

  emptyCard: { flex: 1, alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.muted },

  gaugesRow: { gap: spacing.md, paddingRight: spacing.lg },
  gaugeCard: { padding: spacing.md, alignItems: 'center' },

  scenesRow: { gap: spacing.md, paddingRight: spacing.lg },
  sceneBtn: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
    width: 80,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sceneIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  sceneText: { ...typography.caption, color: colors.text, textAlign: 'center' },

  energyCard: { overflow: 'hidden', padding: 0 },
  energyGradient: { padding: spacing.xl },
  energyRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  energyItem: { alignItems: 'center', gap: spacing.xs },
  energyValue: { ...typography.h3, color: colors.text },
  energyLabel: { ...typography.caption, color: colors.muted },
  energyDivider: { width: 1, height: 40, backgroundColor: colors.border },
});

export default HomeScreen;
