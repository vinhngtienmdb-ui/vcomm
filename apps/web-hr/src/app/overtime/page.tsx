"use client";

// MAN_HINH_124 Tăng ca (CHUC_NANG_167; API_154; QUYTAC_NGHIEPVU_310): thẻ Phiếu tăng ca, Tổng giờ theo nhân viên. Nhân sự xem cả công ty, trưởng phòng xem phòng mình.
import type { AttendanceGridResponse, OvertimeItem, OvertimeTotalItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { Table, Tabs } from "@/components/AttendanceParts";
import { CancelOvertimeDrawer, OvertimeDrawer, OvertimeStatusBadge, decimal, overtimeTime } from "@/components/OvertimeParts";

const statuses = ["awaiting_consent", "declined", "pending", "approved", "rejected", "withdrawn", "cancelled"] as const;

export default function OvertimePage() {
  const t = useTranslations("overtime");
  const { can } = useAdmin();
  const manage = can("hr.attendance.manage");
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(vietnamToday().slice(0, 7));
  const [status, setStatus] = useState("");
  const parameters = new URLSearchParams({ month });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<OvertimeItem[]>(`/hr/overtime?${parameters}`);
  const employees = useApi<AttendanceGridResponse>(`/hr/attendance/grid?month=${month}`);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<OvertimeItem | null>(null);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {state.kind === "ready" && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("newTitle")}
          </button>
        )}
      </div>
      <Tabs labels={[t("tabRequests"), t("tabTotals")]} selected={tab} onSelect={setTab} />
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="thang-tang-ca">
          {t("month")}
        </label>
        <input id="thang-tang-ca" type="month" className="o-nhap" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        {tab === 0 && (
          <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t("statusAll")}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {t(`status_${value}`)}
              </option>
            ))}
          </select>
        )}
      </div>
      {tab === 0 && (
        <Loaded state={state} onRetry={() => void reload()}>
          {(items) =>
            items.length === 0 ? (
              <MessageView text={t("noRequests")} />
            ) : (
              <Table
                headings={[t("number"), t("employee"), t("workDate"), t("time"), t("dayKind"), t("hours"), t("countedHours"), t("status"), ""]}
                rows={items.map((item) => ({
                  key: item.id,
                  cells: [
                    item.requestNo,
                    item.employeeName,
                    formatDate(item.workDate),
                    overtimeTime(item),
                    t(`dayKind_${item.dayKind}`),
                    decimal(item.hours),
                    item.countedHours === null ? "—" : decimal(item.countedHours),
                    <>
                      <OvertimeStatusBadge status={item.status} /> {item.consentStatus === "document" && <span className="chu-thich">{t("byDocument")}</span>}
                    </>,
                    item.canCancel ? (
                      <button type="button" className="nut chu" onClick={() => setCancelling(item)}>
                        {t("cancelRequest")}
                      </button>
                    ) : (
                      ""
                    ),
                  ],
                }))}
                footer={t("count", { count: items.length })}
              />
            )
          }
        </Loaded>
      )}
      {tab === 1 && <TotalsTab month={month} />}
      {creating && employees.state.kind === "ready" && (
        <OvertimeDrawer
          self={false}
          withDocument={manage}
          employees={employees.state.data.rows.map((row) => ({ id: row.employeeId, label: `${row.code} · ${row.fullName}` }))}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}
      {cancelling && <CancelOvertimeDrawer item={cancelling} path={`/hr/overtime/${cancelling.id}/cancel`} onClose={() => setCancelling(null)} onDone={() => (setCancelling(null), void reload())} />}
    </>
  );
}

function TotalsTab({ month }: { month: string }) {
  const t = useTranslations("overtime");
  const { state, reload } = useApi<OvertimeTotalItem[]>(`/hr/overtime/totals?month=${month}`);
  const warn = (remaining: string, limit: number) => <span className={Number(remaining) <= limit * 0.1 ? "nhan canh-bao" : ""}>{decimal(remaining)}</span>;
  return (
    <>
      <span className="chu-thich">{t("totalsHint")}</span>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("noTotals")} />
          ) : (
            <Table
              headings={[t("employee"), t("monthHours"), t("monthRemaining"), t("yearHours"), t("yearRemaining")]}
              rows={items.map((item) => ({
                key: item.employeeId,
                cells: [`${item.code} · ${item.fullName}`, decimal(item.monthHours), warn(item.monthRemaining, 40), decimal(item.yearHours), warn(item.yearRemaining, 200)],
              }))}
            />
          )
        }
      </Loaded>
    </>
  );
}
