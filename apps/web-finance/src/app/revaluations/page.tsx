"use client";

// MAN_HINH_182 Đánh giá lại ngoại tệ (CONG_VIEC_56; CHUC_NANG_198; API_216): danh sách chứng từ, lập chứng từ tại ngày cuối tháng.
import type { FxRevaluationListItem, FxRevaluationResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

// Ngày cuối tháng của một ngày dạng YYYY-MM-DD.
const monthEnd = (date: string) => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);

export default function RevaluationsPage() {
  const t = useTranslations("revaluations");
  const router = useRouter();
  const { can } = useAdmin();
  const { state, reload } = useApi<FxRevaluationListItem[]>("/finance/revaluations");
  const [creating, setCreating] = useState(false);
  const [revaluationDate, setRevaluationDate] = useState(monthEnd(vietnamToday()));
  const [note, setNote] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const headings = [t("documentNo"), t("revaluationDate"), t("lineCount"), t("gain"), t("loss"), t("net"), t("status")];
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await apiFetch<FxRevaluationResponse>("/finance/revaluations", { method: "POST", body: JSON.stringify({ revaluationDate, note }) });
      router.push(`/revaluations/${created.id}`);
    });
  }
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="fx_revaluation" />
        {can("finance.journal.manage") && !creating && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("create")}
          </button>
        )}
      </div>
      {creating && (
        <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
            <Field id="ngay-danh-gia" label={`${t("revaluationDate")} *`} hint={t("revaluationDateHint")} error={fields.revaluationDate}>
              <input id="ngay-danh-gia" type="date" className={inputClass("revaluationDate")} value={revaluationDate} onChange={(event) => setRevaluationDate(event.target.value)} />
            </Field>
            <Field id="noi-dung-danh-gia" label={t("note")} error={fields.note}>
              <input id="noi-dung-danh-gia" className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
          <FormError text={formError} />
          <div className="nhom-nut">
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
              {t("create")}
            </button>
            <button type="button" className="nut phu" onClick={() => setCreating(false)}>
              {t("close")}
            </button>
          </div>
        </form>
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/revaluations/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{formatDate(item.revaluationDate)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.lineCount}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatNumber(item.gain)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatNumber(item.loss)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatNumber(item.net)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className={`nhan ${item.status === "posted" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${item.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}
