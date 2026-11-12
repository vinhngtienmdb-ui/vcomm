"use client";

// MAN_HINH_220 Quy tắc chống gian lận (CONG_VIEC_60; CHUC_NANG_215; API_251; QUYTAC_NGHIEPVU_475, 476): bật tắt, ngưỡng, mức xử lý; lịch sử sửa.
import { loyaltyFraudActions, type LoyaltyFraudAction, type LoyaltyFraudRule, type LoyaltyFraudRuleHistoryItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const actionTone: Record<LoyaltyFraudAction, string> = { alert: "thong-tin", block: "canh-bao", block_and_lock: "loi" };

export default function FraudRulesPage() {
  const t = useTranslations("loyaltyFraud");
  const rules = useApi<{ rules: LoyaltyFraudRule[]; canManage: boolean }>("/loyalty/fraud-rules");
  const history = useApi<LoyaltyFraudRuleHistoryItem[]>("/loyalty/fraud-rules/history");
  const [editing, setEditing] = useState<string | null>(null);
  const reload = async () => {
    setEditing(null);
    await Promise.all([rules.reload(), history.reload()]);
  };
  const threshold = (rule: LoyaltyFraudRule) =>
    Object.entries(rule.params)
      .map(([key, value]) => (t as unknown as (key: string, values: Record<string, string>) => string)(`param_${key}`, { value: value === null ? "—" : formatNumber(value, 0) }))
      .join(" · ");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("rulesTitle")}</h1>
      </div>
      <div className="khoi-canh-bao thong-tin">{t("rulesHint")}</div>
      <Loaded state={rules.state} onRetry={() => void rules.reload()}>
        {(result) => (
          <>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("rule")}</th>
                    <th>{t("enabled")}</th>
                    <th>{t("threshold")}</th>
                    <th>{t("action")}</th>
                    <th>{t("updated")}</th>
                    {result.canManage ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {result.rules.map((rule) => (
                    <tr key={rule.code}>
                      <td data-nhan={t("rule")}>{t(`rule_${rule.code}`)}</td>
                      <td data-nhan={t("enabled")}>{t(rule.enabled ? "on" : "off")}</td>
                      <td data-nhan={t("threshold")}>{threshold(rule)}</td>
                      <td data-nhan={t("action")}>
                        <span className={`nhan ${actionTone[rule.action]}`}>{t(`action_${rule.action}`)}</span>
                      </td>
                      <td data-nhan={t("updated")}>{rule.updatedByName ? `${formatDateTime(rule.updatedAt)} · ${rule.updatedByName}` : "—"}</td>
                      {result.canManage ? (
                        <td>
                          <button type="button" className="nut chu" onClick={() => setEditing(rule.code)}>
                            {t("edit")}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editing ? <RuleForm key={editing} rule={result.rules.find((rule) => rule.code === editing)!} onDone={reload} onCancel={() => setEditing(null)} /> : null}
          </>
        )}
      </Loaded>
      <div className="the" style={{ display: "grid", gap: "var(--khoang-2)", marginTop: "var(--khoang-4)" }}>
        <h2>{t("history")}</h2>
        <Loaded state={history.state} onRetry={() => void history.reload()}>
          {(items) =>
            items.length === 0 ? (
              <span className="chu-thich">{t("noHistory")}</span>
            ) : (
              <>
                {items.map((item, index) => (
                  <span key={index}>
                    {`${formatDateTime(item.createdAt)} · ${item.actorName} · ${t(`rule_${item.code}`)}: ${t(`action_${(item.before as { action: LoyaltyFraudAction }).action}`)} → ${t(`action_${(item.after as { action: LoyaltyFraudAction }).action}`)}`}
                  </span>
                ))}
              </>
            )
          }
        </Loaded>
      </div>
    </>
  );
}

function RuleForm({ rule, onDone, onCancel }: { rule: LoyaltyFraudRule; onDone: () => Promise<void>; onCancel: () => void }) {
  const t = useTranslations("loyaltyFraud");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [action, setAction] = useState<LoyaltyFraudAction>(rule.action);
  const [params, setParams] = useState<Record<string, string>>(Object.fromEntries(Object.entries(rule.params).map(([key, value]) => [key, value === null ? "" : String(value)])));
  const save = () =>
    run(async () => {
      await apiFetch(`/loyalty/fraud-rules/${rule.code}`, {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          action,
          params: Object.fromEntries(Object.entries(params).map(([key, value]) => [key, value.trim() === "" ? null : Number(value.replaceAll(".", ""))])),
          version: rule.version,
        }),
      });
      notify(t("saved"));
      await onDone();
    });
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)", marginTop: "var(--khoang-4)" }}>
      <h2>{t("editTitle", { rule: t(`rule_${rule.code}`) })}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="gl-bat" label={t("enabled")}>
          <select id="gl-bat" className="o-nhap" value={enabled ? "on" : "off"} onChange={(event) => setEnabled(event.target.value === "on")}>
            <option value="on">{t("on")}</option>
            <option value="off">{t("off")}</option>
          </select>
        </Field>
        {Object.keys(params).map((key) => (
          <Field key={key} id={`gl-${key}`} label={t(`label_${key}` as never)} error={fields[`params.${key}`]}>
            <input id={`gl-${key}`} className={inputClass(`params.${key}`)} inputMode="numeric" value={params[key]} onChange={(event) => setParams({ ...params, [key]: event.target.value })} />
          </Field>
        ))}
        <Field id="gl-muc" label={t("action")}>
          <select id="gl-muc" className="o-nhap" value={action} onChange={(event) => setAction(event.target.value as LoyaltyFraudAction)}>
            {loyaltyFraudActions.map((item) => (
              <option key={item} value={item}>
                {t(`action_${item}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="khoi-canh-bao canh-bao">{t(rule.code === "earn_return" ? "actionHintReturn" : "actionHint")}</div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut chinh" disabled={submitting} onClick={() => void save()}>
          {t("save")}
        </button>
        <button type="button" className="nut phu" disabled={submitting} onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
