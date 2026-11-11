"use client";

// MAN_HINH_117 Hợp đồng lao động (CHUC_NANG_163, 164; API_147): thẻ Tất cả (lọc loại, trạng thái), Sắp hết hạn; cột lương chỉ khi có quyền quản lý hợp đồng.
import type { ContractKind, ContractListResponse, ContractStatus } from "contracts";
import { contractKinds, contractStatuses } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ContractStatusBadges } from "@/components/ContractParts";

export default function ContractsPage() {
  const t = useTranslations("contracts");
  const { can } = useAdmin();
  const canManage = can("hr.contract.manage");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ContractKind | "">("");
  const [status, setStatus] = useState<ContractStatus | "">("");
  const [page, setPage] = useState(1);
  const [expiring, setExpiring] = useState(false);
  const expiringCount = useApi<ContractListResponse>("/hr/contracts?expiring=true&pageSize=1");
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search.trim()) parameters.set("search", search.trim());
  if (expiring) parameters.set("expiring", "true");
  else {
    if (kind) parameters.set("kind", kind);
    if (status) parameters.set("status", status);
  }
  const { state, reload } = useApi<ContractListResponse>(`/hr/contracts?${parameters}`);
  const headings = [t("documentNo"), t("employee"), t("kind"), t("effectiveDate"), t("endDate"), ...(canManage ? [t("salary")] : []), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="contract" />
        {canManage && (
          <Link className="nut chinh" href="/contracts/new">
            {t("create")}
          </Link>
        )}
      </div>
      <div className="cac-the" role="tablist">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="tab"
            aria-selected={expiring === value}
            className={expiring === value ? "chon" : ""}
            onClick={() => {
              setExpiring(value);
              setPage(1);
            }}
          >
            {value ? t("tab_expiring") : t("tab_all")}
            {value && expiringCount.state.kind === "ready" && expiringCount.state.data.total > 0 && <span className="huy-hieu">{expiringCount.state.data.total}</span>}
          </button>
        ))}
      </div>
      {expiring && <div className="khoi-canh-bao thong-tin">{t("expiringHint")}</div>}
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-hop-dong">
          {t("searchPlaceholder")}
        </label>
        <input
          id="tim-hop-dong"
          className="o-nhap"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        {!expiring && (
          <>
            <select
              className="o-nhap"
              aria-label={t("kind")}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as ContractKind | "");
                setPage(1);
              }}
            >
              <option value="">{t("allKinds")}</option>
              {contractKinds.map((value) => (
                <option key={value} value={value}>
                  {t(`kind_${value}`)}
                </option>
              ))}
            </select>
            <select
              className="o-nhap"
              aria-label={t("status")}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ContractStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("allStatuses")}</option>
              {contractStatuses.map((value) => (
                <option key={value} value={value}>
                  {t(`status_${value}`)}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={expiring ? t("expiringNone") : t("none")} />
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
                    <tr key={item.id}>
                      <td data-nhan={t("documentNo")}>
                        <Link href={`/contracts/${item.id}`}>{item.documentNo ?? t("status_draft")}</Link>
                      </td>
                      <td data-nhan={t("employee")}>
                        <Link href={`/employees/${item.employeeId}`}>
                          {item.employeeCode} · {item.employeeName}
                        </Link>
                      </td>
                      <td data-nhan={t("kind")}>
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={t("effectiveDate")}>
                        <span>{formatDate(item.effectiveDate)}</span>
                      </td>
                      <td data-nhan={t("endDate")}>
                        <span>{formatDate(item.terminationDate ?? item.endDate)}</span>
                      </td>
                      {canManage && (
                        <td data-nhan={t("salary")}>
                          <span>{item.salary ? formatNumber(item.salary, 0) : "—"}</span>
                        </td>
                      )}
                      <td data-nhan={t("status")}>
                        <ContractStatusBadges item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{t("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="‹">
                    ‹
                  </button>
                  <span>{page}</span>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)} aria-label="›">
                    ›
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
