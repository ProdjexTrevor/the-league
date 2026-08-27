import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import {
  Button,
  Card,
  HelperText,
  Text,
  TextInput,
  TouchableRipple,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/lib/theme";

const HIT = 52; // comfortable one-thumb target

export function Screen({
  children,
  style,
  scroll = true,
  bottomBar,
}: {
  children: ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
  /** Sticky bottom action zone (thumb-friendly) */
  bottomBar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: bottomBar ? 24 : insets.bottom + 24 },
        style,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, style]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.limeGlow, "transparent"]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.55, y: 0.4 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
          },
        ]}
      >
        {body}
        {bottomBar ? (
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {bottomBar}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Text
      variant={compact ? "headlineMedium" : "displaySmall"}
      style={styles.brand}
    >
      THE LEAGUE
    </Text>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="headlineSmall" style={styles.pageTitle}>
      {children}
    </Text>
  );
}

export function Subtle({ children }: { children: ReactNode }) {
  return (
    <Text variant="bodyMedium" style={styles.subtle}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text variant="titleMedium" style={styles.section}>
      {children}
    </Text>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        outlineColor={colors.line}
        activeOutlineColor={colors.accent}
        textColor={colors.fg}
        style={styles.input}
        contentStyle={{ minHeight: HIT - 8 }}
        error={Boolean(error)}
        {...rest}
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}

export function BigButton({
  label,
  onPress,
  mode = "contained",
  disabled,
  icon,
  loading,
}: {
  label: string;
  onPress: () => void;
  mode?: "contained" | "outlined" | "text";
  disabled?: boolean;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      icon={icon}
      contentStyle={styles.bigBtnContent}
      labelStyle={styles.bigBtnLabel}
      style={styles.bigBtn}
      buttonColor={mode === "contained" ? colors.accent : undefined}
      textColor={mode === "contained" ? colors.accentInk : colors.fg}
    >
      {label}
    </Button>
  );
}

export function ActionTile({
  title,
  subtitle,
  meta,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.tile} mode="elevated">
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.tileRipple}
        disabled={!onPress}
      >
        <View style={styles.tileInner}>
          <View style={styles.tileMain}>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.tileSubtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {meta || onPress ? (
            <Text style={styles.tileMeta}>{meta ?? "›"}</Text>
          ) : null}
        </View>
      </TouchableRipple>
    </Card>
  );
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text variant="bodyMedium" style={styles.subtle}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <BigButton label={actionLabel} onPress={onAction} mode="outlined" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    paddingTop: 12,
    gap: 10,
  },
  brand: {
    fontFamily: "BebasNeue_400Regular",
    color: colors.fg,
    letterSpacing: 1.5,
  },
  pageTitle: {
    fontFamily: "DMSans_700Bold",
    color: colors.fg,
    marginTop: 20,
  },
  subtle: {
    fontFamily: "DMSans_400Regular",
    color: colors.muted,
    marginTop: 6,
    lineHeight: 20,
  },
  section: {
    fontFamily: "DMSans_700Bold",
    color: colors.fg,
    marginTop: 28,
    marginBottom: 10,
  },
  field: { marginTop: 12 },
  input: {
    backgroundColor: colors.elevated,
    fontSize: 16,
  },
  bigBtn: {
    borderRadius: 14,
    minHeight: HIT,
    justifyContent: "center",
  },
  bigBtnContent: {
    minHeight: HIT,
    paddingVertical: 4,
  },
  bigBtnLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  tile: {
    marginBottom: 10,
    backgroundColor: colors.elevated,
    borderRadius: 16,
    overflow: "hidden",
  },
  tileRipple: { borderRadius: 16 },
  tileInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 72,
  },
  tileMain: { flex: 1 },
  tileTitle: {
    fontFamily: "DMSans_700Bold",
    color: colors.fg,
    fontSize: 16,
  },
  tileSubtitle: {
    fontFamily: "DMSans_400Regular",
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  tileMeta: {
    color: colors.accent,
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
  },
  empty: {
    marginTop: 8,
    gap: 12,
  },
});
