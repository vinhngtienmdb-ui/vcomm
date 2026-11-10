"use client";

// MAN_HINH_45 Khuyến mãi (CHUC_NANG_62, 64; API_83): danh sách chương trình lọc trạng thái, đã dùng so với giới hạn.
import { promotionStatuses, type PromotionListItem, type PromotionStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PromotionStatusBadge } from "@/components/PromotionStatusBadge";

export default function PromotionsPage() {
  const t = useTranslations("promotions");
  const { can } = useAdmin();
  const [status, setStatus] = useState<PromotionStatus | "">("");
  const { state, reload } = useApi<PromotionListItem[]>(`/sales/promotions${status ? `?status=${status}` : ""}`);
  const headings = [t("documentNo"), t("name"), t("kind"), t("period"), t("used"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="promotion" />
        {can("sales.promotion.manage") && (
          <Link className="nut chinh" href="/promotions/new">
            {t("create")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-khuyen-mai">
          {t("status")}
        </label>
        <select id="loc-khuyen-mai" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value as PromotionStatus | "")}>
          <option value="">{t("allStatuses")}</option>
          {promotionStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
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
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/promotions/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.name}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {formatDate(item.validFrom)} – {formatDate(item.validTo)}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {item.kind === "buy_get"
                            ? t("usedSets", { used: item.usedGiftSets, limit: item.maxGiftSets ?? "∞" })
                            : t("usedAmount", { used: formatNumber(item.usedAmount), limit: item.budgetAmount ? formatNumber(item.budgetAmount) : "∞" })}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <PromotionStatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </>
  );
}
