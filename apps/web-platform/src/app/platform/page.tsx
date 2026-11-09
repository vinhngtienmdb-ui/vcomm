"use client";

// Vào mini app Quản trị hệ thống: mở mục menu đầu tiên có quyền.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { adminMenu, useAdmin } from "@/components/AdminShell";
import { LoadingView, MessageView } from "@/components/StatusViews";

export default function PlatformHome() {
  const t = useTranslations("common");
  const router = useRouter();
  const { can } = useAdmin();
  const first = adminMenu.find((item) => can(item.permission));
  useEffect(() => {
    if (first) router.replace(first.href);
  }, [first, router]);
  return first ? <LoadingView /> : <MessageView text={t("forbidden")} />;
}
