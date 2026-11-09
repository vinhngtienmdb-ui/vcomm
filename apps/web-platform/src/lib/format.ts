// Định dạng hiển thị: tiền theo tiếng Việt, giờ Việt Nam (tài liệu 15 mục định dạng số, ngày).
export function formatMoney(amount: string, currency: string): string {
  const number = Number(amount);
  const text = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(number);
  return currency === "VND" ? `${text} đ` : `${text} ${currency}`;
}

export function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }) : "—";
}

export const formatDate = (value: string | null) => (value ? value.split("-").reverse().join("/") : "—");
