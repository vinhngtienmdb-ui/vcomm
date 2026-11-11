"use client";

// Vào mini app Nhân sự: mở mục menu đầu tiên có quyền.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdmin } from "ui/components/AppShell";
import { LoadingView } from "ui/components/StatusViews";
import { hrMenu } from "@/components/HrShell";

export default function HrHome() {
  const router = useRouter();
  const { can } = useAdmin();
  const first = hrMenu.find((item) => can(item.permission)) ?? hrMenu[hrMenu.length - 1]!;
  useEffect(() => {
    router.replace(first.href);
  }, [first, router]);
  return <LoadingView />;
}
