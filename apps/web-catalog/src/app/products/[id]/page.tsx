"use client";

// MAN_HINH_24 Chi tiết sản phẩm (CHUC_NANG_31, 32; API_56, API_57): thông tin chung, đơn vị quy đổi, phân loại và biến thể, mã vạch, thông số, ảnh, giá.
import type { CategoryResponse, ProductImageResponse, ProductKind, ProductResponse, UnitResponse, VariantLinkResponse, VariantLinkSuggestion } from "contracts";
import { productKinds, productLimits, vatRates } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, apiUpload, selectedCompanyId } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { ProductPrices } from "@/components/ProductPrices";

type Tracking = "none" | "lots" | "serials";
type BarcodeDraft = { unitId: string; barcode: string };
type VariantDraft = { id?: string; sku: string; optionValues: string[]; status: "active" | "inactive"; barcodes: BarcodeDraft[] };
type OptionDraft = { name: string; values: string };

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const categories = useApi<CategoryResponse[]>("/catalog/categories");
  const units = useApi<UnitResponse[]>("/catalog/units");
  const product = useApi<ProductResponse>(id === "new" ? null : `/catalog/products/${id}`);
  const ready = categories.state.kind === "ready" && units.state.kind === "ready";
  if (!ready)
    return (
      <Loaded state={categories.state.kind !== "ready" ? categories.state : units.state} onRetry={() => void (categories.state.kind !== "ready" ? categories.reload() : units.reload())}>
        {() => null}
      </Loaded>
    );
  const categoryList = (categories.state as { data: CategoryResponse[] }).data;
  const unitList = (units.state as { data: UnitResponse[] }).data;
  if (id === "new") return <ProductForm key="new" categories={categoryList} units={unitList} product={null} onReload={() => undefined} />;
  return (
    <Loaded state={product.state} onRetry={() => void product.reload()}>
      {(loaded) => <ProductForm key={loaded.version} categories={categoryList} units={unitList} product={loaded} onReload={() => void product.reload()} />}
    </Loaded>
  );
}

// Tổ hợp mọi giá trị phân loại; giữ biến thể đã có (cùng tổ hợp) để không mất mã hàng, mã vạch.
function combine(options: { name: string; values: string[] }[], current: VariantDraft[]): VariantDraft[] {
  const combos = options.reduce<string[][]>((result, option) => result.flatMap((prefix) => option.values.map((value) => [...prefix, value])), [[]]);
  return combos.map((optionValues) => current.find((variant) => JSON.stringify(variant.optionValues) === JSON.stringify(optionValues)) ?? { sku: "", optionValues, status: "active", barcodes: [] });
}

const parseOptions = (drafts: OptionDraft[]) =>
  drafts
    .map((draft) => ({
      name: draft.name.trim(),
      values: draft.values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    }))
    .filter((option) => option.name && option.values.length > 0);

function ProductForm({ categories, units, product, onReload }: { categories: CategoryResponse[]; units: UnitResponse[]; product: ProductResponse | null; onReload: () => void }) {
  const t = useTranslations("products");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { can, notify } = useAdmin();
  const editable = can("catalog.product.manage");
  const leaves = categories.filter((category) => category.childCount === 0 && (category.status === "active" || category.id === product?.categoryId));
  const activeUnits = units.filter((unit) => unit.status === "active" || unit.id === product?.baseUnitId || product?.units.some((item) => item.unitId === unit.id));
  const unitName = (unitId: string) => {
    const unit = units.find((item) => item.id === unitId);
    return unit ? (locale === "en" ? unit.nameEn : unit.nameVi) : "";
  };

  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [origin, setOrigin] = useState(product?.origin ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [vatRate, setVatRate] = useState<string>(product?.vatRate ?? "10");
  // QUYTAC_NGHIEPVU_275: loại Hàng hóa (mặc định) hoặc Dịch vụ; dịch vụ không theo dõi lô, serial, không có cân nặng, thể tích.
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "goods");
  const [tracking, setTracking] = useState<Tracking>(product ? (product.tracksLots ? "lots" : product.tracksSerials ? "serials" : "none") : "none");
  const [warrantyMonths, setWarrantyMonths] = useState(String(product?.warrantyMonths ?? 0));
  const [baseUnitId, setBaseUnitId] = useState(product?.baseUnitId ?? units.find((unit) => unit.code === "CAI")?.id ?? "");
  const [weightKg, setWeightKg] = useState(product?.weightKg?.replace(".", ",") ?? "");
  const [volumeM3, setVolumeM3] = useState(product?.volumeM3?.replace(".", ",") ?? "");
  const [conversions, setConversions] = useState(product?.units.map((unit) => ({ unitId: unit.unitId, factor: unit.factor.replace(".", ",") })) ?? []);
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>(product?.options.map((option) => ({ name: option.name, values: option.values.join(", ") })) ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product?.variants.map((variant) => ({ id: variant.id, sku: variant.sku, optionValues: variant.optionValues, status: variant.status, barcodes: variant.barcodes })) ?? [
      { sku: "", optionValues: [], status: "active", barcodes: [] },
    ],
  );
  const [specifications, setSpecifications] = useState(product?.specifications ?? []);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const productUnits = [baseUnitId, ...conversions.map((unit) => unit.unitId)].filter(Boolean);

  // Chọn ngành hàng khi tạo mới thì lấy cách theo dõi lô, serial, bảo hành mặc định của ngành hàng (QUYTAC_NGHIEPVU_38).
  function chooseCategory(value: string) {
    setCategoryId(value);
    if (product) return;
    const category = categories.find((item) => item.id === value);
    if (!category) return;
    setTracking(category.tracksLots ? "lots" : category.tracksSerials ? "serials" : "none");
    setWarrantyMonths(String(category.warrantyMonths));
  }

  function regenerate(drafts: OptionDraft[]) {
    const options = parseOptions(drafts);
    // Bỏ hết phân loại: còn một biến thể, giữ biến thể đầu tiên.
    setVariants(
      options.length === 0
        ? [{ ...(variants.find((variant) => variant.optionValues.length === 0) ?? variants[0] ?? { sku: "", status: "active", barcodes: [] }), optionValues: [] }]
        : combine(options, variants),
    );
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const options = parseOptions(optionDrafts);
      const body = {
        categoryId,
        code: code.trim(),
        name,
        brand: brand || null,
        origin: origin || null,
        description: description || null,
        vatRate,
        kind,
        tracksLots: kind === "goods" && tracking === "lots",
        tracksSerials: kind === "goods" && tracking === "serials",
        warrantyMonths: Number(warrantyMonths) || 0,
        baseUnitId,
        weightKg: kind === "goods" ? weightKg : "",
        volumeM3: kind === "goods" ? volumeM3 : "",
        options,
        specifications: specifications.filter((item) => item.name.trim() && item.value.trim()),
        units: conversions.filter((unit) => unit.unitId),
        variants: variants.map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          sku: variant.sku.trim(),
          optionValues: variant.optionValues,
          status: variant.status,
          barcodes: variant.barcodes.filter((barcode) => barcode.barcode.trim()),
        })),
        ...(product ? { version: product.version } : {}),
      };
      const saved = product
        ? await apiFetch<ProductResponse>(`/catalog/products/${product.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch<ProductResponse>("/catalog/products", { method: "POST", body: JSON.stringify(body) });
      notify(t("saved"));
      if (product) onReload();
      else router.replace(`/products/${saved.id}`);
    });
  }

  async function toggleStatus() {
    if (!product) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await apiFetch(`/catalog/products/${product.id}/${product.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: product.version }) });
      setConfirming(false);
      notify(t("saved"));
      onReload();
    } catch (error) {
      setConfirmError(failureOf(error).message);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key: string) => fields[key];
  const optionLabel = (variant: VariantDraft) => (variant.optionValues.length === 0 ? t("singleVariant") : variant.optionValues.join(" / "));

  return (
    <form onSubmit={save} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <div className="tieu-de">
        <h1>
          {product ? `${product.code} · ${product.name}` : t("add")} {product && <span className={`nhan ${product.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(product.status)}</span>}
        </h1>
        {product && <HistoryLink entityType="product" entityId={product.id} />}
        <Link className="nut phu" href="/products">
          {t("backToList")}
        </Link>
        {product && editable && (
          <button type="button" className="nut chu" onClick={() => setConfirming(true)}>
            {product.status === "active" ? t("deactivate") : t("activate")}
          </button>
        )}
      </div>
      <FormError text={formError} />

      <section className="the">
        <h2>{t("general")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--khoang-3)" }}>
          <Field id="ten-san-pham" label={`${t("name")} *`} error={fieldError("name")}>
            <input id="ten-san-pham" className={inputClass("name")} value={name} maxLength={255} disabled={!editable} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="nganh-hang" label={`${t("category")} *`} error={fieldError("categoryId")}>
            <select id="nganh-hang" className={inputClass("categoryId")} value={categoryId} disabled={!editable} onChange={(event) => chooseCategory(event.target.value)}>
              <option value="">{t("choose")}</option>
              {leaves.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} · {locale === "en" ? category.nameEn : category.nameVi}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ma-san-pham" label={t("code")} hint={t("codeHint")} error={fieldError("code")}>
            <input id="ma-san-pham" className={inputClass("code")} value={code} maxLength={40} disabled={!editable} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </Field>
          <Field id="don-vi-co-so" label={`${t("baseUnit")} *`} hint={t("baseUnitHint")} error={fieldError("baseUnitId")}>
            <select id="don-vi-co-so" className={inputClass("baseUnitId")} value={baseUnitId} disabled={!editable} onChange={(event) => setBaseUnitId(event.target.value)}>
              {activeUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {locale === "en" ? unit.nameEn : unit.nameVi}
                </option>
              ))}
            </select>
          </Field>
          <Field id="thue-suat" label={t("vatRate")} error={fieldError("vatRate")}>
            <select id="thue-suat" className="o-nhap" value={vatRate} disabled={!editable} onChange={(event) => setVatRate(event.target.value)}>
              {vatRates.map((rate) => (
                <option key={rate} value={rate}>
                  {t(`vat_${rate}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="loai-san-pham" label={t("kind")} hint={t("kindHint")} error={fieldError("kind")}>
            <select id="loai-san-pham" className="o-nhap" value={kind} disabled={!editable} onChange={(event) => setKind(event.target.value as ProductKind)}>
              {productKinds.map((item) => (
                <option key={item} value={item}>
                  {t(`kind_${item}`)}
                </option>
              ))}
            </select>
          </Field>
          {kind === "goods" && (
            <Field id="theo-doi" label={t("tracking")} error={fieldError("tracksSerials") ?? fieldError("tracksLots")}>
              <select id="theo-doi" className="o-nhap" value={tracking} disabled={!editable} onChange={(event) => setTracking(event.target.value as Tracking)}>
                <option value="none">{t("noTracking")}</option>
                <option value="lots">{t("tracksLots")}</option>
                <option value="serials">{t("tracksSerials")}</option>
              </select>
            </Field>
          )}
          <Field id="bao-hanh" label={t("warrantyMonths")} error={fieldError("warrantyMonths")}>
            <input
              id="bao-hanh"
              type="number"
              min={0}
              max={120}
              className={inputClass("warrantyMonths")}
              value={warrantyMonths}
              disabled={!editable}
              onChange={(event) => setWarrantyMonths(event.target.value)}
            />
          </Field>
          <Field id="thuong-hieu" label={t("brand")} error={fieldError("brand")}>
            <input id="thuong-hieu" className={inputClass("brand")} value={brand} maxLength={100} disabled={!editable} onChange={(event) => setBrand(event.target.value)} />
          </Field>
          <Field id="xuat-xu" label={t("origin")} error={fieldError("origin")}>
            <input id="xuat-xu" className={inputClass("origin")} value={origin} maxLength={100} disabled={!editable} onChange={(event) => setOrigin(event.target.value)} />
          </Field>
          {kind === "goods" && (
            <>
              <Field id="trong-luong" label={t("weightKg")} hint={t("perBaseUnit")} error={fieldError("weightKg")}>
                <input id="trong-luong" inputMode="decimal" className={inputClass("weightKg")} value={weightKg} disabled={!editable} onChange={(event) => setWeightKg(event.target.value)} />
              </Field>
              <Field id="the-tich" label={t("volumeM3")} hint={t("perBaseUnit")} error={fieldError("volumeM3")}>
                <input id="the-tich" inputMode="decimal" className={inputClass("volumeM3")} value={volumeM3} disabled={!editable} onChange={(event) => setVolumeM3(event.target.value)} />
              </Field>
            </>
          )}
        </div>
        <Field id="mo-ta" label={t("description")} error={fieldError("description")}>
          <textarea id="mo-ta" className={inputClass("description")} rows={3} maxLength={5000} value={description} disabled={!editable} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </section>

      <section className="the">
        <h2>{t("conversions")}</h2>
        <div className="chu-thich">{t("conversionsHint", { unit: unitName(baseUnitId) })}</div>
        {conversions.map((conversion, index) => (
          <div key={index} className="nhom-nut" style={{ alignItems: "end" }}>
            <Field id={`quy-doi-don-vi-${index}`} label={t("unit")} error={fieldError(`units.${index}.unitId`)}>
              <select
                id={`quy-doi-don-vi-${index}`}
                className={inputClass(`units.${index}.unitId`)}
                value={conversion.unitId}
                disabled={!editable}
                onChange={(event) => setConversions(conversions.map((item, position) => (position === index ? { ...item, unitId: event.target.value } : item)))}
              >
                <option value="">{t("choose")}</option>
                {activeUnits
                  .filter((unit) => unit.id !== baseUnitId)
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {locale === "en" ? unit.nameEn : unit.nameVi}
                    </option>
                  ))}
              </select>
            </Field>
            <Field id={`quy-doi-he-so-${index}`} label={t("factor", { unit: unitName(baseUnitId) })} error={fieldError(`units.${index}.factor`)}>
              <input
                id={`quy-doi-he-so-${index}`}
                inputMode="decimal"
                className={inputClass(`units.${index}.factor`)}
                value={conversion.factor}
                disabled={!editable}
                onChange={(event) => setConversions(conversions.map((item, position) => (position === index ? { ...item, factor: event.target.value } : item)))}
              />
            </Field>
            {editable && (
              <button type="button" className="nut chu" onClick={() => setConversions(conversions.filter((_, position) => position !== index))}>
                {t("remove")}
              </button>
            )}
          </div>
        ))}
        {editable && conversions.length < productLimits.conversionUnits && (
          <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setConversions([...conversions, { unitId: "", factor: "" }])}>
            {t("addConversion")}
          </button>
        )}
      </section>

      <section className="the">
        <h2>{t("variants")}</h2>
        <div className="chu-thich">{t("optionsHint")}</div>
        {optionDrafts.map((option, index) => (
          <div key={index} className="nhom-nut" style={{ alignItems: "end" }}>
            <Field id={`phan-loai-${index}`} label={t("optionName")} error={fieldError(`options.${index}.name`)}>
              <input
                id={`phan-loai-${index}`}
                className={inputClass(`options.${index}.name`)}
                value={option.name}
                maxLength={50}
                disabled={!editable}
                placeholder={t("optionNameExample")}
                onChange={(event) => setOptionDrafts(optionDrafts.map((item, position) => (position === index ? { ...item, name: event.target.value } : item)))}
              />
            </Field>
            <Field id={`gia-tri-${index}`} label={t("optionValues")} error={fieldError(`options.${index}.values`)}>
              <input
                id={`gia-tri-${index}`}
                className={inputClass(`options.${index}.values`)}
                value={option.values}
                disabled={!editable}
                placeholder={t("optionValuesExample")}
                style={{ minWidth: 260 }}
                onChange={(event) => setOptionDrafts(optionDrafts.map((item, position) => (position === index ? { ...item, values: event.target.value } : item)))}
              />
            </Field>
            {editable && (
              <button
                type="button"
                className="nut chu"
                onClick={() => {
                  const next = optionDrafts.filter((_, position) => position !== index);
                  setOptionDrafts(next);
                  regenerate(next);
                }}
              >
                {t("remove")}
              </button>
            )}
          </div>
        ))}
        {editable && (
          <div className="nhom-nut">
            {optionDrafts.length < productLimits.options && (
              <button type="button" className="nut phu" onClick={() => setOptionDrafts([...optionDrafts, { name: "", values: "" }])}>
                {t("addOption")}
              </button>
            )}
            {optionDrafts.length > 0 && (
              <button type="button" className="nut phu" onClick={() => regenerate(optionDrafts)}>
                {t("generateVariants")}
              </button>
            )}
          </div>
        )}
        {fieldError("variants") && <span className="loi-o">{fieldError("variants")}</span>}
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {[t("variant"), t("sku"), t("barcodes"), t("variantStatus")].map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => {
                const update = (change: Partial<VariantDraft>) => setVariants(variants.map((item, position) => (position === index ? { ...item, ...change } : item)));
                return (
                  <tr key={JSON.stringify(variant.optionValues)}>
                    <td data-nhan={t("variant")}>
                      <span>{optionLabel(variant)}</span>
                      {fieldError(`variants.${index}.optionValues`) && <span className="loi-o">{fieldError(`variants.${index}.optionValues`)}</span>}
                    </td>
                    <td data-nhan={t("sku")}>
                      <input
                        aria-label={`${t("sku")} ${optionLabel(variant)}`}
                        className={inputClass(`variants.${index}.sku`)}
                        value={variant.sku}
                        placeholder={t("autoCode")}
                        maxLength={40}
                        disabled={!editable}
                        onChange={(event) => update({ sku: event.target.value.toUpperCase() })}
                      />
                      {fieldError(`variants.${index}.sku`) && <span className="loi-o">{fieldError(`variants.${index}.sku`)}</span>}
                    </td>
                    <td data-nhan={t("barcodes")}>
                      <div style={{ display: "grid", gap: "var(--khoang-1)" }}>
                        {variant.barcodes.map((barcode, position) => {
                          const key = `variants.${index}.barcodes.${position}`;
                          const change = (next: Partial<BarcodeDraft>) => update({ barcodes: variant.barcodes.map((item, at) => (at === position ? { ...item, ...next } : item)) });
                          return (
                            <span key={position} className="nhom-nut">
                              <input
                                aria-label={`${t("barcode")} ${position + 1} ${optionLabel(variant)}`}
                                className={inputClass(`${key}.barcode`)}
                                value={barcode.barcode}
                                maxLength={40}
                                disabled={!editable}
                                style={{ width: 160 }}
                                onChange={(event) => change({ barcode: event.target.value })}
                              />
                              <select
                                aria-label={t("unit")}
                                className={inputClass(`${key}.unitId`)}
                                value={barcode.unitId}
                                disabled={!editable}
                                style={{ width: "auto" }}
                                onChange={(event) => change({ unitId: event.target.value })}
                              >
                                {productUnits.map((unitId) => (
                                  <option key={unitId} value={unitId}>
                                    {unitName(unitId)}
                                  </option>
                                ))}
                              </select>
                              {editable && (
                                <button type="button" className="nut chu" aria-label={t("remove")} onClick={() => update({ barcodes: variant.barcodes.filter((_, at) => at !== position) })}>
                                  ×
                                </button>
                              )}
                              {(fieldError(`${key}.barcode`) ?? fieldError(`${key}.unitId`)) && <span className="loi-o">{fieldError(`${key}.barcode`) ?? fieldError(`${key}.unitId`)}</span>}
                            </span>
                          );
                        })}
                        {editable && (
                          <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => update({ barcodes: [...variant.barcodes, { unitId: baseUnitId, barcode: "" }] })}>
                            {t("addBarcode")}
                          </button>
                        )}
                      </div>
                    </td>
                    <td data-nhan={t("variantStatus")}>
                      <label style={{ display: "flex", gap: "var(--khoang-1)", alignItems: "center" }}>
                        <input type="checkbox" checked={variant.status === "active"} disabled={!editable} onChange={(event) => update({ status: event.target.checked ? "active" : "inactive" })} />
                        {t("selling")}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="the">
        <h2>{t("specifications")}</h2>
        {specifications.map((item, index) => (
          <div key={index} className="nhom-nut" style={{ alignItems: "end" }}>
            <Field id={`thong-so-ten-${index}`} label={t("specName")}>
              <input
                id={`thong-so-ten-${index}`}
                className="o-nhap"
                value={item.name}
                maxLength={100}
                disabled={!editable}
                onChange={(event) => setSpecifications(specifications.map((spec, position) => (position === index ? { ...spec, name: event.target.value } : spec)))}
              />
            </Field>
            <Field id={`thong-so-gia-tri-${index}`} label={t("specValue")}>
              <input
                id={`thong-so-gia-tri-${index}`}
                className="o-nhap"
                value={item.value}
                maxLength={500}
                disabled={!editable}
                style={{ minWidth: 260 }}
                onChange={(event) => setSpecifications(specifications.map((spec, position) => (position === index ? { ...spec, value: event.target.value } : spec)))}
              />
            </Field>
            {editable && (
              <button type="button" className="nut chu" onClick={() => setSpecifications(specifications.filter((_, position) => position !== index))}>
                {t("remove")}
              </button>
            )}
          </div>
        ))}
        {editable && (
          <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setSpecifications([...specifications, { name: "", value: "" }])}>
            {t("addSpec")}
          </button>
        )}
      </section>

      {product && <Images product={product} editable={editable} onChanged={onReload} />}

      {product && can("catalog.price.view") && <ProductPrices product={product} canManage={can("catalog.price.manage")} />}

      {product && <Links product={product} editable={editable} />}

      {editable && (
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      )}
      {confirming && product && (
        <ConfirmDialog
          title={product.status === "active" ? t("deactivate") : t("activate")}
          text={product.status === "active" ? t("deactivateText") : t("activateText")}
          confirmLabel={product.status === "active" ? t("deactivate") : t("activate")}
          busy={busy}
          error={confirmError}
          onConfirm={() => void toggleStatus()}
          onClose={() => setConfirming(false)}
        />
      )}
    </form>
  );
}

function Images({ product, editable, onChanged }: { product: ProductResponse; editable: boolean; onChanged: () => void }) {
  const t = useTranslations("products");
  const { notify } = useAdmin();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const company = selectedCompanyId();
  const source = (image: ProductImageResponse) => `/api/v1/catalog/product-images/${image.id}${company ? `?companyId=${company}` : ""}`;

  async function upload(file: File) {
    setUploading(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiUpload<ProductImageResponse>(`/catalog/products/${product.id}/images`, form);
      onChanged();
    } catch (failure) {
      const result = failureOf(failure);
      setError(result.fields.file ?? result.message);
    } finally {
      setUploading(false);
    }
  }

  async function act(path: string, method: "POST" | "DELETE") {
    try {
      await apiFetch(path, { method });
      onChanged();
    } catch (failure) {
      notify(failureOf(failure).message, "loi");
    }
  }

  return (
    <section className="the">
      <h2>{t("images")}</h2>
      {product.images.length === 0 && <span className="chu-thich">{t("noImages")}</span>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)" }}>
        {product.images.map((image, index) => (
          <figure key={image.id} style={{ margin: 0, display: "grid", gap: "var(--khoang-1)", justifyItems: "start" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source(image)} alt={image.fileName} width={120} height={120} style={{ objectFit: "cover", borderRadius: "var(--bo-vua)", border: "1px solid var(--mau-vien)" }} />
            <figcaption className="chu-thich">{index === 0 ? t("primaryImage") : image.fileName}</figcaption>
            {editable && (
              <span className="nhom-nut">
                {index > 0 && (
                  <button type="button" className="nut chu" onClick={() => void act(`/catalog/product-images/${image.id}/primary`, "POST")}>
                    {t("makePrimary")}
                  </button>
                )}
                <button type="button" className="nut chu" onClick={() => void act(`/catalog/product-images/${image.id}`, "DELETE")}>
                  {t("remove")}
                </button>
              </span>
            )}
          </figure>
        ))}
      </div>
      {editable && (
        <Field id="them-anh" label={t("addImage")} hint={t("imageHint")} error={error}>
          <input
            id="them-anh"
            type="file"
            className="o-nhap"
            accept=".jpg,.jpeg,.png,.webp"
            disabled={uploading || product.images.length >= productLimits.images}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </Field>
      )}
    </section>
  );
}

// Liên kết sản phẩm tương ứng ở công ty khác, sao chép sang công ty khác, gợi ý theo mã vạch trùng (CHUC_NANG_34; API_59).
function Links({ product, editable }: { product: ProductResponse; editable: boolean }) {
  const t = useTranslations("productLinks");
  const { me, notify } = useAdmin();
  const { state, reload } = useApi<VariantLinkResponse[]>(`/catalog/products/${product.id}/links`);
  const others = me.companies.filter((company) => company.id !== product.companyId);
  const [targetCompanyId, setTargetCompanyId] = useState(others[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<VariantLinkSuggestion[] | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      notify(failureOf(failure).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  const copy = () =>
    run(async () => {
      await apiFetch<{ productId: string }>(`/catalog/products/${product.id}/copy`, { method: "POST", body: JSON.stringify({ targetCompanyId }) });
      notify(t("copied", { company: others.find((company) => company.id === targetCompanyId)?.shortName ?? "" }));
      await reload();
    });
  const suggest = () => run(async () => setSuggestions(await apiFetch<VariantLinkSuggestion[]>(`/catalog/products/${product.id}/link-suggestions?targetCompanyId=${targetCompanyId}`)));
  const link = (suggestion: VariantLinkSuggestion) =>
    run(async () => {
      await apiFetch("/catalog/variant-links", { method: "POST", body: JSON.stringify({ variantId: suggestion.variantId, linkedVariantId: suggestion.linkedVariantId }) });
      setSuggestions((current) => current?.filter((item) => item !== suggestion) ?? null);
      notify(t("linked"));
      await reload();
    });
  const unlink = (linkId: string) =>
    run(async () => {
      await apiFetch(`/catalog/variant-links/${linkId}`, { method: "DELETE" });
      await reload();
    });
  const headings = [t("sku"), t("company"), t("linkedProduct"), t("factor"), ""];

  return (
    <section className="the">
      <h2>{t("title")}</h2>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(links) =>
          links.length === 0 ? (
            <span className="chu-thich">{t("none")}</span>
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
                  {links.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <span>{item.sku}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.linkedCompanyName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          {item.linkedSku} · {item.linkedProductName}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.factor.replace(".", ",")}</span>
                      </td>
                      <td data-nhan="">
                        {editable && (
                          <button type="button" className="nut chu" disabled={busy} onClick={() => void unlink(item.id)}>
                            {t("unlink")}
                          </button>
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
      {editable && others.length > 0 && (
        <div className="nhom-nut" style={{ alignItems: "end" }}>
          <Field id="cong-ty-dich" label={t("targetCompany")}>
            <select
              id="cong-ty-dich"
              className="o-nhap"
              value={targetCompanyId}
              onChange={(event) => {
                setTargetCompanyId(event.target.value);
                setSuggestions(null);
              }}
            >
              {others.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" className={`nut phu${busy ? " dang-xu-ly" : ""}`} disabled={busy || !targetCompanyId} onClick={() => void copy()}>
            {t("copy")}
          </button>
          <button type="button" className="nut phu" disabled={busy || !targetCompanyId} onClick={() => void suggest()}>
            {t("suggest")}
          </button>
        </div>
      )}
      {suggestions &&
        (suggestions.length === 0 ? (
          <span className="chu-thich">{t("noSuggestions")}</span>
        ) : (
          suggestions.map((suggestion) => (
            <div key={`${suggestion.variantId}-${suggestion.linkedVariantId}`} className="nhom-nut">
              <span>{t("suggestion", { sku: suggestion.sku, linked: `${suggestion.linkedSku} · ${suggestion.linkedProductName}`, barcode: suggestion.barcode })}</span>
              <button type="button" className="nut chu" disabled={busy} onClick={() => void link(suggestion)}>
                {t("link")}
              </button>
            </div>
          ))
        ))}
      {editable && others.length > 0 && <span className="chu-thich">{t("copyHint")}</span>}
    </section>
  );
}
