"use client";

// MAN_HINH_280 Biểu phí cổng tại cửa hàng (CONG_VIEC_73 lát L4; QUYTAC_NGHIEPVU_584; API_332): công ty vận hành sàn cài tỷ lệ, số tiền cố định
// cho từng phương thức trực tuyến đang bật. Sửa là thêm mức áp dụng từ ngày (không sửa lùi); phí chốt vào đơn lúc tiền về.
import type { InstoreGatewayFeesRequest, InstoreGatewayFeesResponse, InstoreSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type Draft = { percent: string; fixedAmount: string; effectiveFrom: string };

// Thuế suất phí sàn, phí thu hộ (CONG_VIEC_73 lát L5; mặc định 10 %): dùng khi lập bảng chuyển tiền.
function FeeTaxRate() {
  const t = useTranslations("instoreGatewayFees");
  const { notify } = useAdmin();
  const { state, reload } = useApi<InstoreSettingsResponse>("/finance/instore/settings");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [rate, setRate] = useState("");
  const data = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    if (data) setRate(data.feeTaxRate);
  }, [data]);
  if (!data) return null;
  return (
    <form
      className="the"
      style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)", alignItems: "flex-end" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await apiFetch("/finance/instore/settings", { method: "PUT", body: JSON.stringify({ feeTaxRate: rate, version: data.version }) });
          await reload();
          notify(t("saved"));
        });
      }}
    >
      <Field id="thue-suat-phi" label={t("feeTaxRate")} hint={t("feeTaxRateHint")} error={fields.feeTaxRate}>
        <input id="thue-suat-phi" className={inputClass("feeTaxRate")} inputMode="decimal" disabled={!data.canManage} value={rate} onChange={(event) => setRate(event.target.value)} style={{ maxWidth: "8rem" }} />
      </Field>
      <FormError text={formError} />
      {data.canManage && (
        <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || rate === data.feeTaxRate}>
          {t("save")}
        </button>
      )}
    </form>
  );
}

export default function InstoreGatewayFeesPage() {
  const t = useTranslations("instoreGatewayFees");
  const methods = useTranslations("paymentMethods");
  const { notify } = useAdmin();
  const { state, reload } = useApi<InstoreGatewayFeesResponse>("/finance/instore/gateway-fees");
  const { submitting, formError, run } = useSubmit();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const today = vietnamToday();
  const data = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.rows.map((row) => [row.method, { percent: row.percent ?? "", fixedAmount: row.fixedAmount ?? "", effectiveFrom: today }])));
  }, [data, today]);
  // Gửi các dòng đã đổi so với mức hiện hành (hoặc chưa có mức).
  const changed = (data?.rows ?? []).filter((row) => {
    const draft = drafts[row.method];
    return draft && draft.percent !== "" && draft.fixedAmount !== "" && (draft.percent !== (row.percent ?? "") || draft.fixedAmount !== (row.fixedAmount ?? "") || draft.effectiveFrom !== today);
  });
  const set = (method: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [method]: { ...current[method]!, ...patch } }));
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="instore_gateway_fee" />
      </div>
      <p className="chu-thich">{t("hint")}</p>
      <FeeTaxRate />
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.rows.length === 0 ? (
            <MessageView text={t("noMethods")} />
          ) : (
            <form
              style={{ display: "grid", gap: "var(--khoang-3)" }}
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const body: InstoreGatewayFeesRequest = {
                    rates: changed.map((row) => ({ method: row.method, ...drafts[row.method]! })),
                  };
                  await apiFetch("/finance/instore/gateway-fees", { method: "PUT", body: JSON.stringify(body) });
                  await reload();
                  notify(t("saved"));
                });
              }}
            >
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["gateway", "method", "percent", "fixedAmount", "effectiveFrom", "current"].map((key) => (
                        <th key={key}>{t(`column_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => {
                      const draft = drafts[row.method];
                      return (
                        <tr key={row.method}>
                          <td data-nhan={t("column_gateway")}>{row.gatewayCode.toUpperCase()}</td>
                          <td data-nhan={t("column_method")}>{methods(row.method as never)}</td>
                          <td data-nhan={t("column_percent")}>
                            <input
                              className="o-nhap"
                              inputMode="decimal"
                              aria-label={t("column_percent")}
                              disabled={!result.canManage}
                              value={draft?.percent ?? ""}
                              onChange={(event) => set(row.method, { percent: event.target.value })}
                              style={{ maxWidth: "7rem" }}
                            />
                          </td>
                          <td data-nhan={t("column_fixedAmount")}>
                            <input
                              className="o-nhap"
                              inputMode="numeric"
                              aria-label={t("column_fixedAmount")}
                              disabled={!result.canManage}
                              value={draft?.fixedAmount ?? ""}
                              onChange={(event) => set(row.method, { fixedAmount: event.target.value.replace(/[^\d.]/g, "") })}
                              style={{ maxWidth: "9rem" }}
                            />
                          </td>
                          <td data-nhan={t("column_effectiveFrom")}>
                            <input
                              type="date"
                              className="o-nhap"
                              aria-label={t("column_effectiveFrom")}
                              min={today}
                              disabled={!result.canManage}
                              value={draft?.effectiveFrom ?? today}
                              onChange={(event) => set(row.method, { effectiveFrom: event.target.value })}
                            />
                          </td>
                          <td data-nhan={t("column_current")}>
                            {row.percent === null
                              ? t("none")
                              : t("currentRate", { percent: formatNumber(row.percent, 2), fixed: formatNumber(row.fixedAmount ?? "0", 0), from: formatDate(row.effectiveFrom!) })}
                            {row.scheduled && (
                              <div className="chu-thich">
                                {t("scheduledRate", {
                                  percent: formatNumber(row.scheduled.percent, 2),
                                  fixed: formatNumber(row.scheduled.fixedAmount, 0),
                                  from: formatDate(row.scheduled.effectiveFrom),
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="chu-thich">{t("differenceHint")}</p>
              <FormError text={formError} />
              {result.canManage && (
                <div className="nhom-nut">
                  <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || changed.length === 0}>
                    {t("save")}
                  </button>
                </div>
              )}
            </form>
          )
        }
      </Loaded>
    </>
  );
}
