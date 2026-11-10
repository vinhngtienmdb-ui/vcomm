"use client";

// MAN_HINH_42 Đơn bán (CHUC_NANG_54, 55; API_77, API_78): danh sách lọc trạng thái, khách; lập đơn; cài đặt chiết khấu tay tối đa.
import { salesOrderStatuses, type PageResponse, type SalesOptionsResponse, type SalesOrderListItem, type SalesSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { SalesStatus } from "@/components/SalesStatus";

export default function SalesOrdersPage() {
  const t = useTranslations("salesOrders");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const options = useApi<SalesOptionsResponse>("/sales/options");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  if (customerId) parameters.set("customerId", customerId);
  if (search) parameters.set("search", search);
  const { state, reload } = useApi<PageResponse<SalesOrderListItem>>(`/sales/orders?${parameters}`);
  const customers = options.state.kind === "ready" ? options.state.data.customers : [];
  const headings = [t("documentNo"), t("customer"), t("channel"), t("warehouse"), t("orderDate"), t("total"), t("status")];
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="sales_order" />
        {can("sales.settings.manage") && (
          <button type="button" className="nut phu" onClick={() => setSettingsOpen(true)}>
            {t("settings")}
          </button>
        )}
        {can("sales.order.manage") && (
          <Link className="nut chinh" href="/orders/new">
            {t("add")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-don-ban">
          {common("search")}
        </label>
        <input id="tim-don-ban" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} style={{ maxWidth: 280 }} />
        <label className="an-nhan" htmlFor="loc-khach">
          {t("customer")}
        </label>
        <select id="loc-khach" className="o-nhap" style={{ width: "auto" }} value={customerId} onChange={(event) => filter(setCustomerId)(event.target.value)}>
          <option value="">{`${t("customer")}: ${common("all")}`}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("status")}
        </label>
        <select id="loc-trang-thai" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => filter(setStatus)(event.target.value)}>
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {salesOrderStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status || customerId || search ? common("noResult") : t("none")} />
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
                  {result.data.map((order) => (
                    <tr key={order.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/orders/${order.id}`}>{order.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{order.customerName ?? order.buyerName ?? t("walkIn")}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{order.channelName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{order.warehouseName}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatDate(order.orderDate)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatMoney(order.totalAmount, order.currency)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <SalesStatus status={order.status} />
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
      {settingsOpen && <SettingsDrawer onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

// Chiết khấu tay tối đa không cần duyệt, theo công ty (QUYTAC_NGHIEPVU_68).
function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("salesOrders");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state } = useApi<SalesSettingsResponse>("/sales/settings");
  const [percent, setPercent] = useState<string | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const current = state.kind === "ready" ? state.data : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    void run(async () => {
      await apiFetch("/sales/settings", { method: "PUT", body: JSON.stringify({ maxManualDiscountPercent: percent ?? current.maxManualDiscountPercent, version: current.version }) });
      notify(common("saved"));
      onClose();
    });
  }
  return (
    <Drawer title={t("settings")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="chiet-khau-toi-da" label={t("maxDiscount")} hint={t("maxDiscountHint")} error={fields.maxManualDiscountPercent}>
          <input
            id="chiet-khau-toi-da"
            className={inputClass("maxManualDiscountPercent")}
            inputMode="decimal"
            value={percent ?? current?.maxManualDiscountPercent ?? ""}
            onChange={(event) => setPercent(event.target.value)}
          />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting || !current}>
            {common("save")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
