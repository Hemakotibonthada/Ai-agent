/* ===================================================================
   Nexus AI OS — QuickAction Component
   Quick action button with icon and label
   =================================================================== */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing, borderRadius } from '../lib/theme';

interface QuickActionProps {
  icon: string;
  label: string;
  color?: string;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({
  icon,
  label,
  color = colors.primary,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.container, { borderColor: color + '30' }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Icon name={icon} size={24} color={color} />
    <Text style={[styles.label, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});

export default QuickAction;
