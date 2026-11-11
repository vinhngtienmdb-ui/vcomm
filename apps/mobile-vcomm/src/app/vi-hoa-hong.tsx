// MAN_HINH_103 Ví hoa hồng (CONG_VIEC_26; CHUC_NANG_136; API_135; QUYTAC_NGHIEPVU_203): số dư, hoa hồng đang chờ, lịch sử giao dịch ví.
import type { BuyerWalletResponse, WithdrawalItem } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function WalletScreen() {
  const [wallet, setWallet] = useState<BuyerWalletResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));

  const reload = useCallback(() => {
    setError(null);
    setPage(1);
    api<BuyerWalletResponse>("/buyer/wallet").then(setWallet).catch(fail);
  }, []);
  useFocusEffect(reload);

  async function more() {
    if (!wallet) return;
    setBusy(true);
    try {
      const next = await api<BuyerWalletResponse>(`/buyer/wallet?page=${page + 1}`);
      // Có giao dịch mới giữa hai lần tải thì trang sau dịch đi: bỏ dòng đã có.
      const known = new Set(wallet.transactions.data.map((item) => item.id));
      setWallet({ ...next, transactions: { ...next.transactions, data: [...wallet.transactions.data, ...next.transactions.data.filter((item) => !known.has(item.id))] } });
      setPage(page + 1);
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

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
        <Title>{t("walletTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!wallet && !error ? <Loading /> : null}
        {wallet ? (
          <>
            <Card>
              <Muted>{t("walletBalance")}</Muted>
              <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>{money(wallet.balance)}</Text>
              <Muted>{t("walletPending", { amount: money(wallet.pendingAmount) })}</Muted>
              <Muted>{t("walletPendingHint")}</Muted>
              {wallet.withdrawal.open ? null : <Button label={t("withdrawTitle")} disabled={Number(wallet.balance) <= 0} onPress={() => router.push("/rut-tien")} />}
            </Card>
            {wallet.withdrawal.open ? <OpenWithdrawal item={wallet.withdrawal.open} onCancelled={reload} /> : null}
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("walletHistory")}</Text>
              {wallet.transactions.data.length === 0 ? <Muted>{t("walletEmpty")}</Muted> : null}
              {wallet.transactions.data.map((item, index) => (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: space[2],
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderColor: colors.border,
                    paddingTop: index === 0 ? 0 : space[2],
                  }}
                >
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>
                      {item.kind === "commission" ? t("walletCommission", { order: item.orderDocumentNo ?? "" }) : t(`walletKind_${item.kind}`)}
                    </Text>
                    <Muted>{shortDate(item.createdAt)}</Muted>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: Number(item.amount) > 0 ? colors.success : colors.text, fontWeight: "700" }}>
                      {Number(item.amount) > 0 ? "+" : ""}
                      {money(item.amount)}
                    </Text>
                    <Muted>{t("walletBalanceAfter", { amount: money(item.balanceAfter) })}</Muted>
                  </View>
                </View>
              ))}
              {wallet.transactions.data.length < wallet.transactions.total ? <Button label={t("loadMore")} kind="secondary" busy={busy} onPress={() => void more()} /> : null}
            </Card>
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}

// Yêu cầu rút tiền đang chờ: chờ duyệt thì rút lại được; đã duyệt thì chờ chuyển khoản.
function OpenWithdrawal({ item, onCancelled }: { item: WithdrawalItem; onCancelled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api(`/buyer/withdrawals/${item.id}/cancel`, { method: "POST", json: { version: item.version } });
      onCancelled();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Text style={{ fontWeight: "700", color: colors.text }}>{t(`withdrawStatus_${item.status}`)}</Text>
      <Muted>{t("withdrawOpenLine", { amount: money(item.amount), tax: money(item.taxAmount), fee: money(item.feeAmount), net: money(item.netAmount) })}</Muted>
      <Muted>{`${item.bankAccount.bankName} · ${item.bankAccount.accountNumber}`}</Muted>
      {error ? <Notice text={error} /> : null}
      {item.status === "pending" ? <Button label={t("withdrawCancel")} kind="secondary" busy={busy} onPress={() => void cancel()} /> : null}
    </Card>
  );
}
