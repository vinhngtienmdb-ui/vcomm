"use client";

// Thẻ Hợp đồng của MAN_HINH_116 và phần hợp đồng của MAN_HINH_119 (CHUC_NANG_163; API_147, API_149).
import type { ContractListResponse, ContractResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { ContractStatusBadges, money } from "./ContractParts";

export function EmployeeContractsTab({ employeeId, canCreate }: { employeeId: string; canCreate: boolean }) {
  const t = useTranslations("contracts");
  const { state, reload } = useApi<ContractListResponse>(`/hr/contracts?employeeId=${employeeId}&pageSize=100`);
  const headings = [t("documentNo"), t("kind"), t("effectiveDate"), t("endDate"), t("salary"), t("status")];
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("title")}</h2>
        {canCreate && (
          <Link className="nut chinh" href={`/contracts/new?employeeId=${employeeId}`}>
            {t("create")}
          </Link>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/contracts/${item.id}`}>{item.documentNo ?? t("status_draft")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatDate(item.effectiveDate)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatDate(item.terminationDate ?? item.endDate)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.salary === null ? <span className="chu-thich">{t("noSalaryPermission")}</span> : formatNumber(item.salary, 0)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <ContractStatusBadges item={item} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

export function MyContracts({ contracts, currency }: { contracts: ContractResponse[]; currency: string }) {
  const t = useTranslations("contracts");
  const { notify } = useAdmin();
  const download = (path: string, name: string) => void apiDownload(path, name).catch((error: unknown) => notify(failureOf(error).message, "loi"));
  const headings = [t("documentNo"), t("kind"), t("effectiveDate"), t("endDate"), t("salary"), t("signedFileLabel")];
  if (contracts.length === 0) return <MessageView text={t("none")} />;
  const rows = contracts.flatMap((contract) => [
    {
      key: contract.id,
      documentNo: contract.documentNo ?? "",
      kind: t(`kind_${contract.kind}`),
      from: contract.effectiveDate,
      to: contract.terminationDate ?? contract.endDate,
      salary: contract.original.salary,
      file: `/hr/me/contracts/${contract.id}/signed-file`,
    },
    ...contract.appendices.map((appendix) => ({
      key: appendix.id,
      documentNo: `↳ ${appendix.documentNo ?? ""}`,
      kind: t("appendices"),
      from: appendix.effectiveDate,
      to: null,
      salary: appendix.salary,
      file: `/hr/me/contracts/${contract.id}/signed-file?appendixId=${appendix.id}`,
    })),
  ]);
  return (
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
          {rows.map((row) => (
            <tr key={row.key}>
              <td data-nhan={headings[0]}>
                <span>{row.documentNo}</span>
              </td>
              <td data-nhan={headings[1]}>
                <span>{row.kind}</span>
              </td>
              <td data-nhan={headings[2]}>
                <span>{formatDate(row.from)}</span>
              </td>
              <td data-nhan={headings[3]}>
                <span>{formatDate(row.to)}</span>
              </td>
              <td data-nhan={headings[4]}>
                <span>{money(row.salary, currency) ?? "—"}</span>
              </td>
              <td data-nhan={headings[5]}>
                <button type="button" className="nut phu" onClick={() => download(row.file, `${row.documentNo.replace("↳ ", "")}.pdf`)}>
                  {t("download")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
