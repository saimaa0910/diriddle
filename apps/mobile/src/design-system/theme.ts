import { tokens } from './tokens';

export const theme = {
  dark: true,
  colors: tokens.colors,
  spacing: tokens.spacing,
  radii: tokens.radii,
  typography: tokens.typography,
  navigationTheme: {
    dark: true,
    colors: {
      primary: tokens.colors.accent,
      background: tokens.colors.background,
      card: tokens.colors.surface,
      text: tokens.colors.textPrimary,
      border: tokens.colors.border,
      notification: tokens.colors.accent,
    },
  },
} as const;

export type AppTheme = typeof theme;

