// MAN_HINH_135 Ví mua sắm (CONG_VIEC_49; CHUC_NANG_173; API_166; QUYTAC_NGHIEPVU_332; THAY_DOI_22): số dư, trạng thái khóa, chặn, lịch sử.
import type { ShoppingWalletResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export default function ShoppingWalletScreen() {
  const [wallet, setWallet] = useState<ShoppingWalletResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    api<ShoppingWalletResponse>("/buyer/shopping-wallet")
      .then(setWallet)
      .catch(() => setFailed(true));
  }, []);
  useFocusEffect(load);
  async function more() {
    if (!wallet) return;
    setBusy(true);
    try {
      const next = await api<ShoppingWalletResponse>(`/buyer/shopping-wallet?page=${wallet.transactions.page + 1}`);
      setWallet({ ...next, transactions: { ...next.transactions, data: [...wallet.transactions.data, ...next.transactions.data] } });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("shoppingWalletTitle")}</Title>
        {failed ? (
          <>
            <Notice text={t("loadFailed")} />
            <Button label={t("retry")} kind="secondary" onPress={load} />
          </>
        ) : !wallet ? (
          <Loading />
        ) : (
          <>
            <Card>
              <Muted>{t("walletBalance")}</Muted>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{money(wallet.balance)}</Text>
              <Muted>{t("shoppingWalletHint")}</Muted>
              {wallet.isLocked ? <Notice tone="warning" text={t("shoppingWalletLockedNotice")} /> : null}
              {wallet.isBlocked ? <Notice tone="warning" text={t("shoppingWalletBlockedNotice")} /> : null}
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("walletHistory")}</Text>
              {wallet.transactions.data.length === 0 ? <Muted>{t("shoppingWalletEmpty")}</Muted> : null}
              {wallet.transactions.data.map((item) => (
                <View key={item.id} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text }}>{t(`shoppingWalletKind_${item.kind}`, { order: item.orderDocumentNo })}</Text>
                    <Muted>{dateTime(item.createdAt)}</Muted>
                  </View>
                  <Text
                    style={{ fontWeight: "700", color: Number(item.amount) < 0 ? colors.text : colors.success }}
                  >{`${Number(item.amount) > 0 ? "+ " : "− "}${money(Math.abs(Number(item.amount)))}`}</Text>
                </View>
              ))}
              {wallet.transactions.data.length < wallet.transactions.total ? <Button label={t("loadMore")} kind="secondary" busy={busy} onPress={() => void more()} /> : null}
            </Card>
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
