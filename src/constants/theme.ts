/**
 * Spendly "Midnight" theme, in light and dark. Every screen reads these through useTheme(), so
 * changing a value here restyles the whole app.
 *
 * primary   accent for fills, icons, rings, and highlighted text
 * onPrimary text/icons drawn on top of a primary fill (dark on lime, white on the light-mode green)
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#12141A',
    background: '#F4F5F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6E8EC',
    textSecondary: '#5B6270',
    primary: '#4D7C0F',
    onPrimary: '#FFFFFF',
    border: '#E1E4E9',
    danger: '#D92D20',
    warning: '#B45309',
  },
  dark: {
    text: '#F2F4F8',
    background: '#0A0C10',
    backgroundElement: '#11151C',
    backgroundSelected: '#1E2430',
    textSecondary: '#8C96A8',
    primary: '#C6FF3D',
    onPrimary: '#0A0C10',
    border: '#232A36',
    danger: '#FF6B6B',
    warning: '#F5B83D',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Loaded in the root layout (Sora for headings and big numbers, DM Sans for everything else). */
export const Type = {
  body: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  display: 'Sora_700Bold',
  displayHeavy: 'Sora_800ExtraBold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
/** Bottom padding for scrollable screens so content clears the floating tab bar. */
export const FloatingTabInset = 108;
export const MaxContentWidth = 800;
