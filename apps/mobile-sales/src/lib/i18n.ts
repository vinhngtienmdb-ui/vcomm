// Câu chữ lấy từ packages/i18n (dùng chung với web); thay tham số dạng {ten}.
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

export function errorText(key: string): string {
  const table = messages[locale].errors as Record<string, string>;
  return table[key] ?? key;
}

export function money(amount: string | number, currency = "VND"): string {
  const value = Number(amount);
  return `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(value)} ${currency === "VND" ? "đ" : currency}`;
}
