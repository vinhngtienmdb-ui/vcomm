"use client";

// MAN_HINH_51 Bút toán (CHUC_NANG_71, 72; API_88): danh sách bút toán lọc nguồn, trạng thái, khoảng ngày; lập phiếu kế toán.
import { journalSourceTypes, journalStatuses, type JournalListItem, type JournalSourceType, type JournalStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { JournalStatusBadge } from "@/components/JournalStatusBadge";

export default function JournalsPage() {
  const t = useTranslations("ledger");
  const { can } = useAdmin();
  const [sourceType, setSourceType] = useState<JournalSourceType | "">("");
  const [status, setStatus] = useState<JournalStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams({ ...(sourceType ? { sourceType } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const { state, reload } = useApi<JournalListItem[]>(`/finance/journals?${query.toString()}`);
  const headings = [t("journalNo"), t("journalDate"), t("source"), t("description"), t("amount"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("journalsTitle")}</h1>
        <HistoryLink entityType="journal" />
        {can("finance.journal.manage") && (
          <Link className="nut chinh" href="/journals/new">
            {t("createJournal")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <select aria-label={t("source")} className="o-nhap" style={{ width: "auto" }} value={sourceType} onChange={(event) => setSourceType(event.target.value as JournalSourceType | "")}>
          <option value="">{t("allSources")}</option>
          {journalSourceTypes.map((item) => (
            <option key={item} value={item}>
              {t(`source_${item}`)}
            </option>
          ))}
        </select>
        <select aria-label={t("status")} className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value as JournalStatus | "")}>
          <option value="">{t("allStatuses")}</option>
          {journalStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
        <input aria-label={t("from")} type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
        <input aria-label={t("to")} type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("noJournals")} />
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
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/journals/${item.id}`}>{item.journalNo || t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{formatDate(item.journalDate)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{t(`source_${item.sourceType}`)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.description}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.totalAmount)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <JournalStatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}
