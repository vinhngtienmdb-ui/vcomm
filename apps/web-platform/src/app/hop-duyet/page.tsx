"use client";

// MAN_HINH_07 Hộp duyệt (CHUC_NANG_17; API_39, API_41): chứng từ chờ mình ở mọi công ty, duyệt ngay trong hộp.
import type { ApprovalInboxItem } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { DecisionDrawer } from "@/components/DecisionDrawer";
import { Loaded, MessageView } from "@/components/StatusViews";
import { UserShell } from "@/components/UserShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { failureOf, useApi } from "@/lib/use-api";

export default function InboxPage() {
  return <UserShell>{(me) => <Inbox companies={me.companies} />}</UserShell>;
}

function Inbox({ companies }: { companies: { id: string; shortName: string }[] }) {
  const t = useTranslations("approvals");
  const locale = useLocale();
  const [companyId, setCompanyId] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [rejecting, setRejecting] = useState<ApprovalInboxItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "thong-tin" | "loi" } | null>(null);
  const parameters = new URLSearchParams();
  if (companyId) parameters.set("companyId", companyId);
  if (onlyOverdue) parameters.set("overdue", "true");
  const { state, reload } = useApi<ApprovalInboxItem[]>(`/approval-requests/inbox?${parameters}`);

  async function approve(item: ApprovalInboxItem) {
    setBusyId(item.id);
    try {
      await apiFetch(`/approval-requests/${item.id}/decisions`, { method: "POST", body: JSON.stringify({ decision: "approved" }) });
      setNotice({ text: `${item.documentNo}: ${t("approved")}`, tone: "thong-tin" });
      await reload();
    } catch (error) {
      setNotice({ text: failureOf(error).message, tone: "loi" });
    } finally {
      setBusyId(null);
    }
  }

  const columns = [t("document"), t("company"), t("amount"), t("requestedBy"), t("due"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("inboxTitle")}</h1>
      </div>
      <div className="bo-loc">
        {companies.length > 1 && (
          <>
            <label className="an-nhan" htmlFor="loc-cong-ty">
              {t("company")}
            </label>
            <select id="loc-cong-ty" className="o-nhap" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">{t("allCompanies")}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.shortName}
                </option>
              ))}
            </select>
          </>
        )}
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={onlyOverdue} onChange={(event) => setOnlyOverdue(event.target.checked)} /> {t("onlyOverdue")}
        </label>
      </div>
      {notice && (
        <div className={`khoi-canh-bao ${notice.tone}`} role="status">
          {notice.text}
        </div>
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {columns.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("document")}>
                        <span>
                          <Link href={`/hop-duyet/${item.id}`}>{item.documentNo}</Link>
                          <br />
                          <span className="chu-thich">
                            {locale === "en" ? item.documentTypeNameEn : item.documentTypeNameVi} · {t("level", { level: item.currentLevelNo })}
                          </span>
                        </span>
                      </td>
                      <td data-nhan={t("company")}>
                        <span>{item.companyShortName}</span>
                      </td>
                      <td data-nhan={t("amount")}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatMoney(item.amount, item.currency)}</span>
                      </td>
                      <td data-nhan={t("requestedBy")}>
                        <span>
                          {item.requestedByName}
                          <br />
                          <span className="chu-thich">{formatDateTime(item.requestedAt)}</span>
                        </span>
                      </td>
                      <td data-nhan={t("due")}>
                        <span>{item.overdue ? <span className="nhan loi">{t("overdue")}</span> : formatDateTime(item.dueAt)}</span>
                      </td>
                      <td data-nhan="">
                        <span className="nhom-nut">
                          <button type="button" className={`nut chinh${busyId === item.id ? " dang-xu-ly" : ""}`} disabled={busyId !== null} onClick={() => void approve(item)}>
                            {t("approve")}
                          </button>
                          <button type="button" className="nut nguy-hiem" disabled={busyId !== null} onClick={() => setRejecting(item)}>
                            {t("reject")}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {rejecting && (
        <DecisionDrawer
          requestId={rejecting.id}
          documentNo={rejecting.documentNo}
          decision="rejected"
          onClose={() => setRejecting(null)}
          onDone={(text) => {
            setNotice({ text: `${rejecting.documentNo}: ${text}`, tone: "thong-tin" });
            setRejecting(null);
            void reload();
          }}
        />
      )}
    </>
  );
}
