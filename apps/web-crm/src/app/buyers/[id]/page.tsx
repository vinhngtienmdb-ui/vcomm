"use client";

// MAN_HINH_80 Chi tiết tài khoản người mua (CHUC_NANG_107, 108; API_119; QUYTAC_NGHIEPVU_143 đến 145):
// người giới thiệu, đổi người giới thiệu có lý do, lịch sử; người được giới thiệu; đánh dấu, bỏ đánh dấu nhân viên kinh doanh.
import type { BuyerAccountDetailResponse, MarketplaceSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: "var(--khoang-3)" }}>
      <span className="chu-thich">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function ReferrerForm({ buyer, onSaved }: { buyer: BuyerAccountDetailResponse; onSaved: (saved: BuyerAccountDetailResponse) => void }) {
  const t = useTranslations("buyers");
  const { notify } = useAdmin();
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const saved = await apiFetch<BuyerAccountDetailResponse>(`/marketplace/buyers/${buyer.id}/referrer`, {
        method: "POST",
        body: JSON.stringify({ referralCode: code.trim() || null, reason, version: buyer.version }),
      });
      notify(t("referrerChanged"));
      setCode("");
      setReason("");
      onSaved(saved);
    });
  }
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <Field id="nm-ma-moi" label={t("newReferrerCode")} hint={t("newReferrerHint")} error={fields.referralCode}>
        <input id="nm-ma-moi" className={inputClass("referralCode")} inputMode="tel" maxLength={15} value={code} onChange={(event) => setCode(event.target.value)} />
      </Field>
      <Field id="nm-ly-do" label={`${t("reason")} *`} error={fields.reason}>
        <textarea id="nm-ly-do" className={inputClass("reason")} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className="nut chinh" disabled={submitting}>
          {t("changeReferrer")}
        </button>
      </div>
    </form>
  );
}

function SalesFlag({ buyer, settings, onSaved }: { buyer: BuyerAccountDetailResponse; settings: MarketplaceSettingsResponse; onSaved: (saved: BuyerAccountDetailResponse) => void }) {
  const t = useTranslations("buyers");
  const team = useTranslations("salesTeam");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [departmentId, setDepartmentId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(method: "POST" | "DELETE", body: object, message: string) {
    setBusy(true);
    setError(null);
    try {
      const saved = await apiFetch<BuyerAccountDetailResponse>(`/marketplace/buyers/${buyer.id}/sales-flag`, { method, body: JSON.stringify(body) });
      notify(message);
      setConfirming(false);
      onSaved(saved);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  if (buyer.isSalesStaff)
    return (
      <>
        <span>{t("salesYes", { department: buyer.salesDepartmentName ?? "—" })}</span>
        {buyer.salesTitle && (
          <span>
            {team("salesTitle")}: <strong>{team(`title_${buyer.salesTitle}`)}</strong>
          </span>
        )}
        <span className="chu-thich">
          {team("chain")}: {buyer.salesChain.length === 0 ? team("noChain") : buyer.salesChain.map((item) => `${item.fullName} (${team(`title_${item.title}`)})`).join(" › ")}
        </span>
        {settings.canManage && (
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setConfirming(true)}>
              {t("unflag")}
            </button>
          </div>
        )}
        {confirming && (
          <ConfirmDialog
            title={t("unflag")}
            text={t("unflagConfirm", { name: buyer.fullName })}
            confirmLabel={t("unflag")}
            busy={busy}
            error={error}
            onConfirm={() => void act("DELETE", { version: buyer.version }, t("unflagged"))}
            onClose={() => setConfirming(false)}
          />
        )}
      </>
    );
  return (
    <>
      <span className="chu-thich">{t("salesNo")}</span>
      {settings.canManage &&
        (settings.departments.length === 0 ? (
          <div className="khoi-canh-bao canh-bao">{t("noDepartments")}</div>
        ) : buyer.status === "active" ? (
          <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <label htmlFor="nm-phong">{t("department")}</label>
            <select id="nm-phong" className="o-nhap" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">{t("chooseDepartment")}</option>
              {settings.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name} ({team(`type_${department.type}`)})
                </option>
              ))}
            </select>
            <FormError text={error} />
            <div className="nhom-nut">
              <button type="button" className="nut chinh" disabled={!departmentId || busy} onClick={() => void act("POST", { departmentId, version: buyer.version }, t("flagged"))}>
                {t("flag")}
              </button>
            </div>
          </div>
        ) : (
          <span className="chu-thich">{common("noResult")}</span>
        ))}
    </>
  );
}

export default function BuyerPage() {
  const t = useTranslations("buyers");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<BuyerAccountDetailResponse>(`/marketplace/buyers/${id}`);
  const settings = useApi<MarketplaceSettingsResponse>("/marketplace/settings");
  const [saved, setSaved] = useState<BuyerAccountDetailResponse | null>(null);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(loaded) => {
        const buyer = saved?.id === loaded.id && saved.version >= loaded.version ? saved : loaded;
        const canManage = settings.state.kind === "ready" && settings.state.data.canManage;
        return (
          <>
            <div className="chu-thich">
              <Link href="/buyers">‹ {t("back")}</Link>
            </div>
            <div className="tieu-de">
              <h1>{buyer.fullName}</h1>
            </div>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <Row label={t("phone")}>{buyer.phone}</Row>
              <Row label={t("status")}>{t(`status_${buyer.status}`)}</Row>
              <Row label={t("registeredAt")}>{formatDateTime(buyer.registeredAt)}</Row>
              <Row label={t("referrer")}>{buyer.referrerName ? `${buyer.referrerName} · ${buyer.referrerPhone}` : t("noReferrer")}</Row>
            </div>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h2>{t("salesTitle")}</h2>
              {settings.state.kind === "ready" && <SalesFlag buyer={buyer} settings={settings.state.data} onSaved={setSaved} />}
            </div>
            {canManage && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                <h2>{t("changeReferrer")}</h2>
                <ReferrerForm buyer={buyer} onSaved={setSaved} />
              </div>
            )}
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h2>{t("referrerHistory")}</h2>
              {buyer.referrerHistory.length === 0 ? (
                <span className="chu-thich">{t("historyNone")}</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)", display: "grid", gap: "var(--khoang-2)" }}>
                  {buyer.referrerHistory.map((item, index) => (
                    <li key={index}>
                      <span>
                        {item.previousReferrerName ?? t("noReferrer")} → {item.newReferrerName ?? t("noReferrer")} · {t(`source_${item.source}`)}
                      </span>
                      {item.reason && <div>{item.reason}</div>}
                      <div className="chu-thich">
                        {formatDateTime(item.changedAt)} · {t("by", { name: item.changedByName })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h2>{t("flagHistory")}</h2>
              {buyer.salesFlagHistory.length === 0 ? (
                <span className="chu-thich">{t("historyNone")}</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)", display: "grid", gap: "var(--khoang-2)" }}>
                  {buyer.salesFlagHistory.map((item, index) => (
                    <li key={index}>
                      <span>
                        {t(`action_${item.action}`)}
                        {item.departmentName ? ` · ${item.departmentName}` : ""}
                        {item.proposalId ? (
                          <>
                            {" · "}
                            <Link href="/sales-proposals?status=approved">{t("byProposal")}</Link>
                          </>
                        ) : null}
                      </span>
                      <div className="chu-thich">
                        {formatDateTime(item.changedAt)} · {t("by", { name: item.changedByName })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h2>{t("referralsTitle", { count: buyer.referrals.length })}</h2>
              {buyer.referrals.length === 0 ? (
                <span className="chu-thich">{t("noReferrals")}</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)" }}>
                  {buyer.referrals.map((item) => (
                    <li key={item.id}>
                      <Link href={`/buyers/${item.id}`}>{item.fullName}</Link> · {item.phone} · <span className="chu-thich">{formatDateTime(item.registeredAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        );
      }}
    </Loaded>
  );
}
