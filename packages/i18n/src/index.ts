// Tệp dịch dùng chung cho giao diện và thông báo lỗi của API (tài liệu 18 mục 3).
import en from "./en.json";
import vi from "./vi.json";

export type Locale = "vi" | "en";
export type Messages = typeof vi;
export const messages: Record<Locale, Messages> = { vi, en };

export function resolveLocale(value: string | undefined | null): Locale {
  return value?.toLowerCase().startsWith("en") ? "en" : "vi";
}
