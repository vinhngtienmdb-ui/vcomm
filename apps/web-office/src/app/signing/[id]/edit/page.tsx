"use client";

// MAN_HINH_211 Sửa phiên ký nháp (CHUC_NANG_211; API_243).
import type { SigningRequestResponse } from "contracts";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { SigningEditor } from "@/components/SigningEditor";

export default function EditSigningPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<SigningRequestResponse>(`/office/signing-requests/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(request) => <SigningEditor request={request} key={request.version} />}
    </Loaded>
  );
}
