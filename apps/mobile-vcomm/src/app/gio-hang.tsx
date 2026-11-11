// MAN_HINH_92 Giỏ hàng (CHUC_NANG_115; API_124; QUYTAC_NGHIEPVU_157): dòng hàng, số lượng, chọn dòng để đặt, tổng tạm tính.
import type { CartLineItem, CartResponse } from "contracts";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Button, Card, Loading, Muted, Notice, QuantityStepper, Screen, StatusBadge, Title } from "@/components/ui";
import { api, ApiFailure, assetUrl } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");
const sellable = (line: CartLineItem) => line.price !== null && Number(line.available) >= line.quantity;

export default function CartScreen() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const apply = (value: CartResponse) => {
    setCart(value);
    setChosen((current) => new Set(value.lines.filter((line) => sellable(line) && (current.size === 0 || current.has(line.variantId))).map((line) => line.variantId)));
  };

  useFocusEffect(
    useCallback(() => {
      setChosen(new Set());
      api<CartResponse>("/buyer/cart")
        .then(apply)
        .catch((failure: unknown) => setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
    }, []),
  );

  async function change(path: string, init: { method: string; json?: unknown }) {
    setError(null);
    try {
      apply(await api<CartResponse>(path, init));
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }

  const lines = cart?.lines ?? [];
  const selectedLines = lines.filter((line) => chosen.has(line.variantId) && sellable(line));
  const subtotal = selectedLines.reduce((sum, line) => sum + Number(line.price) * line.quantity, 0);

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        <Title>{t("cart")}</Title>
        {error ? <Notice text={error} /> : null}
        {!cart && !error ? <Loading /> : null}
        {cart && lines.length === 0 ? (
          <Card>
            <Muted>{t("cartEmpty")}</Muted>
            <Button label={t("goShopping")} onPress={() => router.replace("/cua-hang")} />
          </Card>
        ) : null}
        {lines.map((line) => {
          const canBuy = sellable(line);
          const checked = chosen.has(line.variantId) && canBuy;
          return (
            <Card key={line.variantId}>
              <View style={{ flexDirection: "row", gap: space[3] }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: !canBuy }}
                  accessibilityLabel={t("chooseLine", { name: line.productName })}
                  disabled={!canBuy}
                  onPress={() => {
                    const next = new Set(chosen);
                    if (next.has(line.variantId)) next.delete(line.variantId);
                    else next.add(line.variantId);
                    setChosen(next);
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.small,
                    borderWidth: 2,
                    borderColor: canBuy ? colors.primary : colors.border,
                    backgroundColor: checked ? colors.primary : colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: space[2],
                  }}
                >
                  {checked ? <Text style={{ color: colors.surface, fontWeight: "700" }}>✓</Text> : null}
                </Pressable>
                {line.imageUrl ? <Image source={{ uri: assetUrl(line.imageUrl)! }} style={{ width: 64, height: 64, borderRadius: radius.small }} /> : null}
                <View style={{ flex: 1, gap: space[1] }}>
                  <Text style={{ fontWeight: "600", color: colors.text }}>{line.productName}</Text>
                  {line.variantLabel ? <Muted>{line.variantLabel}</Muted> : null}
                  {line.price === null ? <StatusBadge text={t("stoppedSelling")} tone="neutral" /> : <Text style={{ color: colors.primary, fontWeight: "700" }}>{money(line.price)}</Text>}
                  {line.price !== null && Number(line.available) < line.quantity ? <StatusBadge text={t("notEnoughStock", { count: Math.floor(Number(line.available)) })} tone="warning" /> : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space[2] }}>
                {line.price !== null ? (
                  <QuantityStepper
                    label={t("quantity")}
                    value={line.quantity}
                    maximum={999}
                    onChange={(quantity) => void change("/buyer/cart/lines", { method: "PUT", json: { variantId: line.variantId, quantity } })}
                  />
                ) : (
                  <View />
                )}
                <Button label={t("remove")} kind="secondary" onPress={() => void change(`/buyer/cart/lines/${line.variantId}`, { method: "DELETE" })} />
              </View>
            </Card>
          );
        })}
        {lines.length > 0 ? (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text }}>{t("subtotal", { count: selectedLines.length })}</Text>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{money(subtotal)}</Text>
            </View>
            <Muted>{t("subtotalHint")}</Muted>
            <Button
              label={t("checkout")}
              disabled={selectedLines.length === 0}
              onPress={() => router.push({ pathname: "/dat-hang", params: { lines: selectedLines.map((line) => line.variantId).join(",") } })}
            />
          </Card>
        ) : null}
      </Screen>
    </ScrollView>
  );
}
