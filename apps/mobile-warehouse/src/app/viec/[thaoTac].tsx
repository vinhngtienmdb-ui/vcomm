// MAN_HINH_107 Việc cần làm (CHUC_NANG_159): đơn mua chờ nhận, đơn bán chờ xuất, phiếu của kho theo trạng thái, đợt kiểm kê đang đếm; quét số đơn, số phiếu để mở.
import type { PageResponse, StockDocumentListItem, StocktakeListItem } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Header } from "@/components/Header";
import { ScanInput } from "@/components/ScanInput";
import { Button, Card, Choice, Loading, Muted, Notice, Screen, StatusBadge } from "@/components/ui";
import { api, failureText } from "@/lib/api";
import { shortDate, t, translator } from "@/lib/i18n";
import { documentTypeOf, isOperation, type Operation } from "@/lib/operations";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";

const documentText = translator("documents");
type Item = { id: string; number: string; title: string; detail: string; status?: string; target: { pathname: string; params: Record<string, string> } };
type Tab = "open" | "toShip" | "toReceive";

const tabsOf = (operation: Operation): Tab[] => (operation === "chuyen-kho" ? ["toReceive", "toShip", "open"] : ["open"]);

export default function TodoScreen() {
  const { thaoTac } = useLocalSearchParams<{ thaoTac: string }>();
  const operation: Operation = isOperation(thaoTac) ? thaoTac : "nhap-khac";
  const { workplace } = useSession();
  const [tab, setTab] = useState<Tab>(tabsOf(operation)[0]!);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const warehouseId = workplace?.warehouse.id ?? "";

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      if (operation === "nhan-hang") {
        const orders = await api<{ id: string; documentNo: string; supplierName: string; warehouseId: string }[]>("/inventory/purchase-orders");
        setItems(
          orders
            .filter((order) => order.warehouseId === warehouseId)
            .map((order) => ({
              id: order.id,
              number: order.documentNo,
              title: order.documentNo,
              detail: order.supplierName,
              target: { pathname: "/don", params: { loai: "nhan-hang", donId: order.id } },
            })),
        );
      } else if (operation === "xuat-giao") {
        const orders = await api<{ id: string; documentNo: string; customerName: string | null; warehouseId: string }[]>("/inventory/sales-orders");
        setItems(
          orders
            .filter((order) => order.warehouseId === warehouseId)
            .map((order) => ({
              id: order.id,
              number: order.documentNo,
              title: order.documentNo,
              detail: order.customerName ?? "",
              target: { pathname: "/don", params: { loai: "xuat-giao", donId: order.id } },
            })),
        );
      } else if (operation === "kiem-ke") {
        const stocktakes = await api<StocktakeListItem[]>("/inventory/stocktakes");
        setItems(
          stocktakes
            .filter((stocktake) => stocktake.warehouseId === warehouseId && stocktake.status === "counting")
            .map((stocktake) => ({
              id: stocktake.id,
              number: stocktake.stocktakeNo ?? "",
              title: stocktake.stocktakeNo ?? "",
              detail: t("stocktakeDetail", { owner: stocktake.companyName, counted: stocktake.countedCount }),
              target: { pathname: "/kiem-ke/[id]", params: { id: stocktake.id } },
            })),
        );
      } else {
        const type = documentTypeOf[operation]!;
        const statuses = tab === "toShip" ? ["posted"] : tab === "toReceive" ? ["in_transit"] : ["draft", "rejected", "pending"];
        const pages = await Promise.all(
          statuses.map((status) => api<PageResponse<StockDocumentListItem>>(`/inventory/documents?type=${type}&status=${status}&warehouseId=${warehouseId}&pageSize=100`)),
        );
        const documents = pages
          .flatMap((page) => page.data)
          // Chờ xuất: phiếu của kho nguồn; chờ nhận: phiếu về kho đích.
          .filter((document) => (tab === "toShip" ? document.warehouseId === warehouseId : tab === "toReceive" ? document.warehouseId !== warehouseId : document.warehouseId === warehouseId));
        setItems(
          documents.map((document) => ({
            id: document.id,
            number: document.documentNo ?? "",
            title: document.documentNo ?? documentText(`type_${document.type}`),
            detail: [
              shortDate(document.documentDate),
              document.type === "transfer"
                ? tab === "toReceive"
                  ? t("fromWarehouse", { name: document.warehouseName })
                  : t("toWarehouse", { name: document.destinationWarehouseName ?? "" })
                : document.reason,
              t("lineCount", { count: document.lineCount }),
            ].join(" · "),
            status: document.type === "transfer" && document.status === "posted" ? documentText("status_transfer_posted") : documentText(`status_${document.status}`),
            target: { pathname: "/phieu", params: { loai: operation, phieuId: document.id } },
          })),
        );
      }
    } catch (failure) {
      setError(failureText(failure));
    }
  }, [operation, tab, warehouseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = (item: Item) => router.push(item.target as never);
  const scan = (code: string) => {
    const found = items?.find((item) => item.number.toUpperCase() === code.toUpperCase());
    if (found) open(found);
    else setError(t("codeNotFound", { code }));
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={t(`operation_${operation}`)} subtitle={workplace?.warehouse.name} back />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen>
          {tabsOf(operation).length > 1 ? <Choice label="" value={tab} options={tabsOf(operation).map((value) => ({ value, label: t(`tab_${value}`) }))} onChange={setTab} /> : null}
          <ScanInput placeholder={t("scanNumber")} onScan={scan} />
          {error ? <Notice text={error} /> : null}
          {items === null && !error ? <Loading /> : null}
          {items?.length === 0 ? <Muted>{t(`empty_${operation}`)}</Muted> : null}
          {items && items.length > 0 ? (
            <Card>
              {items.map((item, index) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  onPress={() => open(item)}
                  style={{ borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.border, paddingTop: index === 0 ? 0 : space[2], gap: space[1] }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                    <Text style={{ color: colors.primary, fontWeight: "700" }}>{item.title}</Text>
                    {item.status ? <StatusBadge text={item.status} tone="info" /> : null}
                  </View>
                  <Muted>{item.detail}</Muted>
                </Pressable>
              ))}
            </Card>
          ) : null}
        </Screen>
      </ScrollView>
      {documentTypeOf[operation] ? (
        <View style={{ padding: space[4], borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Button label={t(`new_${operation}`)} onPress={() => router.push({ pathname: "/phieu", params: { loai: operation } })} />
        </View>
      ) : null}
    </View>
  );
}
