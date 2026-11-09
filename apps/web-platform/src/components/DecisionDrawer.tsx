"use client";

// Đồng ý hoặc từ chối một yêu cầu duyệt; từ chối bắt buộc nhập lý do (API_41).
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Drawer } from "./Dialogs";
import { Field, FormError, useSubmit } from "./Form";

export function DecisionDrawer({ requestId, documentNo, decision, onClose, onDone }: { requestId: string; documentNo: string; decision: "approved" | "rejected"; onClose: () => void; onDone: (text: string) => void }) {
  const t = useTranslations("approvals");
  const common = useTranslations("common");
  const [comment, setComment] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const rejecting = decision === "rejected";

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/approval-requests/${requestId}/decisions`, { method: "POST", body: JSON.stringify({ decision, comment: comment || null }) });
      onDone(t(rejecting ? "rejected" : "approved"));
    });
  }

  return (
    <Drawer title={rejecting ? t("rejectTitle", { documentNo }) : `${t("approve")} ${documentNo}`} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="y-kien" label={rejecting ? t("reason") : t("commentOptional")} error={fields.comment}>
          <textarea id="y-kien" className={inputClass("comment")} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut ${rejecting ? "nguy-hiem" : "chinh"}${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || (rejecting && !comment.trim())}>
            {rejecting ? t("reject") : t("approve")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
