"use client";

// Các thẻ của MAN_HINH_120 (API_150): ca làm, lịch tuần, xếp ca theo tuần, ngày lễ, cài đặt chấm công.
import type { AttendanceSettingsResponse, EmployeeOptionsResponse, HolidayListResponse, RosterResponse, ScheduleItem, ShiftItem } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table, hours, mondayOf, shiftDate, weekdayLabel } from "./AttendanceParts";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function DrawerActions({ submitting, label, onClose }: { submitting: boolean; label: string; onClose: () => void }) {
  const t = useTranslations("attendance");
  return (
    <div className="nhom-nut">
      <button type="button" className="nut phu" onClick={onClose}>
        {t("cancel")}
      </button>
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
        {label}
      </button>
    </div>
  );
}

// ---- Ca làm ----

export function ShiftTab() {
  const t = useTranslations("attendance");
  const { can } = useAdmin();
  const canManage = can("hr.attendance.manage");
  const { state, reload } = useApi<ShiftItem[]>("/hr/attendance/shifts");
  const [editing, setEditing] = useState<ShiftItem | "new" | null>(null);
  return (
    <>
      <div className="tieu-de">
        <h2>{t("tabShifts")}</h2>
        {canManage && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addShift")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(shifts) =>
          shifts.length === 0 ? (
            <MessageView text={t("noShifts")} />
          ) : (
            <Table
              headings={[t("shiftCode"), t("shiftName"), t("shiftTime"), t("shiftBreak"), t("standardHours"), t("nightHours"), t("workUnits"), t("status"), ""]}
              rows={shifts.map((shift) => ({
                key: shift.id,
                cells: [
                  shift.code,
                  shift.name,
                  `${shift.startTime} – ${shift.endTime}${shift.endTime <= shift.startTime ? ` ${t("nextDay")}` : ""}`,
                  shift.breakMinutes > 0 ? t("breakValue", { start: shift.breakStart ?? "", minutes: shift.breakMinutes, paid: String(shift.breakPaid) }) : t("noBreak"),
                  <>
                    {hours(shift.standardMinutes)} {shift.shortBreakWarning && <span className="nhan canh-bao">{t("shortBreak")}</span>}
                  </>,
                  hours(shift.nightMinutes),
                  shift.workUnits === "1" ? "1" : "0,5",
                  <span className={`nhan ${shift.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`shiftStatus_${shift.status}`)}</span>,
                  canManage ? (
                    <button type="button" className="nut chu" onClick={() => setEditing(shift)}>
                      {t("edit")}
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
      {editing && (
        <ShiftDrawer
          shift={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

function ShiftDrawer({ shift, onClose, onSaved }: { shift: ShiftItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("attendance");
  const submit = useSubmit();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      code: text(form, "code"),
      name: text(form, "name"),
      startTime: text(form, "startTime"),
      endTime: text(form, "endTime"),
      breakStart: text(form, "breakStart") || null,
      breakMinutes: Number(text(form, "breakMinutes") || 0),
      breakPaid: form.get("breakPaid") === "on",
      workUnits: text(form, "workUnits"),
      status: text(form, "status") || "active",
      ...(shift ? { version: shift.version } : {}),
    };
    void submit.run(async () => {
      await apiFetch(shift ? `/hr/attendance/shifts/${shift.id}` : "/hr/attendance/shifts", { method: shift ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  };
  return (
    <Drawer title={shift ? `${t("editShift")} ${shift.code}` : t("addShift")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="ma-ca" label={t("shiftCode")} error={submit.fields.code}>
          <input id="ma-ca" name="code" className={submit.inputClass("code")} defaultValue={shift?.code} maxLength={20} />
        </Field>
        <Field id="ten-ca" label={t("shiftName")} error={submit.fields.name}>
          <input id="ten-ca" name="name" className={submit.inputClass("name")} defaultValue={shift?.name} maxLength={100} />
        </Field>
        <Field id="bat-dau" label={t("startTime")} error={submit.fields.startTime}>
          <input id="bat-dau" name="startTime" type="time" className={submit.inputClass("startTime")} defaultValue={shift?.startTime ?? "08:00"} />
        </Field>
        <Field id="ket-thuc" label={t("endTime")} error={submit.fields.endTime} hint={t("endTimeHint")}>
          <input id="ket-thuc" name="endTime" type="time" className={submit.inputClass("endTime")} defaultValue={shift?.endTime ?? "17:00"} />
        </Field>
        <Field id="nghi-bat-dau" label={t("breakStart")} error={submit.fields.breakStart}>
          <input id="nghi-bat-dau" name="breakStart" type="time" className={submit.inputClass("breakStart")} defaultValue={shift?.breakStart ?? "12:00"} />
        </Field>
        <Field id="nghi-phut" label={t("breakMinutes")} error={submit.fields.breakMinutes}>
          <input id="nghi-phut" name="breakMinutes" type="number" min={0} max={240} className={submit.inputClass("breakMinutes")} defaultValue={shift?.breakMinutes ?? 60} />
        </Field>
        <label>
          <input type="checkbox" name="breakPaid" defaultChecked={shift?.breakPaid ?? false} /> {t("breakPaid")}
        </label>
        <Field id="he-so" label={t("workUnits")} error={submit.fields.workUnits}>
          <select id="he-so" name="workUnits" className="o-nhap" defaultValue={shift?.workUnits ?? "1"}>
            <option value="1">1</option>
            <option value="0.5">0,5</option>
          </select>
        </Field>
        {shift && (
          <Field id="trang-thai-ca" label={t("status")}>
            <select id="trang-thai-ca" name="status" className="o-nhap" defaultValue={shift.status}>
              <option value="active">{t("shiftStatus_active")}</option>
              <option value="inactive">{t("shiftStatus_inactive")}</option>
            </select>
          </Field>
        )}
        <div className="khoi-canh-bao thong-tin">{t("shiftLegalHint")}</div>
        <FormError text={submit.formError} />
        <DrawerActions submitting={submit.submitting} label={t("save")} onClose={onClose} />
      </form>
    </Drawer>
  );
}

// ---- Lịch tuần ----

export function ScheduleTab() {
  const t = useTranslations("attendance");
  const { can } = useAdmin();
  const canManage = can("hr.attendance.manage");
  const { state, reload } = useApi<ScheduleItem[]>("/hr/attendance/schedules");
  const shifts = useApi<ShiftItem[]>("/hr/attendance/shifts");
  const [editing, setEditing] = useState<ScheduleItem | "new" | null>(null);
  const [assigning, setAssigning] = useState<ScheduleItem | null>(null);
  const weekdays = t("weekdays").split(",");
  return (
    <>
      <div className="tieu-de">
        <h2>{t("tabSchedules")}</h2>
        {canManage && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addSchedule")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(schedules) =>
          schedules.length === 0 ? (
            <MessageView text={t("noSchedules")} />
          ) : (
            <Table
              headings={[t("scheduleName"), ...weekdays, t("weeklyHours"), t("appliesTo"), ""]}
              rows={schedules.map((schedule) => ({
                key: schedule.id,
                cells: [
                  <>
                    {schedule.name} {schedule.isDefault && <span className="nhan thong-tin">{t("default")}</span>}
                  </>,
                  ...schedule.shiftCodes.map((code) => code ?? t("off")),
                  hours(schedule.weeklyMinutes),
                  schedule.isDefault && schedule.assignments.length === 0
                    ? t("defaultAppliesTo")
                    : schedule.assignments.map((assignment) => `${assignment.departmentName ?? assignment.employeeName} ${t("fromDate", { date: formatDate(assignment.effectiveFrom) })}`).join("; ") ||
                      "—",
                  canManage ? (
                    <span className="nhom-nut">
                      <button type="button" className="nut chu" onClick={() => setEditing(schedule)}>
                        {t("edit")}
                      </button>
                      <button type="button" className="nut chu" onClick={() => setAssigning(schedule)}>
                        {t("assign")}
                      </button>
                    </span>
                  ) : (
                    ""
                  ),
                ],
              }))}
            />
          )
        }
      </Loaded>
      {editing && shifts.state.kind === "ready" && (
        <ScheduleDrawer
          schedule={editing === "new" ? null : editing}
          shifts={shifts.state.data.filter((shift) => shift.status === "active")}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {assigning && (
        <AssignDrawer
          schedule={assigning}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

function ScheduleDrawer({ schedule, shifts, onClose, onSaved }: { schedule: ScheduleItem | null; shifts: ShiftItem[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("attendance");
  const submit = useSubmit();
  const weekdays = t("weekdays").split(",");
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: text(form, "name"),
      isDefault: form.get("isDefault") === "on",
      shiftIds: weekdays.map((_, index) => text(form, `day${index}`) || null),
      ...(schedule ? { version: schedule.version } : {}),
    };
    void submit.run(async () => {
      await apiFetch(schedule ? `/hr/attendance/schedules/${schedule.id}` : "/hr/attendance/schedules", { method: schedule ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  };
  return (
    <Drawer title={schedule ? schedule.name : t("addSchedule")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="ten-lich" label={t("scheduleName")} error={submit.fields.name}>
          <input id="ten-lich" name="name" className={submit.inputClass("name")} defaultValue={schedule?.name} maxLength={100} />
        </Field>
        {weekdays.map((label, index) => (
          <Field key={label} id={`ngay-${index}`} label={label} error={submit.fields[`shiftIds.${index}`]}>
            <select id={`ngay-${index}`} name={`day${index}`} className="o-nhap" defaultValue={schedule?.shiftIds[index] ?? ""}>
              <option value="">{t("off")}</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.code} · {shift.startTime} – {shift.endTime}
                </option>
              ))}
            </select>
          </Field>
        ))}
        {submit.fields.shiftIds && <span className="loi-o">{submit.fields.shiftIds}</span>}
        <label>
          <input type="checkbox" name="isDefault" defaultChecked={schedule?.isDefault ?? false} disabled={schedule?.isDefault} /> {t("setDefault")}
        </label>
        <FormError text={submit.formError} />
        <DrawerActions submitting={submit.submitting} label={t("save")} onClose={onClose} />
      </form>
    </Drawer>
  );
}

function AssignDrawer({ schedule, onClose, onSaved }: { schedule: ScheduleItem; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("attendance");
  const submit = useSubmit();
  const [target, setTarget] = useState<"department" | "employee">("department");
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  const grid = useApi<{ rows: { employeeId: string; code: string; fullName: string }[] }>(target === "employee" ? `/hr/attendance/grid?month=${vietnamToday().slice(0, 7)}` : null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = { [target === "department" ? "departmentId" : "employeeId"]: text(form, "target"), effectiveFrom: text(form, "effectiveFrom") };
    void submit.run(async () => {
      await apiFetch(`/hr/attendance/schedules/${schedule.id}/assignments`, { method: "POST", body: JSON.stringify(body) });
      onSaved();
    });
  };
  return (
    <Drawer title={`${t("assign")} · ${schedule.name}`} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="gan-cho" label={t("assignTarget")}>
          <select id="gan-cho" className="o-nhap" value={target} onChange={(event) => setTarget(event.target.value as "department" | "employee")}>
            <option value="department">{t("department")}</option>
            <option value="employee">{t("employee")}</option>
          </select>
        </Field>
        <Field id="doi-tuong" label={target === "department" ? t("department") : t("employee")} error={submit.fields.departmentId ?? submit.fields.employeeId}>
          <select id="doi-tuong" name="target" className="o-nhap">
            {target === "department" && options.state.kind === "ready"
              ? options.state.data.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              : grid.state.kind === "ready"
                ? grid.state.data.rows.map((row) => (
                    <option key={row.employeeId} value={row.employeeId}>
                      {row.code} · {row.fullName}
                    </option>
                  ))
                : null}
          </select>
        </Field>
        <Field id="tu-ngay" label={t("effectiveFrom")} error={submit.fields.effectiveFrom}>
          <input id="tu-ngay" name="effectiveFrom" type="date" className={submit.inputClass("effectiveFrom")} defaultValue={vietnamToday()} />
        </Field>
        <FormError text={submit.formError} />
        <DrawerActions submitting={submit.submitting} label={t("assign")} onClose={onClose} />
      </form>
    </Drawer>
  );
}

// ---- Xếp ca theo tuần ----

export function RosterTab() {
  const t = useTranslations("attendance");
  const [weekStart, setWeekStart] = useState(mondayOf(shiftDate(vietnamToday(), 7)));
  const [departmentId, setDepartmentId] = useState("");
  const parameters = new URLSearchParams({ weekStart });
  if (departmentId) parameters.set("departmentId", departmentId);
  const { state, reload } = useApi<RosterResponse>(`/hr/attendance/roster?${parameters}`);
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  // Ô đã đổi: "schedule" là bỏ xếp ca (theo lịch tuần), "" là nghỉ, còn lại là mã ca.
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weekdays = t("weekdays").split(",");
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const cells = Object.entries(changes).map(([key, value]) => {
        const [employeeId, date] = key.split("|") as [string, string];
        return value === "schedule" ? { employeeId, date, shiftId: null, clear: true } : { employeeId, date, shiftId: value || null };
      });
      await apiFetch("/hr/attendance/roster", { method: "PUT", body: JSON.stringify({ cells }) });
      setChanges({});
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setSaving(false);
    }
  };
  const copyPreviousWeek = async () => {
    const previous = await apiFetch<RosterResponse>(`/hr/attendance/roster?${new URLSearchParams({ weekStart: shiftDate(weekStart, -7), ...(departmentId ? { departmentId } : {}) })}`);
    const next: Record<string, string> = {};
    for (const row of previous.rows) row.cells.forEach((cell, index) => (next[`${row.employeeId}|${shiftDate(weekStart, index)}`] = cell.shiftId ?? ""));
    setChanges(next);
  };
  return (
    <>
      <div className="bo-loc">
        <button type="button" className="nut phu" aria-label={t("previousWeek")} onClick={() => (setWeekStart(shiftDate(weekStart, -7)), setChanges({}))}>
          ‹
        </button>
        <span>{t("weekRange", { from: formatDate(weekStart), to: formatDate(shiftDate(weekStart, 6)) })}</span>
        <button type="button" className="nut phu" aria-label={t("nextWeek")} onClick={() => (setWeekStart(shiftDate(weekStart, 7)), setChanges({}))}>
          ›
        </button>
        {options.state.kind === "ready" && (
          <select className="o-nhap" aria-label={t("department")} value={departmentId} onChange={(event) => (setDepartmentId(event.target.value), setChanges({}))}>
            <option value="">{t("allDepartments")}</option>
            {options.state.data.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="nut phu" onClick={() => void copyPreviousWeek()}>
          {t("copyPreviousWeek")}
        </button>
        <button type="button" className={`nut chinh${saving ? " dang-xu-ly" : ""}`} disabled={saving || Object.keys(changes).length === 0} onClick={() => void save()}>
          {t("saveRoster")}
        </button>
      </div>
      {error && (
        <div className="khoi-canh-bao loi" role="alert">
          {error}
        </div>
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(roster) => {
          const warned = roster.rows.filter((row) => row.warnings.length > 0);
          return roster.rows.length === 0 ? (
            <MessageView text={t("noRows")} />
          ) : (
            <>
              {warned.length > 0 && (
                <div className="khoi-canh-bao canh-bao">
                  {warned.map((row) => (
                    <div key={row.employeeId}>
                      {row.fullName}: {row.warnings.map((warning) => t(`warning_${warning}`, { hours: hours(row.weeklyMinutes) })).join(" ")}
                    </div>
                  ))}
                </div>
              )}
              <div className="khung-bang">
                <table className="luoi-cong">
                  <thead>
                    <tr>
                      <th scope="col">{t("employee")}</th>
                      {roster.dates.map((date) => (
                        <th key={date} scope="col">
                          {weekdayLabel(date, weekdays)}
                          <br />
                          <span className="chu-thich">{formatDate(date).slice(0, 5)}</span>
                        </th>
                      ))}
                      <th scope="col">{t("weeklyHours")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.rows.map((row) => (
                      <tr key={row.employeeId}>
                        <th scope="row">
                          <span className="ten-dong">{row.fullName}</span>
                          <span className="chu-thich">
                            {row.code}
                            {row.isMinor ? ` · ${t("minor")}` : ""}
                          </span>
                        </th>
                        {row.cells.map((cell) => {
                          const key = `${row.employeeId}|${cell.date}`;
                          const value = changes[key] ?? (cell.fromRoster ? (cell.shiftId ?? "") : "schedule");
                          return (
                            <td key={cell.date}>
                              {cell.holiday ? (
                                <span className="nhan trung-tinh">{t("holidayShort")}</span>
                              ) : (
                                <select
                                  className="o-nhap o-ca"
                                  aria-label={`${row.fullName} ${cell.date}`}
                                  disabled={cell.locked}
                                  value={value}
                                  onChange={(event) => setChanges({ ...changes, [key]: event.target.value })}
                                >
                                  <option value="schedule">{t("bySchedule", { code: roster.shifts.find((shift) => shift.id === cell.shiftId)?.code ?? t("off") })}</option>
                                  <option value="">{t("off")}</option>
                                  {roster.shifts.map((shift) => (
                                    <option key={shift.id} value={shift.id}>
                                      {shift.code}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          );
                        })}
                        <td>{hours(row.weeklyMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <span className="chu-thich">{t("rosterHint")}</span>
            </>
          );
        }}
      </Loaded>
    </>
  );
}

// ---- Ngày lễ ----

export function HolidaysTab() {
  const t = useTranslations("attendance");
  const [year, setYear] = useState(Number(vietnamToday().slice(0, 4)));
  const { state, reload } = useApi<HolidayListResponse>(`/hr/attendance/holidays?year=${year}`);
  const [adding, setAdding] = useState<"group" | "company" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="tieu-de">
        <h2>{t("holidaysOfYear", { year })}</h2>
        <select className="o-nhap" style={{ width: "auto" }} aria-label={t("year")} value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {[year - 1, year, year + 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {state.kind === "ready" && state.data.canManageGroup && (
          <>
            <button
              type="button"
              className="nut phu"
              onClick={async () => {
                await apiFetch("/hr/attendance/holidays/generate", { method: "POST", body: JSON.stringify({ year }) });
                await reload();
              }}
            >
              {t("generateHolidays")}
            </button>
            <button type="button" className="nut phu" onClick={() => setAdding("group")}>
              {t("addGroupHoliday")}
            </button>
          </>
        )}
        {state.kind === "ready" && state.data.canManageCompany && (
          <button type="button" className="nut chinh" onClick={() => setAdding("company")}>
            {t("addCompanyHoliday")}
          </button>
        )}
      </div>
      <div className="khoi-canh-bao thong-tin">{t("holidayHint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(list) =>
          list.items.length === 0 ? (
            <MessageView text={t("noHolidays")} />
          ) : (
            <Table
              headings={[t("date"), t("holidayName"), t("scope"), t("appliesTo"), ""]}
              rows={list.items.map((item) => ({
                key: item.id,
                cells: [
                  formatDate(item.date),
                  item.name,
                  item.scope === "group" ? t("scopeGroup") : <span className="nhan thong-tin">{t("scopeCompany")}</span>,
                  item.foreignersOnly ? t("foreignersOnly") : t("everyone"),
                  item.canDelete ? (
                    <button type="button" className="nut chu" onClick={() => setRemoving(item.id)}>
                      {t("delete")}
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
      {adding && (
        <HolidayDrawer
          scope={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            void reload();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t("deleteHoliday")}
          text={t("deleteHolidayText")}
          confirmLabel={t("delete")}
          busy={busy}
          error={error}
          onClose={() => (setRemoving(null), setError(null))}
          onConfirm={async () => {
            setBusy(true);
            try {
              await apiFetch(`/hr/attendance/holidays/${removing}`, { method: "DELETE" });
              setRemoving(null);
              await reload();
            } catch (failure) {
              setError(failureOf(failure).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}

function HolidayDrawer({ scope, onClose, onSaved }: { scope: "group" | "company"; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("attendance");
  const submit = useSubmit();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(async () => {
      await apiFetch("/hr/attendance/holidays", {
        method: "POST",
        body: JSON.stringify({ date: text(form, "date"), name: text(form, "name"), foreignersOnly: form.get("foreignersOnly") === "on", scope }),
      });
      onSaved();
    });
  };
  return (
    <Drawer title={scope === "group" ? t("addGroupHoliday") : t("addCompanyHoliday")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="ngay-le" label={t("date")} error={submit.fields.date}>
          <input id="ngay-le" name="date" type="date" className={submit.inputClass("date")} />
        </Field>
        <Field id="ten-le" label={t("holidayName")} error={submit.fields.name}>
          <input id="ten-le" name="name" className={submit.inputClass("name")} maxLength={100} />
        </Field>
        <label>
          <input type="checkbox" name="foreignersOnly" /> {t("foreignersOnly")}
        </label>
        <span className="chu-thich">{t("paidHolidayHint")}</span>
        <FormError text={submit.formError} />
        <DrawerActions submitting={submit.submitting} label={t("save")} onClose={onClose} />
      </form>
    </Drawer>
  );
}

// ---- Cài đặt ----

export function SettingsTab() {
  const t = useTranslations("attendance");
  const { can } = useAdmin();
  const canManage = can("hr.attendance.manage");
  const { state, reload } = useApi<AttendanceSettingsResponse>("/hr/attendance/settings");
  const submit = useSubmit();
  const [saved, setSaved] = useState(false);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settings) => (
        <form
          className="the"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setSaved(false);
            void submit.run(async () => {
              await apiFetch("/hr/attendance/settings", {
                method: "PUT",
                body: JSON.stringify({
                  workingTimeMode: text(form, "workingTimeMode"),
                  graceMinutes: Number(text(form, "graceMinutes")),
                  appLocationScope: text(form, "appLocationScope"),
                  carryoverMode: text(form, "carryoverMode"),
                  carryoverMonths: Number(text(form, "carryoverMonths")),
                  allowAdvanceLeave: text(form, "allowAdvanceLeave") === "true",
                  overtimeAnnualLimit: Number(text(form, "overtimeAnnualLimit")),
                  overtimeExtendedReason: text(form, "overtimeExtendedReason") || null,
                  correctionMonthlyLimit: Number(text(form, "correctionMonthlyLimit")),
                  version: settings.version,
                }),
              });
              await reload();
              setSaved(true);
            });
          }}
        >
          <h2>{t("tabSettings")}</h2>
          <fieldset disabled={!canManage} style={{ border: 0, padding: 0, margin: 0 }} className="hai-cot">
            <Field id="che-do" label={t("workingTimeMode")}>
              <select id="che-do" name="workingTimeMode" className="o-nhap" defaultValue={settings.workingTimeMode}>
                <option value="daily">{t("workingTime_daily")}</option>
                <option value="weekly">{t("workingTime_weekly")}</option>
              </select>
            </Field>
            <Field id="an-han" label={t("graceMinutes")} error={submit.fields.graceMinutes} hint={t("graceHint")}>
              <input id="an-han" name="graceMinutes" type="number" min={0} max={30} className={submit.inputClass("graceMinutes")} defaultValue={settings.graceMinutes} />
            </Field>
            <Field id="noi-cham" label={t("appLocationScope")}>
              <select id="noi-cham" name="appLocationScope" className="o-nhap" defaultValue={settings.appLocationScope}>
                <option value="branch">{t("locationScope_branch")}</option>
                <option value="company">{t("locationScope_company")}</option>
              </select>
            </Field>
            <Field id="phep-ton" label={t("carryoverMode")}>
              <select id="phep-ton" name="carryoverMode" className="o-nhap" defaultValue={settings.carryoverMode}>
                <option value="expire">{t("carryover_expire")}</option>
                <option value="never">{t("carryover_never")}</option>
              </select>
            </Field>
            <Field id="thang-ton" label={t("carryoverMonths")} error={submit.fields.carryoverMonths} hint={t("carryoverHint")}>
              <input id="thang-ton" name="carryoverMonths" type="number" min={1} max={36} className={submit.inputClass("carryoverMonths")} defaultValue={settings.carryoverMonths} />
            </Field>
            <Field id="nghi-truoc" label={t("allowAdvanceLeave")}>
              <select id="nghi-truoc" name="allowAdvanceLeave" className="o-nhap" defaultValue={String(settings.allowAdvanceLeave)}>
                <option value="false">{t("no")}</option>
                <option value="true">{t("advanceYes")}</option>
              </select>
            </Field>
            <Field id="gioi-han" label={t("overtimeAnnualLimit")} hint={t("overtimeLimitHint")}>
              <select id="gioi-han" name="overtimeAnnualLimit" className="o-nhap" defaultValue={String(settings.overtimeAnnualLimit)}>
                <option value="200">{t("overtime200")}</option>
                <option value="300">{t("overtime300")}</option>
              </select>
            </Field>
            <Field id="ly-do-300" label={t("overtimeExtendedReason")} error={submit.fields.overtimeExtendedReason}>
              <input id="ly-do-300" name="overtimeExtendedReason" className={submit.inputClass("overtimeExtendedReason")} defaultValue={settings.overtimeExtendedReason ?? ""} maxLength={500} />
            </Field>
            <Field id="so-don" label={t("correctionMonthlyLimit")} error={submit.fields.correctionMonthlyLimit} hint={t("correctionLimitHint")}>
              <input id="so-don" name="correctionMonthlyLimit" type="number" min={0} max={31} className={submit.inputClass("correctionMonthlyLimit")} defaultValue={settings.correctionMonthlyLimit} />
            </Field>
          </fieldset>
          {saved && <div className="khoi-canh-bao thong-tin">{t("settingsSaved")}</div>}
          <FormError text={submit.formError} />
          {canManage && (
            <div className="nhom-nut">
              <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
                {t("saveSettings")}
              </button>
            </div>
          )}
        </form>
      )}
    </Loaded>
  );
}
