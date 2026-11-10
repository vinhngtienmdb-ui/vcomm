"use client";

// MAN_HINH_48 Chi tiết công nợ đối tác (CHUC_NANG_66; QUYTAC_NGHIEPVU_87, 90, 91; API_85): tổng, tuổi nợ, khoản công nợ kèm trừ nợ, số dư đầu kỳ.
import type { DebtPartnerResponse, DebtSide, SaveOpeningDebtRequest } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, LoadingView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function DebtPartnerPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <DebtPartner />
    </Suspense>
  );
}

function DebtPartner() {
  const t = useTranslations("debts");
  const { partnerId } = useParams<{ partnerId: string }>();
  const side: DebtSide = useSearchParams().get("side") === "payable" ? "payable" : "receivable";
  const { state, reload } = useApi<DebtPartnerResponse>(`/finance/debts/partners/${partnerId}?side=${side}`);
  const [opening, setOpening] = useState(false);
  return (
    <>
      <Link href={`/debts?side=${side}`}>‹ {t("back")}</Link>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => {
          const money = (value: string) => formatMoney(value, data.currency);
          const ageing = [
            ["notDue", data.ageing.notDue],
            ["overdue1To30", data.ageing.overdue1To30],
            ["overdue31To60", data.ageing.overdue31To60],
            ["overdue61To90", data.ageing.overdue61To90],
            ["overdueOver90", data.ageing.overdueOver90],
          ] as const;
          const headings = [t("documentNo"), t("sourceType"), t("documentDate"), t("dueDate"), t("amount"), t("openAmount"), t("allocations"), ""];
          return (
            <>
              <div className="tieu-de">
                <h1>
                  {data.partner.code} · {data.partner.name}
                </h1>
                <span className="nhan thong-tin">{t(`side_${side}`)}</span>
                {data.canManagePayments && (
                  <Link className="nut chinh" href={`/payments/new?kind=${side === "receivable" ? "customer_receipt" : "supplier_payment"}&partnerId=${data.partner.id}`}>
                    {side === "receivable" ? t("createReceipt") : t("createPayment")}
                  </Link>
                )}
                {data.canManageOpening && (
                  <button type="button" className="nut phu" onClick={() => setOpening(!opening)}>
                    {t("addOpening")}
                  </button>
                )}
              </div>
              <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <strong>
                  {t("balance")}: {money(data.balance)} · {t("advance")}: {money(data.advance)}
                </strong>
                <div className="thong-tin-dong">
                  {ageing.map(([key, value]) => (
                    <span key={key} style={key !== "notDue" && Number(value) > 0 ? { color: "var(--mau-loi)" } : undefined}>
                      {t(key)}: {money(value)}
                    </span>
                  ))}
                </div>
              </section>
              {opening && (
                <OpeningForm
                  partnerId={data.partner.id}
                  side={side}
                  onSaved={() => {
                    setOpening(false);
                    void reload();
                  }}
                  onCancel={() => setOpening(false)}
                />
              )}
              <DebtItems data={data} headings={headings} money={money} reload={() => void reload()} />
            </>
          );
        }}
      </Loaded>
    </>
  );
}

function DebtItems({ data, headings, money, reload }: { data: DebtPartnerResponse; headings: string[]; money: (value: string) => string; reload: () => void }) {
  const t = useTranslations("debts");
  const { notify } = useAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function remove(id: string) {
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/finance/debts/opening/${id}`, { method: "DELETE" });
      notify(t("openingDeleted"));
      reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(null);
    }
  }
  if (data.items.length === 0) return <p className="chu-thich">{t("noItems")}</p>;
  return (
    <>
      <FormError text={error} />
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th key={`${heading}-${index}`} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td data-nhan={headings[0]}>
                  <span>{item.documentNo || "—"}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>
                    {item.paymentKind ? t(`paymentKind_${item.paymentKind}`) : t(`source_${item.sourceType}`)}
                    {item.sourceType === "opening" && ` (${t(`direction_${item.direction}`)})`}
                  </span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{formatDate(item.documentDate)}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>
                    {formatDate(item.dueDate)}
                    {item.overdueDays > 0 && <span style={{ color: "var(--mau-loi)" }}> · {t("overdueDays", { days: item.overdueDays })}</span>}
                  </span>
                </td>
                <td data-nhan={headings[4]}>
                  <span style={{ whiteSpace: "nowrap" }}>{item.direction === "credit" ? `−${money(item.amount)}` : money(item.amount)}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <span style={{ whiteSpace: "nowrap" }}>{money(item.openAmount)}</span>
                </td>
                <td data-nhan={headings[6]}>
                  <span>
                    {item.allocations.length === 0
                      ? "—"
                      : item.allocations.map((allocation) => `${allocation.documentNo || t(`source_${allocation.sourceType}`)}: ${money(allocation.amount)}`).join("; ")}
                  </span>
                </td>
                <td data-nhan={headings[7]}>
                  {item.canDelete && (
                    <button type="button" className={`nut chu${busy === item.id ? " dang-xu-ly" : ""}`} disabled={busy !== null} onClick={() => void remove(item.id)}>
                      {t("delete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OpeningForm({ partnerId, side, onSaved, onCancel }: { partnerId: string; side: DebtSide; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("debts");
  const { notify } = useAdmin();
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState(vietnamToday());
  const [dueDate, setDueDate] = useState(vietnamToday());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveOpeningDebtRequest = { partnerId, side, direction, documentNo, documentDate, dueDate: direction === "debit" ? dueDate : null, amount, note };
      await apiFetch("/finance/debts/opening", { method: "POST", body: JSON.stringify(body) });
      notify(t("openingSaved"));
      onSaved();
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <strong>{t("addOpening")}</strong>
      <Field id="huong-dau-ky" label={t("direction")}>
        <select id="huong-dau-ky" className="o-nhap" value={direction} onChange={(event) => setDirection(event.target.value as "debit" | "credit")}>
          <option value="debit">{t("direction_debit")}</option>
          <option value="credit">{t("direction_credit")}</option>
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="so-chung-tu-cu" label={`${t("documentNo")} *`} error={fields.documentNo}>
          <input id="so-chung-tu-cu" className={inputClass("documentNo")} value={documentNo} onChange={(event) => setDocumentNo(event.target.value)} />
        </Field>
        <Field id="ngay-chung-tu-cu" label={`${t("documentDate")} *`} error={fields.documentDate}>
          <input id="ngay-chung-tu-cu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
        </Field>
        {direction === "debit" && (
          <Field id="han-chung-tu-cu" label={`${t("dueDate")} *`} error={fields.dueDate}>
            <input id="han-chung-tu-cu" type="date" className={inputClass("dueDate")} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
        )}
        <Field id="so-tien-dau-ky" label={`${t("amount")} *`} error={fields.amount}>
          <input id="so-tien-dau-ky" className={inputClass("amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
      </div>
      <Field id="ghi-chu-dau-ky" label={t("note")} error={fields.note}>
        <input id="ghi-chu-dau-ky" className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {fields.partnerId && <span className="loi-o">{fields.partnerId}</span>}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
