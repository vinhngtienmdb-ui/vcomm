"use client";

// MAN_HINH_165 Ca thu ngân (CHUC_NANG_186; API_193): lọc trạng thái, ngày, ca lệch; ca mở quá 24 giờ.
import type { RetailShiftListResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ShiftDifference } from "@/components/ShiftDifference";

export default function ShiftsPage() {
  const t = useTranslations("retailShifts");
  const common = useTranslations("common");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [differenceOnly, setDifferenceOnly] = useState(false);
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(differenceOnly ? { differenceOnly: "true" } : {}) });
  const { state, reload } = useApi<RetailShiftListResponse>(`/retail/shifts?${query}`);
  const headings = [t("store"), t("register"), t("cashier"), t("openedAt"), t("status"), t("openingCash"), t("expectedCash"), t("countedCash"), t("difference")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">
            {t("status")}: {common("all")}
          </option>
          <option value="open">{t("status_open")}</option>
          <option value="closed">{t("status_closed")}</option>
        </select>
        <input className="o-nhap" type="date" aria-label={t("from")} value={from} onChange={(event) => (setFrom(event.target.value), setPage(1))} />
        <input className="o-nhap" type="date" aria-label={t("to")} value={to} onChange={(event) => (setTo(event.target.value), setPage(1))} />
        <label>
          <input type="checkbox" checked={differenceOnly} onChange={(event) => (setDifferenceOnly(event.target.checked), setPage(1))} /> {t("differenceOnly")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) =>
          data.items.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <>
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
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={headings[0]}>
                          <Link href={`/shifts/${item.id}`}>{item.storeName}</Link>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{item.registerCode}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{item.cashierName}</span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{formatDateTime(item.openedAt)}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>
                            <span className={`nhan ${item.status === "open" ? "thong-tin" : "trung-tinh"}`}>{t(`status_${item.status}`)}</span>
                            {item.openedLong && <span className="nhan canh-bao"> {t("openedLong")}</span>}
                          </span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span>{formatMoney(item.openingCash, item.currency)}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <span>{item.expectedCash === null ? "—" : formatMoney(item.expectedCash, item.currency)}</span>
                        </td>
                        <td data-nhan={headings[7]}>
                          <span>{item.countedCash === null ? "—" : formatMoney(item.countedCash, item.currency)}</span>
                        </td>
                        <td data-nhan={headings[8]}>
                          <ShiftDifference difference={item.difference} currency={item.currency} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="phan-trang">
                <span>{common("total", { count: data.total })}</span>
                <div className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
                  </button>
                </div>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  );
}
