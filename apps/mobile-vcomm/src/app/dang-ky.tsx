// MAN_HINH_74 Đăng ký (CHUC_NANG_104; API_116; QUYTAC_NGHIEPVU_141, 142): bước 1 số điện thoại, mã giới thiệu; bước 2 mã OTP, họ tên, mật khẩu.
// CONG_VIEC_72 (QUYTAC_NGHIEPVU_562): trên ứng dụng điện thoại, kích hoạt Smart OTP luôn bằng chính mã SMS đăng ký (mặc định chọn), rồi đặt mã khóa.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { AuthLayout, TextLink, useAction, useResendTimer } from "@/components/auth";
import { Button, Card, Field, Muted, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { currentDeviceName, currentPlatform, saveSmartOtp } from "@/lib/smart-otp";
import { colors, space } from "@/lib/theme";

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
  const [withSmartOtp, setWithSmartOtp] = useState(Platform.OS !== "web");
  const { busy, error, fields, run } = useAction(step === "phone" ? ["phone", "referralCode"] : ["code", "fullName", "password", "referralCode"]);
  const timer = useResendTimer();
  // Số vừa có người khác đăng ký khi đang ở bước 2: quay lại bước 1 để thấy lỗi ở ô số điện thoại.
  useEffect(() => {
    if (fields.phone) setStep("phone");
  }, [fields.phone]);

  const sendCode = () =>
    run(async () => {
      await api("/buyer/register/otp", { method: "POST", json: { phone: phone.trim() } });
      setStep("details");
      timer.start();
    });

  const submit = () =>
    run(async () => {
      const result = await signIn("/buyer/register", {
        phone: phone.trim(),
        code,
        fullName: fullName.trim(),
        password,
        referralCode: referralCode.trim() || null,
        ...(withSmartOtp && currentPlatform() !== "web" ? { smartOtp: { deviceName: currentDeviceName(), platform: currentPlatform() } } : {}),
      });
      if (result.smartOtpActivation) {
        await saveSmartOtp({ secret: result.smartOtpActivation.secret, activatedAt: result.smartOtpActivation.activatedAt! });
        router.replace("/smart-otp/dat-ma-khoa");
      }
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
            {Platform.OS !== "web" ? (
              <View style={{ gap: space[1] }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
                  <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>{t("registerSmartOtp")}</Text>
                  <Switch accessibilityLabel={t("registerSmartOtp")} value={withSmartOtp} onValueChange={setWithSmartOtp} />
                </View>
                <Muted>{withSmartOtp ? t("registerSmartOtpHint") : t("registerSmartOtpLater")}</Muted>
              </View>
            ) : null}
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
