"use client";

// MAN_HINH_225 Chi tiết khóa API (CHUC_NANG_217, 218; API_257, API_258, API_259).
import type { ApiKeyDetail, ApiKeySecretResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ApiCallLogTable } from "@/components/ApiCallLogTable";
import { ApiKeyDrawer, KeyStatusBadge, ScopeList, SecretDialog } from "@/components/ApiKeyForms";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "settings" | "logs" | "history";

export default function ApiKeyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("apiKeys");
  const common = useTranslations("common");
  const actions = useTranslations("auditActions");
  const { can, notify } = useAdmin();
  const { state, reload } = useApi<ApiKeyDetail>(`/platform/api-keys/${id}`);
  const [tab, setTab] = useState<Tab>("settings");
  const [panel, setPanel] = useState<"edit" | "rotate" | "revoke" | null>(null);
  const [secret, setSecret] = useState<ApiKeySecretResponse | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = can("platform.api_key.manage");

  async function act(key: ApiKeyDetail, kind: "rotate" | "revoke") {
    setBusy(true);
    setError(null);
    try {
      if (kind === "rotate") {
        setSecret(await apiFetch<ApiKeySecretResponse>(`/platform/api-keys/${key.id}/rotate`, { method: "POST", body: JSON.stringify({ version: key.version }) }));
        notify(t("rotated"));
      } else {
        await apiFetch(`/platform/api-keys/${key.id}/revoke`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), version: key.version }) });
        notify(t("revoked"));
      }
      setPanel(null);
      void reload();
    } catch (failure) {
      const detail = failureOf(failure);
      setError(Object.values(detail.fields)[0] ?? detail.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(key) => {
        const active = key.status !== "revoked";
        return (
          <>
            <div className="tieu-de">
              <h1>{key.name}</h1>
              <KeyStatusBadge status={key.status} />
            </div>
            <div className="chu-thich">
              <Link href="/platform/api-keys">‹ {t("back")}</Link> · <code>vck_{key.keyPrefix}…</code> ·{" "}
              {t("issuedBy", { name: key.createdByName ?? common("none"), time: formatDateTime(key.createdAt), version: key.version })}
            </div>
            {key.status === "revoked" && (
              <div className="khoi-canh-bao canh-bao" role="status">
                {t("revokedInfo", { time: formatDateTime(key.revokedAt), reason: key.revokedReason ?? "" })}
              </div>
            )}
            <div className="luoi-app" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div className="the">
                <span className="chu-thich">{t("calls24h")}</span>
                <span className="tong-lon">{key.stats.calls24h}</span>
                <span className="chu-thich">{t("callsDetail", { errors: key.stats.errors24h, limited: key.stats.rateLimited24h })}</span>
              </div>
              <div className="the">
                <span className="chu-thich">{t("peak")}</span>
                <span className="tong-lon">
                  {key.stats.peakPerMinute24h} / {key.rateLimitPerMinute}
                </span>
              </div>
              <div className="the">
                <span className="chu-thich">{t("lastCall")}</span>
                <strong>{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : t("never")}</strong>
                {key.stats.lastIp && <span className="chu-thich">{t("fromIp", { ip: key.stats.lastIp })}</span>}
              </div>
            </div>
            <div className="cac-the" role="tablist">
              {(["settings", "logs", "history"] as const).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : undefined} onClick={() => setTab(item)}>
                  {t(`tab_${item}`)}
                </button>
              ))}
            </div>
            {tab === "settings" && (
              <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
                <div className="the">
                  <dl className="thong-tin-dong">
                    <dt>{t("kind")}</dt>
                    <dd>{t(`kind_${key.kind}`)}</dd>
                    <dt>{t("partner")}</dt>
                    <dd>{key.partnerName ? `${key.partnerCode} · ${key.partnerName} (${key.partnerCustomerGroupName ?? t("noGroup")})` : t("internal")}</dd>
                    <dt>{t("scopes")}</dt>
                    <dd>
                      <ScopeList scopes={key.scopes} />
                    </dd>
                    <dt>{t("channelShort")}</dt>
                    <dd>{key.channelName}</dd>
                    <dt>{t("warehousesShort")}</dt>
                    <dd>{key.warehouses.map((warehouse) => `${warehouse.code} · ${warehouse.name}`).join(", ") || common("none")}</dd>
                    <dt>{t("rateLimit")}</dt>
                    <dd>{key.rateLimitPerMinute}</dd>
                    <dt>{t("expiresOn")}</dt>
                    <dd>{key.expiresOn ? formatDate(key.expiresOn) : common("none")}</dd>
                    <dt>{t("ipsShort")}</dt>
                    <dd>{key.allowedIps.join(", ") || common("none")}</dd>
                  </dl>
                  {canManage && active && (
                    <div className="nhom-nut">
                      <button type="button" className="nut chinh" onClick={() => setPanel("edit")}>
                        {t("edit")}
                      </button>
                    </div>
                  )}
                </div>
                {canManage && active && (
                  <>
                    <div className="the">
                      <h2>{t("rotateTitle")}</h2>
                      <span className="chu-thich">{t("rotateText")}</span>
                      <div className="nhom-nut">
                        <button type="button" className="nut phu" onClick={() => setPanel("rotate")}>
                          {t("rotate")}
                        </button>
                      </div>
                    </div>
                    <div className="the">
                      <h2>{t("revokeTitle")}</h2>
                      <span className="chu-thich">{t("revokeText")}</span>
                      <Field id="ly-do-thu-hoi" label={t("reason")}>
                        <textarea id="ly-do-thu-hoi" className="o-nhap" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
                      </Field>
                      <div className="nhom-nut">
                        <button type="button" className="nut nguy-hiem" disabled={!reason.trim()} onClick={() => setPanel("revoke")}>
                          {t("revoke")}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {tab === "logs" && <ApiCallLogTable apiKeyId={key.id} />}
            {tab === "history" && (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {[t("historyTime"), t("historyActor"), t("historyAction"), t("historyContent")].map((heading) => (
                        <th key={heading} scope="col">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {key.history.map((entry, index) => (
                      <tr key={index}>
                        <td data-nhan={t("historyTime")}>
                          <span>{formatDateTime(entry.occurredAt)}</span>
                        </td>
                        <td data-nhan={t("historyActor")}>
                          <span>{entry.actorName ?? common("none")}</span>
                        </td>
                        <td data-nhan={t("historyAction")}>
                          <span>{actions.has(entry.action.replaceAll(".", "_")) ? actions(entry.action.replaceAll(".", "_")) : entry.action}</span>
                        </td>
                        <td data-nhan={t("historyContent")}>
                          <span style={{ wordBreak: "break-word" }}>{entry.afterData ? JSON.stringify(entry.afterData) : common("none")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {panel === "edit" && (
              <ApiKeyDrawer
                editing={key}
                onClose={() => setPanel(null)}
                onSaved={() => {
                  setPanel(null);
                  notify(t("saved"));
                  void reload();
                }}
              />
            )}
            {(panel === "rotate" || panel === "revoke") && (
              <ConfirmDialog
                title={panel === "rotate" ? t("rotateTitle") : t("revokeTitle")}
                text={panel === "rotate" ? t("rotateText") : t("revokeText")}
                confirmLabel={panel === "rotate" ? t("rotate") : t("revoke")}
                busy={busy}
                error={error}
                onConfirm={() => void act(key, panel)}
                onClose={() => {
                  setPanel(null);
                  setError(null);
                }}
              />
            )}
            {secret && <SecretDialog result={secret} onClose={() => setSecret(null)} />}
          </>
        );
      }}
    </Loaded>
  );
}
