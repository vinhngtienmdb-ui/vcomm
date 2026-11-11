"use client";

// MAN_HINH_122 Chấm công của tôi (CHUC_NANG_165, 167; API_152, API_155): thiết kế cho điện thoại. Vào ca, ra ca bằng GPS, mạng công ty hoặc mã QR;
// lịch ca tuần, công tháng, đơn giải trình; đăng ký và đồng ý tăng ca (API_154); xác nhận hoặc giải trình bảng công tháng (API_155). Mở từ mã QR: đường dẫn có l (địa điểm), t (mã), c (công ty).
import type { CorrectionItem, CorrectionKind, MyLeaveResponse, MyAttendanceMonthResponse, MyAttendanceResponse, MyTimesheetResponse, MyWeekResponse, OvertimeItem } from "contracts";
import { correctionKinds } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch, apiUpload, rememberCompany, selectedCompanyId } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { LeaveRequestDrawer, LeaveStatusBadge, leavePeriod } from "@/components/LeaveParts";
import { CancelOvertimeDrawer, OvertimeDrawer, OvertimeStatusBadge, decimal, overtimeTime } from "@/components/OvertimeParts";
import { TimesheetStatusBadge, TimesheetSummary } from "@/components/TimesheetParts";
import { CorrectionStatusBadge, Table, Tabs, currentMonth, dayTone, daySymbol, mondayOf, vietnamClock, weekdayLabel } from "@/components/AttendanceParts";

type Position = { latitude: number; longitude: number; accuracyMeters: number };

function readPosition(): Promise<Position | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: Math.round(position.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    ),
  );
}

export default function MyAttendancePage() {
  return (
    <Suspense>
      <MyAttendance />
    </Suspense>
  );
}

function MyAttendance() {
  const t = useTranslations("myAttendance");
  const search = useSearchParams();
  const qr = search.get("l") && search.get("t") ? { locationId: search.get("l")!, qrToken: search.get("t")! } : null;
  const qrCompany = search.get("c");
  const [companyReady, setCompanyReady] = useState(!qrCompany);
  useEffect(() => {
    // Mã QR của công ty khác công ty đang chọn: chọn công ty của mã rồi mới tải.
    if (qrCompany && selectedCompanyId() !== qrCompany) rememberCompany(qrCompany);
    setCompanyReady(true);
  }, [qrCompany]);
  const { state, reload } = useApi<MyAttendanceResponse>(companyReady ? "/hr/me/attendance" : null);
  const [tab, setTab] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "thong-tin" | "loi"; text: string } | null>(null);
  const [locationConsent, setLocationConsent] = useState(false);
  const [correction, setCorrection] = useState<string | null>(null);
  const leave = useApi<MyLeaveResponse>(companyReady ? "/hr/me/leave" : null);
  const [leaving, setLeaving] = useState(false);
  const overtime = useApi<OvertimeItem[]>(companyReady ? "/hr/me/overtime" : null);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const thisMonth = vietnamToday().slice(0, 7);
  const overtimeItems = overtime.state.kind === "ready" ? overtime.state.data : [];
  const consentItems = overtimeItems.filter((item) => item.canConsent);
  const overtimeMonthHours = overtimeItems
    .filter((item) => item.status === "approved" && item.workDate.startsWith(thisMonth))
    .reduce((total, item) => total + Number(item.countedHours ?? item.hours), 0);
  const consent = async (item: OvertimeItem, agree: boolean) => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      await apiFetch(`/hr/me/overtime/${item.id}/consent`, { method: "POST", body: JSON.stringify({ agree }) });
      await overtime.reload();
    } catch (failure) {
      setConsentError(failureOf(failure).message);
    } finally {
      setConsentBusy(false);
    }
  };
  const punch = async (useQr: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      const position = useQr ? null : await readPosition();
      const result = await apiFetch<MyAttendanceResponse>("/hr/me/attendance/punch", {
        method: "POST",
        body: JSON.stringify(useQr && qr ? qr : (position ?? {})),
      });
      const last = result.punches.at(-1);
      setMessage({ tone: "thong-tin", text: t("punched", { time: vietnamClock(last?.punchedAt ?? null), method: t(`method_${last?.method ?? "ip"}`) }) });
      await reload();
    } catch (failure) {
      setMessage({ tone: "loi", text: failureOf(failure).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="trang-dien-thoai">
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(today) =>
          !today.employee ? (
            <MessageView text={t("notLinked")} />
          ) : (
            <>
              <div className="the cham-nhanh">
                <div>
                  <strong>{t("todayLabel", { date: formatDate(today.today), weekday: weekdayLabel(today.today, t("weekdaysLong").split(",")) })}</strong>
                  <div className="chu-thich">{today.holiday ? t("holiday") : today.shift ? t("shiftLine", today.shift) : t("noShift")}</div>
                </div>
                <div className="nhom-nut">
                  {today.networkMatched && <span className="nhan thanh-cong">{t("onCompanyNetwork")}</span>}
                  {today.locations.length === 0 && <span className="nhan canh-bao">{t("noLocations")}</span>}
                </div>
                {qr ? (
                  <button type="button" className={`nut chinh nut-lon${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void punch(true)}>
                    {today.nextAction === "in" ? t("checkInQr") : t("checkOutQr")}
                  </button>
                ) : !locationConsent && !today.networkMatched && today.locations.some((location) => location.gps) ? (
                  <>
                    <div className="khoi-canh-bao thong-tin">{t("locationNotice")}</div>
                    <button type="button" className="nut chinh nut-lon" onClick={() => setLocationConsent(true)}>
                      {t("allowLocation")}
                    </button>
                  </>
                ) : (
                  <button type="button" className={`nut chinh nut-lon${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void punch(false)}>
                    {today.nextAction === "in" ? t("checkIn") : t("checkOut")}
                  </button>
                )}
                {message && (
                  <div className={`khoi-canh-bao ${message.tone}`} role="status">
                    {message.text}
                  </div>
                )}
                <span className="chu-thich">
                  {today.punches.length === 0
                    ? t("noPunchesToday")
                    : t("punchesToday", { list: today.punches.map((item) => `${vietnamClock(item.punchedAt).slice(0, 5)} (${t(`source_${item.source}`)})`).join(", ") })}
                </span>
              </div>
              {consentItems.map((item) => (
                <div key={item.id} className="khoi-canh-bao canh-bao">
                  {t("overtimeConsent", { date: formatDate(item.workDate), time: overtimeTime(item), content: item.workContent, location: item.workLocation, hours: decimal(item.hours) })}{" "}
                  <span className="nhom-nut">
                    <button type="button" className="nut chinh" disabled={consentBusy} onClick={() => void consent(item, true)}>
                      {t("agree")}
                    </button>
                    <button type="button" className="nut phu" disabled={consentBusy} onClick={() => void consent(item, false)}>
                      {t("disagree")}
                    </button>
                  </span>
                </div>
              ))}
              {consentError && <div className="khoi-canh-bao loi">{consentError}</div>}
              {leave.state.kind === "ready" && leave.state.data.balance && (
                <div className="the">
                  <dl className="thong-tin-dong">
                    <dt>{t("annualAvailable")}</dt>
                    <dd>
                      {Number(leave.state.data.balance.available).toLocaleString("vi-VN")}
                      {leave.state.data.balance.years
                        .filter((year) => Number(year.balance) !== 0 && year.expiresOn)
                        .map((year) => ` · ${year.leaveYear}: ${Number(year.balance).toLocaleString("vi-VN")} (${t("until", { date: formatDate(year.expiresOn) })})`)
                        .join("")}
                    </dd>
                    <dt>{t("overtimeThisMonth")}</dt>
                    <dd>{t("overtimeValue", { hours: decimal(overtimeMonthHours) })}</dd>
                  </dl>
                </div>
              )}
              <div className="nhom-nut">
                <button type="button" className="nut phu" onClick={() => setLeaving(true)}>
                  {t("newLeave")}
                </button>
                <button type="button" className="nut phu" onClick={() => setCorrection(vietnamToday())}>
                  {t("newCorrection")}
                </button>
                <button type="button" className="nut phu" onClick={() => setOvertimeOpen(true)}>
                  {t("newOvertime")}
                </button>
                {today.canViewTeam && (
                  <>
                    <Link className="nut phu" href="/attendance">
                      {t("teamAttendance")}
                    </Link>
                    <Link className="nut phu" href="/work-schedules">
                      {t("teamRoster")}
                    </Link>
                    <Link className="nut phu" href="/overtime">
                      {t("teamOvertime")}
                    </Link>
                  </>
                )}
              </div>
              <Tabs labels={[t("tabWeek"), t("tabMonth"), t("tabRequests")]} selected={tab} onSelect={setTab} />
              {tab === 0 && <WeekTab />}
              {tab === 1 && <MonthTab key={today.punches.length} onCorrect={setCorrection} />}
              {tab === 2 && <RequestsTab leave={leave.state.kind === "ready" ? leave.state.data : null} overtime={overtimeItems} onChanged={() => (void leave.reload(), void overtime.reload())} />}
            </>
          )
        }
      </Loaded>
      {leaving && leave.state.kind === "ready" && (
        <LeaveRequestDrawer
          self
          types={leave.state.data.types}
          onClose={() => setLeaving(false)}
          onSaved={() => {
            setLeaving(false);
            setTab(2);
            void leave.reload();
          }}
        />
      )}
      {overtimeOpen && (
        <OvertimeDrawer
          self
          onClose={() => setOvertimeOpen(false)}
          onSaved={() => {
            setOvertimeOpen(false);
            setTab(2);
            void overtime.reload();
          }}
        />
      )}
      {correction && <CorrectionDrawer date={correction} onClose={() => setCorrection(null)} onSaved={() => (setCorrection(null), setTab(2))} />}
    </div>
  );
}

function WeekTab() {
  const t = useTranslations("myAttendance");
  const [weekStart, setWeekStart] = useState(mondayOf(vietnamToday()));
  const { state, reload } = useApi<MyWeekResponse>(`/hr/me/attendance/week?weekStart=${weekStart}`);
  const weekdays = t("weekdaysLong").split(",");
  const move = (days: number) => {
    const value = new Date(`${weekStart}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    setWeekStart(value.toISOString().slice(0, 10));
  };
  return (
    <>
      <div className="bo-loc">
        <button type="button" className="nut phu" aria-label={t("previousWeek")} onClick={() => move(-7)}>
          ‹
        </button>
        <span>{formatDate(weekStart)}</span>
        <button type="button" className="nut phu" aria-label={t("nextWeek")} onClick={() => move(7)}>
          ›
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(week) => (
          <Table
            headings={[t("day"), t("shift"), t("hours")]}
            rows={week.days.map((day) => ({
              key: day.date,
              cells: [
                `${weekdayLabel(day.date, weekdays)} ${formatDate(day.date).slice(0, 5)}`,
                day.holiday ? t("holiday") : (day.shiftCode ?? t("off")),
                day.start ? `${day.start} – ${day.end}` : "—",
              ],
            }))}
          />
        )}
      </Loaded>
    </>
  );
}

function MonthTab({ onCorrect }: { onCorrect: (date: string) => void }) {
  const t = useTranslations("myAttendance");
  const status = useTranslations("attendance");
  const [month, setMonth] = useState(currentMonth(vietnamToday()));
  const { state, reload } = useApi<MyAttendanceMonthResponse>(`/hr/me/attendance/month?month=${month}`);
  const weekdays = t("weekdaysLong").split(",");
  return (
    <>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="thang-cua-toi">
          {t("month")}
        </label>
        <input id="thang-cua-toi" type="month" className="o-nhap" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
      </div>
      <MyTimesheet month={month} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) =>
          data.days.length === 0 ? (
            <MessageView text={t("noDays")} />
          ) : (
            <>
              <div className="the">
                <dl className="thong-tin-dong">
                  <dt>{t("workedUnits")}</dt>
                  <dd>{Number(data.workedUnits).toLocaleString("vi-VN")}</dd>
                  <dt>{t("late")}</dt>
                  <dd>{t("lateValue", { count: data.lateCount, minutes: data.lateMinutes })}</dd>
                </dl>
              </div>
              <Table
                headings={[t("day"), t("shift"), t("inOut"), t("units"), ""]}
                rows={data.days.map((day) => ({
                  key: day.date,
                  cells: [
                    `${weekdayLabel(day.date, weekdays)} ${formatDate(day.date).slice(0, 5)}`,
                    day.shiftCode ?? "—",
                    `${day.firstIn ? vietnamClock(day.firstIn).slice(0, 5) : "—"} – ${day.lastOut ? vietnamClock(day.lastOut).slice(0, 5) : "—"}`,
                    <span className={`nhan ${dayTone(day)}`} title={status(`status_${day.status}`)}>
                      {daySymbol(day)} · {status(`status_${day.status}`)}
                    </span>,
                    day.status === "missing_punch" || day.status === "absent" || day.lateMinutes > 0 || day.earlyMinutes > 0 ? (
                      <button type="button" className="nut chu" onClick={() => onCorrect(day.date)}>
                        {t("explain")}
                      </button>
                    ) : (
                      ""
                    ),
                  ],
                }))}
              />
            </>
          )
        }
      </Loaded>
    </>
  );
}

// Bảng công tháng của tôi: khi nhân sự mở xác nhận thì xác nhận hoặc gửi giải trình; hết hạn hệ thống tự xác nhận.
function MyTimesheet({ month }: { month: string }) {
  const t = useTranslations("myAttendance");
  const { state, reload } = useApi<MyTimesheetResponse>(`/hr/me/timesheets/${month}`);
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.kind !== "ready" || !state.data.line || !state.data.status) return null;
  const sheet = state.data;
  const line = sheet.line!;
  const respond = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/hr/me/timesheets/${month}/${path}`, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      setDisputing(false);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  };
  const label = `${month.slice(5)}/${month.slice(0, 4)}`;
  return (
    <>
      {sheet.status === "confirming" && line.confirmationStatus === "pending" && (
        <div className="khoi-canh-bao thong-tin">{t("timesheetPending", { month: label, date: formatDate(sheet.confirmationDeadline) })}</div>
      )}
      {sheet.status === "confirming" && line.confirmationStatus === "disputed" && <div className="khoi-canh-bao canh-bao">{t("timesheetDisputed")}</div>}
      <div className="tieu-de">
        <h2>
          {t("timesheetTitle", { month: label })} <TimesheetStatusBadge status={sheet.status!} />
        </h2>
      </div>
      {line.disputeReply && <div className="khoi-canh-bao thong-tin">{t("timesheetReply", { reply: line.disputeReply })}</div>}
      <TimesheetSummary line={line} />
      {error && <div className="khoi-canh-bao loi">{error}</div>}
      {sheet.status === "confirming" && line.confirmationStatus === "pending" && (
        <div className="nhom-nut">
          <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void respond("confirm")}>
            {t("confirmTimesheet")}
          </button>
          <button type="button" className="nut phu" disabled={busy} onClick={() => (setDisputing(true), setNote(""))}>
            {t("explain")}
          </button>
        </div>
      )}
      {disputing && (
        <Drawer title={t("disputeTitle", { month: label })} onClose={() => setDisputing(false)}>
          <Field id="giai-trinh-bang-cong" label={t("reason")}>
            <textarea id="giai-trinh-bang-cong" className="o-nhap" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <FormError text={error} />
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setDisputing(false)}>
              {t("cancel")}
            </button>
            <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy || !note.trim()} onClick={() => void respond("dispute", { note })}>
              {t("send")}
            </button>
          </div>
        </Drawer>
      )}
    </>
  );
}

function RequestsTab({ leave, overtime, onChanged }: { leave: MyLeaveResponse | null; overtime: OvertimeItem[]; onChanged: () => void }) {
  const t = useTranslations("myAttendance");
  const leaveText = useTranslations("leave");
  const { state, reload } = useApi<CorrectionItem[]>("/hr/me/attendance/corrections");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<OvertimeItem | null>(null);
  const act = async (id: string, path: string, body?: unknown) => {
    setBusy(id);
    try {
      await apiFetch(path, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      onChanged();
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {leave && leave.requests.length > 0 && (
        <Table
          headings={[t("number"), t("type"), t("time"), t("status"), ""]}
          rows={leave.requests.map((item) => ({
            key: item.id,
            cells: [
              item.requestNo,
              `${leaveText("leaveShort")} · ${item.leaveTypeName}`,
              `${leavePeriod(item, (key) => leaveText(`half_${key}`))} · ${Number(item.days).toLocaleString("vi-VN")} ${leaveText("daysUnit")}`,
              <LeaveStatusBadge status={item.status} />,
              item.canWithdraw ? (
                <button type="button" className="nut chu" disabled={busy !== null} onClick={() => void act(item.id, `/hr/me/leave/requests/${item.id}/withdraw`)}>
                  {t("withdraw")}
                </button>
              ) : item.canCancel ? (
                <button
                  type="button"
                  className="nut chu"
                  disabled={busy !== null}
                  onClick={() => {
                    const reason = window.prompt(leaveText("cancelPrompt"));
                    if (reason) void act(item.id, `/hr/me/leave/requests/${item.id}/cancel`, { reason });
                  }}
                >
                  {leaveText("cancelRequest")}
                </button>
              ) : (
                ""
              ),
            ],
          }))}
        />
      )}
      {overtime.length > 0 && (
        <Table
          headings={[t("number"), t("type"), t("time"), t("status"), ""]}
          rows={overtime.map((item) => ({
            key: item.id,
            cells: [
              item.requestNo,
              t("overtimeShort"),
              `${formatDate(item.workDate)} · ${overtimeTime(item)} · ${t("overtimeValueShort", { hours: decimal(item.countedHours ?? item.hours) })}`,
              <OvertimeStatusBadge status={item.status} />,
              item.canWithdraw ? (
                <button type="button" className="nut chu" disabled={busy !== null} onClick={() => void act(item.id, `/hr/me/overtime/${item.id}/withdraw`)}>
                  {t("withdraw")}
                </button>
              ) : item.canCancel ? (
                <button type="button" className="nut chu" onClick={() => setCancelling(item)}>
                  {t("cancelOvertime")}
                </button>
              ) : (
                ""
              ),
            ],
          }))}
        />
      )}
      {cancelling && <CancelOvertimeDrawer item={cancelling} path={`/hr/me/overtime/${cancelling.id}/cancel`} onClose={() => setCancelling(null)} onDone={() => (setCancelling(null), onChanged())} />}
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            (leave && leave.requests.length > 0) || overtime.length > 0 ? null : (
              <MessageView text={t("noRequests")} />
            )
          ) : (
            <Table
              headings={[t("number"), t("type"), t("time"), t("status"), ""]}
              rows={items.map((item) => ({
                key: item.id,
                cells: [
                  item.correctionNo ?? "—",
                  `${t("correction")} · ${t(`kind_${item.kind}`)}`,
                  `${formatDate(item.workDate)} · ${item.checkIn ?? "—"} → ${item.checkOut ?? "—"}`,
                  <CorrectionStatusBadge status={item.status} />,
                  item.canWithdraw ? (
                    <button
                      type="button"
                      className={`nut chu${busy === item.id ? " dang-xu-ly" : ""}`}
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(item.id);
                        try {
                          await apiFetch(`/hr/me/attendance/corrections/${item.id}/withdraw`, { method: "POST" });
                          await reload();
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {t("withdraw")}
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
    </>
  );
}

function CorrectionDrawer({ date, onClose, onSaved }: { date: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("myAttendance");
  const submit = useSubmit();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (file instanceof File && file.size === 0) form.delete("file");
    void submit.run(async () => {
      await apiUpload("/hr/me/attendance/corrections", form);
      onSaved();
    });
  };
  return (
    <Drawer title={t("newCorrection")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        <Field id="gt-ngay" label={t("day")} error={submit.fields.workDate}>
          <input id="gt-ngay" name="workDate" type="date" className={submit.inputClass("workDate")} defaultValue={date} max={vietnamToday()} />
        </Field>
        <Field id="gt-loai" label={t("type")} error={submit.fields.kind}>
          <select id="gt-loai" name="kind" className="o-nhap">
            {correctionKinds.map((kind: CorrectionKind) => (
              <option key={kind} value={kind}>
                {t(`kind_${kind}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="gt-vao" label={t("checkInLabel")} error={submit.fields.checkIn}>
          <input id="gt-vao" name="checkIn" type="time" className={submit.inputClass("checkIn")} />
        </Field>
        <Field id="gt-ra" label={t("checkOutLabel")} error={submit.fields.checkOut}>
          <input id="gt-ra" name="checkOut" type="time" className={submit.inputClass("checkOut")} />
        </Field>
        <Field id="gt-ly-do" label={t("reason")} error={submit.fields.reason}>
          <textarea id="gt-ly-do" name="reason" rows={3} className={submit.inputClass("reason")} maxLength={1000} />
        </Field>
        <Field id="gt-tep" label={t("attachment")} error={submit.fields.file}>
          <input id="gt-tep" name="file" type="file" className="o-nhap" accept=".pdf,.jpg,.jpeg,.png" />
        </Field>
        <FormError text={submit.formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
            {t("submit")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
