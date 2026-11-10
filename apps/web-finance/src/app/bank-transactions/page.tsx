"use client";

// MAN_HINH_58 Giao dịch ngân hàng (CHUC_NANG_85 đến 87; QUYTAC_NGHIEPVU_115 đến 117; API_99 đến API_101): lọc, phiếu đã ghép, gợi ý khách, xử lý giao dịch chưa ghép, ô đối chiếu khi chọn quỹ.
import { bankTransactionStatuses, type BankConnectionsResponse, type BankTransactionsResponse, type BankTransactionStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { BankReconciliationPanel } from "@/components/BankReconciliationPanel";
import { BankTransactionActions } from "@/components/BankTransactionActions";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const tone: Record<BankTransactionStatus, string> = { unmatched: "canh-bao", matched: "thanh-cong", ignored: "trung-tinh" };

export default function BankTransactionsPage() {
  const t = useTranslations("bankTransactions");
  const common = useTranslations("common");
  const payments = useTranslations("payments");
  const connections = useApi<BankConnectionsResponse>("/finance/bank-connections");
  const [filter, setFilter] = useState({ fundId: "", status: "unmatched", direction: "", from: "", to: "", search: "" });
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(filter).filter(([, value]) => value)) });
  const { state, reload } = useApi<BankTransactionsResponse>(`/finance/bank-transactions?${query.toString()}`);
  const update = (key: keyof typeof filter, value: string) => (setFilter({ ...filter, [key]: value }), setPage(1));
  const headings = [t("transactionAt"), t("fund"), t("direction"), t("amount"), t("content"), t("status"), t("payment"), ""];
  const today = vietnamToday();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="gd-quy">
          {t("fund")}
        </label>
        <select id="gd-quy" className="o-nhap" style={{ width: "auto" }} value={filter.fundId} onChange={(event) => update("fundId", event.target.value)}>
          <option value="">{t("allFunds")}</option>
          {(connections.state.kind === "ready" ? connections.state.data.funds : []).map((item) => (
            <option key={item.fundId} value={item.fundId}>
              {item.fundName}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="gd-trang-thai">
          {t("status")}
        </label>
        <select id="gd-trang-thai" className="o-nhap" style={{ width: "auto" }} value={filter.status} onChange={(event) => update("status", event.target.value)}>
          <option value="">{t("allStatuses")}</option>
          {bankTransactionStatuses.map((status) => (
            <option key={status} value={status}>
              {t(`status_${status}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="gd-chieu">
          {t("direction")}
        </label>
        <select id="gd-chieu" className="o-nhap" style={{ width: "auto" }} value={filter.direction} onChange={(event) => update("direction", event.target.value)}>
          <option value="">{t("allDirections")}</option>
          <option value="in">{t("direction_in")}</option>
          <option value="out">{t("direction_out")}</option>
        </select>
        <label htmlFor="gd-tu-ngay">{t("from")}</label>
        <input id="gd-tu-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={filter.from} onChange={(event) => update("from", event.target.value)} />
        <label htmlFor="gd-den-ngay">{t("to")}</label>
        <input id="gd-den-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={filter.to} onChange={(event) => update("to", event.target.value)} />
        <label className="an-nhan" htmlFor="gd-tim">
          {common("search")}
        </label>
        <input
          id="gd-tim"
          type="search"
          className="o-nhap"
          style={{ width: "auto" }}
          placeholder={t("searchPlaceholder")}
          value={filter.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </div>
      {filter.fundId && (
        <BankReconciliationPanel key={`${filter.fundId}${filter.from}${filter.to}${state.kind}`} fundId={filter.fundId} from={filter.from || `${today.slice(0, 8)}01`} to={filter.to || today} />
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatDateTime(item.transactionAt)}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.fundName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span className={`nhan ${item.direction === "in" ? "thong-tin" : "trung-tinh"}`}>{t(`direction_${item.direction}`)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {item.direction === "out" ? "−" : "+"}
                          {formatNumber(item.amount)}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {item.content || "—"}
                          {item.referenceCode && <span className="chu-thich"> · {item.referenceCode}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span className="nhom-nut">
                          <span className={`nhan ${tone[item.status]}`}>{t(`status_${item.status}`)}</span>
                          {item.autoMatched && <span className="chu-thich">{t("autoMatched")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[6]}>
                        {item.payment ? (
                          <span>
                            <Link href={`/payments/${item.payment.id}`}>{item.payment.documentNo ?? "—"}</Link>
                            <span className="chu-thich">
                              {" "}
                              · {item.payment.partnerName} · {formatDate(item.payment.paymentDate)}
                            </span>
                          </span>
                        ) : item.status === "ignored" ? (
                          <span>{t("ignoredBecause", { reason: item.ignoreReason ?? "" })}</span>
                        ) : (
                          <span>
                            {item.receipt && (
                              <span className="nhom-nut">
                                <Link href={`/payments/${item.receipt.id}`}>{item.receipt.documentNo ?? t("receiptDraft")}</Link>
                                <span className="chu-thich">{payments(`status_${item.receipt.status as "draft"}`)}</span>
                              </span>
                            )}
                            {!item.receipt && item.suggestion && (
                              <span>
                                {t("suggestion", { name: item.suggestion.partnerName })}
                                <span className="chu-thich"> · {t(`reason_${item.suggestion.reason}`)}</span>
                              </span>
                            )}
                            {!item.receipt && !item.suggestion && "—"}
                          </span>
                        )}
                      </td>
                      <td data-nhan={headings[7]}>{result.canManage && <BankTransactionActions item={item} onChanged={() => void reload()} />}</td>
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
