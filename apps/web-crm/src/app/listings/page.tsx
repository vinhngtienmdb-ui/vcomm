"use client";

// MAN_HINH_87 Đăng bán (CHUC_NANG_113; API_123; QUYTAC_NGHIEPVU_155): sản phẩm của công ty vận hành sàn, bật tắt đăng bán, mô tả cho người mua, lý do chưa hiện trên ứng dụng.
import type { ListingItem, PageResponse, StoreSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function ListingsPage() {
  const t = useTranslations("listings");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [published, setPublished] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20", published });
  if (search) parameters.set("search", search);
  const settings = useApi<StoreSettingsResponse>("/marketplace/store-settings");
  const { state, reload } = useApi<PageResponse<ListingItem>>(`/marketplace/listings?${parameters}`);
  const canManage = settings.state.kind === "ready" && settings.state.data.canManage;
  const headings = [t("product"), t("price"), t("available"), t("state"), t("actions")];

  async function save(item: ListingItem, isPublished: boolean, text: string | null) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/listings/${item.productId}`, { method: "PUT", body: JSON.stringify({ isPublished, description: text }) });
      notify(t(isPublished === item.isPublished ? "descriptionSaved" : isPublished ? "publishedNotice" : "unpublishedNotice"));
      setEditing(null);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="db-tim">
          {common("search")}
        </label>
        <input id="db-tim" className="o-nhap" type="search" placeholder={t("search")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <label className="an-nhan" htmlFor="db-loc">
          {t("filter")}
        </label>
        <select
          id="db-loc"
          className="o-nhap"
          style={{ width: "auto" }}
          value={published}
          onChange={(event) => {
            setPublished(event.target.value);
            setPage(1);
          }}
        >
          {["all", "published", "unpublished"].map((value) => (
            <option key={value} value={value}>
              {t(`filter_${value}`)}
            </option>
          ))}
        </select>
      </div>
      <FormError text={error} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search || published !== "all" ? common("noResult") : t("none")} />
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
                  {result.data.map((item) => (
                    <tr key={item.productId}>
                      <td data-nhan={headings[0]}>
                        <span style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" width={40} height={40} style={{ objectFit: "cover" }} />
                          ) : null}
                          <span style={{ display: "grid" }}>
                            <strong>{item.name}</strong>
                            <span className="chu-thich">{item.categoryName}</span>
                          </span>
                        </span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.priceFrom ? t("priceFrom", { price: formatNumber(item.priceFrom, 0) }) : "—"}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatNumber(item.available)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                          <span className={`nhan ${item.isPublished ? (item.blockers.length === 0 ? "thanh-cong" : "canh-bao") : "trung-tinh"}`} style={{ justifySelf: "start" }}>
                            {t(item.isPublished ? (item.blockers.length === 0 ? "onApp" : "publishedHidden") : "notPublished")}
                          </span>
                          {item.blockers.map((blocker) => (
                            <span key={blocker} className="chu-thich">
                              {t(`blocker_${blocker}`)}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        {canManage ? (
                          editing === item.productId ? (
                            <span style={{ display: "grid", gap: "var(--khoang-2)" }}>
                              <label htmlFor={`mo-ta-${item.productId}`}>{t("description")}</label>
                              <textarea id={`mo-ta-${item.productId}`} className="o-nhap" rows={4} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} />
                              <span className="chu-thich">{t("descriptionHint")}</span>
                              <span className="nhom-nut">
                                <button type="button" className="nut chinh" disabled={busy} onClick={() => void save(item, item.isPublished, description.trim() || null)}>
                                  {common("save")}
                                </button>
                                <button type="button" className="nut phu" onClick={() => setEditing(null)}>
                                  {common("cancel")}
                                </button>
                              </span>
                            </span>
                          ) : (
                            <span className="nhom-nut">
                              <button type="button" className={`nut ${item.isPublished ? "phu" : "chinh"}`} disabled={busy} onClick={() => void save(item, !item.isPublished, item.description)}>
                                {t(item.isPublished ? "unpublish" : "publish")}
                              </button>
                              <button
                                type="button"
                                className="nut phu"
                                disabled={busy}
                                onClick={() => {
                                  setEditing(item.productId);
                                  setDescription(item.description ?? "");
                                }}
                              >
                                {t("editDescription")}
                              </button>
                            </span>
                          )
                        ) : (
                          <span className="chu-thich">—</span>
                        )}
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
