// MAN_HINH_105 Đăng nhập (CHUC_NANG_159; API_137): tài khoản nhân viên, mật khẩu; mã xác thực hai lớp như web (QUYTAC_NGHIEPVU_280).
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Header } from "@/components/Header";
import { Button, Card, Field, Muted, Notice, Screen, Title } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/lib/theme";

export default function LoginScreen() {
  const { stage, signIn, verifyMfa, logout } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const { busy, error, fields, run } = useAction();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title={t("appName")} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          <View style={{ paddingVertical: space[3] }}>
            <Title>{t("login")}</Title>
          </View>
          {error && !Object.keys(fields).length ? <Notice text={error} /> : null}
          {stage === "mfaEnroll" ? (
            <Card>
              <Notice tone="info" text={t("mfaEnrollOnWeb")} />
              <Button label={t("backToLogin")} kind="secondary" onPress={() => void logout()} />
            </Card>
          ) : stage === "mfa" ? (
            <Card>
              <Text style={{ fontWeight: "700" }}>{t("mfaStep")}</Text>
              <Muted>{backup ? t("backupHint") : t("mfaHint")}</Muted>
              <Field
                label={backup ? t("backupCode") : t("mfaCode")}
                value={code}
                onChangeText={setCode}
                keyboardType={backup ? "default" : "number-pad"}
                maxLength={backup ? 20 : 6}
                error={fields.code ?? fields.backupCode}
              />
              <Button label={t("verify")} busy={busy} onPress={() => void run(() => verifyMfa(code.trim(), backup))} />
              <Button label={backup ? t("useAuthenticator") : t("useBackup")} kind="secondary" onPress={() => setBackup(!backup)} />
              <Button label={t("backToLogin")} kind="secondary" onPress={() => void logout()} />
            </Card>
          ) : (
            <Card>
              <Field label={t("identifier")} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" error={fields.identifier} />
              <Field
                label={t("password")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={fields.password}
                onSubmitEditing={() => void run(() => signIn(identifier.trim(), password))}
              />
              <Button label={t("login")} busy={busy} onPress={() => void run(() => signIn(identifier.trim(), password))} />
            </Card>
          )}
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
