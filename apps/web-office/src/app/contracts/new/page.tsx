"use client";

// MAN_HINH_216 Lập hợp đồng (CHUC_NANG_212; API_246).
import type { OfficeContractOptions } from "contracts";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { ContractEditor } from "@/components/ContractEditor";

export default function NewContractPage() {
  const { state, reload } = useApi<OfficeContractOptions>("/office/contract-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(options) => <ContractEditor options={options} contract={null} mode="create" />}
    </Loaded>
  );
}
