"use client";

// Ngăn kéo mời nhân viên, hộp thoại nhập Excel (MAN_HINH_12), ngăn kéo sửa thông tin (MAN_HINH_13).
import type { BranchResponse, DepartmentResponse, InviteUserResponse, PageResponse, RoleResponse, UserDetailResponse, UserImportResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";

// Danh sách chọn dùng chung; thiếu quyền xem danh mục thì để trống.
function useChoices() {
  const branches = useApi<PageResponse<BranchResponse>>("/branches?pageSize=100&status=active");
  const departments = useApi<DepartmentResponse[]>("/departments");
  const roles = useApi<RoleResponse[]>("/roles");
  return {
    branches: branches.state.kind === "ready" ? branches.state.data.data : [],
    departments: departments.state.kind === "ready" ? departments.state.data.filter((item) => item.status === "active") : [],
    roles: roles.state.kind === "ready" ? roles.state.data.filter((item) => item.status === "active") : [],
  };
}

type UserFields = { fullName: string; email: string; phone: string; username: string; defaultBranchId: string; departmentId: string; jobTitle: string };

function UserFieldInputs({ values, setValues, fields, inputClass }: { values: UserFields; setValues: (update: (current: UserFields) => UserFields) => void; fields: Record<string, string>; inputClass: (key: string) => string }) {
  const t = useTranslations("invite");
  const { branches, departments } = useChoices();
  const set = (key: keyof UserFields) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const text = (key: keyof UserFields, type = "text", hint?: string) => (
    <Field id={`nhan-vien-${key}`} label={t(key)} error={fields[key]} {...(hint ? { hint } : {})}>
      <input id={`nhan-vien-${key}`} type={type} className={inputClass(key)} value={values[key]} onChange={set(key)} />
    </Field>
  );
  return (
    <>
      {text("fullName")}
      {text("email", "email", t("identifierHint"))}
      {text("phone", "tel")}
      {text("username")}
      <Field id="nhan-vien-defaultBranchId" label={t("branch")} error={fields.defaultBranchId}>
        <select id="nhan-vien-defaultBranchId" className={inputClass("defaultBranchId")} value={values.defaultBranchId} onChange={set("defaultBranchId")}>
          <option value="">{t("none")}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} · {branch.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="nhan-vien-departmentId" label={t("department")} error={fields.departmentId}>
        <select id="nhan-vien-departmentId" className={inputClass("departmentId")} value={values.departmentId} onChange={set("departmentId")}>
          <option value="">{t("none")}</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.code} · {department.name}
            </option>
          ))}
        </select>
      </Field>
      {text("jobTitle")}
    </>
  );
}

const body = (values: UserFields) => ({
  fullName: values.fullName,
  email: values.email || null,
  phone: values.phone || null,
  username: values.username || null,
  defaultBranchId: values.defaultBranchId || null,
  departmentId: values.departmentId || null,
  jobTitle: values.jobTitle || null,
});

export function InviteDrawer({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const t = useTranslations("invite");
  const common = useTranslations("common");
  const locale = useLocale();
  const { roles } = useChoices();
  const [values, setValues] = useState<UserFields>({ fullName: "", email: "", phone: "", username: "", defaultBranchId: "", departmentId: "", jobTitle: "" });
  const [roleId, setRoleId] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const roleAssignments = roleId
      ? [{ roleId, scopeType: values.defaultBranchId ? "branch" : "company", branchId: values.defaultBranchId || null, validFrom: today }]
      : [];
    void run(async () => {
      const result = await apiFetch<InviteUserResponse>("/users/invitations", { method: "POST", body: JSON.stringify({ ...body(values), roleAssignments }) });
      onDone(t(result.addedToExistingAccount ? "added" : "sent", { name: values.fullName }));
    });
  }

  return (
    <Drawer title={t("title")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <UserFieldInputs values={values} setValues={setValues} fields={fields} inputClass={inputClass} />
        <Field id="nhan-vien-roleId" label={t("role")} error={fields["roleAssignments.0.roleId"] ?? fields.roleId}>
          <select id="nhan-vien-roleId" className="o-nhap" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            <option value="">{t("noRole")}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {locale === "en" ? role.nameEn : role.nameVi}
              </option>
            ))}
          </select>
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("submit")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function EditUserDrawer({ user, onClose, onDone }: { user: UserDetailResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("editUser");
  const common = useTranslations("common");
  const [values, setValues] = useState<UserFields>({
    fullName: user.fullName,
    email: user.email ?? "",
    phone: user.phone ?? "",
    username: user.username ?? "",
    defaultBranchId: user.currentMembership.defaultBranchId ?? "",
    departmentId: user.currentMembership.departmentId ?? "",
    jobTitle: user.currentMembership.jobTitle ?? "",
  });
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ ...body(values), version: user.version }) });
      onDone();
    });
  }

  return (
    <Drawer title={t("title")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <UserFieldInputs values={values} setValues={setValues} fields={fields} inputClass={inputClass} />
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

// Tải tệp mẫu qua fetch để gửi kèm cookie phiên và công ty đang chọn.
const downloadTemplate = () => apiDownload("/users/imports/template", "mau_nhap_nhan_vien.xlsx");

export function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useTranslations("importUsers");
  const common = useTranslations("common");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UserImportResponse | null>(null);
  const { submitting, fields, formError, run } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    void run(async () => {
      const form = new FormData();
      form.append("file", file);
      const payload = await apiUpload<UserImportResponse>("/users/imports", form);
      setResult(payload);
      onImported();
    });
  }

  return (
    <Drawer title={t("title")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => void downloadTemplate()}>
          {t("template")}
        </button>
        <Field id="tep-nhap" label={t("file")} error={fields.file}>
          <input id="tep-nhap" type="file" accept=".xlsx" className="o-nhap" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <FormError text={formError} />
        {result && (
          <div className={`khoi-canh-bao ${result.failed > 0 ? "canh-bao" : "thong-tin"}`} role="status">
            {t("result", { invited: result.invited, failed: result.failed })}{" "}
            {result.errorFileUrl && (
              <a href={result.errorFileUrl} download="dong_loi_nhap_nhan_vien.xlsx">
                {t("download")}
              </a>
            )}
            {result.errors.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {result.errors.slice(0, 10).map((error) => (
                  <li key={error.row}>
                    {t("row", { row: error.row })}: {error.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("close")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !file}>
            {t("submit")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
