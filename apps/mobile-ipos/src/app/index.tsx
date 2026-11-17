// Màn hình mở đầu theo trạng thái thiết bị và phiên (MAN_HINH_283; QUYTAC_NGHIEPVU_606, 607).
import { Link } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PinPad } from "@/components/PinPad";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Choice, Field, Loading, Muted, Notice, Title } from "@/components/ui";
import { ApiFailure, api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.center}>
      <View style={styles.box}>{children}</View>
    </ScrollView>
  );
}

function PairScreen() {
  const { pair, notice } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Centered>
      <Card>
        <Title>{t("pairTitle")}</Title>
        <Muted>{t("pairText")}</Muted>
        {notice ? <Notice text={notice} tone="warning" /> : null}
        <Field label={t("pairCode")} value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={9} error={error ?? undefined} />
        <Button
          label={t("pairButton")}
          busy={busy}
          disabled={code.replace(/[\s-]/g, "").length !== 8}
          onPress={() => {
            setBusy(true);
            setError(null);
            pair(code)
              .catch((failure: unknown) => setError(failure instanceof ApiFailure ? (failure.fields.code ?? failure.message) : failureText(failure)))
              .finally(() => setBusy(false));
          }}
        />
        <Link href="/dang-ky" style={styles.link}>
          {t("registerLink")}
        </Link>
      </Card>
    </Centered>
  );
}

function OtpLogin({ onCancel }: { onCancel?: () => void }) {
  const { loginOtp } = useSession();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    action()
      .catch((failure: unknown) => setError(failureText(failure)))
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: space[3] }}>
      <Muted>{t("otpText")}</Muted>
      <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {sent ? <Field label={t("otpCode")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} /> : null}
      {error ? <Notice text={error} /> : null}
      {sent ? (
        <Button label={t("signIn")} busy={busy} disabled={code.length !== 6} onPress={() => run(() => loginOtp(phone, code))} />
      ) : (
        <Button
          label={t("sendOtp")}
          busy={busy}
          disabled={phone.trim().length < 10}
          onPress={() => run(async () => {
            await api("/ipos/pos/auth/otp", { method: "POST", json: { phone }, withSession: false });
            setSent(true);
          })}
        />
      )}
      {onCancel ? <Button label={t("back")} kind="secondary" onPress={onCancel} /> : null}
    </View>
  );
}

function LoginScreen() {
  const { device, loginPin, notice } = useSession();
  const members = device?.members ?? [];
  const [memberId, setMemberId] = useState<string | null>(members[0]?.memberId ?? null);
  const [otp, setOtp] = useState(members.length === 0);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <TopBar device={device} />
      <Centered>
        <Card>
          <Title>{t("signInTitle")}</Title>
          {notice ? <Notice text={notice} tone="warning" /> : null}
          {device?.subscriptionStatus === "locked" ? <Notice text={t("subscriptionLockedNotice")} tone="warning" /> : null}
          {otp || !memberId ? (
            <OtpLogin onCancel={members.length > 0 ? () => setOtp(false) : undefined} />
          ) : (
            <>
              <Choice label={t("chooseMember")} value={memberId} options={members.map((member) => ({ value: member.memberId, label: member.fullName }))} onChange={(value) => (setMemberId(value), setPin(""), setError(null))} />
              {error ? <Notice text={error} /> : null}
              <PinPad
                value={pin}
                onChange={setPin}
                disabled={busy}
                onComplete={(value) => {
                  setBusy(true);
                  setError(null);
                  loginPin(memberId, value)
                    .catch((failure: unknown) => {
                      setError(failureText(failure));
                      setPin("");
                    })
                    .finally(() => setBusy(false));
                }}
              />
              <Button label={t("otherPerson")} kind="secondary" onPress={() => setOtp(true)} />
            </>
          )}
        </Card>
      </Centered>
    </View>
  );
}

function SetPinScreen() {
  const { setPin, device, me } = useSession();
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <TopBar device={device} member={me?.member.fullName} />
      <Centered>
        <Card>
          <Title>{first ? t("pinConfirmTitle") : t("pinSetTitle")}</Title>
          <Muted>{t("pinSetText")}</Muted>
          {error ? <Notice text={error} /> : null}
          <PinPad
            value={value}
            onChange={setValue}
            onComplete={(pin) => {
              setValue("");
              if (!first) return setFirst(pin);
              if (pin !== first) {
                setFirst(null);
                return setError(t("pinMismatch"));
              }
              setPin(pin).catch((failure: unknown) => {
                setFirst(null);
                setError(failure instanceof ApiFailure ? (failure.fields.pin ?? failure.message) : failureText(failure));
              });
            }}
          />
        </Card>
      </Centered>
    </View>
  );
}

// Lát L1: sau khi đăng nhập chỉ có thông tin phiên và khóa màn hình; mở ca, bán hàng làm ở lát L3.
function ReadyScreen() {
  const { device, me, lock } = useSession();
  return (
    <View style={{ flex: 1 }}>
      <TopBar device={device} member={me?.member.fullName} />
      <Centered>
        <Card>
          <Title>{t("readyTitle", { name: me?.member.fullName ?? "" })}</Title>
          <Muted>{t("readyText")}</Muted>
          {me ? <Text style={styles.info}>{t("sessionUntil", { time: new Date(me.sessionExpiresAt).toLocaleString("vi-VN") })}</Text> : null}
          <Button label={t("lockScreen")} kind="secondary" onPress={() => void lock()} />
        </Card>
      </Centered>
    </View>
  );
}

export default function Start() {
  const { stage, touch } = useSession();
  return (
    <View style={{ flex: 1 }} onTouchStart={touch}>
      {stage === "loading" ? <Loading /> : stage === "unpaired" ? <PairScreen /> : stage === "signedOut" ? <LoginScreen /> : stage === "needPin" ? <SetPinScreen /> : <ReadyScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space[4] },
  box: { width: "100%", maxWidth: 440 },
  link: { color: colors.primary, fontWeight: "600", textAlign: "center", paddingVertical: space[2] },
  info: { color: colors.text, fontSize: 14 },
});
