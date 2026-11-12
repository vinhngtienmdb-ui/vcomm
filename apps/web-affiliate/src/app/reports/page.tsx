"use client";

// MAN_HINH_176 Báo cáo và đối soát (chủ cửa hàng; CONG_VIEC_55; CHUC_NANG_196; API_212): thẻ Đối soát – bảng tuần, chi tiết giao dịch, xác nhận, khiếu nại, công nợ.
// Thẻ Báo cáo (lát L4; API_213): chỉ tiêu theo kỳ, điểm bán, nhóm theo ngày, tuần, tháng; dư nợ, hạn mức còn lại. Thẻ Giao dịch: tìm, lọc giao dịch (API_208).
import type { AffiliateSettlementDetail, AffiliateSettlementItem, AffiliateTransactionItem, MerchantPortalReport, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SettlementBreakdown, SettlementDue, SettlementNet, SettlementStatus } from "ui/components/AffiliateSettlement";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatNumber, vietnamToday } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

function SettlementDrawer({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("affiliateSettlement");
  const { state, reload } = usePortalApi<AffiliateSettlementDetail>(`/merchant-portal/settlements/${id}`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const act = (settlement: AffiliateSettlementDetail, action: "confirm" | "dispute") =>
    void run(async () => {
      await portalFetch(`/merchant-portal/settlements/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "dispute" ? { reason, version: settlement.version } : { version: settlement.version }),
      });
      onDone(t(`done_${action}`));
    });
  return (
    <Drawer title={t("detailTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settlement) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <div style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
              <strong>{settlement.documentNo}</strong>
              <SettlementStatus settlement={settlement} />
            </div>
            <SettlementBreakdown settlement={settlement} />
            {settlement.status === "awaiting_confirmation" && (
              <>
                <p className="chu-thich" style={{ margin: 0 }}>
                  {t("confirmHint")}
                </p>
                {disputing && (
                  <Field id="ly-do-khieu-nai" label={t("disputeReason")} error={fields.reason}>
                    <textarea id="ly-do-khieu-nai" className={inputClass("reason")} rows={3} value={reason} placeholder={t("disputePlaceholder")} onChange={(event) => setReason(event.target.value)} />
                  </Field>
                )}
                <FormError text={formError} />
                <div className="nhom-nut">
                  {disputing ? (
                    <>
                      <button type="button" className="nut phu" onClick={() => setDisputing(false)}>
                        {t("cancel")}
                      </button>
                      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => act(settlement, "dispute")}>
                        {t("sendDispute")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="nut phu" onClick={() => setDisputing(true)}>
                        {t("dispute")}
                      </button>
                      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => act(settlement, "confirm")}>
                        {t("confirm")}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

function SettlementsTab() {
  const t = useTranslations("affiliateSettlement");
  const { notify } = usePortal();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { state, reload } = usePortalApi<PageResponse<AffiliateSettlementItem>>(`/merchant-portal/settlements?pageSize=100${status ? `&status=${status}` : ""}`);
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="loc-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {(["awaiting_confirmation", "disputed", "confirmed", "paid"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("column_no")}</th>
                    <th>{t("column_week")}</th>
                    <th className="so">{t("column_net")}</th>
                    <th>{t("column_status")}</th>
                    <th>{t("column_due")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("column_no")}>
                        <button type="button" className="nut chu" onClick={() => setOpen(item.id)}>
                          {item.documentNo}
                        </button>
                      </td>
                      <td data-nhan={t("column_week")}>
                        {formatDate(item.weekStart)} – {formatDate(item.weekEnd)}
                      </td>
                      <td data-nhan={t("column_net")} className="so">
                        <SettlementNet settlement={item} />
                      </td>
                      <td data-nhan={t("column_status")}>
                        <SettlementStatus settlement={item} />
                      </td>
                      <td data-nhan={t("column_due")}>
                        <SettlementDue settlement={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {open && (
        <SettlementDrawer
          id={open}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            notify(message);
            void reload();
          }}
        />
      )}
    </>
  );
}

const money = (value: string) => formatNumber(value, 0);
const firstOfMonth = (day: string) => `${day.slice(0, 8)}01`;

function ReportTab() {
  const t = useTranslations("affiliateReport");
  const { membership } = usePortal();
  const today = vietnamToday();
  const [filter, setFilter] = useState({ from: firstOfMonth(today), to: today, outletId: "", groupBy: "day" });
  const params = new URLSearchParams({ from: filter.from, to: filter.to, groupBy: filter.groupBy, ...(filter.outletId ? { outletId: filter.outletId } : {}) });
  const { state, reload } = usePortalApi<MerchantPortalReport>(`/merchant-portal/report?${params}`);
  const set = (key: keyof typeof filter, value: string) => setFilter({ ...filter, [key]: value });
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="tu-ngay" className="an-nhan">
          {t("from")}
        </label>
        <input id="tu-ngay" type="date" className="o-nhap" value={filter.from} onChange={(event) => set("from", event.target.value)} />
        <label htmlFor="den-ngay" className="an-nhan">
          {t("to")}
        </label>
        <input id="den-ngay" type="date" className="o-nhap" value={filter.to} onChange={(event) => set("to", event.target.value)} />
        <label htmlFor="diem-ban" className="an-nhan">
          {t("outlet")}
        </label>
        <select id="diem-ban" className="o-nhap" value={filter.outletId} onChange={(event) => set("outletId", event.target.value)}>
          <option value="">{t("allOutlets")}</option>
          {membership.outlets.map((outlet) => (
            <option key={outlet.id} value={outlet.id}>
              {outlet.name}
            </option>
          ))}
        </select>
        <label htmlFor="nhom-theo" className="an-nhan">
          {t("groupBy")}
        </label>
        <select id="nhom-theo" className="o-nhap" value={filter.groupBy} onChange={(event) => set("groupBy", event.target.value)}>
          {(["day", "week", "month"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`groupBy_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(report) => {
          const used = Math.min(Number(report.exposure.percent), 100);
          return (
            <>
              <div className="luoi-so">
                <div className="o-so">
                  <span className="nhan-so">{t("transactions")}</span>
                  <span className="gia-tri">{formatNumber(report.totals.transactions, 0)}</span>
                </div>
                <div className="o-so">
                  <span className="nhan-so">{t("billAmount")}</span>
                  <span className="gia-tri">{money(report.totals.billAmount)}</span>
                </div>
                <div className="o-so">
                  <span className="nhan-so">{t("customers")}</span>
                  <span className="gia-tri">
                    {formatNumber(report.totals.customers, 0)} / {formatNumber(report.totals.newCustomers, 0)}
                  </span>
                </div>
                <div className="o-so">
                  <span className="nhan-so">{t("earned")}</span>
                  <span className="gia-tri">
                    {formatNumber(report.totals.earnedPoints, 0)} ({money(report.totals.earnedAmount)})
                  </span>
                </div>
                <div className="o-so">
                  <span className="nhan-so">{t("redeemed")}</span>
                  <span className="gia-tri">
                    {formatNumber(report.totals.redeemedPoints, 0)} ({money(report.totals.redeemedAmount)})
                  </span>
                </div>
                <div className="o-so">
                  <span className="nhan-so">{t("vouchers")}</span>
                  <span className="gia-tri">{formatNumber(report.totals.vouchersUsed, 0)}</span>
                </div>
              </div>
              <div className="the">
                <h3 style={{ margin: 0 }}>{t("exposureTitle")}</h3>
                <div className={`thanh-han-muc${used >= 80 ? " vuot" : ""}`} role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${used}%` }} />
                </div>
                <p style={{ margin: 0 }}>
                  {t("exposure", {
                    amount: money(report.exposure.amount),
                    limit: money(report.exposure.creditLimit),
                    remaining: money(report.exposure.remaining),
                    percent: report.exposure.percent.replace(".", ","),
                  })}
                </p>
                {used >= 80 && <div className="khoi-canh-bao canh-bao">{t("exposureWarning")}</div>}
              </div>
              {report.rows.length === 0 ? (
                <MessageView text={t("empty")} />
              ) : (
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(`period_${filter.groupBy}`)}</th>
                        <th className="so">{t("transactions")}</th>
                        <th className="so">{t("billAmount")}</th>
                        <th className="so">{t("earnedPoints")}</th>
                        <th className="so">{t("redeemedPoints")}</th>
                        <th className="so">{t("vouchers")}</th>
                        <th className="so">{t("newCustomers")}</th>
                        <th className="so">{t("cancelled")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.period}>
                          <td data-nhan={t(`period_${filter.groupBy}`)}>{filter.groupBy === "month" ? row.period.split("-").reverse().join("/") : formatDate(row.period)}</td>
                          <td data-nhan={t("transactions")} className="so">
                            {formatNumber(row.transactions, 0)}
                          </td>
                          <td data-nhan={t("billAmount")} className="so">
                            {money(row.billAmount)}
                          </td>
                          <td data-nhan={t("earnedPoints")} className="so">
                            {formatNumber(row.earnedPoints, 0)}
                          </td>
                          <td data-nhan={t("redeemedPoints")} className="so">
                            {formatNumber(row.redeemedPoints, 0)}
                          </td>
                          <td data-nhan={t("vouchers")} className="so">
                            {formatNumber(row.vouchersUsed, 0)}
                          </td>
                          <td data-nhan={t("newCustomers")} className="so">
                            {formatNumber(row.newCustomers, 0)}
                          </td>
                          <td data-nhan={t("cancelled")} className="so">
                            {formatNumber(row.cancelled, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </Loaded>
    </>
  );
}

function TransactionsTab() {
  const t = useTranslations("affiliateReport");
  const counter = useTranslations("merchantPortal");
  const { membership } = usePortal();
  const today = vietnamToday();
  const [filter, setFilter] = useState({ from: firstOfMonth(today), to: today, outletId: "", status: "", search: "" });
  const params = new URLSearchParams({
    from: filter.from,
    to: filter.to,
    pageSize: "100",
    ...(filter.outletId ? { outletId: filter.outletId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.search.trim() ? { search: filter.search.trim() } : {}),
  });
  const { state, reload } = usePortalApi<PageResponse<AffiliateTransactionItem>>(`/merchant-portal/transactions?${params}`);
  const set = (key: keyof typeof filter, value: string) => setFilter({ ...filter, [key]: value });
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="tim-giao-dich" className="an-nhan">
          {t("search")}
        </label>
        <input id="tim-giao-dich" className="o-nhap" placeholder={t("searchPlaceholder")} value={filter.search} onChange={(event) => set("search", event.target.value)} />
        <label htmlFor="gd-tu-ngay" className="an-nhan">
          {t("from")}
        </label>
        <input id="gd-tu-ngay" type="date" className="o-nhap" value={filter.from} onChange={(event) => set("from", event.target.value)} />
        <label htmlFor="gd-den-ngay" className="an-nhan">
          {t("to")}
        </label>
        <input id="gd-den-ngay" type="date" className="o-nhap" value={filter.to} onChange={(event) => set("to", event.target.value)} />
        <label htmlFor="gd-diem-ban" className="an-nhan">
          {t("outlet")}
        </label>
        <select id="gd-diem-ban" className="o-nhap" value={filter.outletId} onChange={(event) => set("outletId", event.target.value)}>
          <option value="">{t("allOutlets")}</option>
          {membership.outlets.map((outlet) => (
            <option key={outlet.id} value={outlet.id}>
              {outlet.name}
            </option>
          ))}
        </select>
        <label htmlFor="gd-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="gd-trang-thai" className="o-nhap" value={filter.status} onChange={(event) => set("status", event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {(["completed", "cancelled", "pending", "declined", "expired"] as const).map((value) => (
            <option key={value} value={value}>
              {counter(`status_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noTransactions")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("column_document")}</th>
                    <th>{t("column_time")}</th>
                    <th>{t("outlet")}</th>
                    <th>{t("column_method")}</th>
                    <th className="so">{t("billAmount")}</th>
                    <th className="so">{t("redeemedPoints")}</th>
                    <th className="so">{t("earnedPoints")}</th>
                    <th>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("column_document")}>{item.documentNo}</td>
                      <td data-nhan={t("column_time")}>{formatDateTime(item.createdAt)}</td>
                      <td data-nhan={t("outlet")}>{item.outletName}</td>
                      <td data-nhan={t("column_method")}>{counter(`method_${item.method}`)}</td>
                      <td data-nhan={t("billAmount")} className="so">
                        {money(item.billAmount)}
                      </td>
                      <td data-nhan={t("redeemedPoints")} className="so">
                        {formatNumber(item.redeemedPoints, 0)}
                      </td>
                      <td data-nhan={t("earnedPoints")} className="so">
                        {formatNumber(item.earnedPoints, 0)}
                      </td>
                      <td data-nhan={t("status")}>{counter(`status_${item.status}`)}</td>
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

const tabs = ["report", "settlements", "transactions"] as const;

export default function ReportsPage() {
  const t = useTranslations("affiliateReport");
  const portal = useTranslations("merchantPortal");
  const [tab, setTab] = useState<(typeof tabs)[number]>("report");
  const awaiting = usePortalApi<PageResponse<AffiliateSettlementItem>>("/merchant-portal/settlements?status=awaiting_confirmation&pageSize=1");
  const count = awaiting.state.kind === "ready" ? awaiting.state.data.total : 0;
  return (
    <>
      <div className="tieu-de">
        <h1>{portal("menu_reports")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`tab_${item}`)} {item === "settlements" && count > 0 && <span className="huy-hieu">{count}</span>}
          </button>
        ))}
      </div>
      {tab === "report" && <ReportTab />}
      {tab === "settlements" && <SettlementsTab />}
      {tab === "transactions" && <TransactionsTab />}
    </>
  );
}
