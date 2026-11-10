"use client";

// MAN_HINH_61 Chi tiết bảng đối soát thu hộ (CHUC_NANG_89, 90; QUYTAC_NGHIEPVU_119 đến 122; API_104): tổng, các dòng có lỗi, cảnh báo; bỏ dòng, nhập lại, bỏ bảng nháp, gửi, rút.
import type { CollectionStatementResponse, CollectorsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CollectionImportDrawer } from "@/components/CollectionImportDrawer";
import { CollectionStatusBadge } from "@/components/CollectionStatusBadge";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const editable = ["draft", "rejected", "withdrawn"];

export default function CollectionStatementPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<CollectionStatementResponse>(`/finance/collection-statements/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(statement) => <Statement statement={statement} onChanged={() => void reload()} />}
    </Loaded>
  );
}

function Statement({ statement, onChanged }: { statement: CollectionStatementResponse; onChanged: () => void }) {
  const t = useTranslations("collections");
  const router = useRouter();
  const { notify } = useAdmin();
  const collectors = useApi<CollectorsResponse>("/finance/collectors");
  const [reimporting, setReimporting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = statement.canManage && editable.includes(statement.status);
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      notify(message);
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const headings = [t("lineNo"), t("reference"), t("order"), t("customer"), t("collected"), t("fee"), t("orderOpen"), t("check"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("statementTitle", { number: statement.statementNo })}</h1>
        <Link href="/collection-statements" className="nut phu">
          {t("back")}
        </Link>
      </div>
      <section className="the" style={{ display: "grid", gap: "var(--khoang-3)", marginBottom: "var(--khoang-4)" }}>
        <div className="nhom-nut">
          <CollectionStatusBadge status={statement.status} />
          {statement.documentNo && <strong>{statement.documentNo}</strong>}
          <span>
            {statement.collectorName} · {t(`kind_${statement.collectorKind}`)} · {formatDate(statement.statementDate)}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--khoang-3)" }}>
          {[
            [t("totalCollected"), formatMoney(statement.totalCollected, statement.currency)],
            [t("totalFee"), formatMoney(statement.totalFee, statement.currency)],
            [t("netAmount"), formatMoney(statement.netAmount, statement.currency)],
            [t("lineCount"), String(statement.lineCount)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="chu-thich">{label}</div>
              <strong style={{ whiteSpace: "nowrap" }}>{value}</strong>
            </div>
          ))}
        </div>
        {statement.errorCount > 0 && <div className="khoi-canh-bao loi">{t("errorsBlock", { count: statement.errorCount })}</div>}
        {statement.warningCount > 0 && <div className="khoi-canh-bao canh-bao">{t("warnings", { count: statement.warningCount })}</div>}
        {statement.postError && <div className="khoi-canh-bao loi">{statement.postError}</div>}
        <FormError text={error} />
        {(canEdit || statement.canWithdraw) && (
          <div className="nhom-nut">
            {canEdit && (
              <button
                type="button"
                className="nut chinh"
                disabled={busy || statement.errorCount > 0}
                onClick={() =>
                  void act(async () => {
                    const result = await apiFetch<CollectionStatementResponse>(`/finance/collection-statements/${statement.id}/submit`, {
                      method: "POST",
                      body: JSON.stringify({ version: statement.version }),
                    });
                    if (result.status === "pending") notify(t("submittedPending"));
                  }, t("submitted"))
                }
              >
                {t("submit")}
              </button>
            )}
            {statement.canWithdraw && (
              <button
                type="button"
                className="nut phu"
                disabled={busy}
                onClick={() => void act(() => apiFetch(`/finance/collection-statements/${statement.id}/withdraw`, { method: "POST" }), t("withdrawn"))}
              >
                {t("withdraw")}
              </button>
            )}
            {canEdit && (
              <button type="button" className="nut phu" disabled={busy} onClick={() => setReimporting(true)}>
                {t("reimport")}
              </button>
            )}
            {canEdit && statement.status === "draft" && !statement.documentNo && (
              <button type="button" className="nut phu" disabled={busy} onClick={() => setDiscarding(true)}>
                {t("discard")}
              </button>
            )}
          </div>
        )}
      </section>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th key={index} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statement.lines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={headings[0]}>
                  <span>{line.lineNo}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>
                    {line.reference}
                    {line.collectedDate && <span className="chu-thich"> · {formatDate(line.collectedDate)}</span>}
                  </span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{line.orderNo}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{line.customerName ?? (line.orderId ? t("noCustomer") : "—")}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.collectedAmount)}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.feeAmount)}</span>
                </td>
                <td data-nhan={headings[6]}>
                  <span style={{ whiteSpace: "nowrap" }}>{line.orderOpenAmount === null ? "—" : formatNumber(line.orderOpenAmount)}</span>
                </td>
                <td data-nhan={headings[7]}>
                  {line.error ? (
                    <span className="nhan loi">{t(`error_${line.error}`)}</span>
                  ) : line.amountDiffers ? (
                    <span className="nhan canh-bao">{Number(line.collectedAmount) > Number(line.orderOpenAmount) ? t("overpaid") : t("underpaid")}</span>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td data-nhan={headings[8]}>
                  {canEdit && statement.lineCount > 1 && (
                    <button
                      type="button"
                      className="nut phu"
                      disabled={busy}
                      onClick={() => void act(() => apiFetch(`/finance/collection-statements/${statement.id}/lines/${line.id}?version=${statement.version}`, { method: "DELETE" }), t("lineRemoved"))}
                    >
                      {t("removeLine")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reimporting && collectors.state.kind === "ready" && (
        <CollectionImportDrawer
          collectors={collectors.state.data.collectors}
          statement={statement}
          onClose={() => setReimporting(false)}
          onImported={() => (setReimporting(false), notify(t("reimported")), onChanged())}
        />
      )}
      {discarding && (
        <ConfirmDialog
          title={t("discard")}
          text={t("discardText")}
          confirmLabel={t("discard")}
          busy={busy}
          error={error}
          onConfirm={() =>
            void (async () => {
              setBusy(true);
              try {
                await apiFetch(`/finance/collection-statements/${statement.id}/discard`, { method: "POST", body: JSON.stringify({ version: statement.version }) });
                notify(t("discarded"));
                router.push("/collection-statements");
              } catch (failure) {
                setError(failureOf(failure).message);
                setBusy(false);
              }
            })()
          }
          onClose={() => setDiscarding(false)}
        />
      )}
    </>
  );
}
