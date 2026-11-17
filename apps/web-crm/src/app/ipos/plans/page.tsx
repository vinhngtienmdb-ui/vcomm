"use client";

// MAN_HINH_303 Gói iPOS (CONG_VIEC_74; CHUC_NANG_252; QUYTAC_NGHIEPVU_594; API_354).
import { iposTaxPercents, type IposPlan } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

function PlanDrawer({ editing, onClose, onSaved }: { editing: IposPlan | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("ipos");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [code, setCode] = useState(editing?.code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(editing?.monthlyPrice ?? "");
  const [tax, setTax] = useState(editing?.taxPercent ?? "10");
  const [registers, setRegisters] = useState(String(editing?.maxRegisters ?? 1));
  const [items, setItems] = useState(editing?.maxItems ? String(editing.maxItems) : "");
  const [trial, setTrial] = useState(String(editing?.trialDays ?? 14));
  const [status, setStatus] = useState(editing?.status ?? "selling");
  return (
    <Drawer title={editing ? `${t("editPlan")} · ${editing.code}` : t("addPlan")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const body = { name, monthlyPrice: price, taxPercent: tax, maxRegisters: Number(registers), maxItems: items.trim() ? Number(items) : null, trialDays: Number(trial) };
            if (editing) await apiFetch(`/ipos/plans/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...body, status, version: editing.version }) });
            else await apiFetch("/ipos/plans", { method: "POST", body: JSON.stringify({ ...body, code }) });
            onSaved();
          });
        }}
      >
        {!editing && (
          <Field id="goi-ma" label={t("planCode")} error={fields.code} hint={t("planCodeHint")}>
            <input id="goi-ma" className={inputClass("code")} maxLength={20} value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
        )}
        <Field id="goi-ten" label={t("planName")} error={fields.name}>
          <input id="goi-ten" className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="goi-gia" label={t("monthlyPriceField")} error={fields.monthlyPrice}>
          <input id="goi-gia" className={inputClass("monthlyPrice")} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Field id="goi-thue" label={t("taxPercent")} error={fields.taxPercent}>
          <select id="goi-thue" className={inputClass("taxPercent")} value={tax} onChange={(event) => setTax(event.target.value)}>
            {iposTaxPercents.map((value) => (
              <option key={value} value={value}>
                {value} %
              </option>
            ))}
          </select>
        </Field>
        <Field id="goi-quay" label={t("maxRegisters")} error={fields.maxRegisters}>
          <input id="goi-quay" className={inputClass("maxRegisters")} inputMode="numeric" value={registers} onChange={(event) => setRegisters(event.target.value)} />
        </Field>
        <Field id="goi-mat-hang" label={t("maxItems")} error={fields.maxItems} hint={t("maxItemsHint")}>
          <input id="goi-mat-hang" className={inputClass("maxItems")} inputMode="numeric" value={items} onChange={(event) => setItems(event.target.value)} />
        </Field>
        <Field id="goi-dung-thu" label={t("trialDaysDefault")} error={fields.trialDays}>
          <input id="goi-dung-thu" className={inputClass("trialDays")} inputMode="numeric" value={trial} onChange={(event) => setTrial(event.target.value)} />
        </Field>
        {editing && (
          <Field id="goi-trang-thai" label={t("status")} error={fields.status}>
            <select id="goi-trang-thai" className={inputClass("status")} value={status} onChange={(event) => setStatus(event.target.value as IposPlan["status"])}>
              <option value="selling">{t("plan_selling")}</option>
              <option value="retired">{t("plan_retired")}</option>
            </select>
          </Field>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {editing ? t("save") : t("addPlan")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export default function IposPlansPage() {
  const t = useTranslations("ipos");
  const { can, notify } = useAdmin();
  const { state, reload } = useApi<IposPlan[]>("/ipos/plans");
  const [editing, setEditing] = useState<IposPlan | "new" | null>(null);
  const manage = can("ipos.plan.manage");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("plansTitle")}</h1>
        {manage && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addPlan")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(plans) =>
          plans.length === 0 ? (
            <MessageView text={t("noPlans")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("planCode")}</th>
                    <th>{t("planName")}</th>
                    <th className="so">{t("monthlyPriceField")}</th>
                    <th>{t("taxPercent")}</th>
                    <th className="so">{t("maxRegisters")}</th>
                    <th className="so">{t("maxItems")}</th>
                    <th className="so">{t("trialDaysDefault")}</th>
                    <th className="so">{t("activeSubscriptions")}</th>
                    <th>{t("status")}</th>
                    {manage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id}>
                      <td data-nhan={t("planCode")}>{plan.code}</td>
                      <td data-nhan={t("planName")}>{plan.name}</td>
                      <td data-nhan={t("monthlyPriceField")} className="so">
                        {formatNumber(plan.monthlyPrice, 0)}
                      </td>
                      <td data-nhan={t("taxPercent")}>{plan.taxPercent} %</td>
                      <td data-nhan={t("maxRegisters")} className="so">
                        {plan.maxRegisters}
                      </td>
                      <td data-nhan={t("maxItems")} className="so">
                        {plan.maxItems === null ? t("unlimited") : formatNumber(String(plan.maxItems), 0)}
                      </td>
                      <td data-nhan={t("trialDaysDefault")} className="so">
                        {plan.trialDays}
                      </td>
                      <td data-nhan={t("activeSubscriptions")} className="so">
                        {plan.activeSubscriptions}
                      </td>
                      <td data-nhan={t("status")}>
                        <span className={`nhan ${plan.status === "selling" ? "thanh-cong" : "trung-tinh"}`}>{t(`plan_${plan.status}`)}</span>
                      </td>
                      {manage && (
                        <td data-nhan="">
                          <button type="button" className="nut phu" onClick={() => setEditing(plan)}>
                            {t("edit")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {editing && (
        <PlanDrawer
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}
