"use client";

// MAN_HINH_54 Chi tiết hóa đơn điện tử (CHUC_NANG_77; QUYTAC_NGHIEPVU_104, 105; API_91): người bán, người mua, dòng hàng, tổng theo thuế suất, các lần gửi; gửi lại, tải PDF, XML.
import type { EinvoiceResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { EinvoiceStatusBadge } from "@/components/EinvoiceStatusBadge";

const vatLabel = (rate: string) => (rate === "exempt" ? "KCT" : rate === "not_declared" ? "KKKNT" : `${rate}%`);

export default function EinvoicePage() {
  const t = useTranslations("einvoices");
  const errors = useTranslations("errors");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<EinvoiceResponse>(`/finance/einvoices/${id}`);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function resend(invoice: EinvoiceResponse) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/finance/einvoices/${invoice.id}/resend`, { method: "POST", body: JSON.stringify({ version: invoice.version }) });
      notify(t("resent"));
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(invoice: EinvoiceResponse, format: "pdf" | "xml") {
    setError(null);
    try {
      await apiDownload(`/finance/einvoices/${invoice.id}/file/${format}`, `${invoice.series ?? "HD"}-${invoice.invoiceNo ?? ""}.${format}`, format === "pdf");
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }
  // Lỗi từ nhà cung cấp có thể là khóa thông báo (einvoice…) hoặc câu chữ của nhà cung cấp.
  const errorMessage = (value: string) => (value.startsWith("einvoice") && errors.has(value as never) ? errors(value as never) : value);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(invoice) => {
        const lineHeadings = [t("lineNo"), t("item"), t("unit"), t("quantity"), t("unitPrice"), t("vatRate"), t("netAmount"), t("taxAmount")];
        return (
          <>
            <p>
              <Link href="/einvoices">‹ {t("title")}</Link>
            </p>
            <div className="tieu-de">
              <h1>{invoice.invoiceNo ? t("invoiceTitle", { series: invoice.series ?? "", number: invoice.invoiceNo }) : t("invoiceDraftTitle")}</h1>
              <span className="nhom-nut">
                {invoice.canManage && ["failed", "setup_error", "retrying", "rejected"].includes(invoice.status) && (
                  <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void resend(invoice)}>
                    {t("resend")}
                  </button>
                )}
                {invoice.canManage &&
                  invoice.status === "issued" &&
                  invoice.kind !== "adjustment" &&
                  !invoice.replaced &&
                  !invoice.related.some((item) => item.relation === "adjusted_by" || (item.relation === "replaced_by" && !["failed", "rejected"].includes(item.status))) && (
                    <button type="button" className="nut phu" onClick={() => setReplacing(true)}>
                      {t("replace")}
                    </button>
                  )}
                {invoice.hasPdf && (
                  <button type="button" className="nut phu" onClick={() => void download(invoice, "pdf")}>
                    {t("downloadPdf")}
                  </button>
                )}
                {invoice.hasXml && (
                  <button type="button" className="nut phu" onClick={() => void download(invoice, "xml")}>
                    {t("downloadXml")}
                  </button>
                )}
              </span>
            </div>
            <FormError text={error} />
            {replacing && <ReplaceForm invoice={invoice} onCancel={() => setReplacing(false)} />}
            {invoice.note && <p className="chu-thich">{t("noteLine", { note: invoice.note })}</p>}
            {invoice.related.length > 0 && (
              <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <strong>{t("relatedInvoices")}</strong>
                {invoice.related.map((item) => (
                  <div key={item.id}>
                    {t(`relation_${item.relation}`)}: <Link href={`/einvoices/${item.id}`}>{item.invoiceNo ? `${item.series} · ${item.invoiceNo}` : t("noNumber")}</Link>
                    <span className="chu-thich"> · {formatDate(item.invoiceDate)}</span>
                  </div>
                ))}
              </section>
            )}
            {invoice.lastError && <div className="khoi-canh-bao loi">{t("lastError", { message: errorMessage(invoice.lastError) })}</div>}
            {invoice.provider === "simulator" && <div className="khoi-canh-bao">{t("simulatorNote")}</div>}
            <section className="the" style={{ display: "grid", gap: "var(--khoang-2)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div>
                <span className="chu-thich">{t("status")}</span>
                <div>
                  <EinvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} replaced={invoice.replaced} />
                </div>
              </div>
              <div>
                <span className="chu-thich">{t("invoiceDate")}</span>
                <div>{formatDate(invoice.invoiceDate)}</div>
              </div>
              <div>
                <span className="chu-thich">{t("templateSeries")}</span>
                <div>
                  {invoice.templateCode} · {invoice.series ?? "—"}
                </div>
              </div>
              <div>
                <span className="chu-thich">{t("taxAuthorityCode")}</span>
                <div style={{ wordBreak: "break-all" }}>{invoice.taxAuthorityCode ?? (invoice.withTaxCode ? "—" : t("withoutCode"))}</div>
              </div>
              <div>
                <span className="chu-thich">{t("dueDate")}</span>
                <div>{formatDate(invoice.dueDate)}</div>
              </div>
              <div>
                <span className="chu-thich">{t("sourceDocument")}</span>
                <div>{invoice.sourceDocumentNo ?? "—"}</div>
              </div>
            </section>
            <section className="the" style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {(["seller", "buyer"] as const).map((side) => {
                const party = invoice[side];
                return (
                  <div key={side}>
                    <strong>{t(side)}</strong>
                    <div>{party.name || (party.anonymous ? t("anonymousBuyer") : "—")}</div>
                    {party.anonymous && party.name && <div className="chu-thich">{t("anonymousBuyer")}</div>}
                    <div className="chu-thich">
                      {t("taxCode")}: {party.taxCode ?? "—"}
                    </div>
                    <div className="chu-thich">
                      {t("address")}: {party.address ?? "—"}
                    </div>
                  </div>
                );
              })}
            </section>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {lineHeadings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.lineNo}>
                      <td data-nhan={lineHeadings[0]}>
                        <span>{line.lineNo}</span>
                      </td>
                      <td data-nhan={lineHeadings[1]}>
                        <span>
                          {line.itemName}
                          {line.isPromotion && <span className="chu-thich"> · {t("promotion")}</span>}
                        </span>
                      </td>
                      <td data-nhan={lineHeadings[2]}>
                        <span>{line.unitName ?? ""}</span>
                      </td>
                      <td data-nhan={lineHeadings[3]}>
                        <span>{formatNumber(line.quantity)}</span>
                      </td>
                      <td data-nhan={lineHeadings[4]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.unitPrice)}</span>
                      </td>
                      <td data-nhan={lineHeadings[5]}>
                        <span>{vatLabel(line.vatRate)}</span>
                      </td>
                      <td data-nhan={lineHeadings[6]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.netAmount)}</span>
                      </td>
                      <td data-nhan={lineHeadings[7]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.taxAmount)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              {invoice.taxSummary.map((item) => (
                <div key={item.vatRate} className="chu-thich">
                  {t("taxSummaryLine", { rate: vatLabel(item.vatRate), net: formatNumber(item.netAmount), tax: formatNumber(item.taxAmount) })}
                </div>
              ))}
              <div>
                {t("netAmount")}: <strong>{formatNumber(invoice.netAmount)}</strong> · {t("taxAmount")}: <strong>{formatNumber(invoice.taxAmount)}</strong>
              </div>
              <div>
                {t("totalAmount")}:{" "}
                <strong>
                  {formatNumber(invoice.totalAmount)} {invoice.currency}
                </strong>
              </div>
            </section>
            <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <strong>{t("attempts")}</strong>
              {invoice.attempts.length === 0 && <span className="chu-thich">{t("noAttempts")}</span>}
              {invoice.attempts.map((attempt) => (
                <div key={attempt.startedAt} className="chu-thich">
                  {formatDateTime(attempt.startedAt)} · {t(`operation_${attempt.operation}`)} · {attempt.outcome ? t(`outcome_${attempt.outcome}`) : t("outcome_running")}
                  {attempt.message && ` · ${errorMessage(attempt.message)}`}
                </div>
              ))}
            </section>
          </>
        );
      }}
    </Loaded>
  );
}

// Hóa đơn thay thế khi sai thông tin người mua (CHUC_NANG_79; QUYTAC_NGHIEPVU_107).
function ReplaceForm({ invoice, onCancel }: { invoice: EinvoiceResponse; onCancel: () => void }) {
  const t = useTranslations("einvoices");
  const { notify } = useAdmin();
  const router = useRouter();
  const [buyerName, setBuyerName] = useState(invoice.buyer.name ?? "");
  const [buyerTaxCode, setBuyerTaxCode] = useState(invoice.buyer.taxCode ?? "");
  const [buyerAddress, setBuyerAddress] = useState(invoice.buyer.address ?? "");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await apiFetch<EinvoiceResponse>(`/finance/einvoices/${invoice.id}/replace`, {
        method: "POST",
        body: JSON.stringify({ buyerName, buyerTaxCode, buyerAddress, reason, version: invoice.version }),
      });
      notify(t("replacementCreated"));
      router.push(`/einvoices/${created.id}`);
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <strong>{t("replaceTitle")}</strong>
      <span className="chu-thich">{t("replaceHint")}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="tt-ten-nguoi-mua" label={`${t("buyerName")} *`} error={fields.buyerName}>
          <input id="tt-ten-nguoi-mua" className={inputClass("buyerName")} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
        </Field>
        <Field id="tt-mst-nguoi-mua" label={t("taxCode")} error={fields.buyerTaxCode}>
          <input id="tt-mst-nguoi-mua" inputMode="numeric" className={inputClass("buyerTaxCode")} value={buyerTaxCode} onChange={(event) => setBuyerTaxCode(event.target.value)} />
        </Field>
        <Field id="tt-dia-chi-nguoi-mua" label={t("address")} error={fields.buyerAddress}>
          <input id="tt-dia-chi-nguoi-mua" className={inputClass("buyerAddress")} value={buyerAddress} onChange={(event) => setBuyerAddress(event.target.value)} />
        </Field>
      </div>
      <Field id="tt-ly-do" label={`${t("reason")} *`} error={fields.reason}>
        <input id="tt-ly-do" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("createReplacement")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
