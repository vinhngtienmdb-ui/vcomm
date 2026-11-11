"use client";

// MAN_HINH_171 chi tiết tin, nộp hồ sơ không đăng nhập (CHUC_NANG_190; API_204; QUYTAC_NGHIEPVU_382): hai ô đồng ý riêng, không đánh sẵn.
import type { CareersApplyResponse, CareersPostingResponse } from "contracts";
import { candidateEducationLevels } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiUpload } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { CareersFrame, salaryText } from "@/components/CareersFrame";

export default function CareersPostingPage() {
  const t = useTranslations("careers");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<CareersPostingResponse>(`/careers/postings/${id}?locale=${locale}`);
  const [step, setStep] = useState<"detail" | "apply">("detail");
  const [result, setResult] = useState<CareersApplyResponse | null>(null);
  return (
    <CareersFrame>
      <p>
        <Link href="/careers">‹ {t("allPostings")}</Link>
      </p>
      <Loaded state={state} onRetry={() => void reload()}>
        {(posting) =>
          result ? (
            <div className="the" style={{ textAlign: "center", display: "grid", gap: "var(--khoang-3)" }}>
              <h1>{t("receivedTitle")}</h1>
              <p>{t("receivedReference", { reference: result.reference })}</p>
              <p>{t("receivedText", { email: result.contactEmail })}</p>
              <p>
                <Link href="/careers">{t("otherPostings")}</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="tieu-de">
                <h1>{posting.title}</h1>
                {step === "detail" && (
                  <button type="button" className="nut chinh" onClick={() => setStep("apply")}>
                    {t("apply")}
                  </button>
                )}
              </div>
              <div className="the">
                <dl className="thong-tin-dong">
                  <dt>{t("company")}</dt>
                  <dd>{posting.companyName}</dd>
                  <dt>{t("location")}</dt>
                  <dd>{posting.location}</dd>
                  <dt>{t("workType")}</dt>
                  <dd>{t(`workType_${posting.workType}`)}</dd>
                  <dt>{t("salary")}</dt>
                  <dd>{salaryText(posting, t("negotiable"), t("currencyUnit"))}</dd>
                  <dt>{t("deadline")}</dt>
                  <dd>{formatDate(posting.deadline)}</dd>
                  <dt>{t("contact")}</dt>
                  <dd>{posting.contactEmail}</dd>
                </dl>
              </div>
              {step === "detail" ? (
                <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                  <h2>{t("description")}</h2>
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{posting.description}</p>
                  {posting.requirements && (
                    <>
                      <h2>{t("requirements")}</h2>
                      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{posting.requirements}</p>
                    </>
                  )}
                  {posting.benefits && (
                    <>
                      <h2>{t("benefits")}</h2>
                      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{posting.benefits}</p>
                    </>
                  )}
                </div>
              ) : (
                <ApplyForm posting={posting} locale={locale === "en" ? "en" : "vi"} onCancel={() => setStep("detail")} onDone={setResult} />
              )}
            </>
          )
        }
      </Loaded>
    </CareersFrame>
  );
}

function ApplyForm({ posting, locale, onCancel, onDone }: { posting: CareersPostingResponse; locale: "vi" | "en"; onCancel: () => void; onDone: (result: CareersApplyResponse) => void }) {
  const t = useTranslations("careers");
  const candidateText = useTranslations("candidates");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState({ fullName: "", email: "", phone: "", province: "", educationLevel: "", experienceYears: "", expectedSalary: "", coverLetter: "" });
  const [consents, setConsents] = useState({ recruitment: false, talentPool: false });
  const [resume, setResume] = useState<File | undefined>();
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const form = new FormData();
      form.set(
        "data",
        JSON.stringify({
          ...values,
          educationLevel: values.educationLevel || null,
          experienceYears: values.experienceYears === "" ? null : Number(values.experienceYears),
          locale,
          termsVersion: posting.terms.version,
          recruitmentConsent: consents.recruitment,
          talentPoolConsent: consents.talentPool,
        }),
      );
      if (resume) form.set("resume", resume);
      onDone(await apiUpload<CareersApplyResponse>(`/careers/postings/${posting.id}/applications`, form));
    });
  };
  return (
    <form className="the" onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
      <h2>{t("applyTitle")}</h2>
      <FormError text={formError} />
      <div className="hai-cot">
        <Field id="nop-ten" label={t("fullName")} error={fields.fullName}>
          <input id="nop-ten" className={inputClass("fullName")} value={values.fullName} onChange={set("fullName")} maxLength={200} autoComplete="name" />
        </Field>
        <Field id="nop-email" label={t("email")} error={fields.email}>
          <input id="nop-email" type="email" className={inputClass("email")} value={values.email} onChange={set("email")} autoComplete="email" />
        </Field>
        <Field id="nop-dt" label={t("phone")} error={fields.phone}>
          <input id="nop-dt" type="tel" className={inputClass("phone")} value={values.phone} onChange={set("phone")} autoComplete="tel" />
        </Field>
        <Field id="nop-tinh" label={t("province")} error={fields.province}>
          <input id="nop-tinh" className={inputClass("province")} value={values.province} onChange={set("province")} maxLength={100} />
        </Field>
        <Field id="nop-trinh-do" label={t("educationLevel")} error={fields.educationLevel}>
          <select id="nop-trinh-do" className={inputClass("educationLevel")} value={values.educationLevel} onChange={set("educationLevel")}>
            <option value="">{candidateText("notSelected")}</option>
            {candidateEducationLevels.map((level) => (
              <option key={level} value={level}>
                {candidateText(`education_${level}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nop-kinh-nghiem" label={t("experienceYears")} error={fields.experienceYears}>
          <input id="nop-kinh-nghiem" type="number" min={0} max={50} className={inputClass("experienceYears")} value={values.experienceYears} onChange={set("experienceYears")} />
        </Field>
        <Field id="nop-luong" label={t("expectedSalary")} error={fields.expectedSalary}>
          <input id="nop-luong" inputMode="numeric" className={inputClass("expectedSalary")} value={values.expectedSalary} onChange={set("expectedSalary")} />
        </Field>
      </div>
      <Field id="nop-thu" label={t("coverLetter")} error={fields.coverLetter}>
        <textarea id="nop-thu" rows={4} className={inputClass("coverLetter")} value={values.coverLetter} onChange={set("coverLetter")} maxLength={2000} />
      </Field>
      <Field id="nop-cv" label={t("resume")} error={fields.resume}>
        <input id="nop-cv" type="file" className={inputClass("resume")} accept=".pdf,.docx" onChange={(event) => setResume(event.target.files?.[0])} />
      </Field>
      <div className="truong">
        <label>
          <input type="checkbox" checked={consents.recruitment} onChange={(event) => setConsents({ ...consents, recruitment: event.target.checked })} aria-describedby="dk-tuyen-dung" />{" "}
          <span id="dk-tuyen-dung">{posting.terms.recruitment}</span> <strong>{t("requiredMark")}</strong>
        </label>
        {fields.recruitmentConsent && <span className="loi-o">{fields.recruitmentConsent}</span>}
      </div>
      <div className="truong">
        <label>
          <input type="checkbox" checked={consents.talentPool} onChange={(event) => setConsents({ ...consents, talentPool: event.target.checked })} /> {posting.terms.talentPool}{" "}
          <span className="chu-thich">{t("optionalMark")}</span>
        </label>
      </div>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("back")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("submit")}
        </button>
      </div>
    </form>
  );
}
