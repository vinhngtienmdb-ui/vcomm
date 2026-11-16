"use client";

// MAN_HINH_218 Đối soát điểm nội bộ (CONG_VIEC_60; CHUC_NANG_214; QUYTAC_NGHIEPVU_470; API_249): bảng tháng giữa công ty vận hành sàn và công ty con; công ty con chỉ thấy bảng của mình.
import { loyaltySettlementStatuses, type LoyaltySettlementsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { NetAmount, SettlementStatusBadge } from "@/components/SettlementStatusBadge";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function LoyaltySettlementsPage() {
  const t = useTranslations("loyaltySettlements");
  const [filter, setFilter] = useState({ period: "", status: "" });
  const query = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, value]) => value)));
  const { state, reload } = useApi<LoyaltySettlementsResponse>(`/loyalty/settlements?${query.toString()}`);
  const headings = [t("documentNo"), t("period"), t("company"), t("receivableMovement"), t("payableMovement"), t("offsetAmount"), t("netClosing"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="dn-ky">
          {t("period")}
        </label>
        <input id="dn-ky" type="month" className="o-nhap" style={{ width: "auto" }} value={filter.period} onChange={(event) => setFilter({ ...filter, period: event.target.value })} />
        <label className="an-nhan" htmlFor="dn-trang-thai">
          {t("status")}
        </label>
        <select id="dn-trang-thai" className="o-nhap" style={{ width: "auto" }} value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}>
          <option value="">{t("allStatuses")}</option>
          {loyaltySettlementStatuses.map((status) => (
            <option key={status} value={status}>
              {t(`status_${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="khoi-canh-bao thong-tin" style={{ marginBottom: "var(--khoang-3)" }}>
        {t("listHint")}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.items.length === 0 ? (
            <MessageView text={t("empty")} />
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
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/loyalty-settlements/${item.id}`}>{item.documentNo}</Link>
                      </td>
                      <td data-nhan={headings[1]}>{`${item.period.slice(5, 7)}/${item.period.slice(0, 4)}`}</td>
                      <td data-nhan={headings[2]}>{result.isOperator ? item.companyName : item.operatorCompanyName}</td>
                      <td data-nhan={headings[3]} className="so-tien">
                        {formatNumber(item.receivableMovement)}
                      </td>
                      <td data-nhan={headings[4]} className="so-tien">
                        {formatNumber(item.payableMovement)}
                      </td>
                      <td data-nhan={headings[5]} className="so-tien">
                        {formatNumber(item.offsetAmount)}
                      </td>
                      <td data-nhan={headings[6]}>
                        <NetAmount amount={item.netClosing} operatorName={item.operatorCompanyName} companyName={item.companyName} />
                      </td>
                      <td data-nhan={headings[7]}>
                        <SettlementStatusBadge status={item.status} />
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
