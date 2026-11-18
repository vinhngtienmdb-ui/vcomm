"use client";

// MAN_HINH_281 chi tiết bảng chuyển tiền thu hộ (CONG_VIEC_73 lát L5; API_333): G, H, I, K, L, M, N, tiền chuyển; đơn thu hộ; khoản trừ khác; ghi đã chuyển
// (công ty vận hành sàn): ngày chuyển, quỹ chi, số giao dịch ngân hàng. Lưu thì lập phiếu chi (và phiếu thu ở công ty sở hữu cửa hàng tập đoàn);
// phiếu thu nháp (cửa hàng chưa cài quỹ ngân hàng): công ty nhận chọn quỹ ngân hàng rồi ghi sổ.
import type { FundResponse, InstorePayoutDetail, InstorePostReceiptRequest, InstoreTransferredRequest } from "contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { payoutStatusClass, payoutStatusLabel } from "@/components/InstorePayoutStatus";

function Transfer({ payout, onDone }: { payout: InstorePayoutDetail; onDone: () => void }) {
  const t = useTranslations("instorePayouts");
  const { notify } = useAdmin();
  const funds = useApi<FundResponse[]>("/finance/funds");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState({ transferredOn: payout.businessDate, fundId: "", bankTransactionNo: "" });
  const banks = funds.state.kind === "ready" ? funds.state.data.filter((fund) => fund.kind === "bank" && fund.status === "active" && !fund.foreign) : [];
  useEffect(() => {
    if (!form.fundId && banks[0]) setForm((current) => ({ ...current, fundId: banks[0]!.id }));
  }, [banks, form.fundId]);
  return (
    <form
      className="the"
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const body: InstoreTransferredRequest = { ...form, version: payout.version };
          await apiFetch(`/finance/instore/payouts/${payout.id}/transferred`, { method: "POST", body: JSON.stringify(body) });
          notify(t("transferredSaved"));
          onDone();
        });
      }}
    >
      <h2>{t("transferTitle", { no: payout.documentNo })}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)" }}>
        <Field id="ngay-chuyen" label={t("transferredOn")} error={fields.transferredOn}>
          <input id="ngay-chuyen" type="date" className={inputClass("transferredOn")} min={payout.businessDate} value={form.transferredOn} onChange={(event) => setForm({ ...form, transferredOn: event.target.value })} />
        </Field>
        <Field id="quy-chi" label={t("fund")} error={fields.fundId}>
          <select id="quy-chi" className={inputClass("fundId")} value={form.fundId} onChange={(event) => setForm({ ...form, fundId: event.target.value })}>
            {banks.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
                {fund.accountNo ? ` · ${fund.accountNo}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id="so-giao-dich" label={t("bankTransactionNo")} error={fields.bankTransactionNo}>
          <input id="so-giao-dich" className={inputClass("bankTransactionNo")} maxLength={100} value={form.bankTransactionNo} onChange={(event) => setForm({ ...form, bankTransactionNo: event.target.value })} />
        </Field>
      </div>
      <p className="chu-thich">{payout.recipientKind === "retail_company" ? t("transferHintCompany") : t("transferHintMerchant")}</p>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !form.fundId || !form.bankTransactionNo.trim()}>
          {t("markTransferred", { amount: formatNumber(payout.amount, 0) })}
        </button>
      </div>
    </form>
  );
}

function PostReceipt({ payout, onDone }: { payout: InstorePayoutDetail; onDone: () => void }) {
  const t = useTranslations("instorePayouts");
  const { notify } = useAdmin();
  const funds = useApi<FundResponse[]>("/finance/funds");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [fundId, setFundId] = useState("");
  const banks = funds.state.kind === "ready" ? funds.state.data.filter((fund) => fund.kind === "bank" && fund.status === "active" && !fund.foreign) : [];
  useEffect(() => {
    if (!fundId && banks[0]) setFundId(banks[0].id);
  }, [banks, fundId]);
  return (
    <form
      className="the"
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const body: InstorePostReceiptRequest = { fundId, version: payout.version };
          await apiFetch(`/finance/instore/payouts/${payout.id}/receipt`, { method: "POST", body: JSON.stringify(body) });
          notify(t("receiptPosted"));
          onDone();
        });
      }}
    >
      <h2>{t("postReceiptTitle")}</h2>
      {funds.state.kind === "ready" && banks.length === 0 ? (
        <p className="chu-thich">{t("noBankFund")}</p>
      ) : (
        <Field id="quy-thu" label={t("receiptFund")} error={fields.fundId}>
          <select id="quy-thu" className={inputClass("fundId")} value={fundId} onChange={(event) => setFundId(event.target.value)}>
            {banks.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.name}
                {fund.accountNo ? ` · ${fund.accountNo}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !fundId}>
          {t("postReceipt", { amount: formatNumber(payout.amount, 0) })}
        </button>
      </div>
    </form>
  );
}

export default function InstorePayoutPage() {
  const t = useTranslations("instorePayouts");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<InstorePayoutDetail>(`/finance/instore/payouts/${id}`);
  const money = (value: string | number) => formatNumber(String(value), 0);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(payout) => (
        <>
          <p>
            <Link href="/instore-payouts">‹ {t("title")}</Link>
          </p>
          <div className="tieu-de">
            <h1>{payout.documentNo}</h1>
            <span className={`nhan ${payoutStatusClass(payout)}`}>{payoutStatusLabel(t, payout)}</span>
          </div>
          <p className="chu-thich">
            {formatDate(payout.businessDate)} · {payout.recipientCode ? `${payout.recipientCode} ` : ""}
            {payout.recipientName}
            {payout.transferredOn && Number(payout.amount) > 0 && ` · ${t("transferredLine", { date: formatDate(payout.transferredOn), no: payout.bankTransactionNo ?? "" })}`}
            {payout.paymentNo && ` · ${t("paymentNo", { no: payout.paymentNo })}`}
            {payout.receiptNo && ` · ${t("receiptNo", { no: payout.receiptNo })}`}
          </p>
          {payout.receiptDraft && <div className="khoi-canh-bao canh-bao">{t("receiptDraft")}</div>}
          <section className="the" style={{ display: "grid", gap: "var(--khoang-2)", maxWidth: 560 }}>
            {[
              ["G", t("collected"), money(payout.collectedAmount)],
              ["H", t("platformFee"), `− ${money(payout.platformFee)}`],
              ["I", t("platformFeeTax", { rate: formatNumber(payout.feeTaxRate, 2) }), `− ${money(payout.platformFeeTax)}`],
              ["K", t("gatewayFee"), `− ${money(payout.gatewayFee)}`],
              ["L", t("reversal"), `− ${money(payout.reversalAmount)}`],
              ["M", t("carried"), money(payout.carriedAmount)],
              ["N", t("deduction"), `− ${money(payout.deductionAmount)}`],
            ].map(([code, label, value]) => (
              <div key={code} style={{ display: "flex", justifyContent: "space-between", gap: "var(--khoang-3)" }}>
                <span>
                  <span className="chu-thich">{code}</span> {label}
                </span>
                <span>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, borderTop: "1px solid var(--mau-vien)", paddingTop: "var(--khoang-2)" }}>
              <span>{t("amount")}</span>
              <span>{money(payout.amount)}</span>
            </div>
            {Number(payout.amount) === 0 && <p className="chu-thich">{t("nothingHint")}</p>}
          </section>
          {payout.canTransfer && <Transfer payout={payout} onDone={() => void reload()} />}
          {payout.canPostReceipt && <PostReceipt payout={payout} onDone={() => void reload()} />}
          <h2>{t("linesTitle")}</h2>
          {payout.lines.length === 0 ? (
            <MessageView text={t("noLines")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {["checkoutNo", "documentNo", "paidAt", "place", "bill", "collected", "platformFee", "gatewayFee"].map((key) => (
                      <th key={key} scope="col">
                        {t(`line_${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payout.lines.map((line) => (
                    <tr key={line.checkoutId}>
                      <td data-nhan={t("line_checkoutNo")}>{line.checkoutNo}</td>
                      <td data-nhan={t("line_documentNo")}>{line.documentNo ?? "—"}</td>
                      <td data-nhan={t("line_paidAt")}>{formatDateTime(line.paidAt)}</td>
                      <td data-nhan={t("line_place")}>{line.placeName}</td>
                      <td data-nhan={t("line_bill")}>{money(line.billAmount)}</td>
                      <td data-nhan={t("line_collected")}>{money(line.collectedAmount)}</td>
                      <td data-nhan={t("line_platformFee")}>{money(line.platformFee)}</td>
                      <td data-nhan={t("line_gatewayFee")}>{money(line.gatewayFee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {payout.deductions.length > 0 && (
            <>
              <h2>{t("deductionsTitle")}</h2>
              <div className="khung-bang">
                <table>
                  <tbody>
                    {payout.deductions.map((line) => (
                      <tr key={line.id}>
                        <td data-nhan={t("line_paidAt")}>{formatDate(line.businessDate)}</td>
                        <td data-nhan={t("deduction")}>{t(`deduction_${line.kind}`)}</td>
                        <td data-nhan="">{line.note ?? ""}</td>
                        <td data-nhan={t("amount")}>{money(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Loaded>
  );
}
