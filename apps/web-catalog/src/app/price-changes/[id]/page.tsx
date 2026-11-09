"use client";

// MAN_HINH_27 Phiếu điều chỉnh giá, lập và xem (CHUC_NANG_37; API_62): chọn biến thể hoặc nhập Excel, gửi duyệt, rút; liên kết tới MAN_HINH_08.
import type { PageResponse, PriceChangeImportResponse, PriceChangeLine, PriceChangeResponse, PriceListResponse, ProductListItem, ProductResponse, UnitResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatMoney, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PriceChangeStatusBadge } from "@/components/PriceChangeStatus";

export default function PriceChangePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const { state, reload } = useApi<PriceChangeResponse>(isNew ? null : `/catalog/price-changes/${id}`);
  if (isNew) return <PriceChangeForm change={null} onChanged={() => undefined} />;
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(change) => <PriceChangeForm key={`${change.id}:${change.version}:${change.status}`} change={change} onChanged={() => void reload()} />}
    </Loaded>
  );
}

function PriceChangeForm({ change, onChanged }: { change: PriceChangeResponse | null; onChanged: () => void }) {
  const t = useTranslations("priceChanges");
  const locale = useLocale();
  const router = useRouter();
  const { notify } = useAdmin();
  const editable = change === null || change.canEdit;
  const lists = useApi<PriceListResponse[]>("/catalog/price-lists");
  const units = useApi<UnitResponse[]>("/catalog/units");
  const [priceListId, setPriceListId] = useState(change?.priceListId ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(change?.effectiveFrom ?? vietnamToday());
  const [note, setNote] = useState(change?.note ?? "");
  const [lines, setLines] = useState<PriceChangeLine[]>(change?.lines ?? []);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
  const [confirming, setConfirming] = useState<"submit" | "delete" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ id: string; version: number } | null>(change ? { id: change.id, version: change.version } : null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const activeLists = lists.state.kind === "ready" ? lists.state.data.filter((list) => list.status === "active" || list.id === priceListId) : [];
  const currency = activeLists.find((list) => list.id === priceListId)?.currency ?? change?.currency ?? "VND";
  const unitName = (unitId: string) => {
    const unit = units.state.kind === "ready" ? units.state.data.find((item) => item.id === unitId) : undefined;
    return unit ? (locale === "en" ? unit.nameEn : unit.nameVi) : "";
  };

  useEffect(() => {
    if (!priceListId && lists.state.kind === "ready") setPriceListId(lists.state.data.find((list) => list.status === "active")?.id ?? "");
  }, [lists.state, priceListId]);

  // Lưu nháp; trả mã phiếu để gửi duyệt ngay sau đó. Phiếu mới đã lưu một lần thì các lần sau sửa đúng phiếu đó.
  async function save(): Promise<string> {
    const body = JSON.stringify({ priceListId, effectiveFrom, note: note || null, lines: lines.map((line) => ({ variantId: line.variantId, unitId: line.unitId, price: line.price })), version: draft?.version });
    const saved = draft
      ? await apiFetch<PriceChangeResponse>(`/catalog/price-changes/${draft.id}`, { method: "PATCH", body })
      : await apiFetch<PriceChangeResponse>("/catalog/price-changes", { method: "POST", body });
    setDraft({ id: saved.id, version: saved.version });
    return saved.id;
  }

  function saveDraft() {
    void run(async () => {
      const savedId = await save();
      notify(t("saved"));
      if (change) onChanged();
      else router.replace(`/price-changes/${savedId}`);
    });
  }

  // Gửi: lưu rồi gửi; lỗi ô nhập hiện ngay trên biểu mẫu.
  function submitChange() {
    setConfirming(null);
    void run(async () => {
      const savedId = await save();
      const submitted = await apiFetch<PriceChangeResponse>(`/catalog/price-changes/${savedId}/submit`, { method: "POST" });
      notify(submitted.status === "approved" ? t("appliedNow") : t("submitted"));
      if (change) onChanged();
      else router.replace(`/price-changes/${savedId}`);
    });
  }

  async function confirm() {
    if (!confirming) return;
    if (confirming === "submit") return submitChange();
    setBusy(true);
    setConfirmError(null);
    try {
      if (confirming === "delete") {
        await apiFetch(`/catalog/price-changes/${change!.id}`, { method: "DELETE" });
        notify(t("deleted"));
        router.replace("/price-changes");
      } else {
        await apiFetch(`/catalog/price-changes/${change!.id}/withdraw`, { method: "POST" });
        notify(t("withdrawn"));
        onChanged();
      }
      setConfirming(null);
    } catch (error) {
      setConfirmError(failureOf(error).message);
    } finally {
      setBusy(false);
    }
  }

  // Dòng mới thay dòng cùng biến thể và đơn vị.
  function merge(added: PriceChangeLine[]) {
    setLines((current) => [...current.filter((line) => !added.some((item) => item.variantId === line.variantId && item.unitId === line.unitId)), ...added]);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiUpload<PriceChangeImportResponse>(`/catalog/price-changes/import-lines${priceListId ? `?priceListId=${priceListId}` : ""}`, form);
      merge(result.lines);
      setImportErrors(result.errors);
      notify(t("importedLines", { count: result.lines.length }));
    } catch (error) {
      const failure = failureOf(error);
      notify(Object.values(failure.fields)[0] ?? failure.message, "loi");
    }
  }

  const headings = [t("sku"), t("product"), t("unit"), t("currentPrice"), t("newPrice"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{change?.changeNo ? `${t("title")} ${change.changeNo}` : t("newTitle")}</h1>
        {change && <PriceChangeStatusBadge status={change.status} />}
        <Link className="nut phu" href="/price-changes">
          {t("backToList")}
        </Link>
        {change?.approvalRequestId && (
          <a className="nut phu" href={`/hop-duyet/${change.approvalRequestId}`}>
            {t("viewApproval")}
          </a>
        )}
      </div>
      <section className="the" style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <div style={{ display: "grid", gap: "var(--khoang-4)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Field id="bang-gia" label={`${t("priceList")} *`} error={fields.priceListId}>
            <select id="bang-gia" className={inputClass("priceListId")} value={priceListId} disabled={!editable} onChange={(event) => setPriceListId(event.target.value)}>
              {!change && <option value="">—</option>}
              {change && !activeLists.some((list) => list.id === priceListId) && <option value={priceListId}>{change.priceListName}</option>}
              {activeLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.code} · {list.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ngay-hieu-luc" label={`${t("effectiveFrom")} *`} hint={t("effectiveHint")} error={fields.effectiveFrom}>
            {editable ? (
              <input id="ngay-hieu-luc" type="date" className={inputClass("effectiveFrom")} min={vietnamToday()} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            ) : (
              <input id="ngay-hieu-luc" className="o-nhap" value={formatDate(effectiveFrom)} disabled />
            )}
          </Field>
        </div>
        <Field id="ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu" className={inputClass("note")} rows={2} maxLength={1000} value={note} disabled={!editable} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </section>

      <section className="the" style={{ marginTop: "var(--khoang-4)", display: "grid", gap: "var(--khoang-3)" }}>
        <h2>{t("lines")}</h2>
        {editable && (
          <div className="nhom-nut">
            <VariantPicker onAdd={merge} unitName={unitName} />
            <label className="nut phu" htmlFor="tep-gia">
              {t("importExcel")}
            </label>
            <input id="tep-gia" type="file" accept=".xlsx" className="an-nhan" onChange={(event) => void importFile(event)} />
            <button
              type="button"
              className="nut chu"
              onClick={() => void apiDownload("/catalog/price-changes/import-template", "mau-dieu-chinh-gia.xlsx").catch((error) => notify(failureOf(error).message, "loi"))}
            >
              {t("template")}
            </button>
          </div>
        )}
        {importErrors.length > 0 && (
          <div className="khoi-canh-bao canh-bao" role="status">
            <div>{t("importErrors", { count: importErrors.length })}</div>
            {importErrors.map((error) => (
              <div key={error.row}>{t("importErrorRow", { row: error.row, message: error.message })}</div>
            ))}
          </div>
        )}
        {lines.length === 0 ? (
          <p className="chu-thich">{t("noLines")}</p>
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
                {lines.map((line, index) => (
                  <tr key={`${line.variantId}:${line.unitId}`}>
                    <td data-nhan={headings[0]}>
                      <span>{line.sku}</span>
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>
                        {line.productName}
                        {line.optionValues.length > 0 && <span className="chu-thich"> · {line.optionValues.join(" / ")}</span>}
                      </span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span>{line.unitName}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span>{line.currentPrice === null ? "—" : formatMoney(line.currentPrice, currency)}</span>
                    </td>
                    <td data-nhan={headings[4]}>
                      {editable ? (
                        <>
                          <label className="an-nhan" htmlFor={`gia-${index}`}>
                            {t("newPrice")} {line.sku}
                          </label>
                          <input
                            id={`gia-${index}`}
                            inputMode="decimal"
                            className={inputClass(`lines.${index}.price`)}
                            style={{ maxWidth: 160 }}
                            value={line.price}
                            onChange={(event) => setLines(lines.map((item, position) => (position === index ? { ...item, price: event.target.value.replace(",", ".") } : item)))}
                          />
                          {(fields[`lines.${index}.price`] ?? fields[`lines.${index}.unitId`] ?? fields[`lines.${index}.variantId`]) && (
                            <span className="loi-o">{fields[`lines.${index}.price`] ?? fields[`lines.${index}.unitId`] ?? fields[`lines.${index}.variantId`]}</span>
                          )}
                        </>
                      ) : (
                        <span>{formatMoney(line.price, currency)}</span>
                      )}
                    </td>
                    <td data-nhan="">
                      {editable && (
                        <button type="button" className="nut chu" onClick={() => setLines(lines.filter((_, position) => position !== index))}>
                          {t("removeLine")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {fields.lines && <span className="loi-o">{fields.lines}</span>}
      </section>

      <FormError text={formError} />
      <div className="nhom-nut" style={{ marginTop: "var(--khoang-4)" }}>
        {editable && (
          <>
            <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={saveDraft}>
              {t("saveDraft")}
            </button>
            <button type="button" className="nut chinh" disabled={submitting || lines.length === 0} onClick={() => setConfirming("submit")}>
              {t("submit")}
            </button>
            {change && (
              <button type="button" className="nut chu" onClick={() => setConfirming("delete")}>
                {t("delete")}
              </button>
            )}
          </>
        )}
        {change?.canWithdraw && (
          <button type="button" className="nut phu" onClick={() => setConfirming("withdraw")}>
            {t("withdraw")}
          </button>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title={t(`${confirming}Title`)}
          text={t(`${confirming}Text`)}
          confirmLabel={confirming === "submit" ? t("submit") : confirming === "delete" ? t("delete") : t("withdraw")}
          busy={busy}
          error={confirmError}
          onConfirm={() => void confirm()}
          onClose={() => {
            setConfirming(null);
            setConfirmError(null);
          }}
        />
      )}
    </>
  );
}

// Tìm sản phẩm, chọn đơn vị rồi thêm mọi biến thể đang bán của sản phẩm.
function VariantPicker({ onAdd, unitName }: { onAdd: (lines: PriceChangeLine[]) => void; unitName: (unitId: string) => string }) {
  const t = useTranslations("priceChanges");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [unitId, setUnitId] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const results = useApi<PageResponse<ProductListItem>>(search && !product ? `/catalog/products?${new URLSearchParams({ search, status: "active", pageSize: "8" })}` : null);

  async function choose(id: string) {
    const detail = await apiFetch<ProductResponse>(`/catalog/products/${id}`);
    setProduct(detail);
    setUnitId(detail.baseUnitId);
  }

  function add() {
    if (!product) return;
    onAdd(
      product.variants
        .filter((variant) => variant.status === "active")
        .map((variant) => ({
          variantId: variant.id,
          sku: variant.sku,
          productName: product.name,
          optionValues: variant.optionValues,
          unitId,
          unitName: unitName(unitId),
          price: "",
          currentPrice: null,
        })),
    );
    setProduct(null);
    setSearchInput("");
    setSearch("");
  }

  if (product)
    return (
      <span className="nhom-nut">
        <span>{product.name}</span>
        <label className="an-nhan" htmlFor="don-vi-them">
          {t("unit")}
        </label>
        <select id="don-vi-them" className="o-nhap" style={{ width: "auto" }} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
          {[product.baseUnitId, ...product.units.map((unit) => unit.unitId)].map((id) => (
            <option key={id} value={id}>
              {unitName(id)}
            </option>
          ))}
        </select>
        <button type="button" className="nut chinh" onClick={add}>
          {t("addVariants", { count: product.variants.filter((variant) => variant.status === "active").length })}
        </button>
        <button type="button" className="nut chu" onClick={() => setProduct(null)}>
          {t("cancelPick")}
        </button>
      </span>
    );
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <label className="an-nhan" htmlFor="tim-bien-the">
        {t("searchProduct")}
      </label>
      <input id="tim-bien-the" type="search" className="o-nhap" style={{ width: 300 }} placeholder={t("searchProduct")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
      {results.state.kind === "ready" && results.state.data.data.length > 0 && (
        <ul className="the" role="listbox" style={{ position: "absolute", zIndex: 10, left: 0, right: 0, margin: 0, padding: "var(--khoang-2)", listStyle: "none" }}>
          {results.state.data.data.map((item) => (
            <li key={item.id}>
              <button type="button" className="nut chu" onClick={() => void choose(item.id)}>
                {item.code} · {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
