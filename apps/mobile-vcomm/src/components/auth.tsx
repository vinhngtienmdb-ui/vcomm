// Phần dùng chung của các màn hình đăng nhập, đăng ký, quên mật khẩu (MAN_HINH_73 đến 75).
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Screen, Title } from "@/components/ui";
import { ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <View style={{ paddingVertical: space[5], gap: space[1] }}>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800" }}>{t("appName")}</Text>
            <Title>{title}</Title>
          </View>
          {children}
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Gọi một thao tác, giữ lỗi chung và lỗi theo ô để hiện dưới từng ô nhập.
// shownFields: các ô đang hiện trên màn hình; lỗi của ô không hiện thì đưa lên thông báo chung để người dùng vẫn thấy.
export function useAction(shownFields: readonly string[] = []) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      setFields({});
      try {
        await action();
      } catch (failure) {
        if (failure instanceof ApiFailure && Object.keys(failure.fields).length > 0) {
          setFields(failure.fields);
          const hidden = Object.entries(failure.fields).filter(([field]) => !shownFields.includes(field));
          if (hidden.length > 0) setError(hidden.map(([, message]) => message).join(" "));
        } else setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shownFields.join(",")],
  );
  return { busy, error, fields, run };
}

// Đếm ngược 60 giây trước khi cho gửi lại mã OTP (QUYTAC_NGHIEPVU_141).
export function useResendTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: () => setSeconds(60) };
}

// Nút chữ dẫn sang màn hình khác.
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2], textAlign: "center" }}>
      {label}
    </Text>
  );
}
