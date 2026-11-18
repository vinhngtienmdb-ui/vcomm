"use client";

// MAN_HINH_281 Bảng chuyển tiền thu hộ (CONG_VIEC_73 lát L5; QUYTAC_NGHIEPVU_585; API_333): danh sách theo người nhận, trạng thái; cảnh báo bảng chờ chuyển
// quá 2 ngày làm việc. Công ty vận hành sàn thấy mọi bảng; công ty sở hữu cửa hàng tập đoàn thấy bảng của mình.
import type { InstorePayoutListResponse } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { payoutStatusClass, payoutStatusLabel } from "@/components/InstorePayoutStatus";

export default function InstorePayoutsPage() {
  const t = useTranslations("instorePayouts");
  const [recipientKind, setRecipientKind] = useState<"" | "merchant" | "retail_company">("");
  const [status, setStatus] = useState<"" | "pending" | "transferred">("pending");
  const query = new URLSearchParams({ ...(recipientKind ? { recipientKind } : {}), ...(status ? { status } : {}), pageSize: "50" });
  const { state, reload } = useApi<InstorePayoutListResponse>(`/finance/instore/payouts?${query.toString()}`);
  const money = (value: string) => formatNumber(value, 0);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)" }}>
        <div className="cac-the" role="tablist" aria-label={t("recipient")}>
          {(["", "merchant", "retail_company"] as const).map((value) => (
            <button key={value || "all"} type="button" role="tab" aria-selected={recipientKind === value} className={recipientKind === value ? "chon" : ""} onClick={() => setRecipientKind(value)}>
              {t(`recipient_${value || "all"}`)}
            </button>
          ))}
        </div>
        <div className="cac-the" role="tablist" aria-label={t("status")}>
          {(["pending", "transferred", ""] as const).map((value) => (
            <button key={value || "all"} type="button" role="tab" aria-selected={status === value} className={status === value ? "chon" : ""} onClick={() => setStatus(value)}>
              {t(`filter_${value || "all"}`)}
            </button>
          ))}
        </div>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) => (
          <>
            {result.overdueCount > 0 && (
              <div className="khoi-canh-bao loi" role="alert">
                {t("overdueBanner", { count: result.overdueCount })}
              </div>
            )}
            {result.data.length === 0 ? (
              <MessageView text={t("empty")} />
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["documentNo", "date", "recipient", "collected", "platformFee", "gatewayFee", "reversalCarried", "amount", "status"].map((key) => (
                        <th key={key} scope="col">
                          {t(`column_${key}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("column_documentNo")}>
                          <Link href={`/instore-payouts/${item.id}`}>{item.documentNo}</Link>
                        </td>
                        <td data-nhan={t("column_date")}>{formatDate(item.businessDate)}</td>
                        <td data-nhan={t("column_recipient")}>
                          {item.recipientCode ? `${item.recipientCode} ` : ""}
                          {item.recipientName}
                        </td>
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
                          <span className={`nhan ${payoutStatusClass(item)}`}>{payoutStatusLabel(t, item)}</span>
                          {item.transferredOn && Number(item.amount) > 0 && (
                            <div className="chu-thich">
                              {formatDate(item.transferredOn)} · {item.bankTransactionNo}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Loaded>
    </>
  );
}
