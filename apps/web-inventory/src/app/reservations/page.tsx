"use client";

// MAN_HINH_35 Giữ hàng và tồn an toàn (CHUC_NANG_43, 44; API_68, 69): danh sách hàng giữ, gia hạn, nhả; đặt tối thiểu, tối đa; cảnh báo kèm số gợi ý.
import type { PageResponse, ReservationResponse, StockItemOption, StockLevelRow, WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "reservations" | "levels";

export default function ReservationsPage() {
  const t = useTranslations("reservations");
  const [tab, setTab] = useState<Tab>("reservations");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType={tab === "reservations" ? "reservation" : "stock_level"} />
      </div>
      <div className="cac-the" role="tablist">
        {(["reservations", "levels"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab === "reservations" ? <Reservations /> : <Levels />}
    </>
  );
}

function Reservations() {
  const t = useTranslations("reservations");
  const { can, notify } = useAdmin();
  const [status, setStatus] = useState<"active" | "released" | "consumed">("active");
  const { state, reload } = useApi<PageResponse<ReservationResponse>>(`/inventory/reservations?status=${status}`);
  const canManage = can("inventory.reservation.manage");

  async function act(reservation: ReservationResponse, action: "extend" | "release") {
    try {
      await apiFetch(`/inventory/reservations/${reservation.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "extend" ? { hours: 24, version: reservation.version } : { version: reservation.version }),
      });
      notify(t(action === "extend" ? "extended" : "released"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const headings = [t("item"), t("warehouse"), t("quantity"), t("source"), t("expiresAt"), t("createdBy"), ""];
  return (
    <>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-giu">
          {t("status")}
        </label>
        <select id="loc-giu" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          {(["active", "released", "consumed"] as const).map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      {canManage && <ReservationForm onSaved={() => void reload()} />}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <span>
                          {item.sku} · {item.productName}
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {item.warehouseName} · {item.companyName}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          {formatNumber(item.quantity)} {item.baseUnitName}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {t(`source_${item.sourceType.replace(".", "_")}`)}
                          {item.sourceNo && ` · ${item.sourceNo}`}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.expiresAt ? formatDateTime(item.expiresAt) : t("noExpiry")}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{item.createdByName ?? "—"}</span>
                      </td>
                      <td data-nhan="">
                        {canManage && item.status === "active" && item.sourceType !== "inventory.document" && (
                          <span className="nhom-nut">
                            {item.expiresAt && (
                              <button type="button" className="nut chu" onClick={() => void act(item, "extend")}>
                                {t("extend")}
                              </button>
                            )}
                            <button type="button" className="nut chu" onClick={() => void act(item, "release")}>
                              {t("release")}
                            </button>
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

// Biểu mẫu chung cho giữ hàng thủ công và đặt tồn an toàn: chọn kho, chủ hàng, mặt hàng (quét mã vạch hoặc gõ mã hàng).
function useItemPicker() {
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const operable = warehouses.state.kind === "ready" ? warehouses.state.data.filter((item) => item.canOperate && item.status === "active") : [];
  const [warehouseId, setWarehouseId] = useState("");
  const warehouse = operable.find((item) => item.id === warehouseId) ?? operable[0] ?? null;
  const [companyId, setCompanyId] = useState("");
  const owner = companyId || warehouse?.companyId || "";
  const [item, setItem] = useState<StockItemOption | null>(null);
  const [search, setSearch] = useState("");
  async function find() {
    if (!search.trim() || !owner) return;
    const found = await apiFetch<StockItemOption[]>(`/inventory/items?${new URLSearchParams({ companyId: owner, search: search.trim() })}`).catch(() => []);
    setItem(found[0] ?? null);
  }
  return { operable, warehouse, setWarehouseId, owner, setCompanyId, item, search, setSearch, find };
}

function PickerFields({ picker, prefix }: { picker: ReturnType<typeof useItemPicker>; prefix: string }) {
  const t = useTranslations("reservations");
  return (
    <>
      <Field id={`${prefix}-kho`} label={t("warehouse")}>
        <select id={`${prefix}-kho`} className="o-nhap" value={picker.warehouse?.id ?? ""} onChange={(event) => picker.setWarehouseId(event.target.value)}>
          {picker.operable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${prefix}-chu-hang`} label={t("owner")}>
        <select id={`${prefix}-chu-hang`} className="o-nhap" value={picker.owner} onChange={(event) => picker.setCompanyId(event.target.value)}>
          {picker.warehouse?.owners.map((item) => (
            <option key={item.companyId} value={item.companyId}>
              {item.companyName}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${prefix}-mat-hang`} label={t("item")} hint={picker.item ? `${picker.item.sku} · ${picker.item.productName}` : t("itemHint")}>
        <input
          id={`${prefix}-mat-hang`}
          className="o-nhap"
          value={picker.search}
          onChange={(event) => picker.setSearch(event.target.value)}
          onBlur={() => void picker.find()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void picker.find();
            }
          }}
        />
      </Field>
    </>
  );
}

function ReservationForm({ onSaved }: { onSaved: () => void }) {
  const t = useTranslations("reservations");
  const { notify } = useAdmin();
  const picker = useItemPicker();
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/inventory/reservations", {
        method: "POST",
        body: JSON.stringify({ warehouseId: picker.warehouse?.id, companyId: picker.owner, variantId: picker.item?.variantId, quantity, note }),
      });
      notify(t("reserved"));
      setQuantity("");
      setNote("");
      onSaved();
    });
  }
  return (
    <form
      className="the"
      onSubmit={submit}
      noValidate
      style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "var(--khoang-4)" }}
    >
      <PickerFields picker={picker} prefix="giu" />
      <Field id="giu-so-luong" label={t("quantityBase")} error={fields.quantity}>
        <input id="giu-so-luong" inputMode="decimal" className={inputClass("quantity")} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </Field>
      <Field id="giu-ghi-chu" label={t("note")} error={fields.note}>
        <input id="giu-ghi-chu" className={inputClass("note")} value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <FormError text={formError ?? (fields.variantId ? t("itemHint") : null)} />
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !picker.item} style={{ alignSelf: "end" }}>
        {t("reserve")}
      </button>
    </form>
  );
}

function Levels() {
  const t = useTranslations("reservations");
  const { can, notify } = useAdmin();
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const { state, reload } = useApi<StockLevelRow[]>(onlyAlerts ? "/inventory/stock-alerts" : "/inventory/stock-levels");
  const canManage = can("inventory.reservation.manage");
  const picker = useItemPicker();
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/inventory/stock-levels", {
        method: "PUT",
        body: JSON.stringify({ warehouseId: picker.warehouse?.id, companyId: picker.owner, variantId: picker.item?.variantId, minimum, maximum }),
      });
      notify(t("levelSaved"));
      await reload();
    });
  }

  async function remove(row: StockLevelRow) {
    try {
      await apiFetch(`/inventory/stock-levels/${row.warehouseId}/${row.companyId}/${row.variantId}`, { method: "DELETE" });
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const headings = [t("item"), t("warehouse"), t("minimum"), t("maximum"), t("available"), t("incoming"), t("suggested"), ""];
  return (
    <>
      {canManage && (
        <form
          className="the"
          onSubmit={submit}
          noValidate
          style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: "var(--khoang-4)" }}
        >
          <PickerFields picker={picker} prefix="muc" />
          <Field id="muc-toi-thieu" label={t("minimum")} error={fields.minimum}>
            <input id="muc-toi-thieu" inputMode="decimal" className={inputClass("minimum")} value={minimum} onChange={(event) => setMinimum(event.target.value)} />
          </Field>
          <Field id="muc-toi-da" label={t("maximum")} error={fields.maximum}>
            <input id="muc-toi-da" inputMode="decimal" className={inputClass("maximum")} value={maximum} onChange={(event) => setMaximum(event.target.value)} />
          </Field>
          <FormError text={formError} />
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !picker.item} style={{ alignSelf: "end" }}>
            {t("saveLevel")}
          </button>
        </form>
      )}
      <label style={{ display: "inline-flex", gap: "var(--khoang-2)", alignItems: "center", marginBottom: "var(--khoang-3)" }}>
        <input type="checkbox" checked={onlyAlerts} onChange={(event) => setOnlyAlerts(event.target.checked)} /> {t("onlyAlerts")}
      </label>
      <Loaded state={state} onRetry={() => void reload()}>
        {(rows) =>
          rows.length === 0 ? (
            <MessageView text={onlyAlerts ? t("noAlerts") : t("noLevels")} />
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
                  {rows.map((row) => (
                    <tr key={`${row.warehouseId}:${row.companyId}:${row.variantId}`}>
                      <td data-nhan={headings[0]}>
                        <span>
                          {row.sku} · {row.productName}
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {row.warehouseName} · {row.companyName}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatNumber(row.minimum)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatNumber(row.maximum)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {formatNumber(row.available)}
                          {row.belowMinimum && <span className="nhan canh-bao">{t("below")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatNumber(row.incoming)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{row.belowMinimum ? `${formatNumber(row.suggestedQuantity)} ${row.baseUnitName}` : "—"}</span>
                      </td>
                      <td data-nhan="">
                        {canManage && (
                          <button type="button" className="nut chu" onClick={() => void remove(row)}>
                            {t("removeLevel")}
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
    </>
  );
}
