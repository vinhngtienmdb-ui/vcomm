// MAN_HINH_70 Hoa hồng của tôi (CHUC_NANG_102; API_115; QUYTAC_NGHIEPVU_140): chọn tháng; tổng tạm tính, chỉ tiêu, phát sinh; bảng hoa hồng đã chốt.
import type { MyCommissionsResponse } from "contracts";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen, StatusBadge } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { displayDate, vietnamToday } from "@/lib/orders";
import { colors, space } from "@/lib/theme";

const shift = (month: string, by: number) => {
  const [year, value] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, value - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default function CommissionsScreen() {
  const t = translator("salesApp");
  const current = vietnamToday().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [data, setData] = useState<MyCommissionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (value: string) => {
    setData(null);
    try {
      setData(await api<MyCommissionsResponse>(`/finance/my-commissions?month=${value}`));
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }, []);
  useEffect(() => void load(month), [month, load]);

  return (
    <ScrollView>
      <Screen>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button label={t("previousMonth")} kind="secondary" onPress={() => setMonth(shift(month, -1))} />
          </View>
          <Text style={{ fontWeight: "700", color: colors.text, minWidth: 80, textAlign: "center" }}>{month.split("-").reverse().join("/")}</Text>
          <View style={{ flex: 1 }}>
            <Button label={t("nextMonth")} kind="secondary" disabled={month >= current} onPress={() => setMonth(shift(month, 1))} />
          </View>
        </View>
        {error ? <Notice text={error} /> : null}
        {!data ? (
          error ? null : (
            <Loading />
          )
        ) : (
          <>
            <Card>
              <Muted>{t("commissionEstimate")}</Muted>
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.primary }}>{money(data.commissionAmount, data.currency)}</Text>
              <Muted>{t("commissionBase", { amount: money(data.baseAmount, data.currency) })}</Muted>
              {data.targetAmount ? <Muted>{t("commissionTarget", { amount: money(data.targetAmount, data.currency), percent: data.achievedPercent ?? "0" })}</Muted> : null}
              <Muted>{t("commissionNote")}</Muted>
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("commissionEvents")}</Text>
              {data.events.length === 0 ? (
                <Muted>{t("noCommissionEvents")}</Muted>
              ) : (
                data.events.map((event, index) => (
                  <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[1] }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text }}>{event.customerName ?? t("walkIn")}</Text>
                      <Muted>
                        {displayDate(event.date)} · {event.orderNo ?? ""} · {event.percent}%
                      </Muted>
                    </View>
                    <Text style={{ color: Number(event.amount) < 0 ? colors.error : colors.text, fontWeight: "600" }}>{money(event.amount, data.currency)}</Text>
                  </View>
                ))
              )}
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("commissionStatements")}</Text>
              {data.statements.length === 0 ? (
                <Muted>{t("noCommissionStatements")}</Muted>
              ) : (
                data.statements.map((statement) => (
                  <View key={statement.month} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: colors.text, fontWeight: "600" }}>{statement.month.split("-").reverse().join("/")}</Text>
                      <StatusBadge text={statement.status === "posted" ? t("statementPosted") : t("statementPending")} tone={statement.status === "posted" ? "success" : "warning"} />
                    </View>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{money(statement.amount, data.currency)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
