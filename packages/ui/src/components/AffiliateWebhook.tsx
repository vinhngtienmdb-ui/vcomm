"use client";

// Khối "Webhook" của khóa API cửa hàng liên kết (CONG_VIEC_73 lát L7; QUYTAC_NGHIEPVU_591; API_331): MAN_HINH_231 (web quản trị) và MAN_HINH_232 (cổng cửa hàng).
// Địa chỉ HTTPS, khóa ký (cấp, cấp lại hiện một lần), gửi thử, nhật ký gửi, gửi lại. Nơi dùng truyền gốc đường dẫn và hàm gọi API của ứng dụng.
import type { AffiliateApiKeyItem, AffiliateWebhookDelivery, AffiliateWebhookRequest, AffiliateWebhookSecret } from "contracts";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "../lib/format";
import { Field, FormError, useSubmit } from "./Form";

type Fetcher = <T>(path: string, init?: RequestInit) => Promise<T>;

const deliveryClass = { pending: "canh-bao", succeeded: "thanh-cong", failed: "loi" } as const;

export function AffiliateWebhook({
  apiKey,
  basePath,
  fetcher,
  canManage,
  onSaved,
}: {
  apiKey: AffiliateApiKeyItem;
  // "/affiliate" (web quản trị) hoặc "/merchant-portal" (cổng cửa hàng).
  basePath: string;
  fetcher: Fetcher;
  canManage: boolean;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("affiliateWebhook");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [url, setUrl] = useState(apiKey.webhook.url ?? "");
  const [version, setVersion] = useState(apiKey.webhook.version);
  const [secret, setSecret] = useState<AffiliateWebhookSecret | null>(null);
  const [deliveries, setDeliveries] = useState<AffiliateWebhookDelivery[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadDeliveries = useCallback(async () => {
    try {
      setDeliveries(await fetcher<AffiliateWebhookDelivery[]>(`${basePath}/api-keys/${apiKey.id}/webhook/deliveries`));
    } catch {
      setDeliveries([]);
    }
  }, [apiKey.id, basePath, fetcher]);
  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);
  const act = async (key: string, call: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await call();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h3 style={{ margin: 0 }}>{t("title", { name: apiKey.name })}</h3>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("hint")}
      </p>
      <form
        style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)", alignItems: "end" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const body: AffiliateWebhookRequest = { url: url.trim() || null, version };
            const saved = await fetcher<{ version: number }>(`${basePath}/api-keys/${apiKey.id}/webhook`, { method: "PUT", body: JSON.stringify(body) });
            setVersion(saved.version);
            onSaved(t("saved"));
          });
        }}
      >
        <Field id={`webhook-${apiKey.id}`} label={t("url")} error={fields.url}>
          <input
            id={`webhook-${apiKey.id}`}
            className={inputClass("url")}
            placeholder="https://"
            disabled={!canManage}
            value={url}
            maxLength={500}
            onChange={(event) => setUrl(event.target.value)}
            style={{ minWidth: "22rem" }}
          />
        </Field>
        {canManage && (
          <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("saveUrl")}
          </button>
        )}
      </form>
      <FormError text={formError} />
      <p style={{ margin: 0 }}>
        {t("secret")}:{" "}
        {apiKey.webhook.secretSet || secret ? (
          <span className="nhan thanh-cong">{t("secretSet", { time: formatDateTime(secret?.secretAt ?? apiKey.webhook.secretAt ?? "") })}</span>
        ) : (
          <span className="nhan canh-bao">{t("secretMissing")}</span>
        )}
      </p>
      {secret && (
        <div className="khoi-canh-bao canh-bao" role="alert">
          <p style={{ margin: "0 0 var(--khoang-2)" }}>{t("secretOnce")}</p>
          <input className="o-nhap" readOnly value={secret.secret} onFocus={(event) => event.target.select()} style={{ fontFamily: "monospace" }} aria-label={t("secret")} />
        </div>
      )}
      {canManage && (
        <div className="nhom-nut">
          <button
            type="button"
            className={`nut phu${busy === "secret" ? " dang-xu-ly" : ""}`}
            disabled={busy !== null}
            onClick={() =>
              void act("secret", async () => {
                setSecret(await fetcher<AffiliateWebhookSecret>(`${basePath}/api-keys/${apiKey.id}/webhook/rotate-secret`, { method: "POST" }));
              })
            }
          >
            {apiKey.webhook.secretSet || secret ? t("rotate") : t("issue")}
          </button>
          <button
            type="button"
            className={`nut phu${busy === "test" ? " dang-xu-ly" : ""}`}
            disabled={busy !== null || !url.trim()}
            onClick={() =>
              void act("test", async () => {
                const result = await fetcher<AffiliateWebhookDelivery>(`${basePath}/api-keys/${apiKey.id}/webhook/test`, { method: "POST" });
                onSaved(result.status === "succeeded" ? t("testSucceeded") : t("testFailed", { error: result.lastError ?? "" }));
                await loadDeliveries();
              })
            }
          >
            {t("test")}
          </button>
        </div>
      )}
      <FormError text={error} />
      <h4 style={{ margin: 0 }}>{t("deliveries")}</h4>
      {deliveries === null ? null : deliveries.length === 0 ? (
        <p className="chu-thich" style={{ margin: 0 }}>
          {t("noDeliveries")}
        </p>
      ) : (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                <th scope="col">{t("column_time")}</th>
                <th scope="col">{t("column_event")}</th>
                <th scope="col">{t("column_status")}</th>
                <th scope="col">{t("column_attempts")}</th>
                <th scope="col">{t("column_result")}</th>
                {canManage && <th scope="col" />}
              </tr>
            </thead>
            <tbody>
              {deliveries.map((item) => (
                <tr key={item.id}>
                  <td data-nhan={t("column_time")}>{formatDateTime(item.createdAt)}</td>
                  <td data-nhan={t("column_event")}>
                    <code>{item.eventType}</code>
                  </td>
                  <td data-nhan={t("column_status")}>
                    <span className={`nhan ${deliveryClass[item.status]}`}>{t(`status_${item.status}`)}</span>
                    {item.nextAttemptAt && <div className="chu-thich">{t("nextAttempt", { time: formatDateTime(item.nextAttemptAt) })}</div>}
                  </td>
                  <td data-nhan={t("column_attempts")}>{item.attemptCount}</td>
                  <td data-nhan={t("column_result")}>{item.lastError ?? (item.lastStatusCode ? `HTTP ${item.lastStatusCode}` : "—")}</td>
                  {canManage && (
                    <td>
                      <button
                        type="button"
                        className={`nut phu${busy === item.id ? " dang-xu-ly" : ""}`}
                        disabled={busy !== null}
                        onClick={() =>
                          void act(item.id, async () => {
                            await fetcher<AffiliateWebhookDelivery>(`${basePath}/webhook-deliveries/${item.id}/resend`, { method: "POST" });
                            await loadDeliveries();
                          })
                        }
                      >
                        {t("resend")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
