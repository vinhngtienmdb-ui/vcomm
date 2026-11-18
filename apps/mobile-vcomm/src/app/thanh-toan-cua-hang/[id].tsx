// MAN_HINH_277 Thanh toán tại cửa hàng (CONG_VIEC_73; QUYTAC_NGHIEPVU_577 đến 579; API_327).
// Khách xem đơn của cửa hàng, chọn số điểm, phương thức rồi thanh toán trong ứng dụng; trả hết bằng điểm thì hoàn tất ngay.
// Đơn mở từ mã QR của cửa hàng: dùng điểm phải mở Smart OTP (mã tự điền sau khi mở). Sau khi mở cổng, hỏi trạng thái mỗi 2 giây.
// Cửa hàng liên kết (lát L4): chọn voucher trước, số điểm tối đa tính sau voucher; đơn thu tại quầy chỉ xác nhận, cửa hàng thu phần còn lại.
import type { BuyerInstoreCheckout, PayInstoreCheckoutRequest, PayInstoreCheckoutResponse } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { UnlockFlow } from "@/components/SmartOtpLock";
import { Button, Card, Choice, Field, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { codeOf } from "@/lib/smart-otp";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");
const method = translator("paymentMethods");
const money = (value: string | number) => `${Math.round(Number(value)).toLocaleString("vi-VN")} đ`;
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit" });

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
      <Text style={{ color: colors.text, flex: 1, fontWeight: strong ? "800" : "400" }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: strong ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

export default function InstoreCheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [checkout, setCheckout] = useState<BuyerInstoreCheckout | null>(null);
  const [points, setPoints] = useState("0");
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [invoiceOn, setInvoiceOn] = useState(false);
  const [invoice, setInvoice] = useState({ name: "", taxCode: "", address: "" });
  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));

  const load = useCallback(() => {
    api<BuyerInstoreCheckout>(`/buyer/instore/checkouts/${id}`)
      .then((loaded) => {
        setCheckout(loaded);
        setPaymentMethod((current) => current ?? loaded.paymentMethods[0]?.code ?? null);
      })
      .catch(fail);
  }, [id]);
  useEffect(load, [load]);
  // Chờ cổng báo kết quả, hoặc đơn được cửa hàng hủy: hỏi lại mỗi 2 giây khi đơn còn mở.
  useEffect(() => {
    if (!checkout || !["awaiting_buyer", "awaiting_payment"].includes(checkout.status)) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [checkout, load]);

  if (!checkout) return error ? <Notice text={error} /> : <Loading />;
  const loyalty = checkout.loyalty;
  const voucher = checkout.vouchers.find((item) => item.codeId === voucherId) ?? null;
  const maxPoints = voucher ? Math.min(voucher.maxPoints, loyalty?.maxPoints ?? 0) : (loyalty?.maxPoints ?? 0);
  const canRedeem = Boolean(loyalty && !loyalty.blockedReason && maxPoints > 0 && loyalty.pointValue);
  const used = Math.min(Math.max(Number(points.replace(/\D/g, "")) || 0, 0), maxPoints);
  const pointsAmount = canRedeem && loyalty?.pointValue ? Math.floor(used * Number(loyalty.pointValue)) : 0;
  const voucherAmount = voucher ? Number(voucher.discount) : 0;
  const due = Math.max(Number(checkout.billAmount) - voucherAmount - pointsAmount, 0);
  const pointsValid = used === 0 || (canRedeem && used >= (loyalty?.minPoints ?? 0));

  async function pay(smartOtp: string | null) {
    setBusy(true);
    setError(null);
    try {
      const body: PayInstoreCheckoutRequest = {
        points: checkout!.status === "awaiting_buyer" ? used : 0,
        voucherCodeId: checkout!.status === "awaiting_buyer" ? voucherId : null,
        method: due > 0 || checkout!.status === "awaiting_payment" ? paymentMethod : null,
        ...(smartOtp ? { smartOtp } : {}),
        invoiceInfo: invoiceOn && invoice.name.trim() ? { name: invoice.name.trim(), taxCode: invoice.taxCode.trim() || null, address: invoice.address.trim() || null } : null,
      };
      const result = await api<PayInstoreCheckoutResponse>(`/buyer/instore/checkouts/${id}/pay`, { method: "POST", json: body });
      setCheckout(result.checkout);
      if (result.paymentUrl) await Linking.openURL(result.paymentUrl);
    } catch (failure) {
      fail(failure);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      setCheckout(await api<BuyerInstoreCheckout>(`/buyer/instore/checkouts/${id}/decline`, { method: "POST" }));
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <Card>
      <Title>{checkout.storeName}</Title>
      <Muted>{`${checkout.placeName} · ${checkout.documentNo}`}</Muted>
      {checkout.lines.map((line, index) => (
        <Row key={index} label={`${line.name} × ${Number(line.quantity).toLocaleString("vi-VN")}${line.gift ? ` (${t("instoreGift")})` : ""}`} value={money(line.amount)} />
      ))}
      <Row label={t("instoreBillAmount")} value={money(checkout.billAmount)} strong />
    </Card>
  );

  if (checkout.status === "completed")
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Screen>
          <Notice
            tone="success"
            text={
              checkout.collectInApp
                ? t("instorePaid", { amount: money(Number(checkout.billAmount) - Number(checkout.pointsAmount) - Number(checkout.voucherAmount)) })
                : t("instoreConfirmed", { amount: money(checkout.amountDue ?? "0") })
            }
          />
          {header}
          {Number(checkout.voucherAmount) > 0 ? <Row label={t("instoreVoucher")} value={`− ${money(checkout.voucherAmount)}`} /> : null}
          {checkout.points > 0 ? <Row label={t("instorePointsUsed", { points: checkout.points.toLocaleString("vi-VN") })} value={`− ${money(checkout.pointsAmount)}`} /> : null}
          {!checkout.collectInApp ? <Row label={t("instorePayAtCounter")} value={money(checkout.amountDue ?? "0")} strong /> : null}
          {checkout.saleDocumentNo ? <Muted>{t("instoreReceipt", { documentNo: checkout.saleDocumentNo })}</Muted> : null}
          <Button label={t("instoreHome")} onPress={() => router.replace("/trang-chu")} />
        </Screen>
      </ScrollView>
    );
  if (checkout.status !== "awaiting_buyer" && checkout.status !== "awaiting_payment")
    return (
      <Screen>
        <Notice tone="warning" text={checkout.status === "paid_unposted" ? t("instoreUnposted") : checkout.status === "declined" ? t("instoreDeclined") : t("instoreClosed")} />
        {header}
        <Button label={t("instoreHome")} onPress={() => router.replace("/trang-chu")} />
      </Screen>
    );

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Notice tone="info" text={t("instoreExpires", { time: time(checkout.expiresAt) })} />
        {header}
        {checkout.status === "awaiting_payment" ? (
          <Card>
            {Number(checkout.voucherAmount) > 0 ? <Row label={t("instoreVoucher")} value={`− ${money(checkout.voucherAmount)}`} /> : null}
            <Row label={t("instorePointsUsed", { points: checkout.points.toLocaleString("vi-VN") })} value={`− ${money(checkout.pointsAmount)}`} />
            <Row label={t("instoreYouPay")} value={money(checkout.amountDue ?? "0")} strong />
            <Notice tone="info" text={t("instoreWaitingGateway")} />
            {checkout.paymentMethods.length > 0 ? (
              <Choice label={t("paymentMethod")} value={paymentMethod} options={checkout.paymentMethods.map((item) => ({ value: item.code, label: method(item.code) }))} onChange={setPaymentMethod} />
            ) : null}
            <Button label={t("instorePayAgain")} busy={busy} disabled={!paymentMethod} onPress={() => void pay(null)} />
          </Card>
        ) : unlocking ? (
          <Card>
            <Muted>{t("instoreUnlockForPoints")}</Muted>
            <UnlockFlow
              onUnlocked={(stored) => {
                setUnlocking(false);
                void pay(codeOf(stored.secret, Date.now()));
              }}
              onLockedOut={() => router.replace("/diem-thuong")}
            />
          </Card>
        ) : (
          <>
            {checkout.vouchers.length > 0 ? (
              <Card>
                <Choice
                  label={t("instoreVoucher")}
                  value={voucherId ?? ""}
                  options={[
                    { value: "", label: t("instoreNoVoucher") },
                    ...checkout.vouchers.map((item) => ({ value: item.codeId, label: `${item.titleVi} · − ${money(item.discount)}` })),
                  ]}
                  onChange={(value) => {
                    setVoucherId(value || null);
                    setPoints("0");
                  }}
                />
              </Card>
            ) : null}
            <Card>
              <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{t("instoreUsePoints")}</Text>
              {loyalty && canRedeem ? (
                <>
                  <Muted>
                    {t("instorePointsHint", {
                      balance: loyalty.balance.toLocaleString("vi-VN"),
                      min: loyalty.minPoints.toLocaleString("vi-VN"),
                      max: maxPoints.toLocaleString("vi-VN"),
                    })}
                  </Muted>
                  <Field label={t("instorePoints")} keyboardType="number-pad" value={points} onChangeText={setPoints} error={pointsValid ? undefined : t("instorePointsInvalid")} />
                  <Button label={t("instorePointsMax")} kind="secondary" onPress={() => setPoints(String(maxPoints))} />
                </>
              ) : (
                <Muted>{loyalty?.redeemLockedUntil ? t("payCodeRedeemLocked", { time: time(loyalty.redeemLockedUntil) }) : t("instoreNoPoints")}</Muted>
              )}
            </Card>
            {checkout.collectInApp && due > 0 ? (
              <Card>
                {checkout.paymentMethods.length > 0 ? (
                  <Choice label={t("paymentMethod")} value={paymentMethod} options={checkout.paymentMethods.map((item) => ({ value: item.code, label: method(item.code) }))} onChange={setPaymentMethod} />
                ) : (
                  <Notice text={t("instoreNoMethod")} />
                )}
              </Card>
            ) : null}
            <Card>
              {voucherAmount > 0 ? <Row label={t("instoreVoucher")} value={`− ${money(voucherAmount)}`} /> : null}
              <Row label={t("instorePointsAmount")} value={`− ${money(pointsAmount)}`} />
              <Row label={checkout.collectInApp ? t("instoreYouPay") : t("instorePayAtCounter")} value={money(due)} strong />
              <Button label={invoiceOn ? t("instoreInvoiceHide") : t("instoreInvoiceShow")} kind="secondary" onPress={() => setInvoiceOn(!invoiceOn)} />
              {invoiceOn ? (
                <>
                  <Field label={t("instoreInvoiceName")} value={invoice.name} onChangeText={(name) => setInvoice({ ...invoice, name })} />
                  <Field label={t("instoreInvoiceTaxCode")} value={invoice.taxCode} onChangeText={(taxCode) => setInvoice({ ...invoice, taxCode })} />
                  <Field label={t("instoreInvoiceAddress")} value={invoice.address} onChangeText={(address) => setInvoice({ ...invoice, address })} />
                </>
              ) : null}
            </Card>
            {error ? <Notice text={error} /> : null}
            <Button
              label={due > 0 && checkout.collectInApp ? t("instorePay", { amount: money(due) }) : t("instoreConfirm")}
              busy={busy}
              disabled={!pointsValid || (due > 0 && checkout.collectInApp && !paymentMethod)}
              onPress={() => (used > 0 && checkout.smartOtpRequired ? setUnlocking(true) : void pay(null))}
            />
            <Button label={t("instoreDecline")} kind="secondary" disabled={busy} onPress={() => void decline()} />
          </>
        )}
        {error && checkout.status === "awaiting_payment" ? <Notice text={error} /> : null}
      </Screen>
    </ScrollView>
  );
}
