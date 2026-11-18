"use client";

// MAN_HINH_301 Thuê bao và phí iPOS trên cổng cửa hàng (CONG_VIEC_74 L7; QUYTAC_NGHIEPVU_596, 602; API_353): thuê bao từng điểm bán, hạn, ân hạn;
// phiếu phí; mã VietQR trả phí vào tài khoản của công ty vận hành sàn, nội dung là số phiếu.
import type { IposFeeVietqr, IposMerchantFeeOverview } from "contracts";
import qrcode from "qrcode-generator";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { usePortalApi } from "@/lib/portal-api";

const money = (value: string) => formatNumber(value, 0);
const subscriptionClass = { trial: "thong-tin", active: "thanh-cong", overdue: "canh-bao", locked: "loi", cancelled: "trung-tinh" } as const;
const invoiceClass = { awaiting: "canh-bao", paid: "thanh-cong", voided: "trung-tinh" } as const;

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(6, 8);
}

function VietqrDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("iposPortal");
  const { state, reload } = usePortalApi<IposFeeVietqr>(`/merchant-portal/ipos/fee-invoices/${id}/vietqr`);
  return (
    <Drawer title={t("feePayTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(qr) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)", justifyItems: "center", textAlign: "center" }}>
            <img src={qrDataUrl(qr.payload)} alt={t("feeQrAlt", { number: qr.documentNo })} style={{ width: 240, height: 240, imageRendering: "pixelated" }} />
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{money(qr.amount)}</p>
            <div className="khung-bang" style={{ width: "100%" }}>
              <table>
                <tbody>
                  <tr>
                    <th>{t("feeBank")}</th>
                    <td>{qr.bankName}</td>
                  </tr>
                  <tr>
                    <th>{t("feeAccount")}</th>
                    <td>
                      {qr.accountNumber} · {qr.accountName}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("feeTransferContent")}</th>
                    <td>
                      <strong>{qr.content}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="chu-thich" style={{ margin: 0 }}>
              {t("feePayHint")}
            </p>
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

export default function IposSubscriptionPage() {
  const t = useTranslations("iposPortal");
  const { state, reload } = usePortalApi<IposMerchantFeeOverview>("/merchant-portal/ipos/subscription");
  const [paying, setPaying] = useState<string | null>(null);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("subscriptionTitle")}</h1>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => (
          <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
            {data.subscriptions.some((item) => item.status === "overdue") ? (
              <div className="khoi-canh-bao" role="status">
                {t("feeOverdueNotice", { days: Math.min(...data.subscriptions.filter((item) => item.graceDaysLeft !== null).map((item) => item.graceDaysLeft!)) })}
              </div>
            ) : null}
            {data.subscriptions.some((item) => item.status === "locked") ? (
              <div className="khoi-canh-bao loi" role="status">
                {t("feeLockedNotice")}
              </div>
            ) : null}
            <p className="chu-thich" style={{ margin: 0 }}>
              {t("feeBillingMethod", { method: t(`feeMethod_${data.billingMethod ?? "vietqr"}`) })}
              {data.billingMethod === "free" ? ` · ${data.freeUntil ? t("feeFreeUntil", { date: formatDate(data.freeUntil) }) : t("feeFreeForever")}` : ""}
            </p>
            <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h2 style={{ margin: 0 }}>{t("subscriptionsTitle")}</h2>
              {data.subscriptions.length === 0 ? (
                <MessageView text={t("noIposSubscription")} />
              ) : (
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("outlet")}</th>
                        <th>{t("feePlan")}</th>
                        <th className="so">{t("feeMonthlyPrice")}</th>
                        <th>{t("feeEndsOn")}</th>
                        <th>{t("feeSubscriptionStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subscriptions.map((item) => (
                        <tr key={item.id}>
                          <td data-nhan={t("outlet")}>{item.outletName}</td>
                          <td data-nhan={t("feePlan")}>{item.planName}</td>
                          <td data-nhan={t("feeMonthlyPrice")} className="so">
                            {money(item.monthlyPrice)}
                          </td>
                          <td data-nhan={t("feeEndsOn")}>{formatDate(item.endsOn)}</td>
                          <td data-nhan={t("feeSubscriptionStatus")}>
                            <span className={`nhan ${subscriptionClass[item.status]}`}>{t(`feeSubscription_${item.status}`)}</span>
                            {item.graceDaysLeft !== null ? <div className="chu-thich">{t("feeGraceLeft", { days: item.graceDaysLeft })}</div> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h2 style={{ margin: 0 }}>{t("feeInvoicesTitle")}</h2>
              {data.invoices.length === 0 ? (
                <MessageView text={t("noFeeInvoices")} />
              ) : (
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("feeNumber")}</th>
                        <th>{t("outlet")}</th>
                        <th>{t("feePeriod")}</th>
                        <th className="so">{t("feeTotal")}</th>
                        <th className="so">{t("feeRemaining")}</th>
                        <th>{t("feeDueOn")}</th>
                        <th>{t("feeStatus")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((item) => (
                        <tr key={item.id}>
                          <td data-nhan={t("feeNumber")}>{item.documentNo}</td>
                          <td data-nhan={t("outlet")}>{item.outletName}</td>
                          <td data-nhan={t("feePeriod")}>
                            {formatDate(item.periodStart)} – {formatDate(item.periodEnd)}
                          </td>
                          <td data-nhan={t("feeTotal")} className="so">
                            {money(item.total)}
                          </td>
                          <td data-nhan={t("feeRemaining")} className="so">
                            {money(item.remaining)}
                          </td>
                          <td data-nhan={t("feeDueOn")}>{formatDate(item.dueOn)}</td>
                          <td data-nhan={t("feeStatus")}>
                            <span className={`nhan ${item.overdue ? "loi" : invoiceClass[item.status]}`}>{item.overdue ? t("feeOverdue") : t(`feeInvoice_${item.status}`)}</span>
                            <div className="chu-thich">{t(`feeMethod_${item.method}`)}</div>
                          </td>
                          <td>
                            {item.status === "awaiting" && item.method === "vietqr" ? (
                              <button type="button" className="nut chinh" onClick={() => setPaying(item.id)}>
                                {t("feePay")}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </Loaded>
      {paying ? <VietqrDrawer id={paying} onClose={() => setPaying(null)} /> : null}
    </>
  );
}
