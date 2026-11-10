// MAN_HINH_69 Đơn bán – danh sách đơn của tôi (CHUC_NANG_101; API đơn bán; phạm vi xem QUYTAC_NGHIEPVU_129).
import type { PageResponse, SalesOrderListItem } from "contracts";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Button, Loading, Muted, Notice, StatusBadge, styles } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { displayDate, orderTone } from "@/lib/orders";
import { colors, space } from "@/lib/theme";

export default function OrdersScreen() {
  const t = translator("salesApp");
  const status = translator("salesOrders");
  const [items, setItems] = useState<SalesOrderListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api<PageResponse<SalesOrderListItem>>("/sales/orders?pageSize=50")).data);
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: space[4], paddingBottom: space[2] }}>
        <Link href="/don/moi" asChild>
          <Button label={t("newOrder")} onPress={() => undefined} />
        </Link>
      </View>
      {error ? (
        <View style={{ paddingHorizontal: space[4] }}>
          <Notice text={error} />
        </View>
      ) : null}
      {items === null ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space[4], gap: space[2] }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
          ListEmptyComponent={<Muted>{t("noOrders")}</Muted>}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/don/[id]", params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="button" style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                  <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>{item.customerName ?? item.buyerName ?? t("walkIn")}</Text>
                  <StatusBadge text={status(`status_${item.status}`)} tone={orderTone[item.status]} />
                </View>
                <Muted>
                  {item.documentNo ?? t("noNumber")} · {displayDate(item.orderDate)} · {money(item.totalAmount, item.currency)}
                </Muted>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
