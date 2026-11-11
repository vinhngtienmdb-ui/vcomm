"use client";

// Thành phần nghỉ phép dùng chung MAN_HINH_122, MAN_HINH_123 (CONG_VIEC_47; API_153): biểu mẫu đơn nghỉ có xem trước số ngày, nhãn trạng thái đơn.
import type { LeavePreviewResponse, LeaveRequestItem, LeaveTypeItem } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, vietnamToday } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";

export function LeaveStatusBadge({ status }: { status: LeaveRequestItem["status"] }) {
  const t = useTranslations("leave");
  const tone = { pending: "canh-bao", approved: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh", cancelled: "trung-tinh" }[status];
  return <span className={`nhan ${tone}`}>{t(`status_${status}`)}</span>;
}

export function leavePeriod(item: Pick<LeaveRequestItem, "fromDate" | "fromHalf" | "toDate" | "toHalf">, half: (key: string) => string): string {
  const start = `${formatDate(item.fromDate)}${item.fromHalf === "full" ? "" : ` (${half(item.fromHalf)})`}`;
  if (item.fromDate === item.toDate) return start;
  return `${start} – ${formatDate(item.toDate)}${item.toHalf === "full" ? "" : ` (${half(item.toHalf)})`}`;
}

// self = người lao động tự lập (gửi duyệt); còn lại nhân sự ghi nhận thay, chọn nhân viên.
export function LeaveRequestDrawer({
  self,
  types,
  employees,
  onClose,
  onSaved,
}: {
  self: boolean;
  types: LeaveTypeItem[];
  employees?: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("leave");
  const submit = useSubmit();
  const today = vietnamToday();
  const [values, setValues] = useState({
    employeeId: employees?.[0]?.id ?? "",
    leaveTypeId: types[0]?.id ?? "",
    fromDate: today,
    fromHalf: "full",
    toDate: today,
    toHalf: "full",
  });
  const [preview, setPreview] = useState<LeavePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const type = types.find((item) => item.id === values.leaveTypeId);
  useEffect(() => {
    if (!values.leaveTypeId || (!self && !values.employeeId) || values.toDate < values.fromDate) return;
    let current = true;
    const body = {
      ...(self ? {} : { employeeId: values.employeeId }),
      leaveTypeId: values.leaveTypeId,
      fromDate: values.fromDate,
      fromHalf: values.fromHalf,
      toDate: values.toDate,
      toHalf: values.toHalf,
    };
    apiFetch<LeavePreviewResponse>(self ? "/hr/me/leave/preview" : "/hr/leave/preview", { method: "POST", body: JSON.stringify(body) })
      .then((result) => current && (setPreview(result), setPreviewError(null)))
      .catch((failure) => current && (setPreview(null), setPreviewError(failureOf(failure).message)));
    return () => {
      current = false;
    };
  }, [self, values]);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (file instanceof File && file.size === 0) form.delete("file");
    void submit.run(async () => {
      await apiUpload(self ? "/hr/me/leave/requests" : "/hr/leave/requests", form);
      onSaved();
    });
  };
  const single = values.fromDate === values.toDate;
  return (
    <Drawer title={self ? t("newRequest") : t("recordForEmployee")} onClose={onClose}>
      <form className="the" style={{ boxShadow: "none", border: 0, padding: 0 }} onSubmit={onSubmit}>
        {!self && employees && (
          <Field id="np-nhan-vien" label={t("employee")} error={submit.fields.employeeId}>
            <select id="np-nhan-vien" name="employeeId" className="o-nhap" value={values.employeeId} onChange={set("employeeId")}>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="np-loai" label={t("type")} error={submit.fields.leaveTypeId}>
          <select id="np-loai" name="leaveTypeId" className="o-nhap" value={values.leaveTypeId} onChange={set("leaveTypeId")}>
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.perEventDays ? ` (${t("perEvent", { days: Number(item.perEventDays) })})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field id="np-tu" label={t("fromDate")} error={submit.fields.fromDate}>
          <input id="np-tu" name="fromDate" type="date" className={submit.inputClass("fromDate")} value={values.fromDate} onChange={set("fromDate")} />
        </Field>
        <Field id="np-tu-buoi" label={t("fromHalf")} error={submit.fields.fromHalf}>
          <select id="np-tu-buoi" name="fromHalf" className="o-nhap" value={values.fromHalf} onChange={set("fromHalf")}>
            <option value="full">{t("half_full")}</option>
            {single && <option value="morning">{t("half_morning")}</option>}
            <option value="afternoon">{t("half_afternoon")}</option>
          </select>
        </Field>
        <Field id="np-den" label={t("toDate")} error={submit.fields.toDate}>
          <input id="np-den" name="toDate" type="date" className={submit.inputClass("toDate")} value={values.toDate} min={values.fromDate} onChange={set("toDate")} />
        </Field>
        {!single && (
          <Field id="np-den-buoi" label={t("toHalf")}>
            <select id="np-den-buoi" name="toHalf" className="o-nhap" value={values.toHalf} onChange={set("toHalf")}>
              <option value="full">{t("half_full")}</option>
              <option value="morning">{t("half_morning")}</option>
            </select>
          </Field>
        )}
        {single && <input type="hidden" name="toHalf" value="full" />}
        {preview && (
          <div className={`khoi-canh-bao ${preview.availableAfter !== null && Number(preview.availableAfter) < 0 ? "canh-bao" : "thong-tin"}`}>
            {t("previewDays", { days: Number(preview.days).toLocaleString("vi-VN") })}
            {preview.availableAfter !== null && ` ${t("previewBalance", { after: Number(preview.availableAfter).toLocaleString("vi-VN") })}`}
          </div>
        )}
        {previewError && <div className="khoi-canh-bao canh-bao">{previewError}</div>}
        <Field id="np-ly-do" label={t("reason")} error={submit.fields.reason}>
          <textarea id="np-ly-do" name="reason" rows={2} className={submit.inputClass("reason")} maxLength={1000} />
        </Field>
        <Field id="np-tep" label={type?.requiresAttachment ? t("attachmentRequired") : t("attachmentOptional")} error={submit.fields.file}>
          <input id="np-tep" name="file" type="file" className="o-nhap" accept=".pdf,.jpg,.jpeg,.png" />
        </Field>
        {!self && <div className="khoi-canh-bao canh-bao">{t("recordHint")}</div>}
        <FormError text={submit.formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submit.submitting ? " dang-xu-ly" : ""}`} disabled={submit.submitting}>
            {self ? t("submit") : t("record")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
