// MAN_HINH_108 Phiếu quét (CHUC_NANG_159; API_65, API_66): phiếu nhập khác, xuất khác, chuyển kho – lập, lưu nháp, gửi, rút; kho nguồn xác nhận xuất; kho đích quét nhận.
// Luồng duyệt, đánh số, ghi sổ theo API có sẵn (QUYTAC_NGHIEPVU_50, 52, 280).
import { stockReasonCodes, type LotSuggestion, type StockDocumentLineResponse, type StockDocumentResponse, type StockItemOption, type TransferDestination } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Header } from "@/components/Header";
import { LabeledInput, LineList } from "@/components/LineList";
import { ScanPanel } from "@/components/ScanPanel";
import { Button, Card, Choice, Loading, Muted, Notice, QuantityInput, Screen, StatusBadge, styles } from "@/components/ui";
import { useAction } from "@/components/useAction";
import { useLeaveGuard } from "@/components/useLeaveGuard";
import { useScanner } from "@/components/useScanner";
import { api, failureText } from "@/lib/api";
import { quantity, t, translator } from "@/lib/i18n";
import { documentTypeOf, isOperation } from "@/lib/operations";
import { addItem, addSerial, type ScanLine } from "@/lib/scan";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

const documentText = translator("documents");
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

function toScanLine(line: StockDocumentLineResponse): ScanLine {
  return {
    key: line.id,
    variantId: line.variantId,
    sku: line.sku,
    productName: line.productName,
    tracksLots: line.tracksLots,
    tracksSerials: line.tracksSerials,
    unitId: line.unitId,
    unitName: line.unitName,
    factor: Number(line.baseQuantity) / Number(line.quantity),
    quantity: Number(line.quantity),
    locationId: line.locationId,
    locationCode: line.locationCode,
    lotId: line.lotId,
    lotNo: line.lotNo,
    expiresOn: line.expiresOn,
    serials: line.serials,
    orderLineId: null,
    unitCost: line.unitCost ?? "",
    lotOverrideReason: line.lotOverrideReason ?? "",
  };
}

type Receipt = { received: string; serials: string[] };

export default function DocumentScreen() {
  const { loai, phieuId } = useLocalSearchParams<{ loai: string; phieuId?: string }>();
  const operation = isOperation(loai) ? loai : "nhap-khac";
  const type = documentTypeOf[operation] ?? "receipt_other";
  const { workplace } = useSession();
  const warehouse = workplace?.warehouse;
  const [document, setDocument] = useState<StockDocumentResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(phieuId));
  const [companyId, setCompanyId] = useState<string | null>(warehouse?.owners.length === 1 ? warehouse.owners[0]!.companyId : null);
  const [reasonCode, setReasonCode] = useState<string>(stockReasonCodes[type][0]);
  const [reason, setReason] = useState("");
  const [destinations, setDestinations] = useState<TransferDestination[]>([]);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [dirty, setDirty] = useState(false);
  const [awaitingKey, setAwaitingKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, LotSuggestion[]>>({});
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const scanner = useScanner(document?.companyId ?? companyId, workplace?.locations ?? []);
  const { busy, error, fields, run } = useAction();
  const { requestLeave, prompt } = useLeaveGuard(dirty);
  const editable = !document || document.canEdit;
  const outbound = type !== "receipt_other";
  const usesLocations = warehouse?.usesLocations ?? false;

  const show = useCallback((loaded: StockDocumentResponse) => {
    setDocument(loaded);
    setCompanyId(loaded.companyId);
    setReasonCode(loaded.reasonCode);
    setReason(loaded.reason);
    setDestinationId(loaded.destinationWarehouseId);
    setLines(loaded.lines.map(toScanLine));
    setReceipts({});
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!phieuId) return;
    api<StockDocumentResponse>(`/inventory/documents/${phieuId}`)
      .then(show)
      .catch((failure: unknown) => setNotice(failureText(failure)))
      .finally(() => setLoading(false));
  }, [phieuId, show]);

  useEffect(() => {
    if (type !== "transfer" || !companyId || !editable) return;
    api<TransferDestination[]>(`/inventory/transfer-destinations?companyId=${companyId}`)
      .then((items) => setDestinations(items.filter((item) => item.id !== warehouse?.id)))
      .catch(() => setDestinations([]));
  }, [type, companyId, editable, warehouse?.id]);

  const change = (next: ScanLine[]) => {
    setLines(next);
    setDirty(true);
  };

  const loadLots = async (line: ScanLine) => {
    if (!outbound || !line.tracksLots || !companyId || !warehouse) return;
    const query = new URLSearchParams({ warehouseId: warehouse.id, companyId, variantId: line.variantId, ...(line.locationId ? { locationId: line.locationId } : {}) });
    const lots = await api<LotSuggestion[]>(`/inventory/documents/lot-suggestions?${query}`).catch(() => []);
    setSuggestions((current) => ({ ...current, [line.key]: lots }));
    const suggested = lots.find((lot) => lot.suggested);
    if (suggested)
      setLines((current) => current.map((item) => (item.key === line.key && !item.lotId ? { ...item, lotId: suggested.lotId, lotNo: suggested.lotNo, expiresOn: suggested.expiresOn } : item)));
  };

  // Quét khi lập phiếu: thêm dòng theo QUYTAC_NGHIEPVU_282.
  const addOption = (option: StockItemOption) => {
    if (usesLocations && !scanner.location) return scanner.fail(t("scanLocationFirst"));
    const result = addItem(lines, option, scanner.location);
    change(result.lines);
    if (option.tracksSerials) setAwaitingKey(result.line.key);
    scanner.setMessage({ tone: "success", text: t("added", { name: option.productName, quantity: quantity(result.line.quantity), unit: result.line.unitName }) });
    if (result.lines.length > lines.length) void loadLots(result.line);
  };
  const addSerialCode = (serial: string) => {
    if (!awaitingKey) return;
    const result = addSerial(lines, awaitingKey, serial);
    if (result.duplicate) return scanner.fail(t("serialDuplicate", { serial }));
    change(result.lines);
    scanner.setMessage({ tone: "success", text: t("serialAdded", { serial }) });
  };

  // Quét khi nhận chuyển kho: cộng số thực nhận (đơn vị cơ sở) vào dòng cùng mặt hàng; hàng serial ghi serial.
  const receiveOption = (option: StockItemOption) => {
    const line = document?.lines.find((item) => item.variantId === option.variantId);
    if (!line) return scanner.fail(t("notOnDocument", { name: option.productName }));
    if (option.tracksSerials) {
      setAwaitingKey(line.id);
      return scanner.setMessage({ tone: "info", text: t("scanSerialNow", { name: option.productName }) });
    }
    const factor = Number(option.units.find((unit) => unit.unitId === (option.matchedUnitId ?? option.baseUnitId))?.factor ?? "1");
    const current = receipts[line.id] ?? { received: "0", serials: [] };
    const received = String(Number(current.received || 0) + factor);
    setReceipts({ ...receipts, [line.id]: { ...current, received } });
    setDirty(true);
    scanner.setMessage({ tone: "success", text: t("receivedProgress", { name: option.productName, received: quantity(received), shipped: quantity(line.baseQuantity), unit: line.baseUnitName }) });
  };
  const receiveSerial = (serial: string) => {
    if (!awaitingKey) return;
    if (Object.values(receipts).some((item) => item.serials.includes(serial))) return scanner.fail(t("serialDuplicate", { serial }));
    const current = receipts[awaitingKey] ?? { received: "0", serials: [] };
    const serials = [...current.serials, serial];
    setReceipts({ ...receipts, [awaitingKey]: { received: String(serials.length), serials } });
    setDirty(true);
    scanner.setMessage({ tone: "success", text: t("serialAdded", { serial }) });
  };

  const body = () => ({
    type,
    warehouseId: warehouse!.id,
    companyId,
    documentDate: document?.documentDate ?? today(),
    reasonCode,
    reason: reason.trim() || documentText(`reason_${reasonCode}`),
    destinationWarehouseId: type === "transfer" ? destinationId : null,
    lines: lines.map((line) => ({
      variantId: line.variantId,
      unitId: line.unitId,
      quantity: String(line.quantity),
      unitCost: type === "receipt_other" ? line.unitCost || null : null,
      lotId: outbound ? line.lotId : null,
      lotNo: outbound ? null : line.lotNo || null,
      expiresOn: outbound ? null : line.expiresOn || null,
      lotOverrideReason: line.lotOverrideReason || null,
      locationId: line.locationId,
      serials: line.serials,
    })),
    ...(document ? { version: document.version } : {}),
  });

  const save = async () => {
    const saved = document
      ? await api<StockDocumentResponse>(`/inventory/documents/${document.id}`, { method: "PATCH", json: body() })
      : await api<StockDocumentResponse>("/inventory/documents", { method: "POST", json: body() });
    show(saved);
    return saved;
  };
  const act = (action: () => Promise<StockDocumentResponse | void>, message: string) =>
    run(async () => {
      const result = await action();
      if (result) show(result);
      scanner.setMessage(null);
      setNotice(message);
    });

  if (!warehouse) return <Loading />;
  const title = document?.documentNo ?? (document ? documentText(`type_${type}`) : t(`new_${operation}`));
  const status = document ? (document.type === "transfer" && document.status === "posted" ? documentText("status_transfer_posted") : documentText(`status_${document.status}`)) : null;

  return (
    <View style={{ flex: 1 }}>
      <Header title={title} subtitle={warehouse.name} back={requestLeave} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          {prompt}
          {loading ? <Loading /> : null}
          {notice ? <Notice tone="success" text={notice} /> : null}
          {error ? <Notice text={error} /> : null}
          {status ? <StatusBadge text={status} tone="info" /> : null}
          {editable && !loading ? (
            <Card>
              {warehouse.owners.length > 1 ? (
                <Choice
                  label={t("ownerCompany")}
                  value={companyId}
                  options={warehouse.owners.map((owner) => ({ value: owner.companyId, label: owner.companyName }))}
                  onChange={(value) => {
                    setCompanyId(value);
                    change([]);
                  }}
                />
              ) : null}
              {stockReasonCodes[type].length > 1 ? (
                <Choice label={t("reasonCode")} value={reasonCode} options={stockReasonCodes[type].map((code) => ({ value: code, label: documentText(`reason_${code}`) }))} onChange={setReasonCode} />
              ) : null}
              <LabeledInput label={t("reason")} value={reason} onChange={setReason} placeholder={documentText(`reason_${reasonCode}`)} error={fields.reason} />
              {type === "transfer" ? (
                destinations.length === 0 ? (
                  <Muted>{t("noDestinations")}</Muted>
                ) : (
                  <Choice
                    label={documentText("destination")}
                    value={destinationId}
                    options={destinations.map((item) => ({ value: item.id, label: `${item.code} – ${item.name}` }))}
                    onChange={setDestinationId}
                  />
                )
              ) : null}
              {fields.destinationWarehouseId ? <Text style={styles.error}>{fields.destinationWarehouseId}</Text> : null}
            </Card>
          ) : null}
          {document && !editable ? (
            <Card>
              <Muted>
                {[documentText(`reason_${document.reasonCode}`), document.reason, document.destinationWarehouseName ? `${documentText("destination")}: ${document.destinationWarehouseName}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </Muted>
            </Card>
          ) : null}
          {(editable || document?.canReceive) && !loading ? (
            <ScanPanel
              scanner={scanner}
              usesLocations={usesLocations}
              onScan={(code) =>
                void scanner.scan(
                  code,
                  document?.canReceive
                    ? { item: receiveOption, serial: receiveSerial, awaitingSerial: awaitingKey !== null }
                    : { item: addOption, serial: addSerialCode, awaitingSerial: awaitingKey !== null },
                )
              }
              onPick={document?.canReceive ? receiveOption : addOption}
            />
          ) : null}
          {document?.canReceive ? (
            <Card>
              <Muted>{documentText("receiveHint")}</Muted>
              {document.lines.map((line) => {
                const current = receipts[line.id] ?? { received: "", serials: [] };
                return (
                  <View key={line.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: space[2], gap: space[1] }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{line.productName}</Text>
                    <Muted>{[line.sku, line.lotNo, t("shipped", { quantity: quantity(line.baseQuantity), unit: line.baseUnitName })].filter(Boolean).join(" · ")}</Muted>
                    {line.tracksSerials ? (
                      <Muted>{t("serialCount", { count: current.serials.length, unit: line.baseUnitName })}</Muted>
                    ) : (
                      <QuantityInput
                        label={t("receivedOf", { name: line.productName })}
                        value={current.received}
                        onChange={(value) => {
                          setReceipts({ ...receipts, [line.id]: { ...current, received: value } });
                          setDirty(true);
                        }}
                      />
                    )}
                  </View>
                );
              })}
              <Button
                label={t("fillShipped")}
                kind="secondary"
                onPress={() => {
                  setReceipts(Object.fromEntries(document.lines.map((line) => [line.id, { received: line.tracksSerials ? String(line.serials.length) : line.baseQuantity, serials: line.serials }])));
                  setDirty(true);
                }}
              />
            </Card>
          ) : (
            <Card>
              {lines.length === 0 ? <Muted>{t("scanToAdd")}</Muted> : null}
              {editable ? (
                <LineList
                  lines={lines}
                  onChange={change}
                  lotMode={outbound ? "outbound" : "inbound"}
                  withCost={type === "receipt_other"}
                  awaitingKey={awaitingKey}
                  onAwait={setAwaitingKey}
                  suggestions={suggestions}
                  fields={fields}
                />
              ) : (
                lines.map((line) => (
                  <View key={line.key} style={{ gap: space[1] }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{line.productName}</Text>
                    <Muted>{[line.sku, `${quantity(line.quantity)} ${line.unitName}`, line.lotNo, line.locationCode, line.serials.join(", ")].filter(Boolean).join(" · ")}</Muted>
                  </View>
                ))
              )}
            </Card>
          )}
          {document && document.discrepancies.length > 0 ? (
            <Card>
              <Text style={{ fontWeight: "700" }}>{documentText("discrepancies")}</Text>
              {document.discrepancies.map((item) => (
                <Muted key={item.lineId}>
                  {item.sku}: {documentText("discrepancyLine", { shipped: item.shippedQuantity, received: item.receivedQuantity, difference: item.difference })}
                </Muted>
              ))}
            </Card>
          ) : null}
        </Screen>
      </ScrollView>
      <View style={{ padding: space[4], borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: space[2] }}>
        {editable ? (
          <View style={{ flexDirection: "row", gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Button label={t("saveDraft")} kind="secondary" busy={busy} disabled={lines.length === 0} onPress={() => void act(save, t("draftSaved"))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t("submit")}
                busy={busy}
                disabled={lines.length === 0}
                onPress={() =>
                  void act(async () => {
                    const saved = await save();
                    return api<StockDocumentResponse>(`/inventory/documents/${saved.id}/submit`, { method: "POST" });
                  }, t("submitted"))
                }
              />
            </View>
          </View>
        ) : null}
        {document?.canWithdraw ? (
          <Button
            label={t("withdraw")}
            kind="secondary"
            busy={busy}
            onPress={() => void act(() => api<StockDocumentResponse>(`/inventory/documents/${document.id}/withdraw`, { method: "POST" }), documentText("withdrawn"))}
          />
        ) : null}
        {document?.canShip ? (
          <Button
            label={documentText("ship")}
            busy={busy}
            onPress={() => void act(() => api<StockDocumentResponse>(`/inventory/documents/${document.id}/ship`, { method: "POST" }), documentText("shipped"))}
          />
        ) : null}
        {document?.canReceive ? (
          <Button
            label={documentText("receive")}
            busy={busy}
            onPress={() =>
              usesLocations && !scanner.location
                ? scanner.fail(t("scanLocationFirst"))
                : void act(async () => {
                    return api<StockDocumentResponse>(`/inventory/documents/${document.id}/receive`, {
                      method: "POST",
                      json: {
                        lines: document.lines.map((line) => ({
                          lineId: line.id,
                          receivedQuantity: receipts[line.id]?.received || "0",
                          destinationLocationId: scanner.location?.id ?? null,
                          serials: receipts[line.id]?.serials ?? [],
                        })),
                      },
                    });
                  }, documentText("received"))
            }
          />
        ) : null}
        {document && !editable && !document.canWithdraw && !document.canShip && !document.canReceive ? <Button label={t("backToList")} kind="secondary" onPress={() => router.back()} /> : null}
      </View>
    </View>
  );
}
