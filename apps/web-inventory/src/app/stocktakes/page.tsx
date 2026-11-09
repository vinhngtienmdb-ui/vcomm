"use client";

// MAN_HINH_34 Kiểm kê, danh sách và lập (CHUC_NANG_42; API_67): toàn kho hoặc theo ngành hàng, vị trí, danh sách sản phẩm.
import { stocktakeScopeTypes, type LocationResponse, type StockItemOption, type StocktakeListItem, type StocktakeOptionsResponse, type StocktakeResponse, type WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const tone = { draft: "trung-tinh", counting: "canh-bao", finished: "thanh-cong", cancelled: "trung-tinh" } as const;

export default function StocktakesPage() {
  const t = useTranslations("stocktakes");
  const { can } = useAdmin();
  const { state, reload } = useApi<StocktakeListItem[]>("/inventory/stocktakes");
  const [creating, setCreating] = useState(false);
  const headings = [t("stocktakeNo"), t("warehouse"), t("owner"), t("scope"), t("progress"), t("status"), t("createdAt")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="stocktake" />
        {can("inventory.stocktake.manage") && (
          <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
            {t("add")}
          </button>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
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
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/stocktakes/${item.id}`}>{item.stocktakeNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.warehouseName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.companyName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{t(`scope_${item.scopeType}`)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{t("countedOf", { counted: item.countedCount, total: item.lineCount })}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span className={`nhan ${tone[item.status]}`}>{t(`status_${item.status}`)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {creating && <CreateDrawer onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("stocktakes");
  const common = useTranslations("common");
  const router = useRouter();
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const operable = warehouses.state.kind === "ready" ? warehouses.state.data.filter((item) => item.canOperate && item.status === "active") : [];
  const [warehouseId, setWarehouseId] = useState("");
  const warehouse = operable.find((item) => item.id === warehouseId) ?? operable[0] ?? null;
  const [companyId, setCompanyId] = useState("");
  const [scopeType, setScopeType] = useState<(typeof stocktakeScopeTypes)[number]>("full");
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [scopeLabels, setScopeLabels] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const options = useApi<StocktakeOptionsResponse>(warehouse ? `/inventory/stocktake-options?warehouseId=${warehouse.id}` : null);
  const locations = useApi<LocationResponse[]>(warehouse?.usesLocations ? `/inventory/warehouses/${warehouse.id}/locations` : null);
  const owner = companyId || warehouse?.companyId || "";
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const toggle = (id: string, label: string, checked: boolean) => {
    setScopeIds(checked ? [...scopeIds, id] : scopeIds.filter((item) => item !== id));
    setScopeLabels({ ...scopeLabels, [id]: label });
  };

  async function findItem() {
    if (!search.trim()) return;
    const found = await apiFetch<StockItemOption[]>(`/inventory/items?${new URLSearchParams({ companyId: owner, search: search.trim() })}`).catch(() => []);
    if (found[0]) toggle(found[0].variantId, `${found[0].sku} · ${found[0].productName}`, true);
    setSearch("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await apiFetch<StocktakeResponse>("/inventory/stocktakes", {
        method: "POST",
        body: JSON.stringify({ warehouseId: warehouse?.id, companyId: owner, scopeType, scopeIds: scopeType === "full" ? [] : scopeIds, note: note || null }),
      });
      router.push(`/stocktakes/${created.id}`);
    });
  }

  const checkbox = (id: string, label: string) => (
    <label key={id} style={{ display: "inline-flex", gap: "var(--khoang-2)", alignItems: "center" }}>
      <input type="checkbox" checked={scopeIds.includes(id)} onChange={(event) => toggle(id, label, event.target.checked)} />
      {label}
    </label>
  );

  return (
    <Drawer title={t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="kho-kiem" label={`${t("warehouse")} *`} error={fields.warehouseId}>
          <select id="kho-kiem" className={inputClass("warehouseId")} value={warehouse?.id ?? ""} onChange={(event) => setWarehouseId(event.target.value)}>
            {operable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="chu-hang-kiem" label={`${t("owner")} *`} error={fields.companyId}>
          <select id="chu-hang-kiem" className={inputClass("companyId")} value={owner} onChange={(event) => setCompanyId(event.target.value)}>
            {warehouse?.owners.map((item) => (
              <option key={item.companyId} value={item.companyId}>
                {item.companyName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pham-vi" label={`${t("scope")} *`} error={fields.scopeType}>
          <select
            id="pham-vi"
            className={inputClass("scopeType")}
            value={scopeType}
            onChange={(event) => {
              setScopeType(event.target.value as typeof scopeType);
              setScopeIds([]);
            }}
          >
            {stocktakeScopeTypes
              .filter((item) => item !== "locations" || warehouse?.usesLocations)
              .map((item) => (
                <option key={item} value={item}>
                  {t(`scope_${item}`)}
                </option>
              ))}
          </select>
        </Field>
        {scopeType === "categories" && options.state.kind === "ready" && (
          <div style={{ display: "grid", gap: "var(--khoang-2)" }}>{options.state.data.categories.map((item) => checkbox(item.id, `${item.code} · ${item.name}`))}</div>
        )}
        {scopeType === "locations" && locations.state.kind === "ready" && (
          <div className="nhom-nut">{locations.state.data.filter((item) => item.status === "active").map((item) => checkbox(item.id, item.code))}</div>
        )}
        {scopeType === "variants" && (
          <Field id="tim-hang-kiem" label={t("addItem")} hint={t("addItemHint")}>
            <input
              id="tim-hang-kiem"
              className="o-nhap"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void findItem();
                }
              }}
            />
          </Field>
        )}
        {scopeType === "variants" && scopeIds.length > 0 && <div className="nhom-nut">{scopeIds.map((id) => checkbox(id, scopeLabels[id] ?? id))}</div>}
        {fields.scopeIds && <span className="loi-o">{fields.scopeIds}</span>}
        <Field id="ghi-chu-kiem" label={t("note")}>
          <input id="ghi-chu-kiem" className="o-nhap" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !warehouse}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
