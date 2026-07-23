import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import { colors, spacing } from "@/lib/theme";

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function BrandTitle() {
  return <Text style={styles.brand}>THE LEAGUE</Text>;
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.card}>
        {children}
      </Pressable>
    );
  }
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  brand: {
    fontFamily: "BebasNeue_400Regular",
    fontSize: 40,
    color: colors.fg,
    letterSpacing: 1,
  },
  heading: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: colors.fg,
    marginTop: spacing.lg,
  },
  muted: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  field: { marginTop: spacing.md },
  label: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.elevated,
    color: colors.fg,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    fontFamily: "DMSans_700Bold",
    color: colors.accentInk,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.elevated,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 4,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});
