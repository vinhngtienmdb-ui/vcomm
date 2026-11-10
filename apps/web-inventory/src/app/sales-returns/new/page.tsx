"use client";

// MAN_HINH_31, 32 (CONG_VIEC_08): lập phiếu nhận hàng trả lại từ phiếu xuất giao hàng đã ghi sổ; nhập theo giá vốn phiếu xuất gốc (CHUC_NANG_57; API_79).
import type { SaveSalesReturnRequest, StockDocumentResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function NewSalesReturnPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <ReturnLoader />
    </Suspense>
  );
}

function ReturnLoader() {
  const t = useTranslations("documents");
  const issueId = useSearchParams().get("issueId");
  const source = useApi<StockDocumentResponse>(issueId ? `/inventory/documents/${issueId}` : null);
  if (!issueId) return <MessageView text={t("chooseIssue")} />;
  return (
    <Loaded state={source.state} onRetry={() => void source.reload()}>
      {(document) => <ReturnForm issue={document} />}
    </Loaded>
  );
}

function ReturnForm({ issue }: { issue: StockDocumentResponse }) {
  const t = useTranslations("documents");
  const router = useRouter();
  const [documentDate, setDocumentDate] = useState(vietnamToday());
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, string[]>>({});
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const chosen = issue.lines.filter((line) => (line.tracksSerials ? (serials[line.id] ?? []).length > 0 : Number(quantities[line.id] ?? 0) > 0));

  function save() {
    void run(async () => {
      const body: SaveSalesReturnRequest = {
        issueId: issue.id,
        documentDate,
        reason,
        lines: chosen.map((line) => ({
          issueLineId: line.id,
          quantity: line.tracksSerials ? String((serials[line.id] ?? []).length / (Math.abs(Number(line.baseQuantity)) / Math.abs(Number(line.quantity)))) : quantities[line.id]!,
          serials: line.tracksSerials ? (serials[line.id] ?? []) : [],
        })),
      };
      const saved = await apiFetch<StockDocumentResponse>("/inventory/sales-returns", { method: "POST", body: JSON.stringify(body) });
      router.push(`/documents/${saved.id}`);
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <div className="tieu-de">
        <h1>
          {t("receiveReturn")}: {issue.documentNo}
        </h1>
      </div>
      <div className="chu-thich">
        {issue.partnerName} · {t("salesReturnHint")}
      </div>
      <Field id="ngay-phieu" label={t("date")} error={fields.documentDate}>
        <input id="ngay-phieu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
      </Field>
      <Field id="ly-do" label={`${t("reason")} *`} error={fields.reason}>
        <input id="ly-do" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {issue.lines.map((line) => {
        const index = chosen.indexOf(line);
        const accepted = Math.abs(Number(line.baseQuantity));
        return (
          <fieldset key={line.id} className="the" style={{ margin: 0 }}>
            <legend className="an-nhan">{line.sku}</legend>
            <strong>
              {line.sku} · {line.productName}
            </strong>
            <span className="chu-thich">{t("issuedOnIssue", { count: formatNumber(String(accepted)), unit: line.baseUnitName })}</span>
            {line.tracksSerials ? (
              <Field id={`serial-${line.id}`} label={t("serials")} error={index >= 0 ? (fields[`lines.${index}.serials`] ?? fields[`lines.${index}.quantity`]) : undefined}>
                <span className="nhom-nut">
                  {line.serials.map((serial) => (
                    <label key={serial}>
                      <input
                        type="checkbox"
                        checked={(serials[line.id] ?? []).includes(serial)}
                        onChange={(event) =>
                          setSerials({ ...serials, [line.id]: event.target.checked ? [...(serials[line.id] ?? []), serial] : (serials[line.id] ?? []).filter((item) => item !== serial) })
                        }
                      />{" "}
                      {serial}
                    </label>
                  ))}
                </span>
              </Field>
            ) : (
              <Field id={`so-luong-${line.id}`} label={t("returnQuantity", { unit: line.unitName })} error={index >= 0 ? fields[`lines.${index}.quantity`] : undefined}>
                <input
                  id={`so-luong-${line.id}`}
                  className="o-nhap"
                  inputMode="decimal"
                  value={quantities[line.id] ?? ""}
                  onChange={(event) => setQuantities({ ...quantities, [line.id]: event.target.value })}
                />
              </Field>
            )}
          </fieldset>
        );
      })}
      <FormError text={formError} />
      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || chosen.length === 0} style={{ justifySelf: "start" }} onClick={save}>
        {t("saveDraft")}
      </button>
    </div>
  );
}
