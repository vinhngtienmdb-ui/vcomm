// MAN_HINH_74 Đăng ký (CHUC_NANG_104; API_116; QUYTAC_NGHIEPVU_141, 142): bước 1 số điện thoại, mã giới thiệu; bước 2 mã OTP, họ tên, mật khẩu.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { AuthLayout, TextLink, useAction, useResendTimer } from "@/components/auth";
import { Button, Card, Field, Muted, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";

export default function RegisterScreen() {
  const t = translator("vcommApp");
  const { signIn } = useSession();
  const { ma } = useLocalSearchParams<{ ma?: string }>();
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState(typeof ma === "string" ? ma : "");
  const [step, setStep] = useState<"phone" | "details">("phone");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, fields, run } = useAction();
  const timer = useResendTimer();

  const sendCode = () =>
    run(async () => {
      await api("/buyer/register/otp", { method: "POST", json: { phone: phone.trim() } });
      setStep("details");
      timer.start();
    });

  const submit = () =>
    run(async () => {
      await signIn("/buyer/register", { phone: phone.trim(), code, fullName: fullName.trim(), password, referralCode: referralCode.trim() || null });
    });

  return (
    <AuthLayout title={t("register")}>
      <Card>
        {error ? <Notice text={error} /> : null}
        {step === "phone" ? (
          <>
            <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} error={fields.phone} />
            <Muted>{t("phoneIsCode")}</Muted>
            <Field label={t("referralCode")} value={referralCode} onChangeText={setReferralCode} keyboardType="phone-pad" maxLength={15} error={fields.referralCode} />
            <Muted>{t("referralHint")}</Muted>
            <Button label={t("sendCode")} busy={busy} disabled={!phone} onPress={() => void sendCode()} />
          </>
        ) : (
          <>
            <Muted>{t("otpSentTo", { phone: phone.trim() })}</Muted>
            <Field label={t("otpCode")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} error={fields.code} />
            <Field label={t("fullName")} value={fullName} onChangeText={setFullName} autoComplete="name" maxLength={100} error={fields.fullName} />
            <Field label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={fields.password} />
            <Muted>{t("passwordHint")}</Muted>
            <Field label={t("referralCode")} value={referralCode} onChangeText={setReferralCode} keyboardType="phone-pad" maxLength={15} error={fields.referralCode} />
            <Button label={t("createAccount")} busy={busy} disabled={code.length !== 6 || !fullName.trim() || !password} onPress={() => void submit()} />
            <Button label={timer.seconds > 0 ? t("resendIn", { seconds: timer.seconds }) : t("resend")} kind="secondary" disabled={timer.seconds > 0} onPress={() => void sendCode()} />
            <TextLink label={t("changePhone")} onPress={() => setStep("phone")} />
          </>
        )}
      </Card>
      <TextLink label={t("haveAccount")} onPress={() => router.replace("/dang-nhap")} />
    </AuthLayout>
  );
}
