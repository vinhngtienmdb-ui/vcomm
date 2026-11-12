"use client";

// MAN_HINH_159 Bảng tin (CHUC_NANG_185; API_191): tin ghim lên đầu, chưa đọc in đậm; người có quyền đăng xem thêm tin hẹn giờ, hết hạn, đã thu hồi.
import type { PageResponse, PostListItem, PostOptions } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PostBadges } from "@/components/PostBadges";
import { PostEditor } from "@/components/PostEditor";

export default function BulletinPage() {
  const options = useApi<PostOptions>("/office/post-options");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(data) => <Bulletin options={data} onPosted={() => void options.reload()} />}
    </Loaded>
  );
}

function Bulletin({ options, onPosted }: { options: PostOptions; onPosted: () => void }) {
  const t = useTranslations("officeBulletin");
  const common = useTranslations("common");
  const [view, setView] = useState<"feed" | "manage">("feed");
  const [unread, setUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const canManage = options.canPost || options.canPostGroup;
  const query = new URLSearchParams({ view, page: String(page), ...(unread ? { unread: "true" } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { state, reload } = useApi<PageResponse<PostListItem>>(`/office/posts?${query.toString()}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {canManage && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("create")}
          </button>
        )}
      </div>
      {canManage && (
        <div className="cac-the" role="tablist">
          {(["feed", "manage"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={view === item} className={view === item ? "chon" : ""} onClick={() => (setView(item), setPage(1))}>
              {t(`view_${item}`)}
            </button>
          ))}
        </div>
      )}
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="post-search">
          {common("search")}
        </label>
        <input id="post-search" className="o-nhap" placeholder={t("search")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
        <label style={{ alignSelf: "center" }}>
          <input type="checkbox" checked={unread} onChange={(event) => (setUnread(event.target.checked), setPage(1))} /> {t("unreadOnly")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <>
              {result.data.map((post) => (
                <div key={post.id} className="the">
                  <div style={{ fontWeight: post.isRead || view === "manage" ? 500 : 700 }}>
                    {post.pinned && post.state === "published" && <span aria-label={t("pinned")}>📌 </span>}
                    <Link href={`/bulletin/${post.id}`}>{post.title}</Link> <PostBadges post={post} />
                  </div>
                  <div className="chu-thich">
                    {[
                      post.author.fullName,
                      formatDateTime(post.publishAt),
                      post.audienceText,
                      post.commentCount > 0 ? t("commentCount", { count: post.commentCount }) : null,
                      post.fileCount > 0 ? t("fileCount", { count: post.fileCount }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div style={{ marginTop: "var(--khoang-1)" }}>{post.excerpt}</div>
                </div>
              ))}
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
                  </button>
                </span>
              </div>
            </>
          )
        }
      </Loaded>
      {creating && <PostEditor options={options} post={null} onClose={() => (setCreating(false), onPosted())} />}
    </>
  );
}
