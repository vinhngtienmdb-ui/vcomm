// Thành phần bảng tin cộng đồng (CONG_VIEC_49; MAN_HINH_136; QUYTAC_NGHIEPVU_333, 334): thẻ bài đăng, ảnh cần đăng nhập, số sao, báo cáo vi phạm.
import { reportReasons, type CommunityStatus, type PostItem, type ReportReason } from "contracts";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { Button, Card, Choice, Field, Muted, Notice, StatusBadge } from "@/components/ui";
import { api, ApiFailure, assetUrl, authorizationHeader } from "@/lib/api";
import { money, shortDate, translator } from "@/lib/i18n";
import { colors, radius, space } from "@/lib/theme";

const t = translator("vcommApp");

export const timeAgo = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export function banText(ban: NonNullable<CommunityStatus["ban"]>) {
  return ban.until ? t("communityBannedUntil", { date: shortDate(ban.until), reason: ban.reason }) : t("communityBannedForever", { reason: ban.reason });
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <Text accessibilityLabel={t("communityStars", { count: value })} style={{ color: colors.warning, fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(value)}
      {"☆".repeat(5 - value)}
    </Text>
  );
}

// Ảnh bài đăng chỉ tải được khi đăng nhập: bản điện thoại gửi header, bản web tải về rồi hiện từ bộ nhớ.
export function AuthImage({ path, size }: { path: string; size: number }) {
  const url = assetUrl(path)!;
  const [webUri, setWebUri] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let objectUrl: string | null = null;
    fetch(url, { headers: authorizationHeader() })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob) return;
        objectUrl = URL.createObjectURL(blob);
        setWebUri(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  const style = { width: size, height: size, borderRadius: radius.small, backgroundColor: colors.primaryLight };
  if (Platform.OS === "web") return webUri ? <Image source={{ uri: webUri }} style={style} accessibilityIgnoresInvertColors /> : <View style={style} />;
  return <Image source={{ uri: url, headers: authorizationHeader() }} style={style} accessibilityIgnoresInvertColors />;
}

function Initials({ name, official }: { name: string; official: boolean }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <View style={{ width: 40, height: 40, borderRadius: radius.round, backgroundColor: official ? colors.primary : colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: official ? colors.surface : colors.primaryDark, fontWeight: "700" }}>{official ? "VC" : letters}</Text>
    </View>
  );
}

export function PostCard({ post, onLike, onOpen, onReport, onRemove }: { post: PostItem; onLike: () => void; onOpen?: () => void; onReport?: () => void; onRemove?: () => void }) {
  const official = post.kind === "official";
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
        <Initials name={post.authorName} official={official} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", gap: space[2], alignItems: "center", flexWrap: "wrap" }}>
            <Text style={{ fontWeight: "700", color: colors.text, flexShrink: 1 }} numberOfLines={2}>
              {post.authorName}
            </Text>
            {official ? <StatusBadge tone="success" text="VComm" /> : null}
            {post.kind === "review" ? <StatusBadge tone="success" text={t("communityVerifiedBuyer")} /> : null}
          </View>
          <Muted>{[post.isPinned ? t("communityPinned") : null, timeAgo(post.createdAt)].filter(Boolean).join(" · ")}</Muted>
        </View>
      </View>
      {post.status === "auto_hidden" ? <Notice tone="warning" text={t("communityAutoHiddenMine")} /> : null}
      {post.rating ? <Stars value={post.rating} /> : null}
      <Pressable accessibilityRole={onOpen ? "link" : undefined} disabled={!onOpen} onPress={onOpen}>
        <Text style={{ color: colors.text, lineHeight: 22 }}>{post.content}</Text>
      </Pressable>
      {post.images.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
          {post.images.map((image) => (
            <AuthImage key={image} path={image} size={96} />
          ))}
        </View>
      ) : null}
      {post.products.map((product) => (
        <Pressable
          key={product.productId}
          accessibilityRole="link"
          onPress={() => router.push(`/san-pham/${product.productId}`)}
          style={{ flexDirection: "row", gap: space[2], alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: radius.small, padding: space[2] }}
        >
          {product.imageUrl ? (
            <Image source={{ uri: assetUrl(product.imageUrl)! }} style={{ width: 40, height: 40, borderRadius: radius.small }} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: radius.small, backgroundColor: colors.primaryLight }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={2}>
              {product.name}
            </Text>
            {product.priceFrom ? <Muted>{t("priceFrom", { price: money(product.priceFrom) })}</Muted> : null}
          </View>
        </Pressable>
      ))}
      <View style={{ flexDirection: "row", gap: space[4], flexWrap: "wrap", paddingTop: space[1] }}>
        <Text
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
          onPress={onLike}
          style={{ color: post.likedByMe ? colors.primary : colors.textMuted, fontWeight: "600", paddingVertical: space[1] }}
        >
          {t(post.likedByMe ? "communityLiked" : "communityLike", { count: post.likeCount })}
        </Text>
        <Text accessibilityRole={onOpen ? "link" : "text"} onPress={onOpen} style={{ color: colors.textMuted, fontWeight: "600", paddingVertical: space[1] }}>
          {t("communityComments", { count: post.commentCount })}
        </Text>
        {post.isMine && onRemove ? (
          <Text accessibilityRole="button" onPress={onRemove} style={{ color: colors.error, fontWeight: "600", paddingVertical: space[1] }}>
            {t("communityDelete")}
          </Text>
        ) : null}
        {!post.isMine && !official && onReport ? (
          <Text accessibilityRole="button" onPress={onReport} style={{ color: colors.textMuted, fontWeight: "600", paddingVertical: space[1] }}>
            {t("communityReport")}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

// Báo cáo một bài hoặc một bình luận (QUYTAC_NGHIEPVU_334).
export function ReportForm({ target, onDone }: { target: { postId: string } | { commentId: string }; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await api("/buyer/reports", { method: "POST", json: { ...target, reason, description: description.trim() || null } });
      setSent(true);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? (Object.values(failure.fields)[0] ?? failure.message) : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Text style={{ fontWeight: "700", color: colors.text, fontSize: 16 }}>{t("communityReportTitle")}</Text>
      {sent ? (
        <>
          <Notice tone="success" text={t("communityReportSent")} />
          <Button label={t("close")} kind="secondary" onPress={onDone} />
        </>
      ) : (
        <>
          <Choice label={t("communityReportReason")} value={reason} options={reportReasons.map((value) => ({ value, label: t(`communityReason_${value}`) }))} onChange={setReason} />
          <Field label={t("communityReportDescription")} value={description} onChangeText={setDescription} maxLength={500} multiline />
          {error ? <Notice text={error} /> : null}
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            <Button label={t("communityReportSubmit")} busy={busy} disabled={!reason} onPress={() => void submit()} />
            <Button label={t("cancel")} kind="secondary" onPress={onDone} />
          </View>
        </>
      )}
    </Card>
  );
}
