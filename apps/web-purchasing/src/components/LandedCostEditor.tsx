"use client";

// Soạn chứng từ chi phí nhập khẩu (CHUC_NANG_161; QUYTAC_NGHIEPVU_289): tờ khai đã ghi sổ, nhà cung cấp dịch vụ, hóa đơn, tiền tệ, các khoản chi phí và tiêu thức.
import {
  landedCostBases,
  landedCostKinds,
  vatRates,
  type CurrencyResponse,
  type ImportDeclarationListItem,
  type LandedCostBasis,
  type LandedCostKind,
  type LandedCostResponse,
  type PageResponse,
  type PurchasingOptionsResponse,
  type SaveLandedCostRequest,
  type VatRate,
} from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type Line = { kind: LandedCostKind; description: string; amount: string; vatRate: VatRate; basis: LandedCostBasis };
const plain = (value: string) => value.replace(/[,\s]/g, "");

export function LandedCostEditor({ cost, onSaved, onCancel }: { cost: LandedCostResponse | null; onSaved: (saved: LandedCostResponse) => void; onCancel: () => void }) {
  const t = useTranslations("landedCosts");
  const common = useTranslations("common");
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const declarations = useApi<PageResponse<ImportDeclarationListItem>>("/purchasing/import-declarations?status=posted&pageSize=100");
  const currencies = useApi<CurrencyResponse[]>("/currencies");
  const companyCurrency = options.state.kind === "ready" ? options.state.data.currency : "";
  const [declarationId, setDeclarationId] = useState(cost?.declarationId ?? "");
  const [supplierId, setSupplierId] = useState(cost?.supplierId ?? "");
  const [invoiceNo, setInvoiceNo] = useState(cost?.invoiceNo ?? "");
  const [documentDate, setDocumentDate] = useState(cost?.documentDate ?? vietnamToday());
  const [currency, setCurrency] = useState(cost?.currency ?? "");
  const [note, setNote] = useState(cost?.note ?? "");
  const [lines, setLines] = useState<Line[]>(
    cost?.lines.map((line) => ({ kind: line.kind, description: line.description ?? "", amount: line.amount, vatRate: line.vatRate, basis: line.basis })) ?? [
      { kind: "international_freight", description: "", amount: "", vatRate: "10", basis: "value" },
    ],
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const setLine = (index: number, change: Partial<Line>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...change } : line)));

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveLandedCostRequest = {
        declarationId,
        supplierId,
        invoiceNo,
        documentDate,
        currency: currency || null,
        note,
        lines: lines.map((line) => ({ kind: line.kind, description: line.description, amount: plain(line.amount), vatRate: line.vatRate, basis: line.basis })),
        ...(cost ? { version: cost.version } : {}),
      };
      onSaved(await apiFetch<LandedCostResponse>(cost ? `/purchasing/landed-costs/${cost.id}` : "/purchasing/landed-costs", { method: cost ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <section className="the">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
          <Field id="to-khai" label={`${t("declaration")} *`} hint={t("declarationHint")} error={fields.declarationId}>
            <select id="to-khai" className={inputClass("declarationId")} value={declarationId} onChange={(event) => setDeclarationId(event.target.value)}>
              <option value="">{t("choose")}</option>
              {(declarations.state.kind === "ready" ? declarations.state.data.data : []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.declarationNo} · {item.orderNo} · {formatDate(item.registeredOn)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="nha-cung-cap-dich-vu" label={`${t("supplier")} *`} hint={t("supplierHint")} error={fields.supplierId}>
            <select id="nha-cung-cap-dich-vu" className={inputClass("supplierId")} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">{t("choose")}</option>
              {(options.state.kind === "ready" ? options.state.data.suppliers : []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.code} · {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="so-hoa-don" label={`${t("invoiceNo")} *`} error={fields.invoiceNo}>
            <input id="so-hoa-don" className={inputClass("invoiceNo")} value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} />
          </Field>
          <Field id="ngay-chung-tu" label={`${t("documentDate")} *`} hint={t("documentDateHint")} error={fields.documentDate}>
            <input id="ngay-chung-tu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
          </Field>
          <Field id="tien-te-chi-phi" label={t("currency")} hint={t("currencyHint")} error={fields.currency}>
            <select
              id="tien-te-chi-phi"
              className={inputClass("currency")}
              value={currency || companyCurrency}
              onChange={(event) => setCurrency(event.target.value === companyCurrency ? "" : event.target.value)}
            >
              {(currencies.state.kind === "ready" ? currencies.state.data : []).map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.nameVi}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="ghi-chu-chi-phi" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu-chi-phi" rows={2} className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </section>
      <h2 style={{ margin: 0 }}>{t("lines")}</h2>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("basisHint")}
      </p>
      {fields.lines && <div className="khoi-canh-bao loi">{fields.lines}</div>}
      {lines.map((line, index) => (
        <fieldset key={index} className="the" style={{ margin: 0 }}>
          <legend className="an-nhan">{t("lineLegend", { number: index + 1 })}</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
            <Field id={`loai-${index}`} label={t("kind")}>
              <select id={`loai-${index}`} className="o-nhap" value={line.kind} onChange={(event) => setLine(index, { kind: event.target.value as LandedCostKind })}>
                {landedCostKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`kind_${kind}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`dien-giai-${index}`} label={t("description")} error={fields[`lines.${index}.description`]}>
              <input id={`dien-giai-${index}`} className="o-nhap" value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} />
            </Field>
            <Field id={`tien-${index}`} label={`${t("amount")} *`} error={fields[`lines.${index}.amount`]}>
              <input id={`tien-${index}`} inputMode="decimal" className="o-nhap" value={line.amount} onChange={(event) => setLine(index, { amount: event.target.value })} />
            </Field>
            <Field id={`thue-suat-cp-${index}`} label={t("vatRate")}>
              <select id={`thue-suat-cp-${index}`} className="o-nhap" value={line.vatRate} onChange={(event) => setLine(index, { vatRate: event.target.value as VatRate })}>
                {vatRates.map((rate) => (
                  <option key={rate} value={rate}>
                    {t(`vat_${rate}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`tieu-thuc-${index}`} label={t("basis")} error={fields[`lines.${index}.basis`]}>
              <select id={`tieu-thuc-${index}`} className="o-nhap" value={line.basis} onChange={(event) => setLine(index, { basis: event.target.value as LandedCostBasis })}>
                {landedCostBases.map((basis) => (
                  <option key={basis} value={basis}>
                    {t(`basis_${basis}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {lines.length > 1 && (
            <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => setLines(lines.filter((_, position) => position !== index))}>
              {t("removeLine")}
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setLines([...lines, { kind: "other", description: "", amount: "", vatRate: "10", basis: "value" }])}>
        {t("addLine")}
      </button>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className="nut chinh" disabled={submitting}>
          {common("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {common("cancel")}
        </button>
      </div>
    </form>
  );
}
