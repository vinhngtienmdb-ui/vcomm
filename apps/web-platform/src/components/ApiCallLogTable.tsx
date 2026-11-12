"use client";

// Bảng nhật ký gọi API đối tác (MAN_HINH_226 và thẻ Nhật ký gọi của MAN_HINH_225; API_259).
import { apiCallResults, type ApiCallLogItem, type ApiKeyItem, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

// Ô chọn ngày giờ trả giờ địa phương; API nhận ISO 8601 có múi giờ.
const toIso = (value: string) => (value ? new Date(value).toISOString() : "");
const tone = (status: number) => (status < 400 ? "thanh-cong" : status === 429 || status < 500 ? "canh-bao" : "loi");

export function ApiCallLogTable({ apiKeyId }: { apiKeyId?: string }) {
  const t = useTranslations("apiCallLogs");
  const common = useTranslations("common");
  const keys = useApi<ApiKeyItem[]>(apiKeyId ? null : "/platform/api-keys");
  const [filters, setFilters] = useState({ apiKeyId: apiKeyId ?? "", result: "", from: "", to: "", path: "" });
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (filters.apiKeyId) parameters.set("apiKeyId", filters.apiKeyId);
  if (filters.result) parameters.set("result", filters.result);
  if (filters.from) parameters.set("from", toIso(filters.from));
  if (filters.to) parameters.set("to", toIso(filters.to));
  if (filters.path.trim()) parameters.set("path", filters.path.trim());
  const { state, reload } = useApi<PageResponse<ApiCallLogItem>>(`/platform/api-call-logs?${parameters}`);
  const change = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const filtered = Boolean(filters.result || filters.from || filters.to || filters.path || (!apiKeyId && filters.apiKeyId));
  const headings = [t("time"), ...(apiKeyId ? [] : [t("key")]), t("method"), t("pathColumn"), t("status"), t("errorCode"), t("duration"), t("ip"), t("requestId")];

  return (
    <>
      <div className="bo-loc">
        {!apiKeyId && (
          <>
            <label className="an-nhan" htmlFor="loc-khoa">
              {t("key")}
            </label>
            <select id="loc-khoa" className="o-nhap" value={filters.apiKeyId} onChange={(event) => change("apiKeyId", event.target.value)}>
              <option value="">{t("allKeys")}</option>
              {keys.state.kind === "ready" &&
                keys.state.data.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.name}
                  </option>
                ))}
            </select>
          </>
        )}
        <label className="an-nhan" htmlFor="loc-ket-qua">
          {t("result")}
        </label>
        <select id="loc-ket-qua" className="o-nhap" value={filters.result} onChange={(event) => change("result", event.target.value)}>
          <option value="">{t("allResults")}</option>
          {apiCallResults.map((result) => (
            <option key={result} value={result}>
              {t(`result_${result}`)}
            </option>
          ))}
        </select>
        <label htmlFor="loc-tu">{t("from")}</label>
        <input id="loc-tu" type="datetime-local" className="o-nhap" style={{ width: "auto" }} value={filters.from} onChange={(event) => change("from", event.target.value)} />
        <label htmlFor="loc-den">{t("to")}</label>
        <input id="loc-den" type="datetime-local" className="o-nhap" style={{ width: "auto" }} value={filters.to} onChange={(event) => change("to", event.target.value)} />
        <label className="an-nhan" htmlFor="loc-duong-dan">
          {t("path")}
        </label>
        <input id="loc-duong-dan" className="o-nhap" placeholder={t("path")} maxLength={100} value={filters.path} onChange={(event) => change("path", event.target.value)} />
      </div>
      <div className="chu-thich">{t("notice")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
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
                  {result.data.map((call) => {
                    const cells = [
                      formatDateTime(call.calledAt),
                      ...(apiKeyId ? [] : [call.apiKeyName]),
                      call.method,
                      <code key="path" style={{ wordBreak: "break-all" }}>
                        {call.path}
                      </code>,
                      <span key="status" className={`nhan ${tone(call.statusCode)}`}>
                        {call.statusCode}
                      </span>,
                      call.errorCode ?? common("none"),
                      t("ms", { value: call.durationMs }),
                      call.ip ?? common("none"),
                      <code key="request">{call.requestId ? `${call.requestId.slice(0, 8)}…` : common("none")}</code>,
                    ];
                    return (
                      <tr key={call.id}>
                        {cells.map((cell, index) => (
                          <td key={index} data-nhan={headings[index]}>
                            {typeof cell === "string" ? <span>{cell}</span> : cell}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
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
    </>
  );
}
