"use client";

// Thành phần dùng chung của MAN_HINH_117, 118: nhãn trạng thái, số ngày đến hạn, danh sách phụ cấp, các ngăn kéo ký, hủy, chấm dứt (CHUC_NANG_163).
import type { ContractAllowance, ContractListItem, ContractStatus, TerminationReason } from "contracts";
import { terminationReasons } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatMoney, vietnamToday } from "ui/lib/format";

const statusTone: Record<ContractStatus, string> = {
  draft: "trung-tinh",
  pending: "thong-tin",
  approved: "thong-tin",
  signed: "thanh-cong",
  rejected: "loi",
  withdrawn: "trung-tinh",
  cancelled: "trung-tinh",
  terminated: "trung-tinh",
};

export function ContractStatusBadges({ item }: { item: Pick<ContractListItem, "status" | "validity" | "daysToEnd" | "overThirtyDays"> }) {
  const t = useTranslations("contracts");
  return (
    <span className="nhom-nut">
      <span className={`nhan ${statusTone[item.status]}`}>{t(`status_${item.status}`)}</span>
      {item.validity && item.validity !== "terminated" && <span className="nhan trung-tinh">{t(`validity_${item.validity}`)}</span>}
      {item.daysToEnd !== null && item.daysToEnd <= 30 && (
        <span className={`nhan ${item.daysToEnd < 0 ? "loi" : "canh-bao"}`}>{item.daysToEnd < 0 ? t("daysOver", { days: -item.daysToEnd }) : t("daysLeft", { days: item.daysToEnd })}</span>
      )}
      {item.overThirtyDays && <span className="nhan loi">{t("overThirty")}</span>}
    </span>
  );
}

export const money = (value: string | null, currency: string) => (value === null ? null : formatMoney(value, currency));

export function AllowanceText({ allowances, currency }: { allowances: ContractAllowance[] | null; currency: string }) {
  const t = useTranslations("contracts");
  if (allowances === null) return <span className="chu-thich">{t("noSalaryPermission")}</span>;
  if (allowances.length === 0) return <>—</>;
  return <>{allowances.map((item) => `${item.name} ${money(item.amount, currency)}`).join(" · ")}</>;
}

// Ô nhập danh sách phụ cấp.
export function AllowanceEditor({ value, onChange, errors }: { value: ContractAllowance[]; onChange: (value: ContractAllowance[]) => void; errors: Record<string, string> }) {
  const t = useTranslations("contracts");
  return (
    <div className="truong">
      <span>{t("allowances")}</span>
      {value.map((item, index) => (
        <div key={index} className="nhom-nut" style={{ alignItems: "flex-start" }}>
          <input
            className={`o-nhap${errors[`allowances.${index}.name`] ? " loi" : ""}`}
            aria-label={t("allowanceName")}
            placeholder={t("allowanceName")}
            value={item.name}
            onChange={(event) => onChange(value.map((current, position) => (position === index ? { ...current, name: event.target.value } : current)))}
          />
          <input
            className={`o-nhap${errors[`allowances.${index}.amount`] ? " loi" : ""}`}
            aria-label={t("allowanceAmount")}
            placeholder={t("allowanceAmount")}
            inputMode="decimal"
            value={item.amount}
            onChange={(event) => onChange(value.map((current, position) => (position === index ? { ...current, amount: event.target.value } : current)))}
          />
          <button type="button" className="nut phu" onClick={() => onChange(value.filter((_, position) => position !== index))}>
            {t("removeAllowance")}
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="nut phu" onClick={() => onChange([...value, { name: "", amount: "" }])}>
          {t("addAllowance")}
        </button>
      </div>
    </div>
  );
}

function DrawerButtons({ submitting, label, onClose }: { submitting: boolean; label: string; onClose: () => void }) {
  const t = useTranslations("contracts");
  return (
    <div className="nhom-nut">
      <button type="button" className="nut phu" onClick={onClose}>
        {t("close")}
      </button>
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
        {label}
      </button>
    </div>
  );
}

// Xác nhận đã ký: ngày ký, tệp bản đã ký (bắt buộc).
export function SignDrawer<T>({ path, onClose, onDone }: { path: string; onClose: () => void; onDone: (result: T) => void }) {
  const t = useTranslations("contracts");
  const [signDate, setSignDate] = useState(vietnamToday());
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const form = new FormData();
      form.set("signDate", signDate);
      if (file) form.set("file", file);
      onDone(await apiUpload<T>(path, form));
    });
  }
  return (
    <Drawer title={t("signTitle")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="ngay-ky" label={`${t("signDate")} *`} error={fields.signDate}>
          <input id="ngay-ky" type="date" className={inputClass("signDate")} value={signDate} onChange={(event) => setSignDate(event.target.value)} />
        </Field>
        <Field id="ban-da-ky" label={`${t("signedFile")} *`} error={fields.file}>
          <input id="ban-da-ky" type="file" className={inputClass("file")} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <FormError text={formError} />
        <DrawerButtons submitting={submitting} label={t("sign")} onClose={onClose} />
      </form>
    </Drawer>
  );
}

export function CancelDrawer<T>({ path, onClose, onDone }: { path: string; onClose: () => void; onDone: (result: T) => void }) {
  const t = useTranslations("contracts");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => onDone(await apiFetch<T>(path, { method: "POST", body: JSON.stringify({ reason }) })));
  }
  return (
    <Drawer title={t("cancelTitle")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="ly-do-huy" label={`${t("cancelReason")} *`} error={fields.reason}>
          <textarea id="ly-do-huy" className={inputClass("reason")} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <DrawerButtons submitting={submitting} label={t("cancel")} onClose={onClose} />
      </form>
    </Drawer>
  );
}

// Chấm dứt hợp đồng hoặc nghỉ việc: ngày, lý do theo Bộ luật Lao động Điều 34, ghi chú.
export function TerminateDrawer<T>({
  path,
  title,
  warning,
  label,
  onClose,
  onDone,
}: {
  path: string;
  title: string;
  warning?: string;
  label: string;
  onClose: () => void;
  onDone: (result: T) => void;
}) {
  const t = useTranslations("contracts");
  const [terminationDate, setTerminationDate] = useState(vietnamToday());
  const [reason, setReason] = useState<TerminationReason>("mutual");
  const [note, setNote] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => onDone(await apiFetch<T>(path, { method: "POST", body: JSON.stringify({ terminationDate, reason, note }) })));
  }
  return (
    <Drawer title={title} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="ngay-cham-dut" label={`${t("terminationDate")} *`} error={fields.terminationDate}>
          <input id="ngay-cham-dut" type="date" className={inputClass("terminationDate")} value={terminationDate} onChange={(event) => setTerminationDate(event.target.value)} />
        </Field>
        <Field id="ly-do-cham-dut" label={t("terminationReason")} error={fields.reason}>
          <select id="ly-do-cham-dut" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value as TerminationReason)}>
            {terminationReasons.map((value) => (
              <option key={value} value={value}>
                {t(`reason_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ghi-chu-cham-dut" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu-cham-dut" className={inputClass("note")} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {warning && <div className="khoi-canh-bao canh-bao">{warning}</div>}
        <FormError text={formError} />
        <DrawerButtons submitting={submitting} label={label} onClose={onClose} />
      </form>
    </Drawer>
  );
}
