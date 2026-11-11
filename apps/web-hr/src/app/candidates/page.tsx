"use client";

// MAN_HINH_170 Ứng viên (CHUC_NANG_191; API_202): thẻ tất cả, kho ứng viên, sắp đến hạn xóa; tìm; thêm ứng viên; cài đặt lưu giữ.
import type { CandidateListResponse, RecruitmentOptionsResponse, RecruitmentSettings } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { CandidateForm, CandidateLink, Pager, StageBadge, Table } from "@/components/RecruitmentParts";

const tabs = ["all", "pool", "due"] as const;
const daysUntil = (day: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${vietnamToday()}T00:00:00Z`)) / 86_400_000);

export default function CandidatesPage() {
  const t = useTranslations("candidates");
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<"create" | "settings" | null>(null);
  const options = useApi<RecruitmentOptionsResponse>("/hr/recruitment-options");
  const parameters = new URLSearchParams({ tab, page: String(page), pageSize: "20" });
  if (search.trim()) parameters.set("search", search.trim());
  const { state, reload } = useApi<CandidateListResponse>(`/hr/candidates?${parameters}`);
  const headings = [t("fullName"), t("email"), t("phone"), t("latestPosting"), t("stage"), t("eraseDue")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="candidate" />
        <button type="button" className="nut phu" onClick={() => setDrawer("settings")}>
          {t("settings")}
        </button>
        {options.state.kind === "ready" && options.state.data.openPostings.length > 0 && (
          <button type="button" className="nut chinh" onClick={() => setDrawer("create")}>
            {t("create")}
          </button>
        )}
      </div>
      <div className="cac-the" role="tablist">
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "chon" : ""}
            onClick={() => {
              setTab(value);
              setPage(1);
            }}
          >
            {t(`tab_${value}`)}
          </button>
        ))}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-ung-vien">
          {t("searchPlaceholder")}
        </label>
        <input
          id="tim-ung-vien"
          className="o-nhap"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {tab === "due" && <div className="khoi-canh-bao thong-tin">{t("dueHint")}</div>}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <>
              <Table
                headings={headings}
                rows={result.data.map((item) => ({
                  key: item.id,
                  cells: [
                    <span key="ten" className="nhom-nut">
                      <CandidateLink id={item.id} name={item.fullName} />
                      {item.possibleDuplicate && <span className="nhan canh-bao">{t("possibleDuplicate")}</span>}
                      {item.poolUntil && item.poolUntil >= vietnamToday() && <span className="nhan thong-tin">{t("poolUntil", { date: formatDate(item.poolUntil) })}</span>}
                    </span>,
                    item.email ?? "—",
                    item.phone ?? "—",
                    item.latestPostingTitle ?? "—",
                    item.latestStage ? <StageBadge key="gd" application={{ stage: item.latestStage, outcome: item.latestOutcome }} /> : "—",
                    item.eraseDue ? (
                      <span key="xoa" className="nhom-nut">
                        {formatDate(item.eraseDue)}
                        {daysUntil(item.eraseDue) <= 7 && <span className="nhan loi">{t("daysLeft", { count: Math.max(daysUntil(item.eraseDue), 0) })}</span>}
                      </span>
                    ) : (
                      "—"
                    ),
                  ],
                }))}
              />
              <Pager page={page} pageSize={result.pageSize} total={result.total} label={t("total", { count: result.total })} onPage={setPage} />
            </>
          )
        }
      </Loaded>
      {drawer === "create" && options.state.kind === "ready" && (
        <CandidateForm options={options.state.data} postingId={null} onClose={() => setDrawer(null)} onSaved={(candidateId) => router.push(`/candidates/${candidateId}`)} />
      )}
      {drawer === "settings" && (
        <SettingsDrawer
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            void reload();
          }}
        />
      )}
    </>
  );
}

// Cài đặt lưu giữ dữ liệu ứng viên của công ty (QUYTAC_NGHIEPVU_388).
function SettingsDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations("candidates");
  const { state, reload } = useApi<RecruitmentSettings>("/hr/candidates/settings");
  return (
    <Drawer title={t("settings")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(current) => <SettingsForm current={current} onClose={onClose} onDone={onDone} />}
      </Loaded>
    </Drawer>
  );
}

function SettingsForm({ current, onClose, onDone }: { current: RecruitmentSettings; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("candidates");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState({ rejectedRetentionDays: String(current.rejectedRetentionDays), poolRetentionMonths: String(current.poolRetentionMonths) });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/hr/candidates/settings", { method: "PUT", body: JSON.stringify(values) });
      notify(common("saved"));
      onDone();
    });
  };
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
      <FormError text={formError} />
      <Field id="giu-ngay" label={t("rejectedRetentionDays")} error={fields.rejectedRetentionDays}>
        <input
          id="giu-ngay"
          type="number"
          min={0}
          max={90}
          className={inputClass("rejectedRetentionDays")}
          value={values.rejectedRetentionDays}
          onChange={(event) => setValues({ ...values, rejectedRetentionDays: event.target.value })}
        />
      </Field>
      <Field id="giu-thang" label={t("poolRetentionMonths")} error={fields.poolRetentionMonths}>
        <input
          id="giu-thang"
          type="number"
          min={1}
          max={24}
          className={inputClass("poolRetentionMonths")}
          value={values.poolRetentionMonths}
          onChange={(event) => setValues({ ...values, poolRetentionMonths: event.target.value })}
        />
      </Field>
      <div className="khoi-canh-bao canh-bao">{t("retentionLaw")}</div>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {common("save")}
        </button>
      </div>
    </form>
  );
}
