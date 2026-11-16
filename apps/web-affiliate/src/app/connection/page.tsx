"use client";

// MAN_HINH_232 Kết nối phần mềm (chủ cửa hàng, chỉ xem): khóa API của cửa hàng, số lần gọi, giao dịch qua phần mềm, tin OTP SMS
// (CONG_VIEC_67; CHUC_NANG_234; API_295). Cấp, thu hồi khóa do công ty vận hành sàn làm.
import type { AffiliatePortalConnection } from "contracts";
import { useTranslations } from "next-intl";
import { Loaded } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { usePortalApi } from "@/lib/portal-api";

const statusClass = { active: "thanh-cong", expired: "canh-bao", revoked: "trung-tinh" } as const;

export default function ConnectionPage() {
  const t = useTranslations("affiliate");
  const keys = useTranslations("apiKeys");
  const { state, reload } = usePortalApi<AffiliatePortalConnection>("/merchant-portal/api-keys");
  return (
    <>
      <h1>{t("connectionTitle")}</h1>
      <p className="chu-thich">{t("portalConnectionHint")}</p>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) =>
          data.keys.length === 0 ? (
            <div className="the">
              <p style={{ margin: 0 }}>{t("portalConnectionEmpty")}</p>
            </div>
          ) : (
            <>
              <div className="hai-cot-deu">
                <section className="the">
                  <h2>{t("portalToday")}</h2>
                  <dl className="thong-tin-dong">
                    <dt>{t("portalCalls")}</dt>
                    <dd>{formatNumber(data.callsToday)}</dd>
                    <dt>{t("portalTransactions")}</dt>
                    <dd>{formatNumber(data.transactionsToday)}</dd>
                    <dt>{t("portalSms")}</dt>
                    <dd>{formatNumber(data.smsToday)}</dd>
                  </dl>
                </section>
                <section className="the">
                  <h2>{t("portalWeek", { date: formatDate(data.weekStart) })}</h2>
                  <dl className="thong-tin-dong">
                    <dt>{t("portalCalls")}</dt>
                    <dd>{formatNumber(data.callsWeek)}</dd>
                    <dt>{t("portalTransactions")}</dt>
                    <dd>{formatNumber(data.transactionsWeek)}</dd>
                    <dt>{t("portalSms")}</dt>
                    <dd>{t("portalSmsFee", { count: formatNumber(data.smsWeek), amount: formatNumber(data.smsFeeWeek, 0) })}</dd>
                  </dl>
                </section>
              </div>
              <h2>{t("portalKeys")}</h2>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{keys("name")}</th>
                      <th>{keys("prefix")}</th>
                      <th>{t("apiKeyOutlets")}</th>
                      <th>{keys("expiresOn")}</th>
                      <th>{keys("lastUsed")}</th>
                      <th>{keys("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keys.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={keys("name")}>{item.name}</td>
                        <td data-nhan={keys("prefix")}>
                          <code>vck_{item.keyPrefix}…</code>
                        </td>
                        <td data-nhan={t("apiKeyOutlets")}>{item.outlets.map((outlet) => outlet.name).join(", ")}</td>
                        <td data-nhan={keys("expiresOn")}>{item.expiresOn ? formatDate(item.expiresOn) : "—"}</td>
                        <td data-nhan={keys("lastUsed")}>{item.lastUsedAt ? formatDateTime(item.lastUsedAt) : keys("never")}</td>
                        <td data-nhan={keys("status")}>
                          <span className={`nhan ${statusClass[item.status]}`}>{keys(`status_${item.status}`)}</span>
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
    </>
  );
}
