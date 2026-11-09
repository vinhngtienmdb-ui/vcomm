"use client";

// MAN_HINH_28 Kho và vị trí (CHUC_NANG_38; API_63): kho thuộc chi nhánh, công ty chủ hàng, vị trí kệ, cài đặt giữ hàng.
import type { InventorySettingsResponse, LocationResponse, WarehouseOptionsResponse, WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

export default function WarehousesPage() {
  const t = useTranslations("warehouses");
  const { can, notify } = useAdmin();
  const canManage = can("inventory.warehouse.manage");
  const { state, reload } = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const [editing, setEditing] = useState<WarehouseResponse | "new" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function toggle(warehouse: WarehouseResponse) {
    try {
      await apiFetch(`/inventory/warehouses/${warehouse.id}/${warehouse.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: warehouse.version }) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const headings = [t("code"), t("name"), t("branch"), t("owners"), t("locations"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="warehouse" />
        {canManage && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("add")}
          </button>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(warehouses) => {
          const selected = warehouses.find((warehouse) => warehouse.id === selectedId) ?? null;
          return warehouses.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <>
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
                    {warehouses.map((warehouse) => (
                      <tr key={warehouse.id}>
                        <td data-nhan={headings[0]}>
                          <button type="button" className="nut chu" onClick={() => setSelectedId(warehouse.id)}>
                            {warehouse.code}
                          </button>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>
                            {warehouse.name}
                            {!warehouse.canOperate && <span className="chu-thich"> · {warehouse.companyName}</span>}
                          </span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{warehouse.branchName}</span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{warehouse.owners.map((owner) => owner.companyName).join(", ")}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>{warehouse.usesLocations ? warehouse.locationCount : t("noLocations")}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span className={`nhan ${warehouse.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(warehouse.status)}</span>
                          {!warehouse.canOperate && <span className="nhan thong-tin">{t("viewOnly")}</span>}
                        </td>
                        <td data-nhan="">
                          {warehouse.canManage && (
                            <span className="nhom-nut">
                              <button type="button" className="nut chu" onClick={() => setEditing(warehouse)}>
                                {t("edit")}
                              </button>
                              <button type="button" className="nut chu" onClick={() => void toggle(warehouse)}>
                                {warehouse.status === "active" ? t("deactivate") : t("activate")}
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected?.usesLocations && <Locations key={selected.id} warehouse={selected} onChanged={() => void reload()} />}
            </>
          );
        }}
      </Loaded>
      {canManage && <Settings />}
      {editing && (
        <WarehouseDrawer
          warehouse={editing === "new" ? null : editing}
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

// Vị trí kệ của một kho: thêm nhiều mã một lần, mỗi dòng một mã.
function Locations({ warehouse, onChanged }: { warehouse: WarehouseResponse; onChanged: () => void }) {
  const t = useTranslations("warehouses");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state, reload } = useApi<LocationResponse[]>(`/inventory/warehouses/${warehouse.id}/locations`);
  const [codes, setCodes] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function add(event: FormEvent) {
    event.preventDefault();
    const locations = codes
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [code = "", ...name] = line.split(/\s+/);
        return { code, name: name.join(" ") || null };
      });
    void run(async () => {
      await apiFetch(`/inventory/warehouses/${warehouse.id}/locations`, { method: "POST", body: JSON.stringify({ locations }) });
      setCodes("");
      notify(t("saved"));
      await reload();
      onChanged();
    });
  }

  async function toggle(location: LocationResponse) {
    try {
      await apiFetch(`/inventory/warehouses/${warehouse.id}/locations/${location.id}/${location.status === "active" ? "deactivate" : "activate"}`, {
        method: "POST",
        body: JSON.stringify({ version: location.version }),
      });
      await reload();
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const lineErrors = Object.entries(fields).filter(([key]) => key.startsWith("locations."));
  return (
    <section className="the" style={{ marginTop: "var(--khoang-4)", display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("locationsOf", { name: warehouse.name })}</h2>
        <button
          type="button"
          className="nut phu"
          onClick={() => void apiDownload(`/inventory/labels/locations?warehouseId=${warehouse.id}`, "tem-vi-tri.pdf", true).catch((error) => notify(failureOf(error).message, "loi"))}
        >
          {t("printLabels")}
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(locations) =>
          locations.length === 0 ? (
            <p className="chu-thich">{t("noLocationsYet")}</p>
          ) : (
            <div className="nhom-nut">
              {locations.map((location) => (
                <span key={location.id} className={`nhan ${location.status === "active" ? "thong-tin" : "trung-tinh"}`}>
                  {location.code}
                  {location.name ? ` · ${location.name}` : ""}
                  {warehouse.canManage && (
                    <button type="button" className="nut chu" onClick={() => void toggle(location)}>
                      {location.status === "active" ? t("deactivate") : t("activate")}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )
        }
      </Loaded>
      {warehouse.canManage && (
        <form onSubmit={add} noValidate style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <Field
            id="ma-vi-tri"
            label={t("addLocations")}
            hint={t("addLocationsHint")}
            error={lineErrors.map(([key, message]) => `${t("line", { line: Number(key.split(".")[1]) + 1 })}: ${message}`).join(" ") || undefined}
          >
            <textarea id="ma-vi-tri" className={inputClass("locations")} rows={4} value={codes} onChange={(event) => setCodes(event.target.value)} />
          </Field>
          <FormError text={formError} />
          <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !codes.trim()} style={{ justifySelf: "start" }}>
            {common("save")}
          </button>
        </form>
      )}
    </section>
  );
}

function Settings() {
  const t = useTranslations("warehouses");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state, reload } = useApi<InventorySettingsResponse>("/inventory/settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settings) => (
        <SettingsForm
          key={settings.version}
          settings={settings}
          label={common("save")}
          onSaved={() => {
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </Loaded>
  );
}

function SettingsForm({ settings, label, onSaved }: { settings: InventorySettingsResponse; label: string; onSaved: () => void }) {
  const t = useTranslations("warehouses");
  const [hours, setHours] = useState(String(settings.reservationHours));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/inventory/settings", { method: "PUT", body: JSON.stringify({ reservationHours: Number(hours), version: settings.version }) });
      onSaved();
    });
  }
  return (
    <form className="the" onSubmit={submit} noValidate style={{ marginTop: "var(--khoang-4)", display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("settings")}</h2>
      <Field id="gio-giu-hang" label={t("reservationHours")} hint={t("reservationHoursHint")} error={fields.reservationHours}>
        <input id="gio-giu-hang" type="number" min={1} max={720} className={inputClass("reservationHours")} value={hours} onChange={(event) => setHours(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifySelf: "start" }}>
        {label}
      </button>
    </form>
  );
}

function WarehouseDrawer({ warehouse, onClose, onSaved }: { warehouse: WarehouseResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("warehouses");
  const common = useTranslations("common");
  const { me } = useAdmin();
  const options = useApi<WarehouseOptionsResponse>("/inventory/warehouse-options");
  const [branchId, setBranchId] = useState(warehouse?.branchId ?? "");
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [name, setName] = useState(warehouse?.name ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [usesLocations, setUsesLocations] = useState(warehouse?.usesLocations ?? false);
  const ownerCompanyId = warehouse?.companyId ?? me?.currentCompanyId ?? "";
  const [owners, setOwners] = useState<string[]>(warehouse?.owners.map((owner) => owner.companyId).filter((id) => id !== ownerCompanyId) ?? []);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const common = { name, address: address || null, usesLocations, ownerCompanyIds: owners };
      if (warehouse) await apiFetch(`/inventory/warehouses/${warehouse.id}`, { method: "PATCH", body: JSON.stringify({ ...common, version: warehouse.version }) });
      else await apiFetch("/inventory/warehouses", { method: "POST", body: JSON.stringify({ ...common, branchId, code }) });
      onSaved();
    });
  }

  return (
    <Drawer title={warehouse ? `${t("edit")}: ${warehouse.code}` : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="chi-nhanh" label={`${t("branch")} *`} error={fields.branchId}>
          <select id="chi-nhanh" className={inputClass("branchId")} value={branchId} disabled={Boolean(warehouse)} onChange={(event) => setBranchId(event.target.value)}>
            {warehouse ? <option value={warehouse.branchId}>{warehouse.branchName}</option> : <option value="">—</option>}
            {!warehouse &&
              options.state.kind === "ready" &&
              options.state.data.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </select>
        </Field>
        <Field id="ma-kho" label={`${t("code")} *`} hint={t("codeHint")} error={fields.code}>
          <input id="ma-kho" className={inputClass("code")} value={code} maxLength={20} disabled={Boolean(warehouse)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="ten-kho" label={`${t("name")} *`} error={fields.name}>
          <input id="ten-kho" className={inputClass("name")} value={name} maxLength={200} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="dia-chi-kho" label={t("address")} error={fields.address}>
          <input id="dia-chi-kho" className={inputClass("address")} value={address} maxLength={500} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Field id="dung-vi-tri" label={t("locations")} hint={t("usesLocationsHint")} error={fields.usesLocations}>
          <label style={{ display: "inline-flex", gap: "var(--khoang-2)", alignItems: "center" }}>
            <input id="dung-vi-tri" type="checkbox" checked={usesLocations} onChange={(event) => setUsesLocations(event.target.checked)} /> {t("usesLocations")}
          </label>
        </Field>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "var(--khoang-2)" }}>
          <legend>{t("otherOwners")}</legend>
          <span className="chu-thich">{t("otherOwnersHint")}</span>
          {options.state.kind === "ready" &&
            options.state.data.companies
              .filter((company) => company.id !== ownerCompanyId)
              .map((company) => (
                <label key={company.id} style={{ display: "inline-flex", gap: "var(--khoang-2)", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={owners.includes(company.id)}
                    onChange={(event) => setOwners(event.target.checked ? [...owners, company.id] : owners.filter((id) => id !== company.id))}
                  />
                  {company.shortName}
                </label>
              ))}
          {fields.ownerCompanyIds && <span className="loi-o">{fields.ownerCompanyIds}</span>}
        </fieldset>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
