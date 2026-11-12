"use client";

// Điều khoản hợp đồng đối tác liên minh điểm dùng chung cho MAN_HINH_258 thêm mới và MAN_HINH_259 chi tiết (CONG_VIEC_65; QUYTAC_NGHIEPVU_538, 540).
import type { PartnerContractDetail, PartnerContractStatus, PartnerDirection, PartnerLimit } from "contracts";
import { useTranslations } from "next-intl";
import { Field } from "ui/components/Form";
import { vietnamToday } from "ui/lib/format";

export const partnerStatusClass: Record<PartnerContractStatus, string> = { draft: "trung-tinh", active: "thanh-cong", suspended: "canh-bao", terminated: "loi" };
export const partnerDirections: PartnerDirection[] = ["outbound", "inbound", "gift"];
const limitKeys = ["minPoints", "maxPoints", "customerDailyPoints", "customerMonthlyPoints", "partnerMonthlyPoints"] as const;
type LimitForm = Record<(typeof limitKeys)[number], string>;

const emptyLimit = (): LimitForm => ({ minPoints: "", maxPoints: "", customerDailyPoints: "", customerMonthlyPoints: "", partnerMonthlyPoints: "" });

export const defaultPartnerForm = () => ({
  programName: "",
  unitNameVi: "",
  unitNameEn: "",
  contractNo: "",
  effectiveFrom: vietnamToday(),
  effectiveTo: "",
  outboundEnabled: true,
  inboundEnabled: true,
  giftEnabled: false,
  paymentMode: "prepaid" as "prepaid" | "postpaid",
  creditLimit: "",
  paymentTermDays: "15",
  taxPercent: "10",
  memberPattern: "^[A-Za-z0-9]{6,20}$",
  limits: { outbound: emptyLimit(), inbound: emptyLimit(), gift: emptyLimit() } as Record<PartnerDirection, LimitForm>,
});
export type PartnerForm = ReturnType<typeof defaultPartnerForm>;

const limitFormOf = (limit: PartnerLimit): LimitForm => Object.fromEntries(limitKeys.map((key) => [key, limit[key] === null ? "" : String(limit[key])])) as LimitForm;

export const partnerFormOf = (contract: PartnerContractDetail): PartnerForm => ({
  programName: contract.programName,
  unitNameVi: contract.unitNameVi,
  unitNameEn: contract.unitNameEn,
  contractNo: contract.contractNo,
  effectiveFrom: contract.effectiveFrom,
  effectiveTo: contract.effectiveTo ?? "",
  outboundEnabled: contract.outboundEnabled,
  inboundEnabled: contract.inboundEnabled,
  giftEnabled: contract.giftEnabled,
  paymentMode: contract.paymentMode,
  creditLimit: contract.creditLimit ?? "",
  paymentTermDays: String(contract.paymentTermDays),
  taxPercent: contract.taxPercent,
  memberPattern: contract.memberPattern,
  limits: { outbound: limitFormOf(contract.limits.outbound), inbound: limitFormOf(contract.limits.inbound), gift: limitFormOf(contract.limits.gift) },
});

const whole = (value: string) => (value.trim() === "" ? null : Number(value.replace(/[.\s]/g, "")));

export const partnerBody = (form: PartnerForm) => ({
  programName: form.programName,
  unitNameVi: form.unitNameVi,
  unitNameEn: form.unitNameEn,
  contractNo: form.contractNo,
  effectiveFrom: form.effectiveFrom,
  effectiveTo: form.effectiveTo || null,
  outboundEnabled: form.outboundEnabled,
  inboundEnabled: form.inboundEnabled,
  giftEnabled: form.giftEnabled,
  paymentMode: form.paymentMode,
  creditLimit: form.paymentMode === "postpaid" ? form.creditLimit.replace(/[.\s]/g, "") : null,
  paymentTermDays: Number(form.paymentTermDays),
  taxPercent: form.taxPercent,
  connector: "simulator",
  memberPattern: form.memberPattern,
  limits: Object.fromEntries(partnerDirections.map((direction) => [direction, Object.fromEntries(limitKeys.map((key) => [key, whole(form.limits[direction][key])]))])),
});

export function PartnerTermsFields({
  form,
  setForm,
  fields,
  inputClass,
  disabled,
}: {
  form: PartnerForm;
  setForm: (form: PartnerForm) => void;
  fields: Record<string, string>;
  inputClass: (key: string) => string;
  disabled?: boolean;
}) {
  const t = useTranslations("loyaltyPartner");
  const input = (
    key: "programName" | "unitNameVi" | "unitNameEn" | "contractNo" | "effectiveFrom" | "effectiveTo" | "creditLimit" | "paymentTermDays" | "taxPercent" | "memberPattern",
    type = "text",
  ) => (
    <Field id={`lm-${key}`} label={t(`term_${key}`)} error={fields[key]}>
      <input id={`lm-${key}`} type={type} className={inputClass(key)} value={form[key]} disabled={disabled} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
    </Field>
  );
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" }}>
        {input("programName")}
        {input("unitNameVi")}
        {input("unitNameEn")}
        {input("contractNo")}
        {input("effectiveFrom", "date")}
        {input("effectiveTo", "date")}
        <Field id="lm-paymentMode" label={t("term_paymentMode")} error={fields.paymentMode}>
          <select
            id="lm-paymentMode"
            className={inputClass("paymentMode")}
            value={form.paymentMode}
            disabled={disabled}
            onChange={(event) => setForm({ ...form, paymentMode: event.target.value as "prepaid" | "postpaid" })}
          >
            <option value="prepaid">{t("paymentMode_prepaid")}</option>
            <option value="postpaid">{t("paymentMode_postpaid")}</option>
          </select>
        </Field>
        {form.paymentMode === "postpaid" && input("creditLimit")}
        {input("paymentTermDays", "number")}
        {input("taxPercent")}
        {input("memberPattern")}
        <Field id="lm-connector" label={t("term_connector")}>
          <select id="lm-connector" className="o-nhap" value="simulator" disabled>
            <option value="simulator">{t("connector_simulator")}</option>
          </select>
        </Field>
      </div>
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)" }}>
        <legend className="chu-thich">{t("term_directions")}</legend>
        {partnerDirections.map((direction) => (
          <label key={direction} style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
            <input type="checkbox" checked={form[`${direction}Enabled`]} disabled={disabled} onChange={(event) => setForm({ ...form, [`${direction}Enabled`]: event.target.checked })} />
            {t(`direction_${direction}`)}
          </label>
        ))}
        {fields.outboundEnabled && <span className="loi-o">{fields.outboundEnabled}</span>}
      </fieldset>
      <h3>{t("limitsTitle")}</h3>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("direction")}</th>
              {limitKeys.map((key) => (
                <th key={key}>{t(`limit_${key}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partnerDirections.map((direction) => (
              <tr key={direction}>
                <td data-nhan={t("direction")}>{t(`direction_${direction}`)}</td>
                {limitKeys.map((key) => {
                  // Tặng không dùng tối thiểu, mỗi ngày; tối đa là mỗi lần tặng (QUYTAC_NGHIEPVU_540).
                  const unused = direction === "gift" && (key === "minPoints" || key === "customerDailyPoints");
                  return (
                    <td key={key} data-nhan={t(`limit_${key}`)}>
                      {unused ? (
                        "—"
                      ) : (
                        <input
                          aria-label={`${t(`direction_${direction}`)} · ${t(`limit_${key}`)}`}
                          className={inputClass(`limits.${direction}.${key}`)}
                          inputMode="numeric"
                          value={form.limits[direction][key]}
                          disabled={disabled}
                          onChange={(event) => setForm({ ...form, limits: { ...form.limits, [direction]: { ...form.limits[direction], [key]: event.target.value } } })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chu-thich">{t("limitsHint")}</p>
    </>
  );
}
