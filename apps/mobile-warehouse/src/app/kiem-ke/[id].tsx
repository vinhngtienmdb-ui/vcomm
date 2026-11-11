// MAN_HINH_109 Đếm kiểm kê (CHUC_NANG_159; API_67, API_138, API_139): quét vào danh sách chưa gửi, gửi để cộng dồn số đếm (QUYTAC_NGHIEPVU_284);
// người không quản lý kiểm kê không thấy tồn sổ sách, chênh lệch (đếm mù, QUYTAC_NGHIEPVU_283).
import type { LotSuggestion, StockItemOption, StocktakeCountEntry, StocktakeResponse } from "contracts";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
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

const time = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default function StocktakeCountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workplace } = useSession();
  const [stocktake, setStocktake] = useState<StocktakeResponse | null>(null);
  const [entries, setEntries] = useState<StocktakeCountEntry[]>([]);
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [awaitingKey, setAwaitingKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, LotSuggestion[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const scanner = useScanner(stocktake?.companyId ?? null, workplace?.locations ?? []);
  const { busy, error, fields, run } = useAction();
  const { requestLeave, prompt } = useLeaveGuard(lines.length > 0);
  const usesLocations = workplace?.warehouse.usesLocations ?? false;

  const load = useCallback(async () => {
    const [detail, mine] = await Promise.all([api<StocktakeResponse>(`/inventory/stocktakes/${id}`), api<StocktakeCountEntry[]>(`/inventory/stocktakes/${id}/count-entries?mine=true`)]);
    setStocktake(detail);
    setEntries(mine);
  }, [id]);
  useEffect(() => {
    load().catch((failure: unknown) => setLoadError(failureText(failure)));
  }, [load]);

  const loadLots = async (line: ScanLine) => {
    if (!line.tracksLots || !stocktake) return;
    const query = new URLSearchParams({
      warehouseId: stocktake.warehouseId,
      companyId: stocktake.companyId,
      variantId: line.variantId,
      includeExpired: "true",
      ...(line.locationId ? { locationId: line.locationId } : {}),
    });
    const lots = await api<LotSuggestion[]>(`/inventory/documents/lot-suggestions?${query}`).catch(() => []);
    setSuggestions((current) => ({ ...current, [line.key]: lots }));
    if (lots.length === 1) setLines((current) => current.map((item) => (item.key === line.key && !item.lotId ? { ...item, lotId: lots[0]!.lotId, lotNo: lots[0]!.lotNo } : item)));
  };

  // Số đếm theo đơn vị cơ sở: quét thùng 24 chai thì cộng 24.
  const addOption = (option: StockItemOption) => {
    if (usesLocations && !scanner.location) return scanner.fail(t("scanLocationFirst"));
    const base = option.units.find((unit) => unit.unitId === option.baseUnitId);
    const result = addItem(lines, option, scanner.location, { orderLineId: "", unitId: option.baseUnitId, unitName: base?.unitName ?? "", factor: 1 });
    setLines(result.lines);
    setSent(null);
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

  const send = () =>
    run(async () => {
      const additions = lines
        .filter((line) => line.tracksSerials || line.quantity !== 0)
        .map((line) => ({ variantId: line.variantId, lotId: line.lotId, locationId: line.locationId, quantity: line.tracksSerials ? "0" : String(line.quantity), serials: line.serials }));
      const updated = await api<StocktakeResponse>(`/inventory/stocktakes/${id}/count-additions`, { method: "POST", json: { additions } });
      setStocktake(updated);
      setEntries(await api<StocktakeCountEntry[]>(`/inventory/stocktakes/${id}/count-entries?mine=true`));
      setSent(t("countSent", { count: additions.length }));
      scanner.setMessage(null);
      setLines([]);
      setAwaitingKey(null);
    });

  return (
    <View style={{ flex: 1 }}>
      <Header title={t("stocktakeTitle", { number: stocktake?.stocktakeNo ?? "" })} subtitle={stocktake ? `${stocktake.warehouseName} · ${stocktake.companyName}` : undefined} back={requestLeave} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          {prompt}
          {loadError ? <Notice text={loadError} /> : null}
          {!stocktake && !loadError ? <Loading /> : null}
          {stocktake && stocktake.status !== "counting" ? <Notice tone="warning" text={t("stocktakeNotCounting")} /> : null}
          {stocktake?.status === "counting" ? (
            <>
              <ScanPanel
                scanner={scanner}
                usesLocations={usesLocations}
                onScan={(code) => void scanner.scan(code, { item: addOption, serial: addSerialCode, awaitingSerial: awaitingKey !== null })}
                onPick={addOption}
              />
              {sent ? <Notice tone="success" text={sent} /> : null}
              {error ? <Notice text={error} /> : null}
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("unsent", { count: lines.length })}</Text>
                {lines.length === 0 ? <Muted>{t("scanToAdd")}</Muted> : null}
                <LineList lines={lines} onChange={setLines} lotMode="outbound" counting signed awaitingKey={awaitingKey} onAwait={setAwaitingKey} suggestions={suggestions} fields={fields} />
              </Card>
              <Notice tone="info" text={t("countHint")} />
            </>
          ) : null}
          {entries.length > 0 ? (
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("mySent")}</Text>
              {entries.map((entry) => (
                <View key={entry.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: space[2] }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {entry.productName} · {Number(entry.quantity) > 0 ? "+" : ""}
                    {quantity(entry.quantity)}
                  </Text>
                  <Muted>
                    {[entry.lotNo, entry.locationCode, [...entry.addedSerials, ...entry.removedSerials.map((serial) => `−${serial}`)].join(", "), time(entry.countedAt)].filter(Boolean).join(" · ")}
                  </Muted>
                </View>
              ))}
            </Card>
          ) : null}
          {stocktake && stocktake.lines.length > 0 ? (
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("stocktakeTotals")}</Text>
              {stocktake.lines.map((line) => (
                <View key={line.id} style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: space[2] }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{line.productName}</Text>
                  <Muted>
                    {[
                      line.lotNo,
                      line.locationCode,
                      t("countedTotal", { quantity: line.countedQuantity === null ? "—" : quantity(line.countedQuantity), unit: line.baseUnitName }),
                      line.systemQuantity !== null ? t("systemTotal", { quantity: quantity(line.systemQuantity), difference: line.difference === null ? "—" : quantity(line.difference) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Muted>
                </View>
              ))}
              {!stocktake.canManage ? <Muted>{t("blindHint")}</Muted> : null}
            </Card>
          ) : null}
        </Screen>
      </ScrollView>
      {stocktake?.status === "counting" ? (
        <View style={{ padding: space[4], borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Button label={t("sendCounts")} busy={busy} disabled={lines.length === 0} onPress={() => void send()} />
        </View>
      ) : null}
    </View>
  );
}
