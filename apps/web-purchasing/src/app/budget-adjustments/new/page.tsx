"use client";

// MAN_HINH_208 Lập phiếu điều chỉnh ngân sách (CHUC_NANG_208; API_237); ?planId= chọn sẵn kế hoạch.
import { useSearchParams } from "next/navigation";
import { AdjustmentEditor } from "@/components/AdjustmentEditor";

export default function NewBudgetAdjustmentPage() {
  const planId = useSearchParams().get("planId");
  return <AdjustmentEditor adjustment={null} initialPlanId={planId} />;
}
