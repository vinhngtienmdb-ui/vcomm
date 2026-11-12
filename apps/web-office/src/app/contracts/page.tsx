"use client";

// MAN_HINH_215 Kho hợp đồng (CHUC_NANG_212; API_246, API_247; QUYTAC_NGHIEPVU_466): ô tóm tắt, tìm, lọc, hợp đồng lao động chỉ đọc.
import type { OfficeContractListResponse, OfficeContractOptions, OfficeContractStatus, OfficeContractValidity } from "contracts";
import { officeContractStatuses, officeContractValidityLabels } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ContractStatusBadge, ValidityBadge } from "@/components/ContractParts";

export default function ContractsPage() {
  const options = useApi<OfficeContractOptions>("/office/contract-options");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(data) => <ContractList options={data} />}
    </Loaded>
  );
}

function ContractList({ options }: { options: OfficeContractOptions }) {
  const t = useTranslations("officeContracts");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState<OfficeContractStatus | "">("");
  const [validity, setValidity] = useState<OfficeContractValidity | "">("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    page: String(page),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(typeId ? { typeId } : {}),
    ...(status ? { status } : {}),
    ...(validity ? { validity } : {}),
    ...(mine ? { mine: "true" } : {}),
  });
  const { state, reload } = useApi<OfficeContractListResponse>(`/office/contracts?${query.toString()}`);
  const headings = [t("code"), t("contractNo"), t("name"), t("partners"), t("value"), t("expiresOn"), t("statusLabel")];
  const laborHeadings = [t("contractNo"), t("employee"), t("type"), t("expiresOn"), t("statusLabel")];
  const reset = () => setPage(1);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <div className="nhom-nut">
          {options.canManage && (
            <Link className="nut phu" href="/signing-settings?tab=types">
              {t("manageTypes")}
            </Link>
          )}
          {options.canCreate && (
            <>
              <Link className="nut phu" href="/contracts/import">
                {t("import")}
              </Link>
              <Link className="nut chinh" href="/contracts/new">
                {t("create")}
              </Link>
            </>
          )}
        </div>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) => (
          <>
            <div className="luoi-so">
              {(
                [
                  ["active", result.summary.active, "active"],
                  ["expiring", result.summary.expiring, "expiring"],
                  ["expiredOpen", result.summary.expiredOpen, "expired"],
                  ["inProgress", result.summary.inProgress, null],
                ] as const
              ).map(([key, count, filter]) => (
                <button
                  key={key}
                  type="button"
                  className="o-so"
                  style={{ textAlign: "left", cursor: filter ? "pointer" : "default" }}
                  onClick={() => filter && (setValidity(filter), setStatus(""), reset())}
                >
                  <span className="nhan-so">{t(`summary_${key}`)}</span>
                  <span className="gia-tri">{count}</span>
                </button>
              ))}
            </div>
            <div className="bo-loc">
              <label className="an-nhan" htmlFor="tim-hop-dong">
                {common("search")}
              </label>
              <input id="tim-hop-dong" className="o-nhap" placeholder={t("searchHint")} value={search} onChange={(event) => (setSearch(event.target.value), reset())} />
              <select className="o-nhap" aria-label={t("type")} value={typeId} onChange={(event) => (setTypeId(event.target.value), reset())}>
                <option value="">{t("typeAll")}</option>
                {options.types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <select className="o-nhap" aria-label={t("statusLabel")} value={status} onChange={(event) => (setStatus(event.target.value as OfficeContractStatus | ""), reset())}>
                <option value="">{t("statusAll")}</option>
                {officeContractStatuses.map((item) => (
                  <option key={item} value={item}>
                    {t(`status_${item}`)}
                  </option>
                ))}
              </select>
              <select className="o-nhap" aria-label={t("validityLabel")} value={validity} onChange={(event) => (setValidity(event.target.value as OfficeContractValidity | ""), reset())}>
                <option value="">{t("validityAll")}</option>
                {officeContractValidityLabels.map((item) => (
                  <option key={item} value={item}>
                    {t(`validity_${item}`)}
                  </option>
                ))}
              </select>
              <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
                <input type="checkbox" checked={mine} onChange={(event) => (setMine(event.target.checked), reset())} />
                {t("mine")}
              </label>
            </div>
            {!options.canViewAll && <div className="khoi-canh-bao thong-tin">{t("relatedOnly")}</div>}
            {result.items.length === 0 ? (
              <MessageView text={t("empty")} />
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
                    {result.items.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={headings[0]}>
                          <span>
                            <Link href={`/contracts/${item.id}`}>{item.contractCode}</Link> {item.confidential && <span className="nhan loi">{t("confidentialBadge")}</span>}
                          </span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{item.contractNo ?? "—"}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>
                            <Link href={`/contracts/${item.id}`} style={{ whiteSpace: "normal" }}>
                              {item.name}
                            </Link>
                            <span className="chu-thich" style={{ display: "block" }}>
                              {item.typeName}
                            </span>
                          </span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{item.partners.join(", ")}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>{item.value ? formatMoney(item.value, item.currency) : "—"}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span>{formatDate(item.expiresOn)}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <span>
                            <ContractStatusBadge status={item.status} /> <ValidityBadge validity={item.validity} />
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
                      {common("previous")}
                    </button>
                    <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                      {common("next")}
                    </button>
                  </span>
                </div>
              </div>
            )}
            {result.laborContracts && result.laborContracts.length > 0 && (
              <>
                <h2>{t("laborTitle")}</h2>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {laborHeadings.map((heading) => (
                          <th key={heading} scope="col">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.laborContracts.map((item) => (
                        <tr key={item.id}>
                          <td data-nhan={laborHeadings[0]}>
                            <a href={`/hr/contracts/${item.id}`}>{item.documentNo}</a>
                          </td>
                          <td data-nhan={laborHeadings[1]}>
                            <span>{item.employeeName}</span>
                          </td>
                          <td data-nhan={laborHeadings[2]}>
                            <span>{t(`laborKind_${item.kind}`)}</span>
                          </td>
                          <td data-nhan={laborHeadings[3]}>
                            <span>{formatDate(item.endDate)}</span>
                          </td>
                          <td data-nhan={laborHeadings[4]}>
                            <span>
                              <span className="nhan trung-tinh">{t("laborBadge")}</span> <ValidityBadge validity={item.validity} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </Loaded>
    </>
  );
}
