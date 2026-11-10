"use client";

// MAN_HINH_65 Phiếu giao khách – lập mới (CHUC_NANG_97; API_110).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAdmin } from "ui/components/AppShell";
import { AssignmentForm } from "@/components/AssignmentForm";

export default function NewCustomerAssignmentPage() {
  const t = useTranslations("customerAssignments");
  const router = useRouter();
  const { notify } = useAdmin();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("create")}</h1>
      </div>
      <AssignmentForm
        current={null}
        onCancel={() => router.push("/customer-assignments")}
        onSaved={(saved) => {
          notify(t("saved"));
          router.push(`/customer-assignments/${saved.id}`);
        }}
      />
    </>
  );
}
