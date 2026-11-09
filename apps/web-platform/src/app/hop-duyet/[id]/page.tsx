"use client";

// MAN_HINH_08 Chi tiết yêu cầu duyệt (CHUC_NANG_16; API_40, API_41, API_42).
import type { ApprovalRequestResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DecisionDrawer } from "@/components/DecisionDrawer";
import { ConfirmDialog } from "@/components/Dialogs";
import { Loaded } from "@/components/StatusViews";
import { UserShell } from "@/components/UserShell";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { failureOf, useApi } from "@/lib/use-api";

const statusTone = { pending: "canh-bao", approved: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" } as const;

export default function RequestDetailPage() {
  return <UserShell maxWidth={900}>{() => <RequestDetail />}</UserShell>;
}

function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("approvals");
  const locale = useLocale();
  const { state, reload } = useApi<ApprovalRequestResponse>(`/approval-requests/${id}`);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function withdraw() {
    setBusy(true);
    try {
      await apiFetch(`/approval-requests/${id}/withdraw`, { method: "POST" });
      setWithdrawing(false);
      setNotice(t("withdrawn"));
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(request) => (
        <>
          <div className="tieu-de">
            <h1>
              {t("detailTitle", { documentNo: request.documentNo })} <span className={`nhan ${statusTone[request.status]}`}>{t(`status_${request.status}`)}</span>
            </h1>
            {request.canDecide && (
              <>
                <button type="button" className="nut chinh" onClick={() => setDecision("approved")}>
                  {t("approve")}
                </button>
                <button type="button" className="nut nguy-hiem" onClick={() => setDecision("rejected")}>
                  {t("reject")}
                </button>
              </>
            )}
            {request.canWithdraw && (
              <button
                type="button"
                className="nut phu"
                onClick={() => {
                  setError(null);
                  setWithdrawing(true);
                }}
              >
                {t("withdraw")}
              </button>
            )}
          </div>
          {notice && (
            <div className="khoi-canh-bao thong-tin" role="status">
              {notice}
            </div>
          )}
          <div className="the">
            <dl className="thong-tin-dong">
              <dt>{t("documentType")}</dt>
              <dd>{locale === "en" ? request.documentTypeNameEn : request.documentTypeNameVi}</dd>
              <dt>{t("company")}</dt>
              <dd>{request.companyShortName}</dd>
              <dt>{t("amount")}</dt>
              <dd>{formatMoney(request.amount, request.currency)}</dd>
              {request.exchangeRate && (
                <>
                  <dt>{t("rate")}</dt>
                  <dd>{new Intl.NumberFormat("vi-VN").format(Number(request.exchangeRate))}</dd>
                  <dt>{t("converted")}</dt>
                  <dd>{formatMoney(request.amountInPolicyCurrency, request.policyCurrency)}</dd>
                </>
              )}
              <dt>{t("documentDate")}</dt>
              <dd>{formatDate(request.documentDate)}</dd>
              <dt>{t("requestedBy")}</dt>
              <dd>
                {request.requestedByName} · {formatDateTime(request.requestedAt)}
              </dd>
            </dl>
          </div>
          <div className="the">
            <h2>{t("steps")}</h2>
            <ol className="dong-thoi-gian">
              {request.steps.map((step) => {
                const waiting = request.status === "pending" && request.currentLevelNo === step.levelNo;
                const tone = step.decision ? "xong" : waiting ? "cho" : "";
                return (
                  <li key={step.levelNo} className={tone}>
                    <span className="cham">{step.levelNo}</span>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>
                        {t("level", { level: step.levelNo })}: {step.assignedUserName ?? step.assignedRoleName}
                        {step.isSubstitute && <span className="chu-thich"> ({t("substitute")})</span>}
                      </strong>
                      {step.decision ? (
                        <span>
                          <span className={`nhan ${step.decision === "approved" ? "thanh-cong" : "loi"}`}>{t(`status_${step.decision}`)}</span>{" "}
                          {t("decidedBy", { name: step.decidedByName ?? "", time: formatDateTime(step.decidedAt) })}
                        </span>
                      ) : waiting ? (
                        <span>
                          {step.overdue ? <span className="nhan loi">{t("overdue")}</span> : <span className="nhan canh-bao">{t("waiting")}</span>} {t("due")}: {formatDateTime(step.dueAt)}
                        </span>
                      ) : (
                        <span className="chu-thich">{t("notStarted")}</span>
                      )}
                      {step.comment && (
                        <span>
                          {t("comment")}: {step.comment}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          {decision && (
            <DecisionDrawer
              requestId={request.id}
              documentNo={request.documentNo}
              decision={decision}
              onClose={() => setDecision(null)}
              onDone={(text) => {
                setDecision(null);
                setNotice(text);
                void reload();
              }}
            />
          )}
          {withdrawing && <ConfirmDialog title={t("withdraw")} text={t("withdrawConfirm")} confirmLabel={t("withdraw")} busy={busy} error={error} onConfirm={() => void withdraw()} onClose={() => setWithdrawing(false)} />}
        </>
      )}
    </Loaded>
  );
}
