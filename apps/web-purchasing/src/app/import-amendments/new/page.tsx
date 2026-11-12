"use client";

// MAN_HINH_186 Lập tờ khai bổ sung (CONG_VIEC_56; CHUC_NANG_199): mở từ chi tiết tờ khai gốc đã ghi sổ.
import type { ImportAmendmentBase } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { AmendmentEditor } from "@/components/AmendmentEditor";

export default function NewImportAmendmentPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <NewAmendment />
    </Suspense>
  );
}

function NewAmendment() {
  const t = useTranslations("importAmendments");
  const router = useRouter();
  const { notify } = useAdmin();
  const declarationId = useSearchParams().get("declarationId");
  const { state, reload } = useApi<ImportAmendmentBase>(declarationId ? `/purchasing/import-amendments/current?declarationId=${declarationId}` : null);
  if (!declarationId) return <MessageView text={t("notPosted")} />;
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(base) => (
        <>
          <Link href={`/import-declarations/${base.declarationId}`}>‹ {t("back", { number: base.declarationNo })}</Link>
          <div className="tieu-de">
            <h1>{t("newHeading", { number: base.declarationNo })}</h1>
          </div>
          {base.status !== "posted" ? (
            <MessageView text={t("notPosted")} />
          ) : (
            <AmendmentEditor
              base={base}
              amendment={null}
              onCancel={() => router.push(`/import-declarations/${base.declarationId}`)}
              onSaved={(saved) => {
                notify(t("saved"));
                router.push(`/import-amendments/${saved.id}`);
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
