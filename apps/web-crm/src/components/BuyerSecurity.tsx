"use client";

// Khối "Bảo mật đăng nhập" của MAN_HINH_80 (CONG_VIEC_72; QUYTAC_NGHIEPVU_567; API_322).
// Người có quyền xem người mua thấy trạng thái Smart OTP, khóa dùng điểm, thiết bị tin cậy; người có marketplace.buyer.security hủy Smart OTP kèm lý do.
import type { BuyerSecurityResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export function BuyerSecurity({ userId, buyerName }: { userId: string; buyerName: string }) {
  const t = useTranslations("buyerSecurity");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state, reload } = useApi<BuyerSecurityResponse>(`/marketplace/buyers/${userId}/security`);
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function revoke(version: number) {
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      await apiFetch(`/marketplace/buyers/${userId}/smart-otp/revoke`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), version }) });
      notify(t("revoked"));
      setRevoking(false);
      setReason("");
      await reload();
    } catch (failure) {
      const { message, fields } = failureOf(failure);
      setError(message);
      setFieldError(fields.reason ?? null);
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "forbidden") return null;
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--khoang-2)", flexWrap: "wrap" }}>
              <h2>{t("title")}</h2>
              {data.canRevoke && data.smartOtp.active ? (
                <button type="button" className="nut nguy-hiem" onClick={() => setRevoking(true)}>
                  {t("revoke")}
                </button>
              ) : null}
            </div>
            <dl style={{ display: "grid", gridTemplateColumns: "minmax(140px, max-content) 1fr", gap: "var(--khoang-2) var(--khoang-4)", margin: 0 }}>
              <dt className="chu-thich">{t("smartOtp")}</dt>
              <dd style={{ margin: 0 }}>
                {data.smartOtp.active ? (
                  <>
                    <span className="nhan thanh-cong">{t("active")}</span>{" "}
                    {t("device", { device: data.smartOtp.deviceName ?? "", platform: t(`platform_${data.smartOtp.platform ?? "android"}`), date: formatDateTime(data.smartOtp.activatedAt) })}
                  </>
                ) : (
                  <span className="nhan trung-tinh">{t("inactive")}</span>
                )}
              </dd>
              <dt className="chu-thich">{t("redeemLock")}</dt>
              <dd style={{ margin: 0 }}>
                {data.redeemLockedUntil ? (
                  <>
                    <span className="nhan canh-bao">{t("lockedUntil", { time: formatDateTime(data.redeemLockedUntil) })}</span>
                    {data.recoveredAt ? ` ${t("recoveredAt", { time: formatDateTime(data.recoveredAt) })}` : null}
                  </>
                ) : (
                  t("notLocked")
                )}
              </dd>
              <dt className="chu-thich">{t("wrongCodes")}</dt>
              <dd style={{ margin: 0 }}>{data.smartOtp.lockedUntil ? t("codeLockedUntil", { time: formatDateTime(data.smartOtp.lockedUntil) }) : t("codeNotLocked")}</dd>
              <dt className="chu-thich">{t("trustedDevices")}</dt>
              <dd style={{ margin: 0 }}>{data.lastSeenAt ? t("trustedCount", { count: data.trustedDevices, time: formatDateTime(data.lastSeenAt) }) : t("trustedNone")}</dd>
              <dt className="chu-thich">{t("transition")}</dt>
              <dd style={{ margin: 0 }}>{t("transitionUntil", { date: formatDate(data.buyerTransitionEndsOn) })}</dd>
            </dl>
            {revoking && data.smartOtp.version !== null ? (
              <div className="man-che giua">
                <div className="hop-thoai" role="dialog" aria-modal="true" aria-labelledby="tieu-de-huy-smart-otp" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                  <h2 id="tieu-de-huy-smart-otp">{t("revokeTitle", { name: buyerName })}</h2>
                  <div className="khoi-canh-bao canh-bao">{t("revokeWarning")}</div>
                  <div className="truong">
                    <label htmlFor="ly-do-huy-smart-otp">{t("reason")}</label>
                    <textarea
                      id="ly-do-huy-smart-otp"
                      className={`o-nhap${fieldError ? " loi" : ""}`}
                      rows={3}
                      maxLength={500}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      aria-invalid={Boolean(fieldError)}
                    />
                    <span className="chu-thich">{t("reasonHint")}</span>
                  </div>
                  <FormError text={error} />
                  <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
                    <button type="button" className="nut phu" onClick={() => setRevoking(false)}>
                      {common("cancel")}
                    </button>
                    <button type="button" className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`} disabled={busy || reason.trim().length < 10} onClick={() => void revoke(data.smartOtp.version!)}>
                      {t("revoke")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Loaded>
    </div>
  );
}
