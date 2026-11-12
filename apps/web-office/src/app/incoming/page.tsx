"use client";

// MAN_HINH_157 Công văn đến (CHUC_NANG_184; API_188, API_190): sổ theo năm, chờ vào sổ (liên công ty), vào sổ, xuất sổ.
import { documentUrgencies, incomingChannels, type DocumentOptions, type IncomingListItem, type IncomingResponse, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { IncomingStatusBadge, UrgencyBadge } from "@/components/DocumentBadges";
import { IncomingForm } from "@/components/IncomingForm";

const statuses = ["all", "registered", "awaiting_direction", "processing", "processed", "archived", "voided"] as const;

export default function IncomingPage() {
  const options = useApi<DocumentOptions>("/office/document-options");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(data) => <IncomingList options={data} />}
    </Loaded>
  );
}

function IncomingList({ options }: { options: DocumentOptions }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const registers = options.registers.filter((item) => item.direction === "incoming");
  const [tab, setTab] = useState<"register" | "waiting">("register");
  const [registerId, setRegisterId] = useState(registers.find((item) => item.isDefault)?.id ?? registers[0]?.id ?? "");
  const [year, setYear] = useState(Number(vietnamToday().slice(0, 4)));
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [urgency, setUrgency] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [registering, setRegistering] = useState(false);
  const query =
    tab === "waiting"
      ? new URLSearchParams({ status: "awaiting_registration", page: String(page) })
      : new URLSearchParams({ registerId, year: String(year), status, page: String(page), ...(urgency ? { urgency } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { state, reload } = useApi<PageResponse<IncomingListItem>>(`/office/incoming?${query.toString()}`);
  const headings = [t("incomingNo"), t("receivedOn"), t("sender"), t("symbol"), t("documentDate"), t("summary"), t("urgency"), t("handler"), t("dueOn"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("incomingTitle")}</h1>
        {options.canClerk && (
          <div className="nhom-nut">
            <button type="button" className="nut chinh" onClick={() => setRegistering(true)}>
              {t("register")}
            </button>
            <button
              type="button"
              className="nut phu"
              onClick={() => void apiDownload(`/office/registers/${registerId}/export?year=${year}`, `so-cong-van-den-${year}.xlsx`).catch((error) => notify(failureOf(error).message, "loi"))}
            >
              {t("exportRegister")}
            </button>
          </div>
        )}
      </div>
      {options.canClerk && (
        <div className="cac-the" role="tablist">
          {(["register", "waiting"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => (setTab(item), setPage(1))}>
              {t(`incomingTab_${item}`)}
            </button>
          ))}
        </div>
      )}
      {tab === "register" && (
        <div className="bo-loc">
          <select className="o-nhap" aria-label={t("registerName")} value={registerId} onChange={(event) => (setRegisterId(event.target.value), setPage(1))}>
            {registers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input className="o-nhap" type="number" aria-label={t("year")} value={year} min={2000} max={2100} onChange={(event) => (setYear(Number(event.target.value)), setPage(1))} />
          <label className="an-nhan" htmlFor="incoming-search">
            {common("search")}
          </label>
          <input id="incoming-search" className="o-nhap" placeholder={t("incomingSearch")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
          <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => (setStatus(event.target.value as (typeof statuses)[number]), setPage(1))}>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? t("statusAll") : t(`incomingStatus_${item}`)}
              </option>
            ))}
          </select>
          <select className="o-nhap" aria-label={t("urgency")} value={urgency} onChange={(event) => (setUrgency(event.target.value), setPage(1))}>
            <option value="">{t("urgencyAll")}</option>
            {documentUrgencies.map((item) => (
              <option key={item} value={item}>
                {t(`urgency_${item}`)}
              </option>
            ))}
          </select>
        </div>
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={tab === "waiting" ? t("noWaiting") : t("noIncoming")} />
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
                        <Link href={`/incoming/${item.id}`}>{item.incomingNo ?? t("notRegistered")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{formatDate(item.receivedOn)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.sender}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.symbol ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatDate(item.documentDate)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <Link href={`/incoming/${item.id}`}>{item.summary}</Link>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>
                          <UrgencyBadge urgency={item.urgency} />
                        </span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span>{item.handler?.fullName ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[8]}>
                        <span>{formatDate(item.dueOn)}</span>
                      </td>
                      <td data-nhan={headings[9]}>
                        <span>
                          <IncomingStatusBadge status={item.status} />
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
      {registering && <IncomingForm options={options} incoming={null} onClose={() => setRegistering(false)} />}
    </>
  );
}
