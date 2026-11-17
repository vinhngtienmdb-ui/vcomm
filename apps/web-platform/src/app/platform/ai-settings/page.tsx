"use client";

// MAN_HINH_244 Cài đặt trợ lý AI (CHUC_NANG_226; API_278; QUYTAC_NGHIEPVU_510, 511, 515).
import type { AiSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function AiSettingsPage() {
  const { state, reload } = useApi<AiSettingsResponse>("/ai/settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => <AiSettingsForm key={data.version} data={data} onSaved={() => void reload()} />}
    </Loaded>
  );
}

function AiSettingsForm({ data, onSaved }: { data: AiSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("aiSettings");
  const notice = useTranslations("aiNotice");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [values, setValues] = useState({
    chatEnabled: data.chatEnabled,
    productContentEnabled: data.productContentEnabled,
    monthlyBudgetUsd: data.monthlyBudgetUsd,
    dailyTurnsPerUser: String(data.dailyTurnsPerUser),
  });
  const [showNotice, setShowNotice] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const readOnly = !data.canManage;
  const budget = Number(data.monthlyBudgetUsd);
  const typedBudget = Number(values.monthlyBudgetUsd.replace(",", "."));
  const month = `${data.month.slice(5, 7)}/${data.month.slice(0, 4)}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/ai/settings", {
        method: "PATCH",
        body: JSON.stringify({
          chatEnabled: values.chatEnabled,
          productContentEnabled: values.productContentEnabled,
          monthlyBudgetUsd: values.monthlyBudgetUsd.trim().replace(",", "."),
          dailyTurnsPerUser: Number(values.dailyTurnsPerUser),
          version: data.version,
        }),
      });
      notify(t("saved"));
      onSaved();
    });
  }

  const rows: [string, ReactNode][] = [
    [
      t("providerName"),
      <span key="nha-cung-cap" className="nhom-nut">
        <span>{data.provider ? t(`provider_${data.provider}` as "provider_anthropic") : common("none")}</span>
        <span className={`nhan ${data.configured ? "thanh-cong" : "canh-bao"}`}>{data.configured ? t("configured") : t("notConfigured")}</span>
      </span>,
    ],
    [t("model"), data.model ? t("modelHint", { model: data.model }) : common("none")],
    [t("prices"), t("pricesValue", { input: data.prices.input, output: data.prices.output })],
    [t("redacted"), t("redactedValue")],
    [t("retention"), t("retentionValue")],
    [
      t("notice"),
      <span key="thong-bao" className="nhom-nut">
        <span>{t("noticeValue", { version: data.notice.version, count: data.notice.acknowledgedUsers })}</span>
        <button type="button" className="nut chu" aria-expanded={showNotice} onClick={() => setShowNotice((current) => !current)}>
          {showNotice ? t("hideNotice") : t("showNotice")}
        </button>
      </span>,
    ],
  ];

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="ai_settings" />
      </div>
      {!data.configured && (
        <div className="khoi-canh-bao canh-bao" role="status">
          {t("notConfiguredWarning")}
        </div>
      )}
      {readOnly && <div className="chu-thich">{t("readOnly")}</div>}
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <section className="the">
          <h2 style={{ margin: 0 }}>{t("features")}</h2>
          {(["chatEnabled", "productContentEnabled"] as const).map((key) => (
            <label key={key} style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "flex-start" }}>
              <input type="checkbox" checked={values[key]} disabled={readOnly} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))} />
              <span>
                <strong>{t(key)}</strong>
                <br />
                <span className="chu-thich">{t(key === "chatEnabled" ? "chatHint" : "productContentHint")}</span>
              </span>
            </label>
          ))}
        </section>
        <section className="the">
          <h2 style={{ margin: 0 }}>{t("limits")}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--khoang-4)", alignItems: "start" }}>
            <Field
              id="han-muc-thang"
              label={t("monthlyBudget")}
              error={fields.monthlyBudgetUsd}
              hint={
                data.usdToVnd && Number.isFinite(typedBudget)
                  ? t("budgetVnd", { amount: formatMoney(String(Math.round(typedBudget * Number(data.usdToVnd.rate))), "VND"), date: formatDate(data.usdToVnd.date) })
                  : t("budgetNoRate")
              }
            >
              <input
                id="han-muc-thang"
                inputMode="decimal"
                className={inputClass("monthlyBudgetUsd")}
                value={values.monthlyBudgetUsd}
                disabled={readOnly}
                onChange={(event) => setValues((current) => ({ ...current, monthlyBudgetUsd: event.target.value }))}
              />
            </Field>
            <Field id="luot-moi-ngay" label={t("dailyTurns")} error={fields.dailyTurnsPerUser}>
              <input
                id="luot-moi-ngay"
                inputMode="numeric"
                className={inputClass("dailyTurnsPerUser")}
                value={values.dailyTurnsPerUser}
                disabled={readOnly}
                onChange={(event) => setValues((current) => ({ ...current, dailyTurnsPerUser: event.target.value }))}
              />
            </Field>
          </div>
          <div className="khoi-canh-bao thong-tin" role="status">
            {budget > 0
              ? t("spent", { month, spent: formatNumber(data.spentThisMonthUsd, 2), budget: formatNumber(data.monthlyBudgetUsd, 2), percent: formatNumber((Number(data.spentThisMonthUsd) / budget) * 100, 0) })
              : t("spentNoBudget", { month, spent: formatNumber(data.spentThisMonthUsd, 2) })}
          </div>
        </section>
        <section className="the">
          <h2 style={{ margin: 0 }}>{t("provider")}</h2>
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("item")}</th>
                  <th scope="col">{t("value")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <td data-nhan={t("item")}>
                      <span>{label}</span>
                    </td>
                    <td data-nhan={t("value")}>{typeof value === "string" ? <span>{value}</span> : value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showNotice && (
            <div className="the" style={{ background: "var(--mau-nen)" }}>
              <h3 style={{ margin: 0 }}>{notice("title", { version: data.notice.version })}</h3>
              <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
                {(["sent", "redacted", "training", "retention"] as const).map((key) => (
                  <li key={key}>{notice(key)}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <FormError text={formError} />
        {!readOnly && (
          <div className="nhom-nut">
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
              {common("save")}
            </button>
          </div>
        )}
      </form>
    </>
  );
}
