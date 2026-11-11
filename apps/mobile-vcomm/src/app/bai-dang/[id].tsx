// MAN_HINH_136 Chi tiết bài đăng: bình luận, thích, báo cáo bài hoặc bình luận (CONG_VIEC_49; API_168; QUYTAC_NGHIEPVU_333, 334).
import type { CommunityStatus, PostDetail } from "contracts";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { banText, PostCard, ReportForm, timeAgo } from "@/components/Community";
import { Button, Card, Field, Loading, Muted, Notice, Screen } from "@/components/ui";
import { api, ApiFailure } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { colors, space } from "@/lib/theme";

const t = translator("vcommApp");

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<{ postId: string } | { commentId: string } | null>(null);

  const load = useCallback(() => {
    setFailed(null);
    api<PostDetail>(`/buyer/posts/${id}`)
      .then(setPost)
      .catch((failure) => setFailed(failure instanceof ApiFailure && failure.status === 404 ? t("communityPostGone") : t("loadFailed")));
    api<CommunityStatus>("/buyer/community")
      .then(setStatus)
      .catch(() => undefined);
  }, [id]);
  useFocusEffect(load);

  async function like() {
    if (!post) return;
    setError(null);
    try {
      const result = await api<{ liked: boolean; likeCount: number }>(`/buyer/posts/${post.id}/like`, { method: post.likedByMe ? "DELETE" : "PUT" });
      setPost({ ...post, likedByMe: result.liked, likeCount: result.likeCount });
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }
  async function send() {
    setBusy(true);
    setError(null);
    try {
      setPost(await api<PostDetail>(`/buyer/posts/${id}/comments`, { method: "POST", json: { content: comment.trim() } }));
      setComment("");
    } catch (failure) {
      setError(failure instanceof ApiFailure ? (Object.values(failure.fields)[0] ?? failure.message) : t("unknownError"));
    } finally {
      setBusy(false);
    }
  }
  async function removeComment(commentId: string) {
    setError(null);
    try {
      await api(`/buyer/comments/${commentId}`, { method: "DELETE" });
      load();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }
  async function removePost() {
    if (!post) return;
    try {
      await api(`/buyer/posts/${post.id}`, { method: "DELETE" });
      router.back();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : t("unknownError"));
    }
  }

  const canComment = status ? status.commentsEnabled && !status.ban : false;
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
        {failed ? (
          <>
            <Notice text={failed} />
            <Button label={t("retry")} kind="secondary" onPress={load} />
          </>
        ) : post === null ? (
          <Loading />
        ) : (
          <>
            <PostCard post={post} onLike={() => void like()} onReport={() => setReporting({ postId: post.id })} onRemove={() => void removePost()} />
            {reporting && "postId" in reporting ? <ReportForm target={reporting} onDone={() => setReporting(null)} /> : null}
            {error ? <Notice text={error} /> : null}
            <Card>
              <Text style={{ fontWeight: "700", color: colors.text }}>{t("communityComments", { count: post.commentCount })}</Text>
              {post.comments.length === 0 ? <Muted>{t("communityNoComments")}</Muted> : null}
              {post.comments.map((item) => (
                <View key={item.id} style={{ gap: 2, paddingVertical: space[2], borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>{item.authorName}</Text>
                  {item.content === null ? <Muted>{t("communityCommentHidden")}</Muted> : <Text style={{ color: colors.text }}>{item.content}</Text>}
                  <View style={{ flexDirection: "row", gap: space[3], alignItems: "center" }}>
                    <Muted>{timeAgo(item.createdAt)}</Muted>
                    {item.isMine ? (
                      <Text accessibilityRole="button" onPress={() => void removeComment(item.id)} style={{ color: colors.error, fontWeight: "600", paddingVertical: space[1] }}>
                        {t("communityDelete")}
                      </Text>
                    ) : item.content !== null ? (
                      <Text accessibilityRole="button" onPress={() => setReporting({ commentId: item.id })} style={{ color: colors.textMuted, fontWeight: "600", paddingVertical: space[1] }}>
                        {t("communityReport")}
                      </Text>
                    ) : null}
                  </View>
                  {reporting && "commentId" in reporting && reporting.commentId === item.id ? <ReportForm target={reporting} onDone={() => setReporting(null)} /> : null}
                </View>
              ))}
              {status?.ban ? <Notice tone="warning" text={banText(status.ban)} /> : status && !status.commentsEnabled ? <Notice tone="info" text={t("communityPostingOff")} /> : null}
              {canComment ? (
                <>
                  <Field label={t("communityWriteComment")} value={comment} onChangeText={setComment} maxLength={1000} multiline />
                  <Button label={t("communitySend")} busy={busy} disabled={!comment.trim()} onPress={() => void send()} />
                </>
              ) : null}
            </Card>
          </>
        )}
      </Screen>
    </ScrollView>
  );
}
