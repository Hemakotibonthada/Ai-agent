/* ===================================================================
   Nexus AI OS — DeviceCard Component
   Home device control card with toggle, icon, and status
   =================================================================== */

import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import type { Device } from '../lib/store';

const { width } = Dimensions.get('window');
const CARD_W = (width - spacing.lg * 2 - spacing.md) / 2;

/* ---- Icon/color mapping ---- */
const DEVICE_MAP: Record<string, { icon: string; color: string }> = {
  light: { icon: 'bulb', color: colors.warning },
  switch: { icon: 'power', color: colors.success },
  thermostat: { icon: 'thermometer', color: colors.error },
  lock: { icon: 'lock-closed', color: colors.secondary },
  camera: { icon: 'videocam', color: colors.accent },
  sensor: { icon: 'pulse', color: colors.primary },
  speaker: { icon: 'volume-high', color: colors.secondary },
  blind: { icon: 'sunny', color: colors.warning },
};

interface DeviceCardProps {
  device: Device;
  onToggle: () => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onToggle }) => {
  const mapping = DEVICE_MAP[device.type] ?? { icon: 'hardware-chip', color: colors.muted };
  const isOnline = device.status === 'online';

  return (
    <View style={[styles.card, device.is_on && styles.cardActive]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: mapping.color + (device.is_on ? '30' : '15') }]}>
          <Icon name={mapping.icon} size={22} color={device.is_on ? mapping.color : colors.muted} />
        </View>
        <Switch
          value={device.is_on}
          onValueChange={onToggle}
          disabled={!isOnline}
          trackColor={{ false: colors.border, true: mapping.color + '60' }}
          thumbColor={device.is_on ? mapping.color : colors.muted}
        />
      </View>

      <Text style={styles.name} numberOfLines={1}>{device.name}</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.success : colors.error }]} />
        <Text style={styles.statusText}>
          {isOnline ? (device.is_on ? 'On' : 'Off') : 'Offline'}
        </Text>
      </View>

      {device.battery_level != null && (
        <View style={styles.batteryRow}>
          <Icon
            name={device.battery_level > 20 ? 'battery-half' : 'battery-dead'}
            size={14}
            color={device.battery_level > 20 ? colors.success : colors.error}
          />
          <Text style={styles.batteryText}>{device.battery_level}%</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardActive: {
    borderColor: colors.primary + '50',
    backgroundColor: colors.cardElevated,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.body, color: colors.text, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.caption, color: colors.muted },
  batteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs },
  batteryText: { ...typography.caption, color: colors.muted },
});

export default DeviceCard;
