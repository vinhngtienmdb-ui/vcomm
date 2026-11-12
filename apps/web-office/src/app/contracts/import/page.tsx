"use client";

// MAN_HINH_216 Nhập hợp đồng đã ký (CHUC_NANG_212; API_246; QUYTAC_NGHIEPVU_465).
import type { OfficeContractOptions } from "contracts";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { ContractEditor } from "@/components/ContractEditor";

export default function ImportContractPage() {
  const { state, reload } = useApi<OfficeContractOptions>("/office/contract-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(options) => <ContractEditor options={options} contract={null} mode="import" />}
    </Loaded>
  );
}
