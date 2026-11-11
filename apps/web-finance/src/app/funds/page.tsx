"use client";

// MAN_HINH_46 Quỹ (CHUC_NANG_65; API_84): danh sách quỹ kèm số dư hiện tại; thêm quỹ.
import type { FundResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { FundEditor } from "@/components/FundEditor";

export default function FundsPage() {
  const t = useTranslations("funds");
  const { can, notify } = useAdmin();
  const { state, reload } = useApi<FundResponse[]>("/finance/funds");
  const [adding, setAdding] = useState(false);
  const headings = [t("code"), t("name"), t("kind"), t("balance"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="fund" />
        {can("finance.fund.manage") && !adding && (
          <button type="button" className="nut chinh" onClick={() => setAdding(true)}>
            {t("create")}
          </button>
        )}
      </div>
      {adding && (
        <FundEditor
          fund={null}
          onSaved={() => {
            setAdding(false);
            notify(t("saved"));
            void reload();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(funds) =>
          funds.length === 0 ? (
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
                  {funds.map((fund) => (
                    <tr key={fund.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/funds/${fund.id}`}>{fund.code}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {fund.name}
                          {fund.kind === "bank" && <span className="chu-thich"> · {[fund.bankName, fund.accountNo].filter(Boolean).join(" · ")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{t(`kind_${fund.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatMoney(fund.balance, fund.currency)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span className={`nhan ${fund.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${fund.status}`)}</span>
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
