"use client";

// MAN_HINH_161 Bán hàng tại quầy (CHUC_NANG_187; QUYTAC_NGHIEPVU_370 đến 373): ô quét luôn nhận bàn phím; giá, khuyến mãi, tổng tiền do máy chủ tính (API_195).
// Phím tắt: F2 người mua lấy hóa đơn, F3 khách VComm (lát L6), F4 giảm tay dòng đang chọn, F9 thanh toán, Delete xóa dòng, Esc đóng hộp thoại.
import type { RetailCustomerResponse, RetailItemOption, RetailQuoteResponse, RetailSaleResponse, RetailShiftResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { failureOf } from "ui/lib/use-api";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { BuyerDialog, type Buyer } from "./BuyerDialog";
import { CustomerBox, lookupCustomer } from "./CustomerBox";
import { PaymentDialog } from "./PaymentDialog";
import { Receipt } from "./Receipt";

export interface CartItem {
  variantId: string;
  sku: string;
  productName: string;
  unitId: string;
  units: RetailItemOption["units"];
  quantity: string;
  discountPercent: string;
  tracksSerials: boolean;
  serials: string[];
}

const emptyBuyer: Buyer = { name: "", taxCode: "", address: "", identityNo: "" };

export function Counter({ shift, onShiftChanged }: { shift: RetailShiftResponse; onShiftChanged: () => void }) {
  const t = useTranslations("retailCounter");
  const { can } = useAdmin();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState<RetailItemOption[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quote, setQuote] = useState<RetailQuoteResponse | null>(null);
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [quoting, setQuoting] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>(emptyBuyer);
  const [customer, setCustomer] = useState<{ phone: string; data: RetailCustomerResponse } | null>(null);
  const customerRef = useRef<HTMLInputElement | null>(null);
  const [dialog, setDialog] = useState<"buyer" | "payment" | null>(null);
  const [done, setDone] = useState<RetailSaleResponse | null>(null);
  const [online, setOnline] = useState(true);
  const scanRef = useRef<HTMLInputElement>(null);
  const discountRefs = useRef<(HTMLInputElement | null)[]>([]);
  const money = (amount: string) => formatMoney(amount, shift.currency);

  const focusScan = useCallback(() => setTimeout(() => scanRef.current?.focus(), 0), []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Giỏ đổi thì tính lại ở máy chủ (đợi người dùng ngừng gõ một chút).
  const refreshQuote = useCallback(
    async (lines: CartItem[]) => {
      if (lines.length === 0) {
        setQuote(null);
        setQuoteErrors({});
        return;
      }
      setQuoting(true);
      try {
        const result = await apiFetch<RetailQuoteResponse>("/retail/quote", {
          method: "POST",
          body: JSON.stringify({ shiftId: shift.id, lines: lines.map(({ variantId, unitId, quantity, discountPercent, serials }) => ({ variantId, unitId, quantity, discountPercent, serials })) }),
        });
        setQuote(result);
        setQuoteErrors({});
      } catch (error) {
        const failure = failureOf(error);
        setQuote(null);
        setQuoteErrors(Object.keys(failure.fields).length > 0 ? failure.fields : { "": failure.message });
      } finally {
        setQuoting(false);
      }
    },
    [shift.id],
  );
  useEffect(() => {
    const timer = setTimeout(() => void refreshQuote(cart), 300);
    return () => clearTimeout(timer);
  }, [cart, refreshQuote]);

  function add(option: RetailItemOption) {
    setChoices(null);
    setSearch("");
    setNotice(null);
    setCart((current) => {
      const index = current.findIndex((item) => item.variantId === option.variantId && item.unitId === option.unitId);
      if (index >= 0) {
        const item = current[index]!;
        if (option.serial && item.serials.includes(option.serial)) return current;
        const serials = option.serial ? [...item.serials, option.serial] : item.serials;
        const next = [...current];
        next[index] = { ...item, quantity: String(Number(item.quantity) + 1), serials };
        setSelected(index);
        return next;
      }
      setSelected(current.length);
      return [
        ...current,
        {
          variantId: option.variantId,
          sku: option.sku,
          productName: [option.productName, ...option.optionValues].join(" · "),
          unitId: option.unitId,
          units: option.units,
          quantity: "1",
          discountPercent: "0",
          tracksSerials: option.tracksSerials,
          serials: option.serial ? [option.serial] : [],
        },
      ];
    });
    focusScan();
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    const text = search.trim();
    if (!text) return;
    try {
      const found = await apiFetch<RetailItemOption[]>(`/retail/items?${new URLSearchParams({ shiftId: shift.id, search: text })}`);
      const exact = found.filter((option) => option.exact);
      if (exact.length === 1) add(exact[0]!);
      else if (found.length === 0) setNotice(t("notFound"));
      else setChoices(found);
    } catch (error) {
      setNotice(failureOf(error).message);
    }
  }

  function update(index: number, change: Partial<CartItem>) {
    setCart((current) => current.map((item, position) => (position === index ? { ...item, ...change } : item)));
  }
  function remove(index: number) {
    setCart((current) => current.filter((_, position) => position !== index));
    setSelected((value) => Math.max(0, Math.min(value, cart.length - 2)));
    focusScan();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (dialog || done) return;
    if (event.key === "F9") {
      event.preventDefault();
      if (quote && online) setDialog("payment");
    } else if (event.key === "F2") {
      event.preventDefault();
      setDialog("buyer");
    } else if (event.key === "F3") {
      event.preventDefault();
      customerRef.current?.focus();
    } else if (event.key === "F4") {
      event.preventDefault();
      discountRefs.current[selected]?.select();
    } else if (event.key === "Delete" && cart.length > 0 && event.target === scanRef.current && search === "") {
      event.preventDefault();
      remove(selected);
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && event.target === scanRef.current && cart.length > 0) {
      event.preventDefault();
      setSelected((value) => (event.key === "ArrowDown" ? Math.min(cart.length - 1, value + 1) : Math.max(0, value - 1)));
    }
  }

  function newSale() {
    setCart([]);
    setBuyer(emptyBuyer);
    setCustomer(null);
    setDone(null);
    setQuote(null);
    onShiftChanged();
    focusScan();
  }

  // Mức điểm dùng được tính theo tổng phải trả: tra lại khách khi tổng đổi.
  const total = quote?.totalAmount ?? null;
  const customerPhone = customer?.data.found ? customer.phone : null;
  useEffect(() => {
    if (!customerPhone) return;
    let active = true;
    lookupCustomer(shift.id, customerPhone, total)
      .then((data) => active && setCustomer({ phone: customerPhone, data }))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [shift.id, customerPhone, total]);

  const lineError = (index: number) => quoteErrors[`lines.${index}.discountPercent`] ?? quoteErrors[`lines.${index}.variantId`] ?? quoteErrors[`lines.${index}.unitId`];
  const generalError = Object.keys(quoteErrors).some((key) => !key.startsWith("lines.")) ? Object.entries(quoteErrors).find(([key]) => !key.startsWith("lines."))?.[1] : null;
  const pricedFor = (item: CartItem) => quote?.lines.find((line) => !line.isGift && line.variantId === item.variantId && line.unitId === item.unitId);
  const gifts = quote?.lines.filter((line) => line.isGift) ?? [];
  const cash = shift.summary.find((line) => line.method === "cash");

  return (
    <div onKeyDown={onKeyDown} style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h1>
          {shift.store.name} · {shift.register.code}
        </h1>
        <span className={`nhan ${online ? "thanh-cong" : "loi"}`}>{online ? t("online") : t("offlineBadge")}</span>
        <Link className="nut phu" href="/sales">
          {t("sales")}
        </Link>
        {can("retail.return") && (
          <Link className="nut phu" href="/returns">
            {t("returns")}
          </Link>
        )}
        <Link className="nut phu" href={`/shifts/${shift.id}`}>
          {t("closeShift")}
        </Link>
      </div>
      {!online && (
        <div className="khoi-canh-bao loi" role="alert">
          {t("offline")}
        </div>
      )}
      <div className="quay-ban">
        <section style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <form onSubmit={lookup} className="the" style={{ display: "flex", gap: "var(--khoang-2)" }}>
            <label htmlFor="o-quet" className="an-nhan">
              {t("scanLabel")}
            </label>
            <input
              id="o-quet"
              ref={scanRef}
              autoFocus
              autoComplete="off"
              className="o-nhap o-quet"
              placeholder={t("scanPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="submit" className="nut phu">
              {t("search")}
            </button>
          </form>
          {notice && <div className="khoi-canh-bao canh-bao">{notice}</div>}
          {choices && (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h3>{t("chooseItem")}</h3>
              {choices.map((option) => (
                <button key={`${option.variantId}-${option.serial ?? ""}`} type="button" className="nut phu" style={{ justifyContent: "space-between" }} onClick={() => add(option)}>
                  <span>
                    {option.sku} · {[option.productName, ...option.optionValues].join(" · ")}
                  </span>
                  <span className="chu-thich">{t("available", { quantity: option.available })}</span>
                </button>
              ))}
            </div>
          )}
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("item")}</th>
                  <th scope="col">{t("unit")}</th>
                  <th scope="col">{t("quantity")}</th>
                  <th scope="col">{t("listPrice")}</th>
                  <th scope="col">{t("discount")}</th>
                  <th scope="col">{t("lineTotal")}</th>
                  <th scope="col">
                    <span className="an-nhan">{t("remove")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={7} data-nhan="">
                      <span className="chu-thich">{t("emptyCart")}</span>
                    </td>
                  </tr>
                )}
                {cart.map((item, index) => {
                  const priced = pricedFor(item);
                  const error = lineError(index);
                  return (
                    <tr key={`${item.variantId}-${item.unitId}`} className={index === selected ? "dang-chon" : undefined} onClick={() => setSelected(index)}>
                      <td data-nhan={t("item")}>
                        <span>
                          {item.productName}
                          <span className="chu-thich" style={{ display: "block" }}>
                            {item.sku}
                            {item.serials.length > 0 ? ` · ${t("serials", { serials: item.serials.join(", ") })}` : ""}
                          </span>
                          {priced?.promotionName && <span className="nhan thong-tin">{priced.promotionName}</span>}
                          {error && (
                            <span className="loi-o" style={{ display: "block" }}>
                              {error}
                            </span>
                          )}
                        </span>
                      </td>
                      <td data-nhan={t("unit")}>
                        {item.units.length > 1 && !item.tracksSerials ? (
                          <select className="o-nhap" aria-label={t("unit")} value={item.unitId} onChange={(event) => update(index, { unitId: event.target.value })}>
                            {item.units.map((unit) => (
                              <option key={unit.unitId} value={unit.unitId}>
                                {unit.unitName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span>{item.units.find((unit) => unit.unitId === item.unitId)?.unitName}</span>
                        )}
                      </td>
                      <td data-nhan={t("quantity")}>
                        {item.tracksSerials ? (
                          <span>{item.quantity}</span>
                        ) : (
                          <span className="chon-so-luong">
                            <button
                              type="button"
                              className="nut phu"
                              aria-label={t("decrease")}
                              onClick={() => Number(item.quantity) > 1 && update(index, { quantity: String(Number(item.quantity) - 1) })}
                            >
                              −
                            </button>
                            <input className="o-nhap" inputMode="decimal" aria-label={t("quantity")} value={item.quantity} onChange={(event) => update(index, { quantity: event.target.value })} />
                            <button type="button" className="nut phu" aria-label={t("increase")} onClick={() => update(index, { quantity: String(Number(item.quantity) + 1) })}>
                              +
                            </button>
                          </span>
                        )}
                      </td>
                      <td data-nhan={t("listPrice")} className="so-tien">
                        <span>{priced ? money(priced.listPrice) : "—"}</span>
                      </td>
                      <td data-nhan={t("discount")}>
                        <input
                          ref={(element) => {
                            discountRefs.current[index] = element;
                          }}
                          className={`o-nhap${quoteErrors[`lines.${index}.discountPercent`] ? " loi" : ""}`}
                          style={{ width: 72 }}
                          inputMode="decimal"
                          aria-label={t("discount")}
                          value={item.discountPercent}
                          onChange={(event) => update(index, { discountPercent: event.target.value || "0" })}
                          onKeyDown={(event) => event.key === "Enter" && focusScan()}
                        />
                      </td>
                      <td data-nhan={t("lineTotal")} className="so-tien">
                        <span>{priced ? money(priced.total) : "—"}</span>
                      </td>
                      <td data-nhan="">
                        <button type="button" className="nut chu" aria-label={t("remove")} onClick={() => remove(index)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {gifts.map((gift, index) => (
                  <tr key={`tang-${index}`}>
                    <td data-nhan={t("item")}>
                      <span>
                        {gift.productName} <span className="nhan thanh-cong">{t("gift")}</span>
                        <span className="chu-thich" style={{ display: "block" }}>
                          {gift.promotionName}
                        </span>
                      </span>
                    </td>
                    <td data-nhan={t("unit")}>
                      <span>{gift.unitName}</span>
                    </td>
                    <td data-nhan={t("quantity")}>
                      <span>{gift.quantity}</span>
                    </td>
                    <td data-nhan={t("listPrice")} className="so-tien">
                      <span>{money(gift.listPrice)}</span>
                    </td>
                    <td data-nhan={t("discount")}>
                      <span>—</span>
                    </td>
                    <td data-nhan={t("lineTotal")} className="so-tien">
                      <span>{money("0")}</span>
                    </td>
                    <td data-nhan="" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chu-thich">{t("keys")}</p>
        </section>

        <aside style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <h3>{t("customer")}</h3>
            <span>{buyer.name || t("walkIn")}</span>
            {buyer.taxCode && <span className="chu-thich">{buyer.taxCode}</span>}
            <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => setDialog("buyer")}>
              {t("invoiceBuyer")} <span className="phim">F2</span>
            </button>
            <hr style={{ border: 0, borderTop: "1px solid var(--mau-vien)", width: "100%" }} />
            <CustomerBox shiftId={shift.id} goodsAmount={quote?.totalAmount ?? null} customer={customer} inputRef={customerRef} onChange={setCustomer} />
          </div>
          <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }} aria-live="polite">
            <div className="dong-tien">
              <span>{t("goodsAmount")}</span>
              <span>{quote ? money(quote.goodsAmount) : "—"}</span>
            </div>
            <div className="dong-tien">
              <span>{t("promotion")}</span>
              <span>{quote ? `−${money(quote.promotionAmount)}` : "—"}</span>
            </div>
            <div className="dong-tien">
              <span>{t("manualDiscount")}</span>
              <span>{quote ? `−${money(quote.manualDiscount)}` : "—"}</span>
            </div>
            <div className="dong-tien chu-thich">
              <span>{t("taxIncluded")}</span>
              <span>{quote ? money(quote.taxAmount) : "—"}</span>
            </div>
            <hr style={{ border: 0, borderTop: "1px solid var(--mau-vien)", width: "100%" }} />
            <div className="dong-tien">
              <span className="tong-lon">{t("payable")}</span>
              <span className="tong-lon">{quoting ? t("quoting") : quote ? money(quote.totalAmount) : "—"}</span>
            </div>
            {quote?.giftShortages.map((shortage) => (
              <span key={shortage.promotionName} className="chu-thich">
                {t("giftShortage", { promotion: shortage.promotionName, sets: shortage.missingSets })}
              </span>
            ))}
            {generalError && <span className="loi-o">{generalError}</span>}
          </div>
          <button type="button" className="nut chinh lon" disabled={!quote || quoting || !online} onClick={() => setDialog("payment")}>
            {t("pay")} <span className="phim">F9</span>
          </button>
          <div className="khoi-canh-bao thong-tin">
            {t("shiftInfo", { time: formatDateTime(shift.openedAt), count: shift.saleCount, cash: money(String(Number(shift.openingCash) + Number(cash?.net ?? 0))) })}
          </div>
        </aside>
      </div>

      {dialog === "buyer" && (
        <BuyerDialog
          buyer={buyer}
          onApply={(value) => {
            setBuyer(value);
            setDialog(null);
            focusScan();
          }}
          onClose={() => {
            setDialog(null);
            focusScan();
          }}
        />
      )}
      {dialog === "payment" && quote && (
        <PaymentDialog
          shift={shift}
          cart={cart}
          buyer={buyer}
          customer={customer?.data.found ? customer.data : null}
          quote={quote}
          onQuoteChanged={() => void refreshQuote(cart)}
          onPaid={(sale) => {
            setDialog(null);
            setDone(sale);
          }}
          onClose={() => {
            setDialog(null);
            focusScan();
          }}
        />
      )}
      {done && (
        <div className="man-che giua">
          <div className="hop-thoai" role="dialog" aria-modal="true" aria-label={t("paid", { number: done.documentNo })}>
            <h2>{t("paid", { number: done.documentNo })}</h2>
            <div className="dong-tien">
              <span>{t("change")}</span>
              <span className="tong-lon">{money(done.changeAmount)}</span>
            </div>
            <div className="nhom-nut">
              <button type="button" className="nut phu" onClick={() => window.print()}>
                {t("print")}
              </button>
              <button type="button" className="nut chinh" autoFocus onClick={newSale}>
                {t("newSale")}
              </button>
            </div>
          </div>
          <Receipt sale={done} />
        </div>
      )}
    </div>
  );
}
