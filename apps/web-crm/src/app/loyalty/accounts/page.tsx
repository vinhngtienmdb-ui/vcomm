"use client";

// MAN_HINH_147 Ví điểm – danh sách (CONG_VIEC_51; CHUC_NANG_181; API_179): tìm số điện thoại, tên; lọc hạng, đang khóa.
import type { LoyaltyAccountListItem, LoyaltyProgramResponse, PageResponse } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function LoyaltyAccountsPage() {
  const t = useTranslations("loyalty");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [tierId, setTierId] = useState("");
  const [locked, setLocked] = useState("");
  const [page, setPage] = useState(1);
  const program = useApi<LoyaltyProgramResponse>("/loyalty/program");
  const params = new URLSearchParams({ page: String(page), pageSize: "20", ...(applied ? { search: applied } : {}), ...(tierId ? { tierId } : {}), ...(locked ? { locked } : {}) });
  const { state, reload } = useApi<PageResponse<LoyaltyAccountListItem>>(`/loyalty/accounts?${params}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("accountsTitle")}</h1>
      </div>
      <form
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)", alignItems: "end" }}
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(search.trim());
          setPage(1);
        }}
      >
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="tim-vi">{t("searchBuyer")}</label>
          <input id="tim-vi" className="o-nhap" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="loc-hang">{t("filterTier")}</label>
          <select id="loc-hang" className="o-nhap" value={tierId} onChange={(event) => (setTierId(event.target.value), setPage(1))}>
            <option value="">{t("allTiers")}</option>
            {program.state.kind === "ready"
              ? program.state.data.tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.nameVi}
                  </option>
                ))
              : null}
          </select>
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="loc-khoa">{t("filterLocked")}</label>
          <select id="loc-khoa" className="o-nhap" value={locked} onChange={(event) => (setLocked(event.target.value), setPage(1))}>
            <option value="">{t("allAccounts")}</option>
            <option value="true">{t("lockedOnly")}</option>
          </select>
        </span>
        <button type="submit" className="nut phu">
          {t("search")}
        </button>
      </form>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noAccounts")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["buyer", "phone", "tier", "balance", "expiring", "spend", "state"].map((key) => (
                        <th key={key}>{t(`account_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.userId}>
                        <td data-nhan={t("account_buyer")}>
                          <Link href={`/loyalty/accounts/${item.userId}`}>{item.fullName}</Link>
                        </td>
                        <td data-nhan={t("account_phone")}>{item.phone}</td>
                        <td data-nhan={t("account_tier")}>{item.tierName ?? "—"}</td>
                        <td data-nhan={t("account_balance")}>{formatNumber(item.balance, 0)}</td>
                        <td data-nhan={t("account_expiring")}>{formatNumber(item.expiringPoints, 0)}</td>
                        <td data-nhan={t("account_spend")}>{formatNumber(item.spendCurrentYear, 0)}</td>
                        <td data-nhan={t("account_state")}>
                          <span className={`nhan ${item.locked ? "loi" : "thanh-cong"}`}>{t(item.locked ? "stateLocked" : "stateActive")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )
        }
      </Loaded>
    </>
  );
}
