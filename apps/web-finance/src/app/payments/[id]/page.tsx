"use client";

// MAN_HINH_49 Chi tiết phiếu thu, phiếu chi (CHUC_NANG_67; QUYTAC_NGHIEPVU_89): thông tin, chứng từ đã trừ, sửa, gửi, rút, lịch sử.
import type { PaymentResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PaymentEditor } from "@/components/PaymentEditor";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

export default function PaymentPage() {
  const t = useTranslations("payments");
  const errorText = useTranslations("errors");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PaymentResponse>(`/finance/payments/${id}`);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(payment: PaymentResponse, action: "submit" | "withdraw") {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<PaymentResponse>(`/finance/payments/${payment.id}/${action}`, {
        method: "POST",
        body: action === "submit" ? JSON.stringify({ version: payment.version }) : undefined,
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
      <Link href="/payments">‹ {t("back")}</Link>
      <Loaded state={state} onRetry={() => void reload()}>
        {(payment) => {
          const money = (value: string) => formatMoney(value, payment.currency);
          const headings = [t("documentNo"), t("documentDate"), t("dueDate"), t("openAmount"), t("allocated")];
          return editing ? (
            <PaymentEditor
              payment={payment}
              initialKind={payment.kind}
              initialPartner={null}
              onSaved={() => {
                setEditing(false);
                notify(t("saved"));
                void reload();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="tieu-de">
                <h1>
                  {t(`kind_${payment.kind}`)} {payment.documentNo ?? t("draftNo")}
                </h1>
                <PaymentStatusBadge status={payment.status} />
                <HistoryLink entityType="payment" entityId={payment.id} />
                {payment.canEdit && (
                  <button type="button" className="nut phu" onClick={() => setEditing(true)}>
                    {t("edit")}
                  </button>
                )}
                {payment.canWithdraw && (
                  <button type="button" className="nut phu" disabled={busy} onClick={() => void act(payment, "withdraw")}>
                    {t("withdraw")}
                  </button>
                )}
                {payment.canSubmit && (
                  <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act(payment, "submit")}>
                    {t("submit")}
                  </button>
                )}
              </div>
              <FormError text={error} />
              {payment.postError && <div className="khoi-canh-bao loi">{t("postError", { reason: errorText(payment.postError as Parameters<typeof errorText>[0]) })}</div>}
              <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <strong>
                  <Link href={`/debts/${payment.partner.id}?side=${payment.kind.startsWith("customer") ? "receivable" : "payable"}`}>
                    {payment.partner.code} · {payment.partner.name}
                  </Link>
                </strong>
                <div className="thong-tin-dong">
                  <span>
                    {t("fund")}: {payment.fund.code} · {payment.fund.name}
                  </span>
                  <span>
                    {t("paymentDate")}: {formatDate(payment.paymentDate)}
                  </span>
                  <span>
                    {t("createdBy")}: {payment.createdByName}
                  </span>
                  {payment.postedAt && (
                    <span>
                      {t("postedAt")}: {formatDateTime(payment.postedAt)}
                    </span>
                  )}
                </div>
                <strong>
                  {t("amount")}: {money(payment.amount)}
                  {Number(payment.unallocated) > 0 && ` · ${t("remainderAdvance")}: ${money(payment.unallocated)}`}
                </strong>
                {payment.note && <div>{payment.note}</div>}
              </section>
              {payment.lines.length > 0 && (
                <>
                  <h2>{payment.status === "posted" ? t("settled") : t("plannedLines")}</h2>
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
                        {payment.lines.map((line) => (
                          <tr key={line.id}>
                            <td data-nhan={headings[0]}>
                              <span>{line.documentNo || t(`source_${line.sourceType}`)}</span>
                            </td>
                            <td data-nhan={headings[1]}>
                              <span>{formatDate(line.documentDate)}</span>
                            </td>
                            <td data-nhan={headings[2]}>
                              <span>{formatDate(line.dueDate)}</span>
                            </td>
                            <td data-nhan={headings[3]}>
                              <span style={{ whiteSpace: "nowrap" }}>{money(line.openAmount)}</span>
                            </td>
                            <td data-nhan={headings[4]}>
                              <span style={{ whiteSpace: "nowrap" }}>{money(line.allocated)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          );
        }}
      </Loaded>
    </>
  );
}
