// MAN_HINH_286 Bán hàng, MAN_HINH_287 Thanh toán (tiền mặt), MAN_HINH_288 Kết quả thanh toán (QUYTAC_NGHIEPVU_609, 612, 613, 615, 617, 620).
// Giỏ giữ trên máy khi mất mạng; thanh toán mang khóa yêu cầu, gửi lại cùng khóa khi chưa nhận kết quả. Giảm vượt mức của thu ngân cần chủ nhập PIN.
import type { IposApproval, IposCatalogVariant, IposDiscountInput, IposHeldCart, IposSale, IposVcommCheckout } from "contracts";
import { iposComputeTotals } from "contracts";
import { messages } from "i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { PinPad } from "@/components/PinPad";
import { PaymentDialog, type PaymentRequest } from "./Payment";
import { Button, Choice, Field, Muted, Notice, Overlay } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { t } from "@/lib/i18n";
import { money, newKey, qty, usePos } from "@/lib/pos";
import { printSale, type PrintOutcome } from "@/lib/printer";
import { useSession } from "@/lib/session";
import { colors, radius, space } from "@/lib/theme";

export interface CartLine {
  variantId: string;
  name: string;
  unit: string;
  unitPrice: string;
  quantity: string;
  discount: IposDiscountInput | null;
}
interface Cart {
  lines: CartLine[];
  invoiceDiscount: IposDiscountInput | null;
}
// Phông chữ cố định độ rộng có dấu tiếng Việt cho bản xem trước hóa đơn.
export const monospace = Platform.select({ web: '"Liberation Mono", "Courier New", monospace', default: "monospace" });
const emptyCart: Cart = { lines: [], invoiceDiscount: null };
const maxLines = 200;

function DiscountDialog({ title, base, value, onSave, onClose }: { title: string; base: number; value: IposDiscountInput | null; onSave: (value: IposDiscountInput | null) => void; onClose: () => void }) {
  const [type, setType] = useState<IposDiscountInput["type"]>(value?.type ?? "percent");
  const [amount, setAmount] = useState(value?.value ?? "");
  const number = Number(amount || 0);
  const invalid = type === "percent" ? number > 100 : number > base;
  return (
    <Overlay title={title} onClose={onClose} width={420}>
      <Choice label="" value={type} options={[{ value: "percent", label: t("discountPercent") }, { value: "amount", label: t("discountAmount") }]} onChange={setType} />
      <Field label={type === "percent" ? t("discountPercentValue") : t("discountAmountValue")} keyboardType="decimal-pad" value={amount} onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ""))} />
      <Muted>{t("discountBase", { amount: money(base) })}</Muted>
      {invalid ? <Notice text={t("discountTooLarge")} /> : null}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button label={t("removeDiscount")} kind="secondary" onPress={() => onSave(null)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t("apply")} disabled={invalid || amount === ""} onPress={() => onSave(number === 0 ? null : { type, value: type === "amount" ? String(Math.round(number)) : amount })} />
        </View>
      </View>
    </Overlay>
  );
}

// Chủ cửa hàng chọn tên mình, nhập PIN trên máy để duyệt tại chỗ (API_342).
function ApprovalDialog({ onApproved, onClose }: { onApproved: (approval: IposApproval) => void; onClose: () => void }) {
  const { device } = useSession();
  const owners = (device?.members ?? []).filter((member) => member.role === "owner");
  const [memberId, setMemberId] = useState(owners[0]?.memberId ?? null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Overlay title={t("approvalTitle")} onClose={onClose} width={420}>
      <Muted>{t("approvalText")}</Muted>
      {owners.length === 0 ? <Notice text={t("approvalNoOwner")} /> : <Choice label={t("approver")} value={memberId} options={owners.map((owner) => ({ value: owner.memberId, label: owner.fullName }))} onChange={setMemberId} />}
      {error ? <Notice text={error} /> : null}
      {memberId ? (
        <PinPad
          value={pin}
          onChange={setPin}
          onComplete={(value) => {
            setPin("");
            api<IposApproval>("/ipos/pos/approvals/pin", { method: "POST", json: { memberId, pin: value, purpose: "discount" } })
              .then(onApproved)
              .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
          }}
        />
      ) : null}
    </Overlay>
  );
}

function ResultView({ sale, printing, onReprint, onNew }: { sale: IposSale; printing: PrintOutcome | null; onReprint: () => void; onNew: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.resultWrap}>
      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>{t("paidTitle")}</Text>
        <Text style={styles.resultNumber}>{sale.documentNo}</Text>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>{t("total")}</Text>
          <Text style={styles.resultValue}>{money(sale.total)}</Text>
        </View>
        {sale.payments.map((payment) => (
          <View key={payment.method} style={styles.resultRow}>
            <Text style={styles.resultLabel}>
              {t(`payment_${payment.method}`)}
              {payment.vietqrReference ? ` · ${payment.vietqrReference}` : ""}
            </Text>
            <Text style={styles.resultValue}>{money(payment.method === "cash" && payment.tendered !== null ? payment.tendered : payment.amount)}</Text>
          </View>
        ))}
        {sale.buyerName ? <Muted>{t("resultBuyer", { name: sale.buyerName, earned: sale.earnedPoints, redeemed: sale.redeemedPoints })}</Muted> : null}
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>{t("changeLabel")}</Text>
          <Text style={[styles.resultValue, { color: colors.primary }]}>{money(sale.change)}</Text>
        </View>
        {printing?.printed ? <Notice tone="success" text={t("printed")} /> : null}
        {printing?.error ? <Notice text={printing.error} /> : null}
        {printing?.preview ? (
          <View style={styles.preview}>
            <Muted>{t("printPreview")}</Muted>
            <Text style={styles.previewText}>{printing.preview.join("\n")}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label={t("reprint")} kind="secondary" onPress={onReprint} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t("newSale")} onPress={onNew} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export function Sell() {
  const { me } = useSession();
  const { shift, context, categories, variants, byBarcode, online, markOnline, sync } = usePos();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "warning" | "info" | "success" } | null>(null);
  const [choices, setChoices] = useState<IposCatalogVariant[] | null>(null);
  const [discounting, setDiscounting] = useState<{ index: number | null } | null>(null);
  const [paying, setPaying] = useState(false);
  const [approving, setApproving] = useState<((approval: IposApproval) => void) | null>(null);
  const [held, setHeld] = useState<IposHeldCart[] | null>(null);
  const [result, setResult] = useState<{ sale: IposSale; printing: PrintOutcome | null } | null>(null);
  // Khóa yêu cầu giữ nguyên khi gửi lại (mất mạng), đổi khi giỏ thay đổi.
  const requestKey = useRef<string>(newKey());
  const approvalCode = useRef<string | null>(null);
  const scanRef = useRef<{ focus: () => void } | null>(null);

  const totals = useMemo(() => iposComputeTotals(cart.lines.map((line) => ({ quantity: line.quantity, unitPrice: Number(line.unitPrice), discount: line.discount })), cart.invoiceDiscount), [cart]);
  const maxPercent = Number(context?.cashierMaxDiscountPercent ?? "100");
  const needsApproval = me?.member.role !== "owner" && totals.discountPercent > maxPercent + 1e-9;

  const change = (next: Cart) => {
    setCart(next);
    requestKey.current = newKey();
    approvalCode.current = null;
  };
  const add = (variant: IposCatalogVariant) => {
    const index = cart.lines.findIndex((line) => line.variantId === variant.variantId && !line.discount);
    if (index >= 0) {
      const line = cart.lines[index]!;
      if (Number(line.quantity) + 1 > 9999) return;
      change({ ...cart, lines: cart.lines.map((item, position) => (position === index ? { ...item, quantity: String(Number(item.quantity) + 1) } : item)) });
    } else {
      if (cart.lines.length >= maxLines) return setNotice({ text: t("cartFull"), tone: "warning" });
      change({ ...cart, lines: [...cart.lines, { variantId: variant.variantId, name: variant.name, unit: variant.unit, unitPrice: variant.price, quantity: "1", discount: null }] });
    }
    setNotice(null);
  };
  const scan = (code: string) => {
    if (!code.trim()) return;
    const found = byBarcode(code);
    setSearch("");
    if (found.length === 1) add(found[0]!);
    else if (found.length > 1) setChoices(found);
    else {
      Vibration.vibrate(200);
      setNotice({ text: t("barcodeNotFound", { code: code.trim() }), tone: "error" });
    }
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const children = new Set(categories.filter((category) => category.parentId === categoryId).map((category) => category.id));
    return variants
      .filter((variant) => !categoryId || variant.categoryId === categoryId || (variant.categoryId !== null && children.has(variant.categoryId)))
      .filter((variant) => !term || variant.name.toLowerCase().includes(term) || variant.variantCode.toLowerCase().includes(term) || variant.barcodes.includes(term))
      .slice(0, 120);
  }, [variants, categories, categoryId, search]);

  // Giá trên máy khác máy chủ: tải lại danh mục, cập nhật đơn giá trong giỏ (QUYTAC_NGHIEPVU_609).
  const latestPrices = useRef(variants);
  useEffect(() => {
    latestPrices.current = variants;
  }, [variants]);
  const refreshPrices = async () => {
    await sync();
    setTimeout(() => {
      const prices = new Map(latestPrices.current.map((variant) => [variant.variantId, variant.price]));
      setCart((current) => ({ ...current, lines: current.lines.filter((line) => prices.has(line.variantId)).map((line) => ({ ...line, unitPrice: prices.get(line.variantId) ?? line.unitPrice })) }));
      requestKey.current = newKey();
    }, 0);
  };

  const submit = async (request: PaymentRequest): Promise<IposSale> => {
    if (!shift) throw new Error(t("noShift"));
    try {
      const sale = await api<IposSale>("/ipos/pos/sales", {
        method: "POST",
        json: {
          idempotencyKey: requestKey.current,
          shiftId: shift.id,
          lines: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount })),
          invoiceDiscount: cart.invoiceDiscount,
          payments: request.payments,
          approvalCode: approvalCode.current,
          affiliateTransactionId: request.affiliateTransactionId,
        },
      });
      markOnline(true);
      return sale;
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 0) {
        markOnline(false);
        throw new Error(t("offlinePayment"));
      }
      if (failure instanceof ApiFailure && failure.message === messages.vi.errors.iposPriceChanged) {
        setPaying(false);
        await refreshPrices();
        setNotice({ text: t("priceChanged"), tone: "warning" });
      }
      throw failure;
    }
  };

  // Đơn chờ thanh toán qua ứng dụng VComm (API_341); tạo một lần mỗi lần mở, gửi lại cùng khóa không tạo đơn mới.
  const createCheckout = useMemo(
    () => () =>
      api<IposVcommCheckout>("/ipos/pos/vcomm-checkouts", {
        method: "POST",
        json: {
          idempotencyKey: requestKey.current,
          shiftId: shift?.id,
          lines: cart.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount })),
          invoiceDiscount: cart.invoiceDiscount,
          approvalCode: approvalCode.current,
        },
      }),
    [cart, shift],
  );

  const finish = (sale: IposSale) => {
    setPaying(false);
    setResult({ sale, printing: null });
    change(emptyCart);
    void (async () => {
      const outcome = await printSale(sale, { storePaperWidth: context?.paperWidth ?? 80, reprintNumber: null, openDrawer: true, automatic: true });
      if (outcome.printed) await api(`/ipos/pos/sales/${sale.id}/print-log`, { method: "POST", json: { reprint: false } }).catch(() => undefined);
      setResult((current) => (current && current.sale.id === sale.id ? { ...current, printing: outcome } : current));
    })();
  };

  const startPayment = () => {
    if (!online) return setNotice({ text: t("offlinePayment"), tone: "error" });
    if (needsApproval && !approvalCode.current) {
      setApproving(() => (approval: IposApproval) => {
        approvalCode.current = approval.approvalCode;
        setApproving(null);
        setNotice({ text: t("approvedBy", { name: approval.approverName }), tone: "success" });
        setPaying(true);
      });
      return;
    }
    setPaying(true);
  };

  const holdCart = async () => {
    const list = await api<IposHeldCart[]>("/ipos/pos/held-carts");
    const used = new Set(list.map((item) => item.slot));
    const slot = [1, 2, 3, 4, 5].find((value) => !used.has(value));
    if (!slot) return setNotice({ text: t("heldFull"), tone: "warning" });
    await api(`/ipos/pos/held-carts/${slot}`, { method: "PUT", json: { label: t("heldLabel", { slot, total: money(totals.total) }), payload: cart } });
    change(emptyCart);
    setNotice({ text: t("heldSaved", { slot }), tone: "success" });
  };

  if (result) {
    return (
      <ResultView
        sale={result.sale}
        printing={result.printing}
        onReprint={() => {
          void (async () => {
            const logged = await api<IposSale>(`/ipos/pos/sales/${result.sale.id}/print-log`, { method: "POST", json: { reprint: true } });
            const outcome = await printSale(logged, { storePaperWidth: context?.paperWidth ?? 80, reprintNumber: Math.max(1, logged.printCount - 1), openDrawer: false });
            setResult({ sale: logged, printing: outcome });
          })().catch((failure: unknown) => setNotice({ text: failure instanceof Error ? failure.message : String(failure), tone: "error" }));
        }}
        onNew={() => {
          setResult(null);
          setTimeout(() => scanRef.current?.focus(), 0);
        }}
      />
    );
  }

  return (
    <View style={styles.layout}>
      <View style={styles.catalog}>
        <TextInput
          ref={scanRef as never}
          autoFocus
          accessibilityLabel={t("scanOrSearch")}
          placeholder={t("scanOrSearch")}
          placeholderTextColor={colors.textMuted}
          style={styles.scan}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => scan(search)}
          blurOnSubmit={false}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space[2] }}>
          {[{ id: null as string | null, name: t("allItems") }, ...categories.filter((category) => !category.parentId)].map((category) => (
            <Pressable key={category.id ?? "tat-ca"} accessibilityRole="button" onPress={() => setCategoryId(category.id)} style={[styles.chip, categoryId === category.id ? styles.chipOn : null]}>
              <Text style={[styles.chipText, categoryId === category.id ? { color: colors.surface } : null]}>{category.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {notice ? <Notice text={notice.text} tone={notice.tone} /> : null}
        <FlatList
          data={visible}
          keyExtractor={(variant) => variant.variantId}
          numColumns={4}
          columnWrapperStyle={{ gap: space[2] }}
          contentContainerStyle={{ gap: space[2], paddingBottom: space[4] }}
          ListEmptyComponent={<Muted>{variants.length === 0 ? t("catalogEmpty") : t("noItemsMatch")}</Muted>}
          renderItem={({ item: variant }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={variant.name} onPress={() => add(variant)} style={({ pressed }) => [styles.tile, pressed ? { backgroundColor: colors.primaryLight } : null]}>
              <Text style={styles.tileName} numberOfLines={2}>
                {variant.name}
              </Text>
              <Text style={styles.tilePrice}>{money(variant.price)}</Text>
            </Pressable>
          )}
        />
      </View>
      <View style={styles.cart}>
        <View style={styles.row}>
          <Text style={[styles.cartTitle, { flex: 1 }]}>{t("cartTitle", { count: cart.lines.length })}</Text>
          <Pressable accessibilityRole="button" onPress={() => void api<IposHeldCart[]>("/ipos/pos/held-carts").then(setHeld).catch(() => setHeld([]))}>
            <Text style={styles.link}>{t("heldCarts")}</Text>
          </Pressable>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space[2] }}>
          {cart.lines.length === 0 ? <Muted>{t("cartEmpty")}</Muted> : null}
          {cart.lines.map((line, index) => {
            const amounts = totals.lines[index]!;
            return (
              <View key={`${line.variantId}-${index}`} style={styles.line}>
                <View style={styles.row}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineAmount}>{money(amounts.gross - amounts.discount)}</Text>
                </View>
                <View style={styles.row}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("decrease")} style={styles.step} onPress={() => change({ ...cart, lines: Number(line.quantity) <= 1 ? cart.lines.filter((_, position) => position !== index) : cart.lines.map((item, position) => (position === index ? { ...item, quantity: String(Number(item.quantity) - 1) } : item)) })}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <TextInput
                    accessibilityLabel={t("quantityOf", { name: line.name })}
                    style={styles.qty}
                    keyboardType="decimal-pad"
                    value={line.quantity}
                    onChangeText={(text) => {
                      const value = text.replace(",", ".").replace(/[^\d.]/g, "");
                      if (/^\d{0,4}(\.\d{0,3})?$/.test(value)) change({ ...cart, lines: cart.lines.map((item, position) => (position === index ? { ...item, quantity: value || "0" } : item)) });
                    }}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={t("increase")} style={styles.step} onPress={() => Number(line.quantity) < 9999 && change({ ...cart, lines: cart.lines.map((item, position) => (position === index ? { ...item, quantity: String(Number(item.quantity) + 1) } : item)) })}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                  <Text style={styles.muted}>
                    {line.unit} × {money(line.unitPrice)}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => setDiscounting({ index })}>
                    <Text style={styles.link}>{line.discount ? t("lineDiscountShort", { amount: money(amounts.discount) }) : t("addDiscount")}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.totals}>
          <View style={styles.row}>
            <Text style={styles.sumLabel}>{t("subtotal")}</Text>
            <Text style={styles.sumValue}>{money(totals.subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.sumLabel}>{t("discountTotal")}</Text>
            <Text style={styles.sumValue}>{totals.lineDiscount + totals.invoiceDiscount > 0 ? `−${money(totals.lineDiscount + totals.invoiceDiscount)}` : "0"}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setDiscounting({ index: null })} disabled={cart.lines.length === 0}>
            <Text style={styles.link}>{cart.invoiceDiscount ? t("invoiceDiscountShort") : t("addInvoiceDiscount")}</Text>
          </Pressable>
          <View style={styles.row}>
            <Text style={styles.totalLabel}>{t("total")}</Text>
            <Text style={styles.totalValue}>{money(totals.total)}</Text>
          </View>
          {needsApproval ? <Notice tone="warning" text={t("discountOverLimit", { percent: qty(maxPercent) })} /> : null}
          {totals.error ? <Notice text={t("discountTooLarge")} /> : null}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button label={t("holdCart")} kind="secondary" disabled={cart.lines.length === 0} onPress={() => void holdCart().catch((failure: unknown) => setNotice({ text: failure instanceof Error ? failure.message : String(failure), tone: "error" }))} />
            </View>
            <View style={{ flex: 2 }}>
              <Button label={t("pay")} disabled={cart.lines.length === 0 || Boolean(totals.error) || cart.lines.some((line) => Number(line.quantity) <= 0)} onPress={startPayment} />
            </View>
          </View>
        </View>
      </View>

      {choices ? (
        <Overlay title={t("chooseVariant")} onClose={() => setChoices(null)}>
          {choices.map((variant) => (
            <Button
              key={variant.variantId}
              kind="secondary"
              label={`${variant.name} · ${money(variant.price)}`}
              onPress={() => {
                add(variant);
                setChoices(null);
              }}
            />
          ))}
        </Overlay>
      ) : null}
      {discounting ? (
        <DiscountDialog
          title={discounting.index === null ? t("invoiceDiscountTitle") : t("lineDiscountTitle")}
          base={discounting.index === null ? totals.subtotal - totals.lineDiscount : totals.lines[discounting.index]!.gross}
          value={discounting.index === null ? cart.invoiceDiscount : cart.lines[discounting.index]!.discount}
          onClose={() => setDiscounting(null)}
          onSave={(value) => {
            const index = discounting.index;
            change(index === null ? { ...cart, invoiceDiscount: value } : { ...cart, lines: cart.lines.map((line, position) => (position === index ? { ...line, discount: value } : line)) });
            setDiscounting(null);
          }}
        />
      ) : null}
      {approving ? <ApprovalDialog onApproved={approving} onClose={() => setApproving(null)} /> : null}
      {paying && shift ? (
        <PaymentDialog
          total={totals.total}
          context={context}
          shiftId={shift.id}
          requestKey={requestKey.current}
          submit={submit}
          createCheckout={createCheckout}
          onPaid={finish}
          onClose={() => setPaying(false)}
        />
      ) : null}
      {held ? (
        <Overlay title={t("heldCarts")} onClose={() => setHeld(null)}>
          {held.length === 0 ? <Muted>{t("heldEmpty")}</Muted> : null}
          {held.map((item) => (
            <View key={item.slot} style={styles.row}>
              <Text style={{ flex: 1, color: colors.text }}>
                {item.label} · {item.memberName}
              </Text>
              <Button
                label={t("restore")}
                kind="secondary"
                disabled={cart.lines.length > 0}
                onPress={() => {
                  const payload = item.payload as Cart;
                  change({ lines: payload.lines ?? [], invoiceDiscount: payload.invoiceDiscount ?? null });
                  setHeld(null);
                  void api(`/ipos/pos/held-carts/${item.slot}`, { method: "DELETE" }).then(() => refreshPrices());
                }}
              />
            </View>
          ))}
          {cart.lines.length > 0 && held.length > 0 ? <Muted>{t("restoreNeedsEmptyCart")}</Muted> : null}
        </Overlay>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layout: { flex: 1, flexDirection: "row", gap: space[3], padding: space[3] },
  catalog: { flex: 3, gap: space[2] },
  cart: { flex: 2, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.medium, padding: space[3], gap: space[2], minWidth: 340 },
  row: { flexDirection: "row", alignItems: "center", gap: space[2] },
  scan: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, paddingHorizontal: space[3], minHeight: 48, fontSize: 17, backgroundColor: colors.surface, color: colors.text },
  chip: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.round, paddingHorizontal: space[3], minHeight: 40, justifyContent: "center", backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600" },
  tile: { flex: 1, maxWidth: "25%", minHeight: 88, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.medium, padding: space[2], justifyContent: "space-between" },
  tileName: { color: colors.text, fontWeight: "600" },
  tilePrice: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  cartTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  link: { color: colors.primary, fontWeight: "600", paddingVertical: space[1] },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: space[2], gap: space[1] },
  lineName: { flex: 1, color: colors.text, fontWeight: "600" },
  lineAmount: { color: colors.text, fontWeight: "700" },
  step: { width: 36, height: 36, borderRadius: radius.small, borderWidth: 1, borderColor: colors.inputBorder, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 18, fontWeight: "700", color: colors.text },
  qty: { width: 64, height: 36, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.small, textAlign: "center", color: colors.text },
  muted: { color: colors.textMuted, flex: 1 },
  sumLabel: { flex: 1, color: colors.textMuted },
  sumValue: { color: colors.text, fontWeight: "600" },
  totals: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[2], gap: space[2] },
  totalLabel: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: 24, fontWeight: "800", color: colors.text },
  payTotal: { fontSize: 22, fontWeight: "800", color: colors.text },
  quick: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.small, paddingHorizontal: space[3], minHeight: 44, justifyContent: "center" },
  quickText: { color: colors.primary, fontWeight: "700" },
  change: { fontSize: 18, fontWeight: "700", color: colors.text },
  resultWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: space[4] },
  resultCard: { width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, padding: space[5], gap: space[3] },
  resultTitle: { fontSize: 22, fontWeight: "800", color: colors.success, textAlign: "center" },
  resultNumber: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  resultRow: { flexDirection: "row", justifyContent: "space-between" },
  resultLabel: { color: colors.textMuted, fontSize: 16 },
  resultValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  preview: { backgroundColor: colors.background, borderRadius: radius.small, padding: space[3], gap: space[1] },
  previewText: { fontFamily: monospace, fontSize: 12, color: colors.text },
});
