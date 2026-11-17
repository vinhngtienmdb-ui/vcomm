// MAN_HINH_287 Thanh toán (QUYTAC_NGHIEPVU_614 đến 617):
// - Tiền mặt (mệnh giá nhanh, tiền thừa) kết hợp VietQR (mã VietQR, thu ngân bấm "Đã nhận tiền" sau khi kiểm tài khoản).
// - Khách VComm dùng điểm, voucher: thu ngân quét mã thành viên hoặc khách quét mã QR cửa hàng; phần còn lại thu tiền mặt, VietQR.
// - Ứng dụng VComm: đơn chờ TT… (quét mã động của khách hoặc khách quét mã QR); khách trả, hoàn tất có khi CONG_VIEC_73 xong lát L4.
import type { IposLoyaltyTransaction, IposPosContext, IposSale, IposVcommCheckout } from "contracts";
import { iposVietqrPayload } from "contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { QrView } from "@/components/QrView";
import { Button, Choice, Field, Muted, Notice, Overlay } from "@/components/ui";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { money } from "@/lib/pos";
import { colors, radius, space } from "@/lib/theme";

export type PaymentLines = { variantId: string; quantity: string; unitPrice: string; discount: unknown }[];
export interface PaymentRequest {
  payments: ({ method: "cash"; tendered: string } | { method: "vietqr"; amount: string; reference: string })[];
  affiliateTransactionId: string | null;
}

const pollMs = 2000;

function Loyalty({ shiftId, total, value, onChange }: { shiftId: string; total: number; value: IposLoyaltyTransaction | null; onChange: (value: IposLoyaltyTransaction | null) => void }) {
  const [mode, setMode] = useState<"member" | "merchant" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Khách quét mã QR cửa hàng: hỏi trạng thái mỗi 2 giây đến khi khách xác nhận, từ chối hoặc hết hạn.
  useEffect(() => {
    if (!value || value.status !== "pending") return;
    const timer = setInterval(() => {
      void api<IposLoyaltyTransaction>(`/ipos/pos/loyalty-transactions/${value.id}`).then((next) => {
        if (next.status !== "pending") onChange({ ...next, qrCode: null });
      });
    }, pollMs);
    return () => clearInterval(timer);
  }, [value, onChange]);
  const start = (method: "buyer_qr" | "merchant_qr", memberCode: string | null) => {
    setBusy(true);
    setError(null);
    api<IposLoyaltyTransaction>("/ipos/pos/loyalty-transactions", { method: "POST", json: { shiftId, billAmount: String(total), method, memberCode } })
      .then((created) => {
        onChange(created);
        setCode("");
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
      .finally(() => setBusy(false));
  };
  if (value && value.status === "completed") {
    return (
      <View style={styles.box}>
        <Text style={styles.boxTitle}>{t("loyaltyDone", { name: value.buyerName ?? "" })}</Text>
        {value.redeemedPoints > 0 ? <Muted>{t("loyaltyPoints", { points: value.redeemedPoints, amount: money(value.redeemedAmount) })}</Muted> : null}
        {Number(value.voucherDiscount) > 0 ? <Muted>{t("loyaltyVoucher", { amount: money(value.voucherDiscount) })}</Muted> : null}
        {value.redeemedPoints === 0 && Number(value.voucherDiscount) === 0 ? <Muted>{t("loyaltyEarnOnly")}</Muted> : null}
        <Pressable accessibilityRole="button" onPress={() => void api(`/ipos/pos/loyalty-transactions/${value.id}/cancel`, { method: "POST" }).then(() => onChange(null))}>
          <Text style={styles.link}>{t("loyaltyRemove")}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>{t("loyaltyTitle")}</Text>
      {value && value.status === "pending" && value.qrCode ? (
        <View style={{ alignItems: "center", gap: space[2] }}>
          <QrView value={value.qrCode} size={180} label={t("loyaltyMerchantQr")} />
          <Muted>{t("loyaltyWaiting")}</Muted>
          <Pressable accessibilityRole="button" onPress={() => onChange(null)}>
            <Text style={styles.link}>{t("cancel")}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {value && value.status !== "pending" ? <Notice tone="warning" text={t(`loyalty_${value.status}`)} /> : null}
          <Choice label="" value={mode} options={[{ value: "member", label: t("loyaltyScanMember") }, { value: "merchant", label: t("loyaltyShowQr") }]} onChange={(next) => (next === "merchant" ? start("merchant_qr", null) : setMode(next))} />
          {mode === "member" ? (
            <TextInput
              autoFocus
              accessibilityLabel={t("memberCode")}
              placeholder={t("memberCodePlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={() => code.trim() && start("buyer_qr", code.trim())}
              editable={!busy}
            />
          ) : null}
        </>
      )}
      {error ? <Notice text={error} /> : null}
    </View>
  );
}

function VcommApp({ create, onClose, onPaid }: { create: () => Promise<IposVcommCheckout>; onClose: () => void; onPaid: (sale: IposSale) => void }) {
  const [checkout, setCheckout] = useState<IposVcommCheckout | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void create()
      .then((created) => {
        setCheckout(created);
        setQrUrl(created.qrUrl);
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
  }, [create]);
  useEffect(() => {
    if (!checkout || !["awaiting_buyer", "awaiting_payment"].includes(checkout.status)) return;
    const timer = setInterval(() => void api<IposVcommCheckout>(`/ipos/pos/vcomm-checkouts/${checkout.id}`).then(setCheckout), pollMs);
    return () => clearInterval(timer);
  }, [checkout]);
  // Khách trả xong trên ứng dụng VComm: máy chủ đã ghi hóa đơn (móc hoàn tất); tải hóa đơn để in như thanh toán tại quầy.
  const saleId = checkout?.saleId ?? null;
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  useEffect(() => {
    if (!saleId) return;
    void api<IposSale>(`/ipos/pos/sales/${saleId}`)
      .then((sale) => onPaidRef.current(sale))
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
  }, [saleId]);
  if (error && !checkout) return <Notice text={error} />;
  if (!checkout) return <Muted>{t("creatingCheckout")}</Muted>;
  const open = ["awaiting_buyer", "awaiting_payment"].includes(checkout.status);
  return (
    <View style={{ gap: space[3] }}>
      {!checkout.completionAvailable ? <Notice tone="warning" text={t("vcommAppPending")} /> : null}
      <Text style={styles.boxTitle}>{t("checkoutNumber", { number: checkout.documentNo, amount: money(checkout.billAmount) })}</Text>
      <Muted>{t(`checkout_${checkout.status}`)}{checkout.buyerName ? ` · ${checkout.buyerName}` : ""}</Muted>
      {open ? (
        <View style={{ flexDirection: "row", gap: space[4], flexWrap: "wrap" }}>
          {qrUrl ? (
            <View style={{ alignItems: "center", gap: space[1] }}>
              <QrView value={qrUrl} size={180} label={t("checkoutQr")} />
              <Muted>{t("checkoutQrHint")}</Muted>
            </View>
          ) : null}
          {!checkout.buyerName ? (
            <View style={{ flex: 1, minWidth: 220, gap: space[2] }}>
              <Muted>{t("payCodeHint")}</Muted>
              <TextInput
                accessibilityLabel={t("payCode")}
                placeholder={t("payCode")}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 18))}
                onSubmitEditing={() =>
                  void api<IposVcommCheckout>(`/ipos/pos/vcomm-checkouts/${checkout.id}/pay-code`, { method: "POST", json: { code } })
                    .then((next) => {
                      setCheckout(next);
                      setError(null);
                    })
                    .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
                }
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {error ? <Notice text={error} /> : null}
      {open ? (
        <Button
          label={t("cancelCheckout")}
          kind="secondary"
          onPress={() => void api<IposVcommCheckout>(`/ipos/pos/vcomm-checkouts/${checkout.id}/cancel`, { method: "POST" }).then(setCheckout).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))}
        />
      ) : (
        <Button label={t("done")} onPress={onClose} />
      )}
    </View>
  );
}

export function PaymentDialog({
  total,
  context,
  shiftId,
  requestKey,
  submit,
  createCheckout,
  onPaid,
  onClose,
}: {
  total: number;
  context: IposPosContext | null;
  shiftId: string;
  requestKey: string;
  submit: (request: PaymentRequest) => Promise<IposSale>;
  createCheckout: () => Promise<IposVcommCheckout>;
  onPaid: (sale: IposSale) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"counter" | "app">("counter");
  const [loyalty, setLoyalty] = useState<IposLoyaltyTransaction | null>(null);
  const [vietqrAmount, setVietqrAmount] = useState("");
  const [received, setReceived] = useState(false);
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loyaltyRef = useRef(loyalty);
  loyaltyRef.current = loyalty;
  const due = loyalty?.status === "completed" ? Number(loyalty.paidAmount) : total;
  const transfer = Math.min(Number(vietqrAmount || 0), due);
  const cashDue = due - transfer;
  const given = tendered === "" ? cashDue : Number(tendered);
  // Nội dung chuyển khoản: mã điểm bán và 8 ký tự đầu của mã yêu cầu (người dùng chọn 2026-11-17).
  const reference = `${context?.outletCode ?? "IPOS"} ${requestKey.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const quick = useMemo(
    () => [...new Set([cashDue, ...[10_000, 20_000, 50_000, 100_000, 200_000, 500_000].map((note) => Math.ceil(cashDue / note) * note)])].filter((value) => value >= cashDue && value > 0).slice(0, 6),
    [cashDue],
  );
  useEffect(() => {
    setReceived(false);
  }, [vietqrAmount, due]);
  // Đóng hộp khi khách đã dùng điểm mà chưa thanh toán: hủy giao dịch điểm để hoàn điểm.
  const close = () => {
    const current = loyaltyRef.current;
    if (current?.status === "completed") void api(`/ipos/pos/loyalty-transactions/${current.id}/cancel`, { method: "POST" }).catch(() => undefined);
    onClose();
  };
  const canPay = !busy && given >= cashDue && (transfer === 0 || received) && loyalty?.status !== "pending";
  return (
    <Overlay title={t("paymentTitle")} onClose={busy ? undefined : close} width={720}>
      <Choice label="" value={tab} options={[{ value: "counter", label: t("payAtCounter") }, { value: "app", label: t("payInApp") }]} onChange={setTab} />
      {tab === "app" ? (
        <VcommApp create={createCheckout} onClose={close} onPaid={onPaid} />
      ) : (
        <View style={{ gap: space[3] }}>
          <Text style={styles.total}>{t("amountDue", { amount: money(due) })}</Text>
          {due !== total ? <Muted>{t("dueAfterLoyalty", { total: money(total) })}</Muted> : null}
          <Loyalty shiftId={shiftId} total={total} value={loyalty} onChange={setLoyalty} />
          {context?.vietqr ? (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>{t("vietqrTitle")}</Text>
              <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Field label={t("vietqrAmount")} keyboardType="number-pad" value={vietqrAmount ? money(vietqrAmount) : ""} onChangeText={(text) => setVietqrAmount(text.replace(/\D/g, ""))} />
                </View>
                <Button label={t("vietqrAll")} kind="secondary" onPress={() => setVietqrAmount(String(due))} />
              </View>
              {transfer > 0 ? (
                <View style={{ flexDirection: "row", gap: space[3], alignItems: "center", flexWrap: "wrap" }}>
                  <QrView value={iposVietqrPayload({ bankBin: context.vietqr.bankBin, accountNo: context.vietqr.accountNo, amount: transfer, content: reference })} size={180} label={t("vietqrTitle")} />
                  <View style={{ flex: 1, minWidth: 220, gap: space[1] }}>
                    <Text style={styles.strong}>{context.vietqr.accountName}</Text>
                    <Muted>{t("vietqrAccount", { account: context.vietqr.accountNo })}</Muted>
                    <Muted>{t("vietqrContent", { content: reference })}</Muted>
                    <Text style={styles.strong}>{money(transfer)}</Text>
                    <Button label={received ? t("vietqrReceivedDone") : t("vietqrReceived")} kind={received ? "primary" : "secondary"} onPress={() => setReceived(!received)} />
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
          {cashDue > 0 ? (
            <View style={styles.box}>
              <Text style={styles.boxTitle}>{t("cashTitle", { amount: money(cashDue) })}</Text>
              <Field label={t("cashGiven")} keyboardType="number-pad" value={tendered ? money(tendered) : ""} placeholder={money(cashDue)} onChangeText={(text) => setTendered(text.replace(/\D/g, ""))} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                {quick.map((value) => (
                  <Pressable key={value} accessibilityRole="button" onPress={() => setTendered(String(value))} style={styles.quick}>
                    <Text style={styles.quickText}>{money(value)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.change}>{given >= cashDue ? t("changeDue", { amount: money(given - cashDue) }) : t("cashShort", { amount: money(cashDue - given) })}</Text>
            </View>
          ) : null}
          {transfer > 0 && !received ? <Muted>{t("vietqrConfirmFirst")}</Muted> : null}
          {error ? <Notice text={error} /> : null}
          <Button
            label={t("confirmPayment")}
            busy={busy}
            disabled={!canPay}
            onPress={() => {
              setBusy(true);
              setError(null);
              const payments: PaymentRequest["payments"] = [];
              if (cashDue > 0) payments.push({ method: "cash", tendered: String(given) });
              if (transfer > 0) payments.push({ method: "vietqr", amount: String(transfer), reference });
              if (payments.length === 0) payments.push({ method: "cash", tendered: "0" });
              submit({ payments, affiliateTransactionId: loyalty?.status === "completed" ? loyalty.id : null })
                .then(onPaid)
                .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
                .finally(() => setBusy(false));
            }}
          />
          <Muted>{t("paymentRetryHint")}</Muted>
        </View>
      )}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 22, fontWeight: "800", color: colors.text },
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, padding: space[3], gap: space[2] },
  boxTitle: { fontWeight: "700", color: colors.text, fontSize: 16 },
  strong: { fontWeight: "700", color: colors.text },
  link: { color: colors.primary, fontWeight: "600", paddingVertical: space[1] },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, paddingHorizontal: space[3], minHeight: 44, backgroundColor: colors.surface, color: colors.text },
  quick: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.small, paddingHorizontal: space[3], minHeight: 44, justifyContent: "center" },
  quickText: { color: colors.primary, fontWeight: "700" },
  change: { fontSize: 18, fontWeight: "700", color: colors.text },
});
