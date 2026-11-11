"use client";

// MAN_HINH_116 Chi tiết hồ sơ (CHUC_NANG_162; API_144 đến API_146): thông tin (số giấy tờ che, nút "Hiện"), giấy tờ, người phụ thuộc, quá trình công tác.
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
import { EmployeeInformation } from "@/components/EmployeeInformation";

const tabs = ["info", "documents", "dependents", "work"] as const;

export default function EmployeeDetailPage() {
  const t = useTranslations("hr");
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
            <HistoryLink entityType="employee" entityId={employee.id} />
          </div>
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
            {tabs.map((value) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => setTab(value)}>
                {t(`tab_${value}`)}
              </button>
            ))}
          </div>
          {tab === "info" && <EmployeeInformation employee={employee} revealPath={`/hr/employees/${employee.id}/reveal`} allowReveal={employee.canViewIdentity} />}
          {tab === "documents" && <DocumentsTab employee={employee} onChanged={() => void reload()} />}
          {tab === "dependents" && <DependentsTab employee={employee} />}
          {tab === "work" && <WorkEventsTab employee={employee} onChanged={() => void reload()} />}
        </>
      )}
    </Loaded>
  );
}
