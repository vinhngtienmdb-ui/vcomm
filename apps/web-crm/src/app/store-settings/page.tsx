"use client";

// MAN_HINH_86 Cài đặt bán hàng VComm (CHUC_NANG_113, 117; API_123; QUYTAC_NGHIEPVU_154, 160): kênh bán, kho xuất, phí giao hàng, kích thước gói; bật tắt đơn vị vận chuyển.
// Mở đặt hàng, phương thức thanh toán (CONG_VIEC_25; CHUC_NANG_120; API_130; QUYTAC_NGHIEPVU_163, 164).
// Cài đặt hoa hồng chung: ngưỡng, tỷ lệ khấu trừ thuế, mức rút tối thiểu (CONG_VIEC_26; API_134; QUYTAC_NGHIEPVU_204, 205).
import type { StoreSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

type Form = {
  channelId: string;
  warehouseId: string;
  shippingFee: string;
  freeShippingThreshold: string;
  packageLengthCm: string;
  packageWidthCm: string;
  packageHeightCm: string;
  minimumWeightGrams: string;
};

const formOf = (settings: StoreSettingsResponse): Form => ({
  channelId: settings.channelId ?? "",
  warehouseId: settings.warehouseId ?? "",
  shippingFee: settings.shippingFee,
  freeShippingThreshold: settings.freeShippingThreshold ?? "",
  packageLengthCm: String(settings.packageLengthCm),
  packageWidthCm: String(settings.packageWidthCm),
  packageHeightCm: String(settings.packageHeightCm),
  minimumWeightGrams: String(settings.minimumWeightGrams),
});

function SettingsForm({ settings, onSaved }: { settings: StoreSettingsResponse; onSaved: (value: StoreSettingsResponse) => void }) {
  const t = useTranslations("storeSettings");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [form, setForm] = useState<Form>(() => formOf(settings));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  useEffect(() => setForm(formOf(settings)), [settings]);
  const set = (key: keyof Form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const disabled = !settings.canManage;

  function save() {
    void run(async () => {
      const saved = await apiFetch<StoreSettingsResponse>("/marketplace/store-settings", {
        method: "PUT",
        body: JSON.stringify({
          channelId: form.channelId,
          warehouseId: form.warehouseId,
          shippingFee: form.shippingFee,
          freeShippingThreshold: form.freeShippingThreshold,
          packageLengthCm: Number(form.packageLengthCm),
          packageWidthCm: Number(form.packageWidthCm),
          packageHeightCm: Number(form.packageHeightCm),
          minimumWeightGrams: Number(form.minimumWeightGrams),
          version: settings.version,
        }),
      });
      notify(t("saved"));
      onSaved(saved);
    });
  }

  const size = (key: "packageLengthCm" | "packageWidthCm" | "packageHeightCm") => (
    <Field id={`ch-${key}`} label={t(key)} error={fields[key]}>
      <input id={`ch-${key}`} className={inputClass(key)} type="number" min={1} max={200} value={form[key]} disabled={disabled} onChange={set(key)} />
    </Field>
  );

  return (
    <form
      className="the"
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <h2>{t("storeTitle")}</h2>
      <div className="chu-thich">{t("storeHint", { company: settings.companyName })}</div>
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "start" }}>
        <Field id="ch-kenh" label={t("channel")} error={fields.channelId} hint={t("channelHint")}>
          <select id="ch-kenh" className={inputClass("channelId")} value={form.channelId} disabled={disabled} onChange={set("channelId")}>
            <option value="">{t("choose")}</option>
            {settings.channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ch-kho" label={t("warehouse")} error={fields.warehouseId}>
          <select id="ch-kho" className={inputClass("warehouseId")} value={form.warehouseId} disabled={disabled} onChange={set("warehouseId")}>
            <option value="">{t("choose")}</option>
            {settings.warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ch-phi" label={t("shippingFee")} error={fields.shippingFee}>
          <input id="ch-phi" className={inputClass("shippingFee")} inputMode="decimal" value={form.shippingFee} disabled={disabled} onChange={set("shippingFee")} />
        </Field>
        <Field id="ch-mien-phi" label={t("freeShippingThreshold")} error={fields.freeShippingThreshold} hint={t("freeShippingHint")}>
          <input id="ch-mien-phi" className={inputClass("freeShippingThreshold")} inputMode="decimal" value={form.freeShippingThreshold} disabled={disabled} onChange={set("freeShippingThreshold")} />
        </Field>
      </div>
      <h3>{t("packageTitle")}</h3>
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "start" }}>
        {size("packageLengthCm")}
        {size("packageWidthCm")}
        {size("packageHeightCm")}
        <Field id="ch-khoi-luong" label={t("minimumWeightGrams")} error={fields.minimumWeightGrams} hint={t("minimumWeightHint")}>
          <input
            id="ch-khoi-luong"
            className={inputClass("minimumWeightGrams")}
            type="number"
            min={1}
            max={50000}
            value={form.minimumWeightGrams}
            disabled={disabled}
            onChange={set("minimumWeightGrams")}
          />
        </Field>
      </div>
      <FormError text={formError} />
      {settings.canManage && (
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting || !form.channelId || !form.warehouseId}>
            {common("save")}
          </button>
        </div>
      )}
    </form>
  );
}

function Carriers({ settings, onSaved }: { settings: StoreSettingsResponse; onSaved: (value: StoreSettingsResponse) => void }) {
  const t = useTranslations("storeSettings");
  const { notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle(code: string, isEnabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiFetch<StoreSettingsResponse>(`/marketplace/carriers/${code}`, { method: "PUT", body: JSON.stringify({ isEnabled }) }));
      notify(t(isEnabled ? "carrierEnabled" : "carrierDisabled"));
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("carriersTitle")}</h2>
      <div className="chu-thich">{t("carriersHint")}</div>
      <FormError text={error} />
      {settings.carriers.map((carrier) => (
        <div key={carrier.code} style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <strong>{carrier.name}</strong>
            <span className="nhom-nut">
              <span className={`nhan ${carrier.isEnabled ? "thanh-cong" : "trung-tinh"}`}>{t(carrier.isEnabled ? "enabled" : "disabled")}</span>
              <span className={`nhan ${carrier.isConfigured ? "thanh-cong" : "canh-bao"}`}>{t(carrier.isConfigured ? "configured" : "notConfigured")}</span>
            </span>
          </span>
          {settings.canManage && (
            <button
              type="button"
              className={`nut ${carrier.isEnabled ? "phu" : "chinh"}`}
              disabled={busy || (!carrier.isEnabled && !carrier.isConfigured)}
              onClick={() => void toggle(carrier.code, !carrier.isEnabled)}
            >
              {t(carrier.isEnabled ? "disable" : "enable")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Payments({ settings, onSaved }: { settings: StoreSettingsResponse; onSaved: (value: StoreSettingsResponse) => void }) {
  const t = useTranslations("storeSettings");
  const method = useTranslations("paymentMethods");
  const { notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(path: string, body: object, message: string) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiFetch<StoreSettingsResponse>(path, { method: "PUT", body: JSON.stringify(body) }));
      notify(message);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const anyEnabled = settings.paymentMethods.some((item) => item.isEnabled && item.isConfigured);
  const row = { display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "center", justifyContent: "space-between" } as const;
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("paymentsTitle")}</h2>
      <FormError text={error} />
      <div style={row}>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <strong>{t("orderingOpenLabel")}</strong>
          <span className="chu-thich">{t(settings.orderingOpen ? "orderingOpenHint" : "orderingClosedHint")}</span>
          <span className="nhom-nut">
            <span className={`nhan ${settings.orderingOpen ? "thanh-cong" : "trung-tinh"}`}>{t(settings.orderingOpen ? "orderingOpen" : "orderingClosed")}</span>
          </span>
        </span>
        {settings.canManage && (
          <button
            type="button"
            className={`nut ${settings.orderingOpen ? "phu" : "chinh"}`}
            disabled={busy || (!settings.orderingOpen && (!anyEnabled || settings.version === 0))}
            onClick={() => void save("/marketplace/ordering-open", { orderingOpen: !settings.orderingOpen }, t(settings.orderingOpen ? "orderingClosedSaved" : "orderingOpenSaved"))}
          >
            {t(settings.orderingOpen ? "closeOrdering" : "openOrdering")}
          </button>
        )}
      </div>
      <div className="chu-thich">{t("paymentMethodsHint")}</div>
      {settings.paymentMethods.map((item) => (
        <div key={item.code} style={row}>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <strong>{method(item.code)}</strong>
            <span className="nhom-nut">
              <span className="nhan trung-tinh">{method(`gateway_${item.gatewayCode}`)}</span>
              <span className={`nhan ${item.isEnabled ? "thanh-cong" : "trung-tinh"}`}>{t(item.isEnabled ? "enabled" : "disabled")}</span>
              {item.gatewayCode !== "cod" && <span className={`nhan ${item.isConfigured ? "thanh-cong" : "canh-bao"}`}>{t(item.isConfigured ? "configured" : "notConfigured")}</span>}
            </span>
          </span>
          {settings.canManage && (
            <button
              type="button"
              className={`nut ${item.isEnabled ? "phu" : "chinh"}`}
              disabled={busy || (!item.isEnabled && !item.isConfigured)}
              onClick={() => void save(`/marketplace/payment-methods/${item.code}`, { isEnabled: !item.isEnabled }, t(item.isEnabled ? "paymentMethodDisabled" : "paymentMethodEnabled"))}
            >
              {t(item.isEnabled ? "disable" : "enable")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function CommissionSettingsCard({ settings, onSaved }: { settings: StoreSettingsResponse; onSaved: (value: StoreSettingsResponse) => void }) {
  const t = useTranslations("storeSettings");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const current = settings.commissionSettings;
  const [form, setForm] = useState({ taxThreshold: current.taxThreshold, taxRate: current.taxRate, minimumWithdrawal: current.minimumWithdrawal });
  // Phí rút tiền (THAY_DOI_17): hai bảng cộng dồn, nhập dạng chữ rồi đổi khi lưu.
  const [byCount, setByCount] = useState(current.withdrawalFees.byCount.map((tier) => ({ fromCount: String(tier.fromCount), fee: tier.fee })));
  const [byAmount, setByAmount] = useState(current.withdrawalFees.byAmount.map((tier) => ({ ...tier, maximumFee: tier.maximumFee ?? "" })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  async function save() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      onSaved(
        await apiFetch<StoreSettingsResponse>("/marketplace/commission-settings", {
          method: "PUT",
          body: JSON.stringify({
            ...form,
            withdrawalFees: {
              byCount: byCount.map((tier) => ({ fromCount: Number(tier.fromCount), fee: tier.fee })),
              byAmount: byAmount.map((tier) => ({ ...tier, maximumFee: tier.maximumFee.trim() === "" ? null : tier.maximumFee })),
            },
            version: current.version,
          }),
        }),
      );
      notify(t("commissionSettingsSaved"));
    } catch (failure) {
      const problem = failureOf(failure);
      setError(problem.message);
      setFields(problem.fields ?? {});
    } finally {
      setBusy(false);
    }
  }
  const field = (key: keyof typeof form) => (
    <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
      <label htmlFor={`hh-cd-${key}`}>{t(key)}</label>
      <input
        id={`hh-cd-${key}`}
        className="o-nhap"
        inputMode="decimal"
        disabled={!settings.canManage}
        aria-invalid={fields[key] ? true : undefined}
        value={form[key]}
        onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))}
      />
    </span>
  );
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("commissionTitle")}</h2>
      <FormError text={error} />
      <div style={{ display: "grid", gap: "var(--khoang-2)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {field("taxThreshold")}
        {field("taxRate")}
        {field("minimumWithdrawal")}
      </div>
      <h3>{t("feeTitle")}</h3>
      <span className="chu-thich">{t("feeHint")}</span>
      <strong>{t("feeByCount")}</strong>
      {byCount.map((tier, index) => (
        <div key={index} style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <label htmlFor={`phi-lan-${index}`}>{t("feeFromCount")}</label>
            <input
              id={`phi-lan-${index}`}
              className="o-nhap"
              inputMode="numeric"
              disabled={!settings.canManage}
              value={tier.fromCount}
              aria-invalid={fields[`withdrawalFees.byCount.${index}.fromCount`] ? true : undefined}
              onChange={(event) => setByCount((rows) => rows.map((row, position) => (position === index ? { ...row, fromCount: event.target.value } : row)))}
            />
          </span>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <label htmlFor={`phi-lan-tien-${index}`}>{t("feeFixed")}</label>
            <input
              id={`phi-lan-tien-${index}`}
              className="o-nhap"
              inputMode="decimal"
              disabled={!settings.canManage}
              value={tier.fee}
              aria-invalid={fields[`withdrawalFees.byCount.${index}.fee`] ? true : undefined}
              onChange={(event) => setByCount((rows) => rows.map((row, position) => (position === index ? { ...row, fee: event.target.value } : row)))}
            />
          </span>
          {settings.canManage && (
            <button type="button" className="nut phu" onClick={() => setByCount((rows) => rows.filter((_, position) => position !== index))}>
              {t("feeRemove")}
            </button>
          )}
        </div>
      ))}
      {settings.canManage && (
        <span className="nhom-nut">
          <button type="button" className="nut phu" onClick={() => setByCount((rows) => [...rows, { fromCount: "", fee: "" }])}>
            {t("feeAddCount")}
          </button>
        </span>
      )}
      <strong>{t("feeByAmount")}</strong>
      {byAmount.map((tier, index) => (
        <div key={index} style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
          {(["fromAmount", "fixedFee", "percent", "minimumFee", "maximumFee"] as const).map((key) => (
            <span key={key} style={{ display: "grid", gap: "var(--khoang-1)" }}>
              <label htmlFor={`phi-tien-${key}-${index}`}>{t(`fee_${key}`)}</label>
              <input
                id={`phi-tien-${key}-${index}`}
                className="o-nhap"
                inputMode="decimal"
                disabled={!settings.canManage}
                value={tier[key]}
                aria-invalid={fields[`withdrawalFees.byAmount.${index}.${key}`] ? true : undefined}
                onChange={(event) => setByAmount((rows) => rows.map((row, position) => (position === index ? { ...row, [key]: event.target.value } : row)))}
              />
            </span>
          ))}
          {settings.canManage && (
            <button type="button" className="nut phu" onClick={() => setByAmount((rows) => rows.filter((_, position) => position !== index))}>
              {t("feeRemove")}
            </button>
          )}
        </div>
      ))}
      {settings.canManage && (
        <span className="nhom-nut">
          <button type="button" className="nut phu" onClick={() => setByAmount((rows) => [...rows, { fromAmount: "0", fixedFee: "0", percent: "0", minimumFee: "0", maximumFee: "" }])}>
            {t("feeAddAmount")}
          </button>
        </span>
      )}
      {settings.canManage && (
        <span className="nhom-nut">
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void save()}>
            {common("save")}
          </button>
        </span>
      )}
    </div>
  );
}

export default function StoreSettingsPage() {
  const t = useTranslations("storeSettings");
  const { state, reload } = useApi<StoreSettingsResponse>("/marketplace/store-settings");
  const [saved, setSaved] = useState<StoreSettingsResponse | null>(null);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(loaded) => {
          const settings = saved ?? loaded;
          return (
            <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
              <SettingsForm settings={settings} onSaved={setSaved} />
              <Payments settings={settings} onSaved={setSaved} />
              <CommissionSettingsCard key={settings.commissionSettings.version} settings={settings} onSaved={setSaved} />
              <Carriers settings={settings} onSaved={setSaved} />
            </div>
          );
        }}
      </Loaded>
    </>
  );
}
