"use client";

// MAN_HINH_159 Chi tiết tin (CHUC_NANG_185; API_191): nội dung, tệp, xác nhận đã đọc, bình luận; người đăng sửa, thu hồi, xem ai đã đọc.
import type { PostOptions, PostReader, PostResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { FileList } from "@/components/FileList";
import { personLabel } from "@/components/PersonPicker";
import { PostBadges } from "@/components/PostBadges";
import { PostBody } from "@/components/PostBody";
import { PostEditor } from "@/components/PostEditor";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PostResponse>(`/office/posts/${id}`);
  const options = useApi<PostOptions>("/office/post-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(post) => (
        <Loaded state={options.state} onRetry={() => void options.reload()}>
          {(data) => <PostDetail post={post} options={data} onChanged={() => void reload()} key={post.version} />}
        </Loaded>
      )}
    </Loaded>
  );
}

function PostDetail({ post, options, onChanged }: { post: PostResponse; options: PostOptions; onChanged: () => void }) {
  const t = useTranslations("officeBulletin");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [readersOpen, setReadersOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = new Set(post.allowedActions);
  const act = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await work();
      notify(message);
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  const upload = (files: FileList | null) =>
    files &&
    files.length > 0 &&
    void act(async () => {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        await apiUpload(`/office/posts/${post.id}/files`, form);
      }
    }, t("fileAdded"));
  return (
    <>
      <p className="chu-thich">
        <Link href="/bulletin">{t("title")}</Link>
      </p>
      <div className="tieu-de">
        <h1>
          {post.pinned && post.state === "published" && <span aria-label={t("pinned")}>📌 </span>}
          {post.title} <PostBadges post={post} />
        </h1>
        <div className="nhom-nut">
          {allowed.has("acknowledge") && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void act(() => apiFetch(`/office/posts/${post.id}/acknowledge`, { method: "POST" }), t("acknowledgedDone"))}>
              {t("acknowledge")}
            </button>
          )}
          {allowed.has("view_readers") && (
            <button type="button" className="nut phu" onClick={() => setReadersOpen(true)}>
              {t("readers")}
            </button>
          )}
          {allowed.has("edit") && (
            <button type="button" className="nut phu" onClick={() => setEditing(true)}>
              {t("edit")}
            </button>
          )}
          {allowed.has("revoke") && (
            <button type="button" className="nut nguy-hiem" onClick={() => setConfirmRevoke(true)}>
              {t("revoke")}
            </button>
          )}
        </div>
      </div>
      {post.readStats && <div className="khoi-canh-bao thong-tin">{t("readStats", post.readStats)}</div>}
      <div className="the">
        <div className="chu-thich" style={{ marginBottom: "var(--khoang-2)" }}>
          {[
            personLabel(post.author),
            formatDateTime(post.publishAt),
            post.audienceText,
            post.editedAt ? t("edited") : null,
            post.expiresAt ? t("expiresOn", { time: formatDateTime(post.expiresAt) }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <PostBody body={post.body} />
        {(post.files.length > 0 || allowed.has("upload")) && (
          <>
            <h2>{t("files")}</h2>
            {post.files.length > 0 && <FileList files={post.files} basePath={`/office/posts/${post.id}/files`} />}
            {allowed.has("upload") && (
              <div className="nhom-nut" style={{ marginTop: "var(--khoang-2)" }}>
                <label className="nut phu">
                  {t("addFile")}
                  <input type="file" multiple hidden disabled={busy} onChange={(event) => upload(event.target.files)} />
                </label>
              </div>
            )}
          </>
        )}
      </div>
      <div className="the">
        <h2>{t("comments")}</h2>
        {post.comments.length === 0 ? (
          <p className="chu-thich">{post.allowComments ? t("noComments") : t("commentsClosed")}</p>
        ) : (
          <ol className="dong-thoi-gian">
            {post.comments.map((item) => (
              <li key={item.id} className="xong">
                <span className="cham">{item.author.fullName.slice(0, 1)}</span>
                <div>
                  <strong>{item.author.fullName}</strong> <span className="chu-thich">{formatDateTime(item.createdAt)}</span>
                  {item.editedAt && <span className="chu-thich"> {t("edited")}</span>}
                  {item.deleted ? <div className="chu-thich">{t("commentDeleted")}</div> : <div style={{ whiteSpace: "pre-wrap" }}>{item.body}</div>}
                  {(item.canDelete ?? item.canEdit) && (
                    <button
                      type="button"
                      className="nut chu"
                      disabled={busy}
                      onClick={() => void act(() => apiFetch(`/office/posts/${post.id}/comments/${item.id}`, { method: "DELETE" }), t("commentRemoved"))}
                    >
                      {t("deleteComment")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {allowed.has("comment") && (
          <>
            <label className="an-nhan" htmlFor="post-comment">
              {t("writeComment")}
            </label>
            <textarea id="post-comment" className="o-nhap" rows={2} maxLength={5000} placeholder={t("writeComment")} value={comment} onChange={(event) => setComment(event.target.value)} />
            <div className="nhom-nut" style={{ marginTop: "var(--khoang-2)" }}>
              <button
                type="button"
                className="nut chinh"
                disabled={busy || !comment.trim()}
                onClick={() =>
                  void act(() => apiFetch(`/office/posts/${post.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment.trim() }) }).then(() => setComment("")), t("commentSent"))
                }
              >
                {t("sendComment")}
              </button>
            </div>
          </>
        )}
      </div>
      {editing && <PostEditor options={options} post={post} onClose={() => (setEditing(false), onChanged())} />}
      {readersOpen && <ReadersDrawer post={post} onClose={() => setReadersOpen(false)} />}
      {confirmRevoke && (
        <Drawer title={t("revoke")} onClose={() => setConfirmRevoke(false)}>
          <p>{t("revokeHint")}</p>
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setConfirmRevoke(false)}>
              {common("cancel")}
            </button>
            <button
              type="button"
              className="nut nguy-hiem"
              disabled={busy}
              onClick={() =>
                void act(() => apiFetch(`/office/posts/${post.id}/revoke`, { method: "POST", body: JSON.stringify({ version: post.version }) }).then(() => setConfirmRevoke(false)), t("revokedDone"))
              }
            >
              {t("revoke")}
            </button>
          </div>
        </Drawer>
      )}
    </>
  );
}

function ReadersDrawer({ post, onClose }: { post: PostResponse; onClose: () => void }) {
  const t = useTranslations("officeBulletin");
  const { state, reload } = useApi<PostReader[]>(`/office/posts/${post.id}/readers`);
  const [filter, setFilter] = useState<"unread" | "unacknowledged" | "all">("all");
  const headings = [t("recipient"), t("readAt"), ...(post.requiresAcknowledgement ? [t("acknowledgedAt")] : [])];
  return (
    <Drawer title={t("readers")} onClose={onClose}>
      {post.readStats && <p>{t("readStats", post.readStats)}</p>}
      <select className="o-nhap" aria-label={t("readerFilter")} value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
        <option value="all">{t("readerFilter_all")}</option>
        <option value="unread">{t("readerFilter_unread")}</option>
        {post.requiresAcknowledgement && <option value="unacknowledged">{t("readerFilter_unacknowledged")}</option>}
      </select>
      <Loaded state={state} onRetry={() => void reload()}>
        {(readers) => {
          const shown = readers.filter((reader) => (filter === "unread" ? reader.readAt === null : filter === "unacknowledged" ? reader.acknowledgedAt === null : true));
          return (
            <div className="khung-bang" style={{ marginTop: "var(--khoang-3)" }}>
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((reader) => (
                    <tr key={reader.person.id}>
                      <td data-nhan={headings[0]}>
                        <span>{personLabel(reader.person)}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{reader.readAt ? formatDateTime(reader.readAt) : "—"}</span>
                      </td>
                      {post.requiresAcknowledgement && (
                        <td data-nhan={headings[2]}>
                          <span>{reader.acknowledgedAt ? formatDateTime(reader.acknowledgedAt) : "—"}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Loaded>
    </Drawer>
  );
}
