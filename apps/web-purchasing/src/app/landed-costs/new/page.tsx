"use client";

// MAN_HINH_112 Lập chứng từ chi phí nhập khẩu (CHUC_NANG_161).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAdmin } from "ui/components/AppShell";
import { LandedCostEditor } from "@/components/LandedCostEditor";

export default function NewLandedCostPage() {
  const t = useTranslations("landedCosts");
  const router = useRouter();
  const { notify } = useAdmin();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("add")}</h1>
      </div>
      <LandedCostEditor
        cost={null}
        onCancel={() => router.back()}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/landed-costs/${saved.id}`);
        }}
      />
    </>
  );
}
