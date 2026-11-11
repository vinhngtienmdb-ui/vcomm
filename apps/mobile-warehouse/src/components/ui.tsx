// Thành phần giao diện dùng chung của ứng dụng kho, chép từ apps/mobile-vcomm (màu, khoảng cách theo tài liệu 15).
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
  stepper: { width: 40, height: 44, borderRadius: radius.small, borderWidth: 1, borderColor: colors.inputBorder, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  stepperText: { fontSize: 20, fontWeight: "700", color: colors.text },
  chip: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.round, paddingHorizontal: space[3], paddingVertical: space[2], minHeight: 40, justifyContent: "center" },
});

// Chọn một trong ít lựa chọn (kênh, kho): các nút xếp hàng.
export function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <View style={{ gap: space[1] }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.chip, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
            >
              <Text style={{ color: selected ? colors.surface : colors.text, fontWeight: "600" }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function StatusBadge({ text, tone }: { text: string; tone: "success" | "warning" | "error" | "neutral" | "info" }) {
  const palette = {
    success: [colors.successBackground, colors.success],
    warning: [colors.warningBackground, colors.warning],
    error: [colors.errorBackground, colors.error],
    info: [colors.infoBackground, colors.info],
    neutral: [colors.border, colors.textMuted],
  }[tone];
  return (
    <View style={{ backgroundColor: palette[0], borderRadius: radius.round, paddingHorizontal: space[2], paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: palette[1], fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

// Tăng giảm số lượng; ô nhập cho phép gõ số thập phân.
export function QuantityInput({ value, onChange, label, minimum = 0 }: { value: string; onChange: (value: string) => void; label: string; minimum?: number }) {
  const step = (delta: number) => onChange(String(Math.max(minimum, (Number(value.replace(",", ".")) || 0) + delta)));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} −`} onPress={() => step(-1)} style={styles.stepper}>
        <Text style={styles.stepperText}>−</Text>
      </Pressable>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" style={[styles.input, { width: 64, textAlign: "center", paddingHorizontal: space[1] }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +`} onPress={() => step(1)} style={styles.stepper}>
        <Text style={styles.stepperText}>+</Text>
      </Pressable>
    </View>
  );
}

// Ô chọn trong hộp thoại đơn giản: danh sách nút.
export function OptionList<T>({ items, label, onPick }: { items: T[]; label: (item: T) => string; onPick: (item: T) => void }) {
  return (
    <View style={{ gap: space[2] }}>
      {items.map((item, index) => (
        <Pressable key={index} accessibilityRole="button" onPress={() => onPick(item)} style={[styles.chip, { borderRadius: radius.small }]}>
          <Text style={{ color: colors.text }}>{label(item)}</Text>
        </Pressable>
      ))}
    </View>
  );
}
