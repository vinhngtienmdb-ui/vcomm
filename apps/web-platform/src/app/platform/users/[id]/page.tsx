"use client";

// MAN_HINH_13 Chi tiết nhân viên: thẻ Công ty, thẻ Vai trò (API_29, API_34); khóa (API_30), vô hiệu hóa kèm bàn giao (API_31, API_32), đặt lại xác thực hai lớp (API_33).
import type { DeactivateUserResponse, HandoverResponse, PageResponse, RoleAssignmentResponse, RoleResponse, UserDetailResponse, UserListItem } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ConfirmDialog, Drawer } from "@/components/Dialogs";
import { Field } from "@/components/Form";
import { HistoryLink } from "@/components/HistoryLink";
import { EditUserDrawer } from "@/components/UserForms";
import { UserStatusBadge } from "@/components/StatusBadge";
import { Loaded, MessageView } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";
import { failureOf, useApi } from "@/lib/use-api";

// Ngày dạng YYYY-MM-DD hiển thị theo dd/mm/yyyy.
const displayDate = (value: string | null, empty: string) => (value ? value.split("-").reverse().join("/") : empty);

function todayInVietnam(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("userDetail");
  const { state, reload } = useApi<UserDetailResponse>(`/users/${id}`);
  const [tab, setTab] = useState<"companies" | "roles">("roles");
  const [panel, setPanel] = useState<"edit" | "lock" | "deactivate" | "mfaReset" | null>(null);
  const editText = useTranslations("editUser");
  const lockText = useTranslations("lock");
  const deactivateText = useTranslations("deactivate");
  const mfaResetText = useTranslations("mfaReset");
  const { can, notify } = useAdmin();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function resetMfa() {
    setBusy(true);
    setResetError(null);
    try {
      await apiFetch(`/users/${id}/mfa/reset`, { method: "POST" });
      setPanel(null);
      notify(mfaResetText("done"));
      void reload();
    } catch (failure) {
      setResetError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(user) => (
        <>
          <div className="tieu-de">
            <h1>
              {user.fullName} <UserStatusBadge status={user.status} />
            </h1>
            <HistoryLink entityId={user.id} />
            {/* Nút ẩn khi xem chính mình (MAN_HINH_13). */}
            {!user.isSelf && user.mfaEnabled && can("platform.user.reset_mfa") && (
              <button type="button" className="nut phu" onClick={() => setPanel("mfaReset")}>
                {mfaResetText("button")}
              </button>
            )}
            {!user.isSelf && can("platform.user.manage") && (
              <>
                <button type="button" className="nut phu" onClick={() => setPanel("edit")}>
                  {editText("button")}
                </button>
                {(user.status === "active" || user.status === "locked") && (
                  <button type="button" className={user.status === "active" ? "nut nguy-hiem" : "nut phu"} onClick={() => setPanel("lock")}>
                    {lockText(user.status === "active" ? "lock" : "unlock")}
                  </button>
                )}
                {(user.status === "active" || user.status === "locked") && (
                  <button type="button" className="nut nguy-hiem" onClick={() => setPanel("deactivate")}>
                    {deactivateText("button")}
                  </button>
                )}
              </>
            )}
          </div>
          {panel === "edit" && (
            <EditUserDrawer
              user={user}
              onClose={() => setPanel(null)}
              onDone={() => {
                setPanel(null);
                notify(editText("saved"));
                void reload();
              }}
            />
          )}
          {panel === "lock" && (
            <LockDrawer
              user={user}
              onClose={() => setPanel(null)}
              onDone={(text) => {
                setPanel(null);
                notify(text);
                void reload();
              }}
            />
          )}
          {panel === "deactivate" && (
            <DeactivateDrawer
              user={user}
              onClose={() => setPanel(null)}
              onDone={(result) => {
                setPanel(null);
                notify(deactivateText(result.status === "disabled" ? "done" : "doneRemoved"));
                router.push("/platform/users");
              }}
            />
          )}
          {panel === "mfaReset" && (
            <ConfirmDialog
              title={mfaResetText("title")}
              text={mfaResetText("text", { name: user.fullName })}
              confirmLabel={mfaResetText("button")}
              busy={busy}
              error={resetError}
              onConfirm={() => void resetMfa()}
              onClose={() => {
                setPanel(null);
                setResetError(null);
              }}
            />
          )}
          {user.mfaRequired && <span className="chu-thich">{t("mfaRequired")}</span>}
          <div className="cac-the" role="tablist">
            {(["companies", "roles"] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
                {t(key === "companies" ? "tabCompanies" : "tabRoles")}
              </button>
            ))}
          </div>
          {tab === "companies" ? <CompaniesTab user={user} /> : <RolesTab user={user} onChanged={() => void reload()} />}
        </>
      )}
    </Loaded>
  );
}

function CompaniesTab({ user }: { user: UserDetailResponse }) {
  const t = useTranslations("userDetail");
  const common = useTranslations("common");
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {[t("company"), t("branch"), t("jobTitle")].map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {user.companies.map((company) => (
            <tr key={company.id}>
              <td data-nhan={t("company")}>
                <span>
                  {company.shortName} {company.isDefault && <span className="nhan trung-tinh">{t("default")}</span>}
                </span>
              </td>
              <td data-nhan={t("branch")}>
                <span>{company.branchName ?? common("none")}</span>
              </td>
              <td data-nhan={t("jobTitle")}>
                <span>{company.jobTitle ?? common("none")}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RolesTab({ user, onChanged }: { user: UserDetailResponse; onChanged: () => void }) {
  const t = useTranslations("userDetail");
  const common = useTranslations("common");
  const locale = useLocale();
  const { notify } = useAdmin();
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<RoleAssignmentResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const scopes = user.assignableScopes;
  const canAssign = !user.isSelf && (scopes.group || scopes.company || scopes.branches.length > 0);

  const scopeLabel = (assignment: RoleAssignmentResponse) =>
    assignment.scopeType === "group"
      ? t("scopeGroup")
      : assignment.scopeType === "company"
        ? t("scopeCompany", { name: assignment.companyShortName ?? "" })
        : t("scopeBranch", { name: assignment.branchName ?? "" });

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await apiFetch(`/users/${user.id}/role-assignments/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      notify(t("removed"));
      onChanged();
    } catch (error) {
      setRemoveError(failureOf(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {user.isSelf ? (
        <div className="khoi-canh-bao thong-tin">{t("selfNote")}</div>
      ) : (
        canAssign && (
          <div className="nhom-nut">
            <button type="button" className="nut chinh" onClick={() => setAssigning(true)}>
              {t("assign")}
            </button>
          </div>
        )
      )}
      {user.roleAssignments.length === 0 ? (
        <MessageView text={t("noRoles")} />
      ) : (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {[t("role"), t("scope"), t("from"), t("to"), ""].map((heading, index) => (
                  <th key={index} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {user.roleAssignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td data-nhan={t("role")}>
                    <span>
                      {locale === "en" ? assignment.roleNameEn : assignment.roleNameVi} {!assignment.active && <span className="nhan trung-tinh">{t("expired")}</span>}
                    </span>
                  </td>
                  <td data-nhan={t("scope")}>
                    <span>{scopeLabel(assignment)}</span>
                  </td>
                  <td data-nhan={t("from")}>
                    <span>{displayDate(assignment.validFrom, common("none"))}</span>
                  </td>
                  <td data-nhan={t("to")}>
                    <span>{displayDate(assignment.validTo, common("none"))}</span>
                  </td>
                  <td data-nhan="">
                    {canAssign && (
                      <button
                        type="button"
                        className="nut phu"
                        onClick={() => {
                          setRemoveError(null);
                          setRemoving(assignment);
                        }}
                      >
                        {t("remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assigning && (
        <AssignDrawer
          user={user}
          onClose={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            notify(t("assigned"));
            onChanged();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t("removeTitle")}
          text={t("removeConfirm", { role: locale === "en" ? removing.roleNameEn : removing.roleNameVi, scope: scopeLabel(removing) })}
          confirmLabel={t("remove")}
          busy={busy}
          error={removeError}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

function AssignDrawer({ user, onClose, onDone }: { user: UserDetailResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("userDetail");
  const common = useTranslations("common");
  const locale = useLocale();
  const { me } = useAdmin();
  const roles = useApi<RoleResponse[]>("/roles");
  const scopes = user.assignableScopes;
  const companyName = me.companies.find((company) => company.id === me.currentCompanyId)?.shortName ?? "";
  const scopeOptions = [
    ...(scopes.group ? [{ value: "group", label: t("scopeGroup") }] : []),
    ...(scopes.company ? [{ value: "company", label: t("scopeCompany", { name: companyName }) }] : []),
    ...scopes.branches.map((branch) => ({ value: `branch:${branch.id}`, label: t("scopeBranch", { name: `${branch.code} – ${branch.name}` }) })),
  ];
  const [roleId, setRoleId] = useState("");
  const [scope, setScope] = useState(scopeOptions[0]?.value ?? "");
  const [validFrom, setValidFrom] = useState(todayInVietnam());
  const [validTo, setValidTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFields({});
    setFormError(null);
    const [scopeType, branchId] = scope.split(":");
    try {
      await apiFetch(`/users/${user.id}/role-assignments`, {
        method: "POST",
        body: JSON.stringify({ roleId, scopeType, branchId: branchId ?? null, validFrom, validTo: validTo || null }),
      });
      onDone();
    } catch (error) {
      const failure = failureOf(error);
      setFields(failure.fields);
      if (Object.keys(failure.fields).length === 0) setFormError(failure.message);
      setSubmitting(false);
    }
  }

  const field = (key: string, label: string, control: React.ReactNode) => (
    <div className="truong">
      <label htmlFor={`gan-${key}`}>{label}</label>
      {control}
      {fields[key] && (
        <span id={`gan-${key}-loi`} className="loi-o">
          {fields[key]}
        </span>
      )}
    </div>
  );

  return (
    <Drawer title={t("assign")} onClose={onClose}>
      <Loaded state={roles.state} onRetry={() => void roles.reload()}>
        {(list) => {
          const active = list.filter((role) => role.status === "active");
          const chosen = active.find((role) => role.id === roleId);
          return (
            <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
              {field(
                "roleId",
                t("role"),
                <select id="gan-roleId" className={`o-nhap${fields.roleId ? " loi" : ""}`} value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                  <option value="">{t("chooseRole")}</option>
                  {active.map((role) => (
                    <option key={role.id} value={role.id}>
                      {(locale === "en" ? role.nameEn : role.nameVi) + (role.hasSensitive ? ` (${t("sensitive").toLowerCase()})` : "")}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                "scopeType",
                t("scope"),
                <select id="gan-scopeType" className="o-nhap" value={scope} onChange={(event) => setScope(event.target.value)}>
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>,
              )}
              {field("validFrom", t("from"), <input id="gan-validFrom" type="date" className={`o-nhap${fields.validFrom ? " loi" : ""}`} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />)}
              {field("validTo", t("to"), <input id="gan-validTo" type="date" className={`o-nhap${fields.validTo ? " loi" : ""}`} value={validTo} onChange={(event) => setValidTo(event.target.value)} />)}
              {chosen?.hasSensitive && <div className="khoi-canh-bao thong-tin">{t("sensitiveNote")}</div>}
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
                  {t("assign")}
                </button>
              </div>
            </form>
          );
        }}
      </Loaded>
    </Drawer>
  );
}

function LockDrawer({ user, onClose, onDone }: { user: UserDetailResponse; onClose: () => void; onDone: (text: string) => void }) {
  const t = useTranslations("lock");
  const common = useTranslations("common");
  const locking = user.status === "active";
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/users/${user.id}/${locking ? "lock" : "unlock"}`, { method: "POST", body: JSON.stringify({ reason }) });
      onDone(t(locking ? "locked" : "unlocked"));
    } catch (failure) {
      setError(failureOf(failure).message);
      setBusy(false);
    }
  }

  return (
    <Drawer title={t(locking ? "lockTitle" : "unlockTitle", { name: user.fullName })} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {locking && <div className="khoi-canh-bao canh-bao">{t("lockNote")}</div>}
        <Field id="ly-do-khoa" label={t("reason")}>
          <textarea id="ly-do-khoa" className="o-nhap" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {error && (
          <div className="khoi-canh-bao loi" role="alert">
            {error}
          </div>
        )}
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut ${locking ? "nguy-hiem" : "chinh"}${busy ? " dang-xu-ly" : ""}`} disabled={busy || !reason.trim()}>
            {t(locking ? "lock" : "unlock")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Vô hiệu hóa kèm bàn giao (luồng 6 tài liệu 09): chọn người nhận cho từng việc.
function DeactivateDrawer({ user, onClose, onDone }: { user: UserDetailResponse; onClose: () => void; onDone: (result: DeactivateUserResponse) => void }) {
  const t = useTranslations("deactivate");
  const common = useTranslations("common");
  const locale = useLocale();
  const handover = useApi<HandoverResponse>(`/users/${user.id}/handover`);
  const people = useApi<PageResponse<UserListItem>>("/users?pageSize=100&status=active");
  const [reason, setReason] = useState("");
  const [recipients, setRecipients] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const candidates = people.state.kind === "ready" ? people.state.data.data.filter((person) => person.id !== user.id) : [];

  async function submit(event: FormEvent, items: { kind: "approval_step" | "department_manager"; itemId: string }[]) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      const body = {
        reason,
        handover: items.filter((item) => recipients[item.itemId]).map((item) => ({ ...item, toUserId: recipients[item.itemId] })),
      };
      onDone(
        await apiFetch<DeactivateUserResponse>(`/users/${user.id}/deactivate`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    } catch (failure) {
      const result = failureOf(failure);
      // Lỗi theo dòng bàn giao trả về dạng handover.<thứ tự>.toUserId; đổi sang mã việc để hiện dưới ô chọn.
      const sent = items.filter((item) => recipients[item.itemId]);
      const byItem: Record<string, string> = {};
      for (const [key, message] of Object.entries(result.fields)) {
        const index = /^handover\.(\d+)\./.exec(key)?.[1];
        if (index !== undefined && sent[Number(index)]) byItem[sent[Number(index)]!.itemId] = message;
      }
      setFields(byItem);
      if (Object.keys(byItem).length === 0) setError(result.message);
      setBusy(false);
    }
  }

  const select = (itemId: string, label: string) => (
    <Field key={itemId} id={`nhan-${itemId}`} label={label} error={fields[itemId]}>
      <select
        id={`nhan-${itemId}`}
        className={`o-nhap${fields[itemId] ? " loi" : ""}`}
        value={recipients[itemId] ?? ""}
        onChange={(event) =>
          setRecipients((current) => ({
            ...current,
            [itemId]: event.target.value,
          }))
        }
      >
        <option value="">{t("choose")}</option>
        {candidates.map((person) => (
          <option key={person.id} value={person.id}>
            {person.fullName}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <Drawer title={t("title", { name: user.fullName })} onClose={onClose}>
      <Loaded state={handover.state} onRetry={() => void handover.reload()}>
        {(work) => {
          const items = [
            ...work.pendingApprovalSteps.map((step) => ({
              kind: "approval_step" as const,
              itemId: step.id,
            })),
            ...work.managedDepartments.map((department) => ({
              kind: "department_manager" as const,
              itemId: department.id,
            })),
          ];
          const complete = items.every((item) => recipients[item.itemId]);
          return (
            <form onSubmit={(event) => void submit(event, items)} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
              <div className="khoi-canh-bao canh-bao">{t("intro")}</div>
              {items.length === 0 && <p style={{ margin: 0 }}>{t("nothing")}</p>}
              {work.pendingApprovalSteps.length > 0 && <h3 style={{ margin: 0 }}>{t("steps")}</h3>}
              {work.pendingApprovalSteps.map((step) =>
                select(step.id, `${t("step", { documentNo: step.documentNo, levelNo: step.levelNo })} · ${locale === "en" ? step.documentTypeNameEn : step.documentTypeNameVi}`),
              )}
              {work.managedDepartments.length > 0 && <h3 style={{ margin: 0 }}>{t("departments")}</h3>}
              {work.managedDepartments.map((department) => select(department.id, `${department.code} – ${department.name}`))}
              <Field id="ly-do-vo-hieu" label={t("reason")}>
                <textarea id="ly-do-vo-hieu" className="o-nhap" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
              </Field>
              {error && (
                <div className="khoi-canh-bao loi" role="alert">
                  {error}
                </div>
              )}
              <div className="nhom-nut">
                <button type="button" className="nut phu" onClick={onClose}>
                  {common("cancel")}
                </button>
                <button type="submit" className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`} disabled={busy || !reason.trim() || !complete}>
                  {t("button")}
                </button>
              </div>
            </form>
          );
        }}
      </Loaded>
    </Drawer>
  );
}
