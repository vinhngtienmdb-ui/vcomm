"use client";

// MAN_HINH_53 Báo cáo tài chính (CHUC_NANG_74, 75; QUYTAC_NGHIEPVU_99 đến 102; API_90): chọn báo cáo, mẫu, ngày; bảng chỉ tiêu; xuất Excel, PDF.
import type { StatementKind, StatementResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const amount = (value: string) => (value === "0" ? "" : Number(value) < 0 ? `(${formatNumber(String(-Number(value)))})` : formatNumber(value));

export default function StatementsPage() {
  const t = useTranslations("statements");
  const today = vietnamToday();
  const [kind, setKind] = useState<StatementKind>("balance_sheet");
  const [form, setForm] = useState("");
  const [from, setFrom] = useState(`${today.slice(0, 5)}01-01`);
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = Boolean(to) && (kind === "balance_sheet" || (Boolean(from) && from <= to));
  const query = `kind=${kind}&to=${to}${kind === "income_statement" ? `&from=${from}` : ""}${form ? `&form=${encodeURIComponent(form)}` : ""}`;
  const { state, reload } = useApi<StatementResponse>(valid ? `/finance/statements?${query}` : null);
  async function download(format: "xlsx" | "pdf") {
    setExporting(format);
    setError(null);
    try {
      await apiDownload(`/finance/statements?${query}&format=${format}`, `${kind}-${to}.${format}`, format === "pdf");
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setExporting(null);
    }
  }
  const columnLabel = (column: StatementResponse["columns"][number]) => `${t(`column_${column.label}`)} (${column.from ? `${formatDate(column.from)} – ` : ""}${formatDate(column.to)})`;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {(["balance_sheet", "income_statement"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={kind === key}
            className={kind === key ? "chon" : ""}
            onClick={() => {
              setKind(key);
              setForm("");
            }}
          >
            {t(`kind_${key}`)}
          </button>
        ))}
      </div>
      <div className="bo-loc">
        {kind === "income_statement" && (
          <>
            <label htmlFor="bctc-tu-ngay">{t("from")}</label>
            <input id="bctc-tu-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
          </>
        )}
        <label htmlFor="bctc-den-ngay">{kind === "income_statement" ? t("to") : t("asOf")}</label>
        <input id="bctc-den-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
        {state.kind === "ready" && state.data.forms.length > 1 && (
          <>
            <label htmlFor="bctc-mau">{t("form")}</label>
            <select id="bctc-mau" className="o-nhap" style={{ width: "auto" }} value={form || state.data.form} onChange={(event) => setForm(event.target.value)}>
              {state.data.forms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {!valid && <p className="loi-o">{t("invalidRange")}</p>}
      {valid && (
        <Loaded state={state} onRetry={() => void reload()}>
          {(data) => {
            const headings = [t("code"), t("item"), t("note"), columnLabel(data.columns[0]!), columnLabel(data.columns[1]!)];
            return (
              <>
                <div className="tieu-de">
                  <div>
                    <strong>
                      {data.name} ({data.form})
                    </strong>
                    <p className="chu-thich">
                      {data.company.name} · {t("currencyLine", { currency: data.currency })}
                    </p>
                  </div>
                  <span className="nhom-nut">
                    <button type="button" className={`nut phu${exporting === "xlsx" ? " dang-xu-ly" : ""}`} disabled={exporting !== null} onClick={() => void download("xlsx")}>
                      {t("exportExcel")}
                    </button>
                    <button type="button" className={`nut phu${exporting === "pdf" ? " dang-xu-ly" : ""}`} disabled={exporting !== null} onClick={() => void download("pdf")}>
                      {t("exportPdf")}
                    </button>
                  </span>
                </div>
                <FormError text={error} />
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {headings.map((heading) => (
                          <th key={heading} scope="col">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((line) => (
                        <tr key={line.code}>
                          <td data-nhan={headings[0]}>
                            <span style={{ fontWeight: line.level === 0 ? 700 : undefined }}>{line.code}</span>
                          </td>
                          <td data-nhan={headings[1]}>
                            <span style={{ paddingLeft: `calc(var(--khoang-3) * ${line.level})`, fontWeight: line.level === 0 ? 700 : undefined }}>{line.name}</span>
                          </td>
                          <td data-nhan={headings[2]}>
                            {line.note ? (
                              <details>
                                <summary className="chu-thich">{t("howComputed")}</summary>
                                <span className="chu-thich">{line.note}</span>
                              </details>
                            ) : (
                              <span />
                            )}
                          </td>
                          <td data-nhan={headings[3]}>
                            <span style={{ whiteSpace: "nowrap", fontWeight: line.level === 0 ? 700 : undefined }}>{amount(line.current)}</span>
                          </td>
                          <td data-nhan={headings[4]}>
                            <span style={{ whiteSpace: "nowrap", fontWeight: line.level === 0 ? 700 : undefined }}>{amount(line.previous)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          }}
        </Loaded>
      )}
    </>
  );
}
