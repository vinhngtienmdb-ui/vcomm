"use client";

// MAN_HINH_57 Cài đặt hoa hồng (CHUC_NANG_80; QUYTAC_NGHIEPVU_108; API_93): cách gán, cách kết hợp, mức, hệ số kênh, bậc hệ số; thẻ chỉ tiêu tháng.
import type { CommissionSettingsResponse, CommissionTargetsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function CommissionSettingsPage() {
  const t = useTranslations("commissionSettings");
  const [tab, setTab] = useState<"settings" | "targets">("settings");
  const { state, reload } = useApi<CommissionSettingsResponse>("/finance/commission-settings");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="commission_settings" />
      </div>
      <div className="cac-the" role="tablist">
        {(["settings", "targets"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab === "settings" ? (
        <Loaded state={state} onRetry={() => void reload()}>
          {(settings) => <SettingsForm key={settings.version} settings={settings} onSaved={() => void reload()} />}
        </Loaded>
      ) : (
        <Targets />
      )}
    </>
  );
}

function SettingsForm({ settings, onSaved }: { settings: CommissionSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("commissionSettings");
  const { notify } = useAdmin();
  const [form, setForm] = useState({ ...settings });
  const [rates, setRates] = useState(settings.rates);
  const [factors, setFactors] = useState(settings.channelFactors);
  const [tiers, setTiers] = useState(settings.tiers);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const disabled = !settings.canSetup;
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const matrix = form.combination === "matrix";
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/finance/commission-settings", {
        method: "PUT",
        body: JSON.stringify({
          enabled: form.enabled,
          startDate: form.startDate || null,
          assignment: form.assignment,
          combination: form.combination,
          defaultPercent: form.defaultPercent,
          tiers,
          rates: rates.filter((rate) => rate.categoryId).map((rate) => ({ ...rate, channelId: matrix ? rate.channelId : null })),
          channelFactors: matrix ? [] : factors.filter((factor) => factor.channelId),
          version: settings.version,
        }),
      });
      notify(t("saved"));
      onSaved();
    });
  }
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" } as const;
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      {disabled && <p className="chu-thich">{t("readOnly")}</p>}
      <label>
        <input type="checkbox" disabled={disabled} checked={form.enabled} onChange={(event) => set("enabled", event.target.checked)} /> {t("enabled")}
      </label>
      <div style={grid}>
        <Field id="hh-ngay-bat-dau" label={t("startDate")} error={fields.startDate}>
          <input
            id="hh-ngay-bat-dau"
            type="date"
            disabled={disabled}
            className={inputClass("startDate")}
            value={form.startDate ?? ""}
            onChange={(event) => set("startDate", event.target.value || null)}
          />
        </Field>
        <Field id="hh-cach-gan" label={t("assignment")}>
          <select id="hh-cach-gan" disabled={disabled} className="o-nhap" value={form.assignment} onChange={(event) => set("assignment", event.target.value as typeof form.assignment)}>
            <option value="customer_owner">{t("assignment_customer_owner")}</option>
            <option value="order_creator">{t("assignment_order_creator")}</option>
          </select>
        </Field>
        <Field id="hh-ket-hop" label={t("combination")}>
          <select id="hh-ket-hop" disabled={disabled} className="o-nhap" value={form.combination} onChange={(event) => set("combination", event.target.value as typeof form.combination)}>
            <option value="matrix">{t("combination_matrix")}</option>
            <option value="channel_factor">{t("combination_channel_factor")}</option>
          </select>
        </Field>
        <Field id="hh-mac-dinh" label={t("defaultPercent")} error={fields.defaultPercent}>
          <input
            id="hh-mac-dinh"
            inputMode="decimal"
            disabled={disabled}
            className={inputClass("defaultPercent")}
            value={form.defaultPercent}
            onChange={(event) => set("defaultPercent", event.target.value)}
          />
        </Field>
      </div>
      <strong>{t("rates")}</strong>
      <span className="chu-thich">{matrix ? t("ratesHintMatrix") : t("ratesHintFactor")}</span>
      {rates.map((rate, index) => (
        <div key={index} className="nhom-nut" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Field id={`hh-nganh-${index}`} label={t("category")} error={fields[`rates.${index}.categoryId`]}>
            <select
              id={`hh-nganh-${index}`}
              disabled={disabled}
              className="o-nhap"
              value={rate.categoryId}
              onChange={(event) => setRates(rates.map((item, position) => (position === index ? { ...item, categoryId: event.target.value } : item)))}
            >
              <option value="">{t("chooseCategory")}</option>
              {settings.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} · {category.name}
                </option>
              ))}
            </select>
          </Field>
          {matrix && (
            <Field id={`hh-kenh-${index}`} label={t("channel")} error={fields[`rates.${index}.channelId`]}>
              <select
                id={`hh-kenh-${index}`}
                disabled={disabled}
                className="o-nhap"
                value={rate.channelId ?? ""}
                onChange={(event) => setRates(rates.map((item, position) => (position === index ? { ...item, channelId: event.target.value || null } : item)))}
              >
                <option value="">{t("allChannels")}</option>
                {settings.channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field id={`hh-phan-tram-${index}`} label={t("percent")} error={fields[`rates.${index}.percent`]}>
            <input
              id={`hh-phan-tram-${index}`}
              inputMode="decimal"
              disabled={disabled}
              className={inputClass(`rates.${index}.percent`)}
              style={{ width: "7rem" }}
              value={rate.percent}
              onChange={(event) => setRates(rates.map((item, position) => (position === index ? { ...item, percent: event.target.value } : item)))}
            />
          </Field>
          {!disabled && (
            <button type="button" className="nut chu" style={{ alignSelf: "end" }} onClick={() => setRates(rates.filter((_, position) => position !== index))}>
              {t("remove")}
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setRates([...rates, { categoryId: "", channelId: null, percent: "" }])}>
          {t("addRate")}
        </button>
      )}
      {!matrix && (
        <>
          <strong>{t("channelFactors")}</strong>
          {factors.map((factor, index) => (
            <div key={index} className="nhom-nut" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <Field id={`hh-he-so-kenh-${index}`} label={t("channel")} error={fields[`channelFactors.${index}.channelId`]}>
                <select
                  id={`hh-he-so-kenh-${index}`}
                  disabled={disabled}
                  className="o-nhap"
                  value={factor.channelId}
                  onChange={(event) => setFactors(factors.map((item, position) => (position === index ? { ...item, channelId: event.target.value } : item)))}
                >
                  <option value="">{t("chooseChannel")}</option>
                  {settings.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`hh-he-so-${index}`} label={t("factor")} error={fields[`channelFactors.${index}.factor`]}>
                <input
                  id={`hh-he-so-${index}`}
                  inputMode="decimal"
                  disabled={disabled}
                  className={inputClass(`channelFactors.${index}.factor`)}
                  style={{ width: "7rem" }}
                  value={factor.factor}
                  onChange={(event) => setFactors(factors.map((item, position) => (position === index ? { ...item, factor: event.target.value } : item)))}
                />
              </Field>
              {!disabled && (
                <button type="button" className="nut chu" style={{ alignSelf: "end" }} onClick={() => setFactors(factors.filter((_, position) => position !== index))}>
                  {t("remove")}
                </button>
              )}
            </div>
          ))}
          {!disabled && (
            <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setFactors([...factors, { channelId: "", factor: "1" }])}>
              {t("addFactor")}
            </button>
          )}
        </>
      )}
      <strong>{t("tiers")}</strong>
      <span className="chu-thich">{t("tiersHint")}</span>
      {fields.tiers && <span className="loi-o">{fields.tiers}</span>}
      {tiers.map((tier, index) => (
        <div key={index} className="nhom-nut" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Field id={`hh-bac-tu-${index}`} label={t("fromPercent")} error={fields[`tiers.${index}.fromPercent`]}>
            <input
              id={`hh-bac-tu-${index}`}
              inputMode="decimal"
              disabled={disabled}
              className={inputClass(`tiers.${index}.fromPercent`)}
              style={{ width: "7rem" }}
              value={tier.fromPercent}
              onChange={(event) => setTiers(tiers.map((item, position) => (position === index ? { ...item, fromPercent: event.target.value } : item)))}
            />
          </Field>
          <Field id={`hh-bac-he-so-${index}`} label={t("multiplier")} error={fields[`tiers.${index}.multiplier`]}>
            <input
              id={`hh-bac-he-so-${index}`}
              inputMode="decimal"
              disabled={disabled}
              className={inputClass(`tiers.${index}.multiplier`)}
              style={{ width: "7rem" }}
              value={tier.multiplier}
              onChange={(event) => setTiers(tiers.map((item, position) => (position === index ? { ...item, multiplier: event.target.value } : item)))}
            />
          </Field>
          {!disabled && tiers.length > 1 && (
            <button type="button" className="nut chu" style={{ alignSelf: "end" }} onClick={() => setTiers(tiers.filter((_, position) => position !== index))}>
              {t("remove")}
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setTiers([...tiers, { fromPercent: "", multiplier: "1" }])}>
          {t("addTier")}
        </button>
      )}
      <FormError text={formError} />
      {!disabled && (
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      )}
    </form>
  );
}

function Targets() {
  const t = useTranslations("commissionSettings");
  const { notify } = useAdmin();
  const [month, setMonth] = useState(vietnamToday().slice(0, 7));
  const { state, reload } = useApi<CommissionTargetsResponse>(`/finance/commission-targets?month=${month}`);
  return (
    <>
      <div className="bo-loc">
        <label htmlFor="hh-thang-chi-tieu">{t("month")}</label>
        <input id="hh-thang-chi-tieu" type="month" className="o-nhap" style={{ width: "auto" }} value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => (
          <TargetsForm
            key={`${data.month}-${data.staff.map((item) => item.amount).join(",")}`}
            data={data}
            onSaved={() => {
              notify(t("targetsSaved"));
              void reload();
            }}
          />
        )}
      </Loaded>
    </>
  );
}

function TargetsForm({ data, onSaved }: { data: CommissionTargetsResponse; onSaved: () => void }) {
  const t = useTranslations("commissionSettings");
  const [amounts, setAmounts] = useState(new Map(data.staff.map((item) => [item.userId, item.amount ?? ""])));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/finance/commission-targets", {
        method: "PUT",
        body: JSON.stringify({ month: data.month, targets: data.staff.map((item) => ({ userId: item.userId, amount: amounts.get(item.userId)?.trim() || null })) }),
      });
      onSaved();
    });
  }
  const headings = [t("staff"), t("target")];
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <span className="chu-thich">{t("targetHint")}</span>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {headings.map((heading) => (
                <th key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.staff.map((item, index) => (
              <tr key={item.userId}>
                <td data-nhan={headings[0]}>
                  <label htmlFor={`hh-chi-tieu-${index}`}>{item.fullName}</label>
                </td>
                <td data-nhan={headings[1]}>
                  <input
                    id={`hh-chi-tieu-${index}`}
                    inputMode="decimal"
                    disabled={!data.canSetup}
                    className={inputClass(`targets.${index}.amount`)}
                    value={amounts.get(item.userId) ?? ""}
                    onChange={(event) => setAmounts(new Map(amounts).set(item.userId, event.target.value))}
                  />
                  {fields[`targets.${index}.amount`] && <span className="loi-o">{fields[`targets.${index}.amount`]}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormError text={formError} />
      {data.canSetup && (
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      )}
    </form>
  );
}
