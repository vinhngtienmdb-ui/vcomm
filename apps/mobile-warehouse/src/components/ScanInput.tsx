// Ô quét: nhận chuỗi từ máy quét cầm tay chế độ bàn phím (kèm Enter) hoặc gõ tay; giữ tiêu điểm sau mỗi lần quét. Nút camera mở lớp quét.
import { type ComponentRef, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { styles } from "@/components/ui";
import { CameraScanner } from "@/components/CameraScanner";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export function ScanInput({ onScan, placeholder, busy }: { onScan: (code: string) => void; placeholder: string; busy?: boolean }) {
  const [value, setValue] = useState("");
  const [camera, setCamera] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const submit = () => {
    const code = value.trim();
    setValue("");
    if (code) onScan(code);
    setTimeout(() => input.current?.focus(), 0);
  };
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <TextInput
          ref={input}
          accessibilityLabel={t("scanLabel")}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={setValue}
          onSubmitEditing={submit}
          submitBehavior="submit"
          returnKeyType="done"
          style={[styles.input, { flex: 1, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.medium, minHeight: 48 }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("scanCamera")}
          onPress={() => setCamera(true)}
          style={{
            minWidth: 48,
            minHeight: 48,
            paddingHorizontal: space[3],
            borderRadius: radius.medium,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "700" }}>{t("camera")}</Text>
        </Pressable>
      </View>
      {camera ? (
        <CameraScanner
          onScan={(code) => {
            onScan(code);
          }}
          onClose={() => {
            setCamera(false);
            setTimeout(() => input.current?.focus(), 0);
          }}
        />
      ) : null}
    </View>
  );
}
