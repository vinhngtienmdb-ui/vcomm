// Thẻ Smart OTP trong Điểm thưởng (MAN_HINH_151 bổ sung; CONG_VIEC_53 lát L6; CONG_VIEC_72 QUYTAC_NGHIEPVU_562, 563; API_199, API_319).
// Kích hoạt lần đầu bằng mã SMS; khóa TOTP lưu trong bộ nhớ an toàn của máy; xem mã phải mở bằng vân tay, khuôn mặt hoặc mã khóa 6 số.
// Chuyển sang máy mới bằng mã đang hiện trên máy cũ (không SMS). Bản web không kích hoạt được.
import type { SmartOtpActivationResponse, SmartOtpStatusResponse } from "contracts";
import { useCallback, useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { biometricAvailable, codeOf, currentDeviceName, currentPlatform, loadSmartOtp, saveSmartOtp, type StoredSmartOtp, unlockSeconds } from "@/lib/smart-otp";
import { colors, radius, space } from "@/lib/theme";
import { SetPinFlow, UnlockFlow } from "./SmartOtpLock";
import { Button, Card, Field, Muted, Notice } from "./ui";

const t = translator("vcommApp");
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
const day = (value: string) => value.split("-").reverse().join("/");

type Step = "idle" | "sms" | "transfer" | "setPin" | "changePin" | "unlock";

export function SmartOtpCard({ phone }: { phone: string | null }) {
  const [status, setStatus] = useState<SmartOtpStatusResponse | null>(null);
  const [stored, setStored] = useState<StoredSmartOtp | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unlockedUntil, setUnlockedUntil] = useState(0);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
  const web = Platform.OS === "web";

  const reload = useCallback(() => {
    Promise.all([api<SmartOtpStatusResponse>("/buyer/loyalty/smart-otp"), loadSmartOtp(), biometricAvailable()])
      .then(([loaded, local, biometric]) => {
        setStatus(loaded);
        setStored(local);
        setCanUseBiometric(biometric);
      })
      .catch(fail);
  }, []);
  useEffect(reload, [reload]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Máy này giữ đúng khóa đang hiệu lực khi thời điểm kích hoạt khớp máy chủ.
  const onThisDevice = Boolean(status?.active && stored && stored.activatedAt === status.activatedAt);
  // Khách đã kích hoạt trước bản cập nhật chưa có mã khóa: lần mở đầu tiên phải đặt (QUYTAC_NGHIEPVU_563).
  const needsPin = onThisDevice && !web && !stored?.pin;

  async function keep(activated: SmartOtpActivationResponse) {
    await saveSmartOtp({ secret: activated.secret, activatedAt: activated.activatedAt! });
    setCode("");
    setStep("setPin");
    reload();
  }

  const action = (work: () => Promise<void>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  };
  const sendCode = action(async () => {
    await api("/buyer/loyalty/smart-otp/send-code", { method: "POST" });
    setStep("sms");
  });
  const activate = action(async () =>
    keep(await api<SmartOtpActivationResponse>("/buyer/loyalty/smart-otp/activate", { method: "POST", json: { code, deviceName: currentDeviceName(), platform: currentPlatform() } })),
  );
  const transfer = action(async () =>
    keep(await api<SmartOtpActivationResponse>("/buyer/loyalty/smart-otp/transfer", { method: "POST", json: { code, deviceName: currentDeviceName(), platform: currentPlatform() } })),
  );
  const revoke = action(async () => {
    await api("/buyer/loyalty/smart-otp", { method: "DELETE" });
    await saveSmartOtp(null);
    setUnlockedUntil(0);
    reload();
  });
  const toggleBiometric = action(async () => {
    if (stored) await saveSmartOtp({ ...stored, biometric: !stored.biometric });
    reload();
  });

  if (!status) return null;
  const shown = onThisDevice && stored && now < unlockedUntil;
  const remaining = 30 - (Math.floor(now / 1000) % 30);
  const otp = shown ? codeOf(stored.secret, now) : null;
  const lockedOut = () => {
    setStep("idle");
    setNotice(t("smartOtpLockedOut"));
    reload();
  };
  const pinFinished = () => {
    setStep("idle");
    setNotice(t("smartOtpReady"));
    reload();
  };

  return (
    <Card>
      <Text style={{ fontWeight: "700", color: colors.text }}>{t("smartOtpTitle")}</Text>
      {error ? <Notice text={error} /> : null}
      {notice ? <Notice tone="success" text={notice} /> : null}
      {status.redeemLockedUntil ? <Notice tone="warning" text={t("smartOtpRedeemLocked", { time: time(status.redeemLockedUntil) })} /> : null}
      {status.lockedUntil ? <Notice text={t("smartOtpLocked", { time: time(status.lockedUntil) })} /> : null}

      {web ? (
        // Bản web: chỉ xem trạng thái; Smart OTP kích hoạt trên trình duyệt trước đây còn dùng đến hết thời hạn chuyển đổi.
        <View style={{ gap: space[2] }}>
          <Muted>{t("smartOtpWebOnly")}</Muted>
          {status.active && status.platform === "web" ? <Notice tone="warning" text={t("smartOtpWebExpires", { date: day(status.transitionEndsOn) })} /> : null}
          {status.active && status.platform !== "web" ? <Muted>{t("smartOtpDevice", { device: status.deviceName ?? "", date: time(status.activatedAt!) })}</Muted> : null}
        </View>
      ) : step === "setPin" || needsPin ? (
        <View style={{ gap: space[2] }}>
          {needsPin && step !== "setPin" ? <Notice tone="info" text={t("smartOtpPinRequired")} /> : null}
          <SetPinFlow phone={phone} onDone={pinFinished} />
        </View>
      ) : step === "changePin" ? (
        <View style={{ gap: space[2] }}>
          <UnlockFlow onUnlocked={() => setStep("setPin")} onLockedOut={lockedOut} />
          <Button label={t("cancel")} kind="secondary" onPress={() => setStep("idle")} />
        </View>
      ) : step === "unlock" ? (
        <View style={{ gap: space[2] }}>
          <UnlockFlow
            onUnlocked={() => {
              setUnlockedUntil(Date.now() + unlockSeconds * 1000);
              setStep("idle");
            }}
            onLockedOut={lockedOut}
          />
          <Button label={t("cancel")} kind="secondary" onPress={() => setStep("idle")} />
        </View>
      ) : onThisDevice && stored ? (
        <View style={{ gap: space[2] }}>
          {otp ? (
            <>
              <Text accessibilityLabel={t("smartOtpCodeLabel", { code: otp.split("").join(" ") })} style={{ fontSize: 40, fontWeight: "800", letterSpacing: 8, textAlign: "center", color: colors.text }}>
                {`${otp.slice(0, 3)} ${otp.slice(3)}`}
              </Text>
              <View style={{ height: 6, borderRadius: radius.round, backgroundColor: colors.border, overflow: "hidden" }}>
                <View style={{ height: 6, width: `${(remaining / 30) * 100}%`, backgroundColor: colors.primary }} />
              </View>
              <Muted>{t("smartOtpUseHidden", { seconds: remaining, hide: Math.max(0, Math.ceil((unlockedUntil - now) / 1000)) })}</Muted>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 40, fontWeight: "800", letterSpacing: 8, textAlign: "center", color: colors.textMuted }}>{"••• •••"}</Text>
              <Button label={t("smartOtpShow")} onPress={() => setStep("unlock")} />
            </>
          )}
          <Muted>{t("smartOtpDevice", { device: status.deviceName ?? "", date: time(status.activatedAt!) })}</Muted>
          {canUseBiometric ? (
            <Button label={stored.biometric ? t("smartOtpBiometricOff") : t("smartOtpBiometricOn")} kind="secondary" busy={busy} onPress={() => void toggleBiometric()} />
          ) : null}
          <Button label={t("smartOtpChangePin")} kind="secondary" onPress={() => setStep("changePin")} />
          <Button label={t("smartOtpRevoke")} kind="secondary" busy={busy} onPress={() => void revoke()} />
        </View>
      ) : step === "sms" ? (
        <View style={{ gap: space[2] }}>
          <Muted>{t("smartOtpSent", { phone: status.maskedPhone ?? "" })}</Muted>
          <Field label={t("smartOtpSmsCode")} keyboardType="number-pad" maxLength={6} value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))} />
          <Button label={t("smartOtpActivateHere")} busy={busy} disabled={code.length !== 6} onPress={() => void activate()} />
          <Button label={t("cancel")} kind="secondary" onPress={() => setStep("idle")} />
        </View>
      ) : status.active ? (
        // Smart OTP đang ở máy khác: chuyển bằng mã máy cũ; không còn máy cũ thì kích hoạt lại bằng SMS.
        <View style={{ gap: space[2] }}>
          <Notice tone="info" text={t("smartOtpOnOtherDevice", { device: status.deviceName ?? "", date: time(status.activatedAt!) })} />
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("smartOtpTransferTitle")}</Text>
          <Muted>{t("smartOtpTransferHint")}</Muted>
          <Field label={t("smartOtpOldDeviceCode")} keyboardType="number-pad" maxLength={6} value={code} onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ""))} />
          <Button label={t("smartOtpTransfer")} busy={busy} disabled={code.length !== 6} onPress={() => void transfer()} />
          <Muted>{t("smartOtpNoOldDeviceHint")}</Muted>
          <Button label={t("smartOtpNoOldDevice")} kind="secondary" busy={busy} onPress={() => void sendCode()} />
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          <Muted>{t("smartOtpIntroAll")}</Muted>
          <Notice tone="info" text={t("smartOtpTransitionHint", { date: day(status.transitionEndsOn) })} />
          <Button label={t("smartOtpActivate")} busy={busy} onPress={() => void sendCode()} />
        </View>
      )}
    </Card>
  );
}
