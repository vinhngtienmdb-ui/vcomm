"use client";

// MAN_HINH_123 Nghỉ phép (CHUC_NANG_166; API_153): thẻ Đơn nghỉ, Sổ phép, Loại nghỉ.
import type { AttendanceGridResponse, LeaveBalanceItem, LeaveLedgerEntry, LeaveRequestItem, LeaveTypeItem, WorkCondition } from "contracts";
import { workConditions } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table, Tabs } from "@/components/AttendanceParts";
import { LeaveRequestDrawer, LeaveStatusBadge, leavePeriod } from "@/components/LeaveParts";

const number = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export default function LeavePage() {
  const t = useTranslations("leave");
  const { can } = useAdmin();
  const manage = can("hr.leave.manage");
  const [tab, setTab] = useState(0);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <Tabs labels={manage ? [t("tabRequests"), t("tabBalances"), t("tabTypes")] : [t("tabRequests"), t("tabBalances")]} selected={tab} onSelect={setTab} />
      {tab === 0 && <RequestsTab manage={manage} />}
      {tab === 1 && <BalancesTab manage={manage} />}
      {tab === 2 && manage && <TypesTab />}
    </>
  );
}

function RequestsTab({ manage }: { manage: boolean }) {
  const t = useTranslations("leave");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState(vietnamToday().slice(0, 7));
  const parameters = new URLSearchParams({ month });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<LeaveRequestItem[]>(`/hr/leave/requests?${parameters}`);
  const types = useApi<LeaveTypeItem[]>("/hr/leave/types");
  const employees = useApi<AttendanceGridResponse>(manage ? `/hr/attendance/grid?month=${month}` : null);
  const [recording, setRecording] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequestItem | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const half = (key: string) => t(`half_${key}`);
  return (
    <>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="thang-nghi">
          {t("month")}
        </label>
        <input id="thang-nghi" type="month" className="o-nhap" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("statusAll")}</option>
          {(["pending", "approved", "rejected", "withdrawn", "cancelled"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
        {manage && (
          <button type="button" className="nut chinh" onClick={() => setRecording(true)}>
            {t("recordForEmployee")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("noRequests")} />
          ) : (
            <Table
              headings={[t("number"), t("employee"), t("type"), t("period"), t("days"), t("source"), t("status"), ""]}
              rows={items.map((item) => ({
                key: item.id,
                cells: [
                  item.requestNo,
                  item.employeeName,
                  item.leaveTypeName,
                  leavePeriod(item, half),
                  number(item.days),
                  <>
                    {t(`source_${item.source}`)}
                    {item.hasAttachment && (
                      <>
                        {" · "}
                        <button type="button" className="nut chu" onClick={() => void apiDownload(`/hr/leave/requests/${item.id}/attachment`, `don-nghi-${item.requestNo}`, true)}>
                          {t("attachment")}
                        </button>
                      </>
                    )}
                  </>,
                  <LeaveStatusBadge status={item.status} />,
                  item.canCancel ? (
                    <button type="button" className="nut chu" onClick={() => (setCancelling(item), setReason(""), setError(null))}>
                      {t("cancelRequest")}
                    </button>
                  ) : (
                    ""
                  ),
                ],
              }))}
            />
          )
        }
      </Loaded>
      {recording && types.state.kind === "ready" && employees.state.kind === "ready" && (
        <LeaveRequestDrawer
          self={false}
          types={types.state.data.filter((type) => type.status === "active")}
          employees={employees.state.data.rows.map((row) => ({ id: row.employeeId, label: `${row.code} · ${row.fullName}` }))}
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            void reload();
          }}
        />
      )}
      {cancelling && (
        <Drawer title={t("cancelTitle", { number: cancelling.requestNo })} onClose={() => setCancelling(null)}>
          <p style={{ margin: 0 }}>{t("cancelText")}</p>
          <Field id="ly-do-huy" label={t("reasonRequired")}>
            <textarea id="ly-do-huy" className="o-nhap" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <FormError text={error} />
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setCancelling(null)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`}
              disabled={busy || !reason.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiFetch(`/hr/leave/requests/${cancelling.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
                  setCancelling(null);
                  await reload();
                } catch (failure) {
                  setError(failureOf(failure).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("cancelRequest")}
            </button>
          </div>
        </Drawer>
      )}
    </>
  );
}

function BalancesTab({ manage }: { manage: boolean }) {
  const t = useTranslations("leave");
  const { state, reload } = useApi<LeaveBalanceItem[]>("/hr/leave/balances");
  const [adjusting, setAdjusting] = useState<LeaveBalanceItem | null>(null);
  const [policy, setPolicy] = useState<LeaveBalanceItem | null>(null);
  const [ledger, setLedger] = useState<LeaveBalanceItem | null>(null);
  const year = Number(vietnamToday().slice(0, 4));
  return (
    <>
      <span className="chu-thich">{t("balanceHint")}</span>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("noBalances")} />
          ) : (
            <Table
              headings={[t("employee"), t("condition"), t("daysPerYear"), t("carried"), t("accruedThisYear"), t("usedThisYear"), t("expired"), t("available"), ""]}
              rows={items.map((item) => {
                const current = item.years.find((entry) => entry.leaveYear === year);
                const older = item.years.filter((entry) => entry.leaveYear < year);
                return {
                  key: item.employeeId,
                  cells: [
                    <button type="button" className="nut chu" onClick={() => setLedger(item)}>
                      {item.fullName}
                    </button>,
                    <>
                      {t(`condition_${item.workCondition}`)} {item.isMinor && <span className="nhan thong-tin">{t("minor")}</span>}
                    </>,
                    item.entitlementDays,
                    older.length > 0 ? older.map((entry) => `${number(entry.balance)}${entry.expiresOn ? ` (${t(entry.expiresOn < vietnamToday() ? "expiredOn" : "until", { date: formatDate(entry.expiresOn) })})` : ""}`).join("; ") : "0",
                    number(current?.accrued ?? "0"),
                    number(current?.used ?? "0"),
                    number(String(item.years.reduce((total, entry) => total + Number(entry.expired), 0))),
                    <span className={Number(item.available) < 0 ? "nhan loi" : ""}>
                      {number(item.available)}
                      {Number(item.pending) > 0 ? ` (${t("pendingDays", { days: number(item.pending) })})` : ""}
                    </span>,
                    manage ? (
                      <span className="nhom-nut">
                        <button type="button" className="nut chu" onClick={() => setPolicy(item)}>
                          {t("editPolicy")}
                        </button>
                        <button type="button" className="nut chu" onClick={() => setAdjusting(item)}>
                          {t("adjust")}
                        </button>
                      </span>
                    ) : (
                      ""
                    ),
                  ],
                };
              })}
            />
          )
        }
      </Loaded>
      {adjusting && <AdjustDrawer item={adjusting} onClose={() => setAdjusting(null)} onSaved={() => (setAdjusting(null), void reload())} />}
      {policy && <PolicyDrawer item={policy} onClose={() => setPolicy(null)} onSaved={() => (setPolicy(null), void reload())} />}
      {ledger && <LedgerDrawer item={ledger} onClose={() => setLedger(null)} />}
    </>
  );
}

function LedgerDrawer({ item, onClose }: { item: LeaveBalanceItem; onClose: () => void }) {
  const t = useTranslations("leave");
  const { state, reload } = useApi<LeaveLedgerEntry[]>(`/hr/leave/balances/${item.employeeId}`);
  return (
    <Drawer title={t("ledgerTitle", { name: item.fullName })} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(entries) =>
          entries.length === 0 ? (
            <MessageView text={t("noLedger")} />
          ) : (
            <div>
              <Table
                headings={[t("createdAt"), t("leaveYear"), t("entryKind"), t("days"), t("note")]}
                rows={entries.map((entry) => ({
                  key: entry.id,
                  cells: [
                    formatDateTime(entry.createdAt),
                    entry.leaveYear,
                    t(`entry_${entry.kind}`),
                    number(entry.days),
                    [entry.requestNo, entry.accrualMonth?.slice(0, 7), entry.reason].filter(Boolean).join(" · "),
                  ],
                }))}
              />
            </div>
          )
        }
      </Loaded>
    </Drawer>
  );
}

function AdjustDrawer({ item, onClose, onSaved }: { item: LeaveBalanceItem; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("leave");
  const submit = useSubmit();
  const year = Number(vietnamToday().slice(0, 4));
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(async () => {
      await apiFetch("/hr/leave/adjustments", {
        method: "POST",
        body: JSON.stringify({
          employeeId: item.employeeId,
          leaveYear: Number(form.get("leaveYear")),
          days: String(form.get("days") ?? "").replace(",", "."),
          reason: String(form.get("reason") ?? ""),
        }),
      });
      onSaved();
    });
  };
  return (
    <Drawer title={t("adjustTitle", { name: item.fullName })} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="dc-nam" label={t("leaveYear")}>
          <select id="dc-nam" name="leaveYear" className="o-nhap" defaultValue={year}>
            {[year - 2, year - 1, year].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dc-so" label={t("adjustDays")} error={submit.fields.days} hint={t("adjustHint")}>
          <input id="dc-so" name="days" className={submit.inputClass("days")} inputMode="decimal" />
        </Field>
        <Field id="dc-ly-do" label={t("reasonRequired")} error={submit.fields.reason}>
          <textarea id="dc-ly-do" name="reason" rows={2} className={submit.inputClass("reason")} maxLength={500} />
        </Field>
        <FormError text={submit.formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function PolicyDrawer({ item, onClose, onSaved }: { item: LeaveBalanceItem; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("leave");
  const submit = useSubmit();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(async () => {
      await apiFetch(`/hr/leave/policies/${item.employeeId}`, {
        method: "PUT",
        body: JSON.stringify({ workCondition: form.get("workCondition"), seniorityStart: String(form.get("seniorityStart") ?? "") || null }),
      });
      onSaved();
    });
  };
  return (
    <Drawer title={t("policyTitle", { name: item.fullName })} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="cd-dk" label={t("condition")} hint={t("minorHint")}>
          <select id="cd-dk" name="workCondition" className="o-nhap" defaultValue={item.workCondition}>
            {workConditions.map((value: WorkCondition) => (
              <option key={value} value={value}>
                {t(`conditionLong_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="cd-tn" label={t("seniorityStart")} error={submit.fields.seniorityStart} hint={t("seniorityHint")}>
          <input id="cd-tn" name="seniorityStart" type="date" className={submit.inputClass("seniorityStart")} defaultValue={item.seniorityStart} />
        </Field>
        <FormError text={submit.formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function TypesTab() {
  const t = useTranslations("leave");
  const { state, reload } = useApi<LeaveTypeItem[]>("/hr/leave/types");
  const [editing, setEditing] = useState<LeaveTypeItem | "new" | null>(null);
  return (
    <>
      <div className="tieu-de">
        <h2>{t("tabTypes")}</h2>
        <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
          {t("addType")}
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) => (
          <Table
            headings={[t("typeName"), t("payGroup"), t("limit"), t("needsFile"), t("origin"), ""]}
            rows={items.map((item) => ({
              key: item.id,
              cells: [
                <>
                  {item.name} {item.status === "inactive" && <span className="nhan trung-tinh">{t("inactive")}</span>}
                </>,
                t(`group_${item.payGroup}`),
                item.perEventDays
                  ? t("perEvent", { days: Number(item.perEventDays) })
                  : item.yearlyMaxDays
                    ? t("perYear", { days: Number(item.yearlyMaxDays) })
                    : item.payGroup === "annual"
                      ? t("byBalance")
                      : "—",
                item.requiresAttachment ? t("yes") : t("no"),
                item.systemCode ? t("byLaw") : <span className="nhan thong-tin">{t("byCompany")}</span>,
                <button type="button" className="nut chu" onClick={() => setEditing(item)}>
                  {t("edit")}
                </button>,
              ],
            }))}
          />
        )}
      </Loaded>
      {editing && <TypeDrawer item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), void reload())} />}
    </>
  );
}

function TypeDrawer({ item, onClose, onSaved }: { item: LeaveTypeItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("leave");
  const submit = useSubmit();
  const custom = !item?.systemCode;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: String(form.get("name") ?? ""),
      ...(custom
        ? { payGroup: form.get("payGroup"), yearlyMaxDays: String(form.get("yearlyMaxDays") ?? "").replace(",", ".") || null, requiresAttachment: form.get("requiresAttachment") === "on" }
        : {}),
      status: String(form.get("status") ?? "active"),
      ...(item ? { version: item.version } : {}),
    };
    void submit.run(async () => {
      await apiFetch(item ? `/hr/leave/types/${item.id}` : "/hr/leave/types", { method: item ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  };
  return (
    <Drawer title={item ? item.name : t("addType")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="ln-ten" label={t("typeName")} error={submit.fields.name}>
          <input id="ln-ten" name="name" className={submit.inputClass("name")} defaultValue={item?.name} maxLength={100} />
        </Field>
        {custom ? (
          <>
            <Field id="ln-nhom" label={t("payGroup")}>
              <select id="ln-nhom" name="payGroup" className="o-nhap" defaultValue={item?.payGroup ?? "paid_other"}>
                <option value="paid_other">{t("group_paid_other")}</option>
                <option value="unpaid">{t("group_unpaid")}</option>
              </select>
            </Field>
            <Field id="ln-max" label={t("yearlyMax")} error={submit.fields.yearlyMaxDays}>
              <input id="ln-max" name="yearlyMaxDays" className={submit.inputClass("yearlyMaxDays")} inputMode="decimal" defaultValue={item?.yearlyMaxDays ?? ""} />
            </Field>
            <label>
              <input type="checkbox" name="requiresAttachment" defaultChecked={item?.requiresAttachment ?? false} /> {t("needsFile")}
            </label>
          </>
        ) : (
          <div className="khoi-canh-bao thong-tin">{t("lawTypeHint")}</div>
        )}
        {item?.systemCode !== "annual" && (
          <Field id="ln-tt" label={t("status")}>
            <select id="ln-tt" name="status" className="o-nhap" defaultValue={item?.status ?? "active"}>
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
            </select>
          </Field>
        )}
        <FormError text={submit.formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
