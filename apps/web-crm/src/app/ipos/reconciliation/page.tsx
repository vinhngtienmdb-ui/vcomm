"use client";

// MAN_HINH_306 Doanh thu và đối soát iPOS (CONG_VIEC_74 L6; CHUC_NANG_260; QUYTAC_NGHIEPVU_626, 627; API_357). Chỉ đọc; thẻ Phí làm ở lát L7.
import type { IposErpRevenue, IposMismatchRow, IposReconciliation } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type Tab = "revenue" | "collection" | "loyalty";
const tabs: Tab[] = ["revenue", "collection", "loyalty"];

const vietnamToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const daysBefore = (day: string, days: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
const money = (value: string | null) => (value === null ? "—" : formatNumber(value, 0));

function Revenue({ query }: { query: string }) {
  const t = useTranslations("ipos");
  const { state, reload } = useApi<IposErpRevenue>(`/ipos/reports/revenue?${query}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(result) =>
        result.rows.length === 0 ? (
          <MessageView text={t("erpNoRevenue")} />
        ) : (
          <>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("merchant")}</th>
                    <th>{t("outlet")}</th>
                    <th className="so">{t("erpNetRevenue")}</th>
                    <th className="so">{t("erpSales")}</th>
                    <th className="so">{t("erpCash")}</th>
                    <th className="so">{t("erpVietqr")}</th>
                    <th className="so">{t("erpVcommApp")}</th>
                    <th className="so">{t("erpPointsVoucher")}</th>
                    <th className="so">{t("erpReturns")}</th>
                    <th className="so">{t("erpShifts")}</th>
                    <th className="so">{t("erpCashDifference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.rows, { ...result.totals, merchantId: "", merchantName: t("erpTotal"), outletId: "", outletName: "" }].map((row) => (
                    <tr key={row.outletId || "tong"}>
                      <td data-nhan={t("merchant")}>{row.merchantId ? <Link href={`/affiliate/merchants/${row.merchantId}`}>{row.merchantName}</Link> : <strong>{row.merchantName}</strong>}</td>
                      <td data-nhan={t("outlet")}>{row.outletName}</td>
                      <td data-nhan={t("erpNetRevenue")} className="so">
                        <strong>{money(row.netRevenue)}</strong>
                      </td>
                      <td data-nhan={t("erpSales")} className="so">
                        {formatNumber(row.salesCount, 0)}
                      </td>
                      <td data-nhan={t("erpCash")} className="so">
                        {money(row.cash)}
                      </td>
                      <td data-nhan={t("erpVietqr")} className="so">
                        {money(row.vietqr)}
                      </td>
                      <td data-nhan={t("erpVcommApp")} className="so">
                        {money(row.vcommApp)}
                      </td>
                      <td data-nhan={t("erpPointsVoucher")} className="so">
                        {money(row.pointsVoucher)}
                      </td>
                      <td data-nhan={t("erpReturns")} className="so">
                        {Number(row.returns) > 0 ? `−${money(row.returns)}` : "0"}
                      </td>
                      <td data-nhan={t("erpShifts")} className="so">
                        {formatNumber(row.shiftCount, 0)}
                      </td>
                      <td data-nhan={t("erpCashDifference")} className="so">
                        {money(row.cashDifference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="chu-phu">{t("erpRevenueNote")}</p>
          </>
        )
      }
    </Loaded>
  );
}

function Mismatches({ kind, query }: { kind: "collection" | "loyalty"; query: string }) {
  const t = useTranslations("ipos");
  const { state, reload } = useApi<IposReconciliation>(`/ipos/reconciliation/${kind}?${query}`);
  const vcommLabel = kind === "collection" ? t("erpCollectedAmount") : t("erpLoyaltyAmount");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(result) => (
        <>
          <p className="chu-phu">{t("erpMatched", { count: result.matched, amount: formatNumber(result.matchedAmount, 0) })}</p>
          {result.mismatches.length === 0 ? (
            <MessageView text={t("erpNoMismatch")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("erpMismatchKind")}</th>
                    <th>{t("merchant")}</th>
                    <th>{t("erpTime")}</th>
                    <th>{t("erpInvoice")}</th>
                    <th>{t("erpVcommDocument")}</th>
                    <th className="so">{t("erpIposAmount")}</th>
                    <th className="so">{vcommLabel}</th>
                    {kind === "loyalty" ? <th>{t("erpSettlement")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {result.mismatches.map((row: IposMismatchRow, index) => (
                    <tr key={`${row.transactionId ?? row.checkoutNo ?? row.saleDocumentNo}-${index}`}>
                      <td data-nhan={t("erpMismatchKind")}>
                        <span className="nhan canh-bao">{t(`erpKind_${kind}_${row.kind}`)}</span>
                      </td>
                      <td data-nhan={t("merchant")}>
                        <Link href={`/affiliate/merchants/${row.merchantId}`}>{row.merchantName}</Link> · {row.outletName}
                      </td>
                      <td data-nhan={t("erpTime")}>{formatDateTime(row.occurredAt)}</td>
                      <td data-nhan={t("erpInvoice")}>
                        {row.saleDocumentNo ?? "—"}
                        {row.saleStatus === "cancelled" ? ` (${t("erpCancelled")})` : ""}
                      </td>
                      <td data-nhan={t("erpVcommDocument")}>
                        {[row.checkoutNo, row.transactionNo].filter(Boolean).join(" · ") || "—"}
                        {row.transactionStatus && row.transactionStatus !== "completed" ? ` (${t(`erpTransaction_${row.transactionStatus}`)})` : ""}
                      </td>
                      <td data-nhan={t("erpIposAmount")} className="so">
                        {money(row.iposAmount)}
                      </td>
                      <td data-nhan={vcommLabel} className="so">
                        {money(row.vcommAmount)}
                      </td>
                      {kind === "loyalty" ? <td data-nhan={t("erpSettlement")}>{row.settlementNo ?? t("erpNotSettled")}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="chu-phu">{t("erpReconciliationNote")}</p>
        </>
      )}
    </Loaded>
  );
}

export default function IposReconciliationPage() {
  const t = useTranslations("ipos");
  const today = vietnamToday();
  const [tab, setTab] = useState<Tab>("revenue");
  const [from, setFrom] = useState(daysBefore(today, 6));
  const [to, setTo] = useState(today);
  const query = new URLSearchParams({ from, to }).toString();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("reconciliationTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`erpTab_${item}`)}
          </button>
        ))}
      </div>
      <div className="bo-loc">
        <label className="truong">
          <span>{t("erpFrom")}</span>
          <input className="o-nhap" type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} />
        </label>
        <label className="truong">
          <span>{t("erpTo")}</span>
          <input className="o-nhap" type="date" value={to} min={from} max={today} onChange={(event) => event.target.value && setTo(event.target.value)} />
        </label>
      </div>
      {tab === "revenue" ? <Revenue query={query} /> : <Mismatches key={tab} kind={tab} query={query} />}
    </>
  );
}
