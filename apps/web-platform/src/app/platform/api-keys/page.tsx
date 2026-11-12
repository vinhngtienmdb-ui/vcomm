"use client";

// MAN_HINH_224 Khóa API đối tác (CHUC_NANG_217; API_255, API_256).
import type { ApiKeyItem, ApiKeySecretResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ApiKeyDrawer, KeyStatusBadge, ScopeList, SecretDialog } from "@/components/ApiKeyForms";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function ApiKeysPage() {
  const t = useTranslations("apiKeys");
  const common = useTranslations("common");
  const { can, notify } = useAdmin();
  const [filters, setFilters] = useState({ q: "", status: "", kind: "" });
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<ApiKeySecretResponse | null>(null);
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) parameters.set(key, value);
  const { state, reload } = useApi<ApiKeyItem[]>(`/platform/api-keys?${parameters}`);
  const filtered = Object.values(filters).some(Boolean);
  const headings = [t("name"), t("partner"), t("prefix"), t("scopes"), t("rateLimit"), t("expiresOn"), t("lastUsed"), t("status")];
  const canManage = can("platform.api_key.manage");

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {canManage && (
          <button type="button" className="nut chinh" onClick={() => setAdding(true)}>
            {t("add")}
          </button>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-khoa">
          {t("search")}
        </label>
        <input id="tim-khoa" className="o-nhap" placeholder={t("search")} value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {(["active", "expired", "revoked"] as const).map((status) => (
            <option key={status} value={status}>
              {t(`status_${status}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-loai">
          {t("kind")}
        </label>
        <select id="loc-loai" className="o-nhap" value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })}>
          <option value="">{`${t("kind")}: ${common("all")}`}</option>
          {(["partner", "internal"] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`kind_${kind}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(keys) =>
          keys.length === 0 ? (
            <MessageView text={filtered ? common("noResult") : t("empty")} />
          ) : (
            <div className="khung-bang">
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
                  {keys.map((key) => (
                    <tr key={key.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/platform/api-keys/${key.id}`}>{key.name}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{key.partnerName ? `${key.partnerCode} · ${key.partnerName}` : <span className="chu-thich">{t("internal")}</span>}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <code>vck_{key.keyPrefix}…</code>
                      </td>
                      <td data-nhan={headings[3]}>
                        <ScopeList scopes={key.scopes} />
                      </td>
                      <td data-nhan={headings[4]} className="so-tien">
                        <span>{key.rateLimitPerMinute}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{key.expiresOn ? formatDate(key.expiresOn) : common("none")}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : t("never")}</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <KeyStatusBadge status={key.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {adding && (
        <ApiKeyDrawer
          editing={null}
          onClose={() => setAdding(false)}
          onSaved={(result) => {
            setAdding(false);
            setSecret(result as ApiKeySecretResponse);
            notify(t("issued"));
            void reload();
          }}
        />
      )}
      {secret && <SecretDialog result={secret} onClose={() => setSecret(null)} />}
    </>
  );
}
