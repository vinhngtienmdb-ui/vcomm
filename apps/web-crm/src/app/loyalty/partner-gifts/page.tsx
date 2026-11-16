"use client";

// MAN_HINH_261 Điểm đối tác tặng: danh sách giao dịch tặng điểm qua Open API (CONG_VIEC_65; CHUC_NANG_238; API_304 phần tặng).
import type { PageResponse, PartnerContractListItem, PartnerGiftItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function PartnerGiftsPage() {
  const t = useTranslations("loyaltyPartner");
  const common = useTranslations("common");
  const [contractId, setContractId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const contracts = useApi<PageResponse<PartnerContractListItem>>("/loyalty/partners?pageSize=100");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(contractId ? { contractId } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const { state, reload } = useApi<PageResponse<PartnerGiftItem>>(`/loyalty/partner-gifts?${params}`);
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("giftsTitle")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-doi-tac-tang">
          {t("partner")}
        </label>
        <select id="loc-doi-tac-tang" className="o-nhap" value={contractId} onChange={(event) => filter(setContractId)(event.target.value)}>
          <option value="">{t("allPartners")}</option>
          {contracts.state.kind === "ready" &&
            contracts.state.data.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.partnerName}
              </option>
            ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-tang">
          {t("status")}
        </label>
        <select id="loc-trang-thai-tang" className="o-nhap" value={status} onChange={(event) => filter(setStatus)(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          <option value="completed">{t("giftStatus_completed")}</option>
          <option value="cancelled">{t("giftStatus_cancelled")}</option>
        </select>
        <label htmlFor="loc-tu-tang">{t("from")}</label>
        <input id="loc-tu-tang" type="date" className="o-nhap" value={from} onChange={(event) => filter(setFrom)(event.target.value)} />
        <label htmlFor="loc-den-tang">{t("to")}</label>
        <input id="loc-den-tang" type="date" className="o-nhap" value={to} onChange={(event) => filter(setTo)(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noGifts")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["documentNo", "createdAt", "partner", "partnerCode", "customer", "points", "amount", "message", "status"].map((key) => (
                        <th key={key}>{t(`giftColumn_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("giftColumn_documentNo")}>{item.documentNo}</td>
                        <td data-nhan={t("giftColumn_createdAt")}>{formatDateTime(item.createdAt)}</td>
                        <td data-nhan={t("giftColumn_partner")}>{item.partnerName}</td>
                        <td data-nhan={t("giftColumn_partnerCode")}>{item.partnerTransactionCode}</td>
                        <td data-nhan={t("giftColumn_customer")}>{item.customerMasked}</td>
                        <td data-nhan={t("giftColumn_points")}>{formatNumber(item.points, 0)}</td>
                        <td data-nhan={t("giftColumn_amount")}>{formatNumber(Number(item.amount) + Number(item.taxAmount), 0)}</td>
                        <td data-nhan={t("giftColumn_message")}>{item.message ?? "—"}</td>
                        <td data-nhan={t("giftColumn_status")}>
                          <span className={`nhan ${item.status === "completed" ? "thanh-cong" : "trung-tinh"}`}>{t(`giftStatus_${item.status}`)}</span>
                          {item.cancelReason && <div className="chu-thich">{item.cancelReason}</div>}
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
