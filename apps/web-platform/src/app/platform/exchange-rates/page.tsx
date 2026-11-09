"use client";

// MAN_HINH_17 Tiền tệ và tỷ giá (CHUC_NANG_21; API_45, API_46). Mọi nhân viên xem; quản lý tỷ giá, quản trị tập đoàn nhập và sửa.
import { exchangeRateSources, exchangeRateTypes, type CurrencyResponse, type ExchangeRateListResponse, type ExchangeRateResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Drawer } from "@/components/Dialogs";
import { Field, FormError, useSubmit } from "@/components/Form";
import { HistoryLink } from "@/components/HistoryLink";
import { Loaded, MessageView } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";

const todayInVietnam = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const formatRate = (rate: string, locale: string) =>
  new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", {
    maximumFractionDigits: 8,
  }).format(Number(rate));
// Tiếng Việt: dấu chấm phân cách hàng nghìn, dấu phẩy thập phân; tiếng Anh ngược lại.
const toApiRate = (text: string, locale: string) => (locale === "en" ? text.replace(/[,\s]/g, "") : text.replace(/[.\s]/g, "").replace(",", "."));

export default function ExchangeRatesPage() {
  const t = useTranslations("rates");
  const locale = useLocale();
  const { notify } = useAdmin();
  const [date, setDate] = useState(todayInVietnam());
  const { state, reload } = useApi<ExchangeRateListResponse>(`/exchange-rates?date=${date}`);
  const [panel, setPanel] = useState<{ kind: "add" } | { kind: "edit"; rate: ExchangeRateResponse } | null>(null);
  const headings = [t("pair"), t("type"), t("source"), t("rate"), ""];

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(result) => (
        <>
          <div className="tieu-de">
            <h1>{t("title")}</h1>
            <HistoryLink entityType="exchange_rate" />
            {result.canManage && (
              <button type="button" className="nut chinh" onClick={() => setPanel({ kind: "add" })}>
                {t("add")}
              </button>
            )}
          </div>
          <div className="bo-loc">
            <label htmlFor="ngay">{t("date")}</label>
            <input id="ngay" className="o-nhap" type="date" value={date} style={{ width: "auto" }} onChange={(event) => event.target.value && setDate(event.target.value)} />
          </div>
          {result.missingAccounting.length > 0 && (
            <div className="khoi-canh-bao canh-bao" role="status">
              {t("missing", {
                date: formatDate(result.date),
                currencies: result.missingAccounting.join(", "),
                base: result.baseCurrency,
              })}
            </div>
          )}
          {result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((rate) => (
                    <tr key={rate.id}>
                      <td data-nhan={headings[0]}>
                        <span>
                          {rate.fromCurrency} → {rate.toCurrency}
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{t(`type_${rate.rateType}`)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{(exchangeRateSources as readonly string[]).includes(rate.source) ? t(`source_${rate.source as (typeof exchangeRateSources)[number]}`) : rate.source}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatRate(rate.rate, locale)}</span>
                      </td>
                      <td>
                        {result.canManage && (
                          <button type="button" className="nut phu" onClick={() => setPanel({ kind: "edit", rate })}>
                            {t("edit")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {panel && (
            <RateDrawer
              date={date}
              editing={panel.kind === "edit" ? panel.rate : null}
              onClose={() => setPanel(null)}
              onSaved={() => {
                setPanel(null);
                notify(t("saved"));
                void reload();
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}

function RateDrawer({ date, editing, onClose, onSaved }: { date: string; editing: ExchangeRateResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("rates");
  const common = useTranslations("common");
  const locale = useLocale();
  const currencies = useApi<CurrencyResponse[]>("/currencies");
  const list = currencies.state.kind === "ready" ? currencies.state.data : [];
  const [rateDate, setRateDate] = useState(date);
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("VND");
  const [rateType, setRateType] = useState<string>("accounting");
  const [source, setSource] = useState<string>("manual");
  const [rate, setRate] = useState(editing ? formatRate(editing.rate, locale) : "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (editing)
        await apiFetch(`/exchange-rates/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ rate: toApiRate(rate, locale) }),
        });
      else
        await apiFetch("/exchange-rates", {
          method: "POST",
          body: JSON.stringify({
            rateDate,
            fromCurrency,
            toCurrency,
            rateType,
            source,
            rate: toApiRate(rate, locale),
          }),
        });
      onSaved();
    });
  }

  const currencySelect = (id: string, value: string, onChange: (code: string) => void, field: string) => (
    <select id={id} className={inputClass(field)} value={value} onChange={(event) => onChange(event.target.value)}>
      {list.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.code} – {locale === "en" ? currency.nameEn : currency.nameVi}
        </option>
      ))}
    </select>
  );

  return (
    <Drawer
      title={
        editing
          ? t("editTitle", {
              pair: `${editing.fromCurrency} → ${editing.toCurrency}`,
            })
          : t("add")
      }
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {!editing && (
          <>
            <Field id="ngay-ty-gia" label={t("date")} error={fields.rateDate}>
              <input id="ngay-ty-gia" type="date" className={inputClass("rateDate")} value={rateDate} onChange={(event) => setRateDate(event.target.value)} />
            </Field>
            <Field id="tien-nguon" label={t("fromCurrency")} error={fields.fromCurrency}>
              {currencySelect("tien-nguon", fromCurrency, setFromCurrency, "fromCurrency")}
            </Field>
            <Field id="tien-dich" label={t("toCurrency")} error={fields.toCurrency}>
              {currencySelect("tien-dich", toCurrency, setToCurrency, "toCurrency")}
            </Field>
            <Field id="loai-ty-gia" label={t("type")} error={fields.rateType}>
              <select id="loai-ty-gia" className={inputClass("rateType")} value={rateType} onChange={(event) => setRateType(event.target.value)}>
                {exchangeRateTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`type_${type}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="nguon-ty-gia" label={t("source")} error={fields.source}>
              <select id="nguon-ty-gia" className={inputClass("source")} value={source} onChange={(event) => setSource(event.target.value)}>
                {exchangeRateSources.map((item) => (
                  <option key={item} value={item}>
                    {t(`source_${item}`)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field id="gia-tri" label={t("rate")} error={fields.rate}>
          <input id="gia-tri" className={inputClass("rate")} inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !rate.trim()}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
