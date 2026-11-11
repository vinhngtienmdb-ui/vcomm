// MAN_HINH_136 Đăng bài, viết đánh giá (CONG_VIEC_49; API_167; QUYTAC_NGHIEPVU_333): nội dung, tối đa 5 ảnh, gắn tối đa 3 sản phẩm;
// đánh giá chỉ cho dòng hàng đã giao của chính mình, mỗi dòng một lần, kèm số sao.
import type { CommunityStatus, PageResponse, PostItem, ReviewableLine, ShopProductItem } from "contracts";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { AuthImage, banText } from "@/components/Community";
import { Button, Card, Field, Loading, Muted, Notice, Screen, Title } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { money, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function ComposeScreen() {
  const { dongDon, sanPham, ten } = useLocalSearchParams<{ dongDon?: string; sanPham?: string; ten?: string }>();
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [lines, setLines] = useState<ReviewableLine[] | null>(null);
  const [lineId, setLineId] = useState<string | null>(typeof dongDon === "string" && dongDon ? dongDon : null);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>(typeof sanPham === "string" && sanPham ? [{ id: sanPham, name: typeof ten === "string" ? ten : "" }] : []);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<ShopProductItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    api<CommunityStatus>("/buyer/community")
      .then(setStatus)
      .catch(() => setError(t("loadFailed")));
    api<ReviewableLine[]>("/buyer/reviewable-lines")
      .then(setLines)
      .catch(() => setLines([]));
  }, []);

  // Tìm sản phẩm để gắn: chờ người dùng dừng gõ.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) return setFound([]);
    const timer = setTimeout(() => {
      api<PageResponse<ShopProductItem>>(`/buyer/shop/products?${new URLSearchParams({ search: query, page: "1", pageSize: "5" })}`)
        .then((result) => setFound(result.data))
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function pickImage() {
    setError(null);
    const permission = Platform.OS === "web" ? { granted: true } : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError(t("returnPhotoPermission"));
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      const form = new FormData();
      const name = asset.fileName ?? `anh-${Date.now()}.jpg`;
      if (asset.file) form.append("file", asset.file);
      else form.append("file", { uri: asset.uri, name, type: asset.mimeType ?? "image/jpeg" } as unknown as Blob);
      const uploaded = await api<{ id: string; url: string }>("/buyer/posts/images", { method: "POST", body: form });
      setImages((current) => [...current, uploaded]);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? (Object.values(failure.fields)[0] ?? failure.message) : t("unknownError"));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const post = await api<PostItem>("/buyer/posts", {
        method: "POST",
        json: { content: content.trim(), imageIds: images.map((image) => image.id), productIds: products.map((product) => product.id), orderLineId: lineId, rating: lineId ? rating : null },
      });
      router.replace(`/bai-dang/${post.id}`);
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        setFields(failure.fields);
        setError(failure.message);
      } else setError(t("unknownError"));
    } finally {
      setBusy(false);
    }
  }

  const line = lines?.find((item) => item.orderLineId === lineId) ?? null;
  const blocked = status ? !status.postingEnabled || status.ban : false;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <Screen>
        <Text
          accessibilityRole="link"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/bang-tin"))}
          style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}
        >
          {t("back")}
        </Text>
        <Title>{lineId ? t("communityWriteReview") : t("communityNewPost")}</Title>
        {status === null || lines === null ? (
          error ? (
            <Notice text={error} />
          ) : (
            <Loading />
          )
        ) : blocked ? (
          <Notice tone={status.ban ? "warning" : "info"} text={status.ban ? banText(status.ban) : t("communityPostingOff")} />
        ) : (
          <>
            {lines.length > 0 ? (
              <Card>
                <Text style={{ fontWeight: "700", color: colors.text }}>{t("communityReviewOptional")}</Text>
                {[null, ...lines].map((item) => {
                  const selected = (item?.orderLineId ?? null) === lineId;
                  return (
                    <Pressable
                      key={item?.orderLineId ?? "none"}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setLineId(item?.orderLineId ?? null)}
                      style={{ flexDirection: "row", gap: space[2], paddingVertical: space[1], alignItems: "center" }}
                    >
                      <Text style={{ color: selected ? colors.primary : colors.textMuted, fontSize: 18 }}>{selected ? "◉" : "○"}</Text>
                      <Text style={{ color: colors.text, flex: 1 }}>
                        {item ? t("communityReviewLine", { documentNo: item.documentNo, product: [item.productName, item.variantLabel].filter(Boolean).join(" · ") }) : t("communityNoReview")}
                      </Text>
                    </Pressable>
                  );
                })}
                {line ? (
                  <View style={{ gap: space[1] }}>
                    <View accessibilityRole="radiogroup" accessibilityLabel={t("communityRating")} style={{ flexDirection: "row", gap: space[1] }}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Text
                          key={value}
                          accessibilityRole="radio"
                          accessibilityLabel={t("communityStars", { count: value })}
                          accessibilityState={{ checked: rating === value }}
                          onPress={() => setRating(value)}
                          style={{ fontSize: 32, color: value <= rating ? colors.warning : colors.border, paddingHorizontal: 2 }}
                        >
                          ★
                        </Text>
                      ))}
                    </View>
                    {fields.rating || fields.orderLineId ? <Text style={{ color: colors.error }}>{fields.rating ?? fields.orderLineId}</Text> : null}
                    <Muted>{t("communityReviewRule")}</Muted>
                  </View>
                ) : null}
              </Card>
            ) : null}
            <Field label={t("communityContent")} value={content} onChangeText={setContent} maxLength={2000} multiline error={fields.content} />
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("communityImages", { count: images.length })}</Text>
              {images.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                  {images.map((image) => (
                    <View key={image.id} style={{ gap: space[1], alignItems: "center" }}>
                      <AuthImage path={image.url} size={72} />
                      <Text
                        accessibilityRole="button"
                        onPress={() => setImages((current) => current.filter((item) => item.id !== image.id))}
                        style={{ color: colors.error, paddingVertical: space[1] }}
                      >
                        {t("communityRemove")}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {fields.imageIds ? <Text style={{ color: colors.error }}>{fields.imageIds}</Text> : null}
              {images.length < 5 ? <Button label={t("returnAddImage")} kind="secondary" busy={uploading} onPress={() => void pickImage()} /> : null}
            </Card>
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("communityProducts", { count: products.length })}</Text>
              {products.map((product) => (
                <View key={product.id} style={{ flexDirection: "row", gap: space[2], alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, padding: space[2] }}>
                  <Text style={{ flex: 1, color: colors.text }}>{product.name}</Text>
                  <Text
                    accessibilityRole="button"
                    onPress={() => setProducts((current) => current.filter((item) => item.id !== product.id))}
                    style={{ color: colors.error, paddingVertical: space[1] }}
                  >
                    {t("communityRemove")}
                  </Text>
                </View>
              ))}
              {fields.productIds ? <Text style={{ color: colors.error }}>{fields.productIds}</Text> : null}
              {products.length < 3 ? (
                <>
                  <Field label={t("communityFindProduct")} value={search} onChangeText={setSearch} maxLength={100} />
                  {found
                    .filter((item) => !products.some((product) => product.id === item.id))
                    .map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setProducts((current) => [...current, { id: item.id, name: item.name }]);
                          setSearch("");
                        }}
                        style={{ paddingVertical: space[2], borderTopWidth: 1, borderTopColor: colors.border }}
                      >
                        <Text style={{ color: colors.text }}>{item.name}</Text>
                        <Muted>{t("priceFrom", { price: money(item.priceFrom) })}</Muted>
                      </Pressable>
                    ))}
                </>
              ) : null}
            </Card>
            {error ? <Notice text={error} /> : null}
            <Button label={t("communityPublish")} busy={busy} disabled={!content.trim() || uploading || (line !== null && rating === 0)} onPress={() => void submit()} />
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
