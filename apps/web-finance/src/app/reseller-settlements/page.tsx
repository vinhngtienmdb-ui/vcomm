"use client";

// MAN_HINH_240 Đối soát người bán dropship (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_509; API_312): bảng tuần theo người bán, A đến E, số còn lại, trạng thái.
import type { ResellerSettlementListResponse, ResellerSettlementStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function ResellerSettlementsPage() {
  const t = useTranslations("resellerSettlements");
  const common = useTranslations("common");
  const [status, setStatus] = useState<ResellerSettlementStatus | "">("");
  const [resellerId, setResellerId] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  if (resellerId) parameters.set("resellerId", resellerId);
  const { state, reload } = useApi<ResellerSettlementListResponse>(`/finance/reseller-settlements?${parameters}`);
  const resellers = state.kind === "ready" ? state.data.resellers : [];
  const headings = [t("documentNo"), t("reseller"), t("week"), t("issue"), t("return"), t("collection"), t("fee"), t("feeTax"), t("remaining"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-nguoi-ban">
          {t("reseller")}
        </label>
        <select
          id="loc-nguoi-ban"
          className="o-nhap"
          value={resellerId}
          onChange={(event) => {
            setResellerId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("allResellers")}</option>
          {resellers.map((reseller) => (
            <option key={reseller.id} value={reseller.id}>
              {reseller.name}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-doi-soat">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai-doi-soat"
          className="o-nhap"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ResellerSettlementStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="draft">{t("status_draft")}</option>
          <option value="confirmed">{t("status_confirmed")}</option>
        </select>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col" style={index >= 3 && index <= 8 ? { textAlign: "right" } : undefined}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row) => (
                    <tr key={row.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/reseller-settlements/${row.id}`}>{row.documentNo}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{row.resellerName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          {formatDate(row.weekStart)} – {formatDate(row.weekEnd)}
                        </span>
                      </td>
                      {[row.issueAmount, row.returnAmount, row.collectionAmount, row.feeAmount, row.feeTaxAmount].map((amount, index) => (
                        <td key={index} data-nhan={headings[index + 3]} style={{ textAlign: "right" }}>
                          <span>{formatMoney(amount, row.currency)}</span>
                        </td>
                      ))}
                      <td data-nhan={headings[8]} style={{ textAlign: "right" }}>
                        <strong style={Number(row.remainingAmount) < 0 ? { color: "var(--mau-loi)" } : undefined}>{formatMoney(row.remainingAmount, row.currency)}</strong>
                      </td>
                      <td data-nhan={headings[9]}>
                        <span className={`nhan ${row.status === "confirmed" ? "thanh-cong" : "canh-bao"}`}>{t(`status_${row.status}`)}</span>
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
    </>
  );
}
