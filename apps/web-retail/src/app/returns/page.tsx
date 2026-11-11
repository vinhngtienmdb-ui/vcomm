"use client";

// MAN_HINH_164 Trả hàng (CHUC_NANG_188; QUYTAC_NGHIEPVU_376, 377; API_197): tìm hóa đơn bán lẻ, chọn số trả, serial; tiền hoàn do máy chủ tính; hoàn tiền mặt từ ca hoặc chuyển khoản.
import type { CreateRetailReturnRequest, RetailCounterContext, RetailReturnableResponse, RetailReturnQuoteResponse, RetailReturnResponse, RetailSaleListResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError } from "ui/components/Form";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { OpenShiftForm } from "@/components/OpenShiftForm";
import { ReturnSlip } from "@/components/ReturnSlip";

type Choice = { quantity: string; serials: string[] };

function ReturnForm({ shiftId, initialSale }: { shiftId: string; initialSale: string | null }) {
  const t = useTranslations("retailReturns");
  const [search, setSearch] = useState("");
  const [sale, setSale] = useState<RetailReturnableResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<"cash" | "bank_transfer">("cash");
  const [recipient, setRecipient] = useState("");
  const [reference, setReference] = useState("");
  const [sent, setSent] = useState(false);
  const [quote, setQuote] = useState<RetailReturnQuoteResponse | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<RetailReturnResponse | null>(null);

  const load = useCallback(
    async (saleId: string) => {
      setNotice(null);
      setChoices({});
      setQuote(null);
      try {
        setSale(await apiFetch<RetailReturnableResponse>(`/retail/sales/${saleId}/returnable?shiftId=${shiftId}`));
      } catch (failure) {
        setSale(null);
        setNotice(failureOf(failure).message);
      }
    },
    [shiftId],
  );
  useEffect(() => {
    if (initialSale) void load(initialSale);
  }, [initialSale, load]);

  async function find(event: FormEvent) {
    event.preventDefault();
    const number = search.trim();
    if (!number) return;
    const found = await apiFetch<RetailSaleListResponse>(`/retail/sales?${new URLSearchParams({ search: number })}`);
    const exact = found.items.find((item) => item.documentNo.toUpperCase() === number.toUpperCase()) ?? (found.items.length === 1 ? found.items[0] : undefined);
    if (exact) void load(exact.id);
    else {
      setSale(null);
      setNotice(t("notFound"));
    }
  }

  const lines = sale
    ? Object.entries(choices)
        .filter(([, choice]) => Number(choice.quantity) > 0)
        .map(([orderLineId, choice]) => ({ orderLineId, quantity: choice.quantity, serials: choice.serials }))
    : [];
  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    if (!sale || lines.length === 0 || sale.blockedReason) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setQuote(await apiFetch<RetailReturnQuoteResponse>("/retail/returns/quote", { method: "POST", body: JSON.stringify({ shiftId, saleId: sale.saleId, lines }) }));
        setFields({});
      } catch (failure) {
        setQuote(null);
        setFields(failureOf(failure).fields);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [linesKey, sale, shiftId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!sale || !quote) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateRetailReturnRequest = {
        shiftId,
        saleId: sale.saleId,
        clientKey,
        reason,
        lines,
        refund: { method, recipient, bankReference: reference },
        expectedRefund: quote.refundAmount,
      };
      setDone(await apiFetch<RetailReturnResponse>("/retail/returns", { method: "POST", body: JSON.stringify(body) }));
    } catch (failure) {
      const details = failureOf(failure);
      setFields(details.fields);
      setError(details.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <h2>{t("done", { number: done.documentNo })}</h2>
        <div className="dong-tien">
          <span>{t("total")}</span>
          <span className="tong-lon">{formatMoney(done.refundAmount, done.currency)}</span>
        </div>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={() => window.print()}>
            {t("print")}
          </button>
          <button
            type="button"
            className="nut chinh"
            onClick={() => {
              setDone(null);
              setSale(null);
              setSearch("");
              setReason("");
              setClientKey(crypto.randomUUID());
            }}
          >
            {t("next")}
          </button>
        </div>
        <ReturnSlip slip={done} />
      </div>
    );
  }

  const money = (amount: string) => formatMoney(amount, sale?.currency ?? "VND");
  const ready = quote !== null && reason.trim() !== "" && (method === "cash" || (recipient.trim() !== "" && sent));
  return (
    <>
      <form onSubmit={find} className="the" style={{ display: "flex", gap: "var(--khoang-2)" }}>
        <label htmlFor="so-hoa-don" className="an-nhan">
          {t("searchLabel")}
        </label>
        <input id="so-hoa-don" className="o-nhap o-quet" autoFocus placeholder={t("searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit" className="nut phu">
          {t("find")}
        </button>
      </form>
      {notice && <div className="khoi-canh-bao canh-bao">{notice}</div>}
      {sale && (
        <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <div className="tieu-de">
            <span style={{ flex: 1 }}>
              <strong>{t("saleInfo", { number: sale.documentNo, time: formatDateTime(sale.soldAt), register: sale.registerCode, cashier: sale.cashierName })}</strong>
              <span className="chu-thich" style={{ display: "block" }}>
                {sale.buyerName ? `${sale.buyerName} · ` : ""}
                {t("returnUntil", { date: formatDate(sale.returnUntil) })}
              </span>
            </span>
            {sale.blockedReason ? <span className="nhan loi">{t(`blocked_${sale.blockedReason}`)}</span> : <span className="nhan thanh-cong">{t("inWindow")}</span>}
          </div>
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("item")}</th>
                  <th scope="col">{t("sold")}</th>
                  <th scope="col">{t("returned")}</th>
                  <th scope="col">{t("remaining")}</th>
                  <th scope="col">{t("quantity")}</th>
                  <th scope="col">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {sale.lines.map((line, index) => {
                  const choice = choices[line.orderLineId] ?? { quantity: "", serials: [] };
                  const position = lines.findIndex((item) => item.orderLineId === line.orderLineId);
                  const lineError = position >= 0 ? (fields[`lines.${position}.quantity`] ?? fields[`lines.${position}.serials`]) : undefined;
                  const amount = quote?.lines.find((item) => item.orderLineId === line.orderLineId)?.amount;
                  const disabled = Boolean(sale.blockedReason) || Number(line.remainingQuantity) <= 0;
                  return (
                    <tr key={line.orderLineId}>
                      <td data-nhan={t("item")}>
                        <span>
                          {line.productName} {line.isGift && <span className="nhan thanh-cong">{t("gift")}</span>}
                          <span className="chu-thich" style={{ display: "block" }}>
                            {line.sku} · {money(line.lineTotal)}
                          </span>
                          {lineError && <span className="loi-o">{lineError}</span>}
                        </span>
                      </td>
                      <td data-nhan={t("sold")}>
                        <span>
                          {line.soldQuantity} {line.unitName}
                        </span>
                      </td>
                      <td data-nhan={t("returned")}>
                        <span>{line.returnedQuantity}</span>
                      </td>
                      <td data-nhan={t("remaining")}>
                        <span>{line.remainingQuantity}</span>
                      </td>
                      <td data-nhan={t("quantity")}>
                        {line.tracksSerials ? (
                          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                            {line.serials.map((serial) => (
                              <label key={serial}>
                                <input
                                  type="checkbox"
                                  disabled={disabled}
                                  checked={choice.serials.includes(serial)}
                                  onChange={(event) => {
                                    const serials = event.target.checked ? [...choice.serials, serial] : choice.serials.filter((item) => item !== serial);
                                    setChoices({ ...choices, [line.orderLineId]: { quantity: String(serials.length), serials } });
                                  }}
                                />{" "}
                                {serial}
                              </label>
                            ))}
                          </span>
                        ) : (
                          <input
                            className={`o-nhap${lineError ? " loi" : ""}`}
                            style={{ width: 80 }}
                            inputMode="decimal"
                            aria-label={`${t("quantity")} ${line.productName}`}
                            disabled={disabled}
                            value={choice.quantity}
                            onChange={(event) => setChoices({ ...choices, [line.orderLineId]: { quantity: event.target.value, serials: [] } })}
                          />
                        )}
                      </td>
                      <td data-nhan={t("amount")} className="so-tien">
                        <span>{amount ? money(amount) : "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Field id="ly-do-tra" label={`${t("reason")} *`} error={fields.reason}>
            <textarea id="ly-do-tra" className="o-nhap" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)" }}>
            <div style={{ display: "grid", gap: "var(--khoang-2)", flex: "1 1 240px" }}>
              <h3>{t("refundTo")}</h3>
              <div className="dong-tien">
                <span>{t("total")}</span>
                <strong className="tong-lon">{quote ? money(quote.refundAmount) : "—"}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gap: "var(--khoang-2)", flex: "1 1 280px" }}>
              <label>
                <input type="radio" name="cach-hoan" checked={method === "cash"} onChange={() => setMethod("cash")} /> {t("cash")}
              </label>
              <label>
                <input type="radio" name="cach-hoan" checked={method === "bank_transfer"} onChange={() => setMethod("bank_transfer")} /> {t("transfer")}
              </label>
              {method === "bank_transfer" && (
                <>
                  <Field id="nguoi-nhan" label={`${t("recipient")} *`} error={fields["refund.recipient"]}>
                    <input id="nguoi-nhan" className="o-nhap" maxLength={300} value={recipient} onChange={(event) => setRecipient(event.target.value)} />
                  </Field>
                  <Field id="ma-giao-dich-hoan" label={t("reference")}>
                    <input id="ma-giao-dich-hoan" className="o-nhap" maxLength={50} value={reference} onChange={(event) => setReference(event.target.value)} />
                  </Field>
                  <label>
                    <input type="checkbox" checked={sent} onChange={(event) => setSent(event.target.checked)} /> {t("transferSent")}
                  </label>
                </>
              )}
            </div>
          </div>
          <div className="khoi-canh-bao thong-tin">{t("hint")}</div>
          <FormError text={error} />
          <div className="nhom-nut">
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={!ready || submitting}>
              {t("confirm")}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <Returns />
    </Suspense>
  );
}

function Returns() {
  const t = useTranslations("retailReturns");
  const shifts = useTranslations("retailShifts");
  const { can, notify } = useAdmin();
  const saleId = useSearchParams().get("sale");
  const { state, reload } = useApi<RetailCounterContext>("/retail/counter");
  if (!can("retail.return")) return <MessageView text={t("noReturnPermission")} />;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(context) =>
          context.currentShift ? (
            <ReturnForm shiftId={context.currentShift.id} initialSale={saleId} />
          ) : (
            <OpenShiftForm
              context={context}
              onOpened={() => {
                notify(shifts("opened"));
                void reload();
              }}
            />
          )
        }
      </Loaded>
    </>
  );
}
