"use client";

// MAN_HINH_205: bảng ngân sách hàng = ngành hàng × kho, cột = tháng (QUYTAC_NGHIEPVU_442, 443); sửa khi nháp, bị từ chối, đã rút; gửi duyệt, rút, hủy.
import type { BudgetAdjustmentListItem, BudgetOptionsResponse, BudgetPlanResponse, PageResponse, SaveBudgetPlanRequest } from "contracts";
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
import { formatMoney, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { AdjustmentTable } from "./AdjustmentTable";
import { BudgetStatus, monthLabel, monthRange, numericCell } from "./BudgetStatus";

type Row = { categoryId: string; warehouseId: string };
const cellKey = (row: Row, month: string) => `${row.categoryId}|${row.warehouseId}|${month}`;
// Số nhập theo kiểu Việt Nam: bỏ dấu chấm phân cách nghìn, dấu phẩy là dấu thập phân.
const parseAmount = (text: string) => text.replace(/\./g, "").replace(",", ".").trim();
const displayAmount = (value: string) =>
  value === "" || Number.isNaN(Number(value)) || value.endsWith(".") ? value.replace(".", ",") : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(Number(value));

export function BudgetEditor({ plan, onChanged }: { plan: BudgetPlanResponse | null; onChanged?: () => Promise<void> }) {
  const { state, reload } = useApi<BudgetOptionsResponse>("/purchasing/budget-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(options) => <Editor plan={plan} options={options} onChanged={onChanged} />}
    </Loaded>
  );
}

function Editor({ plan, options, onChanged }: { plan: BudgetPlanResponse | null; options: BudgetOptionsResponse; onChanged: (() => Promise<void>) | undefined }) {
  const t = useTranslations("budgets");
  const adjust = useTranslations("budgetAdjustments");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const editable = plan === null || plan.canEdit;
  const today = vietnamToday().slice(0, 7);
  const [fromMonth, setFromMonth] = useState(plan?.fromMonth ?? today);
  const [toMonth, setToMonth] = useState(plan?.toMonth ?? today);
  const [note, setNote] = useState(plan?.note ?? "");
  const [rows, setRows] = useState<Row[]>(() => {
    const unique = new Map<string, Row>();
    for (const line of plan?.lines ?? []) unique.set(`${line.categoryId}|${line.warehouseId}`, { categoryId: line.categoryId, warehouseId: line.warehouseId });
    return [...unique.values()];
  });
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries((plan?.lines ?? []).map((line) => [cellKey(line, line.month), line.amount])));
  const [newCategory, setNewCategory] = useState("");
  const [newWarehouse, setNewWarehouse] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useSubmit();
  const currency = plan?.currency ?? options.currency;
  const months = monthRange(fromMonth, toMonth);
  const categoryName = (id: string) => {
    const category = options.categories.find((item) => item.id === id);
    return category ? `${category.code} · ${category.name}` : (plan?.lines.find((line) => line.categoryId === id)?.categoryName ?? "");
  };
  const warehouseName = (id: string) => options.warehouses.find((item) => item.id === id)?.name ?? plan?.lines.find((line) => line.warehouseId === id)?.warehouseName ?? "";
  const lineOf = (row: Row, month: string) => plan?.lines.find((line) => line.categoryId === row.categoryId && line.warehouseId === row.warehouseId && line.month === month);
  const effective = (row: Row, month: string) => {
    if (!editable) {
      const line = lineOf(row, month);
      return line ? Number(line.amount) + Number(line.adjustedAmount) : 0;
    }
    return Number(amounts[cellKey(row, month)] || 0);
  };

  function body(): SaveBudgetPlanRequest {
    const lines = rows.flatMap((row) => months.filter((month) => (amounts[cellKey(row, month)] ?? "") !== "").map((month) => ({ ...row, month, amount: amounts[cellKey(row, month)]! })));
    return { fromMonth, toMonth, note: note || null, lines, ...(plan ? { version: plan.version } : {}) };
  }

  function save() {
    void form.run(async () => {
      const saved = await apiFetch<BudgetPlanResponse>(plan ? `/purchasing/budget-plans/${plan.id}` : "/purchasing/budget-plans", { method: plan ? "PATCH" : "POST", body: JSON.stringify(body()) });
      notify(t("saved"));
      if (plan) await onChanged?.();
      else router.push(`/budget-plans/${saved.id}`);
    });
  }

  async function act(path: string, payload?: unknown) {
    if (!plan) return;
    setBusy(true);
    try {
      await apiFetch(`/purchasing/budget-plans/${plan.id}/${path}`, { method: "POST", ...(payload ? { body: JSON.stringify(payload) } : {}) });
      notify(path === "submit" ? t("submitted") : t("saved"));
      setConfirmCancel(false);
      await onChanged?.();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  function addRow() {
    if (!newCategory || !newWarehouse) return;
    if (rows.some((row) => row.categoryId === newCategory && row.warehouseId === newWarehouse)) {
      notify(t("rowExists"), "loi");
      return;
    }
    setRows([...rows, { categoryId: newCategory, warehouseId: newWarehouse }]);
    setNewCategory("");
    setNewWarehouse("");
  }

  // Lỗi theo ô từ API dạng "lines.<chỉ số>.<trường>": ghép lại thành danh sách ngành hàng · kho · tháng.
  const sent = body().lines;
  const lineErrors = Object.entries(form.fields)
    .filter(([key]) => key.startsWith("lines."))
    .map(([key, message]) => {
      const line = sent[Number(key.split(".")[1])];
      return line ? `${categoryName(line.categoryId)} · ${warehouseName(line.warehouseId)} · ${monthLabel(line.month)}: ${message}` : message;
    });
  const headings = [t("category"), t("warehouse"), ...months.map(monthLabel), t("sum")];
  const columnTotal = (month: string) => rows.reduce((sum, row) => sum + effective(row, month), 0);
  return (
    <>
      <div>
        <Link href="/budget-plans">‹ {t("back")}</Link>
      </div>
      <div className="tieu-de">
        <h1>{plan ? (plan.documentNo ?? t("draftNo")) : t("add")}</h1>
        {plan && <BudgetStatus status={plan.status} />}
        {plan && <HistoryLink entityId={plan.id} />}
        <span className="nhom-nut">
          {editable && (
            <button type="button" className="nut phu" disabled={form.submitting} onClick={save}>
              {t("saveDraft")}
            </button>
          )}
          {plan?.canSubmit && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("submit", { version: plan.version })}>
              {t("submit")}
            </button>
          )}
          {plan?.canWithdraw && (
            <button type="button" className="nut phu" disabled={busy} onClick={() => void act("withdraw")}>
              {t("withdraw")}
            </button>
          )}
          {plan?.canAdjust && (
            <Link className="nut phu" href={`/budget-adjustments/new?planId=${plan.id}`}>
              {adjust("add")}
            </Link>
          )}
          {plan?.canCancel && (
            <button type="button" className="nut nguy-hiem" disabled={busy} onClick={() => setConfirmCancel(true)}>
              {t("cancelPlan")}
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
          <Field id="tu-thang" label={t("fromMonth")} error={form.fields.fromMonth}>
            <input id="tu-thang" type="month" className={form.inputClass("fromMonth")} value={fromMonth} disabled={!editable} onChange={(event) => setFromMonth(event.target.value)} />
          </Field>
          <Field id="den-thang" label={t("toMonth")} error={form.fields.toMonth}>
            <input id="den-thang" type="month" className={form.inputClass("toMonth")} value={toMonth} disabled={!editable} onChange={(event) => setToMonth(event.target.value)} />
          </Field>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Field id="ghi-chu" label={t("note")} error={form.fields.note}>
              <input id="ghi-chu" className={form.inputClass("note")} value={note} maxLength={500} disabled={!editable} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </div>
        </div>
        <span className="chu-thich">{t("periodHint")}</span>
      </div>
      {editable && (
        <div className="bo-loc">
          <label className="an-nhan" htmlFor="them-nganh">
            {t("category")}
          </label>
          <select id="them-nganh" className="o-nhap" value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>
            <option value="">{t("chooseCategory")}</option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.code} · {category.name}
              </option>
            ))}
          </select>
          <label className="an-nhan" htmlFor="them-kho">
            {t("warehouse")}
          </label>
          <select id="them-kho" className="o-nhap" value={newWarehouse} onChange={(event) => setNewWarehouse(event.target.value)}>
            <option value="">{t("chooseWarehouse")}</option>
            {options.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
          <button type="button" className="nut phu" disabled={!newCategory || !newWarehouse} onClick={addRow}>
            {t("addRow")}
          </button>
        </div>
      )}
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th key={index} scope="col" style={index > 1 ? numericCell : undefined}>
                  {heading}
                </th>
              ))}
              {editable && <th scope="col" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.categoryId}|${row.warehouseId}`}>
                <td data-nhan={headings[0]}>
                  <span>{categoryName(row.categoryId)}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{warehouseName(row.warehouseId)}</span>
                </td>
                {months.map((month, index) => {
                  const key = cellKey(row, month);
                  const line = lineOf(row, month);
                  return (
                    <td key={month} data-nhan={headings[index + 2]} style={numericCell}>
                      {editable ? (
                        <>
                          <label className="an-nhan" htmlFor={key}>
                            {t("amountLabel", { category: categoryName(row.categoryId), warehouse: warehouseName(row.warehouseId), month: monthLabel(month) })}
                          </label>
                          <input
                            id={key}
                            className="o-nhap"
                            style={{ textAlign: "right", minWidth: 130 }}
                            inputMode="decimal"
                            value={displayAmount(amounts[key] ?? "")}
                            onChange={(event) => setAmounts({ ...amounts, [key]: parseAmount(event.target.value) })}
                          />
                        </>
                      ) : (
                        <span>
                          {formatMoney(String(effective(row, month)), currency)}
                          {line?.usedAmount != null && (
                            <>
                              <br />
                              <span className="chu-thich">
                                {t("usedLine", { used: formatMoney(line.usedAmount, currency), remaining: formatMoney(String(effective(row, month) - Number(line.usedAmount)), currency) })}
                              </span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td data-nhan={headings[headings.length - 1]} style={numericCell}>
                  <span>{formatMoney(String(months.reduce((sum, month) => sum + effective(row, month), 0)), currency)}</span>
                </td>
                {editable && (
                  <td>
                    <button type="button" className="nut chu" onClick={() => setRows(rows.filter((item) => item !== row))}>
                      {t("removeRow")}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td data-nhan={headings[0]}>
                <strong>{t("sum")}</strong>
              </td>
              <td />
              {months.map((month, index) => (
                <td key={month} data-nhan={headings[index + 2]} style={numericCell}>
                  <strong>{formatMoney(String(columnTotal(month)), currency)}</strong>
                </td>
              ))}
              <td data-nhan={headings[headings.length - 1]} style={numericCell}>
                <strong>{formatMoney(String(months.reduce((sum, month) => sum + columnTotal(month), 0)), currency)}</strong>
              </td>
              {editable && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      <span className="chu-thich">{t("unit", { currency })}</span>
      {plan?.status === "approved" && <PlanAdjustments planId={plan.id} />}
      {confirmCancel && plan && (
        <ConfirmDialog
          title={t("cancelPlan")}
          text={t("cancelConfirm")}
          confirmLabel={common("confirm")}
          busy={busy}
          onConfirm={() => void act("cancel", { version: plan.version })}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </>
  );
}

// Phiếu điều chỉnh của kế hoạch đã duyệt (MAN_HINH_205).
function PlanAdjustments({ planId }: { planId: string }) {
  const t = useTranslations("budgetAdjustments");
  const { state, reload } = useApi<PageResponse<BudgetAdjustmentListItem>>(`/purchasing/budget-adjustments?planId=${planId}&pageSize=100`);
  const headings = [t("documentNo"), t("plan"), t("reason"), t("totalIncrease"), t("totalDecrease"), t("createdBy"), t("status")];
  return (
    <>
      <h2 style={{ margin: 0 }}>{t("planAdjustments")}</h2>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) => (result.data.length === 0 ? <MessageView text={t("none")} /> : <AdjustmentTable items={result.data} headings={headings} />)}
      </Loaded>
    </>
  );
}
