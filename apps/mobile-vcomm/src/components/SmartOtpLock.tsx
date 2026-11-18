// MAN_HINH_269 Mở khóa Smart OTP: đặt mã khóa 6 số, mở bằng vân tay, khuôn mặt hoặc mã khóa (CONG_VIEC_72; QUYTAC_NGHIEPVU_563).
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import {
  biometricAvailable,
  biometricUnlock,
  hashPin,
  loadSmartOtp,
  maximumPinFailures,
  pinLength,
  pinMatches,
  saveSmartOtp,
  type StoredSmartOtp,
  weakPin,
} from "@/lib/smart-otp";
import { colors, radius, space } from "@/lib/theme";
import { Button, Muted, Notice } from "./ui";

const t = translator("vcommApp");
const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"] as const;

// Bàn phím số và ô chấm; đủ 6 số thì gọi onComplete rồi xóa để nhập lại.
export function PinPad({ title, hint, error, busy, onComplete }: { title: string; hint?: string; error?: string | null; busy?: boolean; onComplete: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  function press(key: (typeof keys)[number]) {
    if (busy) return;
    if (key === "delete") return setPin(pin.slice(0, -1));
    if (!key || pin.length >= pinLength) return;
    const next = pin + key;
    setPin(next);
    if (next.length === pinLength) {
      // Để ô chấm thứ sáu kịp hiện trước khi xử lý.
      setTimeout(() => {
        onComplete(next);
        setPin("");
      }, 80);
    }
  }
  return (
    <View style={{ gap: space[3] }}>
      <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text, textAlign: "center" }}>{title}</Text>
      {hint ? <Muted>{hint}</Muted> : null}
      <View accessibilityLabel={t("smartOtpPinEntered", { count: pin.length, total: pinLength })} style={{ flexDirection: "row", justifyContent: "center", gap: space[3] }}>
        {Array.from({ length: pinLength }, (_, index) => (
          <View
            key={index}
            style={{ width: 14, height: 14, borderRadius: radius.round, borderWidth: 2, borderColor: colors.text, backgroundColor: index < pin.length ? colors.text : "transparent" }}
          />
        ))}
      </View>
      {error ? <Notice text={error} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], justifyContent: "space-between" }}>
        {keys.map((key, index) => (
          <Pressable
            key={index}
            accessibilityRole={key ? "button" : undefined}
            accessibilityLabel={key === "delete" ? t("smartOtpPinDelete") : key}
            disabled={!key}
            onPress={() => press(key)}
            style={{
              width: "31%",
              paddingVertical: space[3],
              borderRadius: radius.medium,
              borderWidth: key ? 1 : 0,
              borderColor: colors.border,
              backgroundColor: key ? colors.surface : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>{key === "delete" ? "⌫" : key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Đặt (hoặc đổi) mã khóa: nhập hai lần cho khớp, từ chối mã yếu; xong thì hỏi bật vân tay, khuôn mặt khi máy hỗ trợ.
export function SetPinFlow({ phone, onDone }: { phone: string | null; onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askBiometric, setAskBiometric] = useState(false);
  const [busy, setBusy] = useState(false);

  async function complete(pin: string) {
    if (first === null) {
      if (weakPin(pin, phone)) return setError(t("smartOtpPinWeak"));
      setError(null);
      return setFirst(pin);
    }
    if (pin !== first) {
      setFirst(null);
      return setError(t("smartOtpPinMismatch"));
    }
    setBusy(true);
    const stored = await loadSmartOtp();
    if (stored) await saveSmartOtp({ ...stored, pin: hashPin(pin), failures: 0, biometric: false });
    setBusy(false);
    if (await biometricAvailable()) setAskBiometric(true);
    else onDone();
  }

  async function chooseBiometric(enable: boolean) {
    const stored = await loadSmartOtp();
    // Bật thì xác nhận một lần bằng sinh trắc học để chắc máy nhận được.
    if (stored && enable && (await biometricUnlock(t("smartOtpBiometricPrompt"), t("cancel")))) await saveSmartOtp({ ...stored, biometric: true });
    onDone();
  }

  if (askBiometric)
    return (
      <View style={{ gap: space[3] }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text, textAlign: "center" }}>{t("smartOtpBiometricAsk")}</Text>
        <Muted>{t("smartOtpBiometricHint")}</Muted>
        <Button label={t("smartOtpBiometricEnable")} onPress={() => void chooseBiometric(true)} />
        <Button label={t("later")} kind="secondary" onPress={() => void chooseBiometric(false)} />
      </View>
    );
  return (
    <PinPad
      title={first === null ? t("smartOtpPinSet") : t("smartOtpPinConfirm")}
      hint={t("smartOtpPinHint")}
      error={error}
      busy={busy}
      onComplete={(pin) => void complete(pin)}
    />
  );
}

// Mở khóa: sinh trắc học trước nếu đã bật, luôn có nút dùng mã khóa. Sai mã khóa 5 lần liên tiếp: xóa Smart OTP trên máy, báo máy chủ hủy.
export function UnlockFlow({ onUnlocked, onLockedOut }: { onUnlocked: (stored: StoredSmartOtp) => void; onLockedOut: () => void }) {
  const [stored, setStored] = useState<StoredSmartOtp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tryBiometric(current: StoredSmartOtp) {
    if (current.biometric && (await biometricAvailable()) && (await biometricUnlock(t("smartOtpBiometricPrompt"), t("smartOtpUsePin")))) {
      await saveSmartOtp({ ...current, failures: 0 });
      onUnlocked(current);
    }
  }

  useEffect(() => {
    void loadSmartOtp().then((current) => {
      setStored(current);
      if (current) void tryBiometric(current);
    });
    // Chỉ chạy một lần khi mở.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function complete(pin: string) {
    if (!stored?.pin) return;
    setBusy(true);
    if (pinMatches(stored.pin, pin)) {
      await saveSmartOtp({ ...stored, failures: 0 });
      setBusy(false);
      return onUnlocked(stored);
    }
    const failures = (stored.failures ?? 0) + 1;
    if (failures >= maximumPinFailures) {
      await saveSmartOtp(null);
      await api("/buyer/loyalty/smart-otp/lockout", { method: "POST" }).catch(() => undefined);
      setBusy(false);
      return onLockedOut();
    }
    const next = { ...stored, failures };
    await saveSmartOtp(next);
    setStored(next);
    setBusy(false);
    setError(t("smartOtpPinWrong", { remaining: maximumPinFailures - failures }));
  }

  if (!stored) return null;
  return (
    <View style={{ gap: space[3] }}>
      <PinPad title={t("smartOtpPinEnter")} error={error} busy={busy} onComplete={(pin) => void complete(pin)} />
      {stored.biometric ? <Button label={t("smartOtpBiometricRetry")} kind="secondary" onPress={() => void tryBiometric(stored)} /> : null}
    </View>
  );
}
