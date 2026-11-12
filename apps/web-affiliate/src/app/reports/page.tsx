"use client";

// MAN_HINH_176 Báo cáo và đối soát (chủ cửa hàng; CONG_VIEC_55; CHUC_NANG_196; API_212): thẻ Đối soát – bảng tuần, chi tiết giao dịch, xác nhận, khiếu nại, công nợ.
// Thẻ Báo cáo thêm ở lát L4.
import type { AffiliateSettlementDetail, AffiliateSettlementItem, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SettlementBreakdown, SettlementDue, SettlementNet, SettlementStatus } from "ui/components/AffiliateSettlement";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

function SettlementDrawer({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("affiliateSettlement");
  const { state, reload } = usePortalApi<AffiliateSettlementDetail>(`/merchant-portal/settlements/${id}`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const act = (settlement: AffiliateSettlementDetail, action: "confirm" | "dispute") =>
    void run(async () => {
      await portalFetch(`/merchant-portal/settlements/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "dispute" ? { reason, version: settlement.version } : { version: settlement.version }),
      });
      onDone(t(`done_${action}`));
    });
  return (
    <Drawer title={t("detailTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settlement) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <div style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
              <strong>{settlement.documentNo}</strong>
              <SettlementStatus settlement={settlement} />
            </div>
            <SettlementBreakdown settlement={settlement} />
            {settlement.status === "awaiting_confirmation" && (
              <>
                <p className="chu-thich" style={{ margin: 0 }}>
                  {t("confirmHint")}
                </p>
                {disputing && (
                  <Field id="ly-do-khieu-nai" label={t("disputeReason")} error={fields.reason}>
                    <textarea id="ly-do-khieu-nai" className={inputClass("reason")} rows={3} value={reason} placeholder={t("disputePlaceholder")} onChange={(event) => setReason(event.target.value)} />
                  </Field>
                )}
                <FormError text={formError} />
                <div className="nhom-nut">
                  {disputing ? (
                    <>
                      <button type="button" className="nut phu" onClick={() => setDisputing(false)}>
                        {t("cancel")}
                      </button>
                      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => act(settlement, "dispute")}>
                        {t("sendDispute")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="nut phu" onClick={() => setDisputing(true)}>
                        {t("dispute")}
                      </button>
                      <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => act(settlement, "confirm")}>
                        {t("confirm")}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

export default function ReportsPage() {
  const t = useTranslations("affiliateSettlement");
  const portal = useTranslations("merchantPortal");
  const { notify } = usePortal();
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { state, reload } = usePortalApi<PageResponse<AffiliateSettlementItem>>(`/merchant-portal/settlements?pageSize=100${status ? `&status=${status}` : ""}`);
  const awaiting = state.kind === "ready" ? state.data.data.filter((item) => item.status === "awaiting_confirmation").length : 0;
  return (
    <>
      <div className="tieu-de">
        <h1>{portal("menu_reports")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        <button type="button" role="tab" aria-selected="true" className="chon">
          {t("tab")} {awaiting > 0 && <span className="huy-hieu">{awaiting}</span>}
        </button>
      </div>
      <div className="bo-loc">
        <label htmlFor="loc-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {(["awaiting_confirmation", "disputed", "confirmed", "paid"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("column_no")}</th>
                    <th>{t("column_week")}</th>
                    <th className="so">{t("column_net")}</th>
                    <th>{t("column_status")}</th>
                    <th>{t("column_due")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("column_no")}>
                        <button type="button" className="nut chu" onClick={() => setOpen(item.id)}>
                          {item.documentNo}
                        </button>
                      </td>
                      <td data-nhan={t("column_week")}>
                        {formatDate(item.weekStart)} – {formatDate(item.weekEnd)}
                      </td>
                      <td data-nhan={t("column_net")} className="so">
                        <SettlementNet settlement={item} />
                      </td>
                      <td data-nhan={t("column_status")}>
                        <SettlementStatus settlement={item} />
                      </td>
                      <td data-nhan={t("column_due")}>
                        <SettlementDue settlement={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {open && (
        <SettlementDrawer
          id={open}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            notify(message);
            void reload();
          }}
        />
      )}
    </>
  );
}
