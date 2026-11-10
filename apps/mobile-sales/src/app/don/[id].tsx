// MAN_HINH_69 Chi tiết đơn bán trên ứng dụng (CHUC_NANG_101): dòng hàng, tổng tiền, ngoại lệ chờ duyệt; sửa, gửi, rút.
import type { SalesOrderResponse } from "contracts";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { OrderForm } from "@/components/OrderForm";
import { Button, Card, Loading, Muted, Notice, Screen, StatusBadge } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { displayDate, orderTone } from "@/lib/orders";
import { colors, space } from "@/lib/theme";

export default function OrderScreen() {
  const t = translator("salesApp");
  const status = translator("salesOrders");
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<SalesOrderResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<SalesOrderResponse>(`/sales/orders/${id}`)
      .then(setOrder)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, [id]);
  useEffect(load, [load]);

  async function act(path: string) {
    setBusy(true);
    setError(null);
    try {
      setOrder(await api<SalesOrderResponse>(path, { method: "POST" }));
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  if (!order) return error ? <Notice text={error} /> : <Loading />;
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: order.documentNo ?? t("draft") }} />
      <Screen>
        {editing ? (
          <OrderForm
            current={order}
            onSaved={(saved) => {
              setOrder(saved);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, flex: 1 }}>{order.customerName ?? order.buyerName ?? t("walkIn")}</Text>
                <StatusBadge text={status(`status_${order.status}`)} tone={orderTone[order.status]} />
              </View>
              <Muted>
                {displayDate(order.orderDate)} · {order.channelName} · {order.warehouseName}
              </Muted>
            </Card>
            {order.exceptions.length > 0 ? <Notice tone="warning" text={t("exceptions", { count: order.exceptions.length })} /> : null}
            <Card>
              {order.lines.map((line) => (
                <View key={line.id} style={{ gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[2] }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{[line.productName, ...line.optionValues].join(" · ")}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Muted>
                      {line.quantity} {line.unitName} × {money(line.unitPrice, order.currency)}
                    </Muted>
                    <Text style={{ color: colors.text }}>{money(line.totalAmount, order.currency)}</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("total")}</Text>
                <Text style={{ fontWeight: "700", color: colors.text }}>{money(order.totalAmount, order.currency)}</Text>
              </View>
            </Card>
            {error ? <Notice text={error} /> : null}
            {order.canSubmit ? <Button label={t("submitOrder")} busy={busy} onPress={() => void act(`/sales/orders/${id}/submit`)} /> : null}
            {order.canEdit ? <Button label={t("editOrder")} kind="secondary" onPress={() => setEditing(true)} /> : null}
            {order.canWithdraw ? <Button label={t("withdrawOrder")} kind="secondary" busy={busy} onPress={() => void act(`/sales/orders/${id}/withdraw`)} /> : null}
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
