// Bàn phím nhập mã PIN 6 số (MAN_HINH_283): ô chấm, phím số, xóa; đủ 6 số thì gửi.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export function PinPad({ value, onChange, onComplete, disabled }: { value: string; onChange: (value: string) => void; onComplete: (pin: string) => void; disabled?: boolean }) {
  const press = (digit: string) => {
    if (disabled || value.length >= 6) return;
    const next = value + digit;
    onChange(next);
    if (next.length === 6) onComplete(next);
  };
  return (
    <View style={{ gap: space[3] }}>
      <View style={styles.dots} accessibilityLabel={t("pinEntered", { count: value.length })}>
        {Array.from({ length: 6 }, (_, index) => (
          <View key={index} style={[styles.dot, index < value.length ? styles.dotFilled : null]} />
        ))}
      </View>
      <View style={styles.grid}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "clear"].map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === "back" ? t("pinBack") : key === "clear" ? t("pinClear") : key}
            disabled={disabled}
            onPress={() => (key === "back" ? onChange(value.slice(0, -1)) : key === "clear" ? onChange("") : press(key))}
            style={({ pressed }) => [styles.key, pressed ? { backgroundColor: colors.primaryLight } : null]}
          >
            <Text style={key === "clear" ? styles.keySmall : styles.keyText}>{key === "back" ? "⌫" : key === "clear" ? t("pinClear") : key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", justifyContent: "center", gap: space[2] },
  dot: { width: 18, height: 18, borderRadius: radius.round, borderWidth: 2, borderColor: colors.inputBorder },
  dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[2], justifyContent: "center", maxWidth: 300, alignSelf: "center" },
  key: { width: 88, height: 52, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 20, fontWeight: "700", color: colors.text },
  keySmall: { fontSize: 14, fontWeight: "600", color: colors.text },
});
