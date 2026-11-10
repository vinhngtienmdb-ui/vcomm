"use client";

// MAN_HINH_44 Biên bản chênh lệch nội bộ (CHUC_NANG_61; API_82): biên bản của công ty bán tại kho được xuất giao hàng; nhập lại kho hoặc ghi tổn thất.
import type { InternalDiscrepancyItem, InternalDiscrepancyStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const statuses: InternalDiscrepancyStatus[] = ["open", "returned", "written_off"];

export default function InternalDiscrepanciesPage() {
  const t = useTranslations("internalDiscrepancies");
  const { notify } = useAdmin();
  const [status, setStatus] = useState<InternalDiscrepancyStatus>("open");
  const { state, reload } = useApi<InternalDiscrepancyItem[]>(`/inventory/internal-discrepancies?status=${status}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(item: InternalDiscrepancyItem, action: "return" | "write_off") {
    setBusy(item.id);
    try {
      await apiFetch(`/inventory/internal-discrepancies/${item.id}/resolve`, { method: "POST", body: JSON.stringify({ action, note: notes[item.id] ?? "", version: item.version }) });
      notify(t(action === "return" ? "returned" : "writtenOff"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(null);
    }
  }

  const headings = [t("item"), t("shortage"), t("documents"), t("reason"), t("value"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="internal_discrepancy" />
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-bien-ban">
          {t("status")}
        </label>
        <select id="loc-bien-ban" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value as InternalDiscrepancyStatus)}>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <span>
                          {item.sku} · {item.productName}
                          <span className="chu-thich"> · {item.warehouseName}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {formatNumber(item.shortageBaseQuantity)} {item.baseUnitName}
                          {item.serials.length > 0 && <span className="chu-thich"> · {item.serials.join(", ")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          <Link href={`/documents/${item.issueId}`}>{item.issueDocumentNo}</Link> → {item.buyerCompanyName}: {item.receiptDocumentNo}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {item.reason}
                          <span className="chu-thich"> · {formatDateTime(item.createdAt)}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.value === null ? "—" : formatMoney(item.value, "VND")}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>
                          <span className={`nhan ${item.status === "open" ? "canh-bao" : "trung-tinh"}`}>{t(`status_${item.status}`)}</span>
                          {item.resolvedByName && <span className="chu-thich"> · {item.resolvedByName}</span>}
                          {item.resolutionNote && <span className="chu-thich"> · {item.resolutionNote}</span>}
                          {item.returnDocumentId && (
                            <>
                              {" · "}
                              <Link href={`/documents/${item.returnDocumentId}`}>{t("returnDocument")}</Link>
                            </>
                          )}
                        </span>
                      </td>
                      <td data-nhan="">
                        {item.canResolve && (
                          <span style={{ display: "grid", gap: "var(--khoang-2)" }}>
                            <label className="an-nhan" htmlFor={`ghi-chu-${item.id}`}>
                              {t("note")}
                            </label>
                            <input
                              id={`ghi-chu-${item.id}`}
                              className="o-nhap"
                              placeholder={t("note")}
                              value={notes[item.id] ?? ""}
                              onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })}
                            />
                            <span className="nhom-nut">
                              <button type="button" className="nut phu" disabled={busy === item.id} onClick={() => void resolve(item, "return")}>
                                {t("return")}
                              </button>
                              <button type="button" className="nut chu" disabled={busy === item.id} onClick={() => void resolve(item, "write_off")}>
                                {t("writeOff")}
                              </button>
                            </span>
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
