"use client";

// Vào mini app Mua hàng: mở mục menu đầu tiên có quyền.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdmin } from "ui/components/AppShell";
import { LoadingView, MessageView } from "ui/components/StatusViews";
import { purchasingMenu } from "@/components/PurchasingShell";

export default function PurchasingHome() {
  const t = useTranslations("common");
  const router = useRouter();
  const { can } = useAdmin();
  const first = purchasingMenu.find((item) => can(item.permission));
  useEffect(() => {
    if (first) router.replace(first.href);
  }, [first, router]);
  return first ? <LoadingView /> : <MessageView text={t("forbidden")} />;
}
