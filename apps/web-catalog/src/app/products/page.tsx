"use client";

// MAN_HINH_23 Danh sách sản phẩm (CHUC_NANG_31; API_56): tìm không dấu theo tên, mã hàng, mã vạch; lọc ngành hàng, trạng thái.
import type { CategoryResponse, PageResponse, ProductListItem } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { selectedCompanyId } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function ProductsPage() {
  const t = useTranslations("products");
  const common = useTranslations("common");
  const locale = useLocale();
  const { can } = useAdmin();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const categories = useApi<CategoryResponse[]>("/catalog/categories");

  // Tìm sau khi ngừng gõ 300 ms.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) parameters.set("search", search);
  if (categoryId) parameters.set("categoryId", categoryId);
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<ProductListItem>>(`/catalog/products?${parameters}`);
  const leaves = categories.state.kind === "ready" ? categories.state.data.filter((category) => category.childCount === 0) : [];
  const headings = ["", t("code"), t("name"), t("category"), t("baseUnit"), t("variantCount"), t("status"), t("updatedAt")];
  const company = selectedCompanyId();

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="product" />
        {can("catalog.product.manage") && (
          <Link className="nut chinh" href="/products/new">
            {t("add")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-san-pham">
          {common("search")}
        </label>
        <input
          id="tim-san-pham"
          className="o-nhap"
          type="search"
          placeholder={t("searchHint")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          style={{ maxWidth: 360 }}
        />
        <label className="an-nhan" htmlFor="loc-nganh">
          {t("category")}
        </label>
        <select
          id="loc-nganh"
          className="o-nhap"
          style={{ width: "auto" }}
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("category")}: ${common("all")}`}</option>
          {leaves.map((category) => (
            <option key={category.id} value={category.id}>
              {category.code} · {locale === "en" ? category.nameEn : category.nameVi}
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
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search || categoryId || status ? common("noResult") : t("none")} />
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan="">
                        {item.imageId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/v1/catalog/product-images/${item.imageId}${company ? `?companyId=${company}` : ""}`}
                            alt=""
                            width={40}
                            height={40}
                            style={{ objectFit: "cover", borderRadius: "var(--bo-nho)" }}
                          />
                        ) : (
                          <span className="chu-thich">—</span>
                        )}
                      </td>
                      <td data-nhan={headings[1]}>
                        <Link href={`/products/${item.id}`}>{item.code}</Link>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.name}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.categoryName}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.baseUnitName}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{item.variantCount}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(item.status)}</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span>{formatDateTime(item.updatedAt)}</span>
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
    </>
  );
}
