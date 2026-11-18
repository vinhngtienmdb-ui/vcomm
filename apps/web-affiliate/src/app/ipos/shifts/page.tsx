"use client";

// MAN_HINH_298 Ca và chốt két (chủ cửa hàng; CONG_VIEC_74; QUYTAC_NGHIEPVU_623; API_350): danh sách ca (quầy, người, mở, đóng, chênh lệch);
// biên bản; đóng hộ ca của thu ngân quên đóng (ghi người đóng).
import type { IposPortalAccess, IposPortalShiftRow, IposShiftReport } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { daysAgo, IposPeriod, periodQuery, vietnamToday, type IposPeriodValue } from "@/components/IposPeriod";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

function ShiftDrawer({ report, onClose, onClosed }: { report: IposShiftReport; onClose: () => void; onClosed: (report: IposShiftReport) => void }) {
  const t = useTranslations("iposPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [counted, setCounted] = useState("");
  const [left, setLeft] = useState("0");
  const [reason, setReason] = useState("");
  const difference = counted === "" ? 0 : Number(counted) - Number(report.systemCash);
  const row = (label: string, value: string | null, strong = false) => (
    <tr>
      <td data-nhan="">{strong ? <strong>{label}</strong> : label}</td>
      <td className="so">{value === null ? "—" : strong ? <strong>{formatNumber(value)}</strong> : formatNumber(value)}</td>
    </tr>
  );
  return (
    <Drawer title={`${t("shiftReport")} · ${report.shift.registerName} · ${report.shift.memberName}`} onClose={onClose}>
      <p className="chu-thich">
        {t("openedAt")} {formatDateTime(report.shift.openedAt)}
        {report.shift.closedAt ? ` · ${t("closedAt")} ${formatDateTime(report.shift.closedAt)} · ${report.shift.closedByName ?? ""}` : ""}
      </p>
      <div className="khung-bang">
        <table>
          <tbody>
            <tr>
              <td>{t("salesCount")}</td>
              <td className="so">{report.salesCount}</td>
            </tr>
            {row(t("revenue"), report.revenue)}
            {report.revenueByMethod.map((item) => row(`  ${t(`method_${item.method}`)}`, item.amount))}
            {row(t("openingCash"), report.shift.openingCash)}
            {row(t("cashSales"), report.cashSales)}
            {row(t("cashRefunds"), report.cashRefunds)}
            {row(t("cashIn"), report.cashIn)}
            {row(t("cashOut"), report.cashOut)}
            {row(t("systemCash"), report.systemCash, true)}
            {row(t("countedCash"), report.countedCash)}
            {row(t("difference"), report.difference, true)}
            {row(t("leftCash"), report.leftCash)}
            {row(t("handedOver"), report.handedOver)}
          </tbody>
        </table>
      </div>
      {report.differenceReason && <p className="chu-thich">{t("differenceReasonShown", { reason: report.differenceReason })}</p>}
      {report.movements.length > 0 && (
        <>
          <strong>{t("movementsTitle")}</strong>
          {report.movements.map((movement) => (
            <p key={movement.id} className="chu-thich" style={{ margin: 0 }}>
              {movement.direction === "in" ? "+" : "−"}
              {formatNumber(movement.amount)} · {movement.reason} · {movement.memberName}
            </p>
          ))}
        </>
      )}
      {!report.shift.closedAt && (
        <form
          style={{ display: "grid", gap: "var(--khoang-3)", marginTop: "var(--khoang-4)" }}
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              onClosed(
                await portalFetch<IposShiftReport>(`/merchant-portal/ipos/shifts/${report.shift.id}/close`, {
                  method: "POST",
                  body: JSON.stringify({ countedCash: counted, denominations: null, differenceReason: difference === 0 ? null : reason, leftCash: left }),
                }),
              );
            });
          }}
        >
          <strong>{t("closeOnBehalf")}</strong>
          <p className="chu-thich">{t("closeOnBehalfHint")}</p>
          <div className="luoi-so">
            <Field id="dh-dem" label={t("countedCash")} error={fields.countedCash}>
              <input id="dh-dem" className={inputClass("countedCash")} inputMode="numeric" value={counted} onChange={(event) => setCounted(event.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field id="dh-de-lai" label={t("leftCash")} error={fields.leftCash}>
              <input id="dh-de-lai" className={inputClass("leftCash")} inputMode="numeric" value={left} onChange={(event) => setLeft(event.target.value.replace(/\D/g, ""))} />
            </Field>
          </div>
          <p>{t("differencePreview", { amount: formatNumber(difference) })}</p>
          {difference !== 0 && (
            <Field id="dh-ly-do" label={t("differenceReason")} error={fields.differenceReason}>
              <input id="dh-ly-do" className={inputClass("differenceReason")} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          )}
          <FormError text={formError} />
          <div className="nhom-nut">
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || counted === "" || (difference !== 0 && !reason.trim())}>
              {t("closeOnBehalf")}
            </button>
          </div>
        </form>
      )}
    </Drawer>
  );
}

export default function IposShiftsPage() {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const [period, setPeriod] = useState<IposPeriodValue>({ from: daysAgo(6), to: vietnamToday(), outletId: "" });
  const { state, reload } = usePortalApi<IposPortalShiftRow[]>(`/merchant-portal/ipos/shifts?${periodQuery(period)}`);
  const [detail, setDetail] = useState<IposShiftReport | null>(null);
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("shiftsTitle")}</h1>
            </div>
            <IposPeriod value={period} outlets={info.outlets} onChange={setPeriod} />
            <Loaded state={state} onRetry={() => void reload()}>
              {(rows) =>
                rows.length === 0 ? (
                  <MessageView text={t("noShifts")} />
                ) : (
                  <div className="khung-bang">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("outlet")}</th>
                          <th>{t("registerName")}</th>
                          <th>{t("cashier")}</th>
                          <th>{t("openedAt")}</th>
                          <th>{t("closedAt")}</th>
                          <th className="so">{t("revenue")}</th>
                          <th className="so">{t("difference")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id}>
                            <td data-nhan={t("outlet")}>{row.outletName}</td>
                            <td data-nhan={t("registerName")}>
                              <button type="button" className="nut chu" onClick={() => void portalFetch<IposShiftReport>(`/merchant-portal/ipos/shifts/${row.id}`).then(setDetail)}>
                                {row.registerName}
                              </button>
                            </td>
                            <td data-nhan={t("cashier")}>{row.memberName}</td>
                            <td data-nhan={t("openedAt")}>{formatDateTime(row.openedAt)}</td>
                            <td data-nhan={t("closedAt")}>
                              {row.closedAt ? (
                                <>
                                  {formatDateTime(row.closedAt)}
                                  {row.closedByName && row.closedByName !== row.memberName ? <span className="chu-thich"> · {t("closedBy", { name: row.closedByName })}</span> : null}
                                </>
                              ) : (
                                <span className={`nhan ${row.overdue ? "canh-bao" : "thong-tin"}`}>{row.overdue ? t("overdueShift") : t("shiftOpen")}</span>
                              )}
                            </td>
                            <td data-nhan={t("revenue")} className="so">
                              {formatNumber(row.revenue)}
                            </td>
                            <td data-nhan={t("difference")} className="so">
                              {row.difference === null ? "—" : Number(row.difference) === 0 ? "0" : <span className="nhan canh-bao">{formatNumber(row.difference)}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Loaded>
            {detail && (
              <ShiftDrawer
                key={`${detail.shift.id}-${detail.shift.closedAt ?? ""}`}
                report={detail}
                onClose={() => setDetail(null)}
                onClosed={(report) => {
                  notify(t("shiftClosedOnBehalf"));
                  setDetail(report);
                  void reload();
                }}
              />
            )}
          </>
        )
      }
    </Loaded>
  );
}
