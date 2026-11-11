// MAN_HINH_73 Đăng nhập (CHUC_NANG_105; API_117): số điện thoại và mật khẩu, hoặc mã OTP; mã xác thực hai lớp với tài khoản nhân viên bắt buộc.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AuthLayout, TextLink, useAction, useResendTimer } from "@/components/auth";
import { Button, Card, Choice, Field, Muted, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";

type Method = "password" | "otp";

export default function LoginScreen() {
  const t = translator("vcommApp");
  const { stage, signIn, verifyMfa, logout } = useSession();
  const { thongBao } = useLocalSearchParams<{ thongBao?: string }>();
  const [method, setMethod] = useState<Method>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [backup, setBackup] = useState(false);
  const { busy, error, fields, run } = useAction(["phone", "password", "code", "backupCode"]);
  const timer = useResendTimer();

  const sendCode = () =>
    run(async () => {
      await api("/buyer/login/otp", { method: "POST", json: { phone: phone.trim() } });
      setCodeSent(true);
      timer.start();
    });

  if (stage === "mfa" || stage === "mfaEnroll")
    return (
      <AuthLayout title={t("login")}>
        <Card>
          {error ? <Notice text={error} /> : null}
          {stage === "mfaEnroll" ? (
            <Notice tone="warning" text={t("mfaEnrollOnWeb")} />
          ) : (
            <>
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
            </>
          )}
          <Button label={t("backToLogin")} kind="secondary" onPress={() => void logout()} />
        </Card>
      </AuthLayout>
    );

  return (
    <AuthLayout title={t("login")}>
      {thongBao === "datLai" ? <Notice tone="success" text={t("resetDone")} /> : null}
      <Card>
        {error ? <Notice text={error} /> : null}
        <Choice<Method>
          label=""
          value={method}
          options={[
            { value: "password", label: t("loginByPassword") },
            { value: "otp", label: t("loginByOtp") },
          ]}
          onChange={(value) => {
            setMethod(value);
            setCode("");
          }}
        />
        <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} error={fields.phone} />
        {method === "password" ? (
          <>
            <Field label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={fields.password} />
            <Button label={t("login")} busy={busy} disabled={!phone || !password} onPress={() => void run(() => signIn("/buyer/login", { phone: phone.trim(), password }))} />
          </>
        ) : (
          <>
            {codeSent ? <Muted>{t("otpSentTo", { phone: phone.trim() })}</Muted> : null}
            {codeSent ? <Field label={t("otpCode")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} error={fields.code} /> : null}
            {codeSent ? <Button label={t("login")} busy={busy} disabled={code.length !== 6} onPress={() => void run(() => signIn("/buyer/login/otp/verify", { phone: phone.trim(), code }))} /> : null}
            <Button
              label={timer.seconds > 0 ? t("resendIn", { seconds: timer.seconds }) : codeSent ? t("resend") : t("sendCode")}
              kind={codeSent ? "secondary" : "primary"}
              busy={busy && !codeSent}
              disabled={!phone || timer.seconds > 0}
              onPress={() => void sendCode()}
            />
          </>
        )}
      </Card>
      <TextLink label={t("forgotPassword")} onPress={() => router.push("/quen-mat-khau")} />
      <Muted>{t("noAccount")}</Muted>
      <Button label={t("register")} kind="secondary" onPress={() => router.push("/dang-ky")} />
    </AuthLayout>
  );
}
