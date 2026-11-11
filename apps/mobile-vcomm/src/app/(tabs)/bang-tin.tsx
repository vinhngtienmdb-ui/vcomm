// MAN_HINH_136 Bảng tin (CONG_VIEC_49; CHUC_NANG_174; API_167, 168; QUYTAC_NGHIEPVU_333 đến 335): bài ghim của VComm trước, bài mới nhất sau; lọc theo sản phẩm.
import type { CommunityStatus, PageResponse, PostItem } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { banText, PostCard, ReportForm } from "@/components/Community";
import { Button, Card, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function FeedScreen() {
  const { sanPham, ten } = useLocalSearchParams<{ sanPham?: string; ten?: string }>();
  const productId = typeof sanPham === "string" && sanPham ? sanPham : null;
  const [posts, setPosts] = useState<PostItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);

  const load = useCallback(
    (nextPage: number) => {
      setFailed(false);
      const query = new URLSearchParams({ page: String(nextPage), pageSize: "20", ...(productId ? { productId } : {}) });
      api<PageResponse<PostItem>>(`/buyer/posts?${query}`)
        .then((result) => {
          setPosts((current) => (nextPage === 1 ? result.data : [...(current ?? []), ...result.data]));
          setTotal(result.total);
          setPage(nextPage);
        })
        .catch(() => setFailed(true));
      if (nextPage === 1)
        api<CommunityStatus>("/buyer/community")
          .then(setStatus)
          .catch(() => undefined);
    },
    [productId],
  );
  useFocusEffect(useCallback(() => load(1), [load]));

  const replace = (next: PostItem) => setPosts((current) => current?.map((item) => (item.id === next.id ? next : item)) ?? null);
  async function like(post: PostItem) {
    setError(null);
    try {
      const result = await api<{ liked: boolean; likeCount: number }>(`/buyer/posts/${post.id}/like`, { method: post.likedByMe ? "DELETE" : "PUT" });
      replace({ ...post, likedByMe: result.liked, likeCount: result.likeCount });
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }
  async function remove(post: PostItem) {
    setError(null);
    try {
      await api(`/buyer/posts/${post.id}`, { method: "DELETE" });
      setPosts((current) => current?.filter((item) => item.id !== post.id) ?? null);
      setTotal((value) => value - 1);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }

  const canPost = status ? status.postingEnabled && !status.ban : false;
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Screen>
        {productId ? (
          <View style={{ gap: space[1] }}>
            <Text accessibilityRole="link" onPress={() => router.setParams({ sanPham: "", ten: "" })} style={{ color: colors.primary, fontWeight: "600", paddingVertical: space[2] }}>
              {t("communityAllPosts")}
            </Text>
            <Muted>{t("communityAboutProduct", { name: typeof ten === "string" && ten ? ten : "" })}</Muted>
          </View>
        ) : null}
        {status?.ban ? <Notice tone="warning" text={banText(status.ban)} /> : null}
        {status && !status.postingEnabled && !status.ban ? <Notice tone="info" text={t("communityPostingOff")} /> : null}
        {canPost ? <Button label={t("communityNewPost")} onPress={() => router.push("/dang-bai")} /> : null}
        {error ? <Notice text={error} /> : null}
        {failed ? (
          <>
            <Notice text={t("loadFailed")} />
            <Button label={t("retry")} kind="secondary" onPress={() => load(1)} />
          </>
        ) : posts === null ? (
          <Loading />
        ) : posts.length === 0 ? (
          <Card>
            <Muted>{t("communityEmpty")}</Muted>
          </Card>
        ) : (
          <>
            {posts.map((post) => (
              <View key={post.id} style={{ gap: space[2] }}>
                <PostCard
                  post={post}
                  onLike={() => void like(post)}
                  onOpen={() => router.push(`/bai-dang/${post.id}`)}
                  onReport={() => setReporting(reporting === post.id ? null : post.id)}
                  onRemove={() => void remove(post)}
                />
                {reporting === post.id ? <ReportForm target={{ postId: post.id }} onDone={() => setReporting(null)} /> : null}
              </View>
            ))}
            {posts.length < total ? <Button label={t("loadMore")} kind="secondary" onPress={() => load(page + 1)} /> : null}
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
