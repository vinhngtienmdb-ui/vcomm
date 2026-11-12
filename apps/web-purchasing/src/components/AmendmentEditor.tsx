"use client";

// MAN_HINH_186 Soạn tờ khai bổ sung (CONG_VIEC_56; CHUC_NANG_199; QUYTAC_NGHIEPVU_414): đầu tờ khai bổ sung, thuế mới từng dòng của tờ khai gốc; để trống là giữ số hiện hành.
import type { ImportAmendmentBase, ImportAmendmentResponse, SaveImportAmendmentRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatMoney, formatNumber, vietnamToday } from "ui/lib/format";

const keys = ["importDutyRate", "importDuty", "exciseTax", "environmentalTax", "vatRate", "vatAmount"] as const;
type Key = (typeof keys)[number];
type Line = { declarationLineId: string } & Record<Key, string>;
// Số nhập: dấu chấm là dấu thập phân, bỏ dấu phẩy, khoảng trắng.
const plain = (value: string) => value.replace(/[,\s]/g, "");

export function AmendmentEditor({
  base,
  amendment,
  onSaved,
  onCancel,
}: {
  base: ImportAmendmentBase;
  amendment: ImportAmendmentResponse | null;
  onSaved: (saved: ImportAmendmentResponse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("importAmendments");
  const common = useTranslations("common");
  const saved = new Map((amendment?.lines ?? []).map((line) => [line.declarationLineId, line]));
  const [amendmentNo, setAmendmentNo] = useState(amendment?.amendmentNo ?? "");
  const [registeredOn, setRegisteredOn] = useState(amendment?.registeredOn ?? vietnamToday());
  const [postingDate, setPostingDate] = useState(amendment?.postingDate ?? vietnamToday());
  const [reason, setReason] = useState(amendment?.reason ?? "");
  const [noChange, setNoChange] = useState(false);
  // Nháp đã lưu: điền số sau bổ sung đã lưu; dòng chưa có trong nháp để trống.
  const [lines, setLines] = useState<Line[]>(
    base.lines.map((line) => {
      const current = saved.get(line.declarationLineId);
      return {
        declarationLineId: line.declarationLineId,
        importDutyRate: current ? current.importDutyRate : "",
        importDuty: current ? current.after.importDuty : "",
        exciseTax: current ? current.after.exciseTax : "",
        environmentalTax: current ? current.after.environmentalTax : "",
        vatRate: current ? current.vatRate : "",
        vatAmount: current ? current.after.vatAmount : "",
      };
    }),
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const setLine = (index: number, change: Partial<Line>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...change } : line)));
  // Chỉ gửi dòng có ít nhất một ô nhập; giữ vị trí để báo lỗi đúng dòng.
  const included = lines.map((line, index) => ({ line, index })).filter(({ line }) => keys.some((key) => plain(line[key]) !== ""));
  const lineError = (index: number, field: string) => {
    const position = included.findIndex((item) => item.index === index);
    return position < 0 ? undefined : fields[`lines.${position}.${field}`];
  };
  const money = (amount: string) => formatMoney(amount, base.companyCurrency);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (included.length === 0) {
      setNoChange(true);
      return;
    }
    setNoChange(false);
    void run(async () => {
      const body: SaveImportAmendmentRequest = {
        declarationId: base.declarationId,
        amendmentNo,
        registeredOn,
        postingDate,
        reason,
        lines: included.map(({ line }) => ({
          declarationLineId: line.declarationLineId,
          importDutyRate: plain(line.importDutyRate) || null,
          importDuty: plain(line.importDuty) || null,
          exciseTax: plain(line.exciseTax) || null,
          environmentalTax: plain(line.environmentalTax) || null,
          vatRate: plain(line.vatRate) || null,
          vatAmount: plain(line.vatAmount) || null,
        })),
        ...(amendment ? { version: amendment.version } : {}),
      };
      onSaved(
        await apiFetch<ImportAmendmentResponse>(amendment ? `/purchasing/import-amendments/${amendment.id}` : "/purchasing/import-amendments", {
          method: amendment ? "PATCH" : "POST",
          body: JSON.stringify(body),
        }),
      );
    });
  }

  const labels: Record<Key, string> = {
    importDutyRate: t("importDutyRate"),
    importDuty: t("importDuty"),
    exciseTax: t("exciseTax"),
    environmentalTax: t("environmentalTax"),
    vatRate: t("vatRate"),
    vatAmount: t("vatAmount"),
  };
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <section className="the">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
          <Field id="so-to-khai-bo-sung" label={`${t("amendmentNo")} *`} error={fields.amendmentNo}>
            <input id="so-to-khai-bo-sung" className={inputClass("amendmentNo")} value={amendmentNo} onChange={(event) => setAmendmentNo(event.target.value)} />
          </Field>
          <Field id="ngay-dang-ky-bo-sung" label={`${t("registeredOn")} *`} error={fields.registeredOn}>
            <input id="ngay-dang-ky-bo-sung" type="date" className={inputClass("registeredOn")} value={registeredOn} onChange={(event) => setRegisteredOn(event.target.value)} />
          </Field>
          <Field id="ngay-ghi-so-bo-sung" label={`${t("postingDate")} *`} hint={t("postingDateHint")} error={fields.postingDate}>
            <input id="ngay-ghi-so-bo-sung" type="date" className={inputClass("postingDate")} value={postingDate} onChange={(event) => setPostingDate(event.target.value)} />
          </Field>
        </div>
        <Field id="ly-do-bo-sung" label={t("reason")} error={fields.reason}>
          <textarea id="ly-do-bo-sung" rows={2} className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </section>
      <h2 style={{ margin: 0 }}>{t("lines")}</h2>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("linesHint")}
      </p>
      {fields.declarationId && <div className="khoi-canh-bao loi">{fields.declarationId}</div>}
      {base.lines.map((source, index) => {
        const line = lines[index]!;
        return (
          <fieldset key={source.declarationLineId} className="the" style={{ margin: 0 }}>
            <legend className="an-nhan">
              {source.sku} · {source.productName}
            </legend>
            <strong>
              {source.sku} · {source.productName}
            </strong>
            <span className="chu-thich">
              {t("current", {
                importDuty: money(source.before.importDuty),
                dutyRate: formatNumber(source.importDutyRate),
                exciseTax: money(source.before.exciseTax),
                environmentalTax: money(source.before.environmentalTax),
                vatAmount: money(source.before.vatAmount),
                vatRate: formatNumber(source.vatRate),
                converted: money(source.customsValueConverted),
              })}
            </span>
            {lineError(index, "declarationLineId") && <div className="khoi-canh-bao loi">{lineError(index, "declarationLineId")}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--khoang-3)" }}>
              {keys.map((key) => (
                <Field key={key} id={`${key}-${index}`} label={labels[key]} hint={key === "importDuty" || key === "vatAmount" ? t("blankSuggest") : undefined} error={lineError(index, key)}>
                  <input id={`${key}-${index}`} inputMode="decimal" className="o-nhap" value={line[key]} onChange={(event) => setLine(index, { [key]: event.target.value })} />
                </Field>
              ))}
            </div>
          </fieldset>
        );
      })}
      {noChange && <div className="khoi-canh-bao loi">{t("noChange")}</div>}
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
