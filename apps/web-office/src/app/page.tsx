"use client";

// Vào mini app Văn phòng số: mở mục menu đầu tiên có quyền.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdmin } from "ui/components/AppShell";
import { LoadingView, MessageView } from "ui/components/StatusViews";
import { officeMenu } from "@/components/OfficeShell";

export default function OfficeHome() {
  const t = useTranslations("common");
  const router = useRouter();
  const { can } = useAdmin();
  const first = officeMenu.find((item) => can(item.permission));
  useEffect(() => {
    if (first) router.replace(first.href);
  }, [first, router]);
  return first ? <LoadingView /> : <MessageView text={t("forbidden")} />;
}
