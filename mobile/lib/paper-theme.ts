import { MD3DarkTheme, configureFonts, type MD3Theme } from "react-native-paper";

import { colors } from "@/lib/theme";

const fontConfig = {
  fontFamily: "DMSans_400Regular",
} as const;

export const paperTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 16,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.accent,
    onPrimary: colors.accentInk,
    primaryContainer: "#2a3a18",
    onPrimaryContainer: colors.accent,
    secondary: colors.muted,
    onSecondary: colors.fg,
    secondaryContainer: colors.elevated,
    onSecondaryContainer: colors.fg,
    tertiary: colors.accent,
    background: colors.bg,
    onBackground: colors.fg,
    surface: colors.elevated,
    onSurface: colors.fg,
    surfaceVariant: "#1a2420",
    onSurfaceVariant: colors.muted,
    outline: colors.line,
    outlineVariant: "rgba(242, 245, 240, 0.08)",
    error: colors.danger,
    onError: colors.fg,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: colors.bg,
      level1: colors.elevated,
      level2: "#1a2420",
      level3: "#1f2a25",
      level4: "#23302a",
      level5: "#283630",
    },
  },
  fonts: configureFonts({ config: fontConfig }),
};
