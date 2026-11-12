"use client";

// MAN_HINH_216 Sửa hợp đồng khi nháp, bị từ chối, đã rút (CHUC_NANG_212; API_246).
import type { OfficeContractOptions, OfficeContractResponse } from "contracts";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { ContractEditor } from "@/components/ContractEditor";

export default function EditContractPage() {
  const { id } = useParams<{ id: string }>();
  const options = useApi<OfficeContractOptions>("/office/contract-options");
  const contract = useApi<OfficeContractResponse>(`/office/contracts/${id}`);
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(data) => (
        <Loaded state={contract.state} onRetry={() => void contract.reload()}>
          {(item) => <ContractEditor options={data} contract={item} mode="edit" key={item.version} />}
        </Loaded>
      )}
    </Loaded>
  );
}
