"use client";

// MAN_HINH_263 Chi tiết bảng đối soát đối tác: số liệu A, B, C, bù trừ, còn lại; dòng lệch; xác nhận kèm biên bản; chi tiết giao dịch; công nợ
// (CONG_VIEC_65; CHUC_NANG_239; QUYTAC_NGHIEPVU_547 đến 549; API_305).
import type { PartnerSettlementDetail, PartnerSettlementTotals } from "contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { netLabel, periodLabel, settlementStatusClass } from "@/components/LoyaltyPartnerSettlement";

function Figures({ data }: { data: PartnerSettlementDetail }) {
  const t = useTranslations("loyaltyPartner");
  const net = Number(data.netAmount);
  const row = (label: string, totals: PartnerSettlementTotals, sign: 1 | -1) => (
    <tr>
      <td data-nhan={t("figureItem")}>{label}</td>
      <td data-nhan={t("figureCount")} className="so">
        {formatNumber(String(totals.count), 0)}
      </td>
      <td data-nhan={t("figurePoints")} className="so">
        {formatNumber(String(sign * totals.points), 0)}
      </td>
      <td data-nhan={t("figureUnits")} className="so">
        {totals.units === null ? "—" : `${formatNumber(String(totals.units), 0)} ${data.unitNameVi}`}
      </td>
      <td data-nhan={t("figureAmount")} className="so">
        {formatNumber(totals.amount, 0)}
      </td>
    </tr>
  );
  return (
    <section className="the">
      <h2>{t("figuresTitle")}</h2>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("figureItem")}</th>
              <th className="so">{t("figureCount")}</th>
              <th className="so">{t("figurePoints")}</th>
              <th className="so">{t("figureUnits")}</th>
              <th className="so">{t("figureAmount")}</th>
            </tr>
          </thead>
          <tbody>
            {row(t("figureGift"), data.gift, 1)}
            {row(t("figureInbound"), data.inbound, 1)}
            {row(t("figureOutbound"), data.outbound, -1)}
            <tr>
              <td data-nhan={t("figureItem")} colSpan={4}>
                {t("figureOffset")}
              </td>
              <td data-nhan={t("figureAmount")} className="so">
                {formatNumber(data.offsetAmount, 0)}
              </td>
            </tr>
            <tr>
              <td data-nhan={t("figureItem")} colSpan={4}>
                <b>{net > 0 ? t("figureNetPartner") : net < 0 ? t("figureNetCompany") : t("figureNetZero")}</b>
              </td>
              <td data-nhan={t("figureAmount")} className="so">
                <b>{formatNumber(String(Math.abs(net)), 0)}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="chu-thich">{t("builtAt", { time: formatDateTime(data.builtAt) })}</p>
    </section>
  );
}

function Mismatches({ data }: { data: PartnerSettlementDetail }) {
  const t = useTranslations("loyaltyPartner");
  if (data.status === "unreconciled")
    return (
      <section className="the">
        <h2>{t("mismatchesTitle")}</h2>
        <div className="khoi-canh-bao canh-bao">{t("reconcileError", { code: data.reconcileError ?? "" })}</div>
      </section>
    );
  if (data.mismatches.length === 0) return null;
  return (
    <section className="the">
      <h2>{t("mismatchesTitle")}</h2>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("mismatchReference")}</th>
              <th>{t("mismatchType")}</th>
              <th>{t("mismatchVcomm")}</th>
              <th>{t("mismatchPartner")}</th>
              <th>{t("mismatchKind")}</th>
            </tr>
          </thead>
          <tbody>
            {data.mismatches.map((item) => {
              const unit = item.lineKind === "gift" ? t("pointsUnit") : data.unitNameVi;
              return (
                <tr key={`${item.lineKind}:${item.reference}:${item.kind}`}>
                  <td data-nhan={t("mismatchReference")}>
                    <code>{item.reference}</code>
                    {item.documentNo && <div className="chu-thich">{item.documentNo}</div>}
                  </td>
                  <td data-nhan={t("mismatchType")}>{t(`lineKind_${item.lineKind}`)}</td>
                  <td data-nhan={t("mismatchVcomm")}>{item.vcomm === null ? t("mismatchAbsent") : item.kind === "status" ? t("partnerState_completed") : `${formatNumber(item.vcomm, 0)} ${unit}`}</td>
                  <td data-nhan={t("mismatchPartner")}>
                    {item.partner === null ? t("mismatchAbsent") : item.kind === "status" ? t(`partnerState_${item.partner}`) : `${formatNumber(item.partner, 0)} ${unit}`}
                  </td>
                  <td data-nhan={t("mismatchKind")}>
                    <span className="nhan loi">{t(`mismatch_${item.kind}`)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="khoi-canh-bao loi">{t("mismatchHint")}</div>
    </section>
  );
}

function Confirm({ data, onDone }: { data: PartnerSettlementDetail; onDone: (result: PartnerSettlementDetail) => void }) {
  const t = useTranslations("loyaltyPartner");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const net = Number(data.netAmount);
  const hint =
    net > 0
      ? t("confirmHintReceivable", { amount: formatNumber(data.netAmount, 0), days: String(data.paymentTermDays) })
      : net < 0
        ? t("confirmHintPayable", { amount: formatNumber(String(-net), 0) })
        : t("confirmHintZero");
  return (
    <section className="the">
      <h2>{t("confirmTitle")}</h2>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const form = new FormData();
            form.append("note", note);
            form.append("version", String(data.version));
            if (file) form.append("file", file);
            onDone(await apiUpload<PartnerSettlementDetail>(`/loyalty/partner-settlements/${data.id}/confirm`, form));
          });
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" }}>
          <Field id="ghi-chu-xac-nhan" label={t("confirmNote")} error={fields.note}>
            <input id="ghi-chu-xac-nhan" className={inputClass("note")} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <Field id="tep-bien-ban" label={t("confirmFile")} error={fields.file}>
            <input id="tep-bien-ban" type="file" className={inputClass("file")} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </Field>
        </div>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || data.status !== "matched" || !note.trim()}>
            {t("confirmButton")}
          </button>
        </div>
        <p className="chu-thich">{data.status === "matched" ? hint : t("confirmNotMatched")}</p>
      </form>
    </section>
  );
}

function Lines({ data }: { data: PartnerSettlementDetail }) {
  const t = useTranslations("loyaltyPartner");
  const columns = ["date", "document", "kind", "reference", "customer", "points", "units", "amount"];
  return (
    <section className="the">
      <h2>{t("linesTitle")}</h2>
      {data.lines.length === 0 ? (
        <p>{t("linesEmpty")}</p>
      ) : (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {columns.map((key) => (
                  <th key={key} className={["points", "units", "amount"].includes(key) ? "so" : undefined}>
                    {t(`line_${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={`${line.kind}:${line.id}`}>
                  <td data-nhan={t("line_date")}>{formatDate(line.date)}</td>
                  <td data-nhan={t("line_document")}>{line.documentNo}</td>
                  <td data-nhan={t("line_kind")}>{t(`lineKind_${line.kind}`)}</td>
                  <td data-nhan={t("line_reference")}>
                    <code>{line.reference}</code>
                  </td>
                  <td data-nhan={t("line_customer")}>{line.customerMasked}</td>
                  <td data-nhan={t("line_points")} className="so">
                    {line.kind === "outbound" ? "−" : "+"}
                    {formatNumber(String(line.points), 0)}
                  </td>
                  <td data-nhan={t("line_units")} className="so">
                    {line.units === null ? "—" : formatNumber(String(line.units), 0)}
                  </td>
                  <td data-nhan={t("line_amount")} className="so">
                    {formatNumber(line.amount, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Debt({ data }: { data: PartnerSettlementDetail }) {
  const t = useTranslations("loyaltyPartner");
  const confirmed = data.status === "confirmed" || data.status === "paid";
  return (
    <section className="the">
      <h2>{t("debtTitle")}</h2>
      {!confirmed ? (
        <div className="khoi-canh-bao thong-tin">{t("debtNone")}</div>
      ) : (
        <>
          <p>
            {t("confirmedInfo", { name: data.confirmedByName ?? "—", time: data.confirmedAt ? formatDateTime(data.confirmedAt) : "", note: data.confirmNote ?? "" })}{" "}
            {data.confirmFile && (
              <a href={`/api/v1/loyalty/partner-settlements/${data.id}/file`}>
                {t("confirmFileLink")} ({data.confirmFile.fileName})
              </a>
            )}
          </p>
          {data.debt ? (
            <p>
              {t(data.debt.side === "receivable" ? "debtReceivable" : "debtPayable", {
                amount: formatNumber(data.debt.amount, 0),
                open: formatNumber(data.debt.openAmount, 0),
                due: data.dueDate ? formatDate(data.dueDate) : "—",
              })}
              {data.overdue && <span className="nhan loi"> {t("overdue")}</span>}
            </p>
          ) : (
            <p>{t("debtZero")}</p>
          )}
          {data.paidAt ? <p className="chu-thich">{t("paidAt", { time: formatDateTime(data.paidAt) })}</p> : <p className="chu-thich">{t("debtHint")}</p>}
        </>
      )}
    </section>
  );
}

export default function PartnerSettlementPage() {
  const t = useTranslations("loyaltyPartner");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PartnerSettlementDetail>(`/loyalty/partner-settlements/${id}`);
  const rebuild = useSubmit();
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
        <>
          <p>
            <Link href="/loyalty/partner-settlements">‹ {t("settlementsTitle")}</Link>
          </p>
          <div className="tieu-de">
            <h1>
              {data.documentNo} · {data.partnerName} · {periodLabel(data.period)}
            </h1>
            <span className={`nhan ${settlementStatusClass[data.status]}`}>{t(`settlementStatus_${data.status}`)}</span>
            {data.canManage && ["unreconciled", "mismatched", "matched"].includes(data.status) && (
              <button
                type="button"
                className={`nut phu${rebuild.submitting ? " dang-xu-ly" : ""}`}
                disabled={rebuild.submitting}
                onClick={() =>
                  void rebuild.run(async () => {
                    await apiFetch(`/loyalty/partner-settlements/${data.id}/rebuild`, { method: "POST", body: JSON.stringify({ version: data.version }) });
                    notify(t("rebuilt"));
                    await reload();
                  })
                }
              >
                {t("rebuild")}
              </button>
            )}
          </div>
          <FormError text={rebuild.formError} />
          <p className="chu-thich">{netLabel(t, data.netAmount)}</p>
          <Figures data={data} />
          <Mismatches data={data} />
          {data.canManage && ["unreconciled", "mismatched", "matched"].includes(data.status) && (
            <Confirm
              data={data}
              onDone={() => {
                notify(t("confirmed"));
                void reload();
              }}
            />
          )}
          <Lines data={data} />
          <Debt data={data} />
        </>
      )}
    </Loaded>
  );
}
