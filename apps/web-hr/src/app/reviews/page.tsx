"use client";

// MAN_HINH_172 Quản lý đánh giá hiệu suất (CHUC_NANG_192; API_205): thẻ Kỳ đánh giá, Mẫu đánh giá.
import type { ReviewCycleItem, ReviewTemplateResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/RecruitmentParts";
import { CycleForm, cycleStatusClass, TemplateForm } from "@/components/ReviewParts";

export default function ReviewsPage() {
  const t = useTranslations("reviews");
  const router = useRouter();
  const { notify } = useAdmin();
  const [tab, setTab] = useState<"cycles" | "templates">("cycles");
  const [drawer, setDrawer] = useState<{ kind: "cycle" } | { kind: "template"; template: ReviewTemplateResponse | null } | null>(null);
  const cycles = useApi<ReviewCycleItem[]>(tab === "cycles" ? "/hr/review-cycles" : null);
  const templates = useApi<ReviewTemplateResponse[]>(tab === "templates" ? "/hr/review-templates" : null);
  const copy = async (id: string) => {
    try {
      await apiFetch(`/hr/review-templates/${id}/copy`, { method: "POST" });
      notify(t("copied"));
      await templates.reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="review_cycle" />
        <button type="button" className="nut chinh" onClick={() => setDrawer(tab === "cycles" ? { kind: "cycle" } : { kind: "template", template: null })}>
          {tab === "cycles" ? t("createCycle") : t("createTemplate")}
        </button>
      </div>
      <div className="cac-the" role="tablist">
        {(["cycles", "templates"] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => setTab(value)}>
            {t(`tab_${value}`)}
          </button>
        ))}
      </div>
      {tab === "cycles" ? (
        <Loaded state={cycles.state} onRetry={() => void cycles.reload()}>
          {(items) =>
            items.length === 0 ? (
              <MessageView text={t("noCycles")} />
            ) : (
              <Table
                headings={[t("cycle"), t("period"), t("template"), t("weights"), t("progress"), t("status")]}
                rows={items.map((item) => ({
                  key: item.id,
                  cells: [
                    <Link key="ky" href={`/reviews/${item.id}`}>
                      {item.name}
                    </Link>,
                    `${formatDate(item.periodFrom)} – ${formatDate(item.periodTo)}`,
                    item.templateName,
                    t("weightsValue", { goal: item.goalWeight, competency: item.competencyWeight }),
                    t("progressValue", { submitted: item.submittedCount, total: item.reviewCount }),
                    <span key="tt" className={`nhan ${cycleStatusClass[item.status]}`}>
                      {t(`cycleStatus_${item.status}`)}
                    </span>,
                  ],
                }))}
              />
            )
          }
        </Loaded>
      ) : (
        <Loaded state={templates.state} onRetry={() => void templates.reload()}>
          {(items) =>
            items.length === 0 ? (
              <MessageView text={t("noTemplates")} />
            ) : (
              <Table
                headings={[t("templateName"), t("criteriaCount"), t("used"), ""]}
                rows={items.map((item) => ({
                  key: item.id,
                  cells: [
                    item.name,
                    item.criteria.length,
                    item.usedInCycles ? t("usedValue", { count: item.usedInCycles }) : t("notUsed"),
                    <span key="nut" className="nhom-nut">
                      {item.usedInCycles === 0 && (
                        <button type="button" className="nut phu" onClick={() => setDrawer({ kind: "template", template: item })}>
                          {t("edit")}
                        </button>
                      )}
                      <button type="button" className="nut phu" onClick={() => void copy(item.id)}>
                        {t("copy")}
                      </button>
                    </span>,
                  ],
                }))}
              />
            )
          }
        </Loaded>
      )}
      {drawer?.kind === "cycle" && <CycleForm cycle={null} onClose={() => setDrawer(null)} onSaved={(id) => router.push(`/reviews/${id}`)} />}
      {drawer?.kind === "template" && (
        <TemplateForm
          template={drawer.template}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            void templates.reload();
          }}
        />
      )}
    </>
  );
}
