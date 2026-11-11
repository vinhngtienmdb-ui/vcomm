// MAN_HINH_196 Chi tiết khách (CHUC_NANG_204; API_228; QUYTAC_NGHIEPVU_432, 433): khách của tôi hoặc của người trong nhánh.
// Không có địa chỉ giao hàng, người nhận; đơn chỉ xem dạng danh sách, không mở chi tiết đơn của khách.
import type { BuyerSalesCustomerDetail } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { orderStatusTone } from "@/components/OrderLines";
import { Button, Card, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

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

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<BuyerSalesCustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      api<BuyerSalesCustomerDetail>(`/buyer/sales/customers/${encodeURIComponent(String(id))}`)
        .then((loaded) => active && setCustomer(loaded))
        .catch((failure: unknown) => active && setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
      return () => {
        active = false;
      };
    }, [id]),
  );

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        {error ? <Notice text={error} /> : null}
        {!customer && !error ? <Loading /> : null}
        {customer ? (
          <>
            <Card>
              <Title>{customer.fullName}</Title>
              <Muted>{t("customerOwner", { name: customer.ownerName, title: t(`title_${customer.ownerTitle}`) })}</Muted>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{customer.phone}</Text>
              <Muted>{t("registeredOn", { date: shortDate(customer.registeredAt) })}</Muted>
              <Button label={t("call")} kind="secondary" onPress={() => void Linking.openURL(`tel:${customer.phone}`)} />
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("customerPurchases")}</Text>
              <Row label={t("completedOrders")} hint={t("completedOrdersHint")} value={t("orderCountAmount", { count: customer.completedOrderCount, amount: money(customer.completedAmount) })} />
              <Row label={t("openOrders")} value={t("orderCountAmount", { count: customer.openOrderCount, amount: money(customer.openAmount) })} />
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("myCommissionFromCustomer")}</Text>
              <Row label={t("commissionCredited")} value={money(customer.myCommission.credited)} />
              <Row label={t("commissionPending")} hint={t("commissionPendingHint")} value={money(customer.myCommission.pending)} />
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("recentOrders")}</Text>
              {customer.recentOrders.length === 0 ? <Muted>{t("noCustomerOrders")}</Muted> : null}
              {customer.recentOrders.map((order, index) => (
                <View
                  key={order.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2] }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>{order.documentNo}</Text>
                    <Muted>
                      {shortDate(order.orderedAt)} · {money(order.goodsAmount)}
                    </Muted>
                  </View>
                  <StatusBadge text={t(`orderStatus_${order.status}`)} tone={orderStatusTone[order.status]} />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
