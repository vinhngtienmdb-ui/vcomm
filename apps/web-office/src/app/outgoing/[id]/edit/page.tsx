"use client";

// MAN_HINH_158 Sửa công văn đi khi còn nháp, bị từ chối hoặc đã rút.
import type { DocumentOptions, OutgoingResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { OutgoingEditor } from "@/components/OutgoingEditor";

export default function EditOutgoingPage() {
  const t = useTranslations("officeDocuments");
  const { id } = useParams<{ id: string }>();
  const outgoing = useApi<OutgoingResponse>(`/office/outgoing/${id}`);
  const options = useApi<DocumentOptions>("/office/document-options");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("editOutgoing")}</h1>
      </div>
      <Loaded state={outgoing.state} onRetry={() => void outgoing.reload()}>
        {(document) => (
          <Loaded state={options.state} onRetry={() => void options.reload()}>
            {(data) => <OutgoingEditor options={data} outgoing={document} key={document.version} />}
          </Loaded>
        )}
      </Loaded>
    </>
  );
}
