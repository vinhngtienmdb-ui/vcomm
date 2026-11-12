"use client";

// MAN_HINH_208: phiếu điều chỉnh ngân sách (QUYTAC_NGHIEPVU_448, 449): dòng ô, tăng/giảm, số tiền; ngân sách hiện tại, đã dùng, sau điều chỉnh; gửi duyệt, rút, hủy.
import type { BudgetAdjustmentResponse, BudgetOptionsResponse, BudgetPlanListItem, PageResponse, SaveBudgetAdjustmentRequest } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { BudgetStatus, monthLabel, monthRange, numericCell } from "./BudgetStatus";

type Line = { categoryId: string; warehouseId: string; month: string; direction: "increase" | "decrease"; amount: string };
const parseAmount = (text: string) => text.replace(/\./g, "").replace(",", ".").trim();

export function AdjustmentEditor({ adjustment, initialPlanId, onChanged }: { adjustment: BudgetAdjustmentResponse | null; initialPlanId: string | null; onChanged?: () => Promise<void> }) {
  const options = useApi<BudgetOptionsResponse>("/purchasing/budget-options");
  const plans = useApi<PageResponse<BudgetPlanListItem>>("/purchasing/budget-plans?status=approved&pageSize=100");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(loadedOptions) => (
        <Loaded state={plans.state} onRetry={() => void plans.reload()}>
          {(loadedPlans) => <Editor adjustment={adjustment} initialPlanId={initialPlanId} options={loadedOptions} plans={loadedPlans.data} onChanged={onChanged} />}
        </Loaded>
      )}
    </Loaded>
  );
}

function Editor({
  adjustment,
  initialPlanId,
  options,
  plans,
  onChanged,
}: {
  adjustment: BudgetAdjustmentResponse | null;
  initialPlanId: string | null;
  options: BudgetOptionsResponse;
  plans: BudgetPlanListItem[];
  onChanged: (() => Promise<void>) | undefined;
}) {
  const t = useTranslations("budgetAdjustments");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const editable = adjustment === null || adjustment.canEdit;
  const [planId, setPlanId] = useState(adjustment?.planId ?? initialPlanId ?? plans[0]?.id ?? "");
  const [reason, setReason] = useState(adjustment?.reason ?? "");
  const [lines, setLines] = useState<Line[]>(
    adjustment?.lines.map((line) => ({
      categoryId: line.categoryId,
      warehouseId: line.warehouseId,
      month: line.month,
      direction: Number(line.delta) < 0 ? "decrease" : "increase",
      amount: String(Math.abs(Number(line.delta))),
    })) ?? [],
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useSubmit();
  const plan = plans.find((item) => item.id === planId);
  const months = plan ? monthRange(plan.fromMonth, plan.toMonth) : adjustment ? monthRange(adjustment.planFromMonth, adjustment.planToMonth) : [];
  const currency = adjustment?.currency ?? plan?.currency ?? options.currency;
  const categoryName = (id: string) => {
    const category = options.categories.find((item) => item.id === id);
    return category ? `${category.code} · ${category.name}` : (adjustment?.lines.find((line) => line.categoryId === id)?.categoryName ?? "");
  };
  const warehouseName = (id: string) => options.warehouses.find((item) => item.id === id)?.name ?? adjustment?.lines.find((line) => line.warehouseId === id)?.warehouseName ?? "";
  const savedLine = (line: Line) => adjustment?.lines.find((item) => item.categoryId === line.categoryId && item.warehouseId === line.warehouseId && item.month === line.month);

  function body(): SaveBudgetAdjustmentRequest {
    return {
      planId,
      reason,
      lines: lines.map((line) => ({ categoryId: line.categoryId, warehouseId: line.warehouseId, month: line.month, delta: line.direction === "decrease" ? `-${line.amount}` : line.amount })),
      ...(adjustment ? { version: adjustment.version } : {}),
    };
  }
  function save() {
    void form.run(async () => {
      const saved = await apiFetch<BudgetAdjustmentResponse>(adjustment ? `/purchasing/budget-adjustments/${adjustment.id}` : "/purchasing/budget-adjustments", {
        method: adjustment ? "PATCH" : "POST",
        body: JSON.stringify(body()),
      });
      notify(t("saved"));
      if (adjustment) await onChanged?.();
      else router.push(`/budget-adjustments/${saved.id}`);
    });
  }
  async function act(path: string, payload?: unknown) {
    if (!adjustment) return;
    setBusy(true);
    try {
      await apiFetch(`/purchasing/budget-adjustments/${adjustment.id}/${path}`, { method: "POST", ...(payload ? { body: JSON.stringify(payload) } : {}) });
      notify(path === "submit" ? t("submitted") : t("saved"));
      setConfirmCancel(false);
      await onChanged?.();
    } catch (error) {
      const failure = failureOf(error);
      const first = Object.entries(failure.fields)[0];
      const line = first ? lines[Number(first[0].split(".")[1])] : undefined;
      notify(line ? `${categoryName(line.categoryId)} · ${warehouseName(line.warehouseId)} · ${monthLabel(line.month)}: ${first![1]}` : failure.message, "loi");
    } finally {
      setBusy(false);
    }
  }
  const update = (index: number, change: Partial<Line>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...change } : line)));
  const lineErrors = Object.entries(form.fields)
    .filter(([key]) => key.startsWith("lines."))
    .map(([key, message]) => {
      const line = lines[Number(key.split(".")[1])];
      return line ? `${categoryName(line.categoryId)} · ${warehouseName(line.warehouseId)} · ${monthLabel(line.month)}: ${message}` : message;
    });

  if (adjustment === null && plans.length === 0) return <MessageView text={t("noPlan")} />;
  const headings = [t("category"), t("warehouse"), t("month"), t("direction"), t("amount"), t("currentBudget"), t("used"), t("after")];
  return (
    <>
      <div>
        <Link href="/budget-adjustments">‹ {t("back")}</Link>
      </div>
      <div className="tieu-de">
        <h1>{adjustment ? (adjustment.documentNo ?? t("draftNo")) : t("add")}</h1>
        {adjustment && <BudgetStatus status={adjustment.status} />}
        {adjustment && <HistoryLink entityId={adjustment.id} />}
        <span className="nhom-nut">
          {editable && (
            <button type="button" className="nut phu" disabled={form.submitting} onClick={save}>
              {t("saveDraft")}
            </button>
          )}
          {adjustment?.canSubmit && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("submit", { version: adjustment.version })}>
              {t("submit")}
            </button>
          )}
          {adjustment?.canWithdraw && (
            <button type="button" className="nut phu" disabled={busy} onClick={() => void act("withdraw")}>
              {t("withdraw")}
            </button>
          )}
          {adjustment?.canCancel && (
            <button type="button" className="nut nguy-hiem" disabled={busy} onClick={() => setConfirmCancel(true)}>
              {t("cancel")}
            </button>
          )}
        </span>
      </div>
      <FormError text={form.formError} />
      {lineErrors.length > 0 && (
        <div className="khoi-canh-bao loi" role="alert">
          {t("lineErrors")}
          <ul style={{ margin: 0 }}>
            {lineErrors.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="the">
        <div className="bo-loc" style={{ alignItems: "flex-start" }}>
          <Field id="ke-hoach" label={t("plan")} error={form.fields.planId}>
            <select id="ke-hoach" className={form.inputClass("planId")} value={planId} disabled={!editable} onChange={(event) => setPlanId(event.target.value)}>
              {!plan && adjustment && <option value={adjustment.planId}>{adjustment.planDocumentNo}</option>}
              {plans.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.documentNo} ({monthLabel(item.fromMonth)} – {monthLabel(item.toMonth)})
                </option>
              ))}
            </select>
          </Field>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Field id="ly-do" label={t("reasonLabel")} error={form.fields.reason}>
              <input id="ly-do" className={form.inputClass("reason")} value={reason} maxLength={500} disabled={!editable} onChange={(event) => setReason(event.target.value)} />
            </Field>
          </div>
        </div>
        <span className="chu-thich">{t("hint")}</span>
      </div>
      {editable && (
        <div className="nhom-nut">
          <button
            type="button"
            className="nut phu"
            disabled={months.length === 0 || options.categories.length === 0 || options.warehouses.length === 0}
            onClick={() => setLines([...lines, { categoryId: options.categories[0]!.id, warehouseId: options.warehouses[0]!.id, month: months[0]!, direction: "increase", amount: "" }])}
          >
            {t("addLine")}
          </button>
        </div>
      )}
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th key={index} scope="col" style={index > 3 ? numericCell : undefined}>
                  {heading}
                </th>
              ))}
              {editable && <th scope="col" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const saved = savedLine(line);
              return (
                <tr key={index}>
                  <td data-nhan={headings[0]}>
                    {editable ? (
                      <select aria-label={t("category")} className="o-nhap" style={{ minWidth: 170 }} value={line.categoryId} onChange={(event) => update(index, { categoryId: event.target.value })}>
                        {options.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.code} · {category.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{categoryName(line.categoryId)}</span>
                    )}
                  </td>
                  <td data-nhan={headings[1]}>
                    {editable ? (
                      <select
                        aria-label={t("warehouse")}
                        className="o-nhap"
                        style={{ minWidth: 140 }}
                        value={line.warehouseId}
                        onChange={(event) => update(index, { warehouseId: event.target.value })}
                      >
                        {options.warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{warehouseName(line.warehouseId)}</span>
                    )}
                  </td>
                  <td data-nhan={headings[2]}>
                    {editable ? (
                      <select aria-label={t("month")} className="o-nhap" style={{ minWidth: 100 }} value={line.month} onChange={(event) => update(index, { month: event.target.value })}>
                        {months.map((month) => (
                          <option key={month} value={month}>
                            {monthLabel(month)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{monthLabel(line.month)}</span>
                    )}
                  </td>
                  <td data-nhan={headings[3]}>
                    {editable ? (
                      <select
                        aria-label={t("direction")}
                        className="o-nhap"
                        style={{ minWidth: 90 }}
                        value={line.direction}
                        onChange={(event) => update(index, { direction: event.target.value as Line["direction"] })}
                      >
                        <option value="increase">{t("increase")}</option>
                        <option value="decrease">{t("decrease")}</option>
                      </select>
                    ) : (
                      <span>{t(line.direction)}</span>
                    )}
                  </td>
                  <td data-nhan={headings[4]} style={numericCell}>
                    {editable ? (
                      <input
                        aria-label={t("amount")}
                        className="o-nhap"
                        style={{ textAlign: "right", minWidth: 120 }}
                        inputMode="decimal"
                        value={
                          line.amount === "" || Number.isNaN(Number(line.amount)) || line.amount.endsWith(".")
                            ? line.amount.replace(".", ",")
                            : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(Number(line.amount))
                        }
                        onChange={(event) => update(index, { amount: parseAmount(event.target.value) })}
                      />
                    ) : (
                      <span>{formatMoney(line.amount, currency)}</span>
                    )}
                  </td>
                  <td data-nhan={headings[5]} style={numericCell}>
                    <span>{saved ? formatMoney(saved.currentBudget, currency) : "—"}</span>
                  </td>
                  <td data-nhan={headings[6]} style={numericCell}>
                    <span>{saved ? formatMoney(saved.used, currency) : "—"}</span>
                  </td>
                  <td data-nhan={headings[7]} style={numericCell}>
                    {saved && Number(saved.after) < Number(saved.used) ? (
                      <strong style={{ color: "var(--mau-loi)" }}>{formatMoney(saved.after, currency)}</strong>
                    ) : (
                      <span>{saved ? formatMoney(saved.after, currency) : "—"}</span>
                    )}
                  </td>
                  {editable && (
                    <td>
                      <button type="button" className="nut chu" onClick={() => setLines(lines.filter((_, position) => position !== index))}>
                        {t("removeLine")}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {confirmCancel && adjustment && (
        <ConfirmDialog
          title={t("cancel")}
          text={t("cancelConfirm")}
          confirmLabel={common("confirm")}
          busy={busy}
          onConfirm={() => void act("cancel", { version: adjustment.version })}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </>
  );
}
