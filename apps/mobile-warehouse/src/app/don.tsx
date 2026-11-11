// MAN_HINH_108 Phiếu quét theo đơn (CHUC_NANG_159): nhận hàng từ đơn mua (phiếu nhập mua), xuất giao hàng cho đơn bán (phiếu xuất giao hàng).
// Quét mã hàng cộng vào dòng đơn, quy đổi đơn vị quét sang đơn vị dòng đơn; ghi nhận thì lập phiếu rồi gửi để ghi sổ (API có sẵn).
import type { LotSuggestion, StockDocumentResponse, StockItemOption } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Header } from "@/components/Header";
import { LineList } from "@/components/LineList";
import { ScanPanel } from "@/components/ScanPanel";
import { Button, Card, Loading, Muted, Notice, Screen } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { useLeaveGuard } from "@/components/useLeaveGuard";
import { useScanner } from "@/components/useScanner";
import { api, failureText } from "@/lib/api";
import { quantity, t } from "@/lib/i18n";
import { addItem, addSerial, type ScanLine } from "@/lib/scan";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

type OrderLine = {
  orderLineId: string;
  variantId: string;
  sku: string;
  productName: string;
  unitId: string;
  unitName: string;
  factor?: string;
  receivableQuantity?: string;
  remainingQuantity?: string;
  tracksLots: boolean;
  tracksSerials: boolean;
};
type Order = { id: string; documentNo: string; warehouseId: string; companyId: string; lines: OrderLine[] };

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export default function OrderDocumentScreen() {
  const { loai, donId } = useLocalSearchParams<{ loai: string; donId: string }>();
  const receiving = loai === "nhan-hang";
  const { workplace } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [awaitingKey, setAwaitingKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, LotSuggestion[]>>({});
  const [done, setDone] = useState<StockDocumentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scanner = useScanner(order?.companyId ?? null, workplace?.locations ?? []);
  const { busy, error, fields, run } = useAction();
  const { requestLeave, prompt } = useLeaveGuard(lines.length > 0 && !done);

  useEffect(() => {
    api<Order>(`/inventory/${receiving ? "purchase-orders" : "sales-orders"}/${donId}`)
      .then(setOrder)
      .catch((failure: unknown) => setLoadError(failureText(failure)));
  }, [donId, receiving]);

  const needsLocation = workplace?.warehouse.usesLocations ?? false;

  const loadLots = async (line: ScanLine) => {
    if (receiving || !line.tracksLots || !order) return;
    const query = new URLSearchParams({ warehouseId: order.warehouseId, companyId: order.companyId, variantId: line.variantId, ...(line.locationId ? { locationId: line.locationId } : {}) });
    const lots = await api<LotSuggestion[]>(`/inventory/documents/lot-suggestions?${query}`).catch(() => []);
    setSuggestions((current) => ({ ...current, [line.key]: lots }));
    const suggested = lots.find((lot) => lot.suggested);
    if (suggested)
      setLines((current) => current.map((item) => (item.key === line.key && !item.lotId ? { ...item, lotId: suggested.lotId, lotNo: suggested.lotNo, expiresOn: suggested.expiresOn } : item)));
  };

  const addOption = (option: StockItemOption) => {
    if (!order) return;
    const orderLine = order.lines.find((line) => line.variantId === option.variantId);
    if (!orderLine) return scanner.fail(t("notOnOrder", { name: option.productName }));
    if (needsLocation && !scanner.location) return scanner.fail(t("scanLocationFirst"));
    const factor = Number(orderLine.factor ?? option.units.find((unit) => unit.unitId === orderLine.unitId)?.factor ?? "1");
    const result = addItem(lines, option, scanner.location, { orderLineId: orderLine.orderLineId, unitId: orderLine.unitId, unitName: orderLine.unitName, factor });
    setLines(result.lines);
    if (option.tracksSerials) setAwaitingKey(result.line.key);
    scanner.setMessage({ tone: "success", text: t("added", { name: option.productName, quantity: quantity(result.line.quantity), unit: result.line.unitName }) });
    if (result.lines.length > lines.length) void loadLots(result.line);
  };

  const addSerialCode = (serial: string) => {
    if (!awaitingKey) return;
    const result = addSerial(lines, awaitingKey, serial);
    if (result.duplicate) return scanner.fail(t("serialDuplicate", { serial }));
    setLines(result.lines);
    scanner.setMessage({ tone: "success", text: t("serialAdded", { serial }) });
  };

  const submit = () =>
    run(async () => {
      if (!order) return;
      const body = {
        orderId: order.id,
        documentDate: today(),
        lines: lines.map((line) =>
          receiving
            ? { orderLineId: line.orderLineId!, quantity: String(line.quantity), lotNo: line.lotNo || null, expiresOn: line.expiresOn || null, locationId: line.locationId, serials: line.serials }
            : {
                orderLineId: line.orderLineId!,
                quantity: String(line.quantity),
                lotId: line.lotId,
                lotOverrideReason: line.lotOverrideReason || null,
                locationId: line.locationId,
                serials: line.serials,
              },
        ),
      };
      const created = await api<StockDocumentResponse>(`/inventory/${receiving ? "purchase-receipts" : "sales-issues"}`, { method: "POST", json: body });
      // Phiếu nhập mua cần kiểm tra chất lượng thì dừng ở trạng thái chờ kiểm tra trên web; còn lại gửi để ghi sổ.
      if (created.status !== "draft") return setDone(created);
      try {
        setDone(await api<StockDocumentResponse>(`/inventory/documents/${created.id}/submit`, { method: "POST" }));
      } catch (failure) {
        // Gửi không được (thiếu hàng, mặt hàng đang kiểm kê…): xóa phiếu nháp vừa lập để lần ghi nhận sau lập lại theo số trên màn hình.
        await api(`/inventory/documents/${created.id}`, { method: "DELETE" }).catch(() => undefined);
        throw failure;
      }
    });

  const remaining = (line: ScanLine) => {
    const orderLine = order?.lines.find((item) => item.orderLineId === line.orderLineId);
    const value = orderLine?.receivableQuantity ?? orderLine?.remainingQuantity;
    return value === undefined ? null : t(receiving ? "receivable" : "toIssue", { quantity: quantity(value), unit: orderLine!.unitName });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={`${t(receiving ? "operation_nhan-hang" : "operation_xuat-giao")} ${order?.documentNo ?? ""}`} subtitle={workplace?.warehouse.name} back={requestLeave} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          {prompt}
          {loadError ? <Notice text={loadError} /> : null}
          {!order && !loadError ? <Loading /> : null}
          {done ? (
            <Card>
              <Notice tone="success" text={t(done.status === "posted" ? "documentPosted" : "documentSaved", { number: done.documentNo ?? "" })} />
              <Button label={t("backToList")} onPress={() => router.back()} />
            </Card>
          ) : order ? (
            <>
              <ScanPanel
                scanner={scanner}
                usesLocations={needsLocation}
                onScan={(code) => void scanner.scan(code, { item: addOption, serial: addSerialCode, awaitingSerial: awaitingKey !== null })}
                onPick={addOption}
              />
              {error ? <Notice text={error} /> : null}
              <Card>
                {lines.length === 0 ? <Muted>{t("scanToAdd")}</Muted> : null}
                <LineList
                  lines={lines}
                  onChange={setLines}
                  lotMode={receiving ? "inbound" : "outbound"}
                  awaitingKey={awaitingKey}
                  onAwait={setAwaitingKey}
                  suggestions={suggestions}
                  remaining={remaining}
                  fields={fields}
                />
              </Card>
              <Card>
                <Muted>{t("orderLines")}</Muted>
                {order.lines.map((line) => (
                  <Muted key={line.orderLineId}>
                    {line.sku} · {line.productName}: {remaining({ orderLineId: line.orderLineId } as ScanLine)}
                  </Muted>
                ))}
              </Card>
            </>
          ) : null}
        </Screen>
      </ScrollView>
      {order && !done ? (
        <View style={{ padding: space[4], borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Button label={t(receiving ? "confirmReceipt" : "confirmIssue")} busy={busy} disabled={lines.length === 0} onPress={() => void submit()} />
        </View>
      ) : null}
    </View>
  );
}
