"use client";

// MAN_HINH_158 Soạn công văn đi mới; tham số replyTo gắn với công văn đến được trả lời.
import type { DocumentOptions } from "contracts";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { OutgoingEditor } from "@/components/OutgoingEditor";

export default function NewOutgoingPage() {
  return (
    <Suspense>
      <NewOutgoing />
    </Suspense>
  );
}

function NewOutgoing() {
  const t = useTranslations("officeDocuments");
  const replyTo = useSearchParams().get("replyTo");
  const options = useApi<DocumentOptions>("/office/document-options");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("compose")}</h1>
      </div>
      <Loaded state={options.state} onRetry={() => void options.reload()}>
        {(data) => <OutgoingEditor options={data} outgoing={null} replyToIncomingId={replyTo} />}
      </Loaded>
    </>
  );
}
