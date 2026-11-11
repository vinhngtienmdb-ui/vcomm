"use client";

// Nhãn trạng thái tờ khai, chứng từ chi phí nhập khẩu (CONG_VIEC_45).
import type { ImportDeclarationStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<ImportDeclarationStatus, string> = { draft: "trung-tinh", posted: "thanh-cong", cancelled: "loi" };

export function DeclarationStatus({ status }: { status: ImportDeclarationStatus }) {
  const t = useTranslations("importDeclarations");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
