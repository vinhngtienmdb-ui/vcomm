// MAN_HINH_290 Trả hàng (QUYTAC_NGHIEPVU_624): tìm, quét số hóa đơn; chọn dòng, số lượng (hóa đơn tiền mặt, VietQR) hoặc hủy toàn bộ (có điểm, voucher);
// lý do; chủ cửa hàng duyệt bằng PIN khi thu ngân trả; hoàn tiền mặt, in phiếu trả, mở ngăn kéo.
import type { IposApproval, IposReturn, IposReturnLookup } from "contracts";
import { messages } from "i18n";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Field, Muted, Notice, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { money, newKey, qty, usePos } from "@/lib/pos";
import { printReturn, type PrintOutcome } from "@/lib/printer";
import { colors, radius, space } from "@/lib/theme";
import { ApprovalDialog, monospace } from "./Sell";

export function Returns() {
  const { shift, context } = usePos();
  const [documentNo, setDocumentNo] = useState("");
  const [lookup, setLookup] = useState<IposReturnLookup | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<{ item: IposReturn; printing: PrintOutcome | null } | null>(null);
  const requestKey = useRef(newKey());

  const find = () => {
    if (!documentNo.trim()) return;
    setError(null);
    setResult(null);
    api<IposReturnLookup>(`/ipos/pos/returns/lookup?documentNo=${encodeURIComponent(documentNo.trim())}`)
      .then((found) => {
        setLookup(found);
        setQuantities({});
        requestKey.current = newKey();
      })
      .catch((failure: unknown) => {
        setLookup(null);
        setError(failure instanceof Error ? failure.message : String(failure));
      });
  };
  const selected = lookup ? lookup.lines.filter((line) => Number(quantities[line.saleLineId] || 0) > 0) : [];
  // Ước tính tiền hoàn trên máy; máy chủ tính chính thức theo phân bổ giảm.
  const estimate = lookup
    ? lookup.mode === "full_cancel"
      ? lookup.lines.reduce((sum, line) => sum + Number(line.amount) - Number(line.returnedAmount), 0)
      : selected.reduce((sum, line) => {
          const q = Number(quantities[line.saleLineId]);
          const remaining = Number(line.quantity) - Number(line.returnedQuantity);
          return sum + (Math.abs(q - remaining) < 1e-9 ? Number(line.amount) - Number(line.returnedAmount) : Math.round((Number(line.amount) * q) / Number(line.quantity)));
        }, 0)
    : 0;
  const submit = (approvalCode: string | null) => {
    if (!lookup || !shift) return;
    setBusy(true);
    setError(null);
    api<IposReturn>("/ipos/pos/returns", {
      method: "POST",
      json: {
        idempotencyKey: requestKey.current,
        shiftId: shift.id,
        saleId: lookup.sale.id,
        kind: lookup.mode,
        lines: lookup.mode === "full_cancel" ? [] : selected.map((line) => ({ saleLineId: line.saleLineId, quantity: quantities[line.saleLineId] })),
        reason: reason.trim(),
        approvalCode,
      },
    })
      .then((item) => {
        setResult({ item, printing: null });
        setLookup(null);
        setDocumentNo("");
        setReason("");
        requestKey.current = newKey();
        void printReturn(item, context?.paperWidth ?? 80).then((printing) => setResult((current) => (current?.item.id === item.id ? { item, printing } : current)));
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)))
      .finally(() => setBusy(false));
  };
  const blocked = lookup?.blockedReason ? ((messages.vi.errors as Record<string, string>)[lookup.blockedReason] ?? lookup.blockedReason) : null;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.column}>
        <Card>
          <Title>{t("returnsTitle")}</Title>
          <View style={styles.row}>
            <TextInput
              autoFocus
              accessibilityLabel={t("returnDocument")}
              placeholder={t("returnDocumentPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { flex: 1 }]}
              value={documentNo}
              onChangeText={setDocumentNo}
              onSubmitEditing={find}
              autoCapitalize="characters"
            />
            <Button label={t("returnFind")} kind="secondary" onPress={find} />
          </View>
          {error ? <Notice text={error} /> : null}
          {result ? (
            <View style={{ gap: space[2] }}>
              <Notice tone="success" text={t("returnDone", { number: result.item.documentNo, amount: money(result.item.refundCash) })} />
              {result.printing?.error ? <Notice text={result.printing.error} /> : null}
              {result.printing?.preview ? <Text style={styles.preview}>{result.printing.preview.join("\n")}</Text> : null}
            </View>
          ) : null}
        </Card>
      </View>
      {lookup ? (
        <View style={styles.column}>
          <Card>
            <Title>{lookup.sale.documentNo}</Title>
            <Muted>
              {new Date(lookup.sale.soldAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {lookup.sale.outletName} · {t("total")} {money(lookup.sale.total)} · {t("returnDeadline", { day: lookup.deadline.split("-").reverse().join("/") })}
            </Muted>
            {blocked ? <Notice text={blocked} /> : null}
            {!blocked && lookup.mode === "full_cancel" ? <Notice tone="warning" text={t("returnFullCancelNotice")} /> : null}
            {lookup.lines.map((line) => {
              const remaining = Number(line.quantity) - Number(line.returnedQuantity);
              return (
                <View key={line.saleLineId} style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>{line.name}</Text>
                    <Muted>{t("returnLineInfo", { bought: qty(line.quantity), returned: qty(line.returnedQuantity), amount: money(line.amount) })}</Muted>
                  </View>
                  {lookup.mode === "partial" && !blocked && remaining > 0 ? (
                    <TextInput
                      accessibilityLabel={t("returnQuantityOf", { name: line.name })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      style={styles.qty}
                      value={quantities[line.saleLineId] ?? ""}
                      onChangeText={(text) => {
                        const value = text.replace(",", ".").replace(/[^\d.]/g, "");
                        if (Number(value || 0) <= remaining) setQuantities((current) => ({ ...current, [line.saleLineId]: value }));
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
            {!blocked ? (
              <>
                <Field label={t("returnReason")} value={reason} maxLength={200} onChangeText={setReason} />
                <Text style={styles.estimate}>{t("returnEstimate", { amount: money(estimate) })}</Text>
                <Button
                  label={lookup.mode === "full_cancel" ? t("returnCancelInvoice") : t("returnConfirm")}
                  busy={busy}
                  disabled={!reason.trim() || (lookup.mode === "partial" && selected.length === 0)}
                  onPress={() => (lookup.needsApproval ? setApproving(true) : submit(null))}
                />
              </>
            ) : null}
          </Card>
        </View>
      ) : null}
      {approving ? (
        <ApprovalDialog
          purpose="return"
          onClose={() => setApproving(false)}
          onApproved={(approval: IposApproval) => {
            setApproving(false);
            submit(approval.approvalCode);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space[3], padding: space[3] },
  column: { flex: 1, minWidth: 380, gap: space[3] },
  row: { flexDirection: "row", gap: space[2], alignItems: "center" },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, paddingHorizontal: space[3], minHeight: 44, backgroundColor: colors.surface, color: colors.text },
  line: { flexDirection: "row", alignItems: "center", gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: space[2] },
  qty: { width: 80, height: 40, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, textAlign: "center", color: colors.text, backgroundColor: colors.surface },
  estimate: { fontSize: 18, fontWeight: "700", color: colors.text },
  preview: { fontFamily: monospace, fontSize: 12, color: colors.text, backgroundColor: colors.background, padding: space[3], borderRadius: radius.small },
});
