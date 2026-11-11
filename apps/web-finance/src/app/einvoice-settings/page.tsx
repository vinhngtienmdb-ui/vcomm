"use client";

// MAN_HINH_55 Cài đặt hóa đơn điện tử (CHUC_NANG_76; QUYTAC_NGHIEPVU_103; API_92): bật, ngày bắt đầu, nhà cung cấp, thông tin kết nối, loại hóa đơn, ký hiệu theo năm.
import { einvoiceProviders, einvoiceSimulations, type EinvoiceSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

export default function EinvoiceSettingsPage() {
  const t = useTranslations("einvoiceSettings");
  const { state, reload } = useApi<EinvoiceSettingsResponse>("/finance/einvoice-settings");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="einvoice_settings" />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settings) => <SettingsForm key={settings.version} settings={settings} onSaved={() => void reload()} />}
      </Loaded>
    </>
  );
}

function SettingsForm({ settings, onSaved }: { settings: EinvoiceSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("einvoiceSettings");
  const { notify } = useAdmin();
  const [form, setForm] = useState({ ...settings, password: "" });
  const [series, setSeries] = useState(settings.series.map((item) => ({ year: String(item.year), series: item.series })));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [testing, setTesting] = useState(false);
  const errors = useTranslations("errors");
  const disabled = !settings.canSetup;
  async function testConnection() {
    setTesting(true);
    try {
      const result = await apiFetch<{ ok: boolean; message: string | null }>("/finance/einvoice-settings/test", { method: "POST" });
      const message = result.message && errors.has(result.message as never) ? errors(result.message as never) : (result.message ?? "");
      notify(result.ok ? t("connectionOk") : t("connectionFailed", { message }), result.ok ? "thanh-cong" : "loi");
    } catch (failure) {
      notify(failureOf(failure).message, "loi");
    } finally {
      setTesting(false);
    }
  }
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/finance/einvoice-settings", {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.enabled,
          startDate: form.startDate || null,
          provider: form.provider,
          environment: form.environment,
          withTaxCode: form.withTaxCode,
          templateCode: form.templateCode,
          appId: form.appId,
          taxCode: form.taxCode,
          username: form.username,
          ...(form.password ? { password: form.password } : {}),
          simulation: form.simulation,
          series: series.filter((item) => item.year || item.series).map((item) => ({ year: Number(item.year), series: item.series })),
          version: settings.version,
        }),
      });
      notify(t("saved"));
      onSaved();
    });
  }
  const providers = einvoiceProviders.filter((item) => item !== "simulator" || settings.simulatorAllowed || settings.provider === "simulator");
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      {!settings.canSetup && <p className="chu-thich">{t("readOnly")}</p>}
      <label>
        <input type="checkbox" disabled={disabled} checked={form.enabled} onChange={(event) => set("enabled", event.target.checked)} /> {t("enabled")}
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="hd-ngay-bat-dau" label={t("startDate")} hint={t("startDateHint")} error={fields.startDate}>
          <input
            id="hd-ngay-bat-dau"
            type="date"
            disabled={disabled}
            className={inputClass("startDate")}
            value={form.startDate ?? ""}
            onChange={(event) => set("startDate", event.target.value || null)}
          />
        </Field>
        <Field id="hd-nha-cung-cap" label={t("provider")} error={fields.provider}>
          <select id="hd-nha-cung-cap" disabled={disabled} className={inputClass("provider")} value={form.provider} onChange={(event) => set("provider", event.target.value as typeof form.provider)}>
            {providers.map((item) => (
              <option key={item} value={item}>
                {t(`provider_${item}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="hd-moi-truong" label={t("environment")}>
          <select id="hd-moi-truong" disabled={disabled} className="o-nhap" value={form.environment} onChange={(event) => set("environment", event.target.value as typeof form.environment)}>
            <option value="test">{t("environment_test")}</option>
            <option value="production">{t("environment_production")}</option>
          </select>
        </Field>
        <Field id="hd-loai" label={t("invoiceType")}>
          <select id="hd-loai" disabled={disabled} className="o-nhap" value={form.withTaxCode ? "with" : "without"} onChange={(event) => set("withTaxCode", event.target.value === "with")}>
            <option value="with">{t("withTaxCode")}</option>
            <option value="without">{t("withoutTaxCode")}</option>
          </select>
        </Field>
        <Field id="hd-mau-so" label={t("templateCode")}>
          <select id="hd-mau-so" disabled={disabled} className="o-nhap" value={form.templateCode} onChange={(event) => set("templateCode", event.target.value as typeof form.templateCode)}>
            <option value="1">{t("template_1")}</option>
            <option value="2">{t("template_2")}</option>
          </select>
        </Field>
      </div>
      {form.provider === "misa" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
          <Field id="hd-ma-ung-dung" label={`${t("appId")} *`} error={fields.appId}>
            <input id="hd-ma-ung-dung" disabled={disabled} className={inputClass("appId")} value={form.appId ?? ""} onChange={(event) => set("appId", event.target.value || null)} />
          </Field>
          <Field id="hd-ma-so-thue" label={`${t("taxCode")} *`} error={fields.taxCode}>
            <input id="hd-ma-so-thue" disabled={disabled} className={inputClass("taxCode")} value={form.taxCode ?? ""} onChange={(event) => set("taxCode", event.target.value || null)} />
          </Field>
          <Field id="hd-ten-dang-nhap" label={`${t("username")} *`} error={fields.username}>
            <input
              id="hd-ten-dang-nhap"
              autoComplete="off"
              disabled={disabled}
              className={inputClass("username")}
              value={form.username ?? ""}
              onChange={(event) => set("username", event.target.value || null)}
            />
          </Field>
          <Field id="hd-mat-khau" label={`${t("password")} *`} hint={settings.passwordLastFour ? t("passwordKept", { lastFour: settings.passwordLastFour }) : undefined} error={fields.password}>
            <input
              id="hd-mat-khau"
              type="password"
              autoComplete="new-password"
              disabled={disabled}
              className={inputClass("password")}
              value={form.password}
              onChange={(event) => set("password", event.target.value)}
            />
          </Field>
        </div>
      )}
      {form.provider === "simulator" && (
        <Field id="hd-gia-lap" label={t("simulation")} hint={t("simulationHint")}>
          <select id="hd-gia-lap" disabled={disabled} className="o-nhap" value={form.simulation} onChange={(event) => set("simulation", event.target.value as typeof form.simulation)}>
            {einvoiceSimulations.map((item) => (
              <option key={item} value={item}>
                {t(`simulation_${item}`)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
        <strong>{t("series")}</strong>
        <span className="chu-thich">{t("seriesHint")}</span>
        {fields.series && <span className="loi-o">{fields.series}</span>}
        {series.map((item, index) => (
          <div key={index} className="nhom-nut" style={{ alignItems: "flex-start" }}>
            <Field id={`hd-nam-${index}`} label={t("year")} error={fields[`series.${index}.year`]}>
              <input
                id={`hd-nam-${index}`}
                inputMode="numeric"
                disabled={disabled}
                className={inputClass(`series.${index}.year`)}
                style={{ width: "7rem" }}
                value={item.year}
                onChange={(event) => setSeries(series.map((current, position) => (position === index ? { ...current, year: event.target.value } : current)))}
              />
            </Field>
            <Field id={`hd-ky-hieu-${index}`} label={t("seriesCode")} error={fields[`series.${index}.series`]}>
              <input
                id={`hd-ky-hieu-${index}`}
                disabled={disabled}
                className={inputClass(`series.${index}.series`)}
                style={{ width: "9rem", textTransform: "uppercase" }}
                value={item.series}
                onChange={(event) => setSeries(series.map((current, position) => (position === index ? { ...current, series: event.target.value.toUpperCase() } : current)))}
              />
            </Field>
            {!disabled && (
              <button type="button" className="nut chu" style={{ alignSelf: "end" }} onClick={() => setSeries(series.filter((_, position) => position !== index))}>
                {t("removeSeries")}
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setSeries([...series, { year: String(new Date().getFullYear()), series: "" }])}>
            {t("addSeries")}
          </button>
        )}
      </div>
      <FormError text={formError} />
      {!disabled && (
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
          {settings.version > 0 && (
            <button type="button" className={`nut phu${testing ? " dang-xu-ly" : ""}`} disabled={testing} title={t("testHint")} onClick={() => void testConnection()}>
              {t("testConnection")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
