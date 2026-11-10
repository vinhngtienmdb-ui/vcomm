// MAN_HINH_75 Quên mật khẩu (CHUC_NANG_105; API_117; QUYTAC_NGHIEPVU_147): mã OTP rồi mật khẩu mới; đặt xong thu hồi mọi phiên cũ.
import { router } from "expo-router";
import { useState } from "react";
import { AuthLayout, TextLink, useAction, useResendTimer } from "@/components/auth";
import { Button, Card, Field, Muted, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";

export default function ForgotPasswordScreen() {
  const t = translator("vcommApp");
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, fields, run } = useAction();
  const timer = useResendTimer();

  const sendCode = () =>
    run(async () => {
      await api("/buyer/password-reset/otp", { method: "POST", json: { phone: phone.trim() } });
      setCodeSent(true);
      timer.start();
    });

  const submit = () =>
    run(async () => {
      await api("/buyer/password-reset", { method: "POST", json: { phone: phone.trim(), code, password } });
      router.replace({ pathname: "/dang-nhap", params: { thongBao: "datLai" } });
    });

  return (
    <AuthLayout title={t("resetPassword")}>
      <Card>
        {error ? <Notice text={error} /> : null}
        <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} editable={!codeSent} error={fields.phone} />
        {codeSent ? (
          <>
            <Muted>{t("otpSentTo", { phone: phone.trim() })}</Muted>
            <Field label={t("otpCode")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} error={fields.code} />
            <Field label={t("newPassword")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={fields.password} />
            <Muted>{t("passwordHint")}</Muted>
            <Button label={t("resetPassword")} busy={busy} disabled={code.length !== 6 || !password} onPress={() => void submit()} />
          </>
        ) : null}
        <Button
          label={timer.seconds > 0 ? t("resendIn", { seconds: timer.seconds }) : codeSent ? t("resend") : t("sendCode")}
          kind={codeSent ? "secondary" : "primary"}
          busy={busy && !codeSent}
          disabled={!phone || timer.seconds > 0}
          onPress={() => void sendCode()}
        />
      </Card>
      <TextLink label={t("backToLogin")} onPress={() => router.replace("/dang-nhap")} />
    </AuthLayout>
  );
}
