"use client";

// MAN_HINH_82 Đề xuất đội kinh doanh (CHUC_NANG_112; API_121; QUYTAC_NGHIEPVU_153): lọc trạng thái; duyệt (áp dụng ngay), từ chối kèm ghi chú.
import { salesProposalStatuses, type MarketplaceSettingsResponse, type SalesProposalItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const tone = { pending: "canh-bao", approved: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" } as const;

export default function SalesProposalsPage() {
  const t = useTranslations("salesProposals");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [status, setStatus] = useState("pending");
  const settings = useApi<MarketplaceSettingsResponse>("/marketplace/settings");
  const { state, reload } = useApi<SalesProposalItem[]>(`/marketplace/sales-proposals${status ? `?status=${status}` : ""}`);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = settings.state.kind === "ready" && settings.state.data.canManage;
  const headings = [t("kind"), t("target"), t("unit"), t("proposer"), t("reason"), t("status"), t("actions")];

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/sales-proposals/${id}/${action}`, { method: "POST", body: JSON.stringify(action === "reject" ? { note } : {}) });
      notify(t(action === "approve" ? "approved" : "rejected"));
      setRejecting(null);
      setNote("");
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="dx-trang-thai">
          {t("status")}
        </label>
        <select id="dx-trang-thai" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {salesProposalStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <FormError text={error} />
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
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          <Link href={`/buyers/${item.targetUserId}`}>{item.targetName}</Link> · {item.targetPhone}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.departmentName ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {item.proposerName}
                          <span className="chu-thich"> · {formatDateTime(item.createdAt)}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.reason}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                          <span className={`nhan ${tone[item.status]}`}>{t(`status_${item.status}`)}</span>
                          {item.decidedByName && <span className="chu-thich">{t("decided", { name: item.decidedByName, time: formatDateTime(item.decidedAt) })}</span>}
                          {item.decisionNote && <span className="chu-thich">{item.decisionNote}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[6]}>
                        {canManage && item.status === "pending" ? (
                          rejecting === item.id ? (
                            <span style={{ display: "grid", gap: "var(--khoang-2)" }}>
                              <label htmlFor={`ghi-chu-${item.id}`}>{t("rejectNote")}</label>
                              <textarea id={`ghi-chu-${item.id}`} className="o-nhap" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
                              <span className="nhom-nut">
                                <button type="button" className="nut chinh" disabled={busy || !note.trim()} onClick={() => void decide(item.id, "reject")}>
                                  {t("reject")}
                                </button>
                                <button type="button" className="nut phu" onClick={() => setRejecting(null)}>
                                  {common("cancel")}
                                </button>
                              </span>
                            </span>
                          ) : (
                            <span className="nhom-nut">
                              <button type="button" className="nut chinh" disabled={busy} onClick={() => window.confirm(t("confirmApprove")) && void decide(item.id, "approve")}>
                                {t("approve")}
                              </button>
                              <button
                                type="button"
                                className="nut phu"
                                disabled={busy}
                                onClick={() => {
                                  setRejecting(item.id);
                                  setNote("");
                                }}
                              >
                                {t("reject")}
                              </button>
                            </span>
                          )
                        ) : (
                          <span className="chu-thich">—</span>
                        )}
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
