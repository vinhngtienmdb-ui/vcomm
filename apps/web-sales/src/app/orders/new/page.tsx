"use client";

// MAN_HINH_43 Lập đơn bán (CHUC_NANG_54).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAdmin } from "ui/components/AppShell";
import { SalesOrderEditor } from "@/components/SalesOrderEditor";

export default function NewSalesOrderPage() {
  const t = useTranslations("salesOrders");
  const router = useRouter();
  const { notify } = useAdmin();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("add")}</h1>
      </div>
      <SalesOrderEditor
        order={null}
        onCancel={() => router.back()}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/orders/${saved.id}`);
        }}
      />
    </>
  );
}
