"use client";

// MAN_HINH_12 Danh sách nhân viên, phần xem (API_24). Mời, nhập Excel có ở lát L4.
import type { PageResponse, UserListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "@/components/StatusViews";
import { UserStatusBadge } from "@/components/StatusBadge";
import { useApi } from "@/lib/use-api";

const statuses = ["active", "invited", "locked", "disabled"] as const;

export default function UsersPage() {
  const t = useTranslations("users");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  // Chờ người dùng ngừng gõ 300 ms rồi mới tìm.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (query) parameters.set("q", query);
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<UserListItem>>(`/users?${parameters}`);

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim">
          {common("search")}
        </label>
        <input id="tim" className="o-nhap" placeholder={`${common("search")}…`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("statusFilter")}
        </label>
        <select
          id="loc-trang-thai"
          className="o-nhap"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("statusFilter")}: ${common("all")}`}</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={query || status ? common("noResult") : common("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {[t("fullName"), t("contact"), t("branch"), t("roles"), t("status")].map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((user) => (
                    <tr key={user.id}>
                      <td data-nhan={t("fullName")}>
                        <Link href={`/platform/users/${user.id}`}>{user.fullName}</Link>
                      </td>
                      <td data-nhan={t("contact")}>
                        <span>{user.email ?? user.phone ?? common("none")}</span>
                      </td>
                      <td data-nhan={t("branch")}>
                        <span>{user.branchName ?? common("none")}</span>
                      </td>
                      <td data-nhan={t("roles")}>
                        <span>{user.roleNames.join(", ") || common("none")}</span>
                      </td>
                      <td data-nhan={t("status")}>
                        <span>
                          <UserStatusBadge status={user.status} />
                        </span>
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
