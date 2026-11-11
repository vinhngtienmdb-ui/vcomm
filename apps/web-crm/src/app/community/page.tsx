"use client";

// MAN_HINH_139 Kiểm duyệt cộng đồng (CONG_VIEC_49; CHUC_NANG_174; API_169; QUYTAC_NGHIEPVU_334, 335):
// báo cáo chờ xử lý, nội dung đã ẩn, khóa và mở khóa tài khoản, bài VComm (ghim tối đa 3), cài đặt đăng bài, bình luận, từ cấm.
import type { CommunityBanItem, CommunitySettings, ModerationItem, PageResponse, PostItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const statusTone: Record<ModerationItem["status"], string> = { visible: "trung-tinh", auto_hidden: "canh-bao", hidden: "loi", deleted: "trung-tinh" };

function ItemPanel({ item, onChanged }: { item: ModerationItem; onChanged: () => Promise<void> }) {
  const t = useTranslations("community");
  const { notify } = useAdmin();
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [banReason, setBanReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingBan, setConfirmingBan] = useState(false);
  const path = `/marketplace/community/${item.target === "post" ? "posts" : "comments"}/${item.id}`;
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      notify(message);
      setConfirmingBan(false);
      await onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "flex", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
        <h2 style={{ flex: 1, minWidth: "220px", overflowWrap: "anywhere" }}>{t(item.target === "post" ? "postBy" : "commentBy", { name: item.authorName, phone: item.authorPhone })}</h2>
        <span className={`nhan ${statusTone[item.status]}`}>{t(`status_${item.status}`)}</span>
      </div>
      <div className="the" style={{ background: "var(--mau-nen)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {item.content}
      </div>
      <span className="chu-thich">
        {[
          formatDateTime(item.createdAt),
          item.pendingReports > 0 ? t("reportCount", { count: item.pendingReports }) : null,
          item.topReason ? t(`reason_${item.topReason}`) : null,
          item.hiddenReason ? `${t("hiddenReason")}: ${item.hiddenReason}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {item.status === "hidden" ? (
        <div className="nhom-nut">
          <button type="button" className="nut phu" disabled={busy} onClick={() => void run(() => apiFetch(`${path}/show`, { method: "POST" }), t("shownSaved"))}>
            {t("show")}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
          <span style={{ display: "grid", gap: "var(--khoang-1)", flex: 1, minWidth: "240px" }}>
            <label htmlFor={`an-${item.id}`}>{t("hideReason")}</label>
            <input id={`an-${item.id}`} className="o-nhap" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </span>
          <button
            type="button"
            className="nut nguy-hiem"
            disabled={busy || !reason.trim()}
            onClick={() => void run(() => apiFetch(`${path}/hide`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }), t("hiddenSaved"))}
          >
            {t("hide")}
          </button>
          <button type="button" className="nut phu" disabled={busy} onClick={() => void run(() => apiFetch(`${path}/show`, { method: "POST" }), t("dismissedSaved"))}>
            {t("dismiss")}
          </button>
        </div>
      )}
      <h3>{t("banTitle")}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor={`thoi-han-${item.id}`}>{t("banDuration")}</label>
          <select id={`thoi-han-${item.id}`} className="o-nhap" value={days} onChange={(event) => setDays(event.target.value)}>
            <option value="7">{t("days", { count: 7 })}</option>
            <option value="30">{t("days", { count: 30 })}</option>
            <option value="forever">{t("forever")}</option>
          </select>
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)", flex: 1, minWidth: "240px" }}>
          <label htmlFor={`ly-do-khoa-${item.id}`}>{t("banReason")}</label>
          <input id={`ly-do-khoa-${item.id}`} className="o-nhap" maxLength={500} value={banReason} onChange={(event) => setBanReason(event.target.value)} />
        </span>
        <button type="button" className="nut nguy-hiem" disabled={busy || !banReason.trim()} onClick={() => setConfirmingBan(true)}>
          {t("ban")}
        </button>
      </div>
      <FormError text={error} />
      {confirmingBan ? (
        <ConfirmDialog
          title={t("ban")}
          text={t("banConfirm", { name: item.authorName })}
          confirmLabel={t("ban")}
          busy={busy}
          error={error}
          onConfirm={() =>
            void run(
              () =>
                apiFetch("/marketplace/community/bans", {
                  method: "POST",
                  body: JSON.stringify({ userId: item.authorId, days: days === "forever" ? null : Number(days), reason: banReason.trim() }),
                }),
              t("bannedSaved"),
            )
          }
          onClose={() => setConfirmingBan(false)}
        />
      ) : null}
    </div>
  );
}

function Queue({ view }: { view: "reported" | "hidden" }) {
  const t = useTranslations("community");
  const { state, reload } = useApi<PageResponse<ModerationItem>>(`/marketplace/community/moderation?view=${view}&pageSize=100`);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(page) =>
        page.data.length === 0 ? (
          <MessageView text={t(view === "reported" ? "noReports" : "noHidden")} />
        ) : (
          <>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("content")}</th>
                    <th>{t("author")}</th>
                    <th>{t("reports")}</th>
                    <th>{t("topReason")}</th>
                    <th>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.data.map((item) => (
                    <tr key={item.id} aria-selected={selected === item.id}>
                      <td data-nhan={t("content")}>
                        <button type="button" className="nut chu" style={{ textAlign: "left" }} onClick={() => setSelected(selected === item.id ? null : item.id)}>
                          {`${t(`target_${item.target}`)}: “${item.content.length > 80 ? `${item.content.slice(0, 80)}…` : item.content}”`}
                        </button>
                      </td>
                      <td data-nhan={t("author")}>{item.authorName}</td>
                      <td data-nhan={t("reports")}>{item.pendingReports}</td>
                      <td data-nhan={t("topReason")}>{item.topReason ? t(`reason_${item.topReason}`) : "—"}</td>
                      <td data-nhan={t("status")}>
                        <span className={`nhan ${statusTone[item.status]}`}>{t(`status_${item.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.data
              .filter((item) => item.id === selected)
              .map((item) => (
                <ItemPanel
                  key={item.id}
                  item={item}
                  onChanged={async () => {
                    setSelected(null);
                    await reload();
                  }}
                />
              ))}
          </>
        )
      }
    </Loaded>
  );
}

function Bans() {
  const t = useTranslations("community");
  const { notify } = useAdmin();
  const { state, reload } = useApi<CommunityBanItem[]>("/marketplace/community/bans");
  const [lifting, setLifting] = useState<CommunityBanItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function lift(ban: CommunityBanItem) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/community/bans/${ban.id}/lift`, { method: "POST" });
      notify(t("liftedSaved"));
      setLifting(null);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(bans) =>
        bans.length === 0 ? (
          <MessageView text={t("noBans")} />
        ) : (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th>{t("buyer")}</th>
                  <th>{t("until")}</th>
                  <th>{t("banReason")}</th>
                  <th>{t("bannedBy")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bans.map((ban) => (
                  <tr key={ban.id}>
                    <td data-nhan={t("buyer")}>
                      <a href={`/crm/buyers/${ban.userId}`}>{`${ban.userName} · ${ban.userPhone}`}</a>
                    </td>
                    <td data-nhan={t("until")}>{ban.until ? formatDateTime(ban.until) : t("forever")}</td>
                    <td data-nhan={t("banReason")}>{ban.reason}</td>
                    <td data-nhan={t("bannedBy")}>{`${ban.bannedByName} · ${formatDateTime(ban.createdAt)}`}</td>
                    <td>
                      <button type="button" className="nut phu" onClick={() => setLifting(ban)}>
                        {t("lift")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lifting ? (
              <ConfirmDialog
                title={t("lift")}
                text={t("liftConfirm", { name: lifting.userName })}
                confirmLabel={t("lift")}
                busy={busy}
                error={error}
                onConfirm={() => void lift(lifting)}
                onClose={() => setLifting(null)}
              />
            ) : null}
          </div>
        )
      }
    </Loaded>
  );
}

function OfficialPosts() {
  const t = useTranslations("community");
  const { notify } = useAdmin();
  const { state, reload } = useApi<PostItem[]>("/marketplace/community/official-posts");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>, message: string, done?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      notify(message);
      done?.();
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <h2>{t("officialNew")}</h2>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="bai-vcomm">{t("content")}</label>
          <textarea id="bai-vcomm" className="o-nhap" rows={4} maxLength={2000} value={content} onChange={(event) => setContent(event.target.value)} />
        </span>
        <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          {t("pinLimit")}
        </label>
        <FormError text={error} />
        <div className="nhom-nut">
          <button
            type="button"
            className="nut chinh"
            disabled={busy || !content.trim()}
            onClick={() =>
              void run(
                () => apiFetch("/marketplace/community/official-posts", { method: "POST", body: JSON.stringify({ content: content.trim(), isPinned: pinned }) }),
                t("officialSaved"),
                () => setContent(""),
              )
            }
          >
            {t("publish")}
          </button>
        </div>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(posts) =>
          posts.length === 0 ? (
            <MessageView text={t("noOfficial")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("content")}</th>
                    <th>{t("postedAt")}</th>
                    <th>{t("engagement")}</th>
                    <th>{t("status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td data-nhan={t("content")} style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                        {post.content}
                      </td>
                      <td data-nhan={t("postedAt")}>{formatDateTime(post.createdAt)}</td>
                      <td data-nhan={t("engagement")}>{t("engagementText", { likes: post.likeCount, comments: post.commentCount })}</td>
                      <td data-nhan={t("status")}>
                        {post.isPinned ? <span className="nhan thanh-cong">{t("pinned")}</span> : <span className={`nhan ${statusTone[post.status]}`}>{t(`status_${post.status}`)}</span>}
                      </td>
                      <td>
                        {post.status === "visible" ? (
                          <button
                            type="button"
                            className="nut phu"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => apiFetch(`/marketplace/community/official-posts/${post.id}/pin`, { method: "PUT", body: JSON.stringify({ isPinned: !post.isPinned }) }),
                                t(post.isPinned ? "unpinnedSaved" : "pinnedSaved"),
                              )
                            }
                          >
                            {t(post.isPinned ? "unpin" : "pin")}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}

function SettingsForm({ settings, onSaved }: { settings: CommunitySettings; onSaved: () => Promise<void> }) {
  const t = useTranslations("community");
  const { notify } = useAdmin();
  const [posting, setPosting] = useState(settings.postingEnabled);
  const [comments, setComments] = useState(settings.commentsEnabled);
  const [words, setWords] = useState(settings.bannedWords.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      const bannedWords = words
        .split("\n")
        .map((word) => word.trim())
        .filter(Boolean);
      await apiFetch("/marketplace/community/settings", { method: "PUT", body: JSON.stringify({ postingEnabled: posting, commentsEnabled: comments, bannedWords, version: settings.version }) });
      notify(t("settingsSaved"));
      await onSaved();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
        <input type="checkbox" checked={posting} onChange={(event) => setPosting(event.target.checked)} />
        {t("postingEnabled")}
      </label>
      <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
        <input type="checkbox" checked={comments} onChange={(event) => setComments(event.target.checked)} />
        {t("commentsEnabled")}
      </label>
      <div className="khoi-canh-bao">{t("toggleHint")}</div>
      <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
        <label htmlFor="tu-cam">{t("bannedWords")}</label>
        <textarea id="tu-cam" className="o-nhap" rows={6} value={words} onChange={(event) => setWords(event.target.value)} />
      </span>
      <FormError text={error} />
      <div className="nhom-nut">
        <button type="button" className="nut chinh" disabled={busy} onClick={() => void save()}>
          {t("save")}
        </button>
      </div>
    </div>
  );
}

function Settings() {
  const { state, reload } = useApi<CommunitySettings>("/marketplace/community/settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settings) => <SettingsForm key={settings.version} settings={settings} onSaved={reload} />}
    </Loaded>
  );
}

const tabs = ["reported", "hidden", "bans", "official", "settings"] as const;

export default function CommunityPage() {
  const t = useTranslations("community");
  const [tab, setTab] = useState<(typeof tabs)[number]>("reported");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="nhom-nut" role="tablist">
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={`nut ${tab === item ? "chinh" : "phu"}`} onClick={() => setTab(item)}>
            {t(`tab_${item}`)}
          </button>
        ))}
      </div>
      {tab === "reported" || tab === "hidden" ? <Queue key={tab} view={tab} /> : tab === "bans" ? <Bans /> : tab === "official" ? <OfficialPosts /> : <Settings />}
    </>
  );
}
