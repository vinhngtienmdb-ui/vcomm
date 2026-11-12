// MAN_HINH_199 Doanh số (CHUC_NANG_206; API_231; QUYTAC_NGHIEPVU_439, 440): chọn tháng; doanh số của tôi; người quản lý xem từng người trong nhánh, tổng nhánh.
import type { SalesRevenueResponse, SalesRevenueRow } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

function Row({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

export default function RevenueScreen() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<SalesRevenueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      api<SalesRevenueResponse>(`/buyer/sales/revenue${month ? `?month=${month}` : ""}`)
        .then((loaded) => active && setData(loaded))
        .catch((failure: unknown) => active && setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
      return () => {
        active = false;
      };
    }, [month]),
  );

  const memberLine = (row: SalesRevenueRow) => t("revenueMemberHint", { title: t(`title_${row.title}`), orders: row.completedOrderCount, customers: row.customerCount });

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("revenueTitle")}</Title>
        {error ? <Notice text={error} /> : null}
        {!data && !error ? <Loading /> : null}
        {data ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space[2], alignItems: "center" }}>
              {[...data.months].reverse().map((value) => {
                const selected = value === data.month;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setMonth(value)}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderRadius: radius.round,
                      paddingHorizontal: space[3],
                      paddingVertical: space[2],
                    }}
                  >
                    <Text style={{ color: selected ? colors.surface : colors.text, fontWeight: "600" }}>{monthLabel(value)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("revenueMine")}</Text>
              <Row label={t("revenueCompleted")} hint={t("revenueCompletedHint", { orders: data.me.completedOrderCount, customers: data.me.customerCount })} value={money(data.me.completedAmount)} />
              <Row label={t("revenueOpen")} value={t("orderCountAmount", { count: data.me.openOrderCount, amount: money(data.me.openAmount) })} />
            </Card>
            {data.members.length > 0 ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("revenueBranch", { amount: money(data.branchTotal.completedAmount) })}</Text>
                <Muted>{t("revenueBranchOpen", { count: data.branchTotal.openOrderCount, amount: money(data.branchTotal.openAmount) })}</Muted>
                {data.members.map((row) => (
                  <Pressable
                    key={row.userId}
                    accessibilityRole="link"
                    onPress={() => router.push({ pathname: "/doi/[id]", params: { id: row.userId, ten: row.fullName } })}
                    style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: 1, borderColor: colors.border, paddingTop: space[2] }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.primary, fontWeight: "600" }}>{row.fullName}</Text>
                      <Muted>{memberLine(row)}</Muted>
                    </View>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{money(row.completedAmount)}</Text>
                  </Pressable>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
