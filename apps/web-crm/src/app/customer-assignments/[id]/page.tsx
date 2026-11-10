"use client";

// MAN_HINH_65 Phiếu giao khách (CHUC_NANG_97; API_110): khách, nhân viên phụ trách hiện tại và lúc gửi; sửa, gửi, rút, bỏ phiếu nháp.
import type { CustomerAssignmentResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { AssignmentForm } from "@/components/AssignmentForm";
import { AssignmentStatusBadge } from "@/components/AssignmentStatusBadge";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 180px) 1fr", gap: "var(--khoang-3)" }}>
      <span className="chu-thich">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function CustomerAssignmentPage() {
  const t = useTranslations("customerAssignments");
  const common = useTranslations("common");
  const errors = useTranslations("errors");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useAdmin();
  const { state, reload } = useApi<CustomerAssignmentResponse>(`/crm/customer-assignments/${id}`);
  const [editing, setEditing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body: unknown, message: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      notify(message);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(item) => (
        <>
          <div className="tieu-de">
            <h1>
              {t("titleOne")} {item.documentNo ?? t("draftNo")}
            </h1>
            <Link className="nut phu" href="/customer-assignments">
              {t("backToList")}
            </Link>
          </div>
          <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <Row label={t("status")}>
              <AssignmentStatusBadge status={item.status} />
            </Row>
            <Row label={t("target")}>{item.targetUserName}</Row>
            <Row label={t("reason")}>{item.reason}</Row>
            <Row label={t("createdBy")}>
              {item.createdByName} · {formatDateTime(item.createdAt)}
            </Row>
            {item.appliedAt && <Row label={t("appliedAt")}>{formatDateTime(item.appliedAt)}</Row>}
            {item.applyError && (
              <div className="khoi-canh-bao loi">
                {errors.has(item.applyError as never) ? errors(item.applyError as never) : item.applyError}
                {item.applyErrorDetail && <div>{t("changedCustomers", { names: item.applyErrorDetail })}</div>}
              </div>
            )}
            {error && <div className="khoi-canh-bao loi">{error}</div>}
            <div className="nhom-nut">
              {item.canSubmit && !editing && (
                <button type="button" className="nut chinh" disabled={busy} onClick={() => void act(`/crm/customer-assignments/${id}/submit`, { version: item.version }, t("submitted"))}>
                  {t("submit")}
                </button>
              )}
              {item.canEdit && !editing && (
                <button type="button" className="nut phu" onClick={() => setEditing(true)}>
                  {t("edit")}
                </button>
              )}
              {item.canWithdraw && (
                <button type="button" className="nut phu" disabled={busy} onClick={() => void act(`/crm/customer-assignments/${id}/withdraw`, {}, t("withdrawn"))}>
                  {t("withdraw")}
                </button>
              )}
              {item.canDiscard && !editing && (
                <button type="button" className="nut phu" onClick={() => setDiscarding(true)}>
                  {t("discard")}
                </button>
              )}
            </div>
          </section>
          {editing ? (
            <AssignmentForm
              current={item}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                notify(t("saved"));
                void reload();
              }}
            />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("customer")}</th>
                    <th scope="col">{t("currentOwner")}</th>
                    <th scope="col">{t("previousOwner")}</th>
                  </tr>
                </thead>
                <tbody>
                  {item.lines.map((line) => (
                    <tr key={line.partnerId}>
                      <td data-nhan={t("customer")}>
                        <span>
                          {line.code} · {line.name}
                        </span>
                      </td>
                      <td data-nhan={t("currentOwner")}>
                        <span>{line.currentOwnerName ?? t("noOwner")}</span>
                      </td>
                      <td data-nhan={t("previousOwner")}>
                        <span>{item.submittedAt ? (line.previousOwnerName ?? t("noOwner")) : common("none")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {discarding && (
            <ConfirmDialog
              title={t("discard")}
              text={t("discardConfirm")}
              confirmLabel={t("discard")}
              busy={busy}
              error={error}
              onClose={() => setDiscarding(false)}
              onConfirm={() => {
                setBusy(true);
                void apiFetch(`/crm/customer-assignments/${id}/discard`, { method: "POST", body: JSON.stringify({ version: item.version }) })
                  .then(() => {
                    notify(t("discarded"));
                    router.push("/customer-assignments");
                  })
                  .catch((failure: unknown) => setError(failureOf(failure).message))
                  .finally(() => setBusy(false));
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
