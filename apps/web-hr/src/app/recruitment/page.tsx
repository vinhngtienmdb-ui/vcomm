"use client";

// MAN_HINH_168 Nhu cầu tuyển dụng (CHUC_NANG_190; API_200, API_201): danh sách nhu cầu; thẻ Tin tuyển dụng cho người quản lý tuyển dụng.
import type { JobPostingListResponse, RecruitmentOptionsResponse, RecruitmentRequestListResponse } from "contracts";
import { recruitmentRequestStatuses } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { Pager, postingStatusClass, RequestForm, requestStatusClass, salaryRange, Table } from "@/components/RecruitmentParts";

export default function RecruitmentPage() {
  const t = useTranslations("recruitment");
  const router = useRouter();
  const { can } = useAdmin();
  const canManage = can("hr.recruitment.manage");
  const [tab, setTab] = useState<"requests" | "postings">("requests");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const options = useApi<RecruitmentOptionsResponse>("/hr/recruitment-options");
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search.trim()) parameters.set("search", search.trim());
  if (status) parameters.set("status", status);
  const requests = useApi<RecruitmentRequestListResponse>(tab === "requests" ? `/hr/recruitment-requests?${parameters}` : null);
  const postings = useApi<JobPostingListResponse>(tab === "postings" ? `/hr/job-postings?${parameters}` : null);
  const switchTab = (next: "requests" | "postings") => {
    setTab(next);
    setStatus("");
    setPage(1);
  };
  const requestHeadings = [t("documentNo"), t("jobTitle"), t("department"), t("headcount"), t("hiredCount"), t("salary"), t("neededBy"), t("status")];
  const postingHeadings = [t("postingTitle"), t("request"), t("deadline"), t("isPublicShort"), t("stageSummary"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="recruitment_request" />
        {options.state.kind === "ready" && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("createRequest")}
          </button>
        )}
      </div>
      {canManage && (
        <div className="cac-the" role="tablist">
          {(["requests", "postings"] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => switchTab(value)}>
              {t(`tab_${value}`)}
            </button>
          ))}
        </div>
      )}
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-tuyen-dung">
          {t("searchPlaceholder")}
        </label>
        <input
          id="tim-tuyen-dung"
          className="o-nhap"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="o-nhap"
          aria-label={t("status")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          {(tab === "requests" ? recruitmentRequestStatuses : (["draft", "open", "closed"] as const)).map((value) => (
            <option key={value} value={value}>
              {tab === "requests" ? t(`requestStatus_${value}`) : t(`postingStatus_${value}`)}
            </option>
          ))}
        </select>
      </div>
      {tab === "requests" ? (
        <Loaded state={requests.state} onRetry={() => void requests.reload()}>
          {(result) =>
            result.data.length === 0 ? (
              <MessageView text={t("noRequests")} />
            ) : (
              <>
                <Table
                  headings={requestHeadings}
                  rows={result.data.map((item) => ({
                    key: item.id,
                    cells: [
                      <Link key="so" href={`/recruitment/${item.id}`}>
                        {item.documentNo ?? t("noNumber")}
                      </Link>,
                      item.jobTitle,
                      item.departmentName,
                      item.headcount,
                      item.hiredCount,
                      salaryRange(item.salaryMin, item.salaryMax),
                      formatDate(item.neededBy),
                      <span key="tt" className={`nhan ${requestStatusClass[item.status]}`}>
                        {t(`requestStatus_${item.status}`)}
                      </span>,
                    ],
                  }))}
                />
                <Pager page={page} pageSize={result.pageSize} total={result.total} label={t("totalRequests", { count: result.total })} onPage={setPage} />
              </>
            )
          }
        </Loaded>
      ) : (
        <Loaded state={postings.state} onRetry={() => void postings.reload()}>
          {(result) =>
            result.data.length === 0 ? (
              <MessageView text={t("noPostings")} />
            ) : (
              <>
                <Table
                  headings={postingHeadings}
                  rows={result.data.map((item) => ({
                    key: item.id,
                    cells: [
                      <Link key="tin" href={`/recruitment/postings/${item.id}`}>
                        {item.title}
                      </Link>,
                      item.requestNo ?? "—",
                      formatDate(item.deadline),
                      item.isPublic ? t("yes") : t("no"),
                      `${item.stageCounts.new} · ${item.stageCounts.screening} · ${item.stageCounts.interview} · ${item.stageCounts.offer}`,
                      <span key="tt" className={`nhan ${postingStatusClass[item.status]}`}>
                        {t(`postingStatus_${item.status}`)}
                      </span>,
                    ],
                  }))}
                />
                <Pager page={page} pageSize={result.pageSize} total={result.total} label={t("totalPostings", { count: result.total })} onPage={setPage} />
              </>
            )
          }
        </Loaded>
      )}
      {creating && options.state.kind === "ready" && (
        <RequestForm options={options.state.data} current={null} onClose={() => setCreating(false)} onSaved={(saved) => router.push(`/recruitment/${saved.id}`)} />
      )}
    </>
  );
}
