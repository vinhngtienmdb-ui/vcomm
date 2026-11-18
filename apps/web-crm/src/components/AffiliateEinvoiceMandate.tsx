"use client";

// MAN_HINH_279 phần Ủy nhiệm lập hóa đơn điện tử (CONG_VIEC_73 lát L6; QUYTAC_NGHIEPVU_588; API_334): dữ liệu ủy nhiệm, ký hiệu theo năm,
// tệp văn bản ủy nhiệm (PDF, tối đa 10 MB), việc chờ lập và nút "Lập bù" cho người có affiliate.manage.
import type { EinvoiceMandateRequest, EinvoiceMandateResponse, TransactionEinvoice } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { ApiFailure, apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type Form = Omit<EinvoiceMandateRequest, "version" | "series" | "defaultVatRate" | "expiresOn"> & {
  defaultVatRate: string;
  expiresOn: string;
  series: { year: string; series: string }[];
};

const vatRates = ["0", "5", "8", "10", "exempt", "not_declared"] as const;
const emptyForm = (year: number): Form => ({
  sellerName: "",
  taxCode: "",
  address: "",
  taxMethod: "deduction",
  defaultVatRate: "10",
  mandateNo: "",
  effectiveFrom: "",
  expiresOn: "",
  series: [{ year: String(year), series: "" }],
});

export function AffiliateEinvoiceMandate({ merchantId, onSaved }: { merchantId: string; onSaved: (message: string) => void }) {
  const t = useTranslations("affiliate");
  const tErrors = useTranslations("errors");
  const { state, reload } = useApi<EinvoiceMandateResponse>(`/affiliate/merchants/${merchantId}/einvoice-mandate`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState<Form>(emptyForm(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reissuing, setReissuing] = useState<string | null>(null);
  const [backlogError, setBacklogError] = useState<string | null>(null);
  const data = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    if (!data) return;
    const mandate = data.mandate;
    setForm(
      mandate
        ? {
            sellerName: mandate.sellerName,
            taxCode: mandate.taxCode,
            address: mandate.address,
            taxMethod: mandate.taxMethod,
            defaultVatRate: mandate.defaultVatRate ?? "10",
            mandateNo: mandate.mandateNo,
            effectiveFrom: mandate.effectiveFrom,
            expiresOn: mandate.expiresOn ?? "",
            series: data.series.map((item) => ({ year: String(item.year), series: item.series })),
          }
        : emptyForm(new Date().getFullYear()),
    );
  }, [data]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setSeries = (index: number, patch: Partial<Form["series"][number]>) =>
    setForm((current) => ({ ...current, series: current.series.map((item, position) => (position === index ? { ...item, ...patch } : item)) }));
  return (
    <section className="the">
      <h2>{t("mandateTitle")}</h2>
      <Loaded state={state} onRetry={() => void reload()}>
        {(current) => {
          const disabled = !current.canManage;
          return (
            <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
              <p className="chu-thich" style={{ margin: 0 }}>
                {t("mandateHint")}
              </p>
              {!current.einvoiceEnabled && <div className="khoi-canh-bao canh-bao">{t("mandateEinvoiceOff")}</div>}
              {current.einvoiceEnabled && !current.providerSupportsMandate && <div className="khoi-canh-bao canh-bao">{t("mandateProviderUnsupported", { provider: current.provider ?? "" })}</div>}
              <form
                style={{ display: "grid", gap: "var(--khoang-3)" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const body: EinvoiceMandateRequest = {
                      sellerName: form.sellerName,
                      taxCode: form.taxCode,
                      address: form.address,
                      taxMethod: form.taxMethod,
                      defaultVatRate: form.taxMethod === "deduction" ? (form.defaultVatRate as EinvoiceMandateRequest["defaultVatRate"]) : null,
                      mandateNo: form.mandateNo,
                      effectiveFrom: form.effectiveFrom,
                      expiresOn: form.expiresOn || null,
                      series: form.series.filter((item) => item.series.trim()).map((item) => ({ year: Number(item.year), series: item.series.trim().toUpperCase() })),
                      version: current.version,
                    };
                    await apiFetch(`/affiliate/merchants/${merchantId}/einvoice-mandate`, { method: "PUT", body: JSON.stringify(body) });
                    await reload();
                    onSaved(t("saved"));
                  });
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" }}>
                  <Field id="ten-nguoi-ban" label={t("mandateSellerName")} error={fields.sellerName}>
                    <input id="ten-nguoi-ban" className={inputClass("sellerName")} maxLength={300} disabled={disabled} value={form.sellerName} onChange={(event) => set("sellerName", event.target.value)} />
                  </Field>
                  <Field id="mst-nguoi-ban" label={t("mandateTaxCode")} error={fields.taxCode}>
                    <input id="mst-nguoi-ban" className={inputClass("taxCode")} maxLength={14} disabled={disabled} value={form.taxCode} onChange={(event) => set("taxCode", event.target.value)} />
                  </Field>
                  <Field id="dia-chi-nguoi-ban" label={t("mandateAddress")} error={fields.address}>
                    <input id="dia-chi-nguoi-ban" className={inputClass("address")} maxLength={300} disabled={disabled} value={form.address} onChange={(event) => set("address", event.target.value)} />
                  </Field>
                  <Field id="phuong-phap-thue" label={t("mandateTaxMethod")} error={fields.taxMethod}>
                    <select id="phuong-phap-thue" className={inputClass("taxMethod")} disabled={disabled} value={form.taxMethod} onChange={(event) => set("taxMethod", event.target.value as Form["taxMethod"])}>
                      <option value="deduction">{t("mandateTaxMethod_deduction")}</option>
                      <option value="direct">{t("mandateTaxMethod_direct")}</option>
                    </select>
                  </Field>
                  {form.taxMethod === "deduction" && (
                    <Field id="thue-suat-mac-dinh" label={t("mandateDefaultVatRate")} error={fields.defaultVatRate}>
                      <select id="thue-suat-mac-dinh" className={inputClass("defaultVatRate")} disabled={disabled} value={form.defaultVatRate} onChange={(event) => set("defaultVatRate", event.target.value)}>
                        {vatRates.map((rate) => (
                          <option key={rate} value={rate}>
                            {t(`mandateVat_${rate}`)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field id="so-uy-nhiem" label={t("mandateNo")} error={fields.mandateNo}>
                    <input id="so-uy-nhiem" className={inputClass("mandateNo")} maxLength={100} disabled={disabled} value={form.mandateNo} onChange={(event) => set("mandateNo", event.target.value)} />
                  </Field>
                  <Field id="hieu-luc-tu" label={t("mandateEffectiveFrom")} error={fields.effectiveFrom}>
                    <input id="hieu-luc-tu" type="date" className={inputClass("effectiveFrom")} disabled={disabled} value={form.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} />
                  </Field>
                  <Field id="het-han" label={t("mandateExpiresOn")} hint={t("mandateExpiresHint")} error={fields.expiresOn}>
                    <input id="het-han" type="date" className={inputClass("expiresOn")} disabled={disabled} value={form.expiresOn} onChange={(event) => set("expiresOn", event.target.value)} />
                  </Field>
                </div>
                <div>
                  <h3 style={{ margin: "0 0 var(--khoang-2)" }}>{t("mandateSeries")}</h3>
                  <p className="chu-thich" style={{ margin: "0 0 var(--khoang-2)" }}>
                    {t("mandateSeriesHint")}
                  </p>
                  {form.series.map((item, index) => (
                    <div key={index} style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)", alignItems: "end" }}>
                      <Field id={`nam-ky-hieu-${index}`} label={t("mandateSeriesYear")} error={fields[`series.${index}.year`]}>
                        <input
                          id={`nam-ky-hieu-${index}`}
                          inputMode="numeric"
                          maxLength={4}
                          className={inputClass(`series.${index}.year`)}
                          disabled={disabled}
                          value={item.year}
                          onChange={(event) => setSeries(index, { year: event.target.value })}
                          style={{ maxWidth: "7rem" }}
                        />
                      </Field>
                      <Field id={`ky-hieu-${index}`} label={t("mandateSeriesCode")} error={fields[`series.${index}.series`] ?? fields.series}>
                        <input
                          id={`ky-hieu-${index}`}
                          maxLength={6}
                          className={inputClass(`series.${index}.series`)}
                          disabled={disabled}
                          value={item.series}
                          onChange={(event) => setSeries(index, { series: event.target.value.toUpperCase() })}
                          style={{ maxWidth: "9rem" }}
                        />
                      </Field>
                      {!disabled && form.series.length > 1 && (
                        <button type="button" className="nut phu" onClick={() => setForm((value) => ({ ...value, series: value.series.filter((_, position) => position !== index) }))}>
                          {t("mandateSeriesRemove")}
                        </button>
                      )}
                    </div>
                  ))}
                  {!disabled && (
                    <button
                      type="button"
                      className="nut phu"
                      onClick={() =>
                        setForm((value) => ({ ...value, series: [...value.series, { year: String(Math.max(...value.series.map((item) => Number(item.year) || 0), new Date().getFullYear() - 1) + 1), series: "" }] }))
                      }
                    >
                      {t("mandateSeriesAdd")}
                    </button>
                  )}
                </div>
                <FormError text={formError} />
                {current.canManage && (
                  <div className="nhom-nut">
                    <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
                      {t("save")}
                    </button>
                  </div>
                )}
              </form>
              <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <h3 style={{ margin: 0 }}>{t("mandateFile")}</h3>
                {current.mandate?.file ? (
                  <p style={{ margin: 0 }}>
                    <button type="button" className="nut phu" onClick={() => void apiDownload(`/affiliate/merchants/${merchantId}/einvoice-mandate/file`, current.mandate!.file!.name, true)}>
                      {current.mandate.file.name}
                    </button>{" "}
                    <span className="chu-thich">{t("mandateFileSize", { size: formatNumber(String(Math.ceil(current.mandate.file.size / 1024)), 0) })}</span>
                  </p>
                ) : (
                  <p className="chu-thich" style={{ margin: 0 }}>
                    {current.mandate ? t("mandateFileNone") : t("mandateFileNeedsData")}
                  </p>
                )}
                {current.canManage && current.mandate && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)", alignItems: "center" }}>
                    <input type="file" accept="application/pdf,.pdf" aria-label={t("mandateFile")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                    <button
                      type="button"
                      className={`nut phu${uploading ? " dang-xu-ly" : ""}`}
                      disabled={!file || uploading}
                      onClick={async () => {
                        if (!file) return;
                        setUploading(true);
                        setFileError(null);
                        try {
                          const form = new FormData();
                          form.append("file", file);
                          await apiUpload(`/affiliate/merchants/${merchantId}/einvoice-mandate/file`, form);
                          setFile(null);
                          await reload();
                          onSaved(t("mandateFileSaved"));
                        } catch (error) {
                          setFileError(error instanceof ApiFailure ? (Object.values(error.body?.fields ?? {})[0] ?? error.message) : tErrors("internal"));
                        } finally {
                          setUploading(false);
                        }
                      }}
                    >
                      {t("mandateFileUpload")}
                    </button>
                  </div>
                )}
                <FormError text={fileError} />
              </div>
              <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <h3 style={{ margin: 0 }}>{t("backlogTitle", { count: current.backlog.length })}</h3>
                {current.backlog.length === 0 ? (
                  <p className="chu-thich" style={{ margin: 0 }}>
                    {t("backlogEmpty")}
                  </p>
                ) : (
                  <div className="khung-bang">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">{t("backlogTransaction")}</th>
                          <th scope="col">{t("backlogDate")}</th>
                          <th scope="col">{t("backlogAmount")}</th>
                          <th scope="col">{t("backlogReason")}</th>
                          {current.canManage && <th scope="col" />}
                        </tr>
                      </thead>
                      <tbody>
                        {current.backlog.map((item) => (
                          <tr key={item.transactionId}>
                            <td data-nhan={t("backlogTransaction")}>{item.documentNo}</td>
                            <td data-nhan={t("backlogDate")}>{formatDateTime(item.transactionDate)}</td>
                            <td data-nhan={t("backlogAmount")}>{formatNumber(item.amount, 0)}</td>
                            <td data-nhan={t("backlogReason")}>{t(`backlogReason_${item.reason}`)}</td>
                            {current.canManage && (
                              <td>
                                <button
                                  type="button"
                                  className={`nut phu${reissuing === item.transactionId ? " dang-xu-ly" : ""}`}
                                  disabled={reissuing !== null}
                                  onClick={async () => {
                                    setReissuing(item.transactionId);
                                    setBacklogError(null);
                                    try {
                                      const invoice = await apiFetch<TransactionEinvoice>(`/affiliate/transactions/${item.transactionId}/einvoice`, { method: "POST" });
                                      onSaved(t("reissued", { no: invoice.invoiceNo ?? "", date: formatDate(invoice.invoiceDate) }));
                                    } catch (error) {
                                      setBacklogError(error instanceof ApiFailure ? error.message : tErrors("internal"));
                                    } finally {
                                      setReissuing(null);
                                      await reload();
                                    }
                                  }}
                                >
                                  {t("reissue")}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <FormError text={backlogError} />
              </div>
            </div>
          );
        }}
      </Loaded>
    </section>
  );
}
