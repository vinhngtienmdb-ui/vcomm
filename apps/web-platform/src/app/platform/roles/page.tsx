"use client";

// MAN_HINH_14 Vai trò và ma trận quyền (CHUC_NANG_12; API_35, API_36).
import type { PermissionGroupResponse, RoleResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { HistoryLink } from "ui/components/HistoryLink";

const kindTone = { system: "trung-tinh", shared: "thong-tin", company: "thong-tin" } as const;

export default function RolesPage() {
  const t = useTranslations("roles");
  const locale = useLocale();
  const { notify } = useAdmin();
  const roles = useApi<RoleResponse[]>("/roles");
  const permissions = useApi<PermissionGroupResponse[]>("/permissions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);

  const name = (role: RoleResponse) => (locale === "en" ? role.nameEn : role.nameVi);

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="role" />
        <button type="button" className="nut chinh" onClick={() => setDrawer("create")}>
          {t("add")}
        </button>
      </div>
      <Loaded state={roles.state} onRetry={() => void roles.reload()}>
        {(list) => {
          const selected = list.find((role) => role.id === selectedId) ?? null;
          return (
            <div className="hai-cot">
              <div className="the">
                <ul className="cay">
                  {list.map((role) => (
                    <li key={role.id}>
                      <button type="button" className={role.id === selectedId ? "chon" : ""} aria-pressed={role.id === selectedId} onClick={() => setSelectedId(role.id)}>
                        {name(role)} <span className={`nhan ${kindTone[role.kind]}`}>{t(role.kind)}</span> {role.status === "inactive" && <span className="nhan trung-tinh">{t("inactive")}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {selected ? (
                <Loaded state={permissions.state} onRetry={() => void permissions.reload()}>
                  {(groups) => (
                    <RoleDetail
                      key={`${selected.id}-${selected.version}`}
                      role={selected}
                      groups={groups}
                      onEdit={() => setDrawer("edit")}
                      onSaved={(text) => {
                        notify(text);
                        void roles.reload();
                      }}
                    />
                  )}
                </Loaded>
              ) : (
                <MessageView text={t("choose")} />
              )}
              {drawer && (
                <RoleDrawer
                  role={drawer === "edit" ? selected : null}
                  onClose={() => setDrawer(null)}
                  onSaved={(saved) => {
                    setDrawer(null);
                    setSelectedId(saved.id);
                    notify(t("savedRole"));
                    void roles.reload();
                  }}
                />
              )}
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

// Mã quyền dạng <mini app>.<đối tượng>.<hành động>; riêng <mini app>.access là quyền truy cập mini app.
function splitCode(code: string): { object: string; action: string } {
  const parts = code.split(".");
  if (parts.length === 2) return { object: "app", action: parts[1]! };
  return { object: parts.slice(1, -1).join("."), action: parts[parts.length - 1]! };
}

function RoleDetail({ role, groups, onEdit, onSaved }: { role: RoleResponse; groups: PermissionGroupResponse[]; onEdit: () => void; onSaved: (text: string) => void }) {
  const t = useTranslations("roles");
  const common = useTranslations("common");
  const objects = useTranslations("objects");
  const actions = useTranslations("actions");
  const locale = useLocale();
  const [checked, setChecked] = useState(() => new Set(role.permissionCodes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const editable = role.editableByMe;

  useEffect(() => setChecked(new Set(role.permissionCodes)), [role.permissionCodes]);

  const label = (translate: typeof objects, key: string, fallback: string) => (translate.has(key) ? translate(key) : fallback);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/roles/${role.id}/permissions`, { method: "PUT", body: JSON.stringify({ permissionCodes: [...checked], version: role.version }) });
      onSaved(common("saved"));
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    setSaving(true);
    try {
      await apiFetch(`/roles/${role.id}`, { method: "PATCH", body: JSON.stringify({ status: role.status === "active" ? "inactive" : "active", version: role.version }) });
      setConfirmStatus(false);
      onSaved(common("saved"));
    } catch (failure) {
      setError(failureOf(failure).message);
      setConfirmStatus(false);
    } finally {
      setSaving(false);
    }
  }

  const roleName = locale === "en" ? role.nameEn : role.nameVi;
  return (
    <div className="the">
      <h2>{roleName}</h2>
      {role.description && <p style={{ margin: 0 }}>{role.description}</p>}
      <div className="chu-thich">
        {t("members", { count: role.memberCount })} {editable ? t("matrixHint") : role.kind === "system" ? t("readOnly") : t("noEdit")}
      </div>
      {editable && (
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onEdit}>
            {t("edit")}
          </button>
          <button type="button" className={role.status === "active" ? "nut nguy-hiem" : "nut phu"} onClick={() => (role.status === "active" ? setConfirmStatus(true) : void toggleStatus())}>
            {role.status === "active" ? t("deactivate") : t("activate")}
          </button>
        </div>
      )}
      {groups.map((group) => {
        const actionList = [...new Set(group.permissions.map((permission) => splitCode(permission.code).action))];
        const objectList = [...new Set(group.permissions.map((permission) => splitCode(permission.code).object))];
        return (
          <div key={group.appCode} className="ma-tran">
            <table>
              <thead>
                <tr>
                  <th scope="col">{locale === "en" ? group.appNameEn : group.appNameVi}</th>
                  {actionList.map((action) => (
                    <th key={action} scope="col" className="o-quyen">
                      {label(actions, action, action)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {objectList.map((object) => (
                  <tr key={object}>
                    <th scope="row">
                      {label(objects, object, object)}
                    </th>
                    {actionList.map((action) => {
                      const permission = group.permissions.find((item) => splitCode(item.code).object === object && splitCode(item.code).action === action);
                      if (!permission) return <td key={action} className="o-quyen" aria-hidden="true" />;
                      const isChecked = checked.has(permission.code);
                      const permissionName = locale === "en" ? permission.nameEn : permission.nameVi;
                      return (
                        <td key={action} className="o-quyen">
                          <input
                            type="checkbox"
                            aria-label={permissionName + (permission.isSensitive ? ` (${t("sensitive")})` : "")}
                            title={permissionName}
                            checked={isChecked}
                            disabled={!editable || (!permission.grantableByMe && !isChecked)}
                            data-code={permission.code}
                            onChange={() =>
                              setChecked((current) => {
                                const next = new Set(current);
                                if (next.has(permission.code)) next.delete(permission.code);
                                else next.add(permission.code);
                                return next;
                              })
                            }
                          />
                          {permission.isSensitive && (
                            <>
                              {" "}
                              <span className="nhan canh-bao">{t("sensitive")}</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {error && (
        <div className="khoi-canh-bao loi" role="alert">
          {error}
        </div>
      )}
      {editable && (
        <div className="nhom-nut">
          <button type="button" className={`nut chinh${saving ? " dang-xu-ly" : ""}`} disabled={saving} onClick={() => void save()}>
            {t("savePermissions")}
          </button>
        </div>
      )}
      {confirmStatus && (
        <ConfirmDialog
          title={t("deactivate")}
          text={t("deactivateConfirm", { name: roleName })}
          confirmLabel={t("deactivate")}
          busy={saving}
          onConfirm={() => void toggleStatus()}
          onClose={() => setConfirmStatus(false)}
        />
      )}
    </div>
  );
}

function RoleDrawer({ role, onClose, onSaved }: { role: RoleResponse | null; onClose: () => void; onSaved: (role: RoleResponse) => void }) {
  const t = useTranslations("roles");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [code, setCode] = useState(role?.code ?? "");
  const [nameVi, setNameVi] = useState(role?.nameVi ?? "");
  const [nameEn, setNameEn] = useState(role?.nameEn ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [shared, setShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Chỉ quản trị tập đoàn có quyền tạo vai trò dùng chung; máy chủ kiểm tra lại.
  const mayShare = !role && can("platform.company.manage");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFields({});
    setFormError(null);
    try {
      const saved = role
        ? await apiFetch<RoleResponse>(`/roles/${role.id}`, { method: "PATCH", body: JSON.stringify({ nameVi, nameEn, description: description || null, version: role.version }) })
        : await apiFetch<RoleResponse>("/roles", { method: "POST", body: JSON.stringify({ code, nameVi, nameEn, description: description || null, ...(shared ? { shared: true } : {}) }) });
      onSaved(saved);
    } catch (error) {
      const failure = failureOf(error);
      setFields(failure.fields);
      if (Object.keys(failure.fields).length === 0) setFormError(failure.message);
      setSubmitting(false);
    }
  }

  const input = (key: string, labelText: string, value: string, setValue: (value: string) => void, hint?: string) => (
    <div className="truong">
      <label htmlFor={`vai-tro-${key}`}>{labelText}</label>
      <input
        id={`vai-tro-${key}`}
        className={`o-nhap${fields[key] ? " loi" : ""}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={fields[key] ? `vai-tro-${key}-loi` : undefined}
      />
      {fields[key] && (
        <span id={`vai-tro-${key}-loi`} className="loi-o">
          {fields[key]}
        </span>
      )}
      {hint && !fields[key] && <span className="chu-thich">{hint}</span>}
    </div>
  );

  return (
    <Drawer title={role ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {!role && input("code", t("code"), code, setCode, t("codeHint"))}
        {input("nameVi", t("nameVi"), nameVi, setNameVi)}
        {input("nameEn", t("nameEn"), nameEn, setNameEn)}
        {input("description", t("description"), description, setDescription)}
        {mayShare && (
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} /> {t("sharedOption")}
          </label>
        )}
        {formError && (
          <div className="khoi-canh-bao loi" role="alert">
            {formError}
          </div>
        )}
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
