"use client";

// MAN_HINH_165 chi tiết ca, MAN_HINH_162 phần đóng ca (CHUC_NANG_186; QUYTAC_NGHIEPVU_375; API_193): tổng theo phương thức,
// tiền mặt hệ thống tính, tiền đếm được (có bảng đếm theo mệnh giá), lệch, lý do.
import type { CloseRetailShiftRequest, RetailShiftResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ShiftDifference } from "@/components/ShiftDifference";

const denominations = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

function CloseShiftForm({ shift, onClosed }: { shift: RetailShiftResponse; onClosed: (shift: RetailShiftResponse) => void }) {
  const t = useTranslations("retailShifts");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [pieces, setPieces] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const piecesTotal = denominations.reduce((sum, value) => sum + value * (Number(pieces[value]) || 0), 0);
  const difference = counted.trim() === "" ? null : Number(counted) - Number(shift.expectedCash);
  function submit(event: FormEvent) {
    event.preventDefault();
    setConfirming(true);
  }
  function close() {
    void run(async () => {
      const body: CloseRetailShiftRequest = { countedCash: counted, differenceReason: reason, version: shift.version };
      onClosed(await apiFetch<RetailShiftResponse>(`/retail/shifts/${shift.id}/close`, { method: "POST", body: JSON.stringify(body) }));
    });
    setConfirming(false);
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("closeTitle")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--khoang-4)" }}>
        <div style={{ display: "grid", gap: "var(--khoang-3)", alignContent: "start" }}>
          <dl className="thong-tin-dong">
            <dt>{t("expectedCash")}</dt>
            <dd>{formatMoney(shift.expectedCash, shift.currency)}</dd>
          </dl>
          <Field id="tien-dem" label={`${t("countedCash")} *`} error={fields.countedCash}>
            <input id="tien-dem" className={inputClass("countedCash")} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} />
          </Field>
          <dl className="thong-tin-dong">
            <dt>{t("difference")}</dt>
            <dd>
              <ShiftDifference difference={difference === null || Number.isNaN(difference) ? null : String(difference)} currency={shift.currency} />
            </dd>
          </dl>
          <Field id="ly-do-lech" label={t("differenceReason")} error={fields.differenceReason}>
            <textarea id="ly-do-lech" className={inputClass("differenceReason")} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
        <div className="khung-bang">
          <table>
            <caption className="chu-thich" style={{ textAlign: "left", padding: "var(--khoang-2)" }}>
              {t("denominations")}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("denomination")}</th>
                <th scope="col">{t("pieces")}</th>
                <th scope="col">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {denominations.map((value) => (
                <tr key={value}>
                  <td data-nhan={t("denomination")}>
                    <span>{formatMoney(String(value), shift.currency)}</span>
                  </td>
                  <td data-nhan={t("pieces")}>
                    <input
                      className="o-nhap"
                      inputMode="numeric"
                      aria-label={`${t("pieces")} ${value}`}
                      style={{ maxWidth: 96 }}
                      value={pieces[value] ?? ""}
                      onChange={(event) => setPieces({ ...pieces, [value]: event.target.value.replace(/\D/g, "") })}
                    />
                  </td>
                  <td data-nhan={t("amount")}>
                    <span>{formatMoney(String(value * (Number(pieces[value]) || 0)), shift.currency)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="nhom-nut" style={{ padding: "var(--khoang-2)" }}>
            <strong style={{ flex: 1 }}>{formatMoney(String(piecesTotal), shift.currency)}</strong>
            <button type="button" className="nut phu" onClick={() => setCounted(String(piecesTotal))}>
              {t("useCount")}
            </button>
          </div>
        </div>
      </div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || counted.trim() === ""}>
          {t("close")}
        </button>
      </div>
      {confirming && <ConfirmDialog title={t("closeTitle")} text={t("closeConfirm")} confirmLabel={t("close")} busy={submitting} onConfirm={close} onClose={() => setConfirming(false)} />}
    </form>
  );
}

export default function ShiftDetailPage() {
  const t = useTranslations("retailShifts");
  const payments = useTranslations("payments");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<RetailShiftResponse>(`/retail/shifts/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(shift) => (
        <>
          <div className="tieu-de">
            <h1>
              {shift.store.name} · {shift.register.code}
            </h1>
            <span className={`nhan ${shift.status === "open" ? "thong-tin" : "trung-tinh"}`}>{t(`status_${shift.status}`)}</span>
            <Link href="/shifts">{t("back")}</Link>
          </div>
          <div className="the">
            <dl className="thong-tin-dong">
              <dt>{t("cashier")}</dt>
              <dd>{shift.cashier.name}</dd>
              <dt>{t("openedAt")}</dt>
              <dd>{formatDateTime(shift.openedAt)}</dd>
              <dt>{t("openingCash")}</dt>
              <dd>{formatMoney(shift.openingCash, shift.currency)}</dd>
              {shift.openingNote && (
                <>
                  <dt>{t("openingNote")}</dt>
                  <dd>{shift.openingNote}</dd>
                </>
              )}
              <dt>{t("saleCount")}</dt>
              <dd>{shift.saleCount}</dd>
              {shift.status === "closed" && (
                <>
                  <dt>{t("closedAt")}</dt>
                  <dd>{formatDateTime(shift.closedAt)}</dd>
                  <dt>{t("closedBy")}</dt>
                  <dd>{shift.closedBy}</dd>
                  <dt>{t("expectedCash")}</dt>
                  <dd>{formatMoney(shift.expectedCash, shift.currency)}</dd>
                  <dt>{t("countedCash")}</dt>
                  <dd>{formatMoney(shift.countedCash!, shift.currency)}</dd>
                  <dt>{t("difference")}</dt>
                  <dd>
                    <ShiftDifference difference={shift.difference} currency={shift.currency} />
                  </dd>
                  {shift.differenceReason && (
                    <>
                      <dt>{t("differenceReason")}</dt>
                      <dd>{shift.differenceReason}</dd>
                    </>
                  )}
                </>
              )}
            </dl>
          </div>
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("method")}</th>
                  <th scope="col">{t("sales")}</th>
                  <th scope="col">{t("refunds")}</th>
                  <th scope="col">{t("net")}</th>
                </tr>
              </thead>
              <tbody>
                {shift.summary.map((line) => (
                  <tr key={line.method}>
                    <td data-nhan={t("method")}>
                      <span>{t(`method_${line.method}`)}</span>
                    </td>
                    <td data-nhan={t("sales")}>
                      <span>{formatMoney(line.sales, shift.currency)}</span>
                    </td>
                    <td data-nhan={t("refunds")}>
                      <span>{formatMoney(line.refunds, shift.currency)}</span>
                    </td>
                    <td data-nhan={t("net")}>
                      <span>{formatMoney(line.net, shift.currency)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shift.status === "closed" ? (
            <div className="khung-bang">
              <table>
                <caption className="chu-thich" style={{ textAlign: "left", padding: "var(--khoang-2)" }}>
                  {t("fundDocuments")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("documentNo")}</th>
                    <th scope="col">{t("documentKind")}</th>
                    <th scope="col">{t("fund")}</th>
                    <th scope="col">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shift.fundDocuments.map((document) => (
                    <tr key={document.id}>
                      <td data-nhan={t("documentNo")}>
                        {/* Thẻ a thường: phiếu thu chi nằm ở mini app Tài chính – Kế toán. */}
                        <a href={`/finance/payments/${document.id}`}>{document.documentNo}</a>
                      </td>
                      <td data-nhan={t("documentKind")}>
                        <span>{payments(`kind_${document.kind}`)}</span>
                      </td>
                      <td data-nhan={t("fund")}>
                        <span>{document.fundName}</span>
                      </td>
                      <td data-nhan={t("amount")} className="so-tien">
                        <span>{formatMoney(document.amount, shift.currency)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="khoi-canh-bao thong-tin">{t("fundDocumentsHint")}</div>
          )}
          {shift.canClose && (
            <CloseShiftForm
              shift={shift}
              onClosed={() => {
                notify(t("closed"));
                void reload();
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
