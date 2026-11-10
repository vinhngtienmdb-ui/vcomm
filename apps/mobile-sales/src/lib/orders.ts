// Dùng chung cho màn hình đơn bán của ứng dụng.
import type { SalesOrderStatus } from "contracts";

export const orderTone: Record<SalesOrderStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral",
  pending: "warning",
  confirmed: "info",
  rejected: "error",
  withdrawn: "neutral",
  delivered: "success",
  cancelled: "neutral",
  closed: "neutral",
  counterpart_pending: "warning",
};

// Ngày theo giờ Việt Nam (YYYY-MM-DD).
export const vietnamToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
export const displayDate = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
