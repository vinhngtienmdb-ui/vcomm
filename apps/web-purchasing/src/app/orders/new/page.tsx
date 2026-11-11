"use client";

// MAN_HINH_40 Lập đơn mua (CHUC_NANG_51): trực tiếp hoặc từ đề nghị mua đã duyệt (?requisitionId=).
import type { RequisitionResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, LoadingView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { OrderEditor } from "@/components/OrderEditor";

export default function NewOrderPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <NewOrder />
    </Suspense>
  );
}

function NewOrder() {
  const t = useTranslations("orders");
  const router = useRouter();
  const { notify } = useAdmin();
  const requisitionId = useSearchParams().get("requisitionId");
  const requisition = useApi<RequisitionResponse>(requisitionId ? `/purchasing/requisitions/${requisitionId}` : null);
  const editor = (source: RequisitionResponse | null) => (
    <OrderEditor
      order={null}
      requisition={source}
      onCancel={() => router.back()}
      onSaved={(saved) => {
        notify(t("saved"));
        router.push(`/orders/${saved.id}`);
      }}
    />
  );
  return (
    <>
      <div className="tieu-de">
        <h1>{t("add")}</h1>
      </div>
      {requisitionId ? (
        <Loaded state={requisition.state} onRetry={() => void requisition.reload()}>
          {(source) => editor(source)}
        </Loaded>
      ) : (
        editor(null)
      )}
    </>
  );
}
