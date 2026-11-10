"use client";

// Xử lý giao dịch ngân hàng (CHUC_NANG_86; QUYTAC_NGHIEPVU_116, 117; API_100): lập phiếu thu từ gợi ý, ghép tay, bỏ qua, bỏ ghép.
import type { BankPaymentCandidate, BankTransactionItem, FinancePartnerOption } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PartnerPicker } from "./PartnerPicker";

type Action = "receipt" | "match" | "ignore" | "reopen";

export function BankTransactionActions({ item, onChanged }: { item: BankTransactionItem; onChanged: () => void }) {
  const t = useTranslations("bankTransactions");
  const [action, setAction] = useState<Action | null>(null);
  const done = () => (setAction(null), onChanged());
  const receiptBusy = item.receipt?.status === "pending";
  return (
    <>
      <span className="nhom-nut">
        {item.status === "unmatched" ? (
          <>
            {item.direction === "in" && !receiptBusy && (
              <button type="button" className="nut phu" onClick={() => setAction("receipt")}>
                {t("createReceipt")}
              </button>
            )}
            <button type="button" className="nut phu" onClick={() => setAction("match")}>
              {t("matchManually")}
            </button>
            {!receiptBusy && (
              <button type="button" className="nut phu" onClick={() => setAction("ignore")}>
                {t("ignore")}
              </button>
            )}
          </>
        ) : (
          <button type="button" className="nut phu" onClick={() => setAction("reopen")}>
            {item.status === "matched" ? t("unmatch") : t("unignore")}
          </button>
        )}
      </span>
      {action === "receipt" && <ReceiptDrawer item={item} onClose={() => setAction(null)} onDone={done} />}
      {action === "match" && <MatchDrawer item={item} onClose={() => setAction(null)} onDone={done} />}
      {action === "ignore" && <IgnoreDrawer item={item} onClose={() => setAction(null)} onDone={done} />}
      {action === "reopen" && <ReopenDialog item={item} onClose={() => setAction(null)} onDone={done} />}
    </>
  );
}

function Summary({ item }: { item: BankTransactionItem }) {
  const t = useTranslations("bankTransactions");
  return (
    <div className="khoi-canh-bao thong-tin">
      <strong>
        {t(`direction_${item.direction}`)} {formatNumber(item.amount)}
      </strong>{" "}
      · {formatDate(item.transactionDate)}
      <div className="chu-thich">{item.content || "—"}</div>
    </div>
  );
}

function ReceiptDrawer({ item, onClose, onDone }: { item: BankTransactionItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("bankTransactions");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [partner, setPartner] = useState<FinancePartnerOption | null>(item.suggestion ? { id: item.suggestion.partnerId, code: "", name: item.suggestion.partnerName } : null);
  const { submitting, fields, formError, run } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!partner) return;
    void run(async () => {
      const result = await apiFetch<BankTransactionItem>(`/finance/bank-transactions/${item.id}/confirm-receipt`, {
        method: "POST",
        body: JSON.stringify({ partnerId: partner.id, version: item.version }),
      });
      notify(result.status === "matched" ? t("receiptPosted", { document: result.payment?.documentNo ?? "" }) : t("receiptPending", { document: result.receipt?.documentNo ?? "" }));
      onDone();
    });
  }
  return (
    <Drawer title={t("createReceipt")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Summary item={item} />
        {item.suggestion && (
          <p className="chu-thich" style={{ margin: 0 }}>
            {t("suggestedBy", { reason: t(`reason_${item.suggestion.reason}`) })}
          </p>
        )}
        <Field id="pt-khach" label={t("customer")} error={fields.partnerId}>
          <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
            {partner && (
              <strong>
                {partner.name}
                {partner.code && <span className="chu-thich"> · {partner.code}</span>}
              </strong>
            )}
            <PartnerPicker id="pt-khach" side="receivable" onPick={setPartner} />
          </div>
        </Field>
        <p className="chu-thich" style={{ margin: 0 }}>
          {t("receiptHint")}
        </p>
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh" disabled={submitting || !partner}>
            {t("confirmReceipt")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function MatchDrawer({ item, onClose, onDone }: { item: BankTransactionItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("bankTransactions");
  const payments = useTranslations("payments");
  const { notify } = useAdmin();
  const { state, reload } = useApi<BankPaymentCandidate[]>(`/finance/bank-transactions/${item.id}/candidates`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function match(candidate: BankPaymentCandidate) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/finance/bank-transactions/${item.id}/match`, { method: "POST", body: JSON.stringify({ paymentId: candidate.id, version: item.version }) });
      notify(t("matched", { document: candidate.documentNo ?? "" }));
      onDone();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer title={t("matchManually")} onClose={onClose}>
      <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Summary item={item} />
        <FormError text={error} />
        <Loaded state={state} onRetry={() => void reload()}>
          {(candidates) =>
            candidates.length === 0 ? (
              <MessageView text={t("noCandidates")} />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--khoang-2)" }}>
                {candidates.map((candidate) => (
                  <li key={candidate.id} className="the" style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", justifyContent: "space-between" }}>
                    <span>
                      <strong>{candidate.documentNo}</strong> · {formatDate(candidate.paymentDate)}
                      <div className="chu-thich">
                        {payments(`kind_${candidate.kind}`)} · {candidate.partnerName}
                        {candidate.note && ` · ${candidate.note}`}
                      </div>
                    </span>
                    <button type="button" className="nut chinh" disabled={busy} onClick={() => void match(candidate)}>
                      {t("match")}
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </Loaded>
      </div>
    </Drawer>
  );
}

function IgnoreDrawer({ item, onClose, onDone }: { item: BankTransactionItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("bankTransactions");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/finance/bank-transactions/${item.id}/ignore`, { method: "POST", body: JSON.stringify({ reason, version: item.version }) });
      notify(t("ignored"));
      onDone();
    });
  }
  return (
    <Drawer title={t("ignore")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Summary item={item} />
        <Field id="bq-ly-do" label={t("ignoreReason")} error={fields.reason}>
          <input id="bq-ly-do" className={inputClass("reason")} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh" disabled={submitting}>
            {t("ignore")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function ReopenDialog({ item, onClose, onDone }: { item: BankTransactionItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("bankTransactions");
  const { notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = item.status === "matched" ? t("unmatch") : t("unignore");
  async function confirm() {
    setBusy(true);
    try {
      await apiFetch(`/finance/bank-transactions/${item.id}/reopen`, { method: "POST", body: JSON.stringify({ version: item.version }) });
      notify(t("reopened"));
      onDone();
    } catch (failure) {
      setError(failureOf(failure).message);
      setBusy(false);
    }
  }
  return <ConfirmDialog title={label} text={t("reopenText")} confirmLabel={label} busy={busy} error={error} onConfirm={() => void confirm()} onClose={onClose} />;
}
