// MAN_HINH_270 Xác nhận đăng nhập trên thiết bị mới (CONG_VIEC_72; QUYTAC_NGHIEPVU_565; API_318).
// Mã Smart OTP lấy từ máy đang giữ Smart OTP; khách chưa kích hoạt trong thời hạn chuyển đổi thì mã SMS.
import { useState } from "react";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { AuthLayout, useAction, useResendTimer } from "./auth";
import { Button, Card, Field, Muted, Notice } from "./ui";

export function DeviceVerification() {
  const t = translator("vcommApp");
  const { deviceMethod, verifyDevice, logout } = useSession();
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const { busy, error, fields, run } = useAction(["smartOtp", "smsCode"]);
  const timer = useResendTimer();

  const sendSms = () =>
    run(async () => {
      await api("/buyer/login/device-verification/sms", { method: "POST" });
      setSmsSent(true);
      timer.start();
    });

  return (
    <AuthLayout title={t("deviceVerifyTitle")}>
      <Card>
        {error ? <Notice text={error} /> : null}
        {deviceMethod === "smart_otp" ? (
          <>
            <Muted>{t("deviceVerifySmartOtpHint")}</Muted>
            <Field label={t("deviceVerifySmartOtp")} value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={6} error={fields.smartOtp} />
            <Button label={t("verify")} busy={busy} disabled={code.length !== 6} onPress={() => void run(() => verifyDevice({ smartOtp: code }))} />
          </>
        ) : deviceMethod === "sms" ? (
          <>
            <Muted>{t("deviceVerifySmsHint")}</Muted>
            {smsSent ? (
              <>
                <Field label={t("otpCode")} value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} error={fields.smsCode} />
                <Button label={t("verify")} busy={busy} disabled={code.length !== 6} onPress={() => void run(() => verifyDevice({ smsCode: code }))} />
              </>
            ) : null}
            <Button
              label={timer.seconds > 0 ? t("resendIn", { seconds: timer.seconds }) : smsSent ? t("resend") : t("sendCode")}
              kind={smsSent ? "secondary" : "primary"}
              disabled={timer.seconds > 0}
              onPress={() => void sendSms()}
            />
          </>
        ) : (
          // Hết thời hạn chuyển đổi mà chưa kích hoạt: kích hoạt Smart OTP trên máy này theo luồng khôi phục (lát L4).
          <Notice tone="warning" text={t("deviceVerifyActivationRequired")} />
        )}
        <Button label={t("backToLogin")} kind="secondary" onPress={() => void logout()} />
      </Card>
    </AuthLayout>
  );
}
