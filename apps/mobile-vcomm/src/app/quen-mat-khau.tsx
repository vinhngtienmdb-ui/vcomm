// MAN_HINH_75 Quên mật khẩu (CHUC_NANG_105; API_117; QUYTAC_NGHIEPVU_147): mã xác thực rồi mật khẩu mới; đặt xong thu hồi mọi phiên cũ.
// CONG_VIEC_72 (QUYTAC_NGHIEPVU_568): mã Smart OTP là cách chính (máy đang giữ Smart OTP tự điền sau khi mở khóa);
// mã SMS chỉ dành cho khách chưa kích hoạt Smart OTP, trong thời hạn chuyển đổi.
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AuthLayout, TextLink, useAction, useResendTimer } from "@/components/auth";
import { UnlockFlow } from "@/components/SmartOtpLock";
import { Button, Card, Field, Muted, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { codeOf, loadSmartOtp } from "@/lib/smart-otp";

type Method = "smartOtp" | "sms";

export default function ForgotPasswordScreen() {
  const t = translator("vcommApp");
  const [method, setMethod] = useState<Method>("smartOtp");
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [holdsSmartOtp, setHoldsSmartOtp] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, fields, run } = useAction(["phone", "code", "password"]);
  const timer = useResendTimer();

  // Máy này đang giữ Smart OTP (đã đặt mã khóa) thì cho lấy mã ngay trên máy.
  useEffect(() => {
    void loadSmartOtp().then((stored) => setHoldsSmartOtp(Boolean(stored?.pin)));
  }, []);

  const sendCode = () =>
    run(async () => {
      await api("/buyer/password-reset/otp", { method: "POST", json: { phone: phone.trim() } });
      setCodeSent(true);
      timer.start();
    });

  const submit = () =>
    run(async () => {
      await api("/buyer/password-reset", { method: "POST", json: { phone: phone.trim(), password, ...(method === "smartOtp" ? { smartOtp: code } : { code }) } });
      router.replace({ pathname: "/dang-nhap", params: { thongBao: "datLai" } });
    });

  if (unlocking)
    return (
      <AuthLayout title={t("resetPassword")}>
        <Card>
          <UnlockFlow
            onUnlocked={(stored) => {
              setCode(codeOf(stored.secret, Date.now()));
              setUnlocking(false);
            }}
            onLockedOut={() => {
              setHoldsSmartOtp(false);
              setUnlocking(false);
              setNotice(t("smartOtpLockedOut"));
            }}
          />
          <Button label={t("cancel")} kind="secondary" onPress={() => setUnlocking(false)} />
        </Card>
      </AuthLayout>
    );

  return (
    <AuthLayout title={t("resetPassword")}>
      <Card>
        {error ? <Notice text={error} /> : null}
        {notice ? <Notice tone="warning" text={notice} /> : null}
        <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} editable={!codeSent} error={fields.phone} />
        {method === "smartOtp" ? (
          <>
            <Field
              label={t("resetSmartOtp")}
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder={t("resetSmartOtpPlaceholder")}
              error={fields.code}
            />
            {holdsSmartOtp ? (
              <>
                <Muted>{t("resetSmartOtpHere")}</Muted>
                <Button label={t("resetSmartOtpTake")} kind="secondary" onPress={() => setUnlocking(true)} />
              </>
            ) : null}
            <Field label={t("newPassword")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={fields.password} />
            <Muted>{t("passwordHint")}</Muted>
            <Button label={t("resetPassword")} busy={busy} disabled={!phone || code.length !== 6 || !password} onPress={() => void submit()} />
            <TextLink
              label={t("resetBySms")}
              onPress={() => {
                setMethod("sms");
                setCode("");
              }}
            />
          </>
        ) : (
          <>
            <Muted>{t("resetBySmsHint")}</Muted>
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
            <TextLink
              label={t("resetBySmartOtp")}
              onPress={() => {
                setMethod("smartOtp");
                setCode("");
              }}
            />
          </>
        )}
      </Card>
      <TextLink label={t("backToLogin")} onPress={() => router.replace("/dang-nhap")} />
    </AuthLayout>
  );
}
