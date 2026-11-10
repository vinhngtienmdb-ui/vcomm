"use client";

// MAN_HINH_56 thẻ "Bảng hoa hồng" (CHUC_NANG_83; QUYTAC_NGHIEPVU_111, 112): lập bảng tháng tiếp theo, chi tiết theo nhân viên, gửi, rút, bỏ bảng nháp.
import type { CommissionStatementResponse, CommissionStatementsResponse, CommissionStatementStatus } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const tone: Record<CommissionStatementStatus, string> = { draft: "trung-tinh", pending: "canh-bao", posted: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" };
const monthLabel = (month: string) => `${month.slice(5)}/${month.slice(0, 4)}`;

export function CommissionStatements() {
  const t = useTranslations("commissions");
  const errors = useTranslations("errors");
  const { notify } = useAdmin();
  const { state, reload } = useApi<CommissionStatementsResponse>("/finance/commissions/statements");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create(month: string) {
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<CommissionStatementResponse>("/finance/commissions/statements", { method: "POST", body: JSON.stringify({ month }) });
      notify(t("statementCreated", { month: monthLabel(month) }));
      setSelected(created.id);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const headings = [t("month"), t("documentNo"), t("statementStatus"), t("total")];
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
        <>
          <div className="tieu-de">
            <span className="chu-thich">{data.nextMonth ? t("nextMonth", { month: monthLabel(data.nextMonth) }) : t("noNextMonth")}</span>
            {data.canCreate && data.nextMonth && (
              <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void create(data.nextMonth!)}>
                {t("createStatement", { month: monthLabel(data.nextMonth) })}
              </button>
            )}
          </div>
          <FormError text={error} />
          {selected && (
            <StatementDetail
              id={selected}
              onChanged={() => void reload()}
              onClose={() => {
                setSelected(null);
                void reload();
              }}
            />
          )}
          {data.statements.length === 0 ? (
            <MessageView text={t("noStatements")} />
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
                  {data.statements.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <button type="button" className="nut chu" onClick={() => setSelected(item.id)}>
                          {monthLabel(item.month)}
                        </button>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.documentNo ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span className={`nhan ${tone[item.status]}`}>{t(`status_${item.status}`)}</span>
                        {item.postError && <span className="chu-thich"> · {errors.has(item.postError as never) ? errors(item.postError as never) : item.postError}</span>}
                      </td>
                      <td data-nhan={headings[3]}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {formatNumber(item.totalAmount)} {data.currency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Loaded>
  );
}

function StatementDetail({ id, onChanged, onClose }: { id: string; onChanged: () => void; onClose: () => void }) {
  const t = useTranslations("commissions");
  const { notify } = useAdmin();
  const { state, reload } = useApi<CommissionStatementResponse>(`/finance/commissions/statements/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(statement: CommissionStatementResponse, action: "submit" | "withdraw" | "discard") {
    setBusy(true);
    setError(null);
    try {
      if (action === "discard") {
        await apiFetch(`/finance/commissions/statements/${statement.id}`, { method: "DELETE" });
        notify(t("discarded"));
        onClose();
        return;
      }
      const result = await apiFetch<CommissionStatementResponse>(`/finance/commissions/statements/${statement.id}/${action}`, {
        method: "POST",
        body: action === "submit" ? JSON.stringify({ version: statement.version }) : undefined,
      });
      notify(action === "withdraw" ? t("withdrawn") : result.status === "posted" ? t("posted") : t("submitted"));
      await reload();
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const headings = [t("staff"), t("baseAmount"), t("commissionBefore"), t("target"), t("achieved"), t("multiplier"), t("amount")];
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(statement) => (
        <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <div className="tieu-de">
            <strong>{t("statementTitle", { month: monthLabel(statement.month), count: statement.eventCount })}</strong>
            <span className="nhom-nut">
              {statement.canManage && statement.status === "draft" && (
                <>
                  <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act(statement, "submit")}>
                    {t("submit")}
                  </button>
                  <button type="button" className="nut phu" disabled={busy} onClick={() => void act(statement, "discard")}>
                    {t("discard")}
                  </button>
                </>
              )}
              {statement.canWithdraw && (
                <button type="button" className="nut phu" disabled={busy} onClick={() => void act(statement, "withdraw")}>
                  {t("withdraw")}
                </button>
              )}
              <button type="button" className="nut chu" onClick={onClose}>
                {t("close")}
              </button>
            </span>
          </div>
          <FormError text={error} />
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
                {statement.lines.map((line) => (
                  <tr key={line.userId}>
                    <td data-nhan={headings[0]}>
                      <span>{line.fullName}</span>
                    </td>
                    <td data-nhan={headings[1]}>
                      <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.baseAmount)}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.commissionBefore)}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span style={{ whiteSpace: "nowrap" }}>{line.targetAmount ? formatNumber(line.targetAmount) : t("noTarget")}</span>
                    </td>
                    <td data-nhan={headings[4]}>
                      <span>{line.achievedPercent ? `${formatNumber(line.achievedPercent)}%` : "—"}</span>
                    </td>
                    <td data-nhan={headings[5]}>
                      <span>{formatNumber(line.multiplier)}</span>
                    </td>
                    <td data-nhan={headings[6]}>
                      <strong style={{ whiteSpace: "nowrap" }}>{formatNumber(line.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            {t("total")}:{" "}
            <strong>
              {formatNumber(statement.totalAmount)} {statement.currency}
            </strong>
          </div>
        </section>
      )}
    </Loaded>
  );
}
