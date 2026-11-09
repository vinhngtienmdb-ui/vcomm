"use client";

// Phần Giá của MAN_HINH_24: giá hiện hành của các biến thể trong từng bảng giá đang dùng (API_61).
import type { PageResponse, PriceListResponse, PriceRow, ProductResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loaded } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export function ProductPrices({ product, canManage }: { product: ProductResponse; canManage: boolean }) {
  const t = useTranslations("priceLists");
  const { state, reload } = useApi<PriceListResponse[]>("/catalog/price-lists");
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("productPrices")}</h2>
        {canManage && (
          <Link className="nut phu" href="/price-changes/new">
            {t("changePrices")}
          </Link>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(lists) => {
          const active = lists.filter((list) => list.status === "active");
          return active.length === 0 ? <p className="chu-thich">{t("none")}</p> : active.map((list) => <ListPrices key={list.id} list={list} product={product} />);
        }}
      </Loaded>
    </section>
  );
}

function ListPrices({ list, product }: { list: PriceListResponse; product: ProductResponse }) {
  const t = useTranslations("priceLists");
  const { state, reload } = useApi<PageResponse<PriceRow>>(`/catalog/price-lists/${list.id}/prices?${new URLSearchParams({ search: product.code, pageSize: "100" })}`);
  const variantIds = new Set(product.variants.map((variant) => variant.id));
  return (
    <div>
      <h3>
        {list.code} · {list.name} <span className="chu-thich">({list.includesVat ? t("includesVat") : t("excludesVat")})</span>
      </h3>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) => {
          const rows = result.data.filter((row) => variantIds.has(row.variantId));
          const more = result.total > result.data.length && <p className="chu-thich">{t("productPricesMore", { count: result.data.length })}</p>;
          return rows.length === 0 ? (
            <p className="chu-thich">{t("noProductPrices")}</p>
          ) : (
            <div className="khung-bang">
              {more}
              <table>
                <thead>
                  <tr>
                    {[t("sku"), t("unit"), t("price"), t("effectiveFrom")].map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.variantId}:${row.unitId}`}>
                      <td data-nhan={t("sku")}>
                        <span>
                          {row.sku}
                          {row.optionValues.length > 0 && <span className="chu-thich"> · {row.optionValues.join(" / ")}</span>}
                        </span>
                      </td>
                      <td data-nhan={t("unit")}>
                        <span>{row.unitName}</span>
                      </td>
                      <td data-nhan={t("price")}>
                        <span>{formatMoney(row.price, list.currency)}</span>
                      </td>
                      <td data-nhan={t("effectiveFrom")}>
                        <span>{formatDate(row.effectiveFrom)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Loaded>
    </div>
  );
}
