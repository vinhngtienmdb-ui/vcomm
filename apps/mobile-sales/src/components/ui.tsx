// Thành phần giao diện dùng chung của ứng dụng (màu, khoảng cách theo tài liệu 15).
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { colors, radius, space } from "@/lib/theme";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | undefined }) {
  return (
    <View style={{ gap: space[1] }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[styles.input, error ? { borderColor: colors.error } : null]} placeholderTextColor={colors.textMuted} {...input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Button({ label, onPress, busy, kind = "primary", disabled }: { label: string; onPress: () => void; busy?: boolean; kind?: "primary" | "secondary"; disabled?: boolean }) {
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, (pressed || busy || disabled) && { opacity: 0.7 }]}
    >
      {busy ? <ActivityIndicator color={primary ? colors.surface : colors.primary} /> : <Text style={primary ? styles.primaryText : styles.secondaryText}>{label}</Text>}
    </Pressable>
  );
}

export function Notice({ text, tone = "error" }: { text: string; tone?: "error" | "info" | "warning" | "success" }) {
  const palette = {
    error: [colors.errorBackground, colors.error],
    info: [colors.infoBackground, colors.info],
    warning: [colors.warningBackground, colors.warning],
    success: [colors.successBackground, colors.success],
  }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: palette[0] }]}>
      <Text style={{ color: palette[1] }}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space[6], alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: space[4], gap: space[3] },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.medium, padding: space[4], gap: space[2] },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13 },
  label: { color: colors.text, fontWeight: "600" },
  input: {
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: radius.small,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  error: { color: colors.error, fontSize: 13 },
  button: { minHeight: 44, borderRadius: radius.small, alignItems: "center", justifyContent: "center", paddingHorizontal: space[4] },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder },
  primaryText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  secondaryText: { color: colors.text, fontWeight: "600", fontSize: 16 },
  notice: { borderRadius: radius.small, padding: space[3] },
});
