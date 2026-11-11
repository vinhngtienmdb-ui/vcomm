"use client";

// MAN_HINH_125 Bảng công tháng (CHUC_NANG_167; API_155; QUYTAC_NGHIEPVU_311): mở xác nhận, trả lời giải trình, chốt, mở lại, xuất Excel.
// Dòng của kỳ đã chốt là đầu vào bảng lương (CONG_VIEC_48).
import type { TimesheetConfirmation, TimesheetLineItem, TimesheetResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/AttendanceParts";
import { decimal } from "@/components/OvertimeParts";
import { TimesheetConfirmationBadge, TimesheetSummary, LateCell, OvertimeCell, TimesheetStatusBadge } from "@/components/TimesheetParts";

const previousMonth = (today: string) => {
  const value = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() - 1);
  return value.toISOString().slice(0, 7);
};

type Dialog = "open" | "close" | "reopen" | null;

export default function TimesheetsPage() {
  const t = useTranslations("timesheets");
  const [month, setMonth] = useState(previousMonth(vietnamToday()));
  const [filter, setFilter] = useState<TimesheetConfirmation | "">("");
  const { state, reload } = useApi<TimesheetResponse>(`/hr/timesheets/${month}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [line, setLine] = useState<TimesheetLineItem | null>(null);
  const [exporting, setExporting] = useState(false);
  return (
    <>
      <div className="tieu-de">
        <h1>
          {t("title", { month: `${month.slice(5)}/${month.slice(0, 4)}` })} {state.kind === "ready" && <TimesheetStatusBadge status={state.data.status} />}
        </h1>
        {state.kind === "ready" && (
          <div className="nhom-nut">
            <button
              type="button"
              className={`nut phu${exporting ? " dang-xu-ly" : ""}`}
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await apiDownload(`/hr/timesheets/${month}/export`, `bang-cong-${month}.xlsx`);
                } finally {
                  setExporting(false);
                }
              }}
            >
              {t("export")}
            </button>
            {state.data.canManage && state.data.monthEnded && state.data.status === "open" && (
              <button type="button" className="nut phu" onClick={() => setDialog("open")}>
                {t("openConfirmation")}
              </button>
            )}
            {state.data.canManage && state.data.monthEnded && state.data.status !== "closed" && (
              <button type="button" className="nut chinh" onClick={() => setDialog("close")}>
                {t("close")}
              </button>
            )}
            {state.data.canManage && state.data.status === "closed" && !state.data.payrollLocked && (
              <button type="button" className="nut phu" onClick={() => setDialog("reopen")}>
                {t("reopen")}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="thang-bang-cong">
          {t("month")}
        </label>
        <input id="thang-bang-cong" type="month" className="o-nhap" value={month} max={vietnamToday().slice(0, 7)} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        <select className="o-nhap" aria-label={t("confirmation")} value={filter} onChange={(event) => setFilter(event.target.value as TimesheetConfirmation | "")}>
          <option value="">{t("confirmationAll")}</option>
          {(["pending", "disputed", "confirmed", "auto_confirmed"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`confirmation_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(sheet) => (
          <>
            <div className="the">
              <dl className="thong-tin-dong">
                <dt>{t("deadline")}</dt>
                <dd>{sheet.confirmationDeadline ? formatDate(sheet.confirmationDeadline) : "—"}</dd>
                <dt>{t("confirmation")}</dt>
                <dd>{t("counts", sheet.counts)}</dd>
                <dt>{t("closedAt")}</dt>
                <dd>{sheet.closedAt ? formatDateTime(sheet.closedAt) : "—"}</dd>
                <dt>{t("payroll")}</dt>
                <dd>{sheet.payrollLocked ? t("payrollLocked") : t("payrollOpen")}</dd>
              </dl>
            </div>
            {!sheet.monthEnded && <div className="khoi-canh-bao thong-tin">{t("notEnded")}</div>}
            {sheet.counts.disputed > 0 && sheet.status !== "closed" && <div className="khoi-canh-bao canh-bao">{t("disputesWarning", { count: sheet.counts.disputed })}</div>}
            {sheet.lines.length === 0 ? (
              <MessageView text={t("empty")} />
            ) : (
              <Table
                headings={[
                  t("employee"),
                  t("standardUnits"),
                  t("workedUnits"),
                  t("holidayUnits"),
                  t("annualLeave"),
                  t("otherPaidLeave"),
                  t("unpaidLeave"),
                  t("socialInsurance"),
                  t("absent"),
                  t("paidUnits"),
                  t("nightHours"),
                  t("overtime"),
                  t("lateEarly"),
                  t("confirmation"),
                ]}
                rows={sheet.lines
                  .filter((item) => !filter || item.confirmationStatus === filter)
                  .map((item) => ({
                    key: item.employeeId,
                    cells: [
                      <>
                        <button type="button" className="nut chu" onClick={() => setLine(item)}>
                          {item.employeeName}
                        </button>
                        <div className="chu-thich">{item.employeeCode}</div>
                      </>,
                      decimal(item.standardUnits),
                      decimal(item.workedUnits),
                      decimal(item.holidayUnits),
                      decimal(item.annualLeaveUnits),
                      decimal(Number(item.paidPersonalLeaveUnits) + Number(item.otherPaidLeaveUnits)),
                      decimal(item.unpaidLeaveUnits),
                      decimal(item.socialInsuranceLeaveUnits),
                      decimal(item.absentUnits),
                      decimal(item.paidUnits),
                      decimal(item.nightHours),
                      <OvertimeCell line={item} />,
                      <LateCell line={item} />,
                      <TimesheetConfirmationBadge status={item.confirmationStatus} />,
                    ],
                  }))}
                footer={t("people", { count: sheet.lines.length })}
              />
            )}
            <span className="chu-thich">{t("closeHint")}</span>
            {dialog === "open" && <OpenDialog month={month} onClose={() => setDialog(null)} onDone={() => (setDialog(null), void reload())} />}
            {dialog === "close" && <CloseDialog month={month} disputed={sheet.counts.disputed} onClose={() => setDialog(null)} onDone={() => (setDialog(null), void reload())} />}
            {dialog === "reopen" && <ReopenDialog month={month} onClose={() => setDialog(null)} onDone={() => (setDialog(null), void reload())} />}
            {line && (
              <LineDrawer
                month={month}
                line={line}
                canReply={sheet.canManage && sheet.status !== "closed"}
                onClose={() => setLine(null)}
                onDone={() => {
                  setLine(null);
                  void reload();
                }}
              />
            )}
          </>
        )}
      </Loaded>
    </>
  );
}

function OpenDialog({ month, onClose, onDone }: { month: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("timesheets");
  const today = vietnamToday();
  const suggested = new Date(`${today}T00:00:00Z`);
  suggested.setUTCDate(suggested.getUTCDate() + 3);
  const [deadline, setDeadline] = useState(suggested.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Drawer title={t("openConfirmation")} onClose={onClose}>
      <p style={{ margin: 0 }}>{t("openText")}</p>
      <Field id="han-xac-nhan" label={t("deadline")}>
        <input id="han-xac-nhan" type="date" className="o-nhap" min={today} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </Field>
      <FormError text={error} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={`nut chinh${busy ? " dang-xu-ly" : ""}`}
          disabled={busy || !deadline}
          onClick={async () => {
            setBusy(true);
            try {
              await apiFetch(`/hr/timesheets/${month}/open-confirmation`, { method: "POST", body: JSON.stringify({ deadline }) });
              onDone();
            } catch (failure) {
              setError(failureOf(failure).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("openConfirmation")}
        </button>
      </div>
    </Drawer>
  );
}

function CloseDialog({ month, disputed, onClose, onDone }: { month: string; disputed: number; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("timesheets");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      title={t("closeTitle", { month: `${month.slice(5)}/${month.slice(0, 4)}` })}
      text={disputed > 0 ? t("disputesWarning", { count: disputed }) : t("closeText")}
      confirmLabel={t("close")}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          await apiFetch(`/hr/timesheets/${month}/close`, { method: "POST" });
          onDone();
        } catch (failure) {
          setError(failureOf(failure).message);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function ReopenDialog({ month, onClose, onDone }: { month: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("timesheets");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Drawer title={t("reopen")} onClose={onClose}>
      <p style={{ margin: 0 }}>{t("reopenText")}</p>
      <Field id="ly-do-mo-lai" label={t("reasonRequired")}>
        <textarea id="ly-do-mo-lai" className="o-nhap" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormError text={error} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`}
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await apiFetch(`/hr/timesheets/${month}/reopen`, { method: "POST", body: JSON.stringify({ reason }) });
              onDone();
            } catch (failure) {
              setError(failureOf(failure).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("reopen")}
        </button>
      </div>
    </Drawer>
  );
}

function LineDrawer({ month, line, canReply, onClose, onDone }: { month: string; line: TimesheetLineItem; canReply: boolean; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("timesheets");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Drawer title={`${line.employeeName} · ${month.slice(5)}/${month.slice(0, 4)}`} onClose={onClose}>
      {line.disputeNote && <div className="khoi-canh-bao loi">{t("disputeNote", { note: line.disputeNote })}</div>}
      {line.disputeReply && <div className="khoi-canh-bao thong-tin">{t("disputeReply", { reply: line.disputeReply })}</div>}
      <TimesheetSummary line={line} />
      {canReply && line.confirmationStatus === "disputed" && (
        <>
          <Field id="tra-loi-giai-trinh" label={t("replyLabel")} hint={t("replyHint")}>
            <textarea id="tra-loi-giai-trinh" className="o-nhap" rows={3} maxLength={1000} value={reply} onChange={(event) => setReply(event.target.value)} />
          </Field>
          <FormError text={error} />
          <div className="nhom-nut">
            <button
              type="button"
              className={`nut chinh${busy ? " dang-xu-ly" : ""}`}
              disabled={busy || !reply.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await apiFetch(`/hr/timesheets/${month}/lines/${line.employeeId}/reply`, { method: "POST", body: JSON.stringify({ reply }) });
                  onDone();
                } catch (failure) {
                  setError(failureOf(failure).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("sendReply")}
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}
