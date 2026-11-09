"use client";

// NhanTrangThai của nhân viên (tài liệu 15).
import type { UserListItem } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<UserListItem["status"], string> = { active: "thanh-cong", invited: "thong-tin", locked: "loi", disabled: "trung-tinh" };

export function UserStatusBadge({ status }: { status: UserListItem["status"] }) {
  const t = useTranslations("users");
  return <span className={`nhan ${tone[status]}`}>{t(status)}</span>;
}
