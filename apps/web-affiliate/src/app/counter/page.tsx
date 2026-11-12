"use client";

// MAN_HINH_174 Quầy tích đổi điểm (CONG_VIEC_55; CHUC_NANG_194; QUYTAC_NGHIEPVU_394 đến 400; API_208).
// Ba cách định danh khách: hiện mã QR của cửa hàng, quét mã thành viên của khách, số điện thoại. Tiền, điểm do máy chủ tính.
import type { AffiliateTransactionCreated, AffiliateTransactionItem, AffiliateTransactionMethod, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { useCallback, useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber, vietnamToday } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { QrScanner } from "@/components/QrScanner";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

const statusClass: Record<AffiliateTransactionItem["status"], string> = {
  pending: "thong-tin",
  completed: "thanh-cong",
  declined: "loi",
  expired: "trung-tinh",
  cancelled: "canh-bao",
};

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(6, 8);
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(Math.round((new Date(until).getTime() - now) / 1000), 0);
  return (
    <>
      {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
    </>
  );
}

function Result({ transaction }: { transaction: AffiliateTransactionItem }) {
  const t = useTranslations("merchantPortal");
  const money = (value: string) => `${formatNumber(value, 0)} đ`;
  return (
    <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <p className="chu-thich" style={{ margin: 0 }}>
        {transaction.buyerName ?? "—"} · {t(`method_${transaction.method}`)} · {formatDateTime(transaction.completedAt ?? transaction.createdAt)}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{t("billAmount")}</span>
        <span>{money(transaction.billAmount)}</span>
      </div>
      {Number(transaction.voucherDiscount) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{t("voucherDiscount")}</span>
          <span>− {money(transaction.voucherDiscount)}</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{t("redeemedPoints", { points: formatNumber(transaction.redeemedPoints, 0) })}</span>
        <span>− {money(transaction.redeemedAmount)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18, borderTop: "1px solid var(--mau-vien)", paddingTop: "var(--khoang-2)" }}>
        <span>{t("customerPays")}</span>
        <span>{transaction.paidAmount === null ? "—" : money(transaction.paidAmount)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{t("earnedPoints")}</span>
        <span>{formatNumber(transaction.earnedPoints, 0)}</span>
      </div>
      {transaction.skipReason && <div className="khoi-canh-bao canh-bao">{t(`skip_${transaction.skipReason}`)}</div>}
    </div>
  );
}

function CancelDrawer({ transaction, onClose, onDone }: { transaction: AffiliateTransactionItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("merchantPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  return (
    <Drawer title={t("cancelTitle", { no: transaction.documentNo })} onClose={onClose}>
      <p className="chu-thich">{t("cancelHint")}</p>
      <Field id="ly-do-huy" label={t("reason")} error={fields.reason}>
        <textarea id="ly-do-huy" className={inputClass("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
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
              await portalFetch(`/merchant-portal/transactions/${transaction.id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
              onDone();
            })
          }
        >
          {t("cancelTransaction")}
        </button>
      </div>
    </Drawer>
  );
}

export default function CounterPage() {
  const t = useTranslations("merchantPortal");
  const affiliate = useTranslations("affiliate");
  const { membership, notify } = usePortal();
  const [outletId, setOutletId] = useState(membership.outlets[0]?.id ?? "");
  const [bill, setBill] = useState("");
  const [method, setMethod] = useState<AffiliateTransactionMethod>("merchant_qr");
  const [phone, setPhone] = useState("");
  const [current, setCurrent] = useState<AffiliateTransactionItem | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<AffiliateTransactionItem | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const today = vietnamToday();
  const { state, reload } = usePortalApi<PageResponse<AffiliateTransactionItem>>(`/merchant-portal/transactions?from=${today}&to=${today}${outletId ? `&outletId=${outletId}` : ""}`);
  const canTransact = membership.merchantStatus === "active";
  const amount = bill.replace(/[.\s,]/g, "");

  // Chờ khách xác nhận: hỏi lại trạng thái mỗi 2 giây.
  useEffect(() => {
    if (!current || current.status !== "pending") return;
    const timer = setInterval(() => {
      void portalFetch<AffiliateTransactionItem>(`/merchant-portal/transactions/${current.id}`).then((fresh) => {
        if (fresh.status !== "pending") {
          setCurrent(fresh);
          setQr(null);
          void reload();
        }
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [current, reload]);

  const submit = useCallback(
    (memberCode?: string) =>
      void run(async () => {
        const created = await portalFetch<AffiliateTransactionCreated>("/merchant-portal/transactions", {
          method: "POST",
          body: JSON.stringify({ outletId, billAmount: amount, method, ...(method === "phone" ? { phone } : {}), ...(memberCode ? { memberCode } : {}) }),
        });
        setCurrent(created.transaction);
        setQr(created.qrCode);
        void reload();
      }),
    [amount, method, outletId, phone, reload, run],
  );

  if (membership.outlets.length === 0) return <MessageView text={t("noOutlet")} />;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("menu_counter")}</h1>
        <label htmlFor="chon-diem-ban" className="an-nhan">
          {t("outlet")}
        </label>
        <select id="chon-diem-ban" className="o-nhap" style={{ width: "auto" }} value={outletId} onChange={(event) => setOutletId(event.target.value)}>
          {membership.outlets.map((outlet) => (
            <option key={outlet.id} value={outlet.id}>
              {outlet.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--khoang-4)", alignItems: "start" }}>
        <section className="the">
          <Field id="tien-hoa-don" label={t("billAmountInput")} error={fields.billAmount}>
            <input
              id="tien-hoa-don"
              className={inputClass("billAmount")}
              inputMode="numeric"
              style={{ fontSize: 28, fontWeight: 800, textAlign: "right", minHeight: 56 }}
              value={bill}
              disabled={!canTransact}
              onChange={(event) => setBill(event.target.value.replace(/[^\d]/g, "") ? formatNumber(event.target.value.replace(/[^\d]/g, ""), 0) : "")}
            />
          </Field>
          <div className="cac-the" role="tablist">
            {(["merchant_qr", "buyer_qr", "phone"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={method === item} className={method === item ? "chon" : ""} onClick={() => (setMethod(item), setQr(null))}>
                {t(`tab_${item}`)}
              </button>
            ))}
          </div>
          <p className="chu-thich" style={{ margin: 0 }}>
            {t(`hint_${method}`)}
          </p>
          {method === "phone" && (
            <Field id="sdt-khach" label={t("customerPhone")} error={fields.phone}>
              <input id="sdt-khach" className={inputClass("phone")} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          )}
          {method === "buyer_qr" ? (
            amount && canTransact ? (
              <QrScanner key={`${amount}-${current?.id ?? ""}`} onCode={(code) => submit(code)} />
            ) : (
              <p className="chu-thich">{t("enterBillFirst")}</p>
            )
          ) : (
            <button
              type="button"
              className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
              disabled={submitting || !amount || !canTransact || (method === "phone" && !phone.trim())}
              onClick={() => submit()}
            >
              {t(method === "merchant_qr" ? "showQr" : "sendRequest")}
            </button>
          )}
          <FormError text={formError} />
        </section>
        <section className="the" aria-live="polite">
          {!current ? (
            <MessageView text={t("noCurrent")} />
          ) : (
            <>
              <h2 style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
                {current.documentNo} <span className={`nhan ${statusClass[current.status]}`}>{t(`status_${current.status}`)}</span>
              </h2>
              {current.status === "pending" && qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl(qr)} alt={t("qrAlt", { no: current.documentNo })} style={{ width: 240, height: 240, justifySelf: "center", imageRendering: "pixelated" }} />
              )}
              {current.status === "pending" && current.expiresAt && (
                <p style={{ textAlign: "center", margin: 0 }}>
                  <span className="nhan thong-tin">
                    {t("waiting")} · <Countdown until={current.expiresAt} />
                  </span>
                </p>
              )}
              {current.status === "completed" && <Result transaction={current} />}
              {current.status !== "pending" && (
                <button
                  type="button"
                  className="nut chinh"
                  onClick={() => {
                    setCurrent(null);
                    setBill("");
                    setPhone("");
                  }}
                >
                  {t("newTransaction")}
                </button>
              )}
            </>
          )}
        </section>
      </div>
      <h2>{t("todayTransactions")}</h2>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noTransactions")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {["documentNo", "time", "cashier", "customer", "billAmount", "redeemed", "earned", "status"].map((key) => (
                      <th key={key}>{t(`column_${key}`)}</th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("column_documentNo")}>{item.documentNo}</td>
                      <td data-nhan={t("column_time")}>{formatDateTime(item.createdAt)}</td>
                      <td data-nhan={t("column_cashier")}>{item.cashierName ?? <span className="nhan thong-tin">{affiliate("source_open_api")}</span>}</td>
                      <td data-nhan={t("column_customer")}>{item.buyerName ?? "—"}</td>
                      <td data-nhan={t("column_billAmount")}>{formatNumber(item.billAmount, 0)}</td>
                      <td data-nhan={t("column_redeemed")}>{item.status === "completed" || item.status === "cancelled" ? formatNumber(item.redeemedPoints, 0) : "—"}</td>
                      <td data-nhan={t("column_earned")}>{item.status === "completed" || item.status === "cancelled" ? formatNumber(item.earnedPoints, 0) : "—"}</td>
                      <td data-nhan={t("column_status")}>
                        <span className={`nhan ${statusClass[item.status]}`}>{t(`status_${item.status}`)}</span>
                      </td>
                      <td data-nhan="">
                        {item.canCancel && (
                          <button type="button" className="nut nguy-hiem" onClick={() => setCancelling(item)}>
                            {t("cancelTransaction")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {cancelling && (
        <CancelDrawer
          transaction={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            notify(t("cancelled"));
            void reload();
          }}
        />
      )}
    </>
  );
}
