"use client";

// MAN_HINH_304 Thuê bao iPOS – danh sách mọi cửa hàng (CONG_VIEC_74; CHUC_NANG_252; API_355). Thao tác làm ở khối iPOS trong chi tiết cửa hàng.
import { iposSubscriptionStatuses, type IposSubscription, type PageResponse } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { iposStatusClass } from "@/components/IposMerchantBlock";

export default function IposSubscriptionsPage() {
  const t = useTranslations("ipos");
  const common = useTranslations("common");
  const [status, setStatus] = useState("");
  const [within, setWithin] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "20", ...(status ? { status } : {}), ...(within ? { endsWithinDays: within } : {}) });
  const { state, reload } = useApi<PageResponse<IposSubscription>>(`/ipos/subscriptions?${params}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("subscriptionsTitle")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="ipos-loc-trang-thai">
          {t("status")}
        </label>
        <select id="ipos-loc-trang-thai" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">{t("allStatuses")}</option>
          {iposSubscriptionStatuses.map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="ipos-loc-han">
          {t("endsWithin")}
        </label>
        <select id="ipos-loc-han" className="o-nhap" value={within} onChange={(event) => (setWithin(event.target.value), setPage(1))}>
          <option value="">{t("anyEndDate")}</option>
          {["7", "30", "90"].map((days) => (
            <option key={days} value={days}>
              {t("endsWithinDays", { count: Number(days) })}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noSubscriptionsAll")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("merchant")}</th>
                      <th>{t("outlet")}</th>
                      <th>{t("plan")}</th>
                      <th className="so">{t("monthlyPrice")}</th>
                      <th>{t("billingMethod")}</th>
                      <th>{t("endsOn")}</th>
                      <th>{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("merchant")}>
                          <Link href={`/affiliate/merchants/${item.merchantId}`}>{item.merchantCode}</Link> {item.merchantName}
                        </td>
                        <td data-nhan={t("outlet")}>{item.outletName}</td>
                        <td data-nhan={t("plan")}>
                          {item.planName} · {t("months", { count: item.periodMonths })}
                        </td>
                        <td data-nhan={t("monthlyPrice")} className="so">
                          {formatNumber(item.monthlyPrice, 0)}
                        </td>
                        <td data-nhan={t("billingMethod")}>{item.billingMethod ? t(`billing_${item.billingMethod}`) : "—"}</td>
                        <td data-nhan={t("endsOn")}>{formatDate(item.endsOn)}</td>
                        <td data-nhan={t("status")}>
                          <span className={`nhan ${iposStatusClass[item.status]}`}>{t(`status_${item.status}`)}</span>
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
