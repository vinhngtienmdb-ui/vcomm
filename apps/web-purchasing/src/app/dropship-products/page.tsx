"use client";

// MAN_HINH_234 Sản phẩm dropship (CONG_VIEC_62 CHUC_NANG_222; API_265, API_266): biến thể – nhà cung cấp – giá mua – tồn khai báo – giữ chỗ – khả dụng.
import type { DropshipOptionsResponse, DropshipProductDetailResponse, DropshipProductResponse, DropshipStockImportResponse, PageResponse, StockItemOption } from "contracts";
import { useTranslations } from "next-intl";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDateTime, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { ItemPicker, itemLabel } from "@/components/ItemPicker";

export default function DropshipProductsPage() {
  const t = useTranslations("dropship");
  const common = useTranslations("common");
  const { can, notify } = useAdmin();
  const canManage = can("purchasing.dropship.manage");
  const options = useApi<DropshipOptionsResponse>("/purchasing/dropship-options");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("active");
  const [unavailableOnly, setUnavailableOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<DropshipProductResponse | "new" | null>(null);
  const [stockOf, setStockOf] = useState<DropshipProductResponse | null>(null);
  const [importErrors, setImportErrors] = useState<DropshipStockImportResponse["errors"]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (supplierId) parameters.set("supplierId", supplierId);
  if (status) parameters.set("status", status);
  if (search) parameters.set("search", search);
  if (unavailableOnly) parameters.set("unavailableOnly", "true");
  const { state, reload } = useApi<PageResponse<DropshipProductResponse>>(`/purchasing/dropship-products?${parameters}`);
  const loadedOptions = options.state.kind === "ready" ? options.state.data : null;
  const suppliers = loadedOptions?.suppliers ?? [];

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await apiUpload<DropshipStockImportResponse>("/purchasing/dropship-products/stock-import", form);
      setImportErrors(result.errors);
      notify(t("imported", { count: result.updated }));
      await reload();
    } catch (error) {
      const failure = failureOf(error);
      notify(Object.values(failure.fields)[0] ?? failure.message, "loi");
    }
  }

  const headings = [t("sku"), t("product"), t("supplier"), t("unit"), t("purchasePrice"), t("declared"), t("reserved"), t("available"), t("updatedAt"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="dropship_product" />
        {canManage && loadedOptions?.warehouse && (
          <span className="nhom-nut">
            <button
              type="button"
              className="nut phu"
              onClick={() => void apiDownload("/purchasing/dropship-products/stock-import-template", "mau-ton-dropship.xlsx").catch((error) => notify(failureOf(error).message, "loi"))}
            >
              {t("template")}
            </button>
            <button type="button" className="nut phu" onClick={() => fileInput.current?.click()}>
              {t("importStock")}
            </button>
            <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={(event) => void importFile(event)} />
            <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
              {t("add")}
            </button>
          </span>
        )}
      </div>
      <div className="chu-thich">{loadedOptions?.warehouse ? t("hint", { warehouse: `${loadedOptions.warehouse.code} · ${loadedOptions.warehouse.name}` }) : null}</div>
      {loadedOptions && !loadedOptions.warehouse && (
        <div className="khoi-canh-bao canh-bao" role="status">
          {t("noWarehouse")}
        </div>
      )}
      {importErrors.length > 0 && (
        <div className="khoi-canh-bao loi" role="alert">
          {importErrors.map((error) => (
            <div key={error.row}>{t("importRowError", { row: error.row, message: error.message })}</div>
          ))}
        </div>
      )}
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-dropship">
          {common("search")}
        </label>
        <input
          id="tim-dropship"
          className="o-nhap"
          type="search"
          placeholder={t("searchHint")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          style={{ maxWidth: 320 }}
        />
        <label className="an-nhan" htmlFor="loc-nha-cung-cap-dropship">
          {t("supplier")}
        </label>
        <select
          id="loc-nha-cung-cap-dropship"
          className="o-nhap"
          style={{ width: "auto" }}
          value={supplierId}
          onChange={(event) => {
            setSupplierId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("supplier")}: ${common("all")}`}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-dropship">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai-dropship"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={unavailableOnly}
            onChange={(event) => {
              setUnavailableOnly(event.target.checked);
              setPage(1);
            }}
          />{" "}
          {t("unavailableOnly")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search || supplierId || unavailableOnly ? common("noResults") : t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col" style={index >= 4 && index <= 7 ? { textAlign: "right" } : undefined}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((product) => (
                    <tr key={product.id}>
                      <td data-nhan={headings[0]}>
                        <span>{product.sku}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{[product.productName, ...product.optionValues].join(" · ")}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{product.supplierName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{product.unitName}</span>
                      </td>
                      <td data-nhan={headings[4]} style={{ textAlign: "right" }}>
                        <span>{product.purchasePrice === null ? <span className="nhan canh-bao">{t("noPrice")}</span> : formatMoney(product.purchasePrice, "VND")}</span>
                      </td>
                      <td data-nhan={headings[5]} style={{ textAlign: "right" }}>
                        <span>{formatNumber(product.declaredQuantity)}</span>
                      </td>
                      <td data-nhan={headings[6]} style={{ textAlign: "right" }}>
                        <span>{formatNumber(product.reservedQuantity)}</span>
                      </td>
                      <td data-nhan={headings[7]} style={{ textAlign: "right" }}>
                        <span style={product.availableQuantity === "0" ? { color: "var(--mau-loi)", fontWeight: 700 } : undefined}>{formatNumber(product.availableQuantity)}</span>
                      </td>
                      <td data-nhan={headings[8]}>
                        <span className="chu-thich">
                          {formatDateTime(product.declaredAt)}
                          {product.declaredByName ? ` · ${product.declaredByName}` : ""}
                        </span>
                      </td>
                      <td data-nhan={headings[9]}>
                        <span className={`nhan ${product.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(product.status)}</span>
                      </td>
                      <td data-nhan="">
                        <span className="nhom-nut">
                          <button type="button" className="nut chu" onClick={() => setStockOf(product)}>
                            {canManage && product.status === "active" ? t("editStock") : t("history")}
                          </button>
                          {canManage && (
                            <button type="button" className="nut chu" onClick={() => setEditing(product)}>
                              {t("edit")}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      <div className="chu-thich">{t("footer")}</div>
      {editing && (
        <ProductDrawer
          product={editing === "new" ? null : editing}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
      {stockOf && (
        <StockDrawer
          productId={stockOf.id}
          canEdit={canManage && stockOf.status === "active"}
          onClose={() => setStockOf(null)}
          onSaved={() => {
            setStockOf(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}

function ProductDrawer({
  product,
  suppliers,
  onClose,
  onSaved,
}: {
  product: DropshipProductResponse | null;
  suppliers: DropshipOptionsResponse["suppliers"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("dropship");
  const common = useTranslations("common");
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? "");
  const [item, setItem] = useState<StockItemOption | null>(null);
  const [unitId, setUnitId] = useState(product?.unitId ?? "");
  const [declaredQuantity, setDeclaredQuantity] = useState("0");
  const [status, setStatus] = useState(product?.status ?? "active");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (product) {
        await apiFetch(`/purchasing/dropship-products/${product.id}`, { method: "PATCH", body: JSON.stringify({ supplierId, unitId, status, version: product.version }) });
      } else {
        await apiFetch("/purchasing/dropship-products", { method: "POST", body: JSON.stringify({ variantId: item?.variantId ?? "", supplierId, unitId, declaredQuantity }) });
      }
      onSaved();
    });
  }

  const units = item?.units ?? (product ? [{ unitId: product.unitId, unitName: product.unitName, factor: "1" }] : []);
  return (
    <Drawer title={product ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="mat-hang-dropship" label={`${t("product")} *`} hint={t("productHint")} error={fields.variantId}>
          {product ? (
            <strong>{itemLabel(product)}</strong>
          ) : item ? (
            <span className="nhom-nut" style={{ alignItems: "center" }}>
              <strong>{itemLabel(item)}</strong>
              <button type="button" className="nut chu" onClick={() => setItem(null)}>
                {t("changeItem")}
              </button>
            </span>
          ) : (
            <ItemPicker
              id="mat-hang-dropship"
              invalid={Boolean(fields.variantId)}
              onPick={(picked) => {
                setItem(picked);
                setUnitId(picked.baseUnitId);
              }}
            />
          )}
        </Field>
        <Field id="nha-cung-cap-dropship" label={`${t("supplier")} *`} error={fields.supplierId}>
          <select id="nha-cung-cap-dropship" className={inputClass("supplierId")} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{t("choose")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="don-vi-dropship" label={`${t("unit")} *`} hint={t("unitHint")} error={fields.unitId}>
          <select id="don-vi-dropship" className={inputClass("unitId")} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
            {units.map((unit) => (
              <option key={unit.unitId} value={unit.unitId}>
                {unit.unitName}
                {unit.factor !== "1" ? ` (${unit.factor})` : ""}
              </option>
            ))}
          </select>
        </Field>
        {product ? (
          <Field id="trang-thai-dropship" label={t("status")} error={fields.status}>
            <select id="trang-thai-dropship" className={inputClass("status")} value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
            </select>
          </Field>
        ) : (
          <Field id="ton-dau-dropship" label={t("declared")} hint={t("declaredHint")} error={fields.declaredQuantity}>
            <input id="ton-dau-dropship" className={inputClass("declaredQuantity")} inputMode="numeric" value={declaredQuantity} onChange={(event) => setDeclaredQuantity(event.target.value)} />
          </Field>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting}>
            {common("save")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function StockDrawer({ productId, canEdit, onClose, onSaved }: { productId: string; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("dropship");
  const common = useTranslations("common");
  const { state } = useApi<DropshipProductDetailResponse>(`/purchasing/dropship-products/${productId}`);
  const [quantity, setQuantity] = useState<string | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const sources = { manual: t("sourceManual"), import: t("sourceImport"), open_api: t("sourceOpenApi") };

  return (
    <Drawer title={canEdit ? t("editStock") : t("history")} onClose={onClose}>
      <Loaded state={state} onRetry={() => undefined}>
        {(product) => (
          <form
            noValidate
            style={{ display: "grid", gap: "var(--khoang-4)" }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await apiFetch(`/purchasing/dropship-products/${product.id}/stock`, {
                  method: "PATCH",
                  body: JSON.stringify({ declaredQuantity: quantity ?? product.declaredQuantity, version: product.version }),
                });
                onSaved();
              });
            }}
          >
            <dl className="thong-tin-dong">
              <dt>{t("product")}</dt>
              <dd>{itemLabel(product)}</dd>
              <dt>{t("supplier")}</dt>
              <dd>{product.supplierName}</dd>
              <dt>{t("reserved")}</dt>
              <dd>
                {formatNumber(product.reservedQuantity)} {product.baseUnitName}
              </dd>
            </dl>
            {canEdit && (
              <Field id="ton-moi" label={t("newDeclared", { unit: product.baseUnitName })} error={fields.declaredQuantity}>
                <input id="ton-moi" className={inputClass("declaredQuantity")} inputMode="numeric" value={quantity ?? product.declaredQuantity} onChange={(event) => setQuantity(event.target.value)} />
              </Field>
            )}
            <h3>{t("history")}</h3>
            {product.changes.length === 0 ? (
              <span className="chu-thich">{t("noHistory")}</span>
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("changedAt")}</th>
                      <th scope="col" style={{ textAlign: "right" }}>
                        {t("oldQuantity")}
                      </th>
                      <th scope="col" style={{ textAlign: "right" }}>
                        {t("newQuantity")}
                      </th>
                      <th scope="col">{t("changedBy")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.changes.map((change) => (
                      <tr key={change.id}>
                        <td data-nhan={t("changedAt")}>
                          <span>{formatDateTime(change.createdAt)}</span>
                        </td>
                        <td data-nhan={t("oldQuantity")} style={{ textAlign: "right" }}>
                          <span>{formatNumber(change.oldQuantity)}</span>
                        </td>
                        <td data-nhan={t("newQuantity")} style={{ textAlign: "right" }}>
                          <span>{formatNumber(change.newQuantity)}</span>
                        </td>
                        <td data-nhan={t("changedBy")}>
                          <span>
                            {change.changedByName} · {sources[change.source]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <FormError text={formError} />
            <div className="nhom-nut">
              {canEdit && (
                <button type="submit" className="nut chinh" disabled={submitting}>
                  {common("save")}
                </button>
              )}
              <button type="button" className="nut phu" onClick={onClose}>
                {common("close")}
              </button>
            </div>
          </form>
        )}
      </Loaded>
    </Drawer>
  );
}
