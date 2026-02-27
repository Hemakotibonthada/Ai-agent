/* ===================================================================
   Nexus AI OS — GaugeChart Component
   SVG-based circular gauge for temperature, humidity, scores, etc.
   =================================================================== */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../lib/theme';

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
}

const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max,
  label,
  unit,
  color = colors.primary,
  size = 100,
  strokeWidth = 8,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>

      {/* Center label */}
      <View style={[styles.labelWrap, { width: size, height: size }]}>
        <Text style={[styles.value, { color, fontSize: size * 0.22 }]}>
          {Math.round(value)}
        </Text>
        <Text style={[styles.unit, { fontSize: size * 0.11 }]}>
          {unit}
        </Text>
      </View>

      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  labelWrap: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '700',
  },
  unit: {
    color: colors.muted,
    fontWeight: '500',
    marginTop: -2,
  },
  label: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default GaugeChart;
