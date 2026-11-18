"use client";

// Bộ lọc khoảng ngày, điểm bán dùng chung cho trang ca, hóa đơn, báo cáo iPOS (tối đa 366 ngày, QUYTAC_NGHIEPVU_625).
import type { IposPortalOutlet } from "contracts";
import { useTranslations } from "next-intl";
import { Field } from "ui/components/Form";

export interface IposPeriodValue {
  from: string;
  to: string;
  outletId: string;
}

export const vietnamToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
export const daysAgo = (days: number) => new Date(Date.now() + 7 * 3_600_000 - days * 86_400_000).toISOString().slice(0, 10);
export const periodQuery = (value: IposPeriodValue, extra: Record<string, string> = {}) =>
  new URLSearchParams({ from: value.from, to: value.to, ...(value.outletId ? { outletId: value.outletId } : {}), ...extra }).toString();

export function IposPeriod({ value, outlets, onChange, children }: { value: IposPeriodValue; outlets: IposPortalOutlet[]; onChange: (value: IposPeriodValue) => void; children?: React.ReactNode }) {
  const t = useTranslations("iposPortal");
  return (
    <div className="bo-loc">
      <Field id="ky-tu" label={t("from")}>
        <input id="ky-tu" type="date" className="o-nhap" value={value.from} max={value.to} onChange={(event) => onChange({ ...value, from: event.target.value })} />
      </Field>
      <Field id="ky-den" label={t("to")}>
        <input id="ky-den" type="date" className="o-nhap" value={value.to} min={value.from} onChange={(event) => onChange({ ...value, to: event.target.value })} />
      </Field>
      <Field id="ky-diem-ban" label={t("outlet")}>
        <select id="ky-diem-ban" className="o-nhap" value={value.outletId} onChange={(event) => onChange({ ...value, outletId: event.target.value })}>
          <option value="">{t("allOutlets")}</option>
          {outlets.map((outlet) => (
            <option key={outlet.outletId} value={outlet.outletId}>
              {outlet.outletName}
            </option>
          ))}
        </select>
      </Field>
      {children}
    </div>
  );
}
