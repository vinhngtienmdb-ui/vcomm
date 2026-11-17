// MAN_HINH_73 Đăng nhập (CHUC_NANG_105; API_117): số điện thoại và mật khẩu, hoặc mã OTP; mã xác thực hai lớp với tài khoản nhân viên bắt buộc.
// CONG_VIEC_72: thiết bị mới xác nhận bằng Smart OTP; đăng nhập bằng mã SMS chỉ dành cho khách chưa kích hoạt, trong thời hạn chuyển đổi.
import type { BuyerAuthenticationPolicy } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { AuthLayout, TextLink, useAction, useResendTimer } from "@/components/auth";
import { DeviceVerification } from "@/components/DeviceVerification";
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
  // API_326: sau thời hạn chuyển đổi không còn đăng nhập bằng mã SMS (CONG_VIEC_72; QUYTAC_NGHIEPVU_560).
  const [smsLoginOpen, setSmsLoginOpen] = useState(true);
  useEffect(() => {
    api<BuyerAuthenticationPolicy>("/buyer/authentication-policy")
      .then((policy) => {
        setSmsLoginOpen(policy.smsFallbackOpen);
        if (!policy.smsFallbackOpen) setMethod("password");
      })
      .catch(() => undefined);
  }, []);

  const sendCode = () =>
    run(async () => {
      await api("/buyer/login/otp", { method: "POST", json: { phone: phone.trim() } });
      setCodeSent(true);
      timer.start();
    });

  // CONG_VIEC_72: thiết bị mới chờ xác nhận bằng Smart OTP (MAN_HINH_270).
  if (stage === "device") return <DeviceVerification />;

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
        {smsLoginOpen ? (
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
        ) : null}
        <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={15} error={fields.phone} />
        {method === "password" ? (
          <>
            <Field label={t("password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={fields.password} />
            <Button label={t("login")} busy={busy} disabled={!phone || !password} onPress={() => void run(async () => void (await signIn("/buyer/login", { phone: phone.trim(), password })))} />
          </>
        ) : (
          <>
            <Muted>{t("loginByOtpHint")}</Muted>
            {codeSent ? <Muted>{t("otpSentTo", { phone: phone.trim() })}</Muted> : null}
            {codeSent ? <Field label={t("otpCode")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} error={fields.code} /> : null}
            {codeSent ? <Button label={t("login")} busy={busy} disabled={code.length !== 6} onPress={() => void run(async () => void (await signIn("/buyer/login/otp/verify", { phone: phone.trim(), code })))} /> : null}
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
