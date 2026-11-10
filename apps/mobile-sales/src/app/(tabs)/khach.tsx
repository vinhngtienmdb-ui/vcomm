// MAN_HINH_67 Khách của tôi (CHUC_NANG_100; API_71; QUYTAC_NGHIEPVU_137): tìm, danh sách khách trong phạm vi xem.
import type { PageResponse, PartnerListItem } from "contracts";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { Button, Loading, Muted, Notice, styles } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

export default function CustomersScreen() {
  const t = translator("salesApp");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PartnerListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (text: string) => {
    const parameters = new URLSearchParams({ role: "customer", status: "active", pageSize: "50" });
    if (text) parameters.set("search", text);
    try {
      setItems((await api<PageResponse<PartnerListItem>>(`/crm/partners?${parameters}`)).data);
      setError(null);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, load]);
  // Quay lại từ màn hình thêm khách thì tải lại danh sách.
  useFocusEffect(
    useCallback(() => {
      void load(search.trim());
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: space[4], paddingBottom: space[2], gap: space[2] }}>
        <Link href="/khach/them" asChild>
          <Button label={t("addCustomer")} kind="secondary" onPress={() => undefined} />
        </Link>
        <TextInput accessibilityLabel={t("searchCustomers")} placeholder={t("searchCustomers")} value={search} onChangeText={setSearch} style={styles.input} placeholderTextColor={colors.textMuted} />
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
                void load(search.trim()).finally(() => setRefreshing(false));
              }}
            />
          }
          ListEmptyComponent={<Muted>{search ? t("noResult") : t("noCustomers")}</Muted>}
          renderItem={({ item }) => (
            <Link href={{ pathname: "/khach/[id]", params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="button" style={styles.card}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{item.name}</Text>
                <Muted>
                  {item.code}
                  {item.phone ? ` · ${item.phone}` : ""}
                </Muted>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
