import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/lib/theme";

export function Screen({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.limeGlow, "transparent"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.6, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[colors.greenGlow, "transparent"]}
        start={{ x: 0.95, y: 0 }}
        end={{ x: 0.4, y: 0.4 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          styles.screen,
          padded && {
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 8,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function BrandTitle({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Text style={[styles.brand, size === "lg" ? styles.brandLg : styles.brandMd]}>
      THE LEAGUE
    </Text>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <Text style={[styles.muted, style as object]}>{children}</Text>;
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
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled, style]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
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
      style={[styles.secondaryButton, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

/** Web-style row in a bordered divide-y list */
export function ListRow({
  title,
  subtitle,
  meta,
  metaAccent,
  onPress,
  isFirst,
  isLast,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  metaAccent?: boolean;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const body = (
    <View
      style={[
        styles.listRow,
        isFirst && styles.listRowFirst,
        isLast && styles.listRowLast,
      ]}
    >
      <View style={styles.listRowMain}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {meta ? (
        <Text style={[styles.listRowMeta, metaAccent && { color: colors.accent }]}>
          {meta}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: "rgba(242,245,240,0.03)" }}>
        {body}
      </Pressable>
    );
  }
  return body;
}

export function ListSection({ children }: { children: React.ReactNode }) {
  return <View style={styles.listSection}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  brand: {
    fontFamily: "BebasNeue_400Regular",
    color: colors.fg,
    letterSpacing: 1.2,
  },
  brandMd: { fontSize: 28 },
  brandLg: { fontSize: 36 },
  heading: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: colors.fg,
    marginTop: 40,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: colors.fg,
    marginTop: spacing.section,
  },
  muted: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 20,
  },
  field: { marginTop: 16 },
  label: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.elevated,
    color: colors.fg,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    fontFamily: "DMSans_700Bold",
    color: colors.accentInk,
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontFamily: "DMSans_700Bold",
    color: colors.fg,
    fontSize: 14,
  },
  listSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  listRowFirst: { borderTopWidth: 0 },
  listRowLast: {},
  listRowMain: { flex: 1, minWidth: 0 },
  listRowTitle: {
    fontFamily: "DMSans_500Medium",
    fontSize: 16,
    color: colors.fg,
  },
  listRowSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
  listRowMeta: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingTop: 2,
  },
});
