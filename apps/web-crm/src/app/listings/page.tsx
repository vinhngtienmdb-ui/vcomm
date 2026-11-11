"use client";

// MAN_HINH_87 Đăng bán (CHUC_NANG_113; API_123; QUYTAC_NGHIEPVU_155): sản phẩm của công ty vận hành sàn, bật tắt đăng bán, mô tả cho người mua, lý do chưa hiện trên ứng dụng.
// MAN_HINH_101 Thiết lập hoa hồng sản phẩm (CONG_VIEC_26; CHUC_NANG_134; API_134; QUYTAC_NGHIEPVU_200).
import type { CommissionCalculation, ListingItem, PageResponse, ProductCommission, StoreSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

// CONG_VIEC_49: thêm mức cộng tác viên (QUYTAC_NGHIEPVU_326).
const levels = ["referral", "collaborator", "staff", "teamHead", "regionalDirector", "director"] as const;
type Level = (typeof levels)[number];

function CommissionForm({ item, onDone }: { item: ListingItem; onDone: (saved: boolean) => void }) {
  const t = useTranslations("listings");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [calculation, setCalculation] = useState<CommissionCalculation>(item.commission?.calculation ?? "percent");
  const [values, setValues] = useState<Record<Level, string>>({
    referral: item.commission?.referral ?? "0",
    collaborator: item.commission?.collaborator ?? "0",
    staff: item.commission?.staff ?? "0",
    teamHead: item.commission?.teamHead ?? "0",
    regionalDirector: item.commission?.regionalDirector ?? "0",
    director: item.commission?.director ?? "0",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<ProductCommission>(`/marketplace/listings/${item.productId}/commission`, {
        method: "PUT",
        body: JSON.stringify({ calculation, ...values, version: item.commission?.version ?? 0 }),
      });
      notify(t("commissionSaved"));
      onDone(true);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("commissionTitle", { name: item.name })}</h2>
      <div className="chu-thich">{t("commissionHint")}</div>
      <FormError text={error} />
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: "var(--khoang-3)", flexWrap: "wrap" }}>
        <legend style={{ marginBottom: "var(--khoang-1)" }}>{t("calculation")}</legend>
        {(["percent", "fixed"] as const).map((value) => (
          <label key={value} style={{ display: "flex", gap: "var(--khoang-1)", alignItems: "center" }}>
            <input type="radio" name="hh-cach-tinh" checked={calculation === value} onChange={() => setCalculation(value)} />
            {t(`calculation_${value}`)}
          </label>
        ))}
      </fieldset>
      <div style={{ display: "grid", gap: "var(--khoang-2)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {levels.map((level) => (
          <span key={level} style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <label htmlFor={`hh-${level}`}>{`${t(`level_${level}`)}${calculation === "percent" ? " (%)" : ""}`}</label>
            <input id={`hh-${level}`} className="o-nhap" inputMode="decimal" value={values[level]} onChange={(event) => setValues((current) => ({ ...current, [level]: event.target.value }))} />
          </span>
        ))}
      </div>
      <span className="nhom-nut">
        <button type="button" className="nut chinh" disabled={busy} onClick={() => void save()}>
          {common("save")}
        </button>
        <button type="button" className="nut phu" onClick={() => onDone(false)}>
          {common("cancel")}
        </button>
      </span>
    </div>
  );
}

function commissionSummary(commission: ProductCommission, t: ReturnType<typeof useTranslations>) {
  const total = levels.reduce((sum, level) => sum + Number(commission[level]), 0);
  return commission.calculation === "percent"
    ? t("commissionSummary_percent", { total: formatNumber(String(total), 2), referral: formatNumber(commission.referral, 2) })
    : t("commissionSummary_fixed", { total: formatNumber(String(total), 0), referral: formatNumber(commission.referral, 0) });
}

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
  const [commissionFor, setCommissionFor] = useState<ListingItem | null>(null);
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
  const headings = [t("product"), t("price"), t("available"), t("state"), t("commission"), t("actions")];

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
      {commissionFor && (
        <CommissionForm
          key={commissionFor.productId}
          item={commissionFor}
          onDone={(saved) => {
            setCommissionFor(null);
            if (saved) void reload();
          }}
        />
      )}
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
                        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                          <span className={item.commission ? "" : "chu-thich"}>{item.commission ? commissionSummary(item.commission, t) : t("commissionNone")}</span>
                          {canManage && (
                            <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => setCommissionFor(item)}>
                              {t("commissionEdit")}
                            </button>
                          )}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
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
