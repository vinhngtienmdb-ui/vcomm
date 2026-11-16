// MAN_HINH_91 Chi tiết sản phẩm (CHUC_NANG_115; API_124): ảnh, giá gồm thuế, chọn phân loại, số lượng, mô tả, thêm vào giỏ hàng.
// CONG_VIEC_49: điểm đánh giá đã mua hàng, mở bảng tin lọc theo sản phẩm (MAN_HINH_136); cộng tác viên đã duyệt xem mức hoa hồng cộng tác viên (QUYTAC_NGHIEPVU_325, 326).
// CONG_VIEC_22 MAN_HINH_201: một nút Chia sẻ cho mọi người mua, đường dẫn kèm mã giới thiệu và mã cộng tác viên nếu có (QUYTAC_NGHIEPVU_434).
import type { BuyerCollaboratorResponse, ShopProductDetail } from "contracts";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Stars } from "@/components/Community";
import { Button, Card, Choice, Loading, Muted, Notice, QuantityStepper, Screen, Title } from "@/components/ui";
import { api, ApiFailure, assetUrl } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { clearHeldProduct, productShareLink } from "@/lib/product-link";
import { useSession } from "@/lib/session";
import { colors, space } from "@/lib/theme";
import { copyText } from "@/lib/clipboard";

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
  const [sharing, setSharing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const { me } = useSession();

  useEffect(() => {
    let active = true;
    clearHeldProduct();
    setUnavailable(false);
    api<ShopProductDetail>(`/buyer/shop/products/${encodeURIComponent(String(id))}`)
      .then((value) => {
        if (!active) return;
        setProduct(value);
        setSelected(value.variants.find((variant) => Number(variant.available) > 0)?.optionValues ?? value.variants[0]!.optionValues);
      })
      .catch((failure: unknown) => {
        if (!active) return;
        // Sản phẩm không còn bán (QUYTAC_NGHIEPVU_434).
        if (failure instanceof ApiFailure && failure.status === 404) return setUnavailable(true);
        setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
      });
    api<BuyerCollaboratorResponse>("/buyer/collaborator")
      .then((value) => active && setCollaboratorCode(value.profile?.status === "approved" ? value.profile.code : null))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id]);

  const shareLink = product ? productShareLink(product.id, me?.referralCode ?? null, collaboratorCode) : null;
  const shareMessage = product && shareLink ? t("productShareMessage", { name: product.name, link: shareLink }) : "";

  // Sao chép trên máy thật và bản web (expo-clipboard); chỉ báo đã sao chép khi ghi được.
  async function copyLink() {
    if (!shareLink) return;
    setLinkCopied(await copyText(shareLink));
  }

  async function shareNow() {
    if (!shareMessage) return;
    if (Platform.OS === "web") {
      const browser = globalThis.navigator as Navigator | undefined;
      if (browser?.share) return void browser.share({ text: shareMessage }).catch(() => undefined);
      return copyLink();
    }
    await Share.share({ message: shareMessage });
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
        {!product && !error && !unavailable ? <Loading /> : null}
        {unavailable ? (
          <View style={{ gap: space[2] }}>
            <Notice tone="warning" text={t("productUnavailable")} />
            <Button label={t("goHome")} onPress={() => router.replace("/trang-chu")} />
          </View>
        ) : null}
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
            {shareLink ? <Button label={t("shareProduct")} kind="secondary" onPress={() => setSharing((value) => !value)} /> : null}
            {sharing && shareLink ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("shareProduct")}</Text>
                <Muted>{t("shareContent")}</Muted>
                <Notice tone="info" text={shareMessage} />
                <Muted>{t("shareSocialHint")}</Muted>
                <Muted>{me?.referralCode ? t("shareProductHint", { code: me.referralCode }) : t("shareProductCollaboratorHint")}</Muted>
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  <View style={{ flex: 1 }}>
                    <Button label={t("copyLink")} kind="secondary" onPress={() => void copyLink()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label={t("shareNow")} onPress={() => void shareNow()} />
                  </View>
                </View>
                {linkCopied ? <Notice tone="success" text={t("copied")} /> : null}
              </Card>
            ) : null}
            {collaboratorCode && product.collaboratorCommission ? (
              <Muted>
                {product.collaboratorCommission.calculation === "percent"
                  ? t("collaboratorRatePercent", { rate: product.collaboratorCommission.rate })
                  : t("collaboratorRateFixed", { amount: money(product.collaboratorCommission.rate) })}
              </Muted>
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
