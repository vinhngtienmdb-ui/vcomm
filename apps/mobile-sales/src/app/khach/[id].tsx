// MAN_HINH_68 Chi tiết khách (CHUC_NANG_100; API_113; QUYTAC_NGHIEPVU_137): liên hệ, gọi điện, chỉ đường, công nợ, đơn gần đây.
import type { PartnerSummaryResponse } from "contracts";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

export default function CustomerScreen() {
  const t = translator("salesApp");
  const { id } = useLocalSearchParams<{ id: string }>();
  const [summary, setSummary] = useState<PartnerSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PartnerSummaryResponse>(`/crm/partners/${id}/summary`)
      .then(setSummary)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, [id]);

  if (error)
    return (
      <Screen>
        <Notice text={error} />
      </Screen>
    );
  if (!summary) return <Loading />;
  const phone = summary.phone ?? summary.contacts.find((contact) => contact.phone)?.phone ?? null;
  return (
    <ScrollView>
      <Stack.Screen options={{ title: summary.code }} />
      <Screen>
        <Card>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>{summary.name}</Text>
          {summary.address ? <Muted>{summary.address}</Muted> : null}
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {phone ? (
              <View style={{ flex: 1 }}>
                <Button label={t("call")} kind="secondary" onPress={() => void Linking.openURL(`tel:${phone}`)} />
              </View>
            ) : null}
            {summary.address ? (
              <View style={{ flex: 1 }}>
                <Button label={t("directions")} kind="secondary" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(summary.address ?? "")}`)} />
              </View>
            ) : null}
          </View>
        </Card>
        <Card>
          {/* Số âm là tiền khách trả trước còn lại. */}
          <Text style={{ fontWeight: "700", color: colors.text }}>{Number(summary.receivable) < 0 ? t("prepaid") : t("debt")}</Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: Number(summary.receivable) > 0 ? colors.text : colors.success }}>
            {money(String(Math.abs(Number(summary.receivable))), summary.currency)}
          </Text>
          {Number(summary.overdue) > 0 ? <Notice tone="warning" text={t("overdue", { amount: money(summary.overdue, summary.currency) })} /> : null}
          {summary.paymentTermDays !== null ? <Muted>{t("paymentTerm", { days: summary.paymentTermDays })}</Muted> : null}
        </Card>
        {summary.contacts.length > 0 ? (
          <Card>
            <Text style={{ fontWeight: "700", color: colors.text }}>{t("contacts")}</Text>
            {summary.contacts.map((contact, index) => (
              <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: contact.isPrimary ? "700" : "400" }}>{contact.fullName}</Text>
                  {contact.position ? <Muted>{contact.position}</Muted> : null}
                </View>
                {contact.phone ? (
                  <Text accessibilityRole="link" style={{ color: colors.primary, fontWeight: "600" }} onPress={() => void Linking.openURL(`tel:${contact.phone}`)}>
                    {contact.phone}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>{t("recentOrders")}</Text>
          {summary.recentOrders.length === 0 ? (
            <Muted>{t("noOrders")}</Muted>
          ) : (
            summary.recentOrders.map((order) => (
              <View key={order.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text }}>
                  {order.documentNo ?? t("draft")} · {order.orderDate.split("-").reverse().join("/")}
                </Text>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{money(order.totalAmount, summary.currency)}</Text>
              </View>
            ))
          )}
        </Card>
      </Screen>
    </ScrollView>
  );
}
