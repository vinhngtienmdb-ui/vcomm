// MAN_HINH_100 Tài khoản nhận hoàn tiền (CONG_VIEC_25; CHUC_NANG_122; API_133; QUYTAC_NGHIEPVU_168): ngân hàng, số tài khoản, tên chủ tài khoản.
import type { BuyerBankAccount } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Button, Card, Field, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function RefundAccountScreen() {
  const [form, setForm] = useState<BuyerBankAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api<{ bankAccount: BuyerBankAccount | null }>("/buyer/bank-account")
        .then((result) => setForm(result.bankAccount ?? { bankName: "", accountNumber: "", accountHolder: "" }))
        .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
    }, []),
  );

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    setFields({});
    setSaved(false);
    try {
      const result = await api<{ bankAccount: BuyerBankAccount }>("/buyer/bank-account", { method: "PUT", json: form });
      setForm(result.bankAccount);
      setSaved(true);
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        setError(failure.message);
        setFields(failure.fields ?? {});
      } else setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  const change = (key: keyof BuyerBankAccount) => (value: string) => setForm((current) => (current ? { ...current, [key]: value } : current));
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/tai-khoan"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{t("bankAccountTitle")}</Title>
        <Muted>{t("bankAccountHint")}</Muted>
        {error ? <Notice text={error} /> : null}
        {saved ? <Notice tone="success" text={t("bankAccountSaved")} /> : null}
        {!form && !error ? <Loading /> : null}
        {form ? (
          <Card>
            <Field label={t("bankName")} value={form.bankName} onChangeText={change("bankName")} maxLength={100} error={fields.bankName ? t("invalidField") : undefined} />
            <Field
              label={t("accountNumber")}
              value={form.accountNumber}
              onChangeText={change("accountNumber")}
              keyboardType="number-pad"
              maxLength={20}
              error={fields.accountNumber ? t("invalidField") : undefined}
            />
            <Field
              label={t("accountHolder")}
              value={form.accountHolder}
              onChangeText={change("accountHolder")}
              autoCapitalize="characters"
              maxLength={100}
              error={fields.accountHolder ? t("invalidField") : undefined}
            />
            <Button label={t("save")} busy={busy} onPress={() => void save()} />
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
