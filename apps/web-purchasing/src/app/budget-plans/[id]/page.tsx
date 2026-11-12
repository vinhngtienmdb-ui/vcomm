"use client";

// MAN_HINH_205 Chi tiết, sửa kế hoạch ngân sách mua (CHUC_NANG_207; API_235, API_236).
import type { BudgetPlanResponse } from "contracts";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { BudgetEditor } from "@/components/BudgetEditor";

export default function BudgetPlanPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<BudgetPlanResponse>(`/purchasing/budget-plans/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(plan) => <BudgetEditor key={plan.version} plan={plan} onChanged={reload} />}
    </Loaded>
  );
}
