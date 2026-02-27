/* ===================================================================
   Nexus AI OS — Mobile Theme Constants
   Matches the desktop app's futuristic dark theme
   =================================================================== */

export const colors = {
  /* Core palette */
  primary: '#3B82F6',
  primaryLight: '#5F9BF7',
  primaryDark: '#084BB8',
  secondary: '#8B5CF6',
  secondaryLight: '#AB8DF9',
  secondaryDark: '#5211D4',
  accent: '#06B6D4',
  accentLight: '#2CD2F0',

  /* Surfaces */
  background: '#0F0F1A',
  surface: '#1E1E2E',
  card: '#252538',
  cardElevated: '#2C2C44',
  border: '#2E2E45',
  borderLight: '#3D3D5C',

  /* Text */
  text: '#E2E8F0',
  textSecondary: '#CBD5E1',
  muted: '#94A3B8',
  placeholder: '#64748B',

  /* Semantic */
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#3B82F6',

  /* Gradients (start, end) */
  gradientPrimary: ['#3B82F6', '#8B5CF6'] as const,
  gradientAccent: ['#06B6D4', '#3B82F6'] as const,
  gradientSurface: ['#1E1E2E', '#252538'] as const,
  gradientDanger: ['#EF4444', '#DC2626'] as const,

  /* Overlays */
  overlay: 'rgba(0, 0, 0, 0.6)',
  glassBackground: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5 },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.3 },
  button: { fontSize: 15, fontWeight: '600' as const },
  mono: { fontFamily: 'monospace', fontSize: 13 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
