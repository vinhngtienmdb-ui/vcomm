"use client";

// MAN_HINH_10 Chi nhánh (CHUC_NANG_02; API_22).
import { branchTypes, type BranchResponse, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ConfirmDialog, Drawer } from "@/components/Dialogs";
import { Field, FormError, useSubmit } from "@/components/Form";
import { Loaded, MessageView } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";
import { failureOf, useApi } from "@/lib/use-api";

export default function BranchesPage() {
  const t = useTranslations("branches");
  const common = useTranslations("common");
  const org = useTranslations("org");
  const companies = useTranslations("companies");
  const { notify } = useAdmin();
  const [branchType, setBranchType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BranchResponse | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<BranchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (branchType) parameters.set("branchType", branchType);
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<BranchResponse>>(`/branches?${parameters}`);

  async function deactivate() {
    if (!deactivating) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await apiFetch(`/branches/${deactivating.id}/deactivate`, { method: "POST", body: JSON.stringify({ version: deactivating.version }) });
      setDeactivating(null);
      notify(org("deactivated"));
      await reload();
    } catch (error) {
      setConfirmError(failureOf(error).message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [t("code"), t("name"), t("type"), t("province"), t("address"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
          {t("add")}
        </button>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-loai">
          {t("typeFilter")}
        </label>
        <select
          id="loc-loai"
          className="o-nhap"
          value={branchType}
          onChange={(event) => {
            setBranchType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("typeFilter")}: ${common("all")}`}</option>
          {branchTypes.map((type) => (
            <option key={type} value={type}>
              {t(type)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("statusFilter")}
        </label>
        <select
          id="loc-trang-thai"
          className="o-nhap"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("statusFilter")}: ${common("all")}`}</option>
          <option value="active">{companies("active")}</option>
          <option value="inactive">{companies("inactive")}</option>
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={branchType || status ? common("noResult") : common("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {columns.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((branch) => (
                    <tr key={branch.id}>
                      <td data-nhan={t("code")}>
                        <span>{branch.code}</span>
                      </td>
                      <td data-nhan={t("name")}>
                        <span>{branch.name}</span>
                      </td>
                      <td data-nhan={t("type")}>
                        <span>{t(branch.branchType)}</span>
                      </td>
                      <td data-nhan={t("province")}>
                        <span>{branch.provinceCode ?? common("none")}</span>
                      </td>
                      <td data-nhan={t("address")}>
                        <span>{branch.address ?? common("none")}</span>
                      </td>
                      <td data-nhan={t("status")}>
                        <span>
                          <span className={`nhan ${branch.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{companies(branch.status)}</span>
                        </span>
                      </td>
                      <td data-nhan="">
                        <span className="nhom-nut">
                          <button type="button" className="nut phu" onClick={() => setEditing(branch)}>
                            {t("edit")}
                          </button>
                          {branch.status === "active" && (
                            <button
                              type="button"
                              className="nut nguy-hiem"
                              onClick={() => {
                                setConfirmError(null);
                                setDeactivating(branch);
                              }}
                            >
                              {t("deactivate")}
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
      {editing && (
        <BranchDrawer
          branch={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            notify(org("saved"));
            await reload();
          }}
        />
      )}
      {deactivating && (
        <ConfirmDialog
          title={t("deactivate")}
          text={t("deactivateConfirm", { name: deactivating.name })}
          confirmLabel={t("deactivate")}
          busy={busy}
          error={confirmError}
          onConfirm={() => void deactivate()}
          onClose={() => setDeactivating(null)}
        />
      )}
    </>
  );
}

function BranchDrawer({ branch, onClose, onSaved }: { branch: BranchResponse | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = useTranslations("branches");
  const common = useTranslations("common");
  const [values, setValues] = useState({
    code: branch?.code ?? "",
    name: branch?.name ?? "",
    branchType: branch?.branchType ?? "office",
    provinceCode: branch?.provinceCode ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
  });
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = { ...values, provinceCode: values.provinceCode || null, address: values.address || null, phone: values.phone || null };
    void run(async () => {
      if (branch) await apiFetch(`/branches/${branch.id}`, { method: "PATCH", body: JSON.stringify({ ...body, version: branch.version }) });
      else await apiFetch("/branches", { method: "POST", body: JSON.stringify(body) });
      await onSaved();
    });
  }

  const text = (key: keyof typeof values, label: string, hint?: string) => (
    <Field id={`chi-nhanh-${key}`} label={label} error={fields[key]} {...(hint ? { hint } : {})}>
      <input id={`chi-nhanh-${key}`} className={inputClass(key)} value={values[key]} onChange={set(key)} />
    </Field>
  );

  return (
    <Drawer title={branch ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {text("code", t("code"))}
        {text("name", t("name"))}
        <Field id="chi-nhanh-branchType" label={t("type")} error={fields.branchType}>
          <select id="chi-nhanh-branchType" className={inputClass("branchType")} value={values.branchType} onChange={set("branchType")}>
            {branchTypes.map((type) => (
              <option key={type} value={type}>
                {t(type)}
              </option>
            ))}
          </select>
        </Field>
        {text("provinceCode", t("province"), t("provinceHint"))}
        {text("address", t("address"))}
        {text("phone", t("phone"))}
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
