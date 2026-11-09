// Định dạng hiển thị: tiền theo tiếng Việt, giờ Việt Nam (tài liệu 15 mục định dạng số, ngày).
// Ngôn ngữ đang chọn (thẻ html lang do next-intl đặt): tiếng Anh dùng dấu phẩy hàng nghìn và mã tiền tệ VND thay "đ" (CHUC_NANG_22).
const isEnglish = () => typeof document !== "undefined" && document.documentElement.lang === "en";

export function formatNumber(value: string | number, maximumFractionDigits = 8): string {
  return new Intl.NumberFormat(isEnglish() ? "en-US" : "vi-VN", { maximumFractionDigits }).format(Number(value));
}

export function formatMoney(amount: string, currency: string): string {
  const text = formatNumber(amount, currency === "VND" ? 0 : 2);
  return currency === "VND" && !isEnglish() ? `${text} đ` : `${text} ${currency}`;
}

export function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";
}

export const formatDate = (value: string | null) => (value ? value.split("-").reverse().join("/") : "—");

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD (máy chủ kiểm ngày theo giờ Việt Nam).
export const vietnamToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
