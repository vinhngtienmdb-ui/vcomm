"use client";

// MAN_HINH_119 Hồ sơ của tôi (CHUC_NANG_162; API_149): nhân viên chỉ xem hồ sơ của mình; yêu cầu sửa qua đề xuất của Nền tảng.
// Thẻ "Phiếu lương" (MAN_HINH_130, CONG_VIEC_48); thông báo phiếu lương mở thẳng thẻ này (?tab=payslips).
import type { MyContractsResponse, MyEmployeeResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { MyContracts } from "@/components/EmployeeContracts";
import { EmployeeInformation } from "@/components/EmployeeInformation";
import { MyPayslips } from "@/components/MyPayslips";
import { WorkEventsList } from "@/components/EmployeeTabs";

export default function MyRecordPage() {
  const t = useTranslations("hr");
  const contractText = useTranslations("contracts");
  const { state, reload } = useApi<MyEmployeeResponse>("/hr/me");
  const contracts = useApi<MyContractsResponse>(state.kind === "ready" ? "/hr/me/contracts" : null);
  const payrollText = useTranslations("payroll");
  const [tab, setTab] = useState<"record" | "payslips">("record");
  // Mở thẳng thẻ phiếu lương từ thông báo; đọc sau khi gắn trang để không lệch với bản dựng sẵn.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "payslips") setTab("payslips");
  }, []);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("me")}</h1>
        {/* Thẻ a thường: trang lập đề xuất thuộc mini app Nền tảng. */}
        <a className="nut phu" href="/de-xuat">
          {t("requestChange")}
        </a>
      </div>
      {state.kind === "notFound" ? (
        <MessageView text={t("meNone")} />
      ) : (
        <Loaded state={state} onRetry={() => void reload()}>
          {(mine) => (
            <>
              <div className="cac-the" role="tablist">
                {(["record", "payslips"] as const).map((value) => (
                  <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => setTab(value)}>
                    {value === "record" ? t("me") : payrollText("payslips")}
                  </button>
                ))}
              </div>
              {tab === "payslips" && <MyPayslips />}
              {tab === "record" && (
                <>
                  <div className="khoi-canh-bao thong-tin">{t("meNotice")}</div>
                  <div className="the">
                    <dl className="thong-tin-dong">
                      <dt>{t("code")}</dt>
                      <dd>{mine.employee.code}</dd>
                      <dt>{t("fullName")}</dt>
                      <dd>{mine.employee.fullName}</dd>
                      <dt>{t("position")}</dt>
                      <dd>{[mine.employee.jobTitle, mine.employee.departmentName, mine.employee.branchName].filter(Boolean).join(" · ") || "—"}</dd>
                    </dl>
                  </div>
                  <EmployeeInformation employee={mine.employee} revealPath="/hr/me/reveal" allowReveal />
                  <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                    <h2>{t("workEvents")}</h2>
                    <WorkEventsList events={mine.workEvents} />
                  </div>
                  <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                    <h2>{contractText("mine")}</h2>
                    <Loaded state={contracts.state} onRetry={() => void contracts.reload()}>
                      {(own) => <MyContracts contracts={own.contracts} currency={own.currency} />}
                    </Loaded>
                  </div>
                </>
              )}
            </>
          )}
        </Loaded>
      )}
    </>
  );
}
