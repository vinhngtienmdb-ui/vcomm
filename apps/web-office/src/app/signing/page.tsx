"use client";

// MAN_HINH_210 Trình ký (CHUC_NANG_211; API_242, API_243): thẻ Chờ tôi ký, Tôi gửi, Đã ký; tài khoản ký số của tôi.
import type { SigningRequestListItem, SigningRequestStatus, SigningRequestTab } from "contracts";
import { signingRequestStatuses, signingRequestTabs } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { MyIdentityCard, SigningSource, SigningStatusBadge } from "@/components/SigningParts";

export default function SigningPage() {
  const t = useTranslations("officeSigning");
  const common = useTranslations("common");
  const [tab, setTab] = useState<SigningRequestTab>("to_sign");
  const [status, setStatus] = useState<SigningRequestStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ tab, page: String(page), ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
  const { state, reload } = useApi<{ items: SigningRequestListItem[]; total: number; page: number; pageSize: number }>(`/office/signing-requests?${query.toString()}`);
  const headings = [t("requestNo"), t("titleLabel"), t("createdBy"), tab === "signed" ? t("signedAt") : t("currentSigners"), t("dueOn"), t("statusLabel")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <div className="nhom-nut">
          <Link className="nut chinh" href="/signing/new">
            {t("create")}
          </Link>
        </div>
      </div>
      <MyIdentityCard />
      <div className="cac-the" role="tablist">
        {signingRequestTabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => (setTab(item), setPage(1))}>
            {t(`tab_${item}`)}
          </button>
        ))}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-phien-ky">
          {common("search")}
        </label>
        <input id="tim-phien-ky" className="o-nhap" placeholder={t("searchHint")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
        {tab !== "to_sign" && (
          <select className="o-nhap" aria-label={t("statusLabel")} value={status} onChange={(event) => (setStatus(event.target.value as SigningRequestStatus | ""), setPage(1))}>
            <option value="">{t("statusAll")}</option>
            {signingRequestStatuses.map((item) => (
              <option key={item} value={item}>
                {t(`status_${item}`)}
              </option>
            ))}
          </select>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.items.length === 0 ? (
            <MessageView text={t(`empty_${tab}`)} />
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
                        <Link href={`/signing/${item.id}`}>{item.requestNo}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          <Link href={`/signing/${item.id}`} style={{ whiteSpace: "normal" }}>
                            {item.title}
                          </Link>
                          <span className="chu-thich" style={{ display: "block" }}>
                            <SigningSource sourceType={item.sourceType} sourceId={item.sourceId} />
                          </span>
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.createdBy.fullName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {tab === "signed" ? formatDate(item.signedAt?.slice(0, 10) ?? null) : item.currentSigners.join(", ") || "—"}
                          {item.companySealTurn && <span className="nhan thong-tin">{t("companySealTurn")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatDate(item.dueOn)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>
                          <SigningStatusBadge status={item.status} />
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
          )
        }
      </Loaded>
    </>
  );
}
