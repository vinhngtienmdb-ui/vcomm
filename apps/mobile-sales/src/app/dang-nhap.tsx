// MAN_HINH_66 Đăng nhập ứng dụng (CHUC_NANG_99; API_112; QUYTAC_NGHIEPVU_136): thư điện tử, mật khẩu; mã xác thực hai lớp hoặc mã dự phòng.
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Button, Card, Field, Muted, Notice, Screen, Title } from "@/components/ui";
import { ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

export default function LoginScreen() {
  const t = translator("salesApp");
  const { stage, login, verifyMfa, logout } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Screen>
          <View style={{ paddingVertical: space[5], gap: space[1] }}>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "800" }}>VComm</Text>
            <Title>{t("appName")}</Title>
          </View>
          <Card>
            {error ? <Notice text={error} /> : null}
            {stage === "mfaEnroll" ? (
              <>
                <Notice tone="warning" text={t("mfaEnrollOnWeb")} />
                <Button label={t("backToLogin")} kind="secondary" onPress={() => void logout()} />
              </>
            ) : stage === "mfa" ? (
              <>
                <Muted>{backup ? t("backupHint") : t("mfaHint")}</Muted>
                <Field
                  label={backup ? t("backupCode") : t("mfaCode")}
                  value={code}
                  onChangeText={setCode}
                  keyboardType={backup ? "default" : "number-pad"}
                  autoComplete="one-time-code"
                  maxLength={backup ? 20 : 6}
                />
                <Button label={t("verify")} busy={busy} onPress={() => void run(() => verifyMfa(code.trim(), backup))} />
                <Button label={backup ? t("useAuthenticator") : t("useBackup")} kind="secondary" onPress={() => setBackup(!backup)} />
                <Button label={t("backToLogin")} kind="secondary" onPress={() => void logout()} />
              </>
            ) : (
              <>
                <Field label={t("identifier")} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Field label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
                <Button label={t("login")} busy={busy} disabled={!identifier || !password} onPress={() => void run(() => login(identifier.trim(), password))} />
              </>
            )}
          </Card>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
