"use client";

// MAN_HINH_98 Hoàn tiền đơn VComm (CONG_VIEC_25; CHUC_NANG_122; API_133; QUYTAC_NGHIEPVU_168): việc chờ hoàn, tài khoản người mua, ghi đã hoàn tiền.
import { refundStatuses, type PageResponse, type RefundItem, type RefundStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const vietnamToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

function RefundCard({ item, onChanged }: { item: RefundItem; onChanged: () => Promise<void> }) {
  const t = useTranslations("refunds");
  const { notify } = useAdmin();
  const [bankTransactionNo, setBankTransactionNo] = useState("");
  const [refundedOn, setRefundedOn] = useState(vietnamToday());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/refunds/${item.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ bankTransactionNo, refundedOn, note: note.trim() || null, version: item.version }),
      });
      notify(t("completedSaved"));
      await onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const prefix = `ht-${item.id}`;
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
        <strong>
          <Link href={`/orders/${item.orderId}`}>{item.documentNo}</Link> · {item.buyerName} · {item.buyerPhone}
        </strong>
        <strong>{formatNumber(item.amount, 0)}</strong>
      </div>
      <span className="chu-thich">{`${t(`reason_${item.reason}`)} · ${t("createdAt")} ${formatDateTime(item.createdAt)}`}</span>
      <span>
        {t("bankAccount")}:{" "}
        {item.bankAccount ? (
          <strong>{`${item.bankAccount.bankName} · ${item.bankAccount.accountNumber} · ${item.bankAccount.accountHolder}`}</strong>
        ) : (
          <span className="nhan canh-bao">{t("noBankAccount")}</span>
        )}
      </span>
      {item.status === "completed" ? (
        <span className="chu-thich">{`${t("bankTransactionNo")} ${item.bankTransactionNo} · ${t("refundedOn")} ${formatDate(item.refundedOn ?? "")}${item.note ? ` · ${item.note}` : ""}`}</span>
      ) : (
        <>
          <FormError text={error} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
            <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
              <label htmlFor={`${prefix}-ma`}>{t("bankTransactionNo")}</label>
              <input id={`${prefix}-ma`} className="o-nhap" maxLength={100} value={bankTransactionNo} onChange={(event) => setBankTransactionNo(event.target.value)} />
            </span>
            <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
              <label htmlFor={`${prefix}-ngay`}>{t("refundedOn")}</label>
              <input id={`${prefix}-ngay`} type="date" className="o-nhap" value={refundedOn} onChange={(event) => setRefundedOn(event.target.value)} />
            </span>
            <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
              <label htmlFor={`${prefix}-ghi-chu`}>{t("note")}</label>
              <input id={`${prefix}-ghi-chu`} className="o-nhap" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </span>
            <button type="button" className="nut chinh" disabled={busy || !bankTransactionNo.trim() || !refundedOn} onClick={() => void complete()}>
              {t("complete")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function RefundsPage() {
  const t = useTranslations("refunds");
  const common = useTranslations("common");
  const [status, setStatus] = useState<RefundStatus>("pending");
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<PageResponse<RefundItem>>(`/marketplace/refunds?${new URLSearchParams({ status, page: String(page), pageSize: "20" })}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="nhom-nut" role="tablist">
        {refundStatuses.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={status === item}
            className={`nut ${status === item ? "chinh" : "phu"}`}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
          >
            {t(item)}
          </button>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
              {result.data.map((item) => (
                <RefundCard key={`${item.id}-${item.version}`} item={item} onChanged={reload} />
              ))}
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
    </>
  );
}
