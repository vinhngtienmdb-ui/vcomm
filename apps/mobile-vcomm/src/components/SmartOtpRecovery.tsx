// MAN_HINH_271 Khôi phục Smart OTP khi mất máy (CONG_VIEC_72; QUYTAC_NGHIEPVU_566; API_199).
// Sau khi đăng nhập bằng mật khẩu trên máy mới: mã SMS gửi về số của tài khoản → kích hoạt Smart OTP trên máy này → đặt mã khóa.
// Máy cũ hết hiệu lực; mọi giao dịch dùng điểm tạm khóa theo số giờ cài đặt (mặc định 24); tích điểm vẫn bình thường.
import type { SmartOtpActivationResponse } from "contracts";
import { useState } from "react";
import { Platform } from "react-native";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { currentDeviceName, currentPlatform, saveSmartOtp } from "@/lib/smart-otp";
import { useAction, useResendTimer } from "./auth";
import { SetPinFlow } from "./SmartOtpLock";
import { Button, Field, Muted, Notice } from "./ui";

const t = translator("vcommApp");
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

export function SmartOtpRecovery({ phone, onDone, onCancel }: { phone: string | null; onDone: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<"intro" | "code" | "pin" | "done">("intro");
  const [code, setCode] = useState("");
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const { busy, error, fields, run } = useAction(["code"]);
  const timer = useResendTimer();

  const sendCode = () =>
    run(async () => {
      await api("/buyer/loyalty/smart-otp/send-code", { method: "POST" });
      setStep("code");
      timer.start();
    });
  const activate = () =>
    run(async () => {
      const activated = await api<SmartOtpActivationResponse>("/buyer/loyalty/smart-otp/activate", {
        method: "POST",
        json: { code, deviceName: currentDeviceName(), platform: currentPlatform() },
      });
      await saveSmartOtp({ secret: activated.secret, activatedAt: activated.activatedAt! });
      setLockedUntil(activated.redeemLockedUntil);
      setStep("pin");
    });

  // Bản web không giữ được Smart OTP (QUYTAC_NGHIEPVU_562): hướng dẫn khôi phục trên ứng dụng điện thoại.
  if (Platform.OS === "web")
    return (
      <>
        <Notice tone="warning" text={t("recoveryWebOnly")} />
        <Button label={t("cancel")} kind="secondary" onPress={onCancel} />
      </>
    );
  if (step === "pin") return <SetPinFlow phone={phone} onDone={() => setStep("done")} />;
  if (step === "done")
    return (
      <>
        <Notice tone="success" text={t("recoveryDone")} />
        {lockedUntil ? <Notice tone="warning" text={t("smartOtpRedeemLocked", { time: time(lockedUntil) })} /> : null}
        <Button label={t("continue")} onPress={onDone} />
      </>
    );
  return (
    <>
      {error ? <Notice text={error} /> : null}
      <Notice tone="warning" text={t("recoveryWarning")} />
      {step === "code" ? (
        <>
          <Muted>{t("recoveryCodeSent")}</Muted>
          <Field label={t("otpCode")} value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} error={fields.code} />
          <Button label={t("recoveryActivate")} busy={busy} disabled={code.length !== 6} onPress={() => void activate()} />
          <Button label={timer.seconds > 0 ? t("resendIn", { seconds: timer.seconds }) : t("resend")} kind="secondary" disabled={timer.seconds > 0} onPress={() => void sendCode()} />
        </>
      ) : (
        <Button label={t("recoverySendCode")} busy={busy} onPress={() => void sendCode()} />
      )}
      <Muted>{t("recoveryNoPhone")}</Muted>
      <Button label={t("cancel")} kind="secondary" onPress={onCancel} />
    </>
  );
}
