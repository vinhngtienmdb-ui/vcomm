"use client";

// Biểu mẫu cấp, sửa khóa API và hộp hiện khóa một lần (MAN_HINH_224, 225; CHUC_NANG_217; QUYTAC_NGHIEPVU_480, 482).
import { apiKeyScopes, type ApiKeyDetail, type ApiKeyOptions, type ApiKeyScope, type ApiKeySecretResponse, type ApiKeyStatus } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

// Phạm vi khách hàng, điểm thưởng làm ở lát L3, L4: chưa cho chọn.
export const availableScopes: ApiKeyScope[] = ["catalog.read", "sales_order.write"];
const scopeKey = (scope: ApiKeyScope) => scope.replace(".", "_") as "catalog_read" | "sales_order_write" | "customer_write" | "loyalty_member";

export function ScopeList({ scopes }: { scopes: ApiKeyScope[] }) {
  const t = useTranslations("apiKeys");
  return <span>{scopes.map((scope) => t(`scopeShort_${scopeKey(scope)}`)).join(" · ")}</span>;
}

export function KeyStatusBadge({ status }: { status: ApiKeyStatus }) {
  const t = useTranslations("apiKeys");
  const tone = status === "active" ? "thanh-cong" : status === "expired" ? "canh-bao" : "trung-tinh";
  return <span className={`nhan ${tone}`}>{t(`status_${status}`)}</span>;
}

export function ApiKeyDrawer({ editing, onClose, onSaved }: { editing: ApiKeyDetail | null; onClose: () => void; onSaved: (result: ApiKeySecretResponse | ApiKeyDetail) => void }) {
  const t = useTranslations("apiKeys");
  const common = useTranslations("common");
  const [partnerSearch, setPartnerSearch] = useState("");
  const options = useApi<ApiKeyOptions>(`/platform/api-keys/options?partnerSearch=${encodeURIComponent(partnerSearch)}`);
  const ready = options.state.kind === "ready" ? options.state.data : null;
  const [kind, setKind] = useState<"partner" | "internal">(editing?.kind ?? "partner");
  const [partnerId, setPartnerId] = useState(editing?.partnerId ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [channelId, setChannelId] = useState(editing?.channelId ?? "");
  const [expiresOn, setExpiresOn] = useState(editing?.expiresOn ?? "");
  const [rate, setRate] = useState(String(editing?.rateLimitPerMinute ?? 60));
  const [scopes, setScopes] = useState<ApiKeyScope[]>(editing?.scopes ?? ["catalog.read"]);
  const [warehouseIds, setWarehouseIds] = useState<string[]>(editing?.warehouses.map((warehouse) => warehouse.id) ?? []);
  const [ips, setIps] = useState(editing?.allowedIps.join("\n") ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const chosenChannel = channelId || ready?.channels[0]?.id || "";
  const partner = ready?.partners.find((item) => item.id === partnerId);
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const settings = {
        name: name.trim(),
        scopes,
        channelId: chosenChannel,
        warehouseIds,
        rateLimitPerMinute: Number(rate),
        expiresOn: expiresOn || null,
        allowedIps: ips
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const result = editing
        ? await apiFetch<ApiKeyDetail>(`/platform/api-keys/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...settings, version: editing.version }) })
        : await apiFetch<ApiKeySecretResponse>("/platform/api-keys", { method: "POST", body: JSON.stringify({ kind, partnerId: kind === "partner" ? partnerId || null : null, ...settings }) });
      onSaved(result);
    });
  }

  return (
    <Drawer title={editing ? t("tab_settings") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {!editing && (
          <>
            <Field id="loai-khoa" label={t("kind")} error={fields.kind}>
              <select id="loai-khoa" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as "partner" | "internal")}>
                <option value="partner">{t("kind_partner")}</option>
                <option value="internal">{t("kind_internal")}</option>
              </select>
            </Field>
            {kind === "partner" && (
              <>
                <Field id="tim-doi-tac" label={t("partnerSearch")}>
                  <input id="tim-doi-tac" className="o-nhap" value={partnerSearch} onChange={(event) => setPartnerSearch(event.target.value)} />
                </Field>
                <Field id="doi-tac" label={t("partnerField")} error={fields.partnerId}>
                  <select id="doi-tac" className={inputClass("partnerId")} value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
                    <option value="">{t("choosePartner")}</option>
                    {ready?.partners.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {partner && (
                  <div className="khoi-canh-bao thong-tin" role="status">
                    {t("groupHint", { group: partner.customerGroupName ?? t("noGroup") })}
                  </div>
                )}
              </>
            )}
          </>
        )}
        {editing?.partnerName && (
          <div className="khoi-canh-bao thong-tin" role="status">
            {editing.partnerCode} · {editing.partnerName} — {t("groupHint", { group: editing.partnerCustomerGroupName ?? t("noGroup") })}
          </div>
        )}
        <Field id="ten-khoa" label={t("nameField")} error={fields.name}>
          <input id="ten-khoa" className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="kenh-ban" label={t("channel")} error={fields.channelId}>
          <select id="kenh-ban" className={inputClass("channelId")} value={chosenChannel} onChange={(event) => setChannelId(event.target.value)}>
            {ready?.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.code} · {channel.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="han-dung" label={t("expiresField")} error={fields.expiresOn}>
          <input id="han-dung" type="date" className={inputClass("expiresOn")} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
        </Field>
        <Field id="gioi-han" label={t("rateField")} error={fields.rateLimitPerMinute}>
          <input id="gioi-han" className={inputClass("rateLimitPerMinute")} inputMode="numeric" value={rate} onChange={(event) => setRate(event.target.value.replace(/\D/g, ""))} />
        </Field>
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{t("scopes")}</legend>
          {apiKeyScopes.map((scope) => {
            const usable = availableScopes.includes(scope);
            return (
              <label key={scope} style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
                <input type="checkbox" disabled={!usable} checked={scopes.includes(scope)} onChange={() => setScopes(toggle(scopes, scope))} />
                <span>
                  {t(`scope_${scopeKey(scope)}`)}
                  {!usable && <span className="chu-thich"> — {t("scopeLater")}</span>}
                </span>
              </label>
            );
          })}
          {fields.scopes && <span className="loi-o">{fields.scopes}</span>}
        </fieldset>
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{t("warehouses")}</legend>
          {ready?.warehouses.map((warehouse) => (
            <label key={warehouse.id} style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
              <input type="checkbox" checked={warehouseIds.includes(warehouse.id)} onChange={() => setWarehouseIds(toggle(warehouseIds, warehouse.id))} />
              <span>
                {warehouse.code} · {warehouse.name}
              </span>
            </label>
          ))}
          {fields.warehouseIds && <span className="loi-o">{fields.warehouseIds}</span>}
        </fieldset>
        <Field id="dia-chi-ip" label={t("ips")} error={fields.allowedIps}>
          <textarea id="dia-chi-ip" className={inputClass("allowedIps")} rows={3} value={ips} onChange={(event) => setIps(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !name.trim() || scopes.length === 0}>
            {editing ? common("save") : t("issue")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Khóa chỉ hiện một lần; đóng hộp thì không xem lại được (QUYTAC_NGHIEPVU_480).
export function SecretDialog({ result, onClose }: { result: ApiKeySecretResponse; onClose: () => void }) {
  const t = useTranslations("apiKeys");
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="man-che giua">
      <div className="hop-thoai" role="dialog" aria-modal="true" aria-label={t("secretTitle", { name: result.key.name })}>
        <h2>{t("secretTitle", { name: result.key.name })}</h2>
        <div className="khoi-canh-bao canh-bao" role="alert">
          {t("secretWarning")}
        </div>
        <Field id="khoa-moi" label={t("secretLabel")}>
          <input id="khoa-moi" className="o-nhap" readOnly value={result.secret} onFocus={(event) => event.target.select()} style={{ fontFamily: "monospace" }} />
        </Field>
        <span className="chu-thich">{t("secretUsage", { header: "Authorization: Bearer …", url: `${origin}/api/v1/open/` })}</span>
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="nut chinh"
            onClick={() => {
              void navigator.clipboard?.writeText(result.secret).then(() => setCopied(true));
            }}
          >
            {copied ? t("copied") : t("copy")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {t("savedClose")}
          </button>
        </div>
      </div>
    </div>
  );
}
