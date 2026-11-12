// Smart OTP dùng điểm tại quầy (CONG_VIEC_53 lát L6; bổ sung MAN_HINH_151; API_199; QUYTAC_NGHIEPVU_379).
// Kích hoạt một lần bằng mã SMS; khóa TOTP lưu trong bộ nhớ an toàn của máy; mã 6 số đổi mỗi 30 giây, tạo trên máy, không cần mạng.
import type { SmartOtpActivationResponse, SmartOtpStatusResponse } from "contracts";
import { Secret, TOTP } from "otpauth";
import { useCallback, useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { api, ApiFailure, read, write } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";
import { Button, Card, Field, Muted, Notice } from "./ui";

const t = translator("vcommApp");
const storageKey = "vcomm.smartOtp";
type Stored = { secret: string; activatedAt: string };

const deviceName = () => (Platform.OS === "ios" ? "iPhone" : Platform.OS === "android" ? "Điện thoại Android" : "Trình duyệt");
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });

export function SmartOtpCard() {
  const [status, setStatus] = useState<SmartOtpStatusResponse | null>(null);
  const [stored, setStored] = useState<Stored | null>(null);
  const [step, setStep] = useState<"idle" | "code">("idle");
  const [smsCode, setSmsCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));

  const reload = useCallback(() => {
    Promise.all([api<SmartOtpStatusResponse>("/buyer/loyalty/smart-otp"), read(storageKey)])
      .then(([loaded, local]) => {
        setStatus(loaded);
        setStored(local ? (JSON.parse(local) as Stored) : null);
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

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await api("/buyer/loyalty/smart-otp/send-code", { method: "POST" });
      setStep("code");
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const activated = await api<SmartOtpActivationResponse>("/buyer/loyalty/smart-otp/activate", { method: "POST", json: { code: smsCode, deviceName: deviceName() } });
      await write(storageKey, JSON.stringify({ secret: activated.secret, activatedAt: activated.activatedAt }));
      setSmsCode("");
      setStep("idle");
      reload();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await api("/buyer/loyalty/smart-otp", { method: "DELETE" });
      await write(storageKey, null);
      reload();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  const remaining = 30 - (Math.floor(now / 1000) % 30);
  const code = onThisDevice && stored ? new TOTP({ secret: Secret.fromBase32(stored.secret), digits: 6, period: 30 }).generate({ timestamp: now }) : null;
  return (
    <Card>
      <Text style={{ fontWeight: "700", color: colors.text }}>{t("smartOtpTitle")}</Text>
      {error ? <Notice text={error} /> : null}
      {status.lockedUntil ? <Notice text={t("smartOtpLocked", { time: time(status.lockedUntil) })} /> : null}
      {code ? (
        <View style={{ gap: space[2] }}>
          <Text accessibilityLabel={t("smartOtpCodeLabel", { code: code.split("").join(" ") })} style={{ fontSize: 40, fontWeight: "800", letterSpacing: 8, textAlign: "center", color: colors.text }}>
            {`${code.slice(0, 3)} ${code.slice(3)}`}
          </Text>
          <View style={{ height: 6, borderRadius: radius.round, backgroundColor: colors.border, overflow: "hidden" }}>
            <View style={{ height: 6, width: `${(remaining / 30) * 100}%`, backgroundColor: colors.primary }} />
          </View>
          <Muted>{t("smartOtpUse", { seconds: remaining })}</Muted>
          <Muted>{t("smartOtpDevice", { device: status.deviceName ?? "", date: time(status.activatedAt!) })}</Muted>
          <Button label={t("smartOtpRevoke")} kind="secondary" busy={busy} onPress={() => void revoke()} />
        </View>
      ) : step === "code" ? (
        <View style={{ gap: space[2] }}>
          <Muted>{t("smartOtpSent", { phone: status.maskedPhone ?? "" })}</Muted>
          <Field label={t("smartOtpSmsCode")} keyboardType="number-pad" maxLength={6} value={smsCode} onChangeText={(value) => setSmsCode(value.replace(/[^0-9]/g, ""))} />
          <Button label={t("smartOtpActivateHere")} busy={busy} disabled={smsCode.length !== 6} onPress={() => void activate()} />
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          {status.active ? <Notice tone="warning" text={t("smartOtpOtherDevice", { device: status.deviceName ?? "" })} /> : <Muted>{t("smartOtpIntro")}</Muted>}
          <Button label={status.active ? t("smartOtpActivateHere") : t("smartOtpActivate")} busy={busy} onPress={() => void sendCode()} />
        </View>
      )}
    </Card>
  );
}
