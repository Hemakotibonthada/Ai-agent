/* ===================================================================
   Nexus AI OS — Header Component
   Gradient background header with title and action buttons
   =================================================================== */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, typography, spacing } from '../lib/theme';

interface HeaderProps {
  title: string;
  leftIcon?: string;
  rightIcon?: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  title, leftIcon, rightIcon, onLeftPress, onRightPress,
}) => (
  <LinearGradient
    colors={[colors.surface, colors.background]}
    style={styles.container}
    start={{ x: 0, y: 0 }}
    end={{ x: 0, y: 1 }}
  >
    <View style={styles.left}>
      {leftIcon && (
        <TouchableOpacity style={styles.iconBtn} onPress={onLeftPress}>
          <Icon name={leftIcon} size={22} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>

    <Text style={styles.title} numberOfLines={1}>
      {title}
    </Text>

    <View style={styles.right}>
      {rightIcon && (
        <TouchableOpacity style={styles.iconBtn} onPress={onRightPress}>
          <Icon name={rightIcon} size={22} color={colors.text} />
        </TouchableOpacity>
      )}
    </View>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { width: 40 },
  right: { width: 40, alignItems: 'flex-end' },
  title: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBackground,
  },
});

export default Header;
