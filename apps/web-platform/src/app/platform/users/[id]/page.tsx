"use client";

// MAN_HINH_13 Chi tiết nhân viên: thẻ Công ty, thẻ Vai trò (API_29, API_34). Khóa, vô hiệu hóa, phiên có ở lát L4, L5, L8.
import type { RoleAssignmentResponse, RoleResponse, UserDetailResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ConfirmDialog, Drawer } from "@/components/Dialogs";
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

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(user) => (
        <>
          <div className="tieu-de">
            <h1>
              {user.fullName} <UserStatusBadge status={user.status} />
            </h1>
          </div>
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
