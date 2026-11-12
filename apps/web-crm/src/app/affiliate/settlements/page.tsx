"use client";

// MAN_HINH_180 Đối soát và giao dịch liên kết (CONG_VIEC_55; CHUC_NANG_196; API_212): thẻ Đối soát – bảng tuần mọi cửa hàng, lọc trạng thái, quá hạn;
// chi tiết; trả lời khiếu nại kèm điều chỉnh tiền và chốt lại. Thẻ Giao dịch (mọi cửa hàng, số điện thoại khách đã che), thẻ Báo cáo (theo cửa hàng, dư nợ), thẻ Cảnh báo bất thường (lát L4; API_213).
import type { AffiliateAlert, AffiliateCompanyReport, AffiliateCompanyTransaction, AffiliateMerchantListItem, AffiliateSettlementDetail, AffiliateSettlementItem, PageResponse } from "contracts";
import { affiliateAllTransactionMethods } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SettlementBreakdown, SettlementNet, SettlementStatus } from "ui/components/AffiliateSettlement";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

function ResolveForm({ settlement, onDone }: { settlement: AffiliateSettlementDetail; onDone: (message: string) => void }) {
  const t = useTranslations("affiliateSettlement");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState({ note: "", adjustmentAmount: "0", adjustmentReason: "" });
  const save = () =>
    void run(async () => {
      const amount = form.adjustmentAmount.replace(/[^\d-]/g, "") || "0";
      await apiFetch(`/affiliate/settlements/${settlement.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ note: form.note, adjustmentAmount: amount, adjustmentReason: form.adjustmentReason || null, version: settlement.version }),
      });
      onDone(t("done_resolve"));
    });
  return (
    <form style={{ display: "grid", gap: "var(--khoang-3)" }} onSubmit={(event) => (event.preventDefault(), save())}>
      <h3 style={{ margin: 0 }}>{t("resolveTitle")}</h3>
      <Field id="dieu-chinh" label={t("field_adjustmentAmount")} error={fields.adjustmentAmount} hint={t("adjustmentHint")}>
        <input id="dieu-chinh" className={inputClass("adjustmentAmount")} value={form.adjustmentAmount} onChange={(event) => setForm({ ...form, adjustmentAmount: event.target.value })} />
      </Field>
      <Field id="ly-do-dieu-chinh" label={t("field_adjustmentReason")} error={fields.adjustmentReason}>
        <input id="ly-do-dieu-chinh" className={inputClass("adjustmentReason")} value={form.adjustmentReason} onChange={(event) => setForm({ ...form, adjustmentReason: event.target.value })} />
      </Field>
      <Field id="tra-loi" label={t("field_note")} error={fields.note}>
        <textarea id="tra-loi" className={inputClass("note")} rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("resolve")}
        </button>
      </div>
    </form>
  );
}

function SettlementDrawer({ id, canManage, onClose, onDone }: { id: string; canManage: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("affiliateSettlement");
  const { state, reload } = useApi<AffiliateSettlementDetail>(`/affiliate/settlements/${id}`);
  return (
    <Drawer title={t("detailTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settlement) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <div style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
              <strong>
                {settlement.documentNo} · {settlement.merchantName}
              </strong>
              <SettlementStatus settlement={settlement} />
            </div>
            <SettlementBreakdown settlement={settlement} />
            {settlement.status === "confirmed" && <p className="chu-thich">{t("paymentHint")}</p>}
            {settlement.status === "disputed" && canManage && <ResolveForm settlement={settlement} onDone={onDone} />}
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

function SettlementsTab() {
  const t = useTranslations("affiliateSettlement");
  const common = useTranslations("common");
  const { can, notify } = useAdmin();
  const [merchantId, setMerchantId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const merchants = useApi<PageResponse<AffiliateMerchantListItem>>("/affiliate/merchants?pageSize=100");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(merchantId ? { merchantId } : {}),
    ...(status === "overdue" ? { overdue: "true" } : status ? { status } : {}),
  });
  const { state, reload } = useApi<PageResponse<AffiliateSettlementItem>>(`/affiliate/settlements?${params}`);
  const money = (value: string) => formatNumber(value, 0);
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="loc-cua-hang" className="an-nhan">
          {t("merchant")}
        </label>
        <select id="loc-cua-hang" className="o-nhap" value={merchantId} onChange={(event) => (setMerchantId(event.target.value), setPage(1))}>
          <option value="">{t("allMerchants")}</option>
          {merchants.state.kind === "ready" &&
            merchants.state.data.data.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
        </select>
        <label htmlFor="loc-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">{t("allStatuses")}</option>
          {(["awaiting_confirmation", "disputed", "confirmed", "paid"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
          <option value="overdue">{t("overdue")}</option>
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("column_no")}</th>
                      <th>{t("merchant")}</th>
                      <th>{t("column_week")}</th>
                      <th className="so">{t("column_a")}</th>
                      <th className="so">{t("column_b")}</th>
                      <th className="so">{t("column_c")}</th>
                      <th className="so">{t("column_fee")}</th>
                      <th className="so">{t("column_net")}</th>
                      <th>{t("column_status")}</th>
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
                        <td data-nhan={t("merchant")}>{item.merchantName}</td>
                        <td data-nhan={t("column_week")}>
                          {formatDate(item.weekStart)} – {formatDate(item.weekEnd)}
                        </td>
                        <td data-nhan={t("column_a")} className="so">
                          {money(String(Number(item.earnedAmount) + Number(item.shortfallAmount)))}
                        </td>
                        <td data-nhan={t("column_b")} className="so">
                          {money(item.redeemedAmount)}
                        </td>
                        <td data-nhan={t("column_c")} className="so">
                          {money(item.companyVoucherAmount)}
                        </td>
                        <td data-nhan={t("column_fee")} className="so">
                          {money(String(Number(item.feeAmount) + Number(item.feeTaxAmount)))}
                        </td>
                        <td data-nhan={t("column_net")} className="so">
                          <SettlementNet settlement={item} />
                        </td>
                        <td data-nhan={t("column_status")}>
                          <SettlementStatus settlement={item} />
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
      {open && (
        <SettlementDrawer
          id={open}
          canManage={can("affiliate.manage")}
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

const amount = (value: string) => formatNumber(value, 0);

function ReportTab() {
  const t = useTranslations("affiliateReport");
  const today = vietnamToday();
  const [filter, setFilter] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const { state, reload } = useApi<AffiliateCompanyReport>(`/affiliate/report?from=${filter.from}&to=${filter.to}`);
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="tu-ngay" className="an-nhan">
          {t("from")}
        </label>
        <input id="tu-ngay" type="date" className="o-nhap" value={filter.from} onChange={(event) => setFilter({ ...filter, from: event.target.value })} />
        <label htmlFor="den-ngay" className="an-nhan">
          {t("to")}
        </label>
        <input id="den-ngay" type="date" className="o-nhap" value={filter.to} onChange={(event) => setFilter({ ...filter, to: event.target.value })} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(report) =>
          report.rows.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("merchant")}</th>
                    <th className="so">{t("transactions")}</th>
                    <th className="so">{t("billAmount")}</th>
                    <th className="so">{t("earnedAmount")}</th>
                    <th className="so">{t("redeemedAmount")}</th>
                    <th className="so">{t("vouchers")}</th>
                    <th className="so">{t("fee")}</th>
                    <th className="so">{t("customers")}</th>
                    <th className="so">{t("exposureColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.merchantId}>
                      <td data-nhan={t("merchant")}>{row.merchantName}</td>
                      <td data-nhan={t("transactions")} className="so">
                        {formatNumber(row.transactions, 0)}
                      </td>
                      <td data-nhan={t("billAmount")} className="so">
                        {amount(row.billAmount)}
                      </td>
                      <td data-nhan={t("earnedAmount")} className="so">
                        {amount(row.earnedAmount)}
                      </td>
                      <td data-nhan={t("redeemedAmount")} className="so">
                        {amount(row.redeemedAmount)}
                      </td>
                      <td data-nhan={t("vouchers")} className="so">
                        {formatNumber(row.vouchersUsed, 0)}
                      </td>
                      <td data-nhan={t("fee")} className="so">
                        {amount(row.feeAmount)}
                      </td>
                      <td data-nhan={t("customers")} className="so">
                        {formatNumber(row.customers, 0)} / {formatNumber(row.newCustomers, 0)}
                      </td>
                      <td data-nhan={t("exposureColumn")} className="so">
                        {amount(row.exposure.amount)} / {amount(row.exposure.creditLimit)}
                        {Number(row.exposure.percent) >= 80 && <span className="nhan loi"> {row.exposure.percent.replace(".", ",")} %</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>{t("total")}</th>
                    <th className="so">{formatNumber(report.totals.transactions, 0)}</th>
                    <th className="so">{amount(report.totals.billAmount)}</th>
                    <th className="so">{amount(report.totals.earnedAmount)}</th>
                    <th className="so">{amount(report.totals.redeemedAmount)}</th>
                    <th className="so">{formatNumber(report.totals.vouchersUsed, 0)}</th>
                    <th className="so">{amount(report.totals.feeAmount)}</th>
                    <th className="so">
                      {formatNumber(report.totals.customers, 0)} / {formatNumber(report.totals.newCustomers, 0)}
                    </th>
                    <th />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}

// Mô tả số liệu của từng loại cảnh báo (7 ngày gần nhất).
function alertDetail(t: ReturnType<typeof useTranslations>, alert: AffiliateAlert): string {
  const percent = (alert.percent ?? "0").replace(".", ",");
  if (alert.kind === "same_buyer_burst") return t("detail_same_buyer_burst", { phone: alert.buyerPhone ?? "—", count: alert.count ?? 0, day: alert.day ? formatDate(alert.day) : "" });
  if (alert.kind === "near_cap") return t("detail_near_cap", { percent, count: alert.count ?? 0, total: alert.total ?? 0, cap: amount(alert.limit ?? "0") });
  if (alert.kind === "cancel_rate") return t("detail_cancel_rate", { percent, count: alert.count ?? 0, total: alert.total ?? 0 });
  if (alert.kind === "phone_declines") return t("detail_phone_declines", { name: alert.cashierName ?? "—", count: alert.count ?? 0, day: alert.day ? formatDate(alert.day) : "" });
  return t("detail_credit_usage", { amount: amount(alert.amount ?? "0"), limit: amount(alert.limit ?? "0"), percent });
}

function AlertsTab() {
  const t = useTranslations("affiliateReport");
  const [kind, setKind] = useState("");
  const { state, reload } = useApi<AffiliateAlert[]>(`/affiliate/alerts${kind ? `?kind=${kind}` : ""}`);
  return (
    <>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("alertsHint")}
      </p>
      <div className="bo-loc">
        <label htmlFor="loai-canh-bao" className="an-nhan">
          {t("alertKind")}
        </label>
        <select id="loai-canh-bao" className="o-nhap" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">{t("allKinds")}</option>
          {(["same_buyer_burst", "near_cap", "cancel_rate", "phone_declines", "credit_usage"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`kind_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(alerts) =>
          alerts.length === 0 ? (
            <MessageView text={t("noAlerts")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("alertKind")}</th>
                    <th>{t("merchant")}</th>
                    <th>{t("alertDetail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert, index) => (
                    <tr key={`${alert.kind}-${alert.merchantId}-${index}`}>
                      <td data-nhan={t("alertKind")}>
                        <span className={`nhan ${alert.kind === "credit_usage" ? "loi" : "canh-bao"}`}>{t(`kind_${alert.kind}`)}</span>
                      </td>
                      <td data-nhan={t("merchant")}>{alert.merchantName}</td>
                      <td data-nhan={t("alertDetail")}>{alertDetail(t, alert)}</td>
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

function TransactionsTab() {
  const t = useTranslations("affiliateReport");
  const portal = useTranslations("merchantPortal");
  const affiliate = useTranslations("affiliate");
  const common = useTranslations("common");
  const today = vietnamToday();
  const [filter, setFilter] = useState({ from: `${today.slice(0, 8)}01`, to: today, merchantId: "", method: "", status: "", search: "" });
  const [page, setPage] = useState(1);
  const merchants = useApi<PageResponse<AffiliateMerchantListItem>>("/affiliate/merchants?pageSize=100");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "50",
    from: filter.from,
    to: filter.to,
    ...Object.fromEntries(Object.entries({ merchantId: filter.merchantId, method: filter.method, status: filter.status, search: filter.search.trim() }).filter(([, value]) => value)),
  });
  const { state, reload } = useApi<PageResponse<AffiliateCompanyTransaction>>(`/affiliate/transactions?${params}`);
  const set = (key: keyof typeof filter, value: string) => (setFilter({ ...filter, [key]: value }), setPage(1));
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="gd-tim" className="an-nhan">
          {t("search")}
        </label>
        <input id="gd-tim" className="o-nhap" placeholder={t("searchPlaceholder")} value={filter.search} onChange={(event) => set("search", event.target.value)} />
        <label htmlFor="gd-tu" className="an-nhan">
          {t("from")}
        </label>
        <input id="gd-tu" type="date" className="o-nhap" value={filter.from} onChange={(event) => set("from", event.target.value)} />
        <label htmlFor="gd-den" className="an-nhan">
          {t("to")}
        </label>
        <input id="gd-den" type="date" className="o-nhap" value={filter.to} onChange={(event) => set("to", event.target.value)} />
        <label htmlFor="gd-cua-hang" className="an-nhan">
          {t("merchant")}
        </label>
        <select id="gd-cua-hang" className="o-nhap" value={filter.merchantId} onChange={(event) => set("merchantId", event.target.value)}>
          <option value="">{t("allMerchants")}</option>
          {merchants.state.kind === "ready" &&
            merchants.state.data.data.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
        </select>
        <label htmlFor="gd-cach" className="an-nhan">
          {t("column_method")}
        </label>
        <select id="gd-cach" className="o-nhap" value={filter.method} onChange={(event) => set("method", event.target.value)}>
          <option value="">{t("allMethods")}</option>
          {affiliateAllTransactionMethods.map((value) => (
            <option key={value} value={value}>
              {portal(`method_${value}`)}
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
              {portal(`status_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noTransactions")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("column_document")}</th>
                      <th>{t("column_time")}</th>
                      <th>{t("column_merchantOutlet")}</th>
                      <th>{t("column_buyer")}</th>
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
                        <td data-nhan={t("column_merchantOutlet")}>
                          {item.merchantName} · {item.outletName}
                        </td>
                        <td data-nhan={t("column_buyer")}>{item.buyerPhone ?? "—"}</td>
                        <td data-nhan={t("column_method")}>
                          {portal(`method_${item.method}`)}
                          {item.source === "open_api" && (
                            <>
                              {" "}
                              <span className="nhan thong-tin">{affiliate("source_open_api")}</span>
                            </>
                          )}
                        </td>
                        <td data-nhan={t("billAmount")} className="so">
                          {amount(item.billAmount)}
                        </td>
                        <td data-nhan={t("redeemedPoints")} className="so">
                          {formatNumber(item.redeemedPoints, 0)}
                        </td>
                        <td data-nhan={t("earnedPoints")} className="so">
                          {formatNumber(item.earnedPoints, 0)}
                        </td>
                        <td data-nhan={t("status")}>{portal(`status_${item.status}`)}</td>
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

const tabs = ["settlements", "transactions", "report", "alerts"] as const;

export default function AffiliateSettlementsPage() {
  const t = useTranslations("affiliateReport");
  const settlement = useTranslations("affiliateSettlement");
  const [tab, setTab] = useState<(typeof tabs)[number]>("settlements");
  const alerts = useApi<AffiliateAlert[]>("/affiliate/alerts");
  const disputed = useApi<PageResponse<AffiliateSettlementItem>>("/affiliate/settlements?status=disputed&pageSize=1");
  const badge = (item: (typeof tabs)[number]) => {
    const count = item === "alerts" ? (alerts.state.kind === "ready" ? alerts.state.data.length : 0) : item === "settlements" && disputed.state.kind === "ready" ? disputed.state.data.total : 0;
    return count > 0 ? <span className="huy-hieu">{count}</span> : null;
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{settlement("companyTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`tab_${item}`)} {badge(item)}
          </button>
        ))}
      </div>
      {tab === "settlements" && <SettlementsTab />}
      {tab === "transactions" && <TransactionsTab />}
      {tab === "report" && <ReportTab />}
      {tab === "alerts" && <AlertsTab />}
    </>
  );
}
