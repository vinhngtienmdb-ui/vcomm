"use client";

// MAN_HINH_137 Cộng tác viên và thưởng giới thiệu (CONG_VIEC_49; CHUC_NANG_171; API_163; QUYTAC_NGHIEPVU_324, 327):
// danh sách hồ sơ, duyệt, từ chối, tạm ngừng, khôi phục, gắn nhãn KOL, KOC, lịch sử, thống kê; cài đặt thưởng giới thiệu bạn bè.
import {
  collaboratorLabels,
  collaboratorStatuses,
  type CollaboratorDetail,
  type CollaboratorLabel,
  type CollaboratorListItem,
  type CollaboratorStatus,
  type PageResponse,
  type ReferralBonusSettings,
} from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const statusTone: Record<CollaboratorStatus, string> = { pending: "canh-bao", approved: "thanh-cong", rejected: "loi", suspended: "trung-tinh" };

function StatusBadge({ status }: { status: CollaboratorStatus }) {
  const t = useTranslations("collaborators");
  return <span className={`nhan ${statusTone[status]}`}>{t(`status_${status}`)}</span>;
}

function Detail({ userId, onChanged }: { userId: string; onChanged: () => Promise<void> }) {
  const t = useTranslations("collaborators");
  const { notify, can } = useAdmin();
  const { state, reload } = useApi<CollaboratorDetail>(`/marketplace/collaborators/${userId}`);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = can("marketplace.buyer.manage");
  async function act(detail: CollaboratorDetail, path: string, method: "POST" | "PUT", body: object, saved: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/collaborators/${userId}/${path}`, { method, body: JSON.stringify({ ...body, version: detail.version }) });
      notify(t(saved));
      setReason("");
      await Promise.all([reload(), onChanged()]);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(detail) => (
        <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <div style={{ display: "flex", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ flex: 1, minWidth: "200px", overflowWrap: "anywhere" }}>{detail.fullName}</h2>
            <StatusBadge status={detail.status} />
          </div>
          <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <span>
              <span className="chu-thich">{t("phone")}</span>
              <br />
              {detail.phone}
            </span>
            <span>
              <span className="chu-thich">{t("code")}</span>
              <br />
              <strong>{detail.code ?? "—"}</strong>
            </span>
            <span>
              <span className="chu-thich">{t("channel")}</span>
              <br />
              <span style={{ overflowWrap: "anywhere" }}>{detail.channel ?? "—"}</span>
            </span>
            <span>
              <span className="chu-thich">{t("terms")}</span>
              <br />
              {t("termsValue", { version: detail.termsVersion, at: formatDateTime(detail.submittedAt) })}
            </span>
            <span>
              <span className="chu-thich">{t("stats")}</span>
              <br />
              {t("statsValue", { clicks: detail.clicks, orders: detail.orders, pending: formatNumber(detail.pendingAmount, 0), credited: formatNumber(detail.creditedAmount, 0) })}
            </span>
          </div>
          {detail.reason ? <span className="chu-thich">{`${t("reason")}: ${detail.reason}`}</span> : null}
          <FormError text={error} />
          {canManage ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
              {detail.status === "pending" || detail.status === "approved" ? (
                <span style={{ display: "grid", gap: "var(--khoang-1)", minWidth: "240px", flex: 1 }}>
                  <label htmlFor={`ctv-ly-do-${userId}`}>{t(detail.status === "pending" ? "rejectReason" : "suspendReason")}</label>
                  <input id={`ctv-ly-do-${userId}`} className="o-nhap" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
                </span>
              ) : null}
              {detail.status === "pending" ? (
                <>
                  <button type="button" className="nut chinh" disabled={busy} onClick={() => void act(detail, "approve", "POST", {}, "approvedSaved")}>
                    {t("approve")}
                  </button>
                  <button type="button" className="nut nguy-hiem" disabled={busy || !reason.trim()} onClick={() => void act(detail, "reject", "POST", { reason: reason.trim() }, "rejectedSaved")}>
                    {t("reject")}
                  </button>
                </>
              ) : null}
              {detail.status === "approved" ? (
                <button type="button" className="nut nguy-hiem" disabled={busy || !reason.trim()} onClick={() => void act(detail, "suspend", "POST", { reason: reason.trim() }, "suspendedSaved")}>
                  {t("suspend")}
                </button>
              ) : null}
              {detail.status === "suspended" ? (
                <button type="button" className="nut chinh" disabled={busy} onClick={() => void act(detail, "restore", "POST", {}, "restoredSaved")}>
                  {t("restore")}
                </button>
              ) : null}
              {detail.status === "approved" || detail.status === "suspended" ? (
                <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                  <label htmlFor={`ctv-nhan-${userId}`}>{t("label")}</label>
                  <select
                    id={`ctv-nhan-${userId}`}
                    className="o-nhap"
                    disabled={busy}
                    value={detail.label ?? ""}
                    onChange={(event) => void act(detail, "label", "PUT", { label: (event.target.value || null) as CollaboratorLabel | null }, "labelSaved")}
                  >
                    <option value="">{t("noLabel")}</option>
                    {collaboratorLabels.map((label) => (
                      <option key={label} value={label}>
                        {t(`label_${label}`)}
                      </option>
                    ))}
                  </select>
                </span>
              ) : null}
            </div>
          ) : null}
          <div>
            <h3>{t("history")}</h3>
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
              {detail.history.map((item) => (
                <li key={`${item.changedAt}-${item.action}`} className="chu-thich">
                  {`${formatDateTime(item.changedAt)} · ${t(`action_${item.action}`)}${item.label ? ` ${t(`label_${item.label}`)}` : ""} · ${item.changedByName}${item.reason ? ` · ${item.reason}` : ""}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Loaded>
  );
}

function BonusSettings() {
  const t = useTranslations("collaborators");
  const common = useTranslations("common");
  const { notify, can } = useAdmin();
  const { state, reload } = useApi<ReferralBonusSettings>("/marketplace/referral-bonus-settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settings) => (
        <BonusForm key={settings.version} settings={settings} canManage={can("marketplace.order.manage")} onSaved={async () => (notify(t("bonusSaved")), await reload())} common={common} />
      )}
    </Loaded>
  );
}

function BonusForm({ settings, canManage, onSaved, common }: { settings: ReferralBonusSettings; canManage: boolean; onSaved: () => Promise<void>; common: ReturnType<typeof useTranslations> }) {
  const t = useTranslations("collaborators");
  const [isEnabled, setEnabled] = useState(settings.isEnabled);
  const [bonusAmount, setBonusAmount] = useState(settings.bonusAmount ?? "");
  const [minimumOrder, setMinimumOrder] = useState(settings.minimumOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/marketplace/referral-bonus-settings", { method: "PUT", body: JSON.stringify({ isEnabled, bonusAmount, minimumOrder, version: settings.version }) });
      await onSaved();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("bonusTitle")}</h2>
      <div className="chu-thich">{t("bonusHint")}</div>
      <FormError text={error} />
      <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
        <input type="checkbox" checked={isEnabled} disabled={!canManage} onChange={(event) => setEnabled(event.target.checked)} />
        {t("bonusEnabled")}
      </label>
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="thuong-muc">{t("bonusAmount")}</label>
          <input id="thuong-muc" className="o-nhap" inputMode="numeric" disabled={!canManage} value={bonusAmount} onChange={(event) => setBonusAmount(event.target.value)} />
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="thuong-toi-thieu">{t("minimumOrder")}</label>
          <input id="thuong-toi-thieu" className="o-nhap" inputMode="numeric" disabled={!canManage} value={minimumOrder} onChange={(event) => setMinimumOrder(event.target.value)} />
        </span>
      </div>
      {canManage ? (
        <span className="nhom-nut">
          <button type="button" className="nut chinh" disabled={busy || !bonusAmount.trim()} onClick={() => void save()}>
            {common("save")}
          </button>
        </span>
      ) : null}
    </div>
  );
}

export default function CollaboratorsPage() {
  const t = useTranslations("collaborators");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [tab, setTab] = useState<"profiles" | "bonus">("profiles");
  const [status, setStatus] = useState<CollaboratorStatus | "">("pending");
  const [label, setLabel] = useState<CollaboratorLabel | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const query = new URLSearchParams({ page: String(page), pageSize: "20", ...(status ? { status } : {}), ...(label ? { label } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { state, reload } = useApi<PageResponse<CollaboratorListItem>>(`/marketplace/collaborators?${query}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="nhom-nut" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "profiles"} className={`nut ${tab === "profiles" ? "chinh" : "phu"}`} onClick={() => setTab("profiles")}>
          {t("tabProfiles")}
        </button>
        {can("marketplace.order.view") || can("marketplace.order.manage") ? (
          <button type="button" role="tab" aria-selected={tab === "bonus"} className={`nut ${tab === "bonus" ? "chinh" : "phu"}`} onClick={() => setTab("bonus")}>
            {t("tabBonus")}
          </button>
        ) : null}
      </div>
      {tab === "bonus" ? (
        <BonusSettings />
      ) : (
        <>
          <div className="bo-loc" style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)" }}>
            <label className="an-nhan" htmlFor="ctv-tim">
              {t("search")}
            </label>
            <input
              id="ctv-tim"
              className="o-nhap"
              placeholder={t("search")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <label className="an-nhan" htmlFor="ctv-trang-thai">
              {t("status")}
            </label>
            <select
              id="ctv-trang-thai"
              className="o-nhap"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CollaboratorStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("allStatuses")}</option>
              {collaboratorStatuses.map((item) => (
                <option key={item} value={item}>
                  {t(`status_${item}`)}
                </option>
              ))}
            </select>
            <label className="an-nhan" htmlFor="ctv-nhan">
              {t("label")}
            </label>
            <select
              id="ctv-nhan"
              className="o-nhap"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value as CollaboratorLabel | "");
                setPage(1);
              }}
            >
              <option value="">{t("allLabels")}</option>
              {collaboratorLabels.map((item) => (
                <option key={item} value={item}>
                  {t(`label_${item}`)}
                </option>
              ))}
            </select>
          </div>
          <Loaded state={state} onRetry={() => void reload()}>
            {(result) =>
              result.data.length === 0 ? (
                <MessageView text={t("none")} />
              ) : (
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("buyer")}</th>
                        <th>{t("phone")}</th>
                        <th>{t("code")}</th>
                        <th>{t("label")}</th>
                        <th>{t("status")}</th>
                        <th>{t("orders")}</th>
                        <th>{t("credited")}</th>
                        <th>{t("submittedAt")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((item) => (
                        <tr key={item.userId} aria-selected={selected === item.userId}>
                          <td data-nhan={t("buyer")}>
                            <button type="button" className="nut chu" style={{ overflowWrap: "anywhere", whiteSpace: "normal", textAlign: "left" }} onClick={() => setSelected(item.userId)}>
                              {item.fullName}
                            </button>
                          </td>
                          <td data-nhan={t("phone")}>{item.phone}</td>
                          <td data-nhan={t("code")}>{item.code ?? "—"}</td>
                          <td data-nhan={t("label")}>{item.label ? t(`label_${item.label}`) : "—"}</td>
                          <td data-nhan={t("status")}>
                            <StatusBadge status={item.status} />
                          </td>
                          <td data-nhan={t("orders")}>{item.orders}</td>
                          <td data-nhan={t("credited")}>{formatNumber(item.creditedAmount, 0)}</td>
                          <td data-nhan={t("submittedAt")}>{formatDateTime(item.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="phan-trang">
                    <span>{common("total", { count: result.total })}</span>
                    <span className="nhom-nut">
                      <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        ‹ {common("previous")}
                      </button>
                      <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                        {common("next")} ›
                      </button>
                    </span>
                  </div>
                </div>
              )
            }
          </Loaded>
          {selected ? <Detail key={selected} userId={selected} onChanged={reload} /> : null}
        </>
      )}
    </>
  );
}
