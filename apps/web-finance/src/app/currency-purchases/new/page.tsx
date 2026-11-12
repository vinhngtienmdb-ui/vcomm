"use client";

// MAN_HINH_184 Lập phiếu mua ngoại tệ (CONG_VIEC_56; QUYTAC_NGHIEPVU_408). Chi tiết, gửi, rút dùng trang phiếu thu chi.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAdmin } from "ui/components/AppShell";
import { CurrencyPurchaseEditor } from "@/components/CurrencyPurchaseEditor";

export default function NewCurrencyPurchasePage() {
  const t = useTranslations("payments");
  const router = useRouter();
  const { notify } = useAdmin();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("currencyPurchaseTitle")}</h1>
      </div>
      <CurrencyPurchaseEditor
        payment={null}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/payments/${saved.id}`);
        }}
        onCancel={() => router.push("/payments")}
      />
    </>
  );
}
