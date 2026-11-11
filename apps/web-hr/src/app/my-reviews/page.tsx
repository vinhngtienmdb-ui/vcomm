"use client";

// MAN_HINH_173 Đánh giá của tôi (CHUC_NANG_192; API_205): phiếu của bản thân và phiếu được giao chấm.
import type { MyReviewsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { Table } from "@/components/RecruitmentParts";
import { PhaseBadge } from "@/components/ReviewParts";

export default function MyReviewsPage() {
  const t = useTranslations("reviews");
  const { state, reload } = useApi<MyReviewsResponse>("/hr/my-reviews");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("myTitle")}</h1>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => (
          <>
            <h2>{t("ownHeading")}</h2>
            {data.own.length === 0 ? (
              <MessageView text={t("noOwn")} />
            ) : (
              <Table
                headings={[t("cycle"), t("reviewer"), t("status"), t("score"), t("grade")]}
                rows={data.own.map((item) => ({
                  key: item.id,
                  cells: [
                    <Link key="ky" href={`/my-reviews/${item.id}`}>
                      {item.cycleName}
                    </Link>,
                    item.reviewerName ?? "—",
                    <PhaseBadge key="gd" phase={item.phase} />,
                    item.published ? (item.finalScore ?? "—") : t("notPublished"),
                    item.published ? (item.grade ?? "—") : "—",
                  ],
                }))}
              />
            )}
            <h2>{t("scoringHeading")}</h2>
            {data.scoring.length === 0 ? (
              <MessageView text={t("noScoring")} />
            ) : (
              <Table
                headings={[t("employee"), t("cycle"), t("managerDeadline"), t("status")]}
                rows={data.scoring.map((item) => ({
                  key: item.id,
                  cells: [
                    <Link key="nv" href={`/my-reviews/${item.id}`}>
                      {item.employeeName}
                    </Link>,
                    item.cycleName,
                    formatDate(item.managerDeadline),
                    <PhaseBadge key="gd" phase={item.phase} />,
                  ],
                }))}
              />
            )}
          </>
        )}
      </Loaded>
    </>
  );
}
