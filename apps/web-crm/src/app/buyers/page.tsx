"use client";

// MAN_HINH_79 Tài khoản người mua (CHUC_NANG_107; API_119): tìm theo tên, số điện thoại; lọc nhân viên kinh doanh; công ty vận hành sàn.
import type { BuyerAccountListItem, MarketplaceSettingsResponse, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { MarketplaceOperator } from "@/components/MarketplaceOperator";

export default function BuyersPage() {
  const t = useTranslations("buyers");
  const common = useTranslations("common");
  const settings = useApi<MarketplaceSettingsResponse>("/marketplace/settings");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [salesStaff, setSalesStaff] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const ready = settings.state.kind === "ready" && settings.state.data.operatorCompany !== null;
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) parameters.set("search", search);
  if (salesStaff) parameters.set("salesStaff", salesStaff);
  const { state, reload } = useApi<PageResponse<BuyerAccountListItem>>(ready ? `/marketplace/buyers?${parameters}` : null);
  const headings = [t("name"), t("phone"), t("type"), t("referrer"), t("referrals"), t("registeredAt")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={settings.state} onRetry={() => void settings.reload()}>
        {(loaded) => <MarketplaceOperator settings={loaded} onSaved={() => void settings.reload()} />}
      </Loaded>
      {ready && (
        <>
          <div className="bo-loc">
            <label className="an-nhan" htmlFor="nm-tim">
              {t("search")}
            </label>
            <input id="nm-tim" className="o-nhap" type="search" placeholder={t("search")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <label className="an-nhan" htmlFor="nm-loai">
              {t("salesFilter")}
            </label>
            <select
              id="nm-loai"
              className="o-nhap"
              style={{ width: "auto" }}
              value={salesStaff}
              onChange={(event) => {
                setSalesStaff(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{`${t("salesFilter")}: ${common("all")}`}</option>
              <option value="true">{t("salesOnly")}</option>
              <option value="false">{t("notSales")}</option>
            </select>
          </div>
          <Loaded state={state} onRetry={() => void reload()}>
            {(result) =>
              result.data.length === 0 ? (
                <MessageView text={search || salesStaff ? common("noResult") : t("none")} />
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
                          <td data-nhan={headings[0]}>
                            <Link href={`/buyers/${item.id}`}>{item.fullName}</Link>
                          </td>
                          <td data-nhan={headings[1]}>
                            <span>{item.phone}</span>
                          </td>
                          <td data-nhan={headings[2]}>
                            <span className={`nhan ${item.isSalesStaff ? "thanh-cong" : "trung-tinh"}`}>{item.isSalesStaff ? t("salesOnly") : t("notSales")}</span>
                          </td>
                          <td data-nhan={headings[3]}>
                            <span>{item.referrerName ? `${item.referrerName} · ${item.referrerPhone}` : "—"}</span>
                          </td>
                          <td data-nhan={headings[4]}>
                            <span>{item.referralCount}</span>
                          </td>
                          <td data-nhan={headings[5]}>
                            <span>{formatDateTime(item.registeredAt)}</span>
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
      )}
    </>
  );
}
