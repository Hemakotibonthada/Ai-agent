/* ===================================================================
   Nexus AI OS — Card Component
   Reusable dark-themed card with shadow and border radius
   =================================================================== */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius as br, shadows } from '../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

const Card: React.FC<CardProps> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: br.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 0,
    ...shadows.card,
  },
});

export default Card;
