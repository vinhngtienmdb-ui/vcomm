"use client";

// MAN_HINH_216 Lập, sửa, nhập hợp đồng đã ký (CHUC_NANG_212; QUYTAC_NGHIEPVU_463, 465).
import type { OfficeContractOptions, OfficeContractPartnerItem, OfficeContractResponse, OfficePerson } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiUpload } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { PersonPicker } from "@/components/PersonPicker";
import { PartnerPicker } from "@/components/ContractParts";

export function ContractEditor({ options, contract, mode }: { options: OfficeContractOptions; contract: OfficeContractResponse | null; mode: "create" | "import" | "edit" }) {
  const t = useTranslations("officeContracts");
  const { notify } = useAdmin();
  const router = useRouter();
  const [typeId, setTypeId] = useState(contract?.typeId ?? options.types[0]?.id ?? "");
  const [name, setName] = useState(contract?.name ?? "");
  const [contractNo, setContractNo] = useState(contract?.contractNo ?? "");
  const [partners, setPartners] = useState<OfficeContractPartnerItem[]>(contract?.partnerItems ?? []);
  const [value, setValue] = useState(contract?.value ?? "");
  const [currency, setCurrency] = useState(contract?.currency ?? "VND");
  const [effectiveFrom, setEffectiveFrom] = useState(contract?.effectiveFrom ?? vietnamToday());
  const [expiresOn, setExpiresOn] = useState(contract?.expiresOn ?? "");
  const [signedOn, setSignedOn] = useState(vietnamToday());
  const [owner, setOwner] = useState<OfficePerson[]>(contract ? [contract.owner] : []);
  const [departmentId, setDepartmentId] = useState(contract?.departmentId ?? "");
  const [confidential, setConfidential] = useState(contract?.confidential ?? false);
  const [description, setDescription] = useState(contract?.description ?? "");
  const [reminders, setReminders] = useState((contract?.reminderDays ?? [30, 7]).join(", "));
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const direction = options.types.find((type) => type.id === typeId)?.direction ?? "none";

  const save = () =>
    run(async () => {
      const data = {
        typeId,
        name,
        contractNo: contractNo.trim() || null,
        partnerIds: partners.map((partner) => partner.id),
        value: direction === "none" || !value ? null : value.replace(/[.\s]/g, "").replace(",", "."),
        currency,
        effectiveFrom,
        expiresOn: expiresOn || null,
        ownerUserId: owner[0]?.id ?? null,
        departmentId: departmentId || null,
        confidential,
        description: description.trim() || null,
        reminderDays: reminders
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map(Number),
        ...(mode === "import" ? { signedOn } : {}),
        ...(contract ? { version: contract.version } : {}),
      };
      const form = new FormData();
      form.append("data", JSON.stringify(data));
      if (file) form.append("file", file);
      const path = mode === "import" ? "/office/contracts/import" : contract ? `/office/contracts/${contract.id}` : "/office/contracts";
      const saved = await apiUpload<OfficeContractResponse & { duplicateNo: boolean }>(path, form);
      notify(saved.duplicateNo ? t("savedDuplicateNo") : t("saved"));
      router.push(`/contracts/${saved.id}`);
    });

  return (
    <>
      <div className="tieu-de">
        <h1>{mode === "import" ? t("importTitle") : contract ? t("editTitle", { code: contract.contractCode }) : t("createTitle")}</h1>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={() => router.back()}>
            {t("back")}
          </button>
          <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save()}>
            {mode === "import" ? t("importAction") : t("saveDraft")}
          </button>
        </div>
      </div>
      {mode === "import" && <div className="khoi-canh-bao thong-tin">{t("importHint")}</div>}
      <FormError text={formError} />
      <div className="the">
        <div className="hai-cot">
          <Field id="loai-hd" label={t("type")} error={fields.typeId}>
            <select id="loai-hd" className={inputClass("typeId")} value={typeId} onChange={(event) => setTypeId(event.target.value)}>
              {options.types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="so-hd" label={t("contractNo")} error={fields.contractNo} hint={t("contractNoHint")}>
            <input id="so-hd" className={inputClass("contractNo")} maxLength={100} value={contractNo} onChange={(event) => setContractNo(event.target.value)} />
          </Field>
        </div>
        <Field id="ten-hd" label={t("name")} error={fields.name}>
          <input id="ten-hd" className={inputClass("name")} maxLength={300} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="doi-tac-hd" label={t("partners")} error={fields.partnerIds}>
          <PartnerPicker id="doi-tac-hd" value={partners} onChange={setPartners} invalid={!!fields.partnerIds} />
        </Field>
        {direction !== "none" && (
          <div className="hai-cot">
            <Field id="gia-tri-hd" label={t("value")} error={fields.value}>
              <input id="gia-tri-hd" className={inputClass("value")} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
            </Field>
            <Field id="tien-te-hd" label={t("currency")} error={fields.currency}>
              <select id="tien-te-hd" className={inputClass("currency")} value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {options.currencies.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="hai-cot">
          <Field id="hieu-luc-hd" label={t("effectiveFrom")} error={fields.effectiveFrom}>
            <input id="hieu-luc-hd" type="date" className={inputClass("effectiveFrom")} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
          </Field>
          <Field id="het-han-hd" label={t("expiresOn")} error={fields.expiresOn} hint={t("expiresHint")}>
            <input id="het-han-hd" type="date" className={inputClass("expiresOn")} value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
          </Field>
        </div>
        {mode === "import" && (
          <Field id="ngay-ky-hd" label={t("signedOn")} error={fields.signedOn}>
            <input id="ngay-ky-hd" type="date" className={inputClass("signedOn")} value={signedOn} onChange={(event) => setSignedOn(event.target.value)} />
          </Field>
        )}
        <div className="hai-cot">
          <Field id="phu-trach-hd" label={t("owner")} error={fields.ownerUserId} hint={t("ownerHint")}>
            <PersonPicker id="phu-trach-hd" value={owner} multiple={false} onChange={setOwner} />
          </Field>
          <Field id="phong-ban-hd" label={t("department")} error={fields.departmentId}>
            <select id="phong-ban-hd" className={inputClass("departmentId")} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">{t("noDepartment")}</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="hai-cot">
          <Field id="mat-hd" label={t("confidential")} hint={t("confidentialHint")}>
            <select id="mat-hd" className="o-nhap" value={confidential ? "yes" : "no"} onChange={(event) => setConfidential(event.target.value === "yes")}>
              <option value="no">{t("confidentialNo")}</option>
              <option value="yes">{t("confidentialYes")}</option>
            </select>
          </Field>
          <Field id="nhac-hd" label={t("reminderDays")} error={fields.reminderDays} hint={t("reminderHint")}>
            <input id="nhac-hd" className={inputClass("reminderDays")} value={reminders} onChange={(event) => setReminders(event.target.value)} />
          </Field>
        </div>
        <Field id="mo-ta-hd" label={t("description")} error={fields.description}>
          <textarea id="mo-ta-hd" className={inputClass("description")} rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field id="tep-hd" label={mode === "import" ? t("signedFile") : t("contentFile")} error={fields.file} hint={mode === "import" ? t("signedFileHint") : t("contentFileHint")}>
          <input
            id="tep-hd"
            type="file"
            accept={mode === "import" ? undefined : ".pdf,application/pdf"}
            className={inputClass("file")}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </>
  );
}
