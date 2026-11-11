"use client";

// MAN_HINH_119 Hồ sơ của tôi (CHUC_NANG_162; API_149): nhân viên chỉ xem hồ sơ của mình; yêu cầu sửa qua đề xuất của Nền tảng.
import type { MyEmployeeResponse } from "contracts";
import { useTranslations } from "next-intl";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { EmployeeInformation } from "@/components/EmployeeInformation";
import { WorkEventsList } from "@/components/EmployeeTabs";

export default function MyRecordPage() {
  const t = useTranslations("hr");
  const { state, reload } = useApi<MyEmployeeResponse>("/hr/me");
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
            </>
          )}
        </Loaded>
      )}
    </>
  );
}
