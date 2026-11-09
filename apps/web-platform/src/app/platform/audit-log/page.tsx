"use client";

// MAN_HINH_18 Nhật ký thao tác (CHUC_NANG_23; API_47). Chỉ xem: không có nút sửa, xóa.
import type { AuditEventDetail, AuditEventItem, HomeResponse, PageResponse, UserListItem } from "contracts";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const entityTypes = ["user", "company", "branch", "department", "role", "role_assignment", "approval_policy", "approval_request", "exchange_rate", "number_sequence", "proposal_template", "proposal", "category", "unit", "product", "channel", "customer_group", "price_list", "price_change", "warehouse", "location", "inventory_settings", "integration_settings", "core.users", "core.sessions"];

function useLabels() {
  const t = useTranslations("audit");
  const actions = useTranslations("auditActions");
  const actionLabel = (action: string) => {
    const key = action.replaceAll(".", "_");
    return actions.has(key) ? actions(key) : action;
  };
  const entityLabel = (type: string) => {
    const key = `entity_${type.replaceAll(".", "_")}`;
    return t.has(key) ? t(key) : type;
  };
  return { actionLabel, entityLabel };
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <AuditLog />
    </Suspense>
  );
}

function AuditLog() {
  const t = useTranslations("audit");
  const common = useTranslations("common");
  const actions = useTranslations("auditActions");
  const locale = useLocale();
  const initial = useSearchParams();
  const { actionLabel, entityLabel } = useLabels();
  const [filters, setFilters] = useState({
    actorUserId: "",
    appCode: "",
    entityType: initial.get("entityType") ?? "",
    entityId: initial.get("entityId") ?? "",
    action: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const people = useApi<PageResponse<UserListItem>>("/users?pageSize=100");
  const home = useApi<HomeResponse>("/home");

  const parameters = new URLSearchParams({
    page: String(page),
    pageSize: "20",
  });
  for (const [key, value] of Object.entries(filters)) if (value) parameters.set(key, value);
  const { state, reload } = useApi<PageResponse<AuditEventItem>>(`/audit-events?${parameters}`);
  const change = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const filtered = Object.values(filters).some(Boolean);
  const headings = [t("time"), t("actor"), t("company"), t("action"), t("entity")];
  const actionKeys = Object.keys((useMessages() as { auditActions: Record<string, string> }).auditActions);

  const select = (key: keyof typeof filters, label: string, options: { value: string; text: string }[]) => (
    <>
      <label className="an-nhan" htmlFor={`loc-${key}`}>
        {label}
      </label>
      <select id={`loc-${key}`} className="o-nhap" value={filters[key]} onChange={(event) => change(key, event.target.value)}>
        <option value="">{`${label}: ${common("all")}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("readOnly")}</div>
      <div className="bo-loc">
        {select(
          "actorUserId",
          t("actorFilter"),
          people.state.kind === "ready"
            ? people.state.data.data.map((person) => ({
                value: person.id,
                text: person.fullName,
              }))
            : [],
        )}
        {select(
          "appCode",
          t("app"),
          home.state.kind === "ready"
            ? home.state.data.apps.map((app) => ({
                value: app.code,
                text: locale === "en" ? app.nameEn : app.nameVi,
              }))
            : [],
        )}
        {select(
          "entityType",
          t("entityFilter"),
          entityTypes.map((type) => ({ value: type, text: entityLabel(type) })),
        )}
        {select(
          "action",
          t("actionFilter"),
          actionKeys.map((key) => ({
            value: key.replaceAll("_", "."),
            text: actions(key),
          })),
        )}
        <label htmlFor="loc-from">{t("from")}</label>
        <input id="loc-from" className="o-nhap" type="date" style={{ width: "auto" }} value={filters.from} onChange={(event) => change("from", event.target.value)} />
        <label htmlFor="loc-to">{t("to")}</label>
        <input id="loc-to" className="o-nhap" type="date" style={{ width: "auto" }} value={filters.to} onChange={(event) => change("to", event.target.value)} />
        {filtered && (
          <button
            type="button"
            className="nut chu"
            onClick={() =>
              setFilters({
                actorUserId: "",
                appCode: "",
                entityType: "",
                entityId: "",
                action: "",
                from: "",
                to: "",
              })
            }
          >
            {t("clear")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={filtered ? common("noResult") : common("empty")} />
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
                  {result.data.map((event) => (
                    <tr key={event.id}>
                      <td data-nhan={headings[0]}>
                        <button type="button" className="nut chu" onClick={() => setOpenId(event.id)}>
                          {formatDateTime(event.occurredAt)}
                        </button>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{event.actorName ?? t("system")}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{event.companyShortName ?? common("none")}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span className={event.action === "login.failed" ? "nhan loi" : undefined}>{actionLabel(event.action)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {entityLabel(event.entityType)}
                          {event.entityLabel ? `: ${event.entityLabel}` : ""}
                        </span>
                      </td>
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
      {openId && <AuditDetail id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function AuditDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("audit");
  const common = useTranslations("common");
  const { actionLabel, entityLabel } = useLabels();
  const { state, reload } = useApi<AuditEventDetail>(`/audit-events/${id}`);
  const text = (value: unknown) => (value === undefined || value === null ? common("none") : typeof value === "object" ? JSON.stringify(value) : String(value));
  // Bảng so sánh theo từng trường; trường có giá trị đổi được in đậm.
  const compare = (before: unknown, after: unknown) => {
    const asRecord = (value: unknown): Record<string, unknown> =>
      value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : value === null || value === undefined ? {} : { "": value };
    const left = asRecord(before);
    const right = asRecord(after);
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    if (keys.length === 0) return <span className="chu-thich">{t("noData")}</span>;
    return (
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th scope="col">{t("field")}</th>
              <th scope="col">{t("before")}</th>
              <th scope="col">{t("after")}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const changed = text(left[key]) !== text(right[key]);
              return (
                <tr key={key}>
                  <td data-nhan={t("field")}>
                    <span>{key || common("none")}</span>
                  </td>
                  <td data-nhan={t("before")}>
                    <span style={{ wordBreak: "break-word" }}>{text(left[key])}</span>
                  </td>
                  <td data-nhan={t("after")}>
                    <span
                      style={{
                        wordBreak: "break-word",
                        fontWeight: changed && key in left ? 700 : undefined,
                      }}
                    >
                      {text(right[key])}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Drawer title={t("detail")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(event) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <dl className="thong-tin-dong">
              <dt>{t("time")}</dt>
              <dd>{formatDateTime(event.occurredAt)}</dd>
              <dt>{t("actor")}</dt>
              <dd>{event.actorName ?? t("system")}</dd>
              <dt>{t("company")}</dt>
              <dd>{event.companyShortName ?? common("none")}</dd>
              <dt>{t("action")}</dt>
              <dd>{actionLabel(event.action)}</dd>
              <dt>{t("entity")}</dt>
              <dd>
                {entityLabel(event.entityType)}
                {event.entityLabel ? `: ${event.entityLabel}` : ""}
              </dd>
              <dt>{t("ip")}</dt>
              <dd>{event.ip ?? common("none")}</dd>
              <dt>{t("device")}</dt>
              <dd style={{ wordBreak: "break-word" }}>{event.userAgent ?? common("none")}</dd>
            </dl>
            {compare(event.beforeData, event.afterData)}
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}
