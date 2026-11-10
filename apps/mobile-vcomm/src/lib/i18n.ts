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

// Ngày theo giờ Việt Nam, dạng 10/11/2026.
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}
