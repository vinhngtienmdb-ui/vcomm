"use client";

// MAN_HINH_180 Đối soát và giao dịch liên kết (CONG_VIEC_55; CHUC_NANG_196; API_212): thẻ Đối soát – bảng tuần mọi cửa hàng, lọc trạng thái, quá hạn;
// chi tiết; trả lời khiếu nại kèm điều chỉnh tiền và chốt lại. Thẻ Giao dịch, Báo cáo, Cảnh báo thêm ở lát L4.
import type { AffiliateMerchantListItem, AffiliateSettlementDetail, AffiliateSettlementItem, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SettlementBreakdown, SettlementNet, SettlementStatus } from "ui/components/AffiliateSettlement";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

function ResolveForm({ settlement, onDone }: { settlement: AffiliateSettlementDetail; onDone: (message: string) => void }) {
  const t = useTranslations("affiliateSettlement");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState({ note: "", adjustmentAmount: "0", adjustmentReason: "" });
  const save = () =>
    void run(async () => {
      const amount = form.adjustmentAmount.replace(/[^\d-]/g, "") || "0";
      await apiFetch(`/affiliate/settlements/${settlement.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ note: form.note, adjustmentAmount: amount, adjustmentReason: form.adjustmentReason || null, version: settlement.version }),
      });
      onDone(t("done_resolve"));
    });
  return (
    <form style={{ display: "grid", gap: "var(--khoang-3)" }} onSubmit={(event) => (event.preventDefault(), save())}>
      <h3 style={{ margin: 0 }}>{t("resolveTitle")}</h3>
      <Field id="dieu-chinh" label={t("field_adjustmentAmount")} error={fields.adjustmentAmount} hint={t("adjustmentHint")}>
        <input id="dieu-chinh" className={inputClass("adjustmentAmount")} value={form.adjustmentAmount} onChange={(event) => setForm({ ...form, adjustmentAmount: event.target.value })} />
      </Field>
      <Field id="ly-do-dieu-chinh" label={t("field_adjustmentReason")} error={fields.adjustmentReason}>
        <input id="ly-do-dieu-chinh" className={inputClass("adjustmentReason")} value={form.adjustmentReason} onChange={(event) => setForm({ ...form, adjustmentReason: event.target.value })} />
      </Field>
      <Field id="tra-loi" label={t("field_note")} error={fields.note}>
        <textarea id="tra-loi" className={inputClass("note")} rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("resolve")}
        </button>
      </div>
    </form>
  );
}

function SettlementDrawer({ id, canManage, onClose, onDone }: { id: string; canManage: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("affiliateSettlement");
  const { state, reload } = useApi<AffiliateSettlementDetail>(`/affiliate/settlements/${id}`);
  return (
    <Drawer title={t("detailTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settlement) => (
          <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <div style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
              <strong>
                {settlement.documentNo} · {settlement.merchantName}
              </strong>
              <SettlementStatus settlement={settlement} />
            </div>
            <SettlementBreakdown settlement={settlement} />
            {settlement.status === "confirmed" && <p className="chu-thich">{t("paymentHint")}</p>}
            {settlement.status === "disputed" && canManage && <ResolveForm settlement={settlement} onDone={onDone} />}
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

export default function AffiliateSettlementsPage() {
  const t = useTranslations("affiliateSettlement");
  const common = useTranslations("common");
  const { can, notify } = useAdmin();
  const [merchantId, setMerchantId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const merchants = useApi<PageResponse<AffiliateMerchantListItem>>("/affiliate/merchants?pageSize=100");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(merchantId ? { merchantId } : {}),
    ...(status === "overdue" ? { overdue: "true" } : status ? { status } : {}),
  });
  const { state, reload } = useApi<PageResponse<AffiliateSettlementItem>>(`/affiliate/settlements?${params}`);
  const money = (value: string) => formatNumber(value, 0);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("companyTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        <button type="button" role="tab" aria-selected="true" className="chon">
          {t("tab")}
        </button>
      </div>
      <div className="bo-loc">
        <label htmlFor="loc-cua-hang" className="an-nhan">
          {t("merchant")}
        </label>
        <select id="loc-cua-hang" className="o-nhap" value={merchantId} onChange={(event) => (setMerchantId(event.target.value), setPage(1))}>
          <option value="">{t("allMerchants")}</option>
          {merchants.state.kind === "ready" &&
            merchants.state.data.data.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
        </select>
        <label htmlFor="loc-trang-thai" className="an-nhan">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          <option value="">{t("allStatuses")}</option>
          {(["awaiting_confirmation", "disputed", "confirmed", "paid"] as const).map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
          <option value="overdue">{t("overdue")}</option>
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("column_no")}</th>
                      <th>{t("merchant")}</th>
                      <th>{t("column_week")}</th>
                      <th className="so">{t("column_a")}</th>
                      <th className="so">{t("column_b")}</th>
                      <th className="so">{t("column_c")}</th>
                      <th className="so">{t("column_fee")}</th>
                      <th className="so">{t("column_net")}</th>
                      <th>{t("column_status")}</th>
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
                        <td data-nhan={t("merchant")}>{item.merchantName}</td>
                        <td data-nhan={t("column_week")}>
                          {formatDate(item.weekStart)} – {formatDate(item.weekEnd)}
                        </td>
                        <td data-nhan={t("column_a")} className="so">
                          {money(String(Number(item.earnedAmount) + Number(item.shortfallAmount)))}
                        </td>
                        <td data-nhan={t("column_b")} className="so">
                          {money(item.redeemedAmount)}
                        </td>
                        <td data-nhan={t("column_c")} className="so">
                          {money(item.companyVoucherAmount)}
                        </td>
                        <td data-nhan={t("column_fee")} className="so">
                          {money(String(Number(item.feeAmount) + Number(item.feeTaxAmount)))}
                        </td>
                        <td data-nhan={t("column_net")} className="so">
                          <SettlementNet settlement={item} />
                        </td>
                        <td data-nhan={t("column_status")}>
                          <SettlementStatus settlement={item} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )
        }
      </Loaded>
      {open && (
        <SettlementDrawer
          id={open}
          canManage={can("affiliate.manage")}
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
