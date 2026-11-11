"use client";

// Thành phần tăng ca dùng chung MAN_HINH_122, MAN_HINH_124 (CONG_VIEC_47; API_154): phiếu tăng ca có xem trước giới hạn giờ, nhãn trạng thái.
import type { OvertimeItem, OvertimePreviewResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";
import { vietnamClock } from "@/components/AttendanceParts";

export const decimal = (value: string | number) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

export function OvertimeStatusBadge({ status }: { status: OvertimeItem["status"] }) {
  const t = useTranslations("overtime");
  const tone = { awaiting_consent: "trung-tinh", declined: "loi", pending: "canh-bao", approved: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh", cancelled: "trung-tinh" }[status];
  return <span className={`nhan ${tone}`}>{t(`status_${status}`)}</span>;
}

export const overtimeTime = (item: Pick<OvertimeItem, "startAt" | "endAt">) => `${vietnamClock(item.startAt).slice(0, 5)} – ${vietnamClock(item.endAt).slice(0, 5)}`;

// self = người lao động tự lập (đồng ý luôn, gửi duyệt); còn lại trưởng phòng hoặc nhân sự lập, chọn nhân viên. withDocument: nhân sự được đính kèm văn bản đồng ý.
export function OvertimeDrawer({
  self,
  employees,
  withDocument,
  onClose,
  onSaved,
}: {
  self: boolean;
  employees?: { id: string; label: string }[];
  withDocument?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("overtime");
  const submit = useSubmit();
  const [values, setValues] = useState({ employeeId: employees?.[0]?.id ?? "", workDate: vietnamToday(), startTime: "18:00", endTime: "20:00" });
  const [preview, setPreview] = useState<OvertimePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    if ((!self && !values.employeeId) || !values.startTime || !values.endTime) return;
    let current = true;
    const body = { ...(self ? {} : { employeeId: values.employeeId }), workDate: values.workDate, startTime: values.startTime, endTime: values.endTime, workContent: "-", workLocation: "-" };
    const timer = setTimeout(() => {
      apiFetch<OvertimePreviewResponse>(self ? "/hr/me/overtime/preview" : "/hr/overtime/preview", { method: "POST", body: JSON.stringify(body) })
        .then((result) => current && (setPreview(result), setPreviewError(null)))
        .catch((failure) => current && (setPreview(null), setPreviewError(failureOf(failure).message)));
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [self, values]);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    void submit.run(async () => {
      if (file instanceof File && file.size > 0) await apiUpload("/hr/overtime", form);
      else {
        form.delete("file");
        await apiFetch(self ? "/hr/me/overtime" : "/hr/overtime", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
      }
      onSaved();
    });
  };
  const change = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((previous) => ({ ...previous, [key]: event.target.value }));
  return (
    <Drawer title={t("newTitle")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        {!self && (
          <Field id="tc-nhan-vien" label={t("employee")} error={submit.fields.employeeId}>
            <select id="tc-nhan-vien" name="employeeId" className="o-nhap" value={values.employeeId} onChange={change("employeeId")}>
              {(employees ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="tc-ngay" label={t("workDate")} error={submit.fields.workDate}>
          <input id="tc-ngay" name="workDate" type="date" className={submit.inputClass("workDate")} value={values.workDate} onChange={change("workDate")} />
        </Field>
        <Field id="tc-bat-dau" label={t("startTime")} error={submit.fields.startTime}>
          <input id="tc-bat-dau" name="startTime" type="time" className={submit.inputClass("startTime")} value={values.startTime} onChange={change("startTime")} />
        </Field>
        <Field id="tc-ket-thuc" label={t("endTime")} error={submit.fields.endTime} hint={t("endHint")}>
          <input id="tc-ket-thuc" name="endTime" type="time" className={submit.inputClass("endTime")} value={values.endTime} onChange={change("endTime")} />
        </Field>
        <Field id="tc-cong-viec" label={t("workContent")} error={submit.fields.workContent}>
          <textarea id="tc-cong-viec" name="workContent" rows={2} className={submit.inputClass("workContent")} maxLength={500} />
        </Field>
        <Field id="tc-dia-diem" label={t("workLocation")} error={submit.fields.workLocation}>
          <input id="tc-dia-diem" name="workLocation" className={submit.inputClass("workLocation")} maxLength={200} />
        </Field>
        {preview && (
          <div className={`khoi-canh-bao ${preview.violations.length > 0 ? "loi" : "thong-tin"}`} role="status">
            {t("previewLine", {
              kind: t(`dayKind_${preview.dayKind}`),
              hours: decimal(preview.hours),
              night: decimal(preview.nightHours),
              dayLimit: decimal(preview.dayLimitHours),
              monthUsed: decimal(preview.monthUsedHours),
              monthLimit: preview.monthLimitHours,
              yearUsed: decimal(preview.yearUsedHours),
              yearLimit: preview.yearLimitHours,
            })}
            {preview.violations.map((violation) => (
              <div key={violation}>{t(`violation_${violation}`)}</div>
            ))}
          </div>
        )}
        {previewError && <div className="khoi-canh-bao loi">{previewError}</div>}
        <div className="khoi-canh-bao canh-bao">{t("protectedHint")}</div>
        {withDocument && (
          <Field id="tc-tep" label={t("consentFile")} error={submit.fields.file} hint={t("consentFileHint")}>
            <input id="tc-tep" name="file" type="file" className="o-nhap" accept=".pdf,.jpg,.jpeg,.png" />
          </Field>
        )}
        <span className="chu-thich">{self ? t("selfHint") : t("managerHint")}</span>
        <FormError text={submit.formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting || (preview?.violations.length ?? 0) > 0}>
            {self ? t("submitSelf") : t("submitManager")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function CancelOvertimeDrawer({ item, path, onClose, onDone }: { item: OvertimeItem; path: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("overtime");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Drawer title={t("cancelTitle", { number: item.requestNo })} onClose={onClose}>
      <p style={{ margin: 0 }}>{t("cancelText")}</p>
      <Field id="tc-ly-do-huy" label={t("reasonRequired")}>
        <textarea id="tc-ly-do-huy" className="o-nhap" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormError text={error} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`}
          disabled={busy || !reason.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await apiFetch(path, { method: "POST", body: JSON.stringify({ reason }) });
              onDone();
            } catch (failure) {
              setError(failureOf(failure).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("cancelRequest")}
        </button>
      </div>
    </Drawer>
  );
}
