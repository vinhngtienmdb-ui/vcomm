"use client";

// Trang đầu cổng cửa hàng: chuyển vào quầy tích đổi điểm (MAN_HINH_174).
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PortalHome() {
  const router = useRouter();
  useEffect(() => router.replace("/counter"), [router]);
  return null;
}
