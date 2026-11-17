"use client";

// MAN_HINH_304 khối "iPOS" trong chi tiết cửa hàng liên kết (CONG_VIEC_74; CHUC_NANG_252, 253; QUYTAC_NGHIEPVU_595 đến 598; API_355).
import type { IposBillingMethod, IposMerchantOverview, IposPlan, IposSubscription } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export const iposStatusClass = { trial: "thong-tin", active: "thanh-cong", overdue: "canh-bao", locked: "loi", cancelled: "trung-tinh" } as const;
const billingMethods: IposBillingMethod[] = ["vietqr", "collection_deduction", "settlement_deduction", "free"];
const periods = [1, 6, 12] as const;

function SubscriptionDrawer({
  merchantId,
  overview,
  editing,
  onClose,
  onSaved,
}: {
  merchantId: string;
  overview: IposMerchantOverview;
  editing: IposSubscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("ipos");
  const plans = useApi<IposPlan[]>("/ipos/plans");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [outletId, setOutletId] = useState(overview.availableOutlets[0]?.id ?? "");
  const [planId, setPlanId] = useState(editing?.planId ?? "");
  const [period, setPeriod] = useState<number>(editing?.periodMonths ?? 1);
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [trialDays, setTrialDays] = useState("");
  const [price, setPrice] = useState(editing?.customMonthlyPrice ?? "");
  const [registers, setRegisters] = useState(editing?.customMaxRegisters ? String(editing.customMaxRegisters) : "");
  return (
    <Drawer title={editing ? `${t("editSubscription")} · ${editing.outletName}` : t("issueSubscription")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const terms = { planId, periodMonths: period, customMonthlyPrice: price.trim() || null, customMaxRegisters: registers.trim() ? Number(registers) : null };
            if (editing) await apiFetch(`/ipos/subscriptions/${editing.id}`, { method: "PUT", body: JSON.stringify({ ...terms, version: editing.version }) });
            else
              await apiFetch(`/affiliate/merchants/${merchantId}/ipos-subscriptions`, {
                method: "POST",
                body: JSON.stringify({ ...terms, outletId, startsOn, trialDays: trialDays.trim() ? Number(trialDays) : null }),
              });
            onSaved();
          });
        }}
      >
        {!editing && (
          <Field id="ipos-diem-ban" label={t("outlet")} error={fields.outletId}>
            <select id="ipos-diem-ban" className={inputClass("outletId")} value={outletId} onChange={(event) => setOutletId(event.target.value)}>
              {overview.availableOutlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="ipos-goi" label={t("plan")} error={fields.planId}>
          <Loaded state={plans.state} onRetry={() => void plans.reload()}>
            {(items) => (
              <select id="ipos-goi" className={inputClass("planId")} value={planId} onChange={(event) => setPlanId(event.target.value)}>
                <option value="">{t("choosePlan")}</option>
                {items
                  .filter((plan) => plan.status === "selling" || plan.id === editing?.planId)
                  .map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {formatNumber(plan.monthlyPrice, 0)} · {t("registersCount", { count: plan.maxRegisters })}
                    </option>
                  ))}
              </select>
            )}
          </Loaded>
        </Field>
        <Field id="ipos-ky" label={t("period")} error={fields.periodMonths}>
          <select id="ipos-ky" className={inputClass("periodMonths")} value={period} onChange={(event) => setPeriod(Number(event.target.value))}>
            {periods.map((months) => (
              <option key={months} value={months}>
                {t("months", { count: months })}
              </option>
            ))}
          </select>
        </Field>
        {!editing && (
          <>
            <Field id="ipos-bat-dau" label={t("startsOn")} error={fields.startsOn}>
              <input id="ipos-bat-dau" type="date" className={inputClass("startsOn")} value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
            </Field>
            <Field id="ipos-dung-thu" label={t("trialDays")} error={fields.trialDays} hint={t("trialDaysHint")}>
              <input id="ipos-dung-thu" className={inputClass("trialDays")} inputMode="numeric" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} />
            </Field>
          </>
        )}
        <Field id="ipos-gia-rieng" label={t("customPrice")} error={fields.customMonthlyPrice} hint={t("customPriceHint")}>
          <input id="ipos-gia-rieng" className={inputClass("customMonthlyPrice")} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Field id="ipos-quay-rieng" label={t("customRegisters")} error={fields.customMaxRegisters} hint={t("customRegistersHint")}>
          <input id="ipos-quay-rieng" className={inputClass("customMaxRegisters")} inputMode="numeric" value={registers} onChange={(event) => setRegisters(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !planId || (!editing && !outletId)}>
            {editing ? t("save") : t("issueSubscription")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Tạm khóa tay hoặc hủy: bắt buộc lý do (QUYTAC_NGHIEPVU_596).
function ReasonDrawer({ subscription, action, onClose, onDone }: { subscription: IposSubscription; action: "lock" | "cancel"; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("ipos");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  return (
    <Drawer title={`${t(action === "lock" ? "lockTitle" : "cancelTitle")} · ${subscription.outletName}`} onClose={onClose}>
      <p>{t(action === "lock" ? "lockText" : "cancelText")}</p>
      <Field id="ipos-ly-do" label={t("reason")} error={fields.reason}>
        <textarea id="ipos-ly-do" className={inputClass("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || !reason.trim()}
          onClick={() =>
            void run(async () => {
              await apiFetch(`/ipos/subscriptions/${subscription.id}/${action}`, { method: "POST", body: JSON.stringify({ reason, version: subscription.version }) });
              onDone();
            })
          }
        >
          {t(action === "lock" ? "lock" : "cancelSubscription")}
        </button>
      </div>
    </Drawer>
  );
}

function BillingForm({ merchantId, overview, terminated, onSaved }: { merchantId: string; overview: IposMerchantOverview; terminated: boolean; onSaved: () => void }) {
  const t = useTranslations("ipos");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [method, setMethod] = useState<IposBillingMethod>(overview.billing?.method ?? "vietqr");
  const [freeUntil, setFreeUntil] = useState(overview.billing?.freeUntil ?? "");
  const [freeReason, setFreeReason] = useState(overview.billing?.freeReason ?? "");
  const editable = overview.canManage && !terminated;
  return (
    <form
      style={{ display: "grid", gap: "var(--khoang-3)", alignContent: "start" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await apiFetch(`/affiliate/merchants/${merchantId}/ipos-billing`, {
            method: "PUT",
            body: JSON.stringify({
              method,
              freeUntil: method === "free" && freeUntil ? freeUntil : null,
              freeReason: method === "free" ? freeReason.trim() : null,
              version: overview.billing?.version ?? null,
            }),
          });
          onSaved();
        });
      }}
    >
      <Field id="ipos-cach-thu" label={t("billingMethod")} error={fields.method}>
        <select id="ipos-cach-thu" className={inputClass("method")} value={method} disabled={!editable} onChange={(event) => setMethod(event.target.value as IposBillingMethod)}>
          {billingMethods.map((value) => (
            <option key={value} value={value}>
              {t(`billing_${value}`)}
            </option>
          ))}
        </select>
      </Field>
      {method === "free" && (
        <>
          <Field id="ipos-mien-phi-den" label={t("freeUntil")} error={fields.freeUntil} hint={t("freeUntilHint")}>
            <input id="ipos-mien-phi-den" type="date" className={inputClass("freeUntil")} value={freeUntil} disabled={!editable} onChange={(event) => setFreeUntil(event.target.value)} />
          </Field>
          <Field id="ipos-ly-do-mien-phi" label={t("freeReason")} error={fields.freeReason}>
            <input id="ipos-ly-do-mien-phi" className={inputClass("freeReason")} maxLength={500} value={freeReason} disabled={!editable} onChange={(event) => setFreeReason(event.target.value)} />
          </Field>
        </>
      )}
      {!overview.billing && <p className="chu-thich">{t("billingNotSet")}</p>}
      <FormError text={formError} />
      {editable && (
        <div>
          <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("saveBilling")}
          </button>
        </div>
      )}
    </form>
  );
}

export function IposMerchantBlock({ merchantId, active, terminated, notify }: { merchantId: string; active: boolean; terminated: boolean; notify: (message: string) => void }) {
  const t = useTranslations("ipos");
  const { state, reload } = useApi<IposMerchantOverview>(`/affiliate/merchants/${merchantId}/ipos`);
  const [editing, setEditing] = useState<IposSubscription | "new" | null>(null);
  const [reasonFor, setReasonFor] = useState<{ subscription: IposSubscription; action: "lock" | "cancel" } | null>(null);
  const [confirming, setConfirming] = useState<{ subscription: IposSubscription; action: "renew" | "unlock" } | null>(null);
  const confirm = useSubmit();
  const refresh = (message: string) => {
    notify(message);
    void reload();
  };
  return (
    <section className="the">
      <Loaded state={state} onRetry={() => void reload()}>
        {(overview) => (
          <>
            <div className="tieu-de">
              <h2>{t("blockTitle")}</h2>
              {overview.canManage && active && overview.availableOutlets.length > 0 && (
                <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
                  {t("issueSubscription")}
                </button>
              )}
            </div>
            <BillingForm key={overview.billing?.version ?? 0} merchantId={merchantId} overview={overview} terminated={terminated} onSaved={() => refresh(t("billingSaved"))} />
            {overview.subscriptions.length === 0 ? (
              <p>{t("noSubscriptions")}</p>
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("outlet")}</th>
                      <th>{t("plan")}</th>
                      <th className="so">{t("monthlyPrice")}</th>
                      <th>{t("endsOn")}</th>
                      <th>{t("status")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {overview.subscriptions.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("outlet")}>{item.outletName}</td>
                        <td data-nhan={t("plan")}>
                          {item.planName} · {t("months", { count: item.periodMonths })}
                          <div className="chu-thich">{t("registersCount", { count: item.maxRegisters })}</div>
                        </td>
                        <td data-nhan={t("monthlyPrice")} className="so">
                          {formatNumber(item.monthlyPrice, 0)}
                        </td>
                        <td data-nhan={t("endsOn")}>
                          {formatDate(item.endsOn)}
                          {item.trialEndsOn && item.status === "trial" && <div className="chu-thich">{t("trialUntil", { date: formatDate(item.trialEndsOn) })}</div>}
                        </td>
                        <td data-nhan={t("status")}>
                          <span className={`nhan ${iposStatusClass[item.status]}`}>{t(`status_${item.status}`)}</span>
                          {item.statusReason && <div className="chu-thich">{item.statusReason}</div>}
                        </td>
                        <td data-nhan="">
                          {overview.canManage && item.status !== "cancelled" && (
                            <span className="nhom-nut">
                              <button type="button" className="nut phu" onClick={() => setEditing(item)}>
                                {t("edit")}
                              </button>
                              <button type="button" className="nut phu" onClick={() => setConfirming({ subscription: item, action: "renew" })}>
                                {t("renew")}
                              </button>
                              {item.lockedManually ? (
                                <button type="button" className="nut phu" onClick={() => setConfirming({ subscription: item, action: "unlock" })}>
                                  {t("unlock")}
                                </button>
                              ) : (
                                <button type="button" className="nut phu" onClick={() => setReasonFor({ subscription: item, action: "lock" })}>
                                  {t("lock")}
                                </button>
                              )}
                              <button type="button" className="nut nguy-hiem" onClick={() => setReasonFor({ subscription: item, action: "cancel" })}>
                                {t("cancelSubscription")}
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editing && (
              <SubscriptionDrawer
                merchantId={merchantId}
                overview={overview}
                editing={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  refresh(t("saved"));
                }}
              />
            )}
          </>
        )}
      </Loaded>
      {reasonFor && (
        <ReasonDrawer
          subscription={reasonFor.subscription}
          action={reasonFor.action}
          onClose={() => setReasonFor(null)}
          onDone={() => {
            setReasonFor(null);
            refresh(t("saved"));
          }}
        />
      )}
      {confirming && (
        <ConfirmDialog
          title={`${t(confirming.action === "renew" ? "renewTitle" : "unlockTitle")} · ${confirming.subscription.outletName}`}
          text={confirming.action === "renew" ? t("renewText", { months: confirming.subscription.periodMonths }) : t("unlockText")}
          confirmLabel={t(confirming.action)}
          busy={confirm.submitting}
          error={confirm.formError}
          onClose={() => setConfirming(null)}
          onConfirm={() =>
            void confirm.run(async () => {
              await apiFetch(`/ipos/subscriptions/${confirming.subscription.id}/${confirming.action}`, { method: "POST", body: JSON.stringify({ version: confirming.subscription.version }) });
              setConfirming(null);
              refresh(t("saved"));
            })
          }
        />
      )}
    </section>
  );
}
