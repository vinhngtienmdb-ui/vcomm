"use client";

// MAN_HINH_51 Chi tiết bút toán (CHUC_NANG_71, 72): thông tin, dòng Nợ Có, chứng từ gốc; phiếu kế toán: sửa, gửi, rút.
import type { JournalResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { JournalEditor } from "@/components/JournalEditor";
import { JournalStatusBadge } from "@/components/JournalStatusBadge";

export default function JournalPage() {
  const t = useTranslations("ledger");
  const errorText = useTranslations("errors");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<JournalResponse>(`/finance/journals/${id}`);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(journal: JournalResponse, action: "submit" | "withdraw") {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<JournalResponse>(`/finance/journals/${journal.id}/${action}`, {
        method: "POST",
        body: action === "submit" ? JSON.stringify({ version: journal.version }) : undefined,
      });
      notify(action === "withdraw" ? t("withdrawn") : result.status === "posted" ? t("posted") : t("submitted"));
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/journals">‹ {t("backJournals")}</Link>
      <Loaded state={state} onRetry={() => void reload()}>
        {(journal) => {
          const money = (value: string) => (value === "0" ? "" : formatMoney(value, journal.currency));
          const source =
            journal.sourceType === "inventory_document" && journal.sourceId
              ? `/inventory/documents/${journal.sourceId}`
              : journal.sourceType === "payment" && journal.sourceId
                ? `/finance/payments/${journal.sourceId}`
                : null;
          const headings = [t("account"), t("partner"), t("lineDescription"), t("debit"), t("credit")];
          return editing ? (
            <JournalEditor
              journal={journal}
              onSaved={() => {
                setEditing(false);
                notify(t("journalSaved"));
                void reload();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="tieu-de">
                <h1>
                  {t(`source_${journal.sourceType}`)} {journal.journalNo || t("draftNo")}
                </h1>
                <JournalStatusBadge status={journal.status} />
                <HistoryLink entityType="journal" entityId={journal.id} />
                {journal.canEdit && (
                  <button type="button" className="nut phu" onClick={() => setEditing(true)}>
                    {t("edit")}
                  </button>
                )}
                {journal.canWithdraw && (
                  <button type="button" className="nut phu" disabled={busy} onClick={() => void act(journal, "withdraw")}>
                    {t("withdraw")}
                  </button>
                )}
                {journal.canSubmit && (
                  <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act(journal, "submit")}>
                    {t("submit")}
                  </button>
                )}
              </div>
              <FormError text={error} />
              {journal.postError && <div className="khoi-canh-bao loi">{t("postError", { reason: errorText(journal.postError as Parameters<typeof errorText>[0]) })}</div>}
              <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <strong>{journal.description}</strong>
                <div className="thong-tin-dong">
                  <span>
                    {t("journalDate")}: {formatDate(journal.journalDate)}
                  </span>
                  <span>
                    {t("amount")}: {formatMoney(journal.totalAmount, journal.currency)}
                  </span>
                  {journal.createdByName && (
                    <span>
                      {t("createdBy")}: {journal.createdByName}
                    </span>
                  )}
                  {source && <a href={source}>{t("openSource")}</a>}
                </div>
              </section>
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
                    {journal.lines.map((line) => (
                      <tr key={line.lineNo}>
                        <td data-nhan={headings[0]}>
                          <span>
                            {line.accountCode} · {line.accountName}
                          </span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{line.partnerName ?? ""}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{line.description ?? ""}</span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span style={{ whiteSpace: "nowrap" }}>{money(line.debit)}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span style={{ whiteSpace: "nowrap" }}>{money(line.credit)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </Loaded>
    </>
  );
}
