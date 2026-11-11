"use client";

// MAN_HINH_49 Phiếu thu chi (CHUC_NANG_67; API_86): danh sách lọc loại, trạng thái; lập phiếu.
import { paymentKinds, paymentStatuses, type PaymentKind, type PaymentListItem, type PaymentStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";

export default function PaymentsPage() {
  const t = useTranslations("payments");
  const { can } = useAdmin();
  const [kind, setKind] = useState<PaymentKind | "">("");
  const [status, setStatus] = useState<PaymentStatus | "">("");
  const query = new URLSearchParams({ ...(kind ? { kind } : {}), ...(status ? { status } : {}) });
  const { state, reload } = useApi<PaymentListItem[]>(`/finance/payments?${query.toString()}`);
  const headings = [t("documentNo"), t("kind"), t("paymentDate"), t("partner"), t("fund"), t("amount"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="payment" />
        {can("finance.payment.manage") && (
          <Link className="nut chinh" href="/payments/new">
            {t("create")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-loai-phieu">
          {t("kind")}
        </label>
        <select id="loc-loai-phieu" className="o-nhap" style={{ width: "auto" }} value={kind} onChange={(event) => setKind(event.target.value as PaymentKind | "")}>
          <option value="">{t("allKinds")}</option>
          {paymentKinds.map((item) => (
            <option key={item} value={item}>
              {t(`kind_${item}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-phieu">
          {t("status")}
        </label>
        <select id="loc-trang-thai-phieu" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus | "")}>
          <option value="">{t("allStatuses")}</option>
          {paymentStatuses.map((item) => (
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
                        <Link href={`/payments/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatDate(item.paymentDate)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.partnerName ?? t("noPartner")}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.fundName}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.amount)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <PaymentStatusBadge status={item.status} />
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
