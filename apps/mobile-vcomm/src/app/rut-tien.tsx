// MAN_HINH_104 Yêu cầu rút tiền hoa hồng (CONG_VIEC_26; CHUC_NANG_137; API_136; QUYTAC_NGHIEPVU_204, 205): số tiền, tài khoản nhận, thuế dự kiến.
import { type BuyerWalletResponse, type WithdrawalItem, withdrawalFee } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Button, Card, Field, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function WithdrawalScreen() {
  const [wallet, setWallet] = useState<BuyerWalletResponse | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api<BuyerWalletResponse>("/buyer/wallet?pageSize=1")
        .then(setWallet)
        .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
    }, []),
  );

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await api<WithdrawalItem>("/buyer/withdrawals", { method: "POST", json: { amount: amount.replace(/\D/g, "") } });
      router.replace("/vi-hoa-hong");
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        if (failure.fields?.amount) setFieldError(failure.fields.amount);
        else setError(failure.message);
      } else setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  const info = wallet?.withdrawal;
  const value = Number(amount.replace(/\D/g, "") || 0);
  const tax = info && value > Number(info.taxThreshold) ? Math.round((value * Number(info.taxRate)) / 100) : 0;
  // Phí rút tiền (THAY_DOI_17): yêu cầu mới là lần rút thứ withdrawalsThisMonth + 1 trong tháng.
  const fee = info ? withdrawalFee(value, info.withdrawalsThisMonth + 1, info.withdrawalFees) : 0;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/vi-hoa-hong"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{t("withdrawTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!wallet && !error ? <Loading /> : null}
        {wallet && info ? (
          info.bankAccount ? (
            <Card>
              <Muted>{t("withdrawAvailable", { amount: money(wallet.balance) })}</Muted>
              <Field label={t("withdrawAmount")} value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={13} error={fieldError ?? undefined} />
              <Muted>{t("withdrawMinimum", { amount: money(info.minimumWithdrawal) })}</Muted>
              <Muted>{t("withdrawTaxRule", { threshold: money(info.taxThreshold), rate: info.taxRate })}</Muted>
              <Muted>{t("withdrawCount", { count: info.withdrawalsThisMonth })}</Muted>
              {value > 0 ? <Text style={{ color: colors.text }}>{t("withdrawEstimate", { tax: money(tax), fee: money(fee), net: money(value - tax - fee) })}</Text> : null}
              <Muted>{t("withdrawTo", { account: `${info.bankAccount.bankName} · ${info.bankAccount.accountNumber} · ${info.bankAccount.accountHolder}` })}</Muted>
              <Button label={t("withdrawSubmit")} busy={busy} disabled={value <= 0} onPress={() => void submit()} />
            </Card>
          ) : (
            <Card>
              <Notice tone="warning" text={t("withdrawNeedsBank")} />
              <Button label={t("bankAccountTitle")} kind="secondary" onPress={() => router.push("/tai-khoan-hoan-tien")} />
            </Card>
          )
        ) : null}
      </Screen>
    </ScrollView>
  );
}
