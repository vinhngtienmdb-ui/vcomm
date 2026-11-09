"use client";

// Nhập sản phẩm từ Excel (CHUC_NANG_33; API_58) trên MAN_HINH_23: tải tệp mẫu, tải tệp lên, xem kết quả và tệp dòng lỗi.
import type { ProductImportResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field } from "ui/components/Form";
import { apiDownload, apiUpload } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";

export function ProductImportDrawer({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useTranslations("productImport");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<ProductImportResponse | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(undefined);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const imported = await apiUpload<ProductImportResponse>("/catalog/product-imports", form);
      setResult(imported);
      if (imported.createdProducts > 0) onImported();
    } catch (failure) {
      const details = failureOf(failure);
      setError(details.fields.file ?? details.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer title={t("title")} onClose={onClose}>
      <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <div className="chu-thich">{t("hint")}</div>
        <button
          type="button"
          className="nut phu"
          style={{ justifySelf: "start" }}
          onClick={() => void apiDownload("/catalog/product-imports/template", "mau-nhap-san-pham.xlsx").catch((failure) => setError(failureOf(failure).message))}
        >
          {t("template")}
        </button>
        <Field id="tep-nhap" label={t("file")} hint={t("fileHint")} error={error}>
          <input
            id="tep-nhap"
            type="file"
            className="o-nhap"
            accept=".xlsx"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </Field>
        {busy && <div className="chu-thich">{t("importing")}</div>}
        {result && (
          <div className={`khoi-canh-bao ${result.failedRows > 0 ? "canh-bao" : "thong-tin"}`} role="status">
            <div>{t("result", { products: result.createdProducts, variants: result.createdVariants, failed: result.failedRows })}</div>
            {result.errors.slice(0, 10).map((item) => (
              <div key={item.row}>
                {t("row", { row: item.row })}: {item.message}
              </div>
            ))}
            {result.errors.length > 10 && <div>{t("more", { count: result.errors.length - 10 })}</div>}
            {result.errorFileUrl && (
              <a href={result.errorFileUrl} download="dong-loi-nhap-san-pham.xlsx">
                {t("errorFile")}
              </a>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
