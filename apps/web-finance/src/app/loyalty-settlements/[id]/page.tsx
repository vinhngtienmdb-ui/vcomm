"use client";

// MAN_HINH_219 Chi tiết bảng đối soát điểm nội bộ (CONG_VIEC_60; CHUC_NANG_214; QUYTAC_NGHIEPVU_470, 471; API_249, API_250):
// số liệu theo sổ công ty vận hành sàn, đối chiếu sổ công ty con, xác nhận hai phía, khiếu nại, lập lại, bút toán điểm trong kỳ, lịch sử.
import type { LoyaltySettlementResponse } from "contracts";
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
                          <td data-nhan={t("journal")}>{mismatch.label}</td>
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
