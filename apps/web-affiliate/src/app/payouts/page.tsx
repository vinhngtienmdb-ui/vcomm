"use client";

// MAN_HINH_282 Tiền thu hộ (CONG_VIEC_73 lát L5; QUYTAC_NGHIEPVU_585; API_333): chủ cửa hàng xem bảng chuyển tiền thu hộ của cửa hàng và các đơn trong bảng.
// Bảng đối soát điểm tuần (MAN_HINH_176) giữ nguyên, độc lập với bảng này.
import type { InstorePayoutDetail, InstorePayoutItem, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

const statusClass = (item: InstorePayoutItem) => (item.status === "transferred" ? "thanh-cong" : "canh-bao");

function Lines({ id }: { id: string }) {
  const t = useTranslations("instorePayouts");
  const [detail, setDetail] = useState<InstorePayoutDetail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void portalFetch<InstorePayoutDetail>(`/merchant-portal/payouts/${id}`)
      .then(setDetail)
      .catch(() => setFailed(true));
  }, [id]);
  if (!detail) return failed ? <MessageView text={t("empty")} /> : null;
  return (
    <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
      {detail.lines.map((line) => (
        <div key={line.checkoutId} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--khoang-2)" }}>
          <span>
            {line.documentNo ?? line.checkoutNo} · {formatDateTime(line.paidAt)} · {line.placeName}
          </span>
          <span>
            {formatNumber(line.collectedAmount, 0)} − {formatNumber(String(Number(line.platformFee) + Number(line.gatewayFee)), 0)}
          </span>
        </div>
      ))}
      {detail.deductions.map((line) => (
        <div key={line.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--khoang-2)" }}>
          <span>
            {t(`deduction_${line.kind}`)} · {line.note ?? ""}
          </span>
          <span>− {formatNumber(line.amount, 0)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MerchantPayoutsPage() {
  const t = useTranslations("instorePayouts");
  const portal = useTranslations("merchantPortal");
  const [open, setOpen] = useState<string | null>(null);
  const { state, reload } = usePortalApi<PageResponse<InstorePayoutItem>>("/merchant-portal/payouts?pageSize=50");
  const money = (value: string) => formatNumber(value, 0);
  return (
    <>
      <div className="tieu-de">
        <h1>{portal("menu_payouts")}</h1>
      </div>
      <p className="chu-thich">{portal("payoutsHint")}</p>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {["documentNo", "date", "collected", "platformFee", "gatewayFee", "reversalCarried", "amount", "status"].map((key) => (
                      <th key={key} scope="col">
                        {t(`column_${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.flatMap((item) => [
                    <tr key={item.id}>
                      <td data-nhan={t("column_documentNo")}>
                        <button type="button" className="nut chu" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                          {item.documentNo}
                        </button>
                      </td>
                      <td data-nhan={t("column_date")}>{formatDate(item.businessDate)}</td>
                      <td data-nhan={t("column_collected")}>{money(item.collectedAmount)}</td>
                      <td data-nhan={t("column_platformFee")}>{money(String(Number(item.platformFee) + Number(item.platformFeeTax)))}</td>
                      <td data-nhan={t("column_gatewayFee")}>{money(item.gatewayFee)}</td>
                      <td data-nhan={t("column_reversalCarried")}>
                        {money(String(-Number(item.reversalAmount) + Number(item.carriedAmount) - Number(item.deductionAmount)))}
                      </td>
                      <td data-nhan={t("column_amount")}>
                        <strong>{money(item.amount)}</strong>
                      </td>
                      <td data-nhan={t("column_status")}>
                        <span className={`nhan ${statusClass(item)}`}>
                          {item.status === "pending" ? t("statusPending") : Number(item.amount) === 0 ? t("statusNothing") : t("statusTransferred")}
                        </span>
                        {item.transferredOn && Number(item.amount) > 0 && (
                          <div className="chu-thich">
                            {formatDate(item.transferredOn)} · {item.bankTransactionNo}
                          </div>
                        )}
                      </td>
                    </tr>,
                    open === item.id ? (
                      <tr key={`${item.id}-chi-tiet`}>
                        <td colSpan={8}>
                          <Lines id={item.id} />
                        </td>
                      </tr>
                    ) : null,
                  ])}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}
