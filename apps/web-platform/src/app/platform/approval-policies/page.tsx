"use client";

// MAN_HINH_15 Chính sách duyệt (CHUC_NANG_15; API_37).
import type { ApprovalPolicyResponse, ApproverView, DocumentTypeResponse, PageResponse, RoleResponse, UserListItem } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function ApprovalPoliciesPage() {
  const t = useTranslations("policies");
  const locale = useLocale();
  const { notify } = useAdmin();
  const { state, reload } = useApi<ApprovalPolicyResponse[]>("/approval-policies");
  const [creating, setCreating] = useState(false);
  const who = (approver: ApproverView) => (approver.type === "department_manager" ? t("type_department_manager") : `${t(`type_${approver.type}`)}: ${approver.name ?? "—"}`);

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="approval_policy" />
        <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
          {t("add")}
        </button>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(policies) =>
          policies.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            policies.map((policy) => (
              <section key={policy.id} className="the">
                <h2>
                  {locale === "en" ? policy.documentTypeNameEn : policy.documentTypeNameVi} <span className={`nhan ${policy.active ? "thanh-cong" : "trung-tinh"}`}>{policy.active ? t("active") : t("history")}</span>
                </h2>
                <div className="chu-thich">
                  {t("currency")}: {policy.currency} · {t("effectiveFrom")} {formatDate(policy.effectiveFrom)} {policy.effectiveTo && `${t("effectiveTo")} ${formatDate(policy.effectiveTo)}`}
                </div>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {[t("levelNo"), t("minAmount"), t("approver"), t("substitute"), t("dueHours")].map((heading) => (
                          <th key={heading} scope="col">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {policy.levels.map((level) => (
                        <tr key={level.levelNo}>
                          <td data-nhan={t("levelNo")}>
                            <span>{level.levelNo}</span>
                          </td>
                          <td data-nhan={t("minAmount")}>
                            <span style={{ whiteSpace: "nowrap" }}>{formatMoney(level.minAmount, policy.currency)}</span>
                          </td>
                          <td data-nhan={t("approver")}>
                            <span>{who(level.approver)}</span>
                          </td>
                          <td data-nhan={t("substitute")}>
                            <span>{who(level.substitute)}</span>
                          </td>
                          <td data-nhan={t("dueHours")}>
                            <span>{t("hours", { hours: level.dueHours })}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )
        }
      </Loaded>
      {creating && (
        <PolicyDrawer
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}

type Choice = { type: "role" | "user" | "department_manager"; id: string };
type LevelDraft = { minAmount: string; approver: Choice; substitute: Choice; dueHours: string };

const toApi = (choice: Choice) => (choice.type === "department_manager" ? { type: choice.type } : choice.type === "role" ? { type: "role", roleId: choice.id } : { type: "user", userId: choice.id });

function PolicyDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("policies");
  const common = useTranslations("common");
  const locale = useLocale();
  const types = useApi<DocumentTypeResponse[]>("/document-types");
  const roles = useApi<RoleResponse[]>("/roles");
  const people = useApi<PageResponse<UserListItem>>("/users?pageSize=100&status=active");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [documentTypeCode, setDocumentTypeCode] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [levels, setLevels] = useState<LevelDraft[]>([{ minAmount: "0", approver: { type: "department_manager", id: "" }, substitute: { type: "user", id: "" }, dueHours: "4" }]);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  const roleList = roles.state.kind === "ready" ? roles.state.data.filter((role) => role.status === "active") : [];
  const userList = people.state.kind === "ready" ? people.state.data.data : [];
  const typeList = types.state.kind === "ready" ? types.state.data : [];
  const update = (index: number, change: Partial<LevelDraft>) => setLevels((current) => current.map((level, position) => (position === index ? { ...level, ...change } : level)));

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/approval-policies", {
        method: "POST",
        body: JSON.stringify({
          documentTypeCode,
          currency,
          effectiveFrom,
          levels: levels.map((level, index) => ({
            levelNo: index + 1,
            minAmount: level.minAmount.replace(/[.\s]/g, "").replace(",", "."),
            approver: toApi(level.approver),
            substitute: level.substitute.id ? toApi(level.substitute) : null,
            dueHours: Number(level.dueHours),
          })),
        }),
      });
      onSaved();
    });
  }

  const choiceSelect = (id: string, value: Choice, allowManager: boolean, onChange: (choice: Choice) => void) => (
    <span style={{ display: "grid", gap: 6 }}>
      <select id={id} className="o-nhap" value={value.type} onChange={(event) => onChange({ type: event.target.value as Choice["type"], id: "" })}>
        {allowManager && <option value="department_manager">{t("type_department_manager")}</option>}
        <option value="role">{t("type_role")}</option>
        <option value="user">{t("type_user")}</option>
      </select>
      {value.type !== "department_manager" && (
        <select aria-label={t(`type_${value.type}`)} className="o-nhap" value={value.id} onChange={(event) => onChange({ ...value, id: event.target.value })}>
          <option value="">{t("choose")}</option>
          {value.type === "role"
            ? roleList.map((role) => (
                <option key={role.id} value={role.id}>
                  {locale === "en" ? role.nameEn : role.nameVi}
                </option>
              ))
            : userList.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
        </select>
      )}
    </span>
  );

  return (
    <Drawer title={t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="loai-chung-tu" label={t("documentType")} error={fields.documentTypeCode}>
          <select id="loai-chung-tu" className={inputClass("documentTypeCode")} value={documentTypeCode} onChange={(event) => setDocumentTypeCode(event.target.value)}>
            <option value="">{t("choose")}</option>
            {typeList.map((type) => (
              <option key={type.code} value={type.code}>
                {locale === "en" ? type.nameEn : type.nameVi}
              </option>
            ))}
          </select>
        </Field>
        <Field id="tien-te" label={t("currency")} error={fields.currency}>
          <input id="tien-te" className={inputClass("currency")} value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
        </Field>
        <Field id="hieu-luc" label={t("effectiveFrom")} error={fields.effectiveFrom}>
          <input id="hieu-luc" type="date" className={inputClass("effectiveFrom")} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </Field>
        {levels.map((level, index) => (
          <fieldset key={index} className="the" style={{ margin: 0 }}>
            <legend style={{ fontWeight: 700 }}>
              {t("levelNo")} {index + 1}
            </legend>
            <Field id={`nguong-${index}`} label={t("minAmount")} error={fields[`levels.${index}.minAmount`]}>
              <input id={`nguong-${index}`} className={inputClass(`levels.${index}.minAmount`)} inputMode="decimal" value={level.minAmount} onChange={(event) => update(index, { minAmount: event.target.value })} />
            </Field>
            <Field id={`duyet-${index}`} label={t("approver")} error={fields[`levels.${index}.approver`]}>
              {choiceSelect(`duyet-${index}`, level.approver, true, (approver) => update(index, { approver }))}
            </Field>
            <Field id={`thay-the-${index}`} label={t("substitute")} error={fields[`levels.${index}.substitute`]}>
              {choiceSelect(`thay-the-${index}`, level.substitute, false, (substitute) => update(index, { substitute }))}
            </Field>
            <Field id={`han-${index}`} label={t("dueHours")} error={fields[`levels.${index}.dueHours`]}>
              <input id={`han-${index}`} type="number" min={1} className="o-nhap" value={level.dueHours} onChange={(event) => update(index, { dueHours: event.target.value })} />
            </Field>
            {levels.length > 1 && (
              <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => setLevels((current) => current.filter((_, position) => position !== index))}>
                {t("removeLevel")}
              </button>
            )}
          </fieldset>
        ))}
        {levels.length < 10 && (
          <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setLevels((current) => [...current, { minAmount: "", approver: { type: "role", id: "" }, substitute: { type: "user", id: "" }, dueHours: "8" }])}>
            {t("addLevel")}
          </button>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !documentTypeCode}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
