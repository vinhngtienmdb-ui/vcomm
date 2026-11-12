"use client";

// Phần dùng chung của kho hợp đồng (CONG_VIEC_59 lát L2): nhãn trạng thái, nhãn hiệu lực, chọn đối tác.
import type { OfficeContractPartnerItem, OfficeContractStatus, OfficeContractValidity } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { apiFetch } from "ui/lib/api";

const statusTone: Record<OfficeContractStatus | "awaiting_signature", string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  rejected: "loi",
  withdrawn: "trung-tinh",
  awaiting_signature: "thong-tin",
  signed: "thanh-cong",
  liquidated: "trung-tinh",
  terminated: "trung-tinh",
  cancelled: "trung-tinh",
};
const validityTone: Record<OfficeContractValidity, string> = { not_effective: "thong-tin", active: "thanh-cong", expiring: "canh-bao", expired: "loi" };

export function ContractStatusBadge({ status }: { status: OfficeContractStatus }) {
  const t = useTranslations("officeContracts");
  return <span className={`nhan ${statusTone[status]}`}>{t(`status_${status}`)}</span>;
}

export function ValidityBadge({ validity }: { validity: OfficeContractValidity | null }) {
  const t = useTranslations("officeContracts");
  if (!validity) return null;
  return <span className={`nhan ${validityTone[validity]}`}>{t(`validity_${validity}`)}</span>;
}

// Chọn đối tác từ danh sách đối tác dùng chung (gõ tên, mã số thuế).
export function PartnerPicker({ id, value, onChange, invalid }: { id: string; value: OfficeContractPartnerItem[]; onChange: (partners: OfficeContractPartnerItem[]) => void; invalid?: boolean }) {
  const t = useTranslations("officeContracts");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<OfficeContractPartnerItem[]>([]);
  useEffect(() => {
    if (text.trim().length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<OfficeContractPartnerItem[]>(`/office/contract-partners?search=${encodeURIComponent(text.trim())}`)
        .then(setOptions)
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);
  return (
    <div>
      <div className="nhom-nut" style={{ flexWrap: "wrap" }}>
        {value.map((partner) => (
          <span key={partner.id} className="nhan thong-tin">
            {partner.name}
            {partner.taxCode && ` · ${partner.taxCode}`}{" "}
            <button type="button" className="nut phu" aria-label={t("removePartner", { name: partner.name })} onClick={() => onChange(value.filter((item) => item.id !== partner.id))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input id={id} className={`o-nhap${invalid ? " loi" : ""}`} placeholder={t("partnerSearchHint")} value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" />
      {options.length > 0 && (
        <ul className="the" style={{ listStyle: "none", margin: 0, padding: "var(--khoang-2)" }}>
          {options
            .filter((option) => !value.some((item) => item.id === option.id))
            .map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="nut phu"
                  style={{ width: "100%", justifyContent: "flex-start" }}
                  onClick={() => {
                    onChange([...value, option]);
                    setText("");
                    setOptions([]);
                  }}
                >
                  {option.name}
                  {option.taxCode && ` · ${option.taxCode}`}
                </button>
              </li>
            ))}
        </ul>
      )}
      <span className="chu-thich">{t("partnerPickerHint")}</span>
    </div>
  );
}
