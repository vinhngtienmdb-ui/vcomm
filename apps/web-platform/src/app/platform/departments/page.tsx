"use client";

// MAN_HINH_11 Phòng ban (CHUC_NANG_03; API_23).
import type { DepartmentResponse, PageResponse, UserListItem } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { TreeList } from "ui/components/TreeList";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { HistoryLink } from "ui/components/HistoryLink";

export default function DepartmentsPage() {
  const t = useTranslations("departments");
  const common = useTranslations("common");
  const companies = useTranslations("companies");
  const org = useTranslations("org");
  const { notify } = useAdmin();
  const { state, reload } = useApi<DepartmentResponse[]>("/departments");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: "create"; parentId: string | null } | { mode: "edit" } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="department" />
        <button type="button" className="nut chinh" onClick={() => setDrawer({ mode: "create", parentId: null })}>
          {t("add")}
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(departments) => {
          const selected = departments.find((department) => department.id === selectedId) ?? null;
          async function deactivate() {
            if (!selected) return;
            setBusy(true);
            setConfirmError(null);
            try {
              await apiFetch(`/departments/${selected.id}/deactivate`, { method: "POST", body: JSON.stringify({ version: selected.version }) });
              setConfirming(false);
              notify(org("deactivated"));
              await reload();
            } catch (error) {
              setConfirmError(failureOf(error).message);
            } finally {
              setBusy(false);
            }
          }
          return (
            <div className="hai-cot">
              <div className="the">
                {departments.length === 0 ? (
                  <MessageView text={common("empty")} />
                ) : (
                  <TreeList
                    items={departments}
                    selectedId={selectedId}
                    onSelect={(department) => setSelectedId(department.id)}
                    label={(department) => (
                      <>
                        {department.name} {department.status === "inactive" && <span className="nhan trung-tinh">{companies("inactive")}</span>}
                      </>
                    )}
                  />
                )}
              </div>
              {selected ? (
                <div className="the">
                  <h2>{selected.name}</h2>
                  <dl className="thong-tin-dong">
                    <dt>{t("code")}</dt>
                    <dd>{selected.code}</dd>
                    <dt>{t("parent")}</dt>
                    <dd>{departments.find((department) => department.id === selected.parentId)?.name ?? t("noParent")}</dd>
                    <dt>{t("manager")}</dt>
                    <dd>{selected.managerName ?? t("noManager")}</dd>
                    <dt>{t("members")}</dt>
                    <dd>{selected.memberCount}</dd>
                  </dl>
                  <div className="nhom-nut">
                    <button type="button" className="nut phu" onClick={() => setDrawer({ mode: "edit" })}>
                      {t("edit")}
                    </button>
                    {selected.status === "active" && (
                      <>
                        <button type="button" className="nut phu" onClick={() => setDrawer({ mode: "create", parentId: selected.id })}>
                          {t("addChild")}
                        </button>
                        <button
                          type="button"
                          className="nut nguy-hiem"
                          onClick={() => {
                            setConfirmError(null);
                            setConfirming(true);
                          }}
                        >
                          {t("deactivate")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <MessageView text={t("choose")} />
              )}
              {drawer && (
                <DepartmentDrawer
                  department={drawer.mode === "edit" ? selected : null}
                  defaultParentId={drawer.mode === "create" ? drawer.parentId : null}
                  departments={departments}
                  onClose={() => setDrawer(null)}
                  onSaved={async (saved) => {
                    setDrawer(null);
                    setSelectedId(saved.id);
                    notify(org("saved"));
                    await reload();
                  }}
                />
              )}
              {confirming && selected && (
                <ConfirmDialog
                  title={t("deactivate")}
                  text={t("deactivateConfirm", { name: selected.name })}
                  confirmLabel={t("deactivate")}
                  busy={busy}
                  error={confirmError}
                  onConfirm={() => void deactivate()}
                  onClose={() => setConfirming(false)}
                />
              )}
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function DepartmentDrawer({
  department,
  defaultParentId,
  departments,
  onClose,
  onSaved,
}: {
  department: DepartmentResponse | null;
  defaultParentId: string | null;
  departments: DepartmentResponse[];
  onClose: () => void;
  onSaved: (department: DepartmentResponse) => Promise<void>;
}) {
  const t = useTranslations("departments");
  const common = useTranslations("common");
  // Trưởng phòng chọn trong nhân viên của công ty; cần quyền xem nhân viên.
  const people = useApi<PageResponse<UserListItem>>("/users?pageSize=100&status=active");
  const [values, setValues] = useState({
    parentId: department ? (department.parentId ?? "") : (defaultParentId ?? ""),
    code: department?.code ?? "",
    name: department?.name ?? "",
    managerUserId: department?.managerUserId ?? "",
  });
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = { code: values.code, name: values.name, parentId: values.parentId || null, managerUserId: values.managerUserId || null };
    void run(async () => {
      const saved = department
        ? await apiFetch<DepartmentResponse>(`/departments/${department.id}`, { method: "PATCH", body: JSON.stringify({ ...body, version: department.version }) })
        : await apiFetch<DepartmentResponse>("/departments", { method: "POST", body: JSON.stringify(body) });
      await onSaved(saved);
    });
  }

  const managerOptions = people.state.kind === "ready" ? people.state.data.data : [];
  return (
    <Drawer title={department ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="phong-ban-parentId" label={t("parent")} error={fields.parentId}>
          <select id="phong-ban-parentId" className={inputClass("parentId")} value={values.parentId} onChange={set("parentId")}>
            <option value="">{t("noParent")}</option>
            {departments
              .filter((item) => item.status === "active" && item.id !== department?.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
          </select>
        </Field>
        <Field id="phong-ban-code" label={t("code")} error={fields.code}>
          <input id="phong-ban-code" className={inputClass("code")} value={values.code} onChange={set("code")} />
        </Field>
        <Field id="phong-ban-name" label={t("name")} error={fields.name}>
          <input id="phong-ban-name" className={inputClass("name")} value={values.name} onChange={set("name")} />
        </Field>
        <Field id="phong-ban-managerUserId" label={t("manager")} error={fields.managerUserId}>
          <select id="phong-ban-managerUserId" className={inputClass("managerUserId")} value={values.managerUserId} onChange={set("managerUserId")}>
            <option value="">{t("noManager")}</option>
            {department?.managerUserId && !managerOptions.some((person) => person.id === department.managerUserId) && <option value={department.managerUserId}>{department.managerName}</option>}
            {managerOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
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
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
