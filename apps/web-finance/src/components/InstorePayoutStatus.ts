// Nhãn, màu trạng thái bảng chuyển tiền thu hộ (CONG_VIEC_73; MAN_HINH_281).
import type { InstorePayoutItem } from "contracts";

export const payoutStatusClass = (item: Pick<InstorePayoutItem, "status" | "overdue" | "amount">) =>
  item.status === "transferred" ? "thanh-cong" : item.overdue ? "loi" : "canh-bao";

export function payoutStatusLabel(t: (key: string) => string, item: Pick<InstorePayoutItem, "status" | "overdue" | "amount" | "transferredOn">) {
  if (item.status === "transferred" && Number(item.amount) === 0) return t("statusNothing");
  if (item.status === "transferred") return t("statusTransferred");
  return item.overdue ? t("statusOverdue") : t("statusPending");
}
