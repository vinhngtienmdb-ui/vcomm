"use client";

// MAN_HINH_149 Cảnh báo bất thường (CONG_VIEC_51; CHUC_NANG_181; API_181; QUYTAC_NGHIEPVU_354): trùng thông tin nhận hàng, hủy, trả nhiều, đổi điểm dồn dập trong 90 ngày.
import { loyaltyAlertKinds, type LoyaltyAlertKind, type LoyaltyAlertResponse } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function LoyaltyAlertsPage() {
  const t = useTranslations("loyalty");
  const [kind, setKind] = useState<LoyaltyAlertKind>("shared_contact");
  const { state, reload } = useApi<LoyaltyAlertResponse>(`/loyalty/alerts?kind=${kind}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("alertsTitle")}</h1>
      </div>
      <div className="khoi-canh-bao thong-tin">{t("alertsHint")}</div>
      <div className="nhom-nut" role="tablist">
        {loyaltyAlertKinds.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={kind === item} className={`nut ${kind === item ? "chinh" : "phu"}`} onClick={() => setKind(item)}>
            {t(`alert_${item}`)}
          </button>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.items.length === 0 ? (
            <MessageView text={t("noAlerts")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {kind !== "cancel_return" ? <th>{t(kind === "shared_contact" ? "alertColumn_shared" : "alertColumn_day")}</th> : null}
                    <th>{t("alertColumn_buyers")}</th>
                    <th>{t("alertColumn_orders")}</th>
                    {kind === "cancel_return" ? <th>{t("alertColumn_cancelled")}</th> : null}
                    <th>{t(kind === "redeem_burst" ? "alertColumn_redeemed" : "alertColumn_points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item, index) => (
                    <tr key={index}>
                      {kind !== "cancel_return" ? <td data-nhan={t(kind === "shared_contact" ? "alertColumn_shared" : "alertColumn_day")}>{item.label}</td> : null}
                      <td data-nhan={t("alertColumn_buyers")}>
                        {item.buyers.map((buyer, position) => (
                          <span key={buyer.userId}>
                            {position > 0 ? ", " : ""}
                            <Link href={`/loyalty/accounts/${buyer.userId}`}>{`${buyer.fullName} (${buyer.phone})`}</Link>
                          </span>
                        ))}
                      </td>
                      <td data-nhan={t("alertColumn_orders")}>{formatNumber(item.orderCount, 0)}</td>
                      {kind === "cancel_return" ? (
                        <td
                          data-nhan={t("alertColumn_cancelled")}
                        >{`${formatNumber(item.cancelledOrReturned ?? 0, 0)} (${formatNumber(((item.cancelledOrReturned ?? 0) * 100) / item.orderCount, 1)}%)`}</td>
                      ) : null}
                      <td data-nhan={t(kind === "redeem_burst" ? "alertColumn_redeemed" : "alertColumn_points")}>{formatNumber(item.points, 0)}</td>
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
