// MAN_HINH_284 Thu ngân tự đăng ký (QUYTAC_NGHIEPVU_605): mã cửa hàng, số điện thoại, mã OTP, họ tên, điểm bán; gửi yêu cầu chờ chủ cửa hàng duyệt.
import type { IposRegistrationCreated, IposRegistrationOutlet } from "contracts";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TopBar } from "@/components/TopBar";
import { Button, Card, Field, Muted, Notice, Title } from "@/components/ui";
import { ApiFailure, api, failureText } from "@/lib/api";
import { t } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

export default function Register() {
  const [merchantCode, setMerchantCode] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [outlets, setOutlets] = useState<IposRegistrationOutlet[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<IposRegistrationCreated | null>(null);
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setFields({});
    action()
      .catch((failure: unknown) => {
        setError(failureText(failure));
        if (failure instanceof ApiFailure) setFields(failure.fields);
      })
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ flex: 1 }}>
      <TopBar device={null} />
      <ScrollView contentContainerStyle={styles.center}>
        <View style={styles.box}>
          <Card>
            <Title>{t("registerTitle")}</Title>
            {done ? (
              <>
                <Notice tone="success" text={t("registerSent", { date: new Date(done.expiresAt).toLocaleDateString("vi-VN") })} />
                <Button label={t("back")} kind="secondary" onPress={() => router.replace("/")} />
              </>
            ) : (
              <>
                <Muted>{t("registerText")}</Muted>
                <Field label={t("merchantCode")} value={merchantCode} onChangeText={setMerchantCode} autoCapitalize="characters" editable={!outlets} error={fields.merchantCode} />
                <Field label={t("phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!outlets} error={fields.phone} />
                {outlets ? (
                  <>
                    <Field label={t("otpCode")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} error={fields.code} />
                    <Field label={t("fullName")} value={fullName} onChangeText={setFullName} maxLength={100} error={fields.fullName} />
                    <Text style={styles.label}>{t("chooseOutlets")}</Text>
                    {outlets.map((outlet) => {
                      const selected = chosen.includes(outlet.id);
                      return (
                        <Pressable
                          key={outlet.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          onPress={() => setChosen((current) => (selected ? current.filter((id) => id !== outlet.id) : [...current, outlet.id]))}
                          style={[styles.option, selected ? styles.optionSelected : null]}
                        >
                          <Text style={styles.optionTitle}>{outlet.name}</Text>
                          <Text style={styles.optionText}>{outlet.address}</Text>
                        </Pressable>
                      );
                    })}
                  </>
                ) : null}
                {error ? <Notice text={error} /> : null}
                {outlets ? (
                  <Button
                    label={t("sendRequest")}
                    busy={busy}
                    disabled={code.length !== 6 || !fullName.trim()}
                    onPress={() => run(async () => setDone(await api<IposRegistrationCreated>("/ipos/cashier-registrations", { method: "POST", json: { merchantCode, phone, code, fullName, outletIds: chosen }, withSession: false })))}
                  />
                ) : (
                  <Button
                    label={t("sendOtp")}
                    busy={busy}
                    disabled={!merchantCode.trim() || phone.trim().length < 10}
                    onPress={() =>
                      run(async () => {
                        const code = merchantCode.trim().toUpperCase();
                        const list = await api<IposRegistrationOutlet[]>(`/ipos/cashier-registrations/outlets?merchantCode=${encodeURIComponent(code)}`, { withSession: false });
                        await api("/ipos/cashier-registrations/otp", { method: "POST", json: { merchantCode: code, phone }, withSession: false });
                        setMerchantCode(code);
                        setOutlets(list);
                      })
                    }
                  />
                )}
                <Button label={t("back")} kind="secondary" onPress={() => router.replace("/")} />
              </>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space[4] },
  box: { width: "100%", maxWidth: 480 },
  label: { color: colors.text, fontWeight: "600" },
  option: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, padding: space[3], gap: space[1], backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionTitle: { color: colors.text, fontWeight: "700" },
  optionText: { color: colors.textMuted, fontSize: 13 },
});
