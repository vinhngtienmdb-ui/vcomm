"use client";

// MAN_HINH_51 Lập phiếu kế toán.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAdmin } from "ui/components/AppShell";
import { JournalEditor } from "@/components/JournalEditor";

export default function NewJournalPage() {
  const t = useTranslations("ledger");
  const router = useRouter();
  const { notify } = useAdmin();
  return (
    <>
      <div className="tieu-de">
        <h1>{t("createJournal")}</h1>
      </div>
      <JournalEditor
        journal={null}
        onSaved={(saved) => {
          notify(t("journalSaved"));
          router.push(`/journals/${saved.id}`);
        }}
        onCancel={() => router.push("/journals")}
      />
    </>
  );
}
