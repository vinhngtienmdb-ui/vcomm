"use client";

// MAN_HINH_305 Phí thuê bao iPOS – phiếu phí (CONG_VIEC_74 L7; CHUC_NANG_253; QUYTAC_NGHIEPVU_599 đến 603; API_356).
// Lọc trạng thái, cách thu, kỳ, quá hạn; chi tiết: nơi đã trừ, hóa đơn điện tử, công nợ, bút toán; hủy phiếu chờ thu (lý do), lập lại kỳ đã hủy.
import { iposFeeInvoiceStatuses, type IposFeeInvoice, type IposFeeInvoiceDetail, type PageResponse } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const methods = ["vietqr", "collection_deduction", "settlement_deduction"] as const;
const statusClass = { awaiting: "canh-bao", paid: "thanh-cong", voided: "trung-tinh" } as const;
const money = (value: string) => formatNumber(value, 0);

function FeeDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (id: string) => void }) {
  const t = useTranslations("ipos");
  const { state, reload } = useApi<IposFeeInvoiceDetail>(`/ipos/fee-invoices/${id}`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  return (
    <Drawer title={t("feeInvoiceTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(item) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <p style={{ margin: 0 }}>
              <strong>{item.documentNo}</strong> <span className={`nhan ${statusClass[item.status]}`}>{t(`feeStatus_${item.status}`)}</span>
              {item.overdue ? <span className="nhan loi"> {t("feeOverdue")}</span> : null}
            </p>
            <div className="khung-bang">
              <table>
                <tbody>
                  <tr>
                    <th>{t("merchant")}</th>
                    <td>
                      <Link href={`/affiliate/merchants/${item.merchantId}`}>{item.merchantCode}</Link> {item.merchantName} · {item.outletName}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("plan")}</th>
                    <td>
                      {item.planName} · {t("feePeriod", { from: formatDate(item.periodStart), to: formatDate(item.periodEnd) })}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("feeAmount")}</th>
                    <td>
                      {money(item.monthlyPrice)} × {item.periodMonths} = {money(item.amount)}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("feeTax", { percent: item.taxPercent })}</th>
                    <td>{money(item.taxAmount)}</td>
                  </tr>
                  <tr>
                    <th>{t("feeTotal")}</th>
                    <td>
                      <strong>{money(item.total)}</strong> · {t("feePaid")} {money(item.paidAmount)} · {t("feeRemaining")} {money(item.remaining)}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("billingMethod")}</th>
                    <td>
                      {t(`billing_${item.method}`)}
                      {item.switchedToVietqr ? ` · ${t("feeSwitched")}` : ""}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("feeIssuedOn")}</th>
                    <td>
                      {formatDate(item.issuedOn)} · {t("feeDueOn")} {formatDate(item.dueOn)}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("feeDeductedAt")}</th>
                    <td>
                      {item.settlementNo ? <div>{t("feeInSettlement", { number: item.settlementNo })}</div> : null}
                      {item.deductions.map((line, index) => (
                        <div key={index}>
                          {t("feeInPayout", { number: line.payoutNo ?? t("feePayoutPending"), amount: money(line.amount) })}
                          {line.transferred ? ` · ${t("feeTransferred")}` : ""}
                        </div>
                      ))}
                      {!item.settlementNo && item.deductions.length === 0 ? "—" : null}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("feeEinvoice")}</th>
                    <td>{item.einvoice ? `${item.einvoice.invoiceNo ?? t("feeEinvoiceDraft")} · ${t(`feeEinvoiceStatus_${item.einvoice.status}`)}` : t("feeEinvoiceNone")}</td>
                  </tr>
                  <tr>
                    <th>{t("feeDebt")}</th>
                    <td>{item.debtOpenAmount === null ? "—" : money(item.debtOpenAmount)}</td>
                  </tr>
                  <tr>
                    <th>{t("feeJournals")}</th>
                    <td>{item.journalNos.join(", ") || "—"}</td>
                  </tr>
                  {item.voidReason ? (
                    <tr>
                      <th>{t("feeVoidReason")}</th>
                      <td>{item.voidReason}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {item.canManage && !voiding ? (
              <div className="nhom-nut">
                <button type="button" className="nut nguy-hiem" onClick={() => setVoiding(true)}>
                  {t("feeVoid")}
                </button>
              </div>
            ) : null}
            {item.canReissue ? (
              <div className="nhom-nut">
                <button
                  type="button"
                  className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
                  disabled={submitting}
                  onClick={() =>
                    void run(async () => {
                      const created = await apiFetch<IposFeeInvoiceDetail>(`/ipos/subscriptions/${item.subscriptionId}/fee-invoices`, {
                        method: "POST",
                        body: JSON.stringify({ periodStart: item.periodStart }),
                      });
                      onChanged(created.id);
                    })
                  }
                >
                  {t("feeReissue")}
                </button>
              </div>
            ) : null}
            {voiding ? (
              <>
                <Field id="phi-ly-do" label={t("reason")} error={fields.reason}>
                  <textarea id="phi-ly-do" className={inputClass("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                <div className="nhom-nut">
                  <button type="button" className="nut phu" onClick={() => setVoiding(false)}>
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
                    disabled={submitting || !reason.trim()}
                    onClick={() =>
                      void run(async () => {
                        await apiFetch(`/ipos/fee-invoices/${item.id}/void`, { method: "POST", body: JSON.stringify({ reason, version: item.version }) });
                        setVoiding(false);
                        onChanged(item.id);
                        await reload();
                      })
                    }
                  >
                    {t("feeVoidConfirm")}
                  </button>
                </div>
              </>
            ) : null}
            <FormError text={formError} />
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

export default function IposFeesPage() {
  const t = useTranslations("ipos");
  const common = useTranslations("common");
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [period, setPeriod] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(period ? { period } : {}),
    ...(overdue ? { overdue: "true" } : {}),
  });
  const { state, reload } = useApi<PageResponse<IposFeeInvoice>>(`/ipos/fee-invoices?${params}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("feesTitle")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="phi-trang-thai">
          {t("status")}
        </label>
        <select id="phi-trang-thai" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">{t("allStatuses")}</option>
          {iposFeeInvoiceStatuses.map((value) => (
            <option key={value} value={value}>
              {t(`feeStatus_${value}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="phi-cach-thu">
          {t("billingMethod")}
        </label>
        <select id="phi-cach-thu" className="o-nhap" value={method} onChange={(event) => (setMethod(event.target.value), setPage(1))}>
          <option value="">{t("allMethods")}</option>
          {methods.map((value) => (
            <option key={value} value={value}>
              {t(`billing_${value}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="phi-ky">
          {t("feePeriodFilter")}
        </label>
        <input id="phi-ky" className="o-nhap" type="month" value={period} onChange={(event) => (setPeriod(event.target.value), setPage(1))} />
        <label>
          <input type="checkbox" checked={overdue} onChange={(event) => (setOverdue(event.target.checked), setPage(1))} /> {t("feeOverdueOnly")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noFeeInvoices")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("feeNumber")}</th>
                      <th>{t("merchant")}</th>
                      <th>{t("outlet")}</th>
                      <th>{t("feePeriodShort")}</th>
                      <th className="so">{t("feeTotal")}</th>
                      <th className="so">{t("feeRemaining")}</th>
                      <th>{t("billingMethod")}</th>
                      <th>{t("feeDueOn")}</th>
                      <th>{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("feeNumber")}>
                          <button type="button" className="nut chu" onClick={() => setOpen(item.id)}>
                            {item.documentNo}
                          </button>
                        </td>
                        <td data-nhan={t("merchant")}>
                          <Link href={`/affiliate/merchants/${item.merchantId}`}>{item.merchantCode}</Link> {item.merchantName}
                        </td>
                        <td data-nhan={t("outlet")}>{item.outletName}</td>
                        <td data-nhan={t("feePeriodShort")}>
                          {formatDate(item.periodStart)} – {formatDate(item.periodEnd)}
                        </td>
                        <td data-nhan={t("feeTotal")} className="so">
                          {money(item.total)}
                        </td>
                        <td data-nhan={t("feeRemaining")} className="so">
                          {money(item.remaining)}
                        </td>
                        <td data-nhan={t("billingMethod")}>{t(`billing_${item.method}`)}</td>
                        <td data-nhan={t("feeDueOn")}>{formatDate(item.dueOn)}</td>
                        <td data-nhan={t("status")}>
                          <span className={`nhan ${item.overdue ? "loi" : statusClass[item.status]}`}>{item.overdue ? t("feeOverdue") : t(`feeStatus_${item.status}`)}</span>
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
      {open ? (
        <FeeDrawer
          key={open}
          id={open}
          onClose={() => setOpen(null)}
          onChanged={(id) => {
            setOpen(id);
            void reload();
          }}
        />
      ) : null}
    </>
  );
}
