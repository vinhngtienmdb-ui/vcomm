"use client";

// MAN_HINH_54 thẻ "Chờ xử lý trả hàng" (CHUC_NANG_78; QUYTAC_NGHIEPVU_106): lập hóa đơn điều chỉnh giảm hoặc ghi hóa đơn trả hàng của người mua.
import { einvoiceReturnStatuses, type EinvoiceResponse, type EinvoiceReturnStatus, type EinvoiceReturnTask } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export function EinvoiceReturns() {
  const t = useTranslations("einvoices");
  const { notify } = useAdmin();
  const [status, setStatus] = useState<EinvoiceReturnStatus | "">("open");
  const { state, reload } = useApi<EinvoiceReturnTask[]>(`/finance/einvoice-returns${status ? `?status=${status}` : ""}`);
  const [recording, setRecording] = useState<EinvoiceReturnTask | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function adjust(task: EinvoiceReturnTask) {
    setBusy(task.id);
    setError(null);
    try {
      const invoice = await apiFetch<EinvoiceResponse>(`/finance/einvoice-returns/${task.id}/adjust`, { method: "POST", body: JSON.stringify({ version: task.version }) });
      notify(t("adjustmentCreated", { status: t(`status_${invoice.status}`) }));
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(null);
    }
  }
  const headings = [t("returnDocument"), t("buyer"), t("returnAmount"), t("originalInvoice"), t("returnStatus"), ""];
  return (
    <>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-tra-hang">
          {t("returnStatus")}
        </label>
        <select id="loc-tra-hang" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value as EinvoiceReturnStatus | "")}>
          <option value="">{t("allStatuses")}</option>
          {einvoiceReturnStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`return_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <FormError text={error} />
      {recording && (
        <BuyerInvoiceForm
          task={recording}
          onCancel={() => setRecording(null)}
          onDone={() => {
            setRecording(null);
            notify(t("buyerInvoiceRecorded"));
            void reload();
          }}
        />
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(tasks) =>
          tasks.length === 0 ? (
            <MessageView text={t("noReturns")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={`${heading}-${index}`} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td data-nhan={headings[0]}>
                        <span>
                          {task.returnDocumentNo ?? "—"}
                          <span className="chu-thich"> · {formatDate(task.returnDate)}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{task.buyerName || t("anonymousBuyer")}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {formatNumber(task.returnAmount)} {task.currency}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          <Link href={`/einvoices/${task.original.id}`}>{task.original.invoiceNo ? `${task.original.series} · ${task.original.invoiceNo}` : t("noNumber")}</Link>
                          {task.original.status !== "issued" && <span className="chu-thich"> · {t("waitingOriginal")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {t(`return_${task.status}`)}
                          {task.adjustmentInvoiceId && (
                            <>
                              {" · "}
                              <Link href={`/einvoices/${task.adjustmentInvoiceId}`}>{t("viewAdjustment")}</Link>
                            </>
                          )}
                          {task.buyerInvoice && (
                            <span className="chu-thich">
                              {" "}
                              · {t("buyerInvoiceLine", { series: task.buyerInvoice.series ?? "", number: task.buyerInvoice.invoiceNo, date: formatDate(task.buyerInvoice.invoiceDate) })}
                            </span>
                          )}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        {task.canResolve && (
                          <span className="nhom-nut">
                            <button type="button" className={`nut chinh${busy === task.id ? " dang-xu-ly" : ""}`} disabled={busy !== null} onClick={() => void adjust(task)}>
                              {t("createAdjustment")}
                            </button>
                            {task.buyerTaxCode && (
                              <button type="button" className="nut phu" onClick={() => setRecording(task)}>
                                {t("recordBuyerInvoice")}
                              </button>
                            )}
                          </span>
                        )}
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

function BuyerInvoiceForm({ task, onCancel, onDone }: { task: EinvoiceReturnTask; onCancel: () => void; onDone: () => void }) {
  const t = useTranslations("einvoices");
  const [series, setSeries] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(vietnamToday());
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/finance/einvoice-returns/${task.id}/buyer-invoice`, { method: "POST", body: JSON.stringify({ series, invoiceNo, invoiceDate, version: task.version }) });
      onDone();
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <strong>{t("buyerInvoiceTitle", { document: task.returnDocumentNo ?? "", buyer: task.buyerName })}</strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="hd-mua-ky-hieu" label={t("buyerSeries")} error={fields.series}>
          <input id="hd-mua-ky-hieu" className={inputClass("series")} value={series} onChange={(event) => setSeries(event.target.value.toUpperCase())} />
        </Field>
        <Field id="hd-mua-so" label={`${t("buyerInvoiceNo")} *`} error={fields.invoiceNo}>
          <input id="hd-mua-so" className={inputClass("invoiceNo")} value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} />
        </Field>
        <Field id="hd-mua-ngay" label={`${t("buyerInvoiceDate")} *`} error={fields.invoiceDate}>
          <input id="hd-mua-ngay" type="date" className={inputClass("invoiceDate")} value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
        </Field>
      </div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
