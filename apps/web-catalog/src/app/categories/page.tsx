"use client";

// MAN_HINH_22 Ngành hàng và đơn vị tính (CHUC_NANG_30; API_55): dùng chung tập đoàn, chỉ quản trị tập đoàn sửa.
import type { CategoryResponse, UnitResponse } from "contracts";
import { categoryMaximumLevel } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { TreeList } from "ui/components/TreeList";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "categories" | "units";

export default function CategoriesPage() {
  const t = useTranslations("categories");
  const { can } = useAdmin();
  const [tab, setTab] = useState<Tab>("categories");
  const canManage = can("catalog.category.manage");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType={tab === "categories" ? "category" : "unit"} />
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="cac-the" role="tablist">
        {(["categories", "units"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab === "categories" ? <Categories canManage={canManage} /> : <Units canManage={canManage} />}
    </>
  );
}

function Categories({ canManage }: { canManage: boolean }) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const locale = useLocale();
  const { notify } = useAdmin();
  const { state, reload } = useApi<CategoryResponse[]>("/catalog/categories");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: "create"; parentId: string | null } | { mode: "edit" } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const name = (category: CategoryResponse) => (locale === "en" ? category.nameEn : category.nameVi);

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(categories) => {
        const selected = categories.find((category) => category.id === selectedId) ?? null;
        async function toggleStatus() {
          if (!selected) return;
          setBusy(true);
          setConfirmError(null);
          try {
            await apiFetch(`/catalog/categories/${selected.id}/${selected.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: selected.version }) });
            setConfirming(false);
            notify(t("saved"));
            await reload();
          } catch (error) {
            setConfirmError(failureOf(error).message);
          } finally {
            setBusy(false);
          }
        }
        return (
          <>
            {canManage && (
              <div className="nhom-nut">
                <button type="button" className="nut chinh" onClick={() => setDrawer({ mode: "create", parentId: null })}>
                  {t("addRoot")}
                </button>
              </div>
            )}
            <div className="hai-cot">
              <div className="the">
                {categories.length === 0 ? (
                  <MessageView text={t("none")} />
                ) : (
                  <TreeList
                    items={categories}
                    selectedId={selectedId}
                    onSelect={(category) => setSelectedId(category.id)}
                    label={(category) => (
                      <>
                        {category.code} · {name(category)} {category.status === "inactive" && <span className="nhan trung-tinh">{t("inactive")}</span>}
                      </>
                    )}
                  />
                )}
              </div>
              {selected ? (
                <div className="the">
                  <h2>{name(selected)}</h2>
                  <dl className="thong-tin-dong">
                    <dt>{t("code")}</dt>
                    <dd>{selected.code}</dd>
                    <dt>{t("nameEn")}</dt>
                    <dd>{selected.nameEn}</dd>
                    <dt>{t("level")}</dt>
                    <dd>{selected.level}</dd>
                    <dt>{t("tracking")}</dt>
                    <dd>{selected.tracksLots ? t("tracksLots") : selected.tracksSerials ? t("tracksSerials") : t("noTracking")}</dd>
                    <dt>{t("warrantyMonths")}</dt>
                    <dd>{selected.warrantyMonths > 0 ? t("months", { count: selected.warrantyMonths }) : "—"}</dd>
                    <dt>{t("productCount")}</dt>
                    <dd>{selected.productCount}</dd>
                    <dt>{t("status")}</dt>
                    <dd>
                      <span className={`nhan ${selected.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(selected.status)}</span>
                    </dd>
                  </dl>
                  {canManage && (
                    <div className="nhom-nut">
                      <button type="button" className="nut phu" onClick={() => setDrawer({ mode: "edit" })}>
                        {t("edit")}
                      </button>
                      {selected.level < categoryMaximumLevel && selected.productCount === 0 && (
                        <button type="button" className="nut phu" onClick={() => setDrawer({ mode: "create", parentId: selected.id })}>
                          {t("addChild")}
                        </button>
                      )}
                      <button type="button" className="nut chu" onClick={() => setConfirming(true)}>
                        {selected.status === "active" ? t("deactivate") : t("activate")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="the">
                  <MessageView text={t("pick")} />
                </div>
              )}
            </div>
            {drawer && (
              <CategoryDrawer
                categories={categories}
                category={drawer.mode === "edit" ? selected : null}
                parentId={drawer.mode === "create" ? drawer.parentId : (selected?.parentId ?? null)}
                onClose={() => setDrawer(null)}
                onSaved={(saved) => {
                  setDrawer(null);
                  setSelectedId(saved.id);
                  notify(t("saved"));
                  void reload();
                }}
              />
            )}
            {confirming && selected && (
              <ConfirmDialog
                title={selected.status === "active" ? t("deactivate") : t("activate")}
                text={selected.status === "active" ? t("deactivateText") : t("activateText")}
                confirmLabel={selected.status === "active" ? t("deactivate") : t("activate")}
                busy={busy}
                error={confirmError}
                onConfirm={() => void toggleStatus()}
                onClose={() => setConfirming(false)}
              />
            )}
          </>
        );
      }}
    </Loaded>
  );
}

type Tracking = "none" | "lots" | "serials";

function CategoryDrawer({
  categories,
  category,
  parentId: initialParentId,
  onClose,
  onSaved,
}: {
  categories: CategoryResponse[];
  category: CategoryResponse | null;
  parentId: string | null;
  onClose: () => void;
  onSaved: (category: CategoryResponse) => void;
}) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const locale = useLocale();
  const [parentId, setParentId] = useState(initialParentId ?? "");
  const [code, setCode] = useState(category?.code ?? "");
  const [nameVi, setNameVi] = useState(category?.nameVi ?? "");
  const [nameEn, setNameEn] = useState(category?.nameEn ?? "");
  const parent = categories.find((item) => item.id === initialParentId);
  const [tracking, setTracking] = useState<Tracking>(
    category ? (category.tracksLots ? "lots" : category.tracksSerials ? "serials" : "none") : parent?.tracksLots ? "lots" : parent?.tracksSerials ? "serials" : "none",
  );
  const [warrantyMonths, setWarrantyMonths] = useState(String(category?.warrantyMonths ?? parent?.warrantyMonths ?? 0));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  // Ngành hàng cha chọn được: chưa có sản phẩm, chưa đủ 4 cấp, không phải chính nó.
  const parents = categories.filter((item) => item.id !== category?.id && item.productCount === 0 && item.level < categoryMaximumLevel);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body = { parentId: parentId || null, code, nameVi, nameEn, tracksLots: tracking === "lots", tracksSerials: tracking === "serials", warrantyMonths: Number(warrantyMonths) || 0 };
      const saved = category
        ? await apiFetch<CategoryResponse>(`/catalog/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ ...body, version: category.version }) })
        : await apiFetch<CategoryResponse>("/catalog/categories", { method: "POST", body: JSON.stringify(body) });
      onSaved(saved);
    });
  }

  return (
    <Drawer title={category ? `${t("edit")}: ${category.code}` : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="nganh-cha" label={t("parent")} error={fields.parentId}>
          <select id="nganh-cha" className={inputClass("parentId")} value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">{t("noParent")}</option>
            {parents.map((item) => (
              <option key={item.id} value={item.id}>
                {"— ".repeat(item.level - 1)}
                {item.code} · {locale === "en" ? item.nameEn : item.nameVi}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ma-nganh" label={`${t("code")} *`} hint={t("codeHint")} error={fields.code}>
          <input id="ma-nganh" className={inputClass("code")} value={code} maxLength={6} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="ten-nganh" label={`${t("nameVi")} *`} error={fields.nameVi}>
          <input id="ten-nganh" className={inputClass("nameVi")} value={nameVi} maxLength={200} onChange={(event) => setNameVi(event.target.value)} />
        </Field>
        <Field id="ten-nganh-en" label={`${t("nameEn")} *`} error={fields.nameEn}>
          <input id="ten-nganh-en" className={inputClass("nameEn")} value={nameEn} maxLength={200} onChange={(event) => setNameEn(event.target.value)} />
        </Field>
        <Field id="theo-doi" label={t("tracking")} hint={t("trackingHint")} error={fields.tracksSerials ?? fields.tracksLots}>
          <select id="theo-doi" className="o-nhap" value={tracking} onChange={(event) => setTracking(event.target.value as Tracking)}>
            <option value="none">{t("noTracking")}</option>
            <option value="lots">{t("tracksLots")}</option>
            <option value="serials">{t("tracksSerials")}</option>
          </select>
        </Field>
        <Field id="bao-hanh" label={t("warrantyMonths")} error={fields.warrantyMonths}>
          <input id="bao-hanh" type="number" min={0} max={120} className={inputClass("warrantyMonths")} value={warrantyMonths} onChange={(event) => setWarrantyMonths(event.target.value)} />
        </Field>
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

function Units({ canManage }: { canManage: boolean }) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state, reload } = useApi<UnitResponse[]>("/catalog/units");
  const [editing, setEditing] = useState<UnitResponse | "new" | null>(null);

  async function toggle(unit: UnitResponse) {
    try {
      await apiFetch(`/catalog/units/${unit.id}/${unit.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: unit.version }) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const headings = [t("code"), t("nameVi"), t("nameEn"), t("status"), ""];
  return (
    <>
      {canManage && (
        <div className="nhom-nut">
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addUnit")}
          </button>
        </div>
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(units) => (
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
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td data-nhan={headings[0]}>
                      <span>{unit.code}</span>
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>{unit.nameVi}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span>{unit.nameEn}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span className={`nhan ${unit.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(unit.status)}</span>
                    </td>
                    <td data-nhan="">
                      {canManage && (
                        <span className="nhom-nut">
                          <button type="button" className="nut chu" onClick={() => setEditing(unit)}>
                            {t("edit")}
                          </button>
                          <button type="button" className="nut chu" onClick={() => void toggle(unit)}>
                            {unit.status === "active" ? t("deactivate") : t("activate")}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
      {editing && (
        <UnitDrawer
          unit={editing === "new" ? null : editing}
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

function UnitDrawer({ unit, onClose, onSaved }: { unit: UnitResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("categories");
  const common = useTranslations("common");
  const [code, setCode] = useState(unit?.code ?? "");
  const [nameVi, setNameVi] = useState(unit?.nameVi ?? "");
  const [nameEn, setNameEn] = useState(unit?.nameEn ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (unit) await apiFetch(`/catalog/units/${unit.id}`, { method: "PATCH", body: JSON.stringify({ nameVi, nameEn, version: unit.version }) });
      else await apiFetch("/catalog/units", { method: "POST", body: JSON.stringify({ code, nameVi, nameEn }) });
      onSaved();
    });
  }

  return (
    <Drawer title={unit ? `${t("edit")}: ${unit.code}` : t("addUnit")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="ma-don-vi" label={`${t("code")} *`} error={fields.code}>
          <input id="ma-don-vi" className={inputClass("code")} value={code} maxLength={10} disabled={Boolean(unit)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="ten-don-vi" label={`${t("nameVi")} *`} error={fields.nameVi}>
          <input id="ten-don-vi" className={inputClass("nameVi")} value={nameVi} maxLength={100} onChange={(event) => setNameVi(event.target.value)} />
        </Field>
        <Field id="ten-don-vi-en" label={`${t("nameEn")} *`} error={fields.nameEn}>
          <input id="ten-don-vi-en" className={inputClass("nameEn")} value={nameEn} maxLength={100} onChange={(event) => setNameEn(event.target.value)} />
        </Field>
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
