"use client";

// Soạn tờ khai hải quan nhập khẩu (CHUC_NANG_160; QUYTAC_NGHIEPVU_287): đầu tờ khai, dòng theo dòng đơn mua, thuế để trống thì lấy số gợi ý.
import type { ImportDeclarationResponse, ImportOrderOption, SaveImportDeclarationRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";

type Line = {
  orderLineId: string;
  label: string;
  unitName: string;
  hint: string;
  quantity: string;
  customsValue: string;
  importDutyRate: string;
  importDuty: string;
  exciseTax: string;
  environmentalTax: string;
  vatRate: string;
  vatAmount: string;
};

// Số nhập: dấu chấm là dấu thập phân, bỏ dấu phẩy, khoảng trắng.
const plain = (value: string) => value.replace(/[,\s]/g, "");

export function DeclarationEditor({
  order,
  declaration,
  onSaved,
  onCancel,
}: {
  order: ImportOrderOption;
  declaration: ImportDeclarationResponse | null;
  onSaved: (saved: ImportDeclarationResponse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("importDeclarations");
  const common = useTranslations("common");
  const saved = new Map((declaration?.lines ?? []).map((line) => [line.orderLineId, line]));
  const [declarationNo, setDeclarationNo] = useState(declaration?.declarationNo ?? "");
  const [registeredOn, setRegisteredOn] = useState(declaration?.registeredOn ?? vietnamToday());
  const [postingDate, setPostingDate] = useState(declaration?.postingDate ?? vietnamToday());
  const [customsRate, setCustomsRate] = useState(declaration?.customsRate ?? "");
  const [note, setNote] = useState(declaration?.note ?? "");
  const [customsOffice, setCustomsOffice] = useState(declaration?.customsOffice ?? "");
  const [taxDueDate, setTaxDueDate] = useState(declaration?.taxDueDate ?? "");
  const [lines, setLines] = useState<Line[]>(
    order.lines.map((line) => {
      const current = saved.get(line.orderLineId);
      const remaining = (Number(line.orderedBaseQuantity) - Number(line.declaredBaseQuantity)) / Number(line.factor) + Number(current?.quantity ?? 0);
      return {
        orderLineId: line.orderLineId,
        label: `${line.sku} · ${line.productName}`,
        unitName: line.unitName,
        hint: t("lineHint", { ordered: formatNumber(line.quantity), received: formatNumber(line.receivedBaseQuantity), declared: formatNumber(line.declaredBaseQuantity) }),
        quantity: current?.quantity ?? (declaration ? "" : String(Number(Math.max(0, remaining).toFixed(4)))),
        customsValue: current?.customsValue ?? (declaration ? "" : String(Number((Math.max(0, remaining) * Number(line.unitPrice)).toFixed(4)))),
        importDutyRate: current?.importDutyRate ?? "0",
        importDuty: current?.importDutyEdited ? current.importDuty : "",
        exciseTax: current?.exciseTax ?? "0",
        environmentalTax: current?.environmentalTax ?? "0",
        vatRate: current?.vatRate ?? "10",
        vatAmount: current?.vatEdited ? current.vatAmount : "",
      };
    }),
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const setLine = (index: number, change: Partial<Line>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...change } : line)));
  // Chỉ gửi dòng có số lượng khai; giữ vị trí để báo lỗi đúng dòng.
  const included = lines.map((line, index) => ({ line, index })).filter(({ line }) => Number(plain(line.quantity)) > 0);
  const lineError = (index: number, field: string) => {
    const position = included.findIndex((item) => item.index === index);
    return position < 0 ? undefined : fields[`lines.${position}.${field}`];
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveImportDeclarationRequest = {
        orderId: order.id,
        declarationNo,
        registeredOn,
        postingDate,
        customsRate: plain(customsRate),
        note,
        customsOffice,
        taxDueDate: taxDueDate || null,
        lines: included.map(({ line }) => ({
          orderLineId: line.orderLineId,
          quantity: plain(line.quantity),
          customsValue: plain(line.customsValue),
          importDutyRate: plain(line.importDutyRate) || "0",
          importDuty: plain(line.importDuty) || null,
          exciseTax: plain(line.exciseTax) || "0",
          environmentalTax: plain(line.environmentalTax) || "0",
          vatRate: plain(line.vatRate) || "0",
          vatAmount: plain(line.vatAmount) || null,
        })),
        ...(declaration ? { version: declaration.version } : {}),
      };
      onSaved(
        await apiFetch<ImportDeclarationResponse>(declaration ? `/purchasing/import-declarations/${declaration.id}` : "/purchasing/import-declarations", {
          method: declaration ? "PATCH" : "POST",
          body: JSON.stringify(body),
        }),
      );
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <section className="the">
        <div className="chu-thich">{t("orderLine", { order: order.documentNo, supplier: order.supplierName, currency: order.currency })}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
          <Field id="so-to-khai" label={`${t("declarationNo")} *`} error={fields.declarationNo}>
            <input id="so-to-khai" className={inputClass("declarationNo")} value={declarationNo} onChange={(event) => setDeclarationNo(event.target.value)} />
          </Field>
          <Field id="ngay-dang-ky" label={`${t("registeredOn")} *`} error={fields.registeredOn}>
            <input id="ngay-dang-ky" type="date" className={inputClass("registeredOn")} value={registeredOn} onChange={(event) => setRegisteredOn(event.target.value)} />
          </Field>
          <Field id="ngay-ghi-so" label={`${t("postingDate")} *`} hint={t("postingDateHint")} error={fields.postingDate}>
            <input id="ngay-ghi-so" type="date" className={inputClass("postingDate")} value={postingDate} onChange={(event) => setPostingDate(event.target.value)} />
          </Field>
          <Field id="ty-gia-tinh-thue" label={`${t("customsRate", { currency: order.currency })} *`} hint={t("customsRateHint")} error={fields.customsRate}>
            <input id="ty-gia-tinh-thue" inputMode="decimal" className={inputClass("customsRate")} value={customsRate} onChange={(event) => setCustomsRate(event.target.value)} />
          </Field>
          <Field id="chi-cuc-hai-quan" label={t("customsOffice")} error={fields.customsOffice}>
            <input id="chi-cuc-hai-quan" className={inputClass("customsOffice")} value={customsOffice} onChange={(event) => setCustomsOffice(event.target.value)} />
          </Field>
          <Field id="han-nop-thue" label={t("taxDueDate")} hint={t("taxDueDateHint")} error={fields.taxDueDate}>
            <input id="han-nop-thue" type="date" className={inputClass("taxDueDate")} value={taxDueDate} onChange={(event) => setTaxDueDate(event.target.value)} />
          </Field>
        </div>
        <Field id="ghi-chu-to-khai" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu-to-khai" rows={2} className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </section>
      <h2 style={{ margin: 0 }}>{t("lines")}</h2>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("taxHint")}
      </p>
      {fields.orderId && <div className="khoi-canh-bao loi">{fields.orderId}</div>}
      {lines.map((line, index) => {
        const converted = Math.round(Number(plain(line.customsValue) || 0) * Number(plain(customsRate) || 0));
        return (
          <fieldset key={line.orderLineId} className="the" style={{ margin: 0 }}>
            <legend className="an-nhan">{line.label}</legend>
            <strong>{line.label}</strong>
            <span className="chu-thich">{line.hint}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--khoang-3)" }}>
              <Field id={`so-luong-${index}`} label={t("quantity", { unit: line.unitName })} error={lineError(index, "quantity") ?? lineError(index, "orderLineId")}>
                <input id={`so-luong-${index}`} inputMode="decimal" className="o-nhap" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} />
              </Field>
              <Field
                id={`tri-gia-${index}`}
                label={t("customsValue", { currency: order.currency })}
                hint={t("converted", { amount: formatNumber(converted) })}
                error={lineError(index, "customsValue")}
              >
                <input id={`tri-gia-${index}`} inputMode="decimal" className="o-nhap" value={line.customsValue} onChange={(event) => setLine(index, { customsValue: event.target.value })} />
              </Field>
              <Field id={`thue-suat-nk-${index}`} label={t("importDutyRate")} error={lineError(index, "importDutyRate")}>
                <input id={`thue-suat-nk-${index}`} inputMode="decimal" className="o-nhap" value={line.importDutyRate} onChange={(event) => setLine(index, { importDutyRate: event.target.value })} />
              </Field>
              <Field id={`thue-nk-${index}`} label={t("importDuty")} hint={t("blankSuggest")} error={lineError(index, "importDuty")}>
                <input id={`thue-nk-${index}`} inputMode="decimal" className="o-nhap" value={line.importDuty} onChange={(event) => setLine(index, { importDuty: event.target.value })} />
              </Field>
              <Field id={`ttdb-${index}`} label={t("exciseTax")} error={lineError(index, "exciseTax")}>
                <input id={`ttdb-${index}`} inputMode="decimal" className="o-nhap" value={line.exciseTax} onChange={(event) => setLine(index, { exciseTax: event.target.value })} />
              </Field>
              <Field id={`bvmt-${index}`} label={t("environmentalTax")} error={lineError(index, "environmentalTax")}>
                <input id={`bvmt-${index}`} inputMode="decimal" className="o-nhap" value={line.environmentalTax} onChange={(event) => setLine(index, { environmentalTax: event.target.value })} />
              </Field>
              <Field id={`thue-suat-gtgt-${index}`} label={t("vatRate")} error={lineError(index, "vatRate")}>
                <input id={`thue-suat-gtgt-${index}`} inputMode="decimal" className="o-nhap" value={line.vatRate} onChange={(event) => setLine(index, { vatRate: event.target.value })} />
              </Field>
              <Field id={`gtgt-${index}`} label={t("vatAmount")} hint={t("blankSuggest")} error={lineError(index, "vatAmount")}>
                <input id={`gtgt-${index}`} inputMode="decimal" className="o-nhap" value={line.vatAmount} onChange={(event) => setLine(index, { vatAmount: event.target.value })} />
              </Field>
            </div>
          </fieldset>
        );
      })}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className="nut chinh" disabled={submitting || included.length === 0}>
          {common("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {common("cancel")}
        </button>
      </div>
    </form>
  );
}
