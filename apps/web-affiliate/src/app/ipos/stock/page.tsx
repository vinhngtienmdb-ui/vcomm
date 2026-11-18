"use client";

// MAN_HINH_295 Tồn kho (chủ cửa hàng; CONG_VIEC_74; CHUC_NANG_255; QUYTAC_NGHIEPVU_611; API_347).
// Tồn theo điểm bán (lọc dưới mức, tồn âm), phiếu nhập, phiếu điều chỉnh, lịch sử biến động. Phiếu ghi xong không sửa.
import type { IposPortalAccess, IposStockDocumentDetail, IposStockDocumentKind, IposStockDocumentRow, IposStockMove, IposStockRow, IposVariantOption } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

type Line = IposVariantOption & { quantity: string; unitCost: string; actualQuantity: string };
const decimalInput = (value: string) => value.replace(/[^\d.,]/g, "").replace(",", ".");

function DocumentDrawer({ kind, outletId, outletName, onClose, onSaved }: { kind: IposStockDocumentKind; outletId: string; outletName: string; onClose: () => void; onSaved: (document: IposStockDocumentDetail) => void }) {
  const t = useTranslations("iposPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<IposVariantOption[] | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!search.trim()) return setOptions(null);
    const timer = setTimeout(() => {
      void portalFetch<IposVariantOption[]>(`/merchant-portal/ipos/variant-options?search=${encodeURIComponent(search.trim())}`).then(setOptions, () => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const add = (option: IposVariantOption) => {
    if (!lines.some((line) => line.variantId === option.variantId)) setLines((current) => [...current, { ...option, quantity: "", unitCost: "", actualQuantity: "" }]);
    setSearch("");
    setOptions(null);
  };
  const update = (variantId: string, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.variantId === variantId ? { ...line, ...patch } : line)));
  const complete = lines.length > 0 && lines.every((line) => (kind === "receipt" ? line.quantity !== "" && Number(line.quantity) > 0 && line.unitCost !== "" : line.actualQuantity !== "")) && (kind === "receipt" || note.trim() !== "");
  return (
    <Drawer title={`${kind === "receipt" ? t("newReceipt") : t("newAdjustment")} · ${outletName}`} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const body =
              kind === "receipt"
                ? { kind, outletId, note: note.trim() || null, lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, unitCost: line.unitCost })) }
                : { kind, outletId, note: note.trim(), lines: lines.map((line) => ({ variantId: line.variantId, actualQuantity: line.actualQuantity })) };
            onSaved(await portalFetch<IposStockDocumentDetail>("/merchant-portal/ipos/stock-documents", { method: "POST", body: JSON.stringify(body) }));
          });
        }}
      >
        <Field id="phieu-tim" label={t("findVariant")}>
          <input
            id="phieu-tim"
            className="o-nhap"
            placeholder={t("findVariantPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Máy quét mã vạch gõ mã rồi Enter: thêm ngay khi chỉ có một kết quả.
              if (event.key === "Enter") {
                event.preventDefault();
                if (options?.length === 1) add(options[0]!);
              }
            }}
          />
        </Field>
        {options && (
          <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
            {options.length === 0 ? (
              <span className="chu-thich">{t("noVariantOptions")}</span>
            ) : (
              options.map((option) => (
                <button key={option.variantId} type="button" className="nut chu" style={{ justifyContent: "flex-start" }} onClick={() => add(option)}>
                  {option.variantCode} · {option.name} ({option.unit})
                </button>
              ))
            )}
          </div>
        )}
        {lines.length === 0 ? (
          <p className="chu-thich">{t("noLines")}</p>
        ) : (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th>{t("item")}</th>
                  {kind === "receipt" ? (
                    <>
                      <th>{t("receiptQuantity")}</th>
                      <th>{t("unitCost")}</th>
                    </>
                  ) : (
                    <th>{t("actualQuantity")}</th>
                  )}
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.variantId}>
                    <td data-nhan={t("item")}>
                      {line.variantCode} · {line.name} ({line.unit})
                    </td>
                    {kind === "receipt" ? (
                      <>
                        <td data-nhan={t("receiptQuantity")}>
                          <input className="o-nhap" aria-label={`${t("receiptQuantity")} ${line.variantCode}`} inputMode="decimal" value={line.quantity} onChange={(event) => update(line.variantId, { quantity: decimalInput(event.target.value) })} />
                        </td>
                        <td data-nhan={t("unitCost")}>
                          <input className="o-nhap" aria-label={`${t("unitCost")} ${line.variantCode}`} inputMode="decimal" value={line.unitCost} onChange={(event) => update(line.variantId, { unitCost: decimalInput(event.target.value) })} />
                        </td>
                      </>
                    ) : (
                      <td data-nhan={t("actualQuantity")}>
                        <input className="o-nhap" aria-label={`${t("actualQuantity")} ${line.variantCode}`} inputMode="decimal" value={line.actualQuantity} onChange={(event) => update(line.variantId, { actualQuantity: decimalInput(event.target.value) })} />
                      </td>
                    )}
                    <td>
                      <button type="button" className="nut chu" onClick={() => setLines((current) => current.filter((item) => item.variantId !== line.variantId))}>
                        {t("removeVariant")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Field id="phieu-ghi-chu" label={kind === "receipt" ? t("note") : t("reason")} error={fields.note}>
          <textarea id="phieu-ghi-chu" className={inputClass("note")} maxLength={500} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <p className="chu-thich">{t("documentsHint")}</p>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !complete}>
            {t("saveDocument")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function DocumentDetail({ document, onClose }: { document: IposStockDocumentDetail; onClose: () => void }) {
  const t = useTranslations("iposPortal");
  return (
    <Drawer title={t("documentDetail", { number: document.number })} onClose={onClose}>
      <p>
        {t(`kind_${document.kind}`)}
        {document.source === "import" ? ` · ${t("source_import")}` : ""} · {document.outletName} · {document.createdByName} · {formatDateTime(document.createdAt)}
      </p>
      {document.note && <p className="chu-thich">{document.note}</p>}
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("item")}</th>
              <th className="so">{t("beforeQuantity")}</th>
              {document.kind === "receipt" ? (
                <>
                  <th className="so">{t("receiptQuantity")}</th>
                  <th className="so">{t("unitCost")}</th>
                </>
              ) : (
                <th className="so">{t("actualQuantity")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {document.lines.map((line) => (
              <tr key={line.variantId}>
                <td data-nhan={t("item")}>
                  {line.variantCode} · {line.name}
                </td>
                <td data-nhan={t("beforeQuantity")} className="so">
                  {formatNumber(line.beforeQuantity)}
                </td>
                {document.kind === "receipt" ? (
                  <>
                    <td data-nhan={t("receiptQuantity")} className="so">
                      {formatNumber(line.quantity ?? "0")}
                    </td>
                    <td data-nhan={t("unitCost")} className="so">
                      {formatNumber(line.unitCost ?? "0")}
                    </td>
                  </>
                ) : (
                  <td data-nhan={t("actualQuantity")} className="so">
                    {formatNumber(line.actualQuantity ?? "0")}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="nhom-nut">
        <button type="button" className="nut chinh" onClick={onClose}>
          {t("done")}
        </button>
      </div>
    </Drawer>
  );
}

function StockTable({ outletId, search, belowMin, negative }: { outletId: string; search: string; belowMin: boolean; negative: boolean }) {
  const t = useTranslations("iposPortal");
  const query = new URLSearchParams({ outletId, ...(search ? { search } : {}), ...(belowMin ? { belowMin: "true" } : {}), ...(negative ? { negative: "true" } : {}) });
  const { state, reload } = usePortalApi<IposStockRow[]>(`/merchant-portal/ipos/stock?${query.toString()}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(rows) =>
        rows.length === 0 ? (
          <MessageView text={search || belowMin || negative ? t("noStockMatches") : t("noStock")} />
        ) : (
          <>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("item")}</th>
                    <th className="so">{t("quantity")}</th>
                    <th className="so">{t("minQuantity")}</th>
                    <th className="so">{t("averageCost")}</th>
                    <th className="so">{t("stockValue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const low = row.minQuantity !== null && Number(row.quantity) < Number(row.minQuantity);
                    return (
                      <tr key={row.variantId}>
                        <td data-nhan={t("item")}>
                          {row.variantCode} · {row.name}
                        </td>
                        <td data-nhan={t("quantity")} className="so">
                          {Number(row.quantity) < 0 || low ? <span className={`nhan ${Number(row.quantity) < 0 ? "loi" : "canh-bao"}`}>{formatNumber(row.quantity)}</span> : formatNumber(row.quantity)} {row.unit}
                        </td>
                        <td data-nhan={t("minQuantity")} className="so">
                          {row.minQuantity === null ? "—" : formatNumber(row.minQuantity)}
                        </td>
                        <td data-nhan={t("averageCost")} className="so">
                          {formatNumber(row.averageCost)}
                        </td>
                        <td data-nhan={t("stockValue")} className="so">
                          {formatNumber(row.value)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="chu-thich">{t("totalValue", { value: formatNumber(rows.reduce((sum, row) => sum + Number(row.value), 0)) })}</p>
          </>
        )
      }
    </Loaded>
  );
}

function DocumentsTable({ outletId, version, onOpen }: { outletId: string; version: number; onOpen: (id: string) => void }) {
  const t = useTranslations("iposPortal");
  const { state, reload } = usePortalApi<IposStockDocumentRow[]>(`/merchant-portal/ipos/stock-documents?outletId=${outletId}&v=${version}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(rows) =>
        rows.length === 0 ? (
          <MessageView text={t("noDocuments")} />
        ) : (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th>{t("documentNumber")}</th>
                  <th>{t("documentKind")}</th>
                  <th className="so">{t("lines")}</th>
                  <th className="so">{t("totalCost")}</th>
                  <th>{t("note")}</th>
                  <th>{t("createdBy")}</th>
                  <th>{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-nhan={t("documentNumber")}>
                      <button type="button" className="nut chu" onClick={() => onOpen(row.id)}>
                        {row.number}
                      </button>
                    </td>
                    <td data-nhan={t("documentKind")}>
                      {t(`kind_${row.kind}`)}
                      {row.source === "import" ? ` · ${t("source_import")}` : ""}
                    </td>
                    <td data-nhan={t("lines")} className="so">
                      {row.lineCount}
                    </td>
                    <td data-nhan={t("totalCost")} className="so">
                      {row.totalCost === null ? "—" : formatNumber(row.totalCost)}
                    </td>
                    <td data-nhan={t("note")}>{row.note ?? "—"}</td>
                    <td data-nhan={t("createdBy")}>{row.createdByName}</td>
                    <td data-nhan={t("createdAt")}>{formatDateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Loaded>
  );
}

function MovesTable({ outletId, version }: { outletId: string; version: number }) {
  const t = useTranslations("iposPortal");
  const { state, reload } = usePortalApi<IposStockMove[]>(`/merchant-portal/ipos/stock-moves?outletId=${outletId}&v=${version}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(rows) =>
        rows.length === 0 ? (
          <MessageView text={t("noMoves")} />
        ) : (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th>{t("movedAt")}</th>
                  <th>{t("item")}</th>
                  <th className="so">{t("change")}</th>
                  <th className="so">{t("balanceAfter")}</th>
                  <th className="so">{t("unitCost")}</th>
                  <th>{t("source")}</th>
                  <th>{t("createdBy")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-nhan={t("movedAt")}>{formatDateTime(row.occurredAt)}</td>
                    <td data-nhan={t("item")}>
                      {row.variantCode} · {row.name}
                    </td>
                    <td data-nhan={t("change")} className="so">
                      {Number(row.quantity) > 0 ? `+${formatNumber(row.quantity)}` : formatNumber(row.quantity)}
                    </td>
                    <td data-nhan={t("balanceAfter")} className="so">
                      {formatNumber(row.balanceAfter)}
                    </td>
                    <td data-nhan={t("unitCost")} className="so">
                      {formatNumber(row.unitCost)}
                    </td>
                    <td data-nhan={t("source")}>{row.sourceNumber}</td>
                    <td data-nhan={t("createdBy")}>{row.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Loaded>
  );
}

export default function IposStockPage() {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const [outletId, setOutletId] = useState("");
  const [tab, setTab] = useState<"stock" | "documents" | "moves">("stock");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [belowMin, setBelowMin] = useState(false);
  const [negative, setNegative] = useState(false);
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState<IposStockDocumentKind | null>(null);
  const [detail, setDetail] = useState<IposStockDocumentDetail | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) => {
        if (!info.enabled) return <MessageView text={t("notSubscribed")} />;
        const outlet = info.outlets.find((item) => item.outletId === outletId) ?? info.outlets[0]!;
        const writable = outlet.subscriptionStatus !== "cancelled";
        return (
          <>
            <div className="tieu-de">
              <h1>{t("stockTitle")}</h1>
            </div>
            <div className="bo-loc">
              <Field id="ton-diem-ban" label={t("outlet")}>
                <select id="ton-diem-ban" className="o-nhap" value={outlet.outletId} onChange={(event) => setOutletId(event.target.value)}>
                  {info.outlets.map((item) => (
                    <option key={item.outletId} value={item.outletId}>
                      {item.outletName}
                    </option>
                  ))}
                </select>
              </Field>
              {tab === "stock" && (
                <>
                  <Field id="ton-tim" label={t("searchItems")}>
                    <input id="ton-tim" className="o-nhap" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </Field>
                  <label>
                    <input type="checkbox" checked={belowMin} onChange={(event) => setBelowMin(event.target.checked)} /> {t("belowMin")}
                  </label>
                  <label>
                    <input type="checkbox" checked={negative} onChange={(event) => setNegative(event.target.checked)} /> {t("negative")}
                  </label>
                </>
              )}
              {writable && (
                <div className="nhom-nut">
                  <button type="button" className="nut chinh" onClick={() => setCreating("receipt")}>
                    {t("receipt")}
                  </button>
                  <button type="button" className="nut phu" onClick={() => setCreating("adjustment")}>
                    {t("adjustment")}
                  </button>
                </div>
              )}
            </div>
            <div className="cac-the" role="tablist">
              {(["stock", "documents", "moves"] as const).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
                  {t(item === "stock" ? "tabStock" : item === "documents" ? "tabDocuments" : "tabMoves")}
                </button>
              ))}
            </div>
            {tab === "stock" && <StockTable key={`${outlet.outletId}-${version}`} outletId={outlet.outletId} search={appliedSearch} belowMin={belowMin} negative={negative} />}
            {tab === "documents" && (
              <DocumentsTable outletId={outlet.outletId} version={version} onOpen={(id) => void portalFetch<IposStockDocumentDetail>(`/merchant-portal/ipos/stock-documents/${id}`).then(setDetail)} />
            )}
            {tab === "moves" && <MovesTable outletId={outlet.outletId} version={version} />}
            {creating && (
              <DocumentDrawer
                kind={creating}
                outletId={outlet.outletId}
                outletName={outlet.outletName}
                onClose={() => setCreating(null)}
                onSaved={(document) => {
                  setCreating(null);
                  notify(t("documentSaved", { number: document.number }));
                  setVersion((current) => current + 1);
                  setDetail(document);
                }}
              />
            )}
            {detail && <DocumentDetail document={detail} onClose={() => setDetail(null)} />}
          </>
        );
      }}
    </Loaded>
  );
}
