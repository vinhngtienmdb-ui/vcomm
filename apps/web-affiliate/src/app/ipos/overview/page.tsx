"use client";

// MAN_HINH_293 Tổng quan iPOS (chủ cửa hàng; CONG_VIEC_74; API_344): doanh thu hôm nay, 7 ngày; ca đang mở (cảnh báo ca quá 24 giờ);
// cảnh báo tồn thấp; thuê bao từng điểm bán; yêu cầu đăng ký thu ngân chờ duyệt.
import type { IposOverview } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { usePortalApi } from "@/lib/portal-api";

const subscriptionClass = { trial: "thong-tin", active: "thanh-cong", overdue: "canh-bao", locked: "loi", cancelled: "trung-tinh" } as const;

export default function IposOverviewPage() {
  const t = useTranslations("iposPortal");
  const { state, reload } = usePortalApi<IposOverview>("/merchant-portal/ipos/overview");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) =>
        data.outlets.length === 0 ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("overviewTitle")}</h1>
            </div>
            <div className="luoi-so">
              <div className="the">
                <span className="chu-thich">{t("todayRevenue")}</span>
                <strong style={{ fontSize: 24 }}>{formatNumber(data.todayRevenue)}</strong>
                <span className="chu-thich">{t("todaySales", { count: data.todaySales })}</span>
              </div>
              <div className="the">
                <span className="chu-thich">{t("weekRevenue")}</span>
                <strong style={{ fontSize: 24 }}>{formatNumber(data.weekRevenue)}</strong>
              </div>
              <div className="the">
                <span className="chu-thich">{t("openShiftsCount")}</span>
                <strong style={{ fontSize: 24 }}>{data.openShifts.length}</strong>
              </div>
              <div className="the">
                <span className="chu-thich">{t("lowStockCount")}</span>
                <strong style={{ fontSize: 24 }}>{data.lowStockTotal}</strong>
              </div>
            </div>
            {data.pendingRegistrations > 0 && (
              <div className="khoi-canh-bao thong-tin" style={{ marginTop: "var(--khoang-4)" }}>
                {t("pendingRegistrationsNotice", { count: data.pendingRegistrations })} <Link href="/ipos/cashiers">{t("manageCashiers")}</Link>
              </div>
            )}
            {data.openShifts.some((shift) => shift.overdue) && (
              <div className="khoi-canh-bao canh-bao" style={{ marginTop: "var(--khoang-4)" }}>
                {t("overdueShiftNotice")} <Link href="/ipos/shifts">{t("shiftsTitle")}</Link>
              </div>
            )}
            <h2>{t("openShiftsTitle")}</h2>
            {data.openShifts.length === 0 ? (
              <p className="chu-thich">{t("noOpenShifts")}</p>
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("outlet")}</th>
                      <th>{t("registerName")}</th>
                      <th>{t("cashier")}</th>
                      <th>{t("openedAt")}</th>
                      <th className="so">{t("salesCount")}</th>
                      <th className="so">{t("revenue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.openShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td data-nhan={t("outlet")}>{shift.outletName}</td>
                        <td data-nhan={t("registerName")}>{shift.registerName}</td>
                        <td data-nhan={t("cashier")}>{shift.memberName}</td>
                        <td data-nhan={t("openedAt")}>
                          {formatDateTime(shift.openedAt)} {shift.overdue && <span className="nhan canh-bao">{t("overdueShift")}</span>}
                        </td>
                        <td data-nhan={t("salesCount")} className="so">
                          {shift.salesCount}
                        </td>
                        <td data-nhan={t("revenue")} className="so">
                          {formatNumber(shift.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h2>{t("lowStockTitle")}</h2>
            {data.lowStock.length === 0 ? (
              <p className="chu-thich">{t("noLowStock")}</p>
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("item")}</th>
                      <th>{t("outlet")}</th>
                      <th className="so">{t("quantity")}</th>
                      <th className="so">{t("minQuantity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStock.map((row) => (
                      <tr key={`${row.variantId}-${row.outletName}`}>
                        <td data-nhan={t("item")}>{row.name}</td>
                        <td data-nhan={t("outlet")}>{row.outletName}</td>
                        <td data-nhan={t("quantity")} className="so">
                          <span className={`nhan ${Number(row.quantity) < 0 ? "loi" : "canh-bao"}`}>{formatNumber(row.quantity)}</span>
                        </td>
                        <td data-nhan={t("minQuantity")} className="so">
                          {formatNumber(row.minQuantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h2>{t("subscriptionsTitle")}</h2>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("outlet")}</th>
                    <th>{t("plan")}</th>
                    <th>{t("registers")}</th>
                    <th>{t("endsOn")}</th>
                    <th>{t("subscription")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outlets.map((outlet) => (
                    <tr key={outlet.outletId}>
                      <td data-nhan={t("outlet")}>{outlet.outletName}</td>
                      <td data-nhan={t("plan")}>{outlet.planName}</td>
                      <td data-nhan={t("registers")}>{t("registersUsed", { used: outlet.activeRegisters, max: outlet.maxRegisters })}</td>
                      <td data-nhan={t("endsOn")}>{formatDate(outlet.endsOn)}</td>
                      <td data-nhan={t("subscription")}>
                        <span className={`nhan ${subscriptionClass[outlet.subscriptionStatus]}`}>{t(`subscription_${outlet.subscriptionStatus}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      }
    </Loaded>
  );
}
