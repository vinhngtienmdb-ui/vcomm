// Câu chữ lấy từ packages/i18n (nhóm iposApp, dùng chung bản tiếng Việt, tiếng Anh với web); thay tham số dạng {ten}.
import { messages, type Locale } from "i18n";

let locale: Locale = "vi";
export const setLocale = (value: Locale) => {
  locale = value;
};

export function t(key: string, values?: Record<string, string | number>): string {
  const table = messages[locale].iposApp as Record<string, string>;
  const text = table[key] ?? (messages.vi.iposApp as Record<string, string>)[key] ?? key;
  return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match)) : text;
}
