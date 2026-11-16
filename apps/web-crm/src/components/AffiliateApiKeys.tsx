"use client";

// MAN_HINH_231 Kết nối phần mềm của cửa hàng liên kết (CONG_VIEC_67; CHUC_NANG_234; QUYTAC_NGHIEPVU_495; API_295).
// Khóa chỉ hiện một lần khi cấp, cấp lại; danh sách chỉ có 8 ký tự đầu.
import type { AffiliateApiKeyItem, AffiliateApiKeySecret, AffiliateOutlet } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const statusClass = { active: "thanh-cong", expired: "canh-bao", revoked: "trung-tinh" } as const;

function KeyDrawer({
  merchantId,
  outlets,
  editing,
  onClose,
  onSaved,
}: {
  merchantId: string;
  outlets: AffiliateOutlet[];
  editing: AffiliateApiKeyItem | null;
  onClose: () => void;
  onSaved: (result: AffiliateApiKeySecret | null) => void;
}) {
  const t = useTranslations("affiliate");
  const keys = useTranslations("apiKeys");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [name, setName] = useState(editing?.name ?? "");
  const [outletIds, setOutletIds] = useState<string[]>(editing?.outlets.map((outlet) => outlet.id) ?? outlets.filter((outlet) => outlet.status === "active").map((outlet) => outlet.id));
  const [rate, setRate] = useState(String(editing?.rateLimitPerMinute ?? 60));
  const [sms, setSms] = useState(String(editing?.smsDailyLimit ?? 200));
  const [expiresOn, setExpiresOn] = useState(editing?.expiresOn ?? "");
  const [ips, setIps] = useState(editing?.allowedIps.join("\n") ?? "");
  return (
    <Drawer title={editing ? t("apiKeyEdit") : t("apiKeyIssue")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const body = {
              name,
              outletIds,
              rateLimitPerMinute: Number(rate),
              smsDailyLimit: Number(sms),
              expiresOn: expiresOn || null,
              allowedIps: ips
                .split(/\s+/)
                .map((entry) => entry.trim())
                .filter(Boolean),
            };
            if (editing) {
              await apiFetch(`/affiliate/api-keys/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...body, version: editing.version }) });
              onSaved(null);
            } else onSaved(await apiFetch<AffiliateApiKeySecret>(`/affiliate/merchants/${merchantId}/api-keys`, { method: "POST", body: JSON.stringify(body) }));
          });
        }}
      >
        <Field id="ten-khoa" label={keys("nameField")} error={fields.name}>
          <input id="ten-khoa" className={inputClass("name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </Field>
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13 }}>{t("apiKeyOutlets")}</legend>
          {outlets
            .filter((outlet) => outlet.status === "active" || outletIds.includes(outlet.id))
            .map((outlet) => (
              <label key={outlet.id} style={{ display: "block" }}>
                <input
                  type="checkbox"
                  checked={outletIds.includes(outlet.id)}
                  onChange={(event) => setOutletIds((current) => (event.target.checked ? [...current, outlet.id] : current.filter((id) => id !== outlet.id)))}
                />{" "}
                {outlet.name}
              </label>
            ))}
          {fields.outletIds && <span className="loi">{fields.outletIds}</span>}
        </fieldset>
        <Field id="gioi-han-phut" label={keys("rateField")} error={fields.rateLimitPerMinute}>
          <input id="gioi-han-phut" className={inputClass("rateLimitPerMinute")} inputMode="numeric" value={rate} onChange={(event) => setRate(event.target.value)} />
        </Field>
        <Field id="tin-sms" label={t("apiKeySms")} error={fields.smsDailyLimit}>
          <input id="tin-sms" className={inputClass("smsDailyLimit")} inputMode="numeric" value={sms} onChange={(event) => setSms(event.target.value)} />
        </Field>
        <Field id="han-dung" label={keys("expiresField")} error={fields.expiresOn}>
          <input id="han-dung" type="date" className={inputClass("expiresOn")} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
        </Field>
        <Field id="ip-duoc-phep" label={keys("ips")} error={fields.allowedIps}>
          <textarea id="ip-duoc-phep" className={inputClass("allowedIps")} rows={3} value={ips} onChange={(event) => setIps(event.target.value)} />
        </Field>
        <div className="khoi-canh-bao thong-tin">{t("apiKeyScopeHint")}</div>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || outletIds.length === 0}>
            {editing ? t("save") : t("apiKeyIssue")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function SecretDialog({ result, onClose }: { result: AffiliateApiKeySecret; onClose: () => void }) {
  const t = useTranslations("affiliate");
  const keys = useTranslations("apiKeys");
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="man-che giua">
      <div className="hop-thoai" role="dialog" aria-modal="true" aria-label={keys("secretTitle", { name: result.key.name })}>
        <h2>{keys("secretTitle", { name: result.key.name })}</h2>
        <div className="khoi-canh-bao canh-bao" role="alert">
          {keys("secretWarning")}
        </div>
        <Field id="khoa-moi" label={keys("secretLabel")}>
          <input id="khoa-moi" className="o-nhap" readOnly value={result.secret} onFocus={(event) => event.target.select()} style={{ fontFamily: "monospace" }} />
        </Field>
        <span className="chu-thich">{t("apiKeySecretUsage", { header: "Authorization: Bearer …", url: `${origin}/api/v1/open/affiliate/` })}</span>
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut chinh" onClick={() => void navigator.clipboard?.writeText(result.secret).then(() => setCopied(true))}>
            {copied ? keys("copied") : keys("copy")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {keys("savedClose")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RevokeDrawer({ apiKey, onClose, onDone }: { apiKey: AffiliateApiKeyItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("affiliate");
  const keys = useTranslations("apiKeys");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  return (
    <Drawer title={`${keys("revokeTitle")} · ${apiKey.name}`} onClose={onClose}>
      <Field id="ly-do-thu-hoi" label={keys("reason")} error={fields.reason}>
        <textarea id="ly-do-thu-hoi" className={inputClass("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <p className="chu-thich">{t("apiKeyRevokeText")}</p>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || !reason.trim()}
          onClick={() =>
            void run(async () => {
              await apiFetch(`/affiliate/api-keys/${apiKey.id}/revoke`, { method: "POST", body: JSON.stringify({ reason, version: apiKey.version }) });
              onDone();
            })
          }
        >
          {keys("revoke")}
        </button>
      </div>
    </Drawer>
  );
}

export function AffiliateApiKeys({
  merchantId,
  outlets,
  canManage,
  terminated,
  notify,
}: {
  merchantId: string;
  outlets: AffiliateOutlet[];
  canManage: boolean;
  terminated: boolean;
  notify: (message: string) => void;
}) {
  const t = useTranslations("affiliate");
  const keys = useTranslations("apiKeys");
  const { state, reload } = useApi<AffiliateApiKeyItem[]>(`/affiliate/merchants/${merchantId}/api-keys`);
  const [editing, setEditing] = useState<AffiliateApiKeyItem | "new" | null>(null);
  const [secret, setSecret] = useState<AffiliateApiKeySecret | null>(null);
  const [revoking, setRevoking] = useState<AffiliateApiKeyItem | null>(null);
  const [rotating, setRotating] = useState<AffiliateApiKeyItem | null>(null);
  const rotate = useSubmit();
  const refresh = (message: string) => {
    notify(message);
    void reload();
  };
  return (
    <section className="the">
      <div className="tieu-de">
        <h2>{t("connectionTitle")}</h2>
        {canManage && !terminated && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("apiKeyIssue")}
          </button>
        )}
      </div>
      <p className="chu-thich">{t("connectionHint")}</p>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <p>{t("connectionEmpty")}</p>
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{keys("name")}</th>
                    <th>{keys("prefix")}</th>
                    <th>{t("apiKeyOutlets")}</th>
                    <th className="so">{keys("rateLimit")}</th>
                    <th className="so">{t("apiKeySmsShort")}</th>
                    <th>{keys("expiresOn")}</th>
                    <th>{keys("lastUsed")}</th>
                    <th>{keys("status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={keys("name")}>{item.name}</td>
                      <td data-nhan={keys("prefix")}>
                        <code>vck_{item.keyPrefix}…</code>
                      </td>
                      <td data-nhan={t("apiKeyOutlets")}>{item.outlets.map((outlet) => outlet.name).join(", ")}</td>
                      <td data-nhan={keys("rateLimit")} className="so">
                        {item.rateLimitPerMinute}
                      </td>
                      <td data-nhan={t("apiKeySmsShort")} className="so">
                        {item.smsDailyLimit} <span className="chu-thich">({t("apiKeySmsToday", { count: item.smsToday })})</span>
                      </td>
                      <td data-nhan={keys("expiresOn")}>{item.expiresOn ? formatDate(item.expiresOn) : "—"}</td>
                      <td data-nhan={keys("lastUsed")}>{item.lastUsedAt ? formatDateTime(item.lastUsedAt) : keys("never")}</td>
                      <td data-nhan={keys("status")}>
                        <span className={`nhan ${statusClass[item.status]}`}>{keys(`status_${item.status}`)}</span>
                        {item.revokedReason && <div className="chu-thich">{item.revokedReason}</div>}
                      </td>
                      <td data-nhan="">
                        {canManage && item.status !== "revoked" && (
                          <span className="nhom-nut">
                            <button type="button" className="nut phu" onClick={() => setEditing(item)}>
                              {t("edit")}
                            </button>
                            <button type="button" className="nut phu" onClick={() => setRotating(item)}>
                              {keys("rotate")}
                            </button>
                            <button type="button" className="nut nguy-hiem" onClick={() => setRevoking(item)}>
                              {keys("revoke")}
                            </button>
                          </span>
                        )}{" "}
                        <a href="/platform/api-call-logs">{t("apiKeyLogs")}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {editing && (
        <KeyDrawer
          merchantId={merchantId}
          outlets={outlets}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null);
            if (result) setSecret(result);
            refresh(result ? keys("issued") : keys("saved"));
          }}
        />
      )}
      {secret && <SecretDialog result={secret} onClose={() => setSecret(null)} />}
      {revoking && (
        <RevokeDrawer
          apiKey={revoking}
          onClose={() => setRevoking(null)}
          onDone={() => {
            setRevoking(null);
            refresh(keys("revoked"));
          }}
        />
      )}
      {rotating && (
        <ConfirmDialog
          title={`${keys("rotateTitle")} · ${rotating.name}`}
          text={keys("rotateText")}
          confirmLabel={keys("rotate")}
          busy={rotate.submitting}
          error={rotate.formError}
          onClose={() => setRotating(null)}
          onConfirm={() =>
            void rotate.run(async () => {
              const result = await apiFetch<AffiliateApiKeySecret>(`/affiliate/api-keys/${rotating.id}/rotate`, { method: "POST", body: JSON.stringify({ version: rotating.version }) });
              setRotating(null);
              setSecret(result);
              refresh(keys("rotated"));
            })
          }
        />
      )}
    </section>
  );
}
