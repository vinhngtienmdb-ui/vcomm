"use client";

// MAN_HINH_120 Ca làm và lịch làm việc (CHUC_NANG_165; API_150): ca, lịch tuần, xếp ca, ngày lễ, cài đặt.
// Người không có quyền xem chấm công của công ty (trưởng phòng) chỉ thấy thẻ Xếp ca của phòng mình.
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Tabs } from "@/components/AttendanceParts";
import { HolidaysTab, LocationsTab, RosterTab, ScheduleTab, SettingsTab, ShiftTab } from "@/components/AttendanceSetup";

export default function AttendanceSetupPage() {
  const t = useTranslations("attendance");
  const { can } = useAdmin();
  const companyView = can("hr.attendance.view") || can("hr.attendance.manage");
  const tabs = companyView
    ? ([
        ["shifts", t("tabShifts")],
        ["schedules", t("tabSchedules")],
        ["roster", t("tabRoster")],
        ["holidays", t("tabHolidays")],
        ["settings", t("tabSettings")],
        ["locations", t("tabLocations")],
      ] as const)
    : ([["roster", t("tabRoster")]] as const);
  const [selected, setSelected] = useState(companyView ? 2 : 0);
  const current = tabs[selected]?.[0] ?? "roster";
  return (
    <>
      <div className="tieu-de">
        <h1>{t("setupTitle")}</h1>
      </div>
      <Tabs labels={tabs.map(([, label]) => label)} selected={selected} onSelect={setSelected} />
      {current === "shifts" && <ShiftTab />}
      {current === "schedules" && <ScheduleTab />}
      {current === "roster" && <RosterTab />}
      {current === "holidays" && <HolidaysTab />}
      {current === "settings" && <SettingsTab />}
      {current === "locations" && <LocationsTab />}
    </>
  );
}
