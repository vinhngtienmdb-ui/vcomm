"use client";

// MAN_HINH_262 Đối soát đối tác liên minh: danh sách bảng tháng (CONG_VIEC_65; CHUC_NANG_239; QUYTAC_NGHIEPVU_548; API_305).
import type { PageResponse, PartnerContractListItem, PartnerSettlementItem } from "contracts";
import { partnerSettlementStatuses } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { netLabel, periodLabel, settlementStatusClass } from "@/components/LoyaltyPartnerSettlement";

export default function PartnerSettlementsPage() {
  const t = useTranslations("loyaltyPartner");
  const common = useTranslations("common");
  const [contractId, setContractId] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [page, setPage] = useState(1);
  const contracts = useApi<PageResponse<PartnerContractListItem>>("/loyalty/partners?pageSize=100");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(contractId ? { contractId } : {}),
    ...(status ? { status } : {}),
    ...(period ? { period } : {}),
  });
  const { state, reload } = useApi<PageResponse<PartnerSettlementItem>>(`/loyalty/partner-settlements?${params}`);
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("settlementsTitle")}</h1>
      </div>
      <div className="bo-loc">
        <label htmlFor="loc-thang-ds">{t("settlementColumn_period")}</label>
        <input id="loc-thang-ds" type="month" className="o-nhap" value={period} onChange={(event) => filter(setPeriod)(event.target.value)} />
        <label className="an-nhan" htmlFor="loc-doi-tac-ds">
          {t("partner")}
        </label>
        <select id="loc-doi-tac-ds" className="o-nhap" value={contractId} onChange={(event) => filter(setContractId)(event.target.value)}>
          <option value="">{t("allPartners")}</option>
          {contracts.state.kind === "ready" &&
            contracts.state.data.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.partnerName}
              </option>
            ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-ds">
          {t("status")}
        </label>
        <select id="loc-trang-thai-ds" className="o-nhap" value={status} onChange={(event) => filter(setStatus)(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {partnerSettlementStatuses.map((value) => (
            <option key={value} value={value}>
              {t(`settlementStatus_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("settlementsEmpty")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["documentNo", "period", "partner", "receivable", "payable", "offset", "net", "dueDate", "status"].map((key) => (
                        <th key={key} className={["receivable", "payable", "offset"].includes(key) ? "so" : undefined}>
                          {t(`settlementColumn_${key}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("settlementColumn_documentNo")}>
                          <Link href={`/loyalty/partner-settlements/${item.id}`}>{item.documentNo}</Link>
                        </td>
                        <td data-nhan={t("settlementColumn_period")}>{periodLabel(item.period)}</td>
                        <td data-nhan={t("settlementColumn_partner")}>{item.partnerName}</td>
                        <td data-nhan={t("settlementColumn_receivable")} className="so">
                          {formatNumber(item.receivableAmount, 0)}
                        </td>
                        <td data-nhan={t("settlementColumn_payable")} className="so">
                          {formatNumber(item.payableAmount, 0)}
                        </td>
                        <td data-nhan={t("settlementColumn_offset")} className="so">
                          {formatNumber(item.offsetAmount, 0)}
                        </td>
                        <td data-nhan={t("settlementColumn_net")}>{netLabel(t, item.netAmount)}</td>
                        <td data-nhan={t("settlementColumn_dueDate")}>
                          {item.dueDate ? formatDate(item.dueDate) : "—"}
                          {item.overdue && <div className="chu-thich">{t("overdue")}</div>}
                        </td>
                        <td data-nhan={t("settlementColumn_status")}>
                          <span className={`nhan ${settlementStatusClass[item.status]}`}>
                            {t(`settlementStatus_${item.status}`)}
                            {item.status === "mismatched" && ` · ${t("mismatchCount", { count: item.mismatchCount })}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )
        }
      </Loaded>
    </>
  );
}
