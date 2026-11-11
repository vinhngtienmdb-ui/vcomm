"use client";

// MAN_HINH_121 Chấm công (CHUC_NANG_165; API_151): lưới công tháng, chi tiết ngày, ghi thủ công, nhập tệp máy chấm công, lịch sử nhập.
import type { CorrectionItem, AttendanceDayResponse, AttendanceGridResponse, AttendanceImportItem, AttendanceImportResponse, EmployeeOptionsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { CorrectionStatusBadge, DayLegend, Table, Tabs, currentMonth, dayTone, daySymbol, hours, vietnamClock, weekdayLabel } from "@/components/AttendanceParts";

export default function AttendancePage() {
  const t = useTranslations("attendance");
  const mine = useTranslations("myAttendance");
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(currentMonth(vietnamToday()));
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<{ employeeId: string; date: string } | null>(null);
  const [dialog, setDialog] = useState<"import" | "manual" | null>(null);
  const parameters = new URLSearchParams({ month });
  if (departmentId) parameters.set("departmentId", departmentId);
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<AttendanceGridResponse>(`/hr/attendance/grid?${parameters}`);
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  const imports = useApi<AttendanceImportItem[]>(tab === 2 ? "/hr/attendance/imports" : null);
  const corrections = useApi<CorrectionItem[]>(tab === 1 ? `/hr/attendance/corrections?month=${month}` : null);
  const canManage = state.kind === "ready" && state.data.canManage && !state.data.monthClosed;
  const weekdays = t("weekdays").split(",");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {canManage && (
          <>
            <button type="button" className="nut chinh" onClick={() => setDialog("import")}>
              {t("importFile")}
            </button>
            <button type="button" className="nut phu" onClick={() => setDialog("manual")}>
              {t("manualEntry")}
            </button>
            <button
              type="button"
              className="nut phu"
              onClick={async () => {
                await apiFetch("/hr/attendance/recalculate", { method: "POST", body: JSON.stringify({ month }) });
                await reload();
              }}
            >
              {t("recalculate")}
            </button>
          </>
        )}
      </div>
      <Tabs labels={[t("tabDays"), t("tabCorrections"), t("tabImports")]} selected={tab} onSelect={setTab} />
      {tab === 0 && (
        <>
          <div className="bo-loc">
            <label className="an-nhan" htmlFor="thang-cong">
              {t("month")}
            </label>
            <input id="thang-cong" type="month" className="o-nhap" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
            {options.state.kind === "ready" && (
              <select className="o-nhap" aria-label={t("department")} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">{t("allDepartments")}</option>
                {options.state.data.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            <select className="o-nhap" aria-label={t("statusFilter")} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t("statusAll")}</option>
              <option value="missing_punch">{t("status_missing_punch")}</option>
              <option value="absent">{t("status_absent")}</option>
              <option value="late">{t("statusLate")}</option>
            </select>
          </div>
          <Loaded state={state} onRetry={() => void reload()}>
            {(grid) => {
              const missing = grid.rows.reduce((total, row) => total + row.days.filter((day) => day.status === "missing_punch").length, 0);
              const absent = grid.rows.reduce((total, row) => total + row.days.filter((day) => day.status === "absent").length, 0);
              return grid.rows.length === 0 ? (
                <MessageView text={t("noRows")} />
              ) : (
                <>
                  {grid.monthClosed && <div className="khoi-canh-bao thong-tin">{t("monthClosed")}</div>}
                  {missing + absent > 0 && <div className="khoi-canh-bao canh-bao">{t("problemSummary", { missing, absent })}</div>}
                  <div className="khung-bang">
                    <table className="luoi-cong">
                      <thead>
                        <tr>
                          <th scope="col">{t("employee")}</th>
                          {grid.dates.map((date) => (
                            <th key={date} scope="col">
                              {Number(date.slice(8))}
                              <br />
                              <span className="chu-thich">{weekdayLabel(date, weekdays)}</span>
                            </th>
                          ))}
                          <th scope="col">{t("units")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grid.rows.map((row) => (
                          <tr key={row.employeeId}>
                            <th scope="row">
                              <span className="ten-dong">{row.fullName}</span>
                              <span className="chu-thich">
                                {row.code} · {row.departmentName ?? "—"}
                              </span>
                            </th>
                            {grid.dates.map((date) => {
                              const day = row.days.find((item) => item.date === date);
                              return (
                                <td key={date}>
                                  {day ? (
                                    <button
                                      type="button"
                                      className={`o-cong ${dayTone(day)}`}
                                      aria-label={`${row.fullName} ${date}: ${t(`status_${day.status}`)}`}
                                      title={t(`status_${day.status}`)}
                                      onClick={() => setSelected({ employeeId: row.employeeId, date })}
                                    >
                                      {daySymbol(day)}
                                    </button>
                                  ) : (
                                    <span className="chu-thich">·</span>
                                  )}
                                </td>
                              );
                            })}
                            <td>
                              <strong>{Number(row.workedUnits).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="phan-trang">
                      <DayLegend />
                    </div>
                  </div>
                </>
              );
            }}
          </Loaded>
        </>
      )}
      {tab === 1 && (
        <Loaded state={corrections.state} onRetry={() => void corrections.reload()}>
          {(items) =>
            items.length === 0 ? (
              <MessageView text={t("noCorrections")} />
            ) : (
              <Table
                headings={[t("correctionNo"), t("employee"), t("workDate"), t("correctionKind"), t("inOut"), t("reason"), t("status")]}
                rows={items.map((item) => ({
                  key: item.id,
                  cells: [
                    item.correctionNo ?? "—",
                    item.employeeName,
                    formatDate(item.workDate),
                    mine(`kind_${item.kind}`),
                    `${item.checkIn ?? "—"} → ${item.checkOut ?? "—"}`,
                    <>
                      {item.reason}{" "}
                      {item.hasAttachment && (
                        <button type="button" className="nut chu" onClick={() => void apiDownload(`/hr/attendance/corrections/${item.id}/attachment`, `giai-trinh-${item.correctionNo}`, true)}>
                          {t("attachment")}
                        </button>
                      )}
                    </>,
                    <CorrectionStatusBadge status={item.status} />,
                  ],
                }))}
              />
            )
          }
        </Loaded>
      )}
      {tab === 2 && (
        <Loaded state={imports.state} onRetry={() => void imports.reload()}>
          {(items) =>
            items.length === 0 ? (
              <MessageView text={t("noImports")} />
            ) : (
              <Table
                headings={[t("importedAt"), t("fileName"), t("importedBy"), t("accepted"), t("duplicates"), t("errors")]}
                rows={items.map((item) => ({
                  key: item.id,
                  cells: [formatDateTime(item.importedAt), item.fileName, item.importedByName, item.accepted, item.duplicates, item.errors],
                }))}
              />
            )
          }
        </Loaded>
      )}
      {selected && <DayDrawer employeeId={selected.employeeId} date={selected.date} onClose={() => setSelected(null)} onChanged={() => void reload()} />}
      {dialog === "import" && (
        <ImportDrawer
          onClose={() => setDialog(null)}
          onDone={() => {
            void reload();
            void imports.reload();
          }}
        />
      )}
      {dialog === "manual" && state.kind === "ready" && (
        <ManualDrawer
          employees={state.data.rows.map((row) => ({ id: row.employeeId, label: `${row.code} · ${row.fullName}` }))}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

function ManualFields({ submit, defaultDate }: { submit: ReturnType<typeof useSubmit>; defaultDate: string }) {
  const t = useTranslations("attendance");
  return (
    <>
      <Field id="ngay-thu-cong" label={t("workDate")} error={submit.fields.workDate}>
        <input id="ngay-thu-cong" name="workDate" type="date" className={submit.inputClass("workDate")} defaultValue={defaultDate} />
      </Field>
      <Field id="gio-vao" label={t("checkIn")} error={submit.fields.checkIn}>
        <input id="gio-vao" name="checkIn" type="time" className={submit.inputClass("checkIn")} />
      </Field>
      <Field id="gio-ra" label={t("checkOut")} error={submit.fields.checkOut} hint={t("checkOutHint")}>
        <input id="gio-ra" name="checkOut" type="time" className={submit.inputClass("checkOut")} />
      </Field>
      <Field id="ly-do-thu-cong" label={t("reasonRequired")} error={submit.fields.reason}>
        <textarea id="ly-do-thu-cong" name="reason" rows={2} className={submit.inputClass("reason")} />
      </Field>
    </>
  );
}

const manualBody = (form: FormData, employeeId: string) => ({
  employeeId,
  workDate: String(form.get("workDate") ?? ""),
  checkIn: String(form.get("checkIn") ?? "") || null,
  checkOut: String(form.get("checkOut") ?? "") || null,
  reason: String(form.get("reason") ?? ""),
});

function ManualDrawer({ employees, onClose, onDone }: { employees: { id: string; label: string }[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("attendance");
  const submit = useSubmit();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(async () => {
      await apiFetch("/hr/attendance/punches", { method: "POST", body: JSON.stringify(manualBody(form, String(form.get("employeeId")))) });
      onDone();
    });
  };
  return (
    <Drawer title={t("manualEntry")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="nhan-vien-thu-cong" label={t("employee")} error={submit.fields.employeeId}>
          <select id="nhan-vien-thu-cong" name="employeeId" className="o-nhap">
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
        </Field>
        <ManualFields submit={submit} defaultDate={vietnamToday()} />
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

function DayDrawer({ employeeId, date, onClose, onChanged }: { employeeId: string; date: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("attendance");
  const { state, reload } = useApi<AttendanceDayResponse>(`/hr/attendance/days/${employeeId}/${date}`);
  const submit = useSubmit();
  const [deleting, setDeleting] = useState<string | null>(null);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit.run(async () => {
      await apiFetch("/hr/attendance/punches", { method: "POST", body: JSON.stringify(manualBody(form, employeeId)) });
      (event.target as HTMLFormElement).reset();
      await reload();
      onChanged();
    });
  };
  return (
    <Drawer title={state.kind === "ready" ? `${state.data.fullName} · ${date.split("-").reverse().join("/")}` : date} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(detail) => (
          <>
            {detail.day ? (
              <dl className="thong-tin-dong">
                <dt>{t("plannedShift")}</dt>
                <dd>{detail.day.shiftCode ? `${detail.day.shiftCode} · ${vietnamClock(detail.day.plannedStart)} – ${vietnamClock(detail.day.plannedEnd)}` : t(`status_${detail.day.status}`)}</dd>
                <dt>{t("inOut")}</dt>
                <dd>
                  {vietnamClock(detail.day.firstIn)} – {vietnamClock(detail.day.lastOut)}
                </dd>
                <dt>{t("workedHours")}</dt>
                <dd>
                  {hours(detail.day.workedMinutes)} / {hours(detail.day.standardMinutes)}
                </dd>
                <dt>{t("units")}</dt>
                <dd>
                  {Number(detail.day.workedUnits).toLocaleString("vi-VN")} <span className={`nhan ${dayTone(detail.day)}`}>{t(`status_${detail.day.status}`)}</span>
                </dd>
                <dt>{t("lateEarly")}</dt>
                <dd>{t("lateEarlyValue", { late: detail.day.lateMinutes, early: detail.day.earlyMinutes })}</dd>
                <dt>{t("nightHours")}</dt>
                <dd>{hours(detail.day.nightMinutes)}</dd>
              </dl>
            ) : (
              <MessageView text={t("dayNotCalculated")} />
            )}
            {detail.punches.length === 0 ? (
              <MessageView text={t("noPunches")} />
            ) : (
              // Bọc ngoài để bảng cuộn ngang không bị co chiều cao trong ngăn kéo dạng lưới.
              <div>
                <Table
                  headings={[t("punchedAt"), t("source"), t("detail"), ""]}
                  rows={detail.punches.map((punch) => ({
                    key: punch.id,
                    cells: [
                      vietnamClock(punch.punchedAt),
                      t(`source_${punch.source}`),
                      [punch.deviceCode, punch.locationName, punch.distanceMeters !== null ? `${punch.distanceMeters} m` : null, punch.reason, punch.createdByName].filter(Boolean).join(" · "),
                      punch.canDelete ? (
                        <button
                          type="button"
                          className={`nut chu${deleting === punch.id ? " dang-xu-ly" : ""}`}
                          disabled={deleting !== null}
                          onClick={async () => {
                            const reason = window.prompt(t("deleteReason"));
                            if (!reason) return;
                            setDeleting(punch.id);
                            try {
                              await apiFetch(`/hr/attendance/punches/${punch.id}/delete`, { method: "POST", body: JSON.stringify({ reason }) });
                              await reload();
                              onChanged();
                            } finally {
                              setDeleting(null);
                            }
                          }}
                        >
                          {t("delete")}
                        </button>
                      ) : (
                        ""
                      ),
                    ],
                  }))}
                />
              </div>
            )}
            {detail.canManage && (
              <form className="the" onSubmit={onSubmit}>
                <div className="khoi-canh-bao thong-tin">{t("manualHint")}</div>
                <ManualFields submit={submit} defaultDate={date} />
                <FormError text={submit.formError} />
                <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
                  {t("addPunches")}
                </button>
              </form>
            )}
          </>
        )}
      </Loaded>
    </Drawer>
  );
}

function ImportDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations("attendance");
  const errorText = useTranslations("errors");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AttendanceImportResponse | null>(null);
  const submit = useSubmit();
  const send = (confirm: boolean) =>
    submit.run(async () => {
      const form = new FormData();
      form.set("confirm", String(confirm));
      form.set("file", file!);
      const result = await apiUpload<AttendanceImportResponse>("/hr/attendance/imports", form);
      setPreview(result);
      if (confirm) onDone();
    });
  return (
    <Drawer title={t("importFile")} onClose={onClose}>
      <Field id="tep-cham-cong" label={t("importFileLabel")} error={submit.fields.file} hint={t("importHint")}>
        <input
          id="tep-cham-cong"
          type="file"
          className="o-nhap"
          accept=".csv,.txt,.xlsx"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
          }}
        />
      </Field>
      <button type="button" className="nut chu" onClick={() => void apiDownload("/hr/attendance/imports/template", "mau-luot-cham-cong.xlsx")}>
        {t("downloadTemplate")}
      </button>
      {preview && (
        <div className={`khoi-canh-bao ${preview.errors.length > 0 ? "canh-bao" : "thong-tin"}`}>
          {t(preview.imported ? "importDone" : "importPreview", { total: preview.totalRows, accepted: preview.accepted, duplicates: preview.duplicates, errors: preview.errors.length })}
          {preview.errors.slice(0, 20).map((error) => (
            <div key={error.row}>{t("importRowError", { row: error.row, message: errorText(error.messageKey as never) })}</div>
          ))}
        </div>
      )}
      <FormError text={submit.formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        {!preview?.imported && (
          <button type="button" className={`nut ${preview ? "phu" : "chinh"}${submit.submitting ? " dang-xu-ly" : ""}`} disabled={!file || submit.submitting} onClick={() => void send(false)}>
            {t("preview")}
          </button>
        )}
        {preview && !preview.imported && preview.accepted > 0 && (
          <button type="button" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting} onClick={() => void send(true)}>
            {t("confirmImport", { count: preview.accepted })}
          </button>
        )}
      </div>
    </Drawer>
  );
}
