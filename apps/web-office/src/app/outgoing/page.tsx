"use client";

// MAN_HINH_158 Công văn đi (CHUC_NANG_185; API_188, API_190): sổ theo năm, trạng thái, soạn mới, xuất sổ.
import type { DocumentOptions, OutgoingListItem, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { OutgoingStatusBadge, UrgencyBadge } from "@/components/DocumentBadges";

const statuses = ["all", "draft", "pending", "rejected", "withdrawn", "awaiting_number", "numbered", "issued", "cancelled"] as const;

export default function OutgoingPage() {
  const options = useApi<DocumentOptions>("/office/document-options");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(data) => <OutgoingList options={data} />}
    </Loaded>
  );
}

function OutgoingList({ options }: { options: DocumentOptions }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const registers = options.registers.filter((item) => item.direction === "outgoing");
  const [registerId, setRegisterId] = useState("");
  const [year, setYear] = useState(Number(vietnamToday().slice(0, 4)));
  const [status, setStatus] = useState<(typeof statuses)[number]>(options.canClerk ? "awaiting_number" : "all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ year: String(year), status, page: String(page), ...(registerId ? { registerId } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { state, reload } = useApi<PageResponse<OutgoingListItem>>(`/office/outgoing?${query.toString()}`);
  const headings = [t("outgoingNo"), t("symbol"), t("issuedOn"), t("documentType"), t("summary"), t("signer"), t("recipients"), t("urgency"), t("status")];
  const exportRegister = registerId || registers.find((item) => item.isDefault)?.id || registers[0]?.id;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("outgoingTitle")}</h1>
        <div className="nhom-nut">
          <Link className="nut chinh" href="/outgoing/new">
            {t("compose")}
          </Link>
          {options.canClerk && exportRegister && (
            <button
              type="button"
              className="nut phu"
              onClick={() => void apiDownload(`/office/registers/${exportRegister}/export?year=${year}`, `so-cong-van-di-${year}.xlsx`).catch((error) => notify(failureOf(error).message, "loi"))}
            >
              {t("exportRegister")}
            </button>
          )}
        </div>
      </div>
      <div className="bo-loc">
        <select className="o-nhap" aria-label={t("registerName")} value={registerId} onChange={(event) => (setRegisterId(event.target.value), setPage(1))}>
          <option value="">{t("allRegisters")}</option>
          {registers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input className="o-nhap" type="number" aria-label={t("year")} value={year} min={2000} max={2100} onChange={(event) => (setYear(Number(event.target.value)), setPage(1))} />
        <label className="an-nhan" htmlFor="outgoing-search">
          {common("search")}
        </label>
        <input id="outgoing-search" className="o-nhap" placeholder={t("outgoingSearch")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => (setStatus(event.target.value as (typeof statuses)[number]), setPage(1))}>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? t("statusAll") : t(`outgoingStatus_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noOutgoing")} />
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/outgoing/${item.id}`}>{item.outgoingNo ?? t("noNumber")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.symbol ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatDate(item.issuedOn)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.documentTypeName}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <Link href={`/outgoing/${item.id}`}>{item.summary}</Link>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{item.signer.fullName}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{item.recipientsText || "—"}</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span>
                          <UrgencyBadge urgency={item.urgency} />
                        </span>
                      </td>
                      <td data-nhan={headings[8]}>
                        <span>
                          <OutgoingStatusBadge status={item.status} />
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
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
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
