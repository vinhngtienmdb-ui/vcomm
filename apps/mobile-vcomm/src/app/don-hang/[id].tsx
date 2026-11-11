// MAN_HINH_96 Chi tiết đơn (CHUC_NANG_116; API_126; QUYTAC_NGHIEPVU_159): trạng thái, vận đơn, dòng hàng, tiền, lịch sử, hủy đơn. Điểm thưởng của đơn: CONG_VIEC_51.
// MAN_HINH_99 khối Thanh toán (CONG_VIEC_25; API_131; QUYTAC_NGHIEPVU_165, 167): hạn thanh toán, mở trang VNPAY, thanh toán lại, trạng thái thanh toán.
import type { BuyerOrderDetail, BuyerPaymentStart } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { AmountRow, OrderLines, orderStatusTone } from "@/components/OrderLines";
import { Button, Card, Field, Loading, Muted, Notice, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const method = translator("paymentMethods");
const returnTone = { pending: "warning", approved: "info", rejected: "error", withdrawn: "neutral", received: "success", not_received: "neutral" } as const;
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<BuyerOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);

  const load = useCallback(() => {
    api<BuyerOrderDetail>(`/buyer/orders/${encodeURIComponent(String(id))}`)
      .then(setOrder)
      .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
  }, [id]);
  useFocusEffect(load);

  async function withdraw(requestId: string, version: number) {
    setError(null);
    try {
      await api(`/buyer/return-requests/${requestId}/withdraw`, { method: "POST", json: { version } });
      load();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }

  // Mở trang VNPAY; thanh toán xong người mua quay lại và kiểm tra lại trạng thái.
  async function pay() {
    if (!order) return;
    setPaying(true);
    setError(null);
    try {
      const started = await api<BuyerPaymentStart>(`/buyer/orders/${order.id}/payments`, { method: "POST" });
      await Linking.openURL(started.paymentUrl);
      setPaymentOpened(true);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      load();
    } finally {
      setPaying(false);
    }
  }

  async function cancel() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      setOrder(await api<BuyerOrderDetail>(`/buyer/orders/${order.id}/cancel`, { method: "POST", json: { reason, version: order.version } }));
      setCancelling(false);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/don-hang"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        {error ? <Notice text={error} /> : null}
        {!order && !error ? <Loading /> : null}
        {order ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
              <Title>{order.documentNo}</Title>
              <StatusBadge text={t(`orderStatus_${order.status}`)} tone={orderStatusTone[order.status]} />
            </View>
            <Muted>{t("orderedAt", { time: dateTime(order.createdAt) })}</Muted>
            {order.status === "cancelled" && order.cancelReason ? <Notice tone="info" text={t("cancelledBecause", { reason: order.cancelReason })} /> : null}
            {order.returnDeadline && order.status === "delivered" ? <Notice tone="info" text={t("returnUntil", { time: dateTime(order.returnDeadline) })} /> : null}
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("deliverTo")}</Text>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{`${order.recipientName} · ${order.recipientPhone}`}</Text>
              <Text style={{ color: colors.text }}>{order.address}</Text>
              {order.trackingCode ? <Muted>{t("trackingCode", { carrier: order.carrierName ?? "", code: order.trackingCode })}</Muted> : null}
            </Card>
            <Card>
              <OrderLines lines={order.lines} />
            </Card>
            <Card>
              <AmountRow label={t("goodsAmount")} value={money(order.goodsAmount)} />
              <AmountRow label={t("shippingFee")} value={Number(order.shippingFee) === 0 ? t("free") : money(order.shippingFee)} />
              {Number(order.pointsAmount) > 0 ? (
                <AmountRow label={t("pointsDeduction", { points: (order.points?.redeemedPoints ?? 0).toLocaleString("vi-VN") })} value={`−${money(order.pointsAmount)}`} />
              ) : null}
              <AmountRow label={t("orderTotal")} value={money(Number(order.total) - Number(order.pointsAmount))} strong />
              <Muted>{`${t("paidBy", { method: method(order.paymentMethod) })} · ${t(`paymentStatus_${order.paymentStatus}`)}`}</Muted>
              {Number(order.paidAmount) > 0 ? <Muted>{t("paidAmountLine", { amount: money(order.paidAmount) })}</Muted> : null}
              {Number(order.refundedAmount) > 0 ? <Muted>{t("refundedAmountLine", { amount: money(order.refundedAmount) })}</Muted> : null}
            </Card>
            {order.points ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("orderPointsTitle")}</Text>
                {order.points.redeemedPoints > 0 ? (
                  <Muted>{t("orderPointsUsed", { points: order.points.redeemedPoints.toLocaleString("vi-VN"), amount: money(order.points.redeemedAmount) })}</Muted>
                ) : null}
                {order.points.refundedPoints > 0 ? <Muted>{t("orderPointsRefunded", { points: order.points.refundedPoints.toLocaleString("vi-VN") })}</Muted> : null}
                <Muted>
                  {order.points.earnStatus === "earned"
                    ? t("orderPointsEarned", { points: (order.points.earnedPoints ?? 0).toLocaleString("vi-VN"), date: (order.points.expiresOn ?? "").split("-").reverse().join("/") })
                    : order.points.earnStatus === "pending"
                      ? t("orderPointsExpected", { points: order.points.expectedPoints.toLocaleString("vi-VN") })
                      : order.points.earnStatus === "skipped"
                        ? t(`orderPointsSkipped_${order.points.skipReason ?? "zero"}`)
                        : t("orderPointsCancelled")}
                </Muted>
              </Card>
            ) : null}
            {order.refunds.length > 0 ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("refundTitle")}</Text>
                {order.refunds.map((refund, index) => (
                  <Muted key={index}>
                    {refund.status === "completed"
                      ? t("refundLine_completed", { amount: money(refund.amount), date: (refund.refundedOn ?? "").split("-").reverse().join("/") })
                      : t("refundLine_pending", { amount: money(refund.amount) })}
                  </Muted>
                ))}
                {order.needsBankAccount ? (
                  <>
                    <Notice tone="warning" text={t("needsBankAccount")} />
                    <Button label={t("enterBankAccount")} onPress={() => router.push("/tai-khoan-hoan-tien")} />
                  </>
                ) : null}
              </Card>
            ) : null}
            {order.canPay && order.paymentDeadline ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{method(order.paymentMethod)}</Text>
                <Notice tone="warning" text={t("payBefore", { time: dateTime(order.paymentDeadline) })} />
                {paymentOpened ? <Notice tone="info" text={t("paymentOpened")} /> : null}
                <Button label={paymentOpened ? t("payAgain") : t("payNow")} busy={paying} onPress={() => void pay()} />
                {paymentOpened ? <Button label={t("checkPayment")} kind="secondary" onPress={load} /> : null}
              </Card>
            ) : null}
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("orderHistory")}</Text>
              {order.events.map((event, index) => (
                <View key={`${event.at}-${index}`} style={{ gap: 2 }}>
                  <Text style={{ color: colors.text }}>{t(`orderStatus_${event.status}`)}</Text>
                  <Muted>{event.note ? `${dateTime(event.at)} · ${event.note}` : dateTime(event.at)}</Muted>
                </View>
              ))}
            </Card>
            {order.returnRequests.length > 0 ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("returnRequests")}</Text>
                {order.returnRequests.map((request) => (
                  <View key={request.id} style={{ gap: space[1], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[2] }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2], flexWrap: "wrap" }}>
                      <Text style={{ color: colors.text, fontWeight: "600" }}>{t(`returnReason_${request.reason}`)}</Text>
                      <StatusBadge text={t(`returnStatus_${request.status}`)} tone={returnTone[request.status]} />
                    </View>
                    <Muted>{request.lines.map((line) => `${line.quantity} × ${line.productName}`).join(", ")}</Muted>
                    <Muted>{`${dateTime(request.createdAt)} · ${request.description}`}</Muted>
                    {request.decisionNote ? <Muted>{t("returnNote", { note: request.decisionNote })}</Muted> : null}
                    {request.status === "approved" ? <Notice tone="info" text={t("returnSendBack")} /> : null}
                    {request.canWithdraw ? <Button label={t("returnWithdraw")} kind="secondary" onPress={() => void withdraw(request.id, request.version)} /> : null}
                  </View>
                ))}
              </Card>
            ) : null}
            {order.canRequestReturn ? <Button label={t("requestReturn")} kind="secondary" onPress={() => router.push({ pathname: "/tra-hang", params: { id: order.id } })} /> : null}
            {order.canCancel ? (
              cancelling ? (
                <Card>
                  <Field label={t("cancelReason")} value={reason} onChangeText={setReason} maxLength={500} multiline />
                  <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
                    <Button label={t("confirmCancelOrder")} busy={busy} disabled={!reason.trim()} onPress={() => void cancel()} />
                    <Button label={t("keepOrder")} kind="secondary" onPress={() => setCancelling(false)} />
                  </View>
                </Card>
              ) : (
                <Button label={t("cancelOrder")} kind="secondary" onPress={() => setCancelling(true)} />
              )
            ) : null}
          </>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
