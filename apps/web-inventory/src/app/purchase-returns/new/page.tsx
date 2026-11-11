"use client";

// MAN_HINH_31, 32 (CONG_VIEC_07): lập phiếu trả hàng nhà cung cấp từ phiếu nhập mua đã ghi sổ; xuất theo giá phiếu nhập gốc (CHUC_NANG_53; API_76).
import type { SavePurchaseReturnRequest, StockDocumentResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function NewPurchaseReturnPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <ReturnLoader />
    </Suspense>
  );
}

function ReturnLoader() {
  const t = useTranslations("documents");
  const receiptId = useSearchParams().get("receiptId");
  const receipt = useApi<StockDocumentResponse>(receiptId ? `/inventory/documents/${receiptId}` : null);
  if (!receiptId) return <MessageView text={t("chooseReceipt")} />;
  return (
    <Loaded state={receipt.state} onRetry={() => void receipt.reload()}>
      {(document) => <ReturnForm receipt={document} />}
    </Loaded>
  );
}

function ReturnForm({ receipt }: { receipt: StockDocumentResponse }) {
  const t = useTranslations("documents");
  const router = useRouter();
  const [documentDate, setDocumentDate] = useState(vietnamToday());
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [serials, setSerials] = useState<Record<string, string[]>>({});
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const chosen = receipt.lines.filter((line) => (line.tracksSerials ? (serials[line.id] ?? []).length > 0 : Number(quantities[line.id] ?? 0) > 0));

  function save() {
    void run(async () => {
      const body: SavePurchaseReturnRequest = {
        receiptId: receipt.id,
        documentDate,
        reason,
        lines: chosen.map((line) => ({
          receiptLineId: line.id,
          quantity: line.tracksSerials ? String((serials[line.id] ?? []).length / (Number(line.baseQuantity) / Number(line.quantity))) : quantities[line.id]!,
          serials: line.tracksSerials ? (serials[line.id] ?? []) : [],
        })),
      };
      const saved = await apiFetch<StockDocumentResponse>("/inventory/purchase-returns", { method: "POST", body: JSON.stringify(body) });
      router.push(`/documents/${saved.id}`);
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <div className="tieu-de">
        <h1>
          {t("returnToSupplier")}: {receipt.documentNo}
        </h1>
      </div>
      <div className="chu-thich">
        {receipt.partnerName} · {t("returnHint")}
      </div>
      <Field id="ngay-phieu" label={t("date")} error={fields.documentDate}>
        <input id="ngay-phieu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
      </Field>
      <Field id="ly-do" label={`${t("reason")} *`} error={fields.reason}>
        <input id="ly-do" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {receipt.lines.map((line) => {
        const index = chosen.indexOf(line);
        const accepted = Number(line.baseQuantity) - Number(line.rejectedBaseQuantity ?? 0);
        return (
          <fieldset key={line.id} className="the" style={{ margin: 0 }}>
            <legend className="an-nhan">{line.sku}</legend>
            <strong>
              {line.sku} · {line.productName}
            </strong>
            <span className="chu-thich">{t("receivedOnReceipt", { count: formatNumber(String(accepted)), unit: line.baseUnitName })}</span>
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
