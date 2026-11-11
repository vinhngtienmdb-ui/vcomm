"use client";

// MAN_HINH_45: lập chương trình khuyến mãi.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAdmin } from "ui/components/AppShell";
import { PromotionEditor } from "@/components/PromotionEditor";

export default function NewPromotionPage() {
  const t = useTranslations("promotions");
  const router = useRouter();
  const { notify } = useAdmin();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("create")}</h1>
      </div>
      <PromotionEditor
        promotion={null}
        onCancel={() => router.push("/promotions")}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/promotions/${saved.id}`);
        }}
      />
    </>
  );
}
