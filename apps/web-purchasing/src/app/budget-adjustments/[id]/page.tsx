"use client";

// MAN_HINH_208 Chi tiết, sửa phiếu điều chỉnh ngân sách (CHUC_NANG_208; API_237, API_238).
import type { BudgetAdjustmentResponse } from "contracts";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { AdjustmentEditor } from "@/components/AdjustmentEditor";

export default function BudgetAdjustmentPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<BudgetAdjustmentResponse>(`/purchasing/budget-adjustments/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(adjustment) => <AdjustmentEditor key={adjustment.version} adjustment={adjustment} initialPlanId={null} onChanged={reload} />}
    </Loaded>
  );
}
