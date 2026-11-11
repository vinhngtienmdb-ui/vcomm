"use client";

// MAN_HINH_116 Chi tiết hồ sơ (CHUC_NANG_162; API_144 đến API_146): thông tin (số giấy tờ che, nút "Hiện"), giấy tờ, người phụ thuộc, quá trình công tác.
// Thẻ "Lương, thuế" (MAN_HINH_129, CONG_VIEC_48) cho người có quyền quản lý bảng lương.
import type { EmployeeResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DependentsTab, DocumentsTab, WorkEventsTab } from "@/components/EmployeeTabs";
import { useAdmin } from "ui/components/AppShell";
import { TerminateDrawer } from "@/components/ContractParts";
import { EmployeeContractsTab } from "@/components/EmployeeContracts";
import { EmployeeInformation } from "@/components/EmployeeInformation";
import { PayrollProfileTab } from "@/components/PayrollProfileTab";

const tabs = ["info", "documents", "dependents", "work", "contracts", "payroll"] as const;

export default function EmployeeDetailPage() {
  const t = useTranslations("hr");
  const contractText = useTranslations("contracts");
  const payrollText = useTranslations("payroll");
  const { can, notify } = useAdmin();
  const [terminating, setTerminating] = useState(false);
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<EmployeeResponse>(`/hr/employees/${id}`);
  const [tab, setTab] = useState<(typeof tabs)[number]>("info");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(employee) => (
        <>
          <div className="tieu-de">
            <h1>
              {employee.code} · {employee.fullName} <span className={`nhan ${employee.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${employee.status}`)}</span>
            </h1>
            {employee.canManage && (
              <Link className="nut phu" href={`/employees/${employee.id}/edit`}>
                {t("edit")}
              </Link>
            )}
            {employee.canManage && !employee.terminationDate && (
              <button type="button" className="nut nguy-hiem" onClick={() => setTerminating(true)}>
                {contractText("terminateEmployee")}
              </button>
            )}
            <HistoryLink entityType="employee" entityId={employee.id} />
          </div>
          {employee.terminationDate && employee.status === "active" && (
            <div className="khoi-canh-bao canh-bao">{contractText("terminationScheduled", { date: formatDate(employee.terminationDate) })}</div>
          )}
          <div className="the">
            <dl className="thong-tin-dong">
              <dt>{t("position")}</dt>
              <dd>{[employee.jobTitle, employee.departmentName, employee.branchName].filter(Boolean).join(" · ") || "—"}</dd>
              <dt>{t("hireDate")}</dt>
              <dd>{formatDate(employee.hireDate)}</dd>
              <dt>{t("account")}</dt>
              <dd>{employee.userEmail ?? t("noAccount")}</dd>
            </dl>
          </div>
          {employee.isMinor && <div className="khoi-canh-bao thong-tin">{t("minorWarning")}</div>}
          <div className="cac-the" role="tablist">
            {tabs
              .filter((value) => value !== "payroll" || can("hr.payroll.manage"))
              .map((value) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => setTab(value)}>
                  {value === "contracts" ? contractText("employeeTab") : value === "payroll" ? payrollText("employeeTab") : t(`tab_${value}`)}
                </button>
              ))}
          </div>
          {tab === "info" && <EmployeeInformation employee={employee} revealPath={`/hr/employees/${employee.id}/reveal`} allowReveal={employee.canViewIdentity} />}
          {tab === "documents" && <DocumentsTab employee={employee} onChanged={() => void reload()} />}
          {tab === "dependents" && <DependentsTab employee={employee} />}
          {tab === "work" && <WorkEventsTab employee={employee} onChanged={() => void reload()} />}
          {tab === "contracts" && <EmployeeContractsTab employeeId={employee.id} canCreate={can("hr.contract.manage") && employee.status === "active" && !employee.terminationDate} />}
          {tab === "payroll" && can("hr.payroll.manage") && <PayrollProfileTab employeeId={employee.id} />}
          {terminating && (
            <TerminateDrawer
              path={`/hr/employees/${employee.id}/terminate`}
              title={contractText("terminateEmployeeTitle")}
              warning={contractText("terminateEmployeeWarning")}
              label={contractText("terminateEmployee")}
              onClose={() => setTerminating(false)}
              onDone={() => {
                setTerminating(false);
                notify(contractText("terminateEmployeeDone"));
                void reload();
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
