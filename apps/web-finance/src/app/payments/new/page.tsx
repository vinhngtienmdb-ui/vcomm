"use client";

// MAN_HINH_49 Lập phiếu thu, phiếu chi; mở sẵn loại, đối tác từ chi tiết công nợ (?kind=&partnerId=).
import { paymentKinds, type DebtPartnerResponse, type PaymentKind, paymentKindSide } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAdmin } from "ui/components/AppShell";
import { LoadingView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { PaymentEditor } from "@/components/PaymentEditor";

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <NewPayment />
    </Suspense>
  );
}

function NewPayment() {
  const t = useTranslations("payments");
  const router = useRouter();
  const { notify } = useAdmin();
  const parameters = useSearchParams();
  const requested = parameters.get("kind");
  const kind: PaymentKind = paymentKinds.includes(requested as PaymentKind) ? (requested as PaymentKind) : "customer_receipt";
  const partnerId = parameters.get("partnerId");
  const partner = useApi<DebtPartnerResponse>(partnerId ? `/finance/debts/partners/${partnerId}?side=${paymentKindSide[kind]}` : null);
  if (partnerId && partner.state.kind === "loading") return <LoadingView />;
  const initialPartner = partner.state.kind === "ready" ? { id: partner.state.data.partner.id, label: `${partner.state.data.partner.code} · ${partner.state.data.partner.name}` } : null;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("create")}</h1>
      </div>
      <PaymentEditor
        payment={null}
        initialKind={kind}
        initialPartner={initialPartner}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/payments/${saved.id}`);
        }}
        onCancel={() => router.push("/payments")}
      />
    </>
  );
}
