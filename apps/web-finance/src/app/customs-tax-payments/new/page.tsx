"use client";

// MAN_HINH_185, 187 Lập phiếu nộp thuế, nhận hoàn thuế hải quan (CONG_VIEC_56); mở sẵn tờ khai, loại phiếu (?declarationId=&kind=). Chi tiết, gửi ở trang phiếu thu chi.
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAdmin } from "ui/components/AppShell";
import { LoadingView } from "ui/components/StatusViews";
import { CustomsTaxPaymentEditor } from "@/components/CustomsTaxPaymentEditor";

export default function NewCustomsTaxPaymentPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <NewCustomsTaxPayment />
    </Suspense>
  );
}

function NewCustomsTaxPayment() {
  const t = useTranslations("payments");
  const router = useRouter();
  const { notify } = useAdmin();
  const parameters = useSearchParams();
  const kind = parameters.get("kind") === "customs_tax_refund" ? "customs_tax_refund" : "customs_tax_payment";
  return (
    <>
      <div className="tieu-de">
        <h1>{kind === "customs_tax_refund" ? t("customsRefundTitle") : t("customsTaxTitle")}</h1>
      </div>
      <CustomsTaxPaymentEditor
        payment={null}
        kind={kind}
        initialDeclarationId={parameters.get("declarationId")}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/payments/${saved.id}`);
        }}
        onCancel={() => router.push("/payments")}
      />
    </>
  );
}
