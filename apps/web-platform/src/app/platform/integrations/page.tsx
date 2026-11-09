"use client";

// MAN_HINH_19 Cài đặt tích hợp (CHUC_NANG_25; API_49). Chỉ quản trị tập đoàn.
import type { IntegrationSettingItem, IntegrationSettingKey, IntegrationSettingsResponse, IntegrationTestResponse, MessageDeliveryItem } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Field, FormError, useSubmit } from "@/components/Form";
import { HistoryLink } from "@/components/HistoryLink";
import { Loaded } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { failureOf, useApi } from "@/lib/use-api";

const groups: { name: "google" | "microsoft" | "zalo" | "esms"; keys: IntegrationSettingKey[] }[] = [
  { name: "google", keys: ["google.client_id", "google.client_secret"] },
  { name: "microsoft", keys: ["microsoft.client_id", "microsoft.client_secret", "microsoft.tenant"] },
  { name: "zalo", keys: ["zalo.app_id", "zalo.app_secret"] },
  {
    name: "esms",
    keys: [
      "esms.api_key",
      "esms.secret_key",
      "esms.brandname",
      "esms.oa_id",
      "esms.sandbox",
      "esms.template.login_otp",
      "esms.template.approval_assigned",
      "esms.template.approval_reminder",
      "esms.template.approval_completed",
    ],
  },
];
const messageKey = (key: string) => key.replaceAll(".", "_");

export default function IntegrationsPage() {
  const { state, reload } = useApi<IntegrationSettingsResponse>("/integration-settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => <IntegrationsForm data={data} onSaved={() => void reload()} />}
    </Loaded>
  );
}

function IntegrationsForm({ data, onSaved }: { data: IntegrationSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("integrations");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const byKey = new Map(data.settings.map((item) => [item.key, item]));
  const [values, setValues] = useState<Partial<Record<IntegrationSettingKey, string>>>(() =>
    Object.fromEntries(data.settings.filter((item) => !item.secret).map((item) => [item.key, item.value ?? ""])),
  );
  const [clear, setClear] = useState<IntegrationSettingKey[]>([]);
  const [testResult, setTestResult] = useState<IntegrationTestResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const deliveries = useApi<MessageDeliveryItem[]>("/integration-settings/deliveries");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/integration-settings", { method: "PUT", body: JSON.stringify({ values, clear }) });
      notify(t("saved"));
      setClear([]);
      onSaved();
    });
  }

  async function test() {
    setTesting(true);
    try {
      setTestResult(await apiFetch<IntegrationTestResponse>("/integration-settings/test", { method: "POST" }));
      void deliveries.reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setTesting(false);
    }
  }

  async function sendTestMessage() {
    setTesting(true);
    setPhoneError(undefined);
    try {
      setTestResult(await apiFetch<IntegrationTestResponse>("/integration-settings/test-message", { method: "POST", body: JSON.stringify({ phone: testPhone }) }));
      void deliveries.reload();
    } catch (error) {
      const failure = failureOf(error);
      if (failure.fields.phone) setPhoneError(failure.fields.phone);
      else notify(failure.message, "loi");
    } finally {
      setTesting(false);
    }
  }

  const input = (item: IntegrationSettingItem) => {
    const id = `cai-dat-${messageKey(item.key)}`;
    if (item.key === "esms.sandbox") {
      return (
        <select id={id} className={inputClass(`values.${item.key}`)} value={values[item.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))}>
          <option value="">{t("no")}</option>
          <option value="true">{t("yes")}</option>
        </select>
      );
    }
    if (!item.secret) {
      return (
        <input
          id={id}
          className={inputClass(`values.${item.key}`)}
          value={values[item.key] ?? ""}
          autoComplete="off"
          onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))}
        />
      );
    }
    const clearing = clear.includes(item.key);
    return (
      <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
        <input
          id={id}
          type="password"
          className={inputClass(`values.${item.key}`)}
          value={values[item.key] ?? ""}
          autoComplete="new-password"
          disabled={clearing}
          placeholder={item.lastFour ? t("secretSaved", { lastFour: item.lastFour }) : t("notSaved")}
          onChange={(event) => setValues((current) => ({ ...current, [item.key]: event.target.value }))}
        />
        {item.configured && (
          <button
            type="button"
            className="nut chu"
            style={{ justifySelf: "start" }}
            onClick={() => setClear((current) => (clearing ? current.filter((key) => key !== item.key) : [...current, item.key]))}
          >
            {clearing ? `${t("willClear")} · ${common("cancel")}` : t("clear")}
          </button>
        )}
      </span>
    );
  };

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="integration_settings" />
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {groups.map((group) => (
          <section key={group.name} className="the">
            <h2 style={{ margin: 0 }}>{t(`group_${group.name}`)}</h2>
            {group.name !== "esms" && (
              <div className="chu-thich">
                {t("callback")}: <code>{data.callbackUrls[group.name]}</code>
              </div>
            )}
            {group.name === "esms" && <div className="chu-thich">{t("templateHint")}</div>}
            {group.keys.map((key) => {
              const item = byKey.get(key)!;
              return (
                <Field key={key} id={`cai-dat-${messageKey(key)}`} label={t(`key_${messageKey(key)}`)} error={fields[`values.${key}`]}>
                  {input(item)}
                </Field>
              );
            })}
            {group.name === "esms" && (
              <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <button type="button" className={`nut phu${testing ? " dang-xu-ly" : ""}`} style={{ justifySelf: "start" }} disabled={testing} onClick={() => void test()}>
                  {t("test")}
                </button>
                <Field id="so-dien-thoai-thu" label={t("testPhone")} hint={t("testPhoneHint")} error={phoneError}>
                  <span className="nhom-nut">
                    <input
                      id="so-dien-thoai-thu"
                      type="tel"
                      inputMode="tel"
                      className={`o-nhap${phoneError ? " loi" : ""}`}
                      style={{ flex: 1 }}
                      value={testPhone}
                      onChange={(event) => setTestPhone(event.target.value)}
                    />
                    <button type="button" className={`nut phu${testing ? " dang-xu-ly" : ""}`} disabled={testing || !testPhone.trim()} onClick={() => void sendTestMessage()}>
                      {t("testMessage")}
                    </button>
                  </span>
                </Field>
                {testResult && (
                  <div className={`khoi-canh-bao ${testResult.ok ? "thong-tin" : "loi"}`} role="status">
                    {["esmsMissing", "esmsConnected", "testSent", "testFailed"].includes(testResult.message) ? t(testResult.message as "esmsMissing") : `${t("esmsFailed")} ${testResult.message}`}
                    {testResult.officialAccounts.length > 0 && <div>{t("officialAccounts", { list: testResult.officialAccounts.map((account) => `${account.name} (${account.id})`).join(", ") })}</div>}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
      <section className="the">
        <h2 style={{ margin: 0 }}>{t("deliveries")}</h2>
        <Loaded state={deliveries.state} onRetry={() => void deliveries.reload()}>
          {(items) =>
            items.length === 0 ? (
              <p style={{ margin: 0 }}>{common("empty")}</p>
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {[t("time"), t("channel"), t("purpose"), t("phone"), t("status"), t("error")].map((heading) => (
                        <th key={heading} scope="col">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("time")}>
                          <span>{formatDateTime(item.createdAt)}</span>
                        </td>
                        <td data-nhan={t("channel")}>
                          <span>{t(`channel_${item.channel}`)}</span>
                        </td>
                        <td data-nhan={t("purpose")}>
                          <span>{t.has(`purpose_${messageKey(item.purpose)}`) ? t(`purpose_${messageKey(item.purpose)}`) : item.purpose}</span>
                        </td>
                        <td data-nhan={t("phone")}>
                          <span>{item.phoneMasked}</span>
                        </td>
                        <td data-nhan={t("status")}>
                          <span className={`nhan ${item.status === "sent" ? "thanh-cong" : item.status === "failed" ? "loi" : "trung-tinh"}`}>{t(`status_${item.status}`)}</span>
                        </td>
                        <td data-nhan={t("error")}>
                          <span>{item.error ?? common("none")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Loaded>
      </section>
    </>
  );
}
