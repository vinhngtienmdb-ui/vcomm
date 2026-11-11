"use client";

// Thành phần bảng công tháng dùng chung MAN_HINH_122, MAN_HINH_125 (CONG_VIEC_47; API_155): nhãn trạng thái, tóm tắt một dòng bảng công.
import type { TimesheetConfirmation, TimesheetLineItem, TimesheetStatus } from "contracts";
import { useTranslations } from "next-intl";
import { formatDate } from "ui/lib/format";
import { decimal } from "@/components/OvertimeParts";

export function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  const t = useTranslations("timesheets");
  const tone = { open: "trung-tinh", confirming: "canh-bao", closed: "thanh-cong" }[status];
  return <span className={`nhan ${tone}`}>{t(`status_${status}`)}</span>;
}

export function TimesheetConfirmationBadge({ status }: { status: TimesheetConfirmation }) {
  const t = useTranslations("timesheets");
  const tone = { pending: "trung-tinh", confirmed: "thanh-cong", disputed: "loi", auto_confirmed: "trung-tinh" }[status];
  return <span className={`nhan ${tone}`}>{t(`confirmation_${status}`)}</span>;
}

const overtimeParts = (line: TimesheetLineItem) =>
  (
    [
      ["weekday", line.overtimeWeekdayHours],
      ["weekdayNight", line.overtimeWeekdayNightHours],
      ["weekdayNightAfterDay", line.overtimeWeekdayNightAfterDayHours],
      ["restDay", line.overtimeRestDayHours],
      ["restDayNight", line.overtimeRestDayNightHours],
      ["holiday", line.overtimeHolidayHours],
      ["holidayNight", line.overtimeHolidayNightHours],
    ] as const
  ).filter(([, value]) => Number(value) > 0);

export function OvertimeCell({ line }: { line: TimesheetLineItem }) {
  const t = useTranslations("timesheets");
  const parts = overtimeParts(line);
  return <>{parts.length === 0 ? "0" : parts.map(([key, value]) => `${t(`overtime_${key}`)} ${decimal(value)}`).join(" · ")}</>;
}

export function LateCell({ line }: { line: TimesheetLineItem }) {
  const t = useTranslations("timesheets");
  const count = line.lateCount + line.earlyLeaveCount;
  return <>{count === 0 ? "0" : t("lateValue", { count, minutes: line.lateMinutes + line.earlyLeaveMinutes })}</>;
}

export function TimesheetSummary({ line }: { line: TimesheetLineItem }) {
  const t = useTranslations("timesheets");
  const partial = line.standardUnits !== line.monthStandardUnits;
  return (
    <div className="the">
      <dl className="thong-tin-dong">
        {partial && (
          <>
            <dt>{t("employment")}</dt>
            <dd>
              {formatDate(line.employmentFrom)} – {formatDate(line.employmentTo)}
            </dd>
          </>
        )}
        <dt>{t("standardUnits")}</dt>
        <dd>
          {decimal(line.standardUnits)} ({t("hoursValue", { hours: decimal(line.standardHours) })})
        </dd>
        <dt>{t("workedUnits")}</dt>
        <dd>
          {decimal(line.workedUnits)} ({t("hoursValue", { hours: decimal(line.workedHours) })})
        </dd>
        <dt>{t("holidayUnits")}</dt>
        <dd>{decimal(line.holidayUnits)}</dd>
        <dt>{t("annualLeave")}</dt>
        <dd>{decimal(line.annualLeaveUnits)}</dd>
        <dt>{t("paidPersonalLeave")}</dt>
        <dd>{decimal(line.paidPersonalLeaveUnits)}</dd>
        <dt>{t("otherPaidLeave")}</dt>
        <dd>{decimal(line.otherPaidLeaveUnits)}</dd>
        <dt>{t("unpaidLeave")}</dt>
        <dd>{decimal(line.unpaidLeaveUnits)}</dd>
        <dt>{t("socialInsurance")}</dt>
        <dd>{decimal(line.socialInsuranceLeaveUnits)}</dd>
        <dt>{t("absent")}</dt>
        <dd>{decimal(line.absentUnits)}</dd>
        <dt>{t("paidUnits")}</dt>
        <dd>
          <strong>{decimal(line.paidUnits)}</strong>
        </dd>
        <dt>{t("nightHours")}</dt>
        <dd>{decimal(line.nightHours)}</dd>
        <dt>{t("overtime")}</dt>
        <dd>
          <OvertimeCell line={line} />
        </dd>
        <dt>{t("late")}</dt>
        <dd>{t("lateValue", { count: line.lateCount, minutes: line.lateMinutes })}</dd>
        <dt>{t("early")}</dt>
        <dd>{t("lateValue", { count: line.earlyLeaveCount, minutes: line.earlyLeaveMinutes })}</dd>
        {Number(line.annualLeavePayoutUnits) > 0 && (
          <>
            <dt>{t("payout")}</dt>
            <dd>{decimal(line.annualLeavePayoutUnits)}</dd>
          </>
        )}
        <dt>{t("balanceEnd")}</dt>
        <dd>{decimal(line.annualLeaveBalanceEnd)}</dd>
        <dt>{t("confirmation")}</dt>
        <dd>
          <TimesheetConfirmationBadge status={line.confirmationStatus} />
        </dd>
      </dl>
    </div>
  );
}
