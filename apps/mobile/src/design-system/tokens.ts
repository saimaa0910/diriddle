export const colors = {
  background: '#090B0F',
  surface: '#12161D',
  card: '#191F28',
  cardElevated: '#1F2631',
  textPrimary: '#F5F7FA',
  textSecondary: '#929BA8',
  textMuted: '#636D7A',
  accent: '#FF8A45',
  accentMuted: 'rgba(255, 138, 69, 0.16)',
  accentBorder: 'rgba(255, 138, 69, 0.35)',
  border: '#262D37',
  borderSubtle: '#1B212A',
  success: '#34D399',
  successMuted: 'rgba(52, 211, 153, 0.15)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.15)',
  danger: '#F87171',
  dangerMuted: 'rgba(248, 113, 113, 0.15)',
  info: '#60A5FA',
  infoMuted: 'rgba(96, 165, 250, 0.15)',
  overlay: 'rgba(9, 11, 15, 0.82)',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  subtitle: { fontSize: 17, fontWeight: '600' as const, lineHeight: 23 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
} as const;

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
} as const;
