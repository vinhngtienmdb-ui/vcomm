"use client";

// MAN_HINH_148 Điều chỉnh điểm (CONG_VIEC_51; CHUC_NANG_181; API_180; QUYTAC_NGHIEPVU_353): danh sách phiếu, lập, sửa, gửi duyệt, rút.
import { loyaltyAdjustmentStatuses, type LoyaltyAdjustmentItem, type LoyaltyAdjustmentStatus, type PageResponse } from "contracts";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const statusTone: Record<LoyaltyAdjustmentStatus, string> = { draft: "trung-tinh", pending: "canh-bao", posted: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh", post_failed: "loi" };

function AdjustmentForm({ item, phone, onDone }: { item: LoyaltyAdjustmentItem | null; phone: string; onDone: () => Promise<void> }) {
  const t = useTranslations("loyalty");
  const errors = useTranslations("errors");
  const { notify } = useAdmin();
  const [draft, setDraft] = useState({ phone: item?.buyerPhone ?? phone, direction: item?.direction ?? "add", points: item ? String(item.points) : "", reason: item?.reason ?? "" });
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const body = () => ({ phone: draft.phone.trim(), direction: draft.direction, points: Number(draft.points.replaceAll(".", "")), reason: draft.reason.trim() });
  const save = (submit: boolean) =>
    run(async () => {
      const saved = item
        ? await apiFetch<LoyaltyAdjustmentItem>(`/loyalty/adjustments/${item.id}`, { method: "PUT", body: JSON.stringify({ ...body(), version: item.version }) })
        : await apiFetch<LoyaltyAdjustmentItem>("/loyalty/adjustments", { method: "POST", body: JSON.stringify(body()) });
      if (submit) {
        const sent = await apiFetch<LoyaltyAdjustmentItem>(`/loyalty/adjustments/${saved.id}/submit`, { method: "POST", body: JSON.stringify({ version: saved.version }) });
        notify(t("adjustmentSubmitted", { documentNo: sent.documentNo ?? "" }));
      } else notify(t("adjustmentSaved"));
      await onDone();
    });
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{item ? t("editAdjustment", { documentNo: item.documentNo ?? "" }) : t("newAdjustment")}</h2>
      {item?.failureReason ? <div className="khoi-canh-bao loi">{errors(item.failureReason as "loyaltyInsufficientBalance")}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="dc-phone" label={t("adjustmentPhone")} error={fields.phone}>
          <input id="dc-phone" className={inputClass("phone")} inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field id="dc-direction" label={t("adjustmentDirection")}>
          <select id="dc-direction" className="o-nhap" value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as "add" | "subtract" })}>
            <option value="add">{t("direction_add")}</option>
            <option value="subtract">{t("direction_subtract")}</option>
          </select>
        </Field>
        <Field id="dc-points" label={t("adjustmentPoints")} error={fields.points}>
          <input id="dc-points" className={inputClass("points")} inputMode="numeric" value={draft.points} onChange={(event) => setDraft({ ...draft, points: event.target.value })} />
        </Field>
      </div>
      <Field id="dc-reason" label={t("adjustmentReason")} error={fields.reason}>
        <textarea id="dc-reason" className={inputClass("reason")} rows={3} maxLength={500} value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
      </Field>
      <div className="khoi-canh-bao thong-tin">{t("adjustmentHint")}</div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" disabled={submitting} onClick={() => void save(false)}>
          {t("saveDraft")}
        </button>
        <button type="button" className="nut chinh" disabled={submitting} onClick={() => void save(true)}>
          {t("submitApproval")}
        </button>
      </div>
    </div>
  );
}

function AdjustmentsContent() {
  const t = useTranslations("loyalty");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const phone = useSearchParams().get("phone") ?? "";
  const [status, setStatus] = useState<LoyaltyAdjustmentStatus | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<LoyaltyAdjustmentItem | null | undefined>(phone ? null : undefined);
  const [error, setError] = useState<string | null>(null);
  const { state, reload } = useApi<PageResponse<LoyaltyAdjustmentItem>>(`/loyalty/adjustments?${new URLSearchParams({ page: String(page), pageSize: "20", ...(status ? { status } : {}) })}`);
  const done = async () => {
    setEditing(undefined);
    await reload();
  };
  async function withdraw(item: LoyaltyAdjustmentItem) {
    setError(null);
    try {
      await apiFetch(`/loyalty/adjustments/${item.id}/withdraw`, { method: "POST" });
      notify(t("adjustmentWithdrawn"));
      await reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }
  return (
    <>
      <div className="tieu-de">
        <h1>{t("adjustmentsTitle")}</h1>
        <button type="button" className="nut chinh" onClick={() => setEditing(null)}>
          {t("newAdjustment")}
        </button>
      </div>
      <div className="nhom-nut" role="tablist">
        {(["", ...loyaltyAdjustmentStatuses] as const).map((item) => (
          <button
            key={item || "tat-ca"}
            type="button"
            role="tab"
            aria-selected={status === item}
            className={`nut ${status === item ? "chinh" : "phu"}`}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
          >
            {t(item ? `adjustmentStatus_${item}` : "allStatuses")}
          </button>
        ))}
      </div>
      {editing !== undefined ? <AdjustmentForm key={editing?.id ?? "moi"} item={editing} phone={phone} onDone={done} /> : null}
      <FormError text={error} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noAdjustments")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {["documentNo", "buyer", "direction", "points", "value", "reason", "createdBy", "status"].map((key) => (
                        <th key={key}>{t(`adjustment_${key}`)}</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={t("adjustment_documentNo")}>{item.documentNo ?? "—"}</td>
                        <td data-nhan={t("adjustment_buyer")}>{`${item.buyerName} · ${item.buyerPhone}`}</td>
                        <td data-nhan={t("adjustment_direction")}>{t(`direction_${item.direction}`)}</td>
                        <td data-nhan={t("adjustment_points")}>{formatNumber(item.points, 0)}</td>
                        <td data-nhan={t("adjustment_value")}>{item.value === null ? "—" : formatNumber(item.value, 0)}</td>
                        <td data-nhan={t("adjustment_reason")}>{item.reason}</td>
                        <td data-nhan={t("adjustment_createdBy")}>{`${item.createdByName} · ${formatDateTime(item.createdAt)}`}</td>
                        <td data-nhan={t("adjustment_status")}>
                          <span className={`nhan ${statusTone[item.status]}`}>{t(`adjustmentStatus_${item.status}`)}</span>
                        </td>
                        <td>
                          {item.canEdit ? (
                            <button type="button" className="nut chu" onClick={() => setEditing(item)}>
                              {t("edit")}
                            </button>
                          ) : null}
                          {item.canWithdraw ? (
                            <button type="button" className="nut chu" onClick={() => void withdraw(item)}>
                              {t("withdraw")}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          )
        }
      </Loaded>
    </>
  );
}

export default function LoyaltyAdjustmentsPage() {
  return (
    <Suspense>
      <AdjustmentsContent />
    </Suspense>
  );
}
