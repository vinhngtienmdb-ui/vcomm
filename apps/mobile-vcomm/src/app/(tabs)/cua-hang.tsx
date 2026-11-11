// MAN_HINH_90 Cửa hàng (CHUC_NANG_115; API_124; QUYTAC_NGHIEPVU_155): tìm kiếm, danh sách hàng đang bán, vào giỏ hàng.
import type { CartResponse, PageResponse, ShopProductItem } from "contracts";
import { useFocusEffect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { Button, Loading, Muted, Notice, StatusBadge, styles } from "@/components/ui";
import { api, ApiFailure, assetUrl } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function ShopScreen() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ShopProductItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (nextPage: number) => {
      setError(null);
      try {
        const parameters = new URLSearchParams({ page: String(nextPage), pageSize: "20" });
        if (query) parameters.set("search", query);
        const result = await api<PageResponse<ShopProductItem>>(`/buyer/shop/products?${parameters}`);
        setItems((current) => (nextPage === 1 ? result.data : [...(current ?? []), ...result.data]));
        setTotal(result.total);
        setPage(nextPage);
      } catch (failure) {
        setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      }
    },
    [query],
  );

  useEffect(() => {
    setItems(null);
    void load(1);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      api<CartResponse>("/buyer/cart")
        .then((cart) => setCartCount(cart.lines.length))
        .catch(() => undefined);
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", gap: space[2], padding: space[3], alignItems: "center" }}>
        <TextInput
          accessibilityLabel={t("shopSearch")}
          placeholder={t("shopSearch")}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          style={[styles.input, { flex: 1, minWidth: 0 }]}
        />
        <Button label={cartCount > 0 ? t("cartWithCount", { count: cartCount }) : t("cart")} kind="secondary" onPress={() => router.push("/gio-hang")} />
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
          numColumns={2}
          columnWrapperStyle={{ gap: space[3] }}
          contentContainerStyle={{ padding: space[3], gap: space[3], flexGrow: 1 }}
          ListEmptyComponent={<Muted>{query ? t("shopNoResult") : t("shopEmpty")}</Muted>}
          ListFooterComponent={items.length < total ? <Button label={t("loadMore")} kind="secondary" onPress={() => void load(page + 1)} /> : undefined}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={item.name}
              onPress={() => router.push(`/san-pham/${item.id}`)}
              style={{ flex: 1, maxWidth: "50%", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.medium, overflow: "hidden" }}
            >
              {item.imageUrl ? (
                <Image source={{ uri: assetUrl(item.imageUrl)! }} style={{ width: "100%", aspectRatio: 1 }} resizeMode="cover" />
              ) : (
                <View style={{ width: "100%", aspectRatio: 1, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.primary, fontSize: 32, fontWeight: "700" }}>{item.name.slice(0, 1)}</Text>
                </View>
              )}
              <View style={{ padding: space[2], gap: space[1] }}>
                <Text numberOfLines={2} style={{ color: colors.text, fontWeight: "600", minHeight: 40 }}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{money(item.priceFrom)}</Text>
                {item.inStock ? null : <StatusBadge text={t("outOfStock")} tone="neutral" />}
              </View>
            </Pressable>
          )}
        />
      ) : null}
    </View>
  );
}
