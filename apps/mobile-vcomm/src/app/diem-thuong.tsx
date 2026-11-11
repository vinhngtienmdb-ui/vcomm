// MAN_HINH_151 Điểm của tôi (CONG_VIEC_51; CHUC_NANG_179; API_177; QUYTAC_NGHIEPVU_344, 350, 352): số dư, giá trị quy đổi, điểm sắp hết hạn, lịch sử.
import type { BuyerLoyaltyResponse, LoyaltyEntryItem, PageResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const points = (value: number) => value.toLocaleString("vi-VN");
const date = (value: string) => value.split("-").reverse().join("/");

export function entryLabel(item: LoyaltyEntryItem): string {
  return t(`loyaltyEntry_${item.kind}`, { document: item.documentNo ?? "" });
}

export default function LoyaltyScreen() {
  const [summary, setSummary] = useState<BuyerLoyaltyResponse | null>(null);
  const [entries, setEntries] = useState<PageResponse<LoyaltyEntryItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));

  const reload = useCallback(() => {
    setError(null);
    Promise.all([api<BuyerLoyaltyResponse>("/buyer/loyalty"), api<PageResponse<LoyaltyEntryItem>>("/buyer/loyalty/entries")])
      .then(([loaded, history]) => {
        setSummary(loaded);
        setEntries(history);
      })
      .catch(fail);
  }, []);
  useFocusEffect(reload);

  async function more() {
    if (!entries) return;
    setBusy(true);
    try {
      const next = await api<PageResponse<LoyaltyEntryItem>>(`/buyer/loyalty/entries?page=${entries.page + 1}`);
      const known = new Set(entries.data.map((item) => item.id));
      setEntries({ ...next, data: [...entries.data, ...next.data.filter((item) => !known.has(item.id))] });
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
        <Title>{t("loyaltyTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!summary && !error ? <Loading /> : null}
        {summary && entries ? (
          <>
            <View style={{ backgroundColor: colors.primary, borderRadius: radius.medium, padding: space[4], gap: space[1] }}>
              <Text style={{ color: "#FFFFFF" }}>{t("loyaltyBalance")}</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "800" }}>{t("loyaltyPoints", { points: points(summary.balance) })}</Text>
              {summary.pointValue ? (
                <Text style={{ color: "#FFFFFF" }}>{t("loyaltyWorth", { amount: money(summary.balance * Number(summary.pointValue)), value: money(summary.pointValue) })}</Text>
              ) : null}
              <Text accessibilityRole="link" onPress={() => router.push("/hang-thanh-vien")} style={{ color: "#FFFFFF", fontWeight: "700", paddingTop: space[1] }}>
                {t("loyaltyTierLink", { tier: summary.tier?.nameVi ?? "", multiplier: (summary.tier?.multiplier ?? "1").replace(".", ",") })}
              </Text>
            </View>
            {summary.locked ? <Notice text={t("loyaltyLocked")} /> : null}
            {summary.expiringPoints > 0 && summary.expiringOn ? (
              <Notice tone="warning" text={t("loyaltyExpiring", { points: points(summary.expiringPoints), date: date(summary.expiringOn) })} />
            ) : null}
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("loyaltyHistory")}</Text>
              {entries.data.length === 0 ? <Muted>{t("loyaltyEmpty")}</Muted> : null}
              {entries.data.map((item, index) => (
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
                    <Text style={{ color: colors.text, fontWeight: "600" }}>{entryLabel(item)}</Text>
                    <Muted>{item.expiresOn ? t("loyaltyEntryDateUntil", { date: shortDate(item.createdAt), until: date(item.expiresOn) }) : shortDate(item.createdAt)}</Muted>
                  </View>
                  <Text style={{ color: item.points > 0 ? colors.success : colors.error, fontWeight: "700" }}>{`${item.points > 0 ? "+" : "−"}${points(Math.abs(item.points))}`}</Text>
                </View>
              ))}
              {entries.data.length < entries.total ? <Button label={t("loadMore")} kind="secondary" busy={busy} onPress={() => void more()} /> : null}
            </Card>
            <Muted>{t("loyaltyRules")}</Muted>
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
