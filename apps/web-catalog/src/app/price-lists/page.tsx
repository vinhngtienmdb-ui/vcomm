"use client";

// MAN_HINH_26 Bảng giá (CHUC_NANG_36; API_61): danh sách bảng giá, giá hiện hành tại một ngày, lịch sử giá một biến thể.
import type { CatalogItemResponse, CurrencyResponse, PageResponse, PriceHistoryItem, PriceListResponse, PriceRow } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function PriceListsPage() {
  const t = useTranslations("priceLists");
  const { can, notify } = useAdmin();
  const canManage = can("catalog.price.manage");
  const { state, reload } = useApi<PriceListResponse[]>("/catalog/price-lists");
  const [editing, setEditing] = useState<PriceListResponse | "new" | null>(null);
  const [selected, setSelected] = useState<PriceListResponse | null>(null);

  async function toggle(list: PriceListResponse) {
    try {
      await apiFetch(`/catalog/price-lists/${list.id}/${list.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: list.version }) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  const headings = [t("code"), t("name"), t("channel"), t("customerGroup"), t("currency"), t("vat"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="price_list" />
        {canManage && (
          <>
            <Link className="nut phu" href="/price-changes/new">
              {t("changePrices")}
            </Link>
            <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
              {t("add")}
            </button>
          </>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(lists) =>
          lists.length === 0 ? (
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
                  {lists.map((list) => (
                    <tr key={list.id} aria-selected={selected?.id === list.id}>
                      <td data-nhan={headings[0]}>
                        <button type="button" className="nut chu" onClick={() => setSelected(list)}>
                          {list.code}
                        </button>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{list.name}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{list.channelName ?? t("anyChannel")}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{list.customerGroupName ?? t("anyGroup")}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{list.currency}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{list.includesVat ? t("includesVat") : t("excludesVat")}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className={`nhan ${list.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(list.status)}</span>
                      </td>
                      <td data-nhan="">
                        <span className="nhom-nut">
                          <button type="button" className="nut chu" onClick={() => setSelected(list)}>
                            {t("viewPrices")}
                          </button>
                          {canManage && (
                            <>
                              <button type="button" className="nut chu" onClick={() => setEditing(list)}>
                                {t("edit")}
                              </button>
                              <button type="button" className="nut chu" onClick={() => void toggle(list)}>
                                {list.status === "active" ? t("deactivate") : t("activate")}
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {selected && <Prices key={selected.id} list={selected} />}
      {editing && (
        <PriceListDrawer
          list={editing === "new" ? null : editing}
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

// Giá hiện hành của bảng giá tại một ngày (mặc định hôm nay).
function Prices({ list }: { list: PriceListResponse }) {
  const t = useTranslations("priceLists");
  const common = useTranslations("common");
  const [date, setDate] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<PriceRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({ page: String(page) });
  if (date) parameters.set("date", date);
  if (search) parameters.set("search", search);
  const { state, reload } = useApi<PageResponse<PriceRow>>(`/catalog/price-lists/${list.id}/prices?${parameters}`);
  const headings = [t("sku"), t("product"), t("unit"), t("price"), t("effectiveFrom"), ""];
  return (
    <section className="the" style={{ marginTop: "var(--khoang-4)" }}>
      <h2>{t("pricesOf", { name: list.name })}</h2>
      <div className="bo-loc">
        <label htmlFor="ngay-gia">{t("atDate")}</label>
        <input id="ngay-gia" type="date" className="o-nhap" style={{ width: "auto" }} value={date} onChange={(event) => setDate(event.target.value)} />
        <label className="an-nhan" htmlFor="tim-gia">
          {common("search")}
        </label>
        <input id="tim-gia" type="search" className="o-nhap" style={{ maxWidth: 320 }} placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search ? common("noResult") : t("noPrices")} />
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
                  {result.data.map((row) => (
                    <tr key={`${row.variantId}:${row.unitId}`}>
                      <td data-nhan={headings[0]}>
                        <span>{row.sku}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {row.productName}
                          {row.optionValues.length > 0 && <span className="chu-thich"> · {row.optionValues.join(" / ")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{row.unitName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatMoney(row.price, list.currency)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatDate(row.effectiveFrom)}</span>
                      </td>
                      <td data-nhan="">
                        <button type="button" className="nut chu" onClick={() => setHistory(row)}>
                          {t("history")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      {history && <HistoryDrawer list={list} row={history} onClose={() => setHistory(null)} />}
    </section>
  );
}

function HistoryDrawer({ list, row, onClose }: { list: PriceListResponse; row: PriceRow; onClose: () => void }) {
  const t = useTranslations("priceLists");
  const { state, reload } = useApi<PriceHistoryItem[]>(`/catalog/price-lists/${list.id}/history?variantId=${row.variantId}&unitId=${row.unitId}`);
  const headings = [t("price"), t("effectiveFrom"), t("changeNo")];
  return (
    <Drawer title={`${t("history")}: ${row.sku} · ${row.unitName}`} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) => (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  {headings.map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td data-nhan={headings[0]}>
                      <span>{formatMoney(item.price, list.currency)}</span>
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>{formatDate(item.effectiveFrom)}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <Link href={`/price-changes/${item.priceChangeId}`} title={formatDateTime(item.createdAt)}>
                        {item.changeNo ?? "—"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}

// Kênh, nhóm khách, tiền tệ chỉ chọn khi tạo; muốn đổi thì tạo bảng giá mới.
function PriceListDrawer({ list, onClose, onSaved }: { list: PriceListResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("priceLists");
  const common = useTranslations("common");
  const channels = useApi<CatalogItemResponse[]>(list ? null : "/catalog/sales-channels");
  const groups = useApi<CatalogItemResponse[]>(list ? null : "/catalog/customer-groups");
  const currencies = useApi<CurrencyResponse[]>(list ? null : "/currencies");
  const [code, setCode] = useState(list?.code ?? "");
  const [name, setName] = useState(list?.name ?? "");
  const [channelId, setChannelId] = useState(list?.channelId ?? "");
  const [customerGroupId, setCustomerGroupId] = useState(list?.customerGroupId ?? "");
  const [currency, setCurrency] = useState(list?.currency ?? "VND");
  const [includesVat, setIncludesVat] = useState(list?.includesVat ?? true);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const active = (state: typeof channels.state) => (state.kind === "ready" ? state.data.filter((item) => item.status === "active") : []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (list) await apiFetch(`/catalog/price-lists/${list.id}`, { method: "PATCH", body: JSON.stringify({ name, includesVat, version: list.version }) });
      else
        await apiFetch("/catalog/price-lists", {
          method: "POST",
          body: JSON.stringify({ code, name, channelId: channelId || null, customerGroupId: customerGroupId || null, currency, includesVat }),
        });
      onSaved();
    });
  }

  return (
    <Drawer title={list ? `${t("edit")}: ${list.code}` : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="ma-bang-gia" label={`${t("code")} *`} error={fields.code}>
          <input id="ma-bang-gia" className={inputClass("code")} value={code} maxLength={20} disabled={Boolean(list)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="ten-bang-gia" label={`${t("name")} *`} error={fields.name}>
          <input id="ten-bang-gia" className={inputClass("name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="kenh-ban" label={t("channel")} hint={t("channelHint")} error={fields.channelId}>
          <select id="kenh-ban" className={inputClass("channelId")} value={channelId} disabled={Boolean(list)} onChange={(event) => setChannelId(event.target.value)}>
            <option value="">{t("anyChannel")}</option>
            {list?.channelId && <option value={list.channelId}>{list.channelName}</option>}
            {active(channels.state).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nhom-khach" label={t("customerGroup")} error={fields.customerGroupId}>
          <select id="nhom-khach" className={inputClass("customerGroupId")} value={customerGroupId} disabled={Boolean(list)} onChange={(event) => setCustomerGroupId(event.target.value)}>
            <option value="">{t("anyGroup")}</option>
            {list?.customerGroupId && <option value={list.customerGroupId}>{list.customerGroupName}</option>}
            {active(groups.state).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="tien-te" label={t("currency")} error={fields.currency}>
          <select id="tien-te" className={inputClass("currency")} value={currency} disabled={Boolean(list)} onChange={(event) => setCurrency(event.target.value)}>
            {currencies.state.kind === "ready" ? (
              currencies.state.data.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} · {item.nameVi}
                </option>
              ))
            ) : (
              <option value={currency}>{currency}</option>
            )}
          </select>
        </Field>
        <label style={{ display: "inline-flex", gap: "var(--khoang-2)", alignItems: "center" }}>
          <input type="checkbox" checked={includesVat} onChange={(event) => setIncludesVat(event.target.checked)} /> {t("includesVatLabel")}
        </label>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
