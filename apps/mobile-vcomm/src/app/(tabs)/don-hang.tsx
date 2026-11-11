// MAN_HINH_95 Đơn của tôi (CHUC_NANG_116; API_126): lọc trạng thái, mở chi tiết đơn.
import { marketplaceOrderStatuses, type BuyerOrderListItem, type MarketplaceOrderStatus, type PageResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, Text, View } from "react-native";
import { orderStatusTone } from "@/components/OrderLines";
import { Button, Loading, Muted, Notice, StatusBadge, styles } from "@/components/ui";
import { api, ApiFailure, assetUrl } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function MyOrdersScreen() {
  const [status, setStatus] = useState<MarketplaceOrderStatus | null>(null);
  const [items, setItems] = useState<BuyerOrderListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextPage: number) => {
      setError(null);
      try {
        const parameters = new URLSearchParams({ page: String(nextPage), pageSize: "20" });
        if (status) parameters.set("status", status);
        const result = await api<PageResponse<BuyerOrderListItem>>(`/buyer/orders?${parameters}`);
        setItems((current) => (nextPage === 1 ? result.data : [...(current ?? []), ...result.data]));
        setTotal(result.total);
        setPage(nextPage);
      } catch (failure) {
        setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      }
    },
    [status],
  );

  useFocusEffect(
    useCallback(() => {
      void load(1);
    }, [load]),
  );

  const filters: (MarketplaceOrderStatus | null)[] = [null, ...marketplaceOrderStatuses];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], padding: space[3] }}>
          {filters.map((value) => {
            const selected = value === status;
            return (
              <Pressable
                key={value ?? "all"}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setStatus(value)}
                style={[styles.chip, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
              >
                <Text style={{ color: selected ? colors.surface : colors.text, fontWeight: "600" }}>{value ? t(`orderStatus_${value}`) : t("allOrders")}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {error ? (
        <View style={{ paddingHorizontal: space[3] }}>
          <Notice text={error} />
        </View>
      ) : null}
      {!items && !error ? <Loading /> : null}
      {items ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space[3], gap: space[3], flexGrow: 1 }}
          ListEmptyComponent={<Muted>{t("noOrders")}</Muted>}
          ListFooterComponent={items.length < total ? <Button label={t("loadMore")} kind="secondary" onPress={() => void load(page + 1)} /> : undefined}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("orderNumber", { number: item.documentNo })}
              onPress={() => router.push(`/don-hang/${item.id}`)}
              style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.medium, padding: space[3], gap: space[2] }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{item.documentNo}</Text>
                <StatusBadge text={t(`orderStatus_${item.status}`)} tone={orderStatusTone[item.status]} />
              </View>
              <View style={{ flexDirection: "row", gap: space[3], alignItems: "center" }}>
                {item.imageUrl ? (
                  <Image source={{ uri: assetUrl(item.imageUrl)! }} style={{ width: 48, height: 48, borderRadius: radius.small }} />
                ) : (
                  <View style={{ width: 48, height: 48, borderRadius: radius.small, backgroundColor: colors.primaryLight }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text }}>
                    {item.firstProductName}
                  </Text>
                  <Muted>{t("orderSummary", { count: item.itemCount, date: shortDate(item.createdAt) })}</Muted>
                </View>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{money(item.total)}</Text>
              </View>
            </Pressable>
          )}
        />
      ) : null}
    </View>
  );
}
