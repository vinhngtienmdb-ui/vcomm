"use client";

// Nhãn trạng thái tin bảng tin.
import type { PostListItem } from "contracts";
import { useTranslations } from "next-intl";
import { formatDateTime } from "ui/lib/format";

export function PostBadges({ post }: { post: PostListItem }) {
  const t = useTranslations("officeBulletin");
  return (
    <>
      {post.state === "scheduled" && <span className="nhan thong-tin">{t("scheduledAt", { time: formatDateTime(post.publishAt) })}</span>}
      {post.state === "expired" && <span className="nhan trung-tinh">{t("state_expired")}</span>}
      {post.state === "revoked" && <span className="nhan trung-tinh">{t("state_revoked")}</span>}
      {post.state === "published" && post.requiresAcknowledgement && !post.acknowledgedAt && <span className="nhan canh-bao">{t("needsAcknowledgement")}</span>}
      {post.acknowledgedAt && <span className="nhan thanh-cong">{t("acknowledged")}</span>}
      {post.audienceType === "group" && <span className="nhan trung-tinh">{t("audience_group")}</span>}
    </>
  );
}
