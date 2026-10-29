import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.primary }],
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Custom fonts have one file per weight, so weight is chosen by family, not by fontWeight.
const styles = StyleSheet.create({
  small: { fontFamily: Type.body, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: Type.bodyBold, fontSize: 14, lineHeight: 20 },
  default: { fontFamily: Type.body, fontSize: 16, lineHeight: 24 },
  title: { fontFamily: Type.display, fontSize: 44, lineHeight: 50 },
  subtitle: { fontFamily: Type.display, fontSize: 28, lineHeight: 36, letterSpacing: -0.5 },
  link: { fontFamily: Type.body, lineHeight: 30, fontSize: 14 },
  linkPrimary: { fontFamily: Type.bodyBold, lineHeight: 30, fontSize: 14 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
