// MAN_HINH_91 Chi tiết sản phẩm (CHUC_NANG_115; API_124): ảnh, giá gồm thuế, chọn phân loại, số lượng, mô tả, thêm vào giỏ hàng.
// CONG_VIEC_49: điểm đánh giá đã mua hàng, mở bảng tin lọc theo sản phẩm (MAN_HINH_136); cộng tác viên đã duyệt chia sẻ đường dẫn có mã của mình, xem mức hoa hồng cộng tác viên (QUYTAC_NGHIEPVU_325, 326).
import type { BuyerCollaboratorResponse, ShopProductDetail } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Stars } from "@/components/Community";
import { Button, Card, Choice, Loading, Muted, Notice, QuantityStepper, Screen, Title } from "@/components/ui";
import { api, ApiFailure, appBase, assetUrl } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<ShopProductDetail | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collaboratorCode, setCollaboratorCode] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let active = true;
    api<ShopProductDetail>(`/buyer/shop/products/${encodeURIComponent(String(id))}`)
      .then((value) => {
        if (!active) return;
        setProduct(value);
        setSelected(value.variants.find((variant) => Number(variant.available) > 0)?.optionValues ?? value.variants[0]!.optionValues);
      })
      .catch((failure: unknown) => active && setError(failure instanceof ApiFailure ? failure.message : t("unknownError")));
    api<BuyerCollaboratorResponse>("/buyer/collaborator")
      .then((value) => active && setCollaboratorCode(value.profile?.status === "approved" ? value.profile.code : null))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id]);

  async function shareAsCollaborator() {
    if (!product || !collaboratorCode) return;
    const link = `${appBase}/p/${product.id}?ctv=${collaboratorCode}`;
    const message = t("collaboratorShareMessage", { name: product.name, link });
    if (Platform.OS === "web") {
      const browser = globalThis.navigator as Navigator | undefined;
      if (browser?.share) return void browser.share({ text: message }).catch(() => undefined);
      await browser?.clipboard?.writeText(link).catch(() => undefined);
      return setLinkCopied(true);
    }
    await Share.share({ message });
  }

  const variant = useMemo(() => product?.variants.find((item) => item.optionValues.every((value, index) => value === selected[index])) ?? null, [product, selected]);
  const available = Math.floor(Number(variant?.available ?? 0));

  async function add() {
    if (!variant) return;
    setBusy(true);
    setError(null);
    try {
      await api("/buyer/cart/lines", { method: "PUT", json: { variantId: variant.id, quantity } });
      setAdded(true);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        <Text accessibilityRole="link" onPress={() => router.back()} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
          {t("back")}
        </Text>
        {!product && !error ? <Loading /> : null}
        {product ? (
          <>
            {product.images.length > 0 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {product.images.map((image) => (
                  <Image key={image} source={{ uri: assetUrl(image)! }} style={{ width: 320, height: 320, marginRight: space[2] }} resizeMode="cover" accessibilityIgnoresInvertColors />
                ))}
              </ScrollView>
            ) : null}
            <Title>{product.name}</Title>
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/bang-tin", params: { sanPham: product.id, ten: product.name } })}>
              {product.rating.count > 0 ? (
                <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
                  <Stars value={Math.round(Number(product.rating.average))} />
                  <Muted>{t("communityProductRating", { average: Number(product.rating.average).toLocaleString("vi-VN", { maximumFractionDigits: 1 }), count: product.rating.count })}</Muted>
                </View>
              ) : (
                <Muted>{t("communityProductNoRating")}</Muted>
              )}
            </Pressable>
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "700" }}>{variant ? money(variant.price) : "—"}</Text>
            <Muted>{t("priceIncludesTax", { unit: product.unitName.toLocaleLowerCase("vi") })}</Muted>
            {product.options.map((option, index) => (
              <Choice
                key={option.name}
                label={option.name}
                value={selected[index] ?? null}
                options={option.values.map((value) => ({ value, label: value }))}
                onChange={(value) => {
                  const next = [...selected];
                  next[index] = value;
                  setSelected(next);
                  setQuantity(1);
                  setAdded(false);
                }}
              />
            ))}
            {variant && available > 0 ? (
              <View style={{ gap: space[1] }}>
                <Text style={{ fontWeight: "600", color: colors.text }}>{t("quantity")}</Text>
                <QuantityStepper label={t("quantity")} value={quantity} maximum={Math.min(available, 999)} onChange={setQuantity} />
                <Muted>{t("availableCount", { count: available })}</Muted>
              </View>
            ) : (
              <Notice tone="warning" text={variant ? t("outOfStock") : t("variantNotSold")} />
            )}
            {error ? <Notice text={error} /> : null}
            {added ? (
              <View style={{ gap: space[2] }}>
                <Notice tone="success" text={t("addedToCart")} />
                <Button label={t("viewCart")} onPress={() => router.push("/gio-hang")} />
              </View>
            ) : (
              <Button label={t("addToCart")} busy={busy} disabled={!variant || available <= 0} onPress={() => void add()} />
            )}
            <Button label={t("groupBuyOfProduct")} kind="secondary" onPress={() => router.push({ pathname: "/mua-chung", params: { sanPham: product.id } })} />
            {collaboratorCode ? (
              <View style={{ gap: space[2] }}>
                <Button label={t("collaboratorShare")} kind="secondary" onPress={() => void shareAsCollaborator()} />
                {linkCopied ? <Notice tone="success" text={t("copied")} /> : null}
                {product.collaboratorCommission ? (
                  <Muted>
                    {product.collaboratorCommission.calculation === "percent"
                      ? t("collaboratorRatePercent", { rate: product.collaboratorCommission.rate })
                      : t("collaboratorRateFixed", { amount: money(product.collaboratorCommission.rate) })}
                  </Muted>
                ) : null}
              </View>
            ) : null}
            {product.description ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("productDescription")}</Text>
                <Text style={{ color: colors.text, lineHeight: 22 }}>{product.description}</Text>
              </Card>
            ) : null}
          </>
        ) : (
          error && <Notice text={error} />
        )}
      </Screen>
    </ScrollView>
  );
}
