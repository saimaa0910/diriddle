import { colors, radii, tokens } from '../design-system/tokens';
import { theme } from '../design-system/theme';

describe('diriddle design system tokens', () => {
  it('matches required dark mode palette colors', () => {
    expect(colors.background).toBe('#090B0F');
    expect(colors.surface).toBe('#12161D');
    expect(colors.card).toBe('#191F28');
    expect(colors.textPrimary).toBe('#F5F7FA');
    expect(colors.textSecondary).toBe('#929BA8');
    expect(colors.accent).toBe('#FF8A45');
    expect(colors.border).toBe('#262D37');
  });

  it('uses radius scale within 12-20px for cards and sheets', () => {
    expect(radii.sm).toBe(12);
    expect(radii.md).toBe(14);
    expect(radii.lg).toBe(16);
    expect(radii.xl).toBe(20);
  });

  it('exports dark navigation theme', () => {
    expect(theme.dark).toBe(true);
    expect(theme.navigationTheme.colors.primary).toBe(tokens.colors.accent);
    expect(theme.navigationTheme.colors.background).toBe(tokens.colors.background);
  });
});
