"use client";

// MAN_HINH_260 Giao dịch đổi điểm đối tác: danh sách đổi ra, đổi vào; chi tiết; hỏi lại, chốt hoàn tất, hoàn điểm cho giao dịch cần xử lý
// (CONG_VIEC_65; CHUC_NANG_237; QUYTAC_NGHIEPVU_543; API_304).
import type { PageResponse, PartnerContractListItem, PartnerExchangeItem, PartnerExchangeStatus } from "contracts";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const statuses: PartnerExchangeStatus[] = ["needs_review", "pending_partner", "otp_pending", "sending", "completed", "failed", "refunded", "expired"];
const exchangeStatusClass: Record<PartnerExchangeStatus, string> = {
  sending: "thong-tin",
  otp_pending: "thong-tin",
  pending_partner: "canh-bao",
  needs_review: "loi",
  completed: "thanh-cong",
  failed: "trung-tinh",
  refunded: "trung-tinh",
  expired: "trung-tinh",
};

function ExchangeDrawer({ exchange, onClose, onChanged }: { exchange: PartnerExchangeItem; onClose: () => void; onChanged: (item: PartnerExchangeItem, message: string) => void }) {
  const t = useTranslations("loyaltyPartner");
  const { can } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [partnerReference, setPartnerReference] = useState("");
  const [reason, setReason] = useState("");
  const canManage = can("loyalty.partner.manage");
  const send = (path: string, body: object, message: string) =>
    void run(async () => {
      const updated = await apiFetch<PartnerExchangeItem>(`/loyalty/partner-exchanges/${exchange.id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      onChanged(updated, message);
    });
  const unit = exchange.unitNameVi;
  const rows: [string, string][] = [
    [t("exchange_contract"), `${exchange.contractCode} · ${exchange.partnerName}`],
    [t("exchange_customer"), `${exchange.customerMasked} · ${exchange.memberNumberMasked}`],
    [t("exchange_points"), `${exchange.direction === "outbound" ? "−" : "+"}${formatNumber(exchange.vcommPoints, 0)}`],
    [t("exchange_units"), `${formatNumber(exchange.partnerUnits, 0)} ${unit}`],
    [
      t("exchange_amount"),
      `${formatNumber(exchange.amount, 0)} ₫ (${formatNumber(exchange.unitPrice, 4)} ₫ / ${unit})${Number(exchange.taxAmount) > 0 ? ` · ${t("exchange_tax")} ${formatNumber(exchange.taxAmount, 0)} ₫` : ""}`,
    ],
    [t("exchange_pointValue"), exchange.pointValueAmount === null ? "—" : `${formatNumber(exchange.pointValueAmount, 0)} ₫`],
    [t("exchange_reference"), exchange.reference],
    [t("exchange_partnerReference"), exchange.partnerReference ?? "—"],
    [t("exchange_attempts"), `${exchange.attempts}${exchange.lastErrorCode ? ` · ${exchange.lastErrorCode}` : ""}`],
    [t("exchange_createdAt"), formatDateTime(exchange.createdAt)],
    [t("exchange_completedAt"), formatDateTime(exchange.completedAt)],
    ...(exchange.resolutionNote ? ([[t("exchange_note"), exchange.resolutionNote]] as [string, string][]) : []),
  ];
  return (
    <Drawer title={`${exchange.documentNo} · ${t(`direction_${exchange.direction}`)}`} onClose={onClose}>
      <span className={`nhan ${exchangeStatusClass[exchange.status]}`}>{t(`exchangeStatus_${exchange.status}`)}</span>
      <div className="khung-bang">
        <table>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {exchange.status === "needs_review" && <div className="khoi-canh-bao loi">{t("needsReviewHint")}</div>}
      {canManage && (exchange.status === "pending_partner" || exchange.status === "needs_review") && (
        <div className="nhom-nut">
          <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => send("recheck", {}, t("rechecked"))}>
            {t("recheck")}
          </button>
        </div>
      )}
      {canManage && exchange.status === "needs_review" && (
        <>
          <Field id="ma-doi-tac" label={t("partnerReferenceInput")} error={fields.partnerReference}>
            <input id="ma-doi-tac" className={inputClass("partnerReference")} value={partnerReference} maxLength={100} onChange={(event) => setPartnerReference(event.target.value)} />
          </Field>
          <button
            type="button"
            className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
            disabled={submitting || !partnerReference.trim()}
            onClick={() => send("resolve", { action: "complete", partnerReference }, t("resolvedComplete"))}
          >
            {t("resolveComplete")}
          </button>
          <Field id="ly-do-hoan" label={t(exchange.direction === "outbound" ? "refundReason" : "failReason")} error={fields.reason}>
            <textarea id="ly-do-hoan" className={inputClass("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <button
            type="button"
            className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
            disabled={submitting || !reason.trim()}
            onClick={() => send("resolve", { action: "refund", reason }, t(exchange.direction === "outbound" ? "resolvedRefund" : "resolvedFail"))}
          >
            {t(exchange.direction === "outbound" ? "resolveRefund" : "resolveFail")}
          </button>
        </>
      )}
      <FormError text={formError} />
    </Drawer>
  );
}

function ExchangesView() {
  const t = useTranslations("loyaltyPartner");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const initial = useSearchParams();
  const [contractId, setContractId] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState(initial.get("status") ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<PartnerExchangeItem | null>(null);
  const contracts = useApi<PageResponse<PartnerContractListItem>>("/loyalty/partners?pageSize=100");
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(contractId ? { contractId } : {}),
    ...(direction ? { direction } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });
  const { state, reload } = useApi<PageResponse<PartnerExchangeItem>>(`/loyalty/partner-exchanges?${params}`);
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("exchangesTitle")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-doi-tac">
          {t("partner")}
        </label>
        <select id="loc-doi-tac" className="o-nhap" value={contractId} onChange={(event) => filter(setContractId)(event.target.value)}>
          <option value="">{t("allPartners")}</option>
          {contracts.state.kind === "ready" &&
            contracts.state.data.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.partnerName}
              </option>
            ))}
        </select>
        <label className="an-nhan" htmlFor="loc-chieu">
          {t("direction")}
        </label>
        <select id="loc-chieu" className="o-nhap" value={direction} onChange={(event) => filter(setDirection)(event.target.value)}>
          <option value="">{t("allDirections")}</option>
          <option value="outbound">{t("direction_outbound")}</option>
          <option value="inbound">{t("direction_inbound")}</option>
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-dl">
          {t("status")}
        </label>
        <select id="loc-trang-thai-dl" className="o-nhap" value={status} onChange={(event) => filter(setStatus)(event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {t(`exchangeStatus_${value}`)}
            </option>
          ))}
        </select>
        <label htmlFor="loc-tu">{t("from")}</label>
        <input id="loc-tu" type="date" className="o-nhap" value={from} onChange={(event) => filter(setFrom)(event.target.value)} />
        <label htmlFor="loc-den">{t("to")}</label>
        <input id="loc-den" type="date" className="o-nhap" value={to} onChange={(event) => filter(setTo)(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noExchanges")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["documentNo", "createdAt", "partner", "direction", "customer", "points", "units", "amount", "status"].map((key) => (
                        <th key={key}>{t(`exchangeColumn_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("exchangeColumn_documentNo")}>
                          <button type="button" className="nut chu" onClick={() => setOpen(item)}>
                            {item.documentNo}
                          </button>
                        </td>
                        <td data-nhan={t("exchangeColumn_createdAt")}>{formatDateTime(item.createdAt)}</td>
                        <td data-nhan={t("exchangeColumn_partner")}>{item.partnerName}</td>
                        <td data-nhan={t("exchangeColumn_direction")}>{t(`direction_${item.direction}`)}</td>
                        <td data-nhan={t("exchangeColumn_customer")}>{item.customerMasked}</td>
                        <td data-nhan={t("exchangeColumn_points")}>{`${item.direction === "outbound" ? "−" : "+"}${formatNumber(item.vcommPoints, 0)}`}</td>
                        <td data-nhan={t("exchangeColumn_units")}>{`${item.direction === "outbound" ? "+" : "−"}${formatNumber(item.partnerUnits, 0)} ${item.unitNameVi}`}</td>
                        <td data-nhan={t("exchangeColumn_amount")}>{formatNumber(item.amount, 0)}</td>
                        <td data-nhan={t("exchangeColumn_status")}>
                          <span className={`nhan ${exchangeStatusClass[item.status]}`}>
                            {t(`exchangeStatus_${item.status}`)}
                            {item.status === "pending_partner" ? ` · ${t("attemptCount", { count: item.attempts })}` : ""}
                          </span>
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
        <ExchangeDrawer
          exchange={open}
          onClose={() => setOpen(null)}
          onChanged={(item, message) => {
            setOpen(item);
            notify(message);
            void reload();
          }}
        />
      )}
    </>
  );
}

export default function PartnerExchangesPage() {
  return (
    <Suspense>
      <ExchangesView />
    </Suspense>
  );
}
