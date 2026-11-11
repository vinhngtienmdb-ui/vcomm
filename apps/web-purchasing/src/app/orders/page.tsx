"use client";

// MAN_HINH_40 Đơn mua (CHUC_NANG_51; API_75): danh sách lọc trạng thái, nhà cung cấp; lập đơn; cài đặt dung sai nhận vượt.
import { purchaseDocumentStatuses, type PageResponse, type PurchaseOrderListItem, type PurchasingOptionsResponse, type PurchasingSettingsResponse } from "contracts";
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
import { PurchaseStatus } from "@/components/PurchaseStatus";

export default function OrdersPage() {
  const t = useTranslations("orders");
  const purchasing = useTranslations("purchasing");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const [status, setStatus] = useState("");
  const [supplierId, setSupplierId] = useState("");
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
  if (supplierId) parameters.set("supplierId", supplierId);
  if (search) parameters.set("search", search);
  const { state, reload } = useApi<PageResponse<PurchaseOrderListItem>>(`/purchasing/orders?${parameters}`);
  const suppliers = options.state.kind === "ready" ? options.state.data.suppliers : [];
  const headings = [t("documentNo"), t("supplier"), t("warehouse"), t("orderDate"), t("expectedDate"), t("total"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="purchase_order" />
        {can("purchasing.settings.manage") && (
          <button type="button" className="nut phu" onClick={() => setSettingsOpen(true)}>
            {t("settings")}
          </button>
        )}
        {can("purchasing.order.manage") && (
          <Link className="nut chinh" href="/orders/new">
            {t("add")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-don-mua">
          {common("search")}
        </label>
        <input id="tim-don-mua" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} style={{ maxWidth: 280 }} />
        <label className="an-nhan" htmlFor="loc-nha-cung-cap">
          {t("supplier")}
        </label>
        <select
          id="loc-nha-cung-cap"
          className="o-nhap"
          style={{ width: "auto" }}
          value={supplierId}
          onChange={(event) => {
            setSupplierId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("supplier")}: ${common("all")}`}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {purchaseDocumentStatuses.map((item) => (
            <option key={item} value={item}>
              {purchasing(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status || supplierId || search ? common("noResult") : t("none")} />
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
                        <span>{order.supplierName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{order.warehouseName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatDate(order.orderDate)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatDate(order.expectedDate)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatMoney(order.totalAmount, order.currency)}</span>
                        {order.isImport && <span className="nhan thong-tin">{t("importShort")}</span>}
                      </td>
                      <td data-nhan={headings[6]}>
                        <PurchaseStatus status={order.status} />
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

// Dung sai nhận vượt theo phần trăm, theo công ty (QUYTAC_NGHIEPVU_64).
function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orders");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state } = useApi<PurchasingSettingsResponse>("/purchasing/settings");
  const [percent, setPercent] = useState<string | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const current = state.kind === "ready" ? state.data : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    void run(async () => {
      await apiFetch("/purchasing/settings", { method: "PUT", body: JSON.stringify({ overReceiptTolerancePercent: percent ?? current.overReceiptTolerancePercent, version: current.version }) });
      notify(common("saved"));
      onClose();
    });
  }
  return (
    <Drawer title={t("settings")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="dung-sai" label={t("tolerance")} hint={t("toleranceHint")} error={fields.overReceiptTolerancePercent}>
          <input
            id="dung-sai"
            className={inputClass("overReceiptTolerancePercent")}
            inputMode="decimal"
            value={percent ?? current?.overReceiptTolerancePercent ?? ""}
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
