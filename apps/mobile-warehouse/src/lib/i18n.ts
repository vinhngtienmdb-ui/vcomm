// Câu chữ lấy từ packages/i18n (nhóm warehouseApp, dùng chung với web); thay tham số dạng {ten}.
import { messages, type Locale } from "i18n";

let locale: Locale = "vi";
export const setLocale = (value: Locale) => {
  locale = value;
};

type Namespace = keyof (typeof messages)["vi"];

export function translator<N extends Namespace>(namespace: N) {
  return (key: string, values?: Record<string, string | number>): string => {
    const table = messages[locale][namespace] as Record<string, string>;
    const text = table[key] ?? (messages.vi[namespace] as Record<string, string>)[key] ?? key;
    return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match)) : text;
  };
}

export const t = translator("warehouseApp");

// Số lượng bỏ số 0 thừa, dạng 1.234,5.
export function quantity(value: string | number): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: 4 }).format(Number(value));
}

// Ngày dạng 10/11/2026 từ chuỗi YYYY-MM-DD.
export function shortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
