"use client";

// MAN_HINH_279 phần Thu hộ qua ứng dụng (CONG_VIEC_73 lát L4; QUYTAC_NGHIEPVU_573; API_332): công tắc, phí thu hộ, tài khoản nhận tiền.
// Bật lần đầu phải đánh dấu đã đọc cảnh báo pháp lý. Phần ủy nhiệm lập hóa đơn điện tử ở AffiliateEinvoiceMandate (lát L6).
import type { AffiliateCollectionRequest, AffiliateCollectionResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export function AffiliateCollection({ merchantId, onSaved }: { merchantId: string; onSaved: (message: string) => void }) {
  const t = useTranslations("affiliate");
  const { state, reload } = useApi<AffiliateCollectionResponse>(`/affiliate/merchants/${merchantId}/collection`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [enabled, setEnabled] = useState(false);
  const [feePercent, setFeePercent] = useState("0");
  const [accountId, setAccountId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const data = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setFeePercent(data.feePercent);
    setAccountId(data.payoutBankAccountId ?? "");
    setAcknowledged(false);
  }, [data]);
  return (
    <section className="the">
      <h2>{t("collectionTitle")}</h2>
      <Loaded state={state} onRetry={() => void reload()}>
        {(current) => {
          const firstEnable = enabled && !current.acknowledgedAt;
          const disabled = !current.canManage;
          return (
            <form
              style={{ display: "grid", gap: "var(--khoang-3)" }}
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const body: AffiliateCollectionRequest = { enabled, feePercent, payoutBankAccountId: accountId || null, acknowledged, version: current.version };
                  await apiFetch(`/affiliate/merchants/${merchantId}/collection`, { method: "PATCH", body: JSON.stringify(body) });
                  await reload();
                  onSaved(t("saved"));
                });
              }}
            >
              <label>
                <input type="checkbox" checked={enabled} disabled={disabled} onChange={(event) => setEnabled(event.target.checked)} /> {t("collectionEnabled")}{" "}
                <span className={`nhan ${current.enabled ? "thanh-cong" : "trung-tinh"}`}>{current.enabled ? t("collectionOn") : t("collectionOff")}</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)" }}>
                <Field id="phi-thu-ho" label={t("collectionFeePercent")} hint={t("collectionFeeHint")} error={fields.feePercent}>
                  <input id="phi-thu-ho" className={inputClass("feePercent")} inputMode="decimal" disabled={disabled} value={feePercent} onChange={(event) => setFeePercent(event.target.value)} style={{ maxWidth: "10rem" }} />
                </Field>
                <Field id="tai-khoan-nhan" label={t("collectionAccount")} error={fields.payoutBankAccountId}>
                  <select id="tai-khoan-nhan" className={inputClass("payoutBankAccountId")} disabled={disabled} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                    <option value="">{t("collectionAccountNone")}</option>
                    {current.bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.bankName} · {account.accountNo} · {account.accountHolder}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {current.bankAccounts.length === 0 && <p className="chu-thich">{t("collectionNoAccount")}</p>}
              {firstEnable && (
                <div className="khoi-canh-bao canh-bao" role="alert">
                  <p style={{ margin: 0 }}>{t("collectionWarning")}</p>
                  <label>
                    <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> {t("collectionAcknowledge")}
                  </label>
                </div>
              )}
              {current.acknowledgedAt && <p className="chu-thich">{t("collectionAcknowledgedAt", { time: formatDateTime(current.acknowledgedAt) })}</p>}
              <FormError text={formError} />
              {current.canManage && (
                <div className="nhom-nut">
                  <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || (firstEnable && !acknowledged)}>
                    {t("save")}
                  </button>
                </div>
              )}
            </form>
          );
        }}
      </Loaded>
    </section>
  );
}
