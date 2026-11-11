"use client";

// MAN_HINH_170 phần người phỏng vấn: danh sách vòng được giao (CONG_VIEC_54; QUYTAC_NGHIEPVU_384; API_202).
import type { MyInterviewItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { Table } from "@/components/RecruitmentParts";

export default function MyInterviewsPage() {
  const t = useTranslations("interviews");
  const { state, reload } = useApi<MyInterviewItem[]>("/hr/my-interviews");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("mineTitle")}</h1>
      </div>
      <div className="khoi-canh-bao thong-tin">{t("mineHint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("mineNone")} />
          ) : (
            <Table
              headings={[t("candidate"), t("posting"), t("name"), t("startsAt"), t("yourEvaluation")]}
              rows={items.map((item) => ({
                key: item.interviewId,
                cells: [
                  <Link key="uv" href={`/interviews/${item.interviewId}`}>
                    {item.candidateName}
                  </Link>,
                  item.postingTitle,
                  item.name,
                  formatDateTime(item.startsAt),
                  <span key="phieu" className={`nhan ${item.submitted ? "thanh-cong" : "canh-bao"}`}>
                    {item.submitted ? t("submitted") : t("notSubmitted")}
                  </span>,
                ],
              }))}
            />
          )
        }
      </Loaded>
    </>
  );
}
