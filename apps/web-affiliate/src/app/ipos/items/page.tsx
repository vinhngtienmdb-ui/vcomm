"use client";

// MAN_HINH_294 Hàng hóa (chủ cửa hàng; CONG_VIEC_74; CHUC_NANG_255; QUYTAC_NGHIEPVU_597, 608, 610; API_345, API_346).
import type { IposCategory, IposImportResult, IposItemDetail, IposItemPage, IposItemRow, IposPortalAccess, IposVatRate } from "contracts";
import { iposVatRates } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatNumber } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { portalDownload, portalFetch, portalUpload, usePortalApi } from "@/lib/portal-api";

type VariantForm = { id: string | null; code: string; attribute1Value: string; attribute2Value: string; price: string; minQuantity: string; barcodes: string; status: "active" | "inactive" };
const emptyVariant = (): VariantForm => ({ id: null, code: "", attribute1Value: "", attribute2Value: "", price: "", minQuantity: "", barcodes: "", status: "active" });
const splitBarcodes = (value: string) =>
  value
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
const categoryLabel = (categories: IposCategory[], category: IposCategory) => {
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} › ${category.name}` : category.name;
};
// Nhóm cấp một trước, nhóm con ngay sau nhóm cha.
const orderedCategories = (categories: IposCategory[]) =>
  categories.filter((category) => !category.parentId).flatMap((parent) => [parent, ...categories.filter((category) => category.parentId === parent.id)]);
const priceRange = (item: IposItemRow) => (item.minPrice === item.maxPrice ? formatNumber(item.minPrice) : `${formatNumber(item.minPrice)} – ${formatNumber(item.maxPrice)}`);

function ItemDrawer({ editing, categories, access, onClose, onSaved }: { editing: IposItemDetail | null; categories: IposCategory[]; access: IposPortalAccess; onClose: () => void; onSaved: (detail: IposItemDetail) => void }) {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const prices = useSubmit();
  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [unit, setUnit] = useState(editing?.unit ?? "");
  const [price, setPrice] = useState(editing?.price ?? "");
  const [vatRate, setVatRate] = useState<IposVatRate>(editing?.vatRate ?? "8");
  const [trackStock, setTrackStock] = useState(editing?.trackStock ?? true);
  const [status, setStatus] = useState(editing?.status ?? "active");
  const [hasVariants, setHasVariants] = useState(Boolean(editing?.attribute1Name));
  const [attribute1Name, setAttribute1Name] = useState(editing?.attribute1Name ?? "");
  const [attribute2Name, setAttribute2Name] = useState(editing?.attribute2Name ?? "");
  const [variants, setVariants] = useState<VariantForm[]>(
    editing
      ? editing.variants
          .filter((variant) => variant.status === "active" || editing.attribute1Name)
          .map((variant) => ({
            id: variant.id,
            code: variant.code,
            attribute1Value: variant.attribute1Value ?? "",
            attribute2Value: variant.attribute2Value ?? "",
            price: variant.price ?? "",
            minQuantity: variant.minQuantity ?? "",
            barcodes: variant.barcodes.join(", "),
            status: variant.status,
          }))
      : [emptyVariant()],
  );
  const outlets = access.outlets;
  const [outletPrices, setOutletPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((editing?.variants ?? []).flatMap((variant) => variant.outletPrices.map((entry) => [`${variant.id}|${entry.outletId}`, entry.price]))),
  );
  const updateVariant = (index: number, patch: Partial<VariantForm>) => setVariants((current) => current.map((variant, position) => (position === index ? { ...variant, ...patch } : variant)));
  const single = variants[0] ?? emptyVariant();

  const save = () =>
    run(async () => {
      const payloadVariants = (hasVariants ? variants : [single]).map((variant) => ({
        id: variant.id,
        code: hasVariants ? variant.code : "",
        attribute1Value: hasVariants ? variant.attribute1Value || null : null,
        attribute2Value: hasVariants && attribute2Name ? variant.attribute2Value || null : null,
        price: hasVariants && variant.price !== "" ? variant.price : null,
        minQuantity: variant.minQuantity === "" ? null : variant.minQuantity,
        barcodes: splitBarcodes(variant.barcodes),
        status: hasVariants ? variant.status : "active",
      }));
      const body = {
        code,
        name,
        categoryId: categoryId || null,
        unit,
        price,
        vatRate,
        trackStock,
        attribute1Name: hasVariants ? attribute1Name || null : null,
        attribute2Name: hasVariants ? attribute2Name || null : null,
        variants: payloadVariants,
      };
      const saved = editing
        ? await portalFetch<IposItemDetail>(`/merchant-portal/ipos/items/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...body, status, version: editing.version }) })
        : await portalFetch<IposItemDetail>("/merchant-portal/ipos/items", { method: "POST", body: JSON.stringify(body) });
      onSaved(saved);
    });

  return (
    <Drawer title={editing ? `${t("editItem")} · ${editing.code}` : t("addItem")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field id="mh-ma" label={t("code")} error={fields.code} hint={editing ? undefined : t("codeHint")}>
          <input id="mh-ma" className={inputClass("code")} maxLength={30} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="mh-ten" label={t("name")} error={fields.name}>
          <input id="mh-ten" className={inputClass("name")} maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="mh-nhom" label={t("category")} error={fields.categoryId}>
          <select id="mh-nhom" className={inputClass("categoryId")} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">{t("noCategory")}</option>
            {orderedCategories(categories)
              .filter((category) => category.status === "active" || category.id === categoryId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(categories, category)}
                </option>
              ))}
          </select>
        </Field>
        <div className="luoi-so">
          <Field id="mh-dvt" label={t("unit")} error={fields.unit}>
            <input id="mh-dvt" className={inputClass("unit")} maxLength={20} value={unit} onChange={(event) => setUnit(event.target.value)} />
          </Field>
          <Field id="mh-gia" label={t("price")} error={fields.price} hint={t("priceHint")}>
            <input id="mh-gia" className={inputClass("price")} inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <div className="luoi-so">
          <Field id="mh-thue" label={t("vat")} error={fields.vatRate}>
            <select id="mh-thue" className={inputClass("vatRate")} value={vatRate} onChange={(event) => setVatRate(event.target.value as IposVatRate)}>
              {iposVatRates.map((rate) => (
                <option key={rate} value={rate}>
                  {t(`vat_${rate}`)}
                </option>
              ))}
            </select>
          </Field>
          {editing && (
            <Field id="mh-trang-thai" label={t("itemStatus")} error={fields.status}>
              <select id="mh-trang-thai" className={inputClass("status")} value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
                <option value="active">{t("item_active")}</option>
                <option value="inactive">{t("item_inactive")}</option>
              </select>
            </Field>
          )}
        </div>
        <label>
          <input type="checkbox" checked={trackStock} onChange={(event) => setTrackStock(event.target.checked)} /> {t("trackStockLabel")}
        </label>
        <label>
          <input type="checkbox" checked={hasVariants} onChange={(event) => setHasVariants(event.target.checked)} /> {t("hasVariants")}
        </label>
        {!hasVariants ? (
          <div className="luoi-so">
            <Field id="mh-ma-vach" label={t("barcodes")} hint={t("barcodesHint")}>
              <input id="mh-ma-vach" className="o-nhap" value={single.barcodes} onChange={(event) => updateVariant(0, { barcodes: event.target.value })} />
            </Field>
            {trackStock && (
              <Field id="mh-toi-thieu" label={t("minQuantity")}>
                <input id="mh-toi-thieu" className="o-nhap" inputMode="decimal" value={single.minQuantity} onChange={(event) => updateVariant(0, { minQuantity: event.target.value })} />
              </Field>
            )}
          </div>
        ) : (
          <>
            <div className="luoi-so">
              <Field id="mh-tt1" label={t("attribute1")} error={fields.attribute1Name}>
                <input id="mh-tt1" className={inputClass("attribute1Name")} maxLength={30} value={attribute1Name} onChange={(event) => setAttribute1Name(event.target.value)} />
              </Field>
              <Field id="mh-tt2" label={t("attribute2")}>
                <input id="mh-tt2" className="o-nhap" maxLength={30} value={attribute2Name} onChange={(event) => setAttribute2Name(event.target.value)} />
              </Field>
            </div>
            <strong>{t("variants")}</strong>
            {variants.map((variant, index) => (
              <div key={variant.id ?? `moi-${index}`} className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <div className="luoi-so">
                  <Field id={`bt-${index}-tt1`} label={attribute1Name || t("attribute1")}>
                    <input id={`bt-${index}-tt1`} className="o-nhap" maxLength={50} value={variant.attribute1Value} onChange={(event) => updateVariant(index, { attribute1Value: event.target.value })} />
                  </Field>
                  {attribute2Name && (
                    <Field id={`bt-${index}-tt2`} label={attribute2Name}>
                      <input id={`bt-${index}-tt2`} className="o-nhap" maxLength={50} value={variant.attribute2Value} onChange={(event) => updateVariant(index, { attribute2Value: event.target.value })} />
                    </Field>
                  )}
                  <Field id={`bt-${index}-ma`} label={t("variantCode")}>
                    <input id={`bt-${index}-ma`} className="o-nhap" maxLength={30} value={variant.code} onChange={(event) => updateVariant(index, { code: event.target.value.toUpperCase() })} />
                  </Field>
                  <Field id={`bt-${index}-gia`} label={t("variantPrice")}>
                    <input id={`bt-${index}-gia`} className="o-nhap" placeholder={t("variantPriceHint")} inputMode="numeric" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value.replace(/\D/g, "") })} />
                  </Field>
                  {trackStock && (
                    <Field id={`bt-${index}-toi-thieu`} label={t("minQuantity")}>
                      <input id={`bt-${index}-toi-thieu`} className="o-nhap" inputMode="decimal" value={variant.minQuantity} onChange={(event) => updateVariant(index, { minQuantity: event.target.value })} />
                    </Field>
                  )}
                </div>
                <Field id={`bt-${index}-ma-vach`} label={t("barcodes")} hint={t("barcodesHint")}>
                  <input id={`bt-${index}-ma-vach`} className="o-nhap" value={variant.barcodes} onChange={(event) => updateVariant(index, { barcodes: event.target.value })} />
                </Field>
                <div className="nhom-nut" style={{ justifyContent: "flex-start" }}>
                  {variant.id ? (
                    <select className="o-nhap" style={{ width: "auto" }} aria-label={`${t("itemStatus")} ${variant.code}`} value={variant.status} onChange={(event) => updateVariant(index, { status: event.target.value as "active" | "inactive" })}>
                      <option value="active">{t("item_active")}</option>
                      <option value="inactive">{t("item_inactive")}</option>
                    </select>
                  ) : (
                    <button type="button" className="nut chu" onClick={() => setVariants((current) => current.filter((_, position) => position !== index))} disabled={variants.length === 1}>
                      {t("removeVariant")}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div>
              <button type="button" className="nut phu" onClick={() => setVariants((current) => [...current, emptyVariant()])} disabled={variants.length >= 100}>
                {t("addVariant")}
              </button>
            </div>
          </>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !name.trim() || !unit.trim() || price === ""}>
            {editing ? t("save") : t("addItem")}
          </button>
        </div>
      </form>

      {editing && outlets.length > 0 && (
        <form
          style={{ display: "grid", gap: "var(--khoang-2)", marginTop: "var(--khoang-4)" }}
          onSubmit={(event) => {
            event.preventDefault();
            void prices.run(async () => {
              const entries = editing.variants
                .filter((variant) => variant.status === "active")
                .flatMap((variant) => outlets.map((outlet) => ({ outletId: outlet.outletId, variantId: variant.id, price: outletPrices[`${variant.id}|${outlet.outletId}`] || null })));
              const saved = await portalFetch<IposItemDetail>(`/merchant-portal/ipos/items/${editing.id}/outlet-prices`, { method: "PUT", body: JSON.stringify({ prices: entries }) });
              notify(t("outletPricesSaved"));
              onSaved(saved);
            });
          }}
        >
          <strong>{t("outletPrices")}</strong>
          <p className="chu-thich">{t("outletPricesHint")}</p>
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th>{t("variants")}</th>
                  {outlets.map((outlet) => (
                    <th key={outlet.outletId}>{outlet.outletName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editing.variants
                  .filter((variant) => variant.status === "active")
                  .map((variant) => (
                    <tr key={variant.id}>
                      <td data-nhan={t("variants")}>
                        {[variant.attribute1Value, variant.attribute2Value].filter(Boolean).join(" / ") || editing.name} · {formatNumber(variant.price ?? editing.price)}
                      </td>
                      {outlets.map((outlet) => (
                        <td key={outlet.outletId} data-nhan={outlet.outletName}>
                          <input
                            className="o-nhap"
                            aria-label={`${outlet.outletName} ${variant.code}`}
                            inputMode="numeric"
                            value={outletPrices[`${variant.id}|${outlet.outletId}`] ?? ""}
                            onChange={(event) => setOutletPrices((current) => ({ ...current, [`${variant.id}|${outlet.outletId}`]: event.target.value.replace(/\D/g, "") }))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <FormError text={prices.formError} />
          <div className="nhom-nut">
            <button type="submit" className={`nut phu${prices.submitting ? " dang-xu-ly" : ""}`} disabled={prices.submitting}>
              {t("saveOutletPrices")}
            </button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

function CategoriesDrawer({ categories, onClose, onSaved }: { categories: IposCategory[]; onClose: () => void; onSaved: (list: IposCategory[]) => void }) {
  const t = useTranslations("iposPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [editing, setEditing] = useState<IposCategory | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const startEdit = (category: IposCategory | null) => {
    setEditing(category);
    setName(category?.name ?? "");
    setParentId(category?.parentId ?? "");
    setSortOrder(String(category?.sortOrder ?? 0));
    setStatus(category?.status ?? "active");
  };
  return (
    <Drawer title={t("categoriesTitle")} onClose={onClose}>
      {categories.length === 0 ? (
        <p className="chu-thich">{t("noCategories")}</p>
      ) : (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                <th>{t("categoryName")}</th>
                <th>{t("sortOrder")}</th>
                <th>{t("itemStatus")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orderedCategories(categories).map((category) => (
                <tr key={category.id}>
                  <td data-nhan={t("categoryName")} style={category.parentId ? { paddingLeft: "var(--khoang-5)" } : undefined}>
                    {category.name} <span className="chu-thich">· {t("categoryActiveItems", { count: category.activeItems })}</span>
                  </td>
                  <td data-nhan={t("sortOrder")}>{category.sortOrder}</td>
                  <td data-nhan={t("itemStatus")}>
                    <span className={`nhan ${category.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`category_${category.status}`)}</span>
                  </td>
                  <td>
                    <button type="button" className="nut chu" onClick={() => startEdit(category)}>
                      {t("edit")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form
        style={{ display: "grid", gap: "var(--khoang-3)", marginTop: "var(--khoang-4)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const body = { name, parentId: parentId || null, sortOrder: Number(sortOrder) || 0 };
            const list = editing
              ? await portalFetch<IposCategory[]>(`/merchant-portal/ipos/categories/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...body, status, version: editing.version }) })
              : await portalFetch<IposCategory[]>("/merchant-portal/ipos/categories", { method: "POST", body: JSON.stringify(body) });
            startEdit(null);
            onSaved(list);
          });
        }}
      >
        <strong>{editing ? `${t("editCategory")} · ${editing.name}` : t("addCategory")}</strong>
        <Field id="nhom-ten" label={t("categoryName")} error={fields.name}>
          <input id="nhom-ten" className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <div className="luoi-so">
          <Field id="nhom-cha" label={t("parentCategory")} error={fields.parentId}>
            <select id="nhom-cha" className={inputClass("parentId")} value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">{t("topLevel")}</option>
              {categories
                .filter((category) => !category.parentId && category.id !== editing?.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field id="nhom-thu-tu" label={t("sortOrder")} error={fields.sortOrder}>
            <input id="nhom-thu-tu" className={inputClass("sortOrder")} inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        {editing && (
          <Field id="nhom-trang-thai" label={t("itemStatus")}>
            <select id="nhom-trang-thai" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
              <option value="active">{t("category_active")}</option>
              <option value="inactive">{t("category_inactive")}</option>
            </select>
          </Field>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          {editing && (
            <button type="button" className="nut phu" onClick={() => startEdit(null)}>
              {t("cancel")}
            </button>
          )}
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !name.trim()}>
            {editing ? t("save") : t("addCategory")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Nhập Excel: kiểm trước, chỉ ghi khi không có lỗi (QUYTAC_NGHIEPVU_610).
function ImportDrawer({ access, onClose, onDone }: { access: IposPortalAccess; onClose: () => void; onDone: (result: IposImportResult) => void }) {
  const t = useTranslations("iposPortal");
  const { submitting, fields, formError, run } = useSubmit();
  const [file, setFile] = useState<File | null>(null);
  const [outletId, setOutletId] = useState("");
  const [result, setResult] = useState<IposImportResult | null>(null);
  const outlets = access.outlets.filter((outlet) => outlet.subscriptionStatus !== "cancelled");
  const send = (step: "validate" | "commit") =>
    run(async () => {
      if (!file) return;
      const form = new FormData();
      form.append("file", file);
      if (outletId) form.append("outletId", outletId);
      const response = await portalUpload<IposImportResult>(`/merchant-portal/ipos/items/import/${step}`, form);
      setResult(response);
      if (response.committed) onDone(response);
    });
  return (
    <Drawer title={t("importTitle")} onClose={onClose}>
      <p>{t("importIntro")}</p>
      <div>
        <button type="button" className="nut phu" onClick={() => void portalDownload("/merchant-portal/ipos/items/import-template", "mau-nhap-hang-hoa-ipos.xlsx")}>
          {t("downloadTemplate")}
        </button>
      </div>
      <Field id="nhap-diem-ban" label={t("openingOutlet")}>
        <select
          id="nhap-diem-ban"
          className="o-nhap"
          value={outletId}
          onChange={(event) => {
            setOutletId(event.target.value);
            setResult(null);
          }}
        >
          <option value="">{t("noOpeningOutlet")}</option>
          {outlets.map((outlet) => (
            <option key={outlet.outletId} value={outlet.outletId}>
              {outlet.outletName}
            </option>
          ))}
        </select>
      </Field>
      <Field id="nhap-tep" label={t("importFile")} error={fields.file}>
        <input
          id="nhap-tep"
          type="file"
          accept=".xlsx"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
          }}
        />
      </Field>
      <FormError text={formError} />
      {result && (
        <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <strong>
            {file?.name} · {result.errors.length > 0 && !result.committed ? t("importRows", { rows: formatNumber(result.rows) }) : t("importSummary", { rows: formatNumber(result.rows), creates: formatNumber(result.creates), updates: formatNumber(result.updates), opening: formatNumber(result.openingStockRows) })}
          </strong>
          {result.committed ? (
            <p>
              {t("importDone", { creates: formatNumber(result.creates), updates: formatNumber(result.updates) })} {result.receiptNumber ? t("importReceipt", { number: result.receiptNumber }) : ""}
            </p>
          ) : result.errors.length === 0 ? (
            <p>{t("importOk")}</p>
          ) : (
            <>
              <p className="khoi-canh-bao loi">{t("importErrorsCount", { count: formatNumber(result.errors.length) })}</p>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("row")}</th>
                      <th>{t("column")}</th>
                      <th>{t("error")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((error, index) => (
                      <tr key={`${error.row}-${index}`}>
                        <td data-nhan={t("row")}>{error.row === 0 ? t("wholeFile") : formatNumber(error.row)}</td>
                        <td data-nhan={t("column")}>{error.column ?? "—"}</td>
                        <td data-nhan={t("error")}>{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.errors.length >= 500 && <p className="chu-thich">{t("moreErrors")}</p>}
            </>
          )}
        </div>
      )}
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("done")}
        </button>
        {!result?.committed && (
          <>
            <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={!file || submitting} onClick={() => void send("validate")}>
              {t("validate")}
            </button>
            <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={!result || result.errors.length > 0 || submitting} onClick={() => void send("commit")}>
              {result && result.errors.length > 0 ? t("commitBlocked") : t("commit")}
            </button>
          </>
        )}
      </div>
    </Drawer>
  );
}

export default function IposItemsPage() {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const categories = usePortalApi<IposCategory[]>("/merchant-portal/ipos/categories");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), ...(appliedSearch ? { search: appliedSearch } : {}), ...(categoryId ? { categoryId } : {}), ...(status ? { status } : {}) });
  const items = usePortalApi<IposItemPage>(`/merchant-portal/ipos/items?${query.toString()}`);
  const [drawer, setDrawer] = useState<{ kind: "item"; detail: IposItemDetail | null } | { kind: "categories" } | { kind: "import" } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const categoryList = categories.state.kind === "ready" ? categories.state.data : [];
  const openItem = async (id: string) => setDrawer({ kind: "item", detail: await portalFetch<IposItemDetail>(`/merchant-portal/ipos/items/${id}`) });

  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("itemsTitle")}</h1>
            </div>
            <div className="bo-loc">
              <Field id="hh-tim" label={t("searchItems")}>
                <input id="hh-tim" className="o-nhap" placeholder={t("searchItemsPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
              </Field>
              <Field id="hh-nhom" label={t("category")}>
                <select
                  id="hh-nhom"
                  className="o-nhap"
                  value={categoryId}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("allCategories")}</option>
                  {orderedCategories(categoryList).map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(categoryList, category)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="hh-trang-thai" label={t("itemStatus")}>
                <select
                  id="hh-trang-thai"
                  className="o-nhap"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">{t("item_active")}</option>
                  <option value="inactive">{t("item_inactive")}</option>
                  <option value="">{t("allStatuses")}</option>
                </select>
              </Field>
              <div className="nhom-nut">
                <button type="button" className="nut chinh" onClick={() => setDrawer({ kind: "item", detail: null })}>
                  {t("addItem")}
                </button>
                <button type="button" className="nut phu" onClick={() => setDrawer({ kind: "import" })}>
                  {t("importExcel")}
                </button>
                <button type="button" className="nut phu" onClick={() => setDrawer({ kind: "categories" })}>
                  {t("manageCategories")}
                </button>
              </div>
            </div>
            <Loaded state={items.state} onRetry={() => void items.reload()}>
              {(data) => (
                <>
                  <p className="chu-thich">
                    {data.maxItems === null
                      ? t("itemLimitUnlimited", { used: formatNumber(data.activeVariants), plan: data.planName ?? "—" })
                      : t("itemLimitUsage", { used: formatNumber(data.activeVariants), max: formatNumber(data.maxItems), plan: data.planName ?? "—" })}
                  </p>
                  {data.maxItems !== null && data.activeVariants >= data.maxItems && <div className="khoi-canh-bao canh-bao">{t("itemLimitReached")}</div>}
                  {data.items.length === 0 ? (
                    <MessageView text={appliedSearch || categoryId || status !== "active" ? t("noMatches") : t("noItems")} />
                  ) : (
                    <div className="khung-bang">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("code")}</th>
                            <th>{t("name")}</th>
                            <th>{t("category")}</th>
                            <th>{t("barcode")}</th>
                            <th className="so">{t("price")}</th>
                            <th>{t("vat")}</th>
                            <th>{t("trackStock")}</th>
                            <th>{t("itemStatus")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map((item) => (
                            <tr key={item.id}>
                              <td data-nhan={t("code")}>
                                <button type="button" className="nut chu" onClick={() => void openItem(item.id)}>
                                  {item.code}
                                </button>
                              </td>
                              <td data-nhan={t("name")}>
                                {item.name}
                                {item.variantCount > 1 && <span className="chu-thich"> · {t("variantsCount", { count: item.variantCount })}</span>}
                              </td>
                              <td data-nhan={t("category")}>{item.categoryName ?? "—"}</td>
                              <td data-nhan={t("barcode")}>{item.barcodes.length === 0 ? "—" : item.barcodes.length === 1 ? item.barcodes[0] : t("barcodesCount", { count: item.barcodes.length })}</td>
                              <td data-nhan={t("price")} className="so">
                                {priceRange(item)}
                              </td>
                              <td data-nhan={t("vat")}>{t(`vat_${item.vatRate}`)}</td>
                              <td data-nhan={t("trackStock")}>{item.trackStock ? t("yes") : t("no")}</td>
                              <td data-nhan={t("itemStatus")}>
                                <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`item_${item.status}`)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {data.total > data.pageSize && (
                    <div className="nhom-nut">
                      <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        {t("previous")}
                      </button>
                      <span>{t("pageOf", { page, pages: Math.ceil(data.total / data.pageSize) })}</span>
                      <button type="button" className="nut phu" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>
                        {t("next")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </Loaded>
            {drawer?.kind === "item" && (
              <ItemDrawer
                key={drawer.detail ? `${drawer.detail.id}-${drawer.detail.version}` : "moi"}
                editing={drawer.detail}
                categories={categoryList}
                access={info}
                onClose={() => setDrawer(null)}
                onSaved={(detail) => {
                  notify(t("itemSaved"));
                  setDrawer({ kind: "item", detail });
                  void items.reload();
                  void categories.reload();
                }}
              />
            )}
            {drawer?.kind === "categories" && (
              <CategoriesDrawer
                categories={categoryList}
                onClose={() => setDrawer(null)}
                onSaved={() => {
                  notify(t("categorySaved"));
                  void categories.reload();
                  void items.reload();
                }}
              />
            )}
            {drawer?.kind === "import" && (
              <ImportDrawer
                access={info}
                onClose={() => setDrawer(null)}
                onDone={() => {
                  void items.reload();
                  void categories.reload();
                }}
              />
            )}
          </>
        )
      }
    </Loaded>
  );
}
