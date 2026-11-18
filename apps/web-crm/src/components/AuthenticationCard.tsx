"use client";

// MAN_HINH_275 Xác thực người mua (CONG_VIEC_72; QUYTAC_NGHIEPVU_561, 572; API_323): tham số chuyển đổi sang Smart OTP, thống kê kích hoạt, số tin SMS.
// Người dùng yêu cầu 2026-11-17 chuyển từ thẻ của MAN_HINH_86 thành mục menu riêng, mở bằng quyền xem tài khoản người mua.
import type { AuthenticationSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";

type Form = { transitionStartsOn: string; buyerTransitionDays: string; portalTransitionDays: string; recoveryRedeemLockHours: string; supportHotline: string };

const formOf = (settings: AuthenticationSettingsResponse): Form => ({
  transitionStartsOn: settings.transitionStartsOn,
  buyerTransitionDays: String(settings.buyerTransitionDays),
  portalTransitionDays: String(settings.portalTransitionDays),
  recoveryRedeemLockHours: String(settings.recoveryRedeemLockHours),
  supportHotline: settings.supportHotline ?? "",
});

const percent = (part: number, total: number) => (total === 0 ? "0" : formatNumber(((part / total) * 100).toFixed(1), 1));

function AuthenticationForm({ initial }: { initial: AuthenticationSettingsResponse }) {
  const t = useTranslations("storeSettings");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [settings, setSettings] = useState(initial);
  const [form, setForm] = useState<Form>(() => formOf(initial));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  useEffect(() => setForm(formOf(settings)), [settings]);
  const set = (key: keyof Form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const disabled = !settings.canManage;
  const statistics = settings.statistics;

  function save() {
    void run(async () => {
      const saved = await apiFetch<AuthenticationSettingsResponse>("/marketplace/authentication-settings", {
        method: "PUT",
        body: JSON.stringify({
          transitionStartsOn: form.transitionStartsOn,
          buyerTransitionDays: Number(form.buyerTransitionDays),
          portalTransitionDays: Number(form.portalTransitionDays),
          recoveryRedeemLockHours: Number(form.recoveryRedeemLockHours),
          supportHotline: form.supportHotline,
          version: settings.version,
        }),
      });
      notify(t("saved"));
      setSettings(saved);
    });
  }

  return (
    <form
      className="the"
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h2>{t("authenticationTitle")}</h2>
      <div className="khoi-canh-bao thong-tin">
        {t("authenticationPeriod", {
          start: formatDate(settings.transitionStartsOn),
          buyerEnd: formatDate(settings.buyerTransitionEndsOn),
          portalEnd: formatDate(settings.portalTransitionEndsOn),
        })}
      </div>
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "start" }}>
        <Field id="xt-bat-dau" label={t("transitionStartsOn")} error={fields.transitionStartsOn} hint={t("transitionStartsOnHint")}>
          <input id="xt-bat-dau" className={inputClass("transitionStartsOn")} type="date" value={form.transitionStartsOn} disabled={disabled} onChange={set("transitionStartsOn")} />
        </Field>
        <Field id="xt-nguoi-mua" label={t("buyerTransitionDays")} error={fields.buyerTransitionDays} hint={t("transitionDaysHint")}>
          <input id="xt-nguoi-mua" className={inputClass("buyerTransitionDays")} type="number" min={1} max={180} value={form.buyerTransitionDays} disabled={disabled} onChange={set("buyerTransitionDays")} />
        </Field>
        <Field id="xt-cong" label={t("portalTransitionDays")} error={fields.portalTransitionDays} hint={t("transitionDaysHint")}>
          <input id="xt-cong" className={inputClass("portalTransitionDays")} type="number" min={1} max={180} value={form.portalTransitionDays} disabled={disabled} onChange={set("portalTransitionDays")} />
        </Field>
        <Field id="xt-khoa" label={t("recoveryRedeemLockHours")} error={fields.recoveryRedeemLockHours} hint={t("recoveryRedeemLockHoursHint")}>
          <input
            id="xt-khoa"
            className={inputClass("recoveryRedeemLockHours")}
            type="number"
            min={0}
            max={168}
            value={form.recoveryRedeemLockHours}
            disabled={disabled}
            onChange={set("recoveryRedeemLockHours")}
          />
        </Field>
        <Field id="xt-tong-dai" label={t("supportHotline")} error={fields.supportHotline} hint={t("supportHotlineHint")}>
          <input id="xt-tong-dai" className={inputClass("supportHotline")} inputMode="tel" value={form.supportHotline} disabled={disabled} onChange={set("supportHotline")} />
        </Field>
      </div>
      <FormError text={formError} />
      {settings.canManage && (
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting}>
            {common("save")}
          </button>
        </div>
      )}
      <h3>{t("activationTitle")}</h3>
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <span className="chu-thich">{t("smartOtpActive")}</span>
          <strong>
            {formatNumber(statistics.smartOtpActive)} / {formatNumber(statistics.activeBuyers)}
          </strong>
          <span className="chu-thich">{t("smartOtpActiveHint", { percent: percent(statistics.smartOtpActive, statistics.activeBuyers), web: formatNumber(statistics.smartOtpOnWeb) })}</span>
        </div>
        <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <span className="chu-thich">{t("portalSetUp")}</span>
          <strong>
            {formatNumber(statistics.portalMembersSetUp)} / {formatNumber(statistics.portalMembers)}
          </strong>
          <span className="chu-thich">{t("percentHint", { percent: percent(statistics.portalMembersSetUp, statistics.portalMembers) })}</span>
        </div>
      </div>
      <h3>{t("smsTitle")}</h3>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th scope="col">{t("smsPurpose")}</th>
              <th scope="col" className="so-tien">
                {t("smsCount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {statistics.smsLast30Days.map((row) => (
              <tr key={row.purpose}>
                <td>{t(`smsPurpose_${row.purpose}`)}</td>
                <td className="so-tien">{formatNumber(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

export function AuthenticationCard() {
  const { state, reload } = useApi<AuthenticationSettingsResponse>("/marketplace/authentication-settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => <AuthenticationForm initial={data} />}
    </Loaded>
  );
}
