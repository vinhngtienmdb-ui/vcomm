"use client";

// MAN_HINH_219 Chi tiết bảng đối soát điểm nội bộ (CONG_VIEC_60; CHUC_NANG_214; QUYTAC_NGHIEPVU_470, 471; API_249, API_250):
// số liệu theo sổ công ty vận hành sàn, đối chiếu sổ công ty con, xác nhận hai phía, khiếu nại, lập lại, bút toán điểm trong kỳ, lịch sử;
// phiếu thu, phiếu chi nợ nội bộ điểm (QUYTAC_NGHIEPVU_473).
import type { FundResponse, LoyaltySettlementResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { NetAmount, SettlementStatusBadge } from "@/components/SettlementStatusBadge";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function LoyaltySettlementPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<LoyaltySettlementResponse>(`/loyalty/settlements/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settlement) => <Settlement settlement={settlement} onChanged={() => void reload()} />}
    </Loaded>
  );
}

function Settlement({ settlement, onChanged }: { settlement: LoyaltySettlementResponse; onChanged: () => void }) {
  const t = useTranslations("loyaltySettlements");
  const { notify } = useAdmin();
  const [tab, setTab] = useState<"figures" | "lines" | "events">("figures");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const period = `${settlement.period.slice(5, 7)}/${settlement.period.slice(0, 4)}`;
  const viewerName = settlement.viewerSide === "operator" ? settlement.operatorCompanyName : settlement.companyName;
  async function act(path: string, body: object, message: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/loyalty/settlements/${settlement.id}/${path}`, { method: "POST", body: JSON.stringify({ version: settlement.version, ...body }) });
      notify(message);
      setDisputing(false);
      setReason("");
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  const confirmable = ["pending", "operator_confirmed", "company_confirmed"].includes(settlement.status);
  const canAct = settlement.canConfirm || (confirmable && settlement.canRebuild);
  const sides = [
    [settlement.operatorCompanyName, settlement.operatorConfirmedBy, settlement.operatorConfirmedAt],
    [settlement.companyName, settlement.companyConfirmedBy, settlement.companyConfirmedAt],
  ] as const;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("detailTitle", { number: settlement.documentNo, company: settlement.companyName, period })}</h1>
        <Link href="/loyalty-settlements" className="nut phu">
          {t("back")}
        </Link>
      </div>
      <div className="nhom-nut" style={{ marginBottom: "var(--khoang-3)" }}>
        <SettlementStatusBadge status={settlement.status} />
      </div>
      <div className="cac-the" role="tablist">
        {(["figures", "lines", "events"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab === "figures" && (
        <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
          <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <h2>{t("figuresTitle", { company: settlement.operatorCompanyName })}</h2>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("item")}</th>
                    <th scope="col">{t("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t("netOpening"), <NetAmount key="o" amount={settlement.netOpening} operatorName={settlement.operatorCompanyName} companyName={settlement.companyName} />],
                    ...settlement.movements.map((movement) => [t(`movement_${movement.kind}`), <span key={movement.kind}>{formatNumber(movement.amount)}</span>]),
                    [t("receivableMovement"), <strong key="r">{formatNumber(settlement.receivableMovement)}</strong>],
                    [t("payableMovement"), <strong key="p">{formatNumber(settlement.payableMovement)}</strong>],
                    [t("offsetAmount"), <span key="b">{formatNumber(settlement.offsetAmount)}</span>],
                    [t("netClosing"), <NetAmount key="c" amount={settlement.netClosing} operatorName={settlement.operatorCompanyName} companyName={settlement.companyName} />],
                  ].map(([label, value], index) => (
                    <tr key={index}>
                      <td data-nhan={t("item")}>{label}</td>
                      <td data-nhan={t("amount")} className="so-tien">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="chu-thich">{t("netHint")}</div>
            {settlement.status === "mismatched" ? (
              <>
                <div className="khoi-canh-bao loi">{t("mismatched")}</div>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{t("journal")}</th>
                        <th scope="col">{t("day")}</th>
                        <th scope="col">{t("operatorBook", { company: settlement.operatorCompanyName })}</th>
                        <th scope="col">{t("companyBook", { company: settlement.companyName })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlement.mismatches.map((mismatch) => (
                        <tr key={mismatch.sourceId}>
                          <td data-nhan={t("journal")}>{mismatch.sourceType === "payment" ? t("paymentsMismatch") : mismatch.label}</td>
                          <td data-nhan={t("day")}>{formatDate(mismatch.day)}</td>
                          <td data-nhan={t("operatorBook", { company: settlement.operatorCompanyName })} className="so-tien">
                            {formatNumber(mismatch.operatorAmount)}
                          </td>
                          <td data-nhan={t("companyBook", { company: settlement.companyName })} className="so-tien">
                            {formatNumber(mismatch.companyAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="khoi-canh-bao thong-tin">{t("matched", { company: settlement.companyName, amount: formatNumber(settlement.companyNetClosing) })}</div>
            )}
          </section>
          <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <h2>{t("confirmTitle")}</h2>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("side")}</th>
                    <th scope="col">{t("status")}</th>
                    <th scope="col">{t("confirmedBy")}</th>
                    <th scope="col">{t("confirmedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sides.map(([name, by, at]) => (
                    <tr key={name}>
                      <td data-nhan={t("side")}>{name}</td>
                      <td data-nhan={t("status")}>
                        <span className={`nhan ${at ? "thanh-cong" : "trung-tinh"}`}>{t(at ? "sideConfirmed" : "sidePending")}</span>
                      </td>
                      <td data-nhan={t("confirmedBy")}>{by ?? "—"}</td>
                      <td data-nhan={t("confirmedAt")}>{at ? formatDateTime(at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {settlement.status === "disputed" && settlement.disputeReason && <div className="khoi-canh-bao canh-bao">{t("disputedHint", { reason: settlement.disputeReason })}</div>}
            {settlement.status === "carried_forward" && <div className="khoi-canh-bao thong-tin">{t("carriedHint")}</div>}
            <FormError text={error} />
            {(canAct || (settlement.canRebuild && !confirmable)) && (
              <div className="nhom-nut">
                {settlement.canConfirm && (
                  <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("confirm", {}, t("confirmed"))}>
                    {t("confirm", { company: viewerName })}
                  </button>
                )}
                {confirmable && (settlement.canConfirm || settlement.canRebuild) && !disputing && (
                  <button type="button" className="nut phu" disabled={busy} onClick={() => setDisputing(true)}>
                    {t("dispute")}
                  </button>
                )}
                {settlement.canRebuild && (
                  <button type="button" className="nut phu" disabled={busy} onClick={() => void act("rebuild", {}, t("rebuilt"))}>
                    {t("rebuild")}
                  </button>
                )}
              </div>
            )}
            {disputing && (
              <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <Field id="dn-ly-do" label={t("disputeReason")}>
                  <textarea id="dn-ly-do" className="o-nhap" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                <div className="nhom-nut">
                  <button type="button" className="nut chinh" disabled={busy || reason.trim() === ""} onClick={() => void act("dispute", { reason }, t("disputed"))}>
                    {t("sendDispute")}
                  </button>
                  <button type="button" className="nut phu" disabled={busy} onClick={() => setDisputing(false)}>
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
            <div className="chu-thich">{t("confirmHint")}</div>
          </section>
          {["confirmed", "partially_paid", "settled", "carried_forward"].includes(settlement.status) && <Payments settlement={settlement} onChanged={onChanged} />}
        </div>
      )}
      {tab === "lines" &&
        (settlement.lines.length === 0 ? (
          <MessageView text={t("noLines")} />
        ) : (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  {[t("day"), t("journal"), t("kind"), t("buyer"), t("points"), t("amount")].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlement.lines.map((line, index) => (
                  <tr key={`${line.documentNo}-${index}`}>
                    <td data-nhan={t("day")}>{formatDate(line.day)}</td>
                    <td data-nhan={t("journal")}>{line.documentNo}</td>
                    <td data-nhan={t("kind")}>{t(`movement_${line.kind}` as never)}</td>
                    <td data-nhan={t("buyer")}>{line.buyerName}</td>
                    <td data-nhan={t("points")} className="so-tien">
                      {formatNumber(line.points, 0)}
                    </td>
                    <td data-nhan={t("amount")} className="so-tien">
                      {formatNumber(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {tab === "events" && (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {[t("eventTime"), t("eventKind"), t("side"), t("eventActor"), t("eventNote")].map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlement.events.map((event, index) => (
                <tr key={index}>
                  <td data-nhan={t("eventTime")}>{formatDateTime(event.createdAt)}</td>
                  <td data-nhan={t("eventKind")}>{t(`event_${event.kind}` as never)}</td>
                  <td data-nhan={t("side")}>{event.companyName ?? "—"}</td>
                  <td data-nhan={t("eventActor")}>{event.actorName ?? t("system")}</td>
                  <td data-nhan={t("eventNote")}>{event.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// Phiếu thu (bên nhận), phiếu chi (bên trả) nợ nội bộ điểm; phiếu thu ghi sổ ngay, phiếu chi qua duyệt nếu công ty có chính sách duyệt.
function Payments({ settlement, onChanged }: { settlement: LoyaltySettlementResponse; onChanged: () => void }) {
  const t = useTranslations("loyaltySettlements");
  const payments = useTranslations("payments");
  const { notify } = useAdmin();
  const funds = useApi<FundResponse[]>(settlement.paymentKind ? "/finance/funds" : null);
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ fundId: "", paymentDate: today, amount: settlement.paymentRemaining, note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/loyalty/settlements/${settlement.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ fundId: form.fundId, paymentDate: form.paymentDate, amount: form.amount.replaceAll(".", "").replace(",", "."), note: form.note.trim() || null }),
      });
      notify(t("paymentCreated"));
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const headings = [t("paymentNo"), t("company"), t("kind"), t("day"), t("amount"), t("status")];
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("paymentsTitle")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--khoang-3)" }}>
        {[
          [t("payerLabel"), settlement.payerCompanyName],
          [t("netClosing"), formatNumber(Math.abs(Number(settlement.netClosing)))],
          [t("paidAmount", { company: settlement.payerCompanyName }), formatNumber(settlement.paidAmount)],
          [t("receivedAmount", { company: settlement.payeeCompanyName }), formatNumber(settlement.receivedAmount)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="chu-thich">{label}</div>
            <strong style={{ whiteSpace: "nowrap" }}>{value}</strong>
          </div>
        ))}
      </div>
      {settlement.payments.length === 0 ? (
        <MessageView text={t("noPayments")} />
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
              {settlement.payments.map((payment) => (
                <tr key={payment.id}>
                  <td data-nhan={headings[0]}>
                    {payment.companyName === (settlement.viewerSide === "operator" ? settlement.operatorCompanyName : settlement.companyName) ? (
                      <Link href={`/payments/${payment.id}`}>{payment.documentNo ?? t("draftNo")}</Link>
                    ) : (
                      (payment.documentNo ?? t("draftNo"))
                    )}
                  </td>
                  <td data-nhan={headings[1]}>{payment.companyName}</td>
                  <td data-nhan={headings[2]}>{payments(`kind_${payment.kind}`)}</td>
                  <td data-nhan={headings[3]}>{formatDate(payment.paymentDate)}</td>
                  <td data-nhan={headings[4]} className="so-tien">
                    {formatNumber(payment.amount)}
                  </td>
                  <td data-nhan={headings[5]}>{payments(`status_${payment.status}` as never)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {settlement.paymentKind && (
        <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <h3>{t(settlement.paymentKind === "loyalty_intercompany_payment" ? "createPayment" : "createReceipt", { amount: formatNumber(settlement.paymentRemaining) })}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
            <Field id="dn-quy" label={t("fund")}>
              <select id="dn-quy" className="o-nhap" value={form.fundId} onChange={(event) => setForm({ ...form, fundId: event.target.value })}>
                <option value="">{t("chooseFund")}</option>
                {(funds.state.kind === "ready" ? funds.state.data : [])
                  .filter((fund) => fund.status === "active")
                  .map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {`${fund.code} · ${fund.name} · ${formatNumber(fund.balance)}`}
                    </option>
                  ))}
              </select>
            </Field>
            <Field id="dn-ngay" label={t("paymentDate")}>
              <input id="dn-ngay" type="date" className="o-nhap" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} />
            </Field>
            <Field id="dn-so-tien" label={t("paymentAmount")}>
              <input id="dn-so-tien" className="o-nhap" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
            <Field id="dn-ghi-chu" label={t("paymentNote")}>
              <input id="dn-ghi-chu" className="o-nhap" maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
          </div>
          <FormError text={error} />
          <div className="nhom-nut">
            <button type="button" className="nut chinh" disabled={busy || form.fundId === ""} onClick={() => void create()}>
              {t(settlement.paymentKind === "loyalty_intercompany_payment" ? "submitPayment" : "submitReceipt")}
            </button>
          </div>
          <div className="chu-thich">{t("paymentHint")}</div>
        </div>
      )}
    </section>
  );
}
