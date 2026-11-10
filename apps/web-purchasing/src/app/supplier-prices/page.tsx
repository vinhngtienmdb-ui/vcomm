"use client";

// MAN_HINH_38 Bảng giá mua (CHUC_NANG_49; API_73): giá theo nhà cung cấp, mặt hàng, đơn vị mua, số lượng tối thiểu, hiệu lực.
import type { PageResponse, PurchasingOptionsResponse, SaveSupplierPriceRequest, StockItemOption, SupplierPriceResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { findItems, ItemPicker, itemLabel } from "@/components/ItemPicker";

export default function SupplierPricesPage() {
  const t = useTranslations("supplierPrices");
  const common = useTranslations("common");
  const { can, notify } = useAdmin();
  const canManage = can("purchasing.price.manage");
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SupplierPriceResponse | "new" | null>(null);

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
  const { state, reload } = useApi<PageResponse<SupplierPriceResponse>>(`/purchasing/supplier-prices?${parameters}`);
  const currency = options.state.kind === "ready" ? options.state.data.currency : "VND";
  const suppliers = options.state.kind === "ready" ? options.state.data.suppliers : [];

  async function toggle(price: SupplierPriceResponse) {
    try {
      await apiFetch(`/purchasing/supplier-prices/${price.id}/${price.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: price.version }) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const headings = [t("supplier"), t("item"), t("unit"), t("minQuantity"), t("unitPrice"), t("validity"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="supplier_price" />
        {canManage && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("add")}
          </button>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-gia-mua">
          {common("search")}
        </label>
        <input id="tim-gia-mua" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} style={{ maxWidth: 320 }} />
        <label className="an-nhan" htmlFor="loc-nha-cung-cap">
          {t("supplier")}
        </label>
        <select
          id="loc-nha-cung-cap"
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
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search || supplierId ? common("noResult") : t("none")} />
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
                  {result.data.map((price) => (
                    <tr key={price.id}>
                      <td data-nhan={headings[0]}>
                        <span>{price.supplierName}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {itemLabel(price)}
                          {price.supplierSku && <span className="chu-thich"> · {price.supplierSku}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{price.unitName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatNumber(price.minQuantity)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatMoney(price.unitPrice, currency)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>
                          {formatDate(price.validFrom)} – {price.validTo ? formatDate(price.validTo) : t("noEnd")}
                        </span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className={`nhan ${price.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(price.status)}</span>
                      </td>
                      <td data-nhan="">
                        {canManage && (
                          <span className="nhom-nut">
                            <button type="button" className="nut chu" onClick={() => setEditing(price)}>
                              {t("edit")}
                            </button>
                            <button type="button" className="nut chu" onClick={() => void toggle(price)}>
                              {price.status === "active" ? t("deactivate") : t("activate")}
                            </button>
                          </span>
                        )}
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
      {editing && (
        <PriceDrawer
          price={editing === "new" ? null : editing}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}

function PriceDrawer({ price, suppliers, onClose, onSaved }: { price: SupplierPriceResponse | null; suppliers: PurchasingOptionsResponse["suppliers"]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("supplierPrices");
  const common = useTranslations("common");
  const [supplierId, setSupplierId] = useState(price?.supplierId ?? "");
  const [item, setItem] = useState<StockItemOption | null>(null);
  const [unitId, setUnitId] = useState(price?.unitId ?? "");
  const [minQuantity, setMinQuantity] = useState(price?.minQuantity ?? "0");
  const [unitPrice, setUnitPrice] = useState(price?.unitPrice ?? "");
  const [supplierSku, setSupplierSku] = useState(price?.supplierSku ?? "");
  const [validFrom, setValidFrom] = useState(price?.validFrom ?? vietnamToday());
  const [validTo, setValidTo] = useState(price?.validTo ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  // Sửa giá: nạp lại danh sách đơn vị của mặt hàng đang có.
  useEffect(() => {
    if (!price) return;
    void findItems(price.sku).then((found) => setItem(found.find((candidate) => candidate.variantId === price.variantId) ?? null));
  }, [price]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveSupplierPriceRequest = {
        supplierId,
        variantId: item?.variantId ?? price?.variantId ?? "",
        unitId,
        minQuantity,
        unitPrice: unitPrice.replace(/\./g, ""),
        supplierSku,
        validFrom,
        validTo: validTo || null,
        ...(price ? { version: price.version } : {}),
      };
      await apiFetch(price ? `/purchasing/supplier-prices/${price.id}` : "/purchasing/supplier-prices", { method: price ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  }

  return (
    <Drawer title={price ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="nha-cung-cap" label={`${t("supplier")} *`} hint={t("supplierHint")} error={fields.supplierId}>
          <select id="nha-cung-cap" className={inputClass("supplierId")} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{t("choose")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="mat-hang" label={`${t("item")} *`} error={fields.variantId}>
          {item ? (
            <span className="nhom-nut" style={{ alignItems: "center" }}>
              <strong>{itemLabel(item)}</strong>
              <button type="button" className="nut chu" onClick={() => setItem(null)}>
                {t("changeItem")}
              </button>
            </span>
          ) : (
            <ItemPicker
              id="mat-hang"
              invalid={Boolean(fields.variantId)}
              onPick={(picked) => {
                setItem(picked);
                setUnitId(picked.matchedUnitId ?? picked.units[picked.units.length - 1]?.unitId ?? picked.baseUnitId);
              }}
            />
          )}
        </Field>
        <Field id="don-vi-mua" label={`${t("unit")} *`} error={fields.unitId}>
          <select id="don-vi-mua" className={inputClass("unitId")} value={unitId} onChange={(event) => setUnitId(event.target.value)}>
            {(item?.units ?? []).map((unit) => (
              <option key={unit.unitId} value={unit.unitId}>
                {unit.unitName}
                {unit.factor !== "1" ? ` (${unit.factor})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id="so-luong-toi-thieu" label={t("minQuantity")} hint={t("minQuantityHint")} error={fields.minQuantity}>
          <input id="so-luong-toi-thieu" className={inputClass("minQuantity")} inputMode="decimal" value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)} />
        </Field>
        <Field id="don-gia" label={`${t("unitPrice")} *`} hint={t("unitPriceHint")} error={fields.unitPrice}>
          <input id="don-gia" className={inputClass("unitPrice")} inputMode="numeric" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
        </Field>
        <Field id="ma-hang-nha-cung-cap" label={t("supplierSku")} error={fields.supplierSku}>
          <input id="ma-hang-nha-cung-cap" className={inputClass("supplierSku")} value={supplierSku} onChange={(event) => setSupplierSku(event.target.value)} />
        </Field>
        <Field id="hieu-luc-tu" label={`${t("validFrom")} *`} error={fields.validFrom}>
          <input id="hieu-luc-tu" className={inputClass("validFrom")} type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
        </Field>
        <Field id="hieu-luc-den" label={t("validTo")} hint={t("validToHint")} error={fields.validTo}>
          <input id="hieu-luc-den" className={inputClass("validTo")} type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
        </Field>
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
