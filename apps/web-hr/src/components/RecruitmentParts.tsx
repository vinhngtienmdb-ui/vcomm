"use client";

// Thành phần dùng chung của tuyển dụng (CONG_VIEC_54): bảng, phân trang, nhãn giai đoạn, biểu mẫu nhu cầu, tin, ứng viên.
import type { ApplicationItem, ApplicationStage, JobPostingResponse, RecruitmentOptionsResponse, RecruitmentRequestResponse, SaveJobPostingRequest, SaveRecruitmentRequestRequest } from "contracts";
import { candidateEducationLevels, recruitmentContractKinds, recruitmentReasons, salaryDisplays, workTypes } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, type ReactNode, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";

export function Table({ headings, rows }: { headings: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={index} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={index} data-nhan={headings[index] ?? ""}>
                  <span>{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pageSize, total, label, onPage }: { page: number; pageSize: number; total: number; label: string; onPage: (page: number) => void }) {
  return (
    <div className="phan-trang">
      <span>{label}</span>
      <span className="nhom-nut">
        <button type="button" className="nut phu" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="‹">
          ‹
        </button>
        <span>{page}</span>
        <button type="button" className="nut phu" disabled={page * pageSize >= total} onClick={() => onPage(page + 1)} aria-label="›">
          ›
        </button>
      </span>
    </div>
  );
}

export const money = (value: string | null) => (value === null ? "—" : `${formatNumber(value, 0)} đ`);
export const salaryRange = (minimum: string | null, maximum: string | null) => (minimum && maximum ? `${formatNumber(minimum, 0)} – ${formatNumber(maximum, 0)} đ` : "—");

const stageClass: Record<ApplicationStage, string> = { new: "thong-tin", screening: "thong-tin", interview: "canh-bao", offer: "canh-bao", hired: "thanh-cong" };
export function StageBadge({ application }: { application: Pick<ApplicationItem, "stage" | "outcome"> }) {
  const t = useTranslations("candidates");
  if (application.outcome) return <span className="nhan trung-tinh">{t(`outcome_${application.outcome}`)}</span>;
  return <span className={`nhan ${stageClass[application.stage]}`}>{t(`stage_${application.stage}`)}</span>;
}

export const requestStatusClass: Record<string, string> = {
  draft: "trung-tinh",
  pending: "thong-tin",
  approved: "thanh-cong",
  rejected: "loi",
  withdrawn: "trung-tinh",
  cancelled: "trung-tinh",
  completed: "thanh-cong",
  closed: "trung-tinh",
};
export const postingStatusClass: Record<string, string> = { draft: "trung-tinh", open: "thanh-cong", closed: "trung-tinh" };

// Biểu mẫu nhu cầu tuyển dụng (MAN_HINH_168; QUYTAC_NGHIEPVU_380).
export function RequestForm({
  options,
  current,
  onClose,
  onSaved,
}: {
  options: RecruitmentOptionsResponse;
  current: RecruitmentRequestResponse | null;
  onClose: () => void;
  onSaved: (saved: RecruitmentRequestResponse) => void;
}) {
  const t = useTranslations("recruitment");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState<SaveRecruitmentRequestRequest>(
    current
      ? {
          departmentId: current.departmentId,
          branchId: current.branchId,
          jobTitle: current.jobTitle,
          headcount: current.headcount,
          contractKind: current.contractKind,
          salaryMin: current.salaryMin,
          salaryMax: current.salaryMax,
          neededBy: current.neededBy,
          reason: current.reason,
          description: current.description,
          version: current.version,
        }
      : {
          departmentId: options.departments[0]?.id ?? "",
          branchId: options.branches[0]?.id ?? "",
          jobTitle: "",
          headcount: 1,
          contractKind: "probation_then_official",
          salaryMin: "",
          salaryMax: "",
          neededBy: vietnamToday(),
          reason: "expansion",
          description: "",
        },
  );
  const set = (key: keyof SaveRecruitmentRequestRequest) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const body = { ...values, headcount: Number(values.headcount) };
      const saved = current
        ? await apiFetch<RecruitmentRequestResponse>(`/hr/recruitment-requests/${current.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch<RecruitmentRequestResponse>("/hr/recruitment-requests", { method: "POST", body: JSON.stringify(body) });
      notify(t("saved"));
      onSaved(saved);
    });
  };
  return (
    <Drawer title={current ? t("editRequest") : t("createRequest")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="nc-phong-ban" label={t("department")} error={fields.departmentId}>
          <select id="nc-phong-ban" className={inputClass("departmentId")} value={values.departmentId} onChange={set("departmentId")}>
            {options.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nc-chi-nhanh" label={t("branch")} error={fields.branchId}>
          <select id="nc-chi-nhanh" className={inputClass("branchId")} value={values.branchId} onChange={set("branchId")}>
            {options.branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nc-chuc-danh" label={t("jobTitle")} error={fields.jobTitle}>
          <input id="nc-chuc-danh" className={inputClass("jobTitle")} value={values.jobTitle} onChange={set("jobTitle")} maxLength={100} />
        </Field>
        <Field id="nc-so-luong" label={t("headcount")} error={fields.headcount}>
          <input id="nc-so-luong" type="number" min={1} max={100} className={inputClass("headcount")} value={String(values.headcount)} onChange={set("headcount")} />
        </Field>
        <Field id="nc-hop-dong" label={t("contractKind")} error={fields.contractKind}>
          <select id="nc-hop-dong" className={inputClass("contractKind")} value={values.contractKind} onChange={set("contractKind")}>
            {recruitmentContractKinds.map((kind) => (
              <option key={kind} value={kind}>
                {t(`contractKind_${kind}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nc-luong-min" label={t("salaryMin")} error={fields.salaryMin}>
          <input id="nc-luong-min" inputMode="numeric" className={inputClass("salaryMin")} value={String(values.salaryMin)} onChange={set("salaryMin")} />
        </Field>
        <Field id="nc-luong-max" label={t("salaryMax")} error={fields.salaryMax}>
          <input id="nc-luong-max" inputMode="numeric" className={inputClass("salaryMax")} value={String(values.salaryMax)} onChange={set("salaryMax")} />
        </Field>
        <Field id="nc-ngay" label={t("neededBy")} error={fields.neededBy}>
          <input id="nc-ngay" type="date" className={inputClass("neededBy")} value={values.neededBy} onChange={set("neededBy")} />
        </Field>
        <Field id="nc-ly-do" label={t("reason")} error={fields.reason}>
          <select id="nc-ly-do" className={inputClass("reason")} value={values.reason} onChange={set("reason")}>
            {recruitmentReasons.map((reason) => (
              <option key={reason} value={reason}>
                {t(`reason_${reason}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nc-mo-ta" label={t("description")} error={fields.description}>
          <textarea id="nc-mo-ta" rows={3} className={inputClass("description")} value={values.description ?? ""} onChange={set("description")} maxLength={4000} />
        </Field>
        <div className="khoi-canh-bao thong-tin">{t("approvalHint")}</div>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("saveDraft")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Biểu mẫu tin tuyển dụng (MAN_HINH_169; QUYTAC_NGHIEPVU_381).
export function PostingForm({
  options,
  requestId,
  current,
  onClose,
  onSaved,
}: {
  options: RecruitmentOptionsResponse;
  requestId: string;
  current: JobPostingResponse | null;
  onClose: () => void;
  onSaved: (saved: JobPostingResponse) => void;
}) {
  const t = useTranslations("recruitment");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const request = options.approvedRequests.find((item) => item.id === requestId);
  const [values, setValues] = useState<SaveJobPostingRequest>(
    current
      ? {
          requestId,
          title: current.title,
          location: current.location,
          workType: current.workType,
          description: current.description,
          requirements: current.requirements,
          benefits: current.benefits,
          salaryDisplay: current.salaryDisplay,
          salaryMin: current.salaryMin,
          salaryMax: current.salaryMax,
          deadline: current.deadline,
          contactEmail: current.contactEmail,
          isPublic: current.isPublic,
          version: current.version,
        }
      : {
          requestId,
          title: request?.jobTitle ?? "",
          location: "",
          workType: "full_time",
          description: "",
          requirements: "",
          benefits: "",
          salaryDisplay: "request_range",
          salaryMin: "",
          salaryMax: "",
          deadline: vietnamToday(),
          contactEmail: "",
          isPublic: true,
        },
  );
  const set = (key: keyof SaveJobPostingRequest) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const saved = current
        ? await apiFetch<JobPostingResponse>(`/hr/job-postings/${current.id}`, { method: "PATCH", body: JSON.stringify(values) })
        : await apiFetch<JobPostingResponse>("/hr/job-postings", { method: "POST", body: JSON.stringify(values) });
      notify(t("saved"));
      onSaved(saved);
    });
  };
  const rangeText = current ? salaryRange(current.requestSalaryMin, current.requestSalaryMax) : request ? salaryRange(request.salaryMin, request.salaryMax) : "—";
  return (
    <Drawer title={current ? t("editPosting") : t("createPosting")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="tin-tieu-de" label={t("postingTitle")} error={fields.title}>
          <input id="tin-tieu-de" className={inputClass("title")} value={values.title} onChange={set("title")} maxLength={150} />
        </Field>
        <Field id="tin-noi" label={t("location")} error={fields.location}>
          <input id="tin-noi" className={inputClass("location")} value={values.location} onChange={set("location")} maxLength={100} />
        </Field>
        <Field id="tin-hinh-thuc" label={t("workType")} error={fields.workType}>
          <select id="tin-hinh-thuc" className={inputClass("workType")} value={values.workType} onChange={set("workType")}>
            {workTypes.map((type) => (
              <option key={type} value={type}>
                {t(`workType_${type}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="tin-mo-ta" label={t("postingDescription")} error={fields.description}>
          <textarea id="tin-mo-ta" rows={4} className={inputClass("description")} value={values.description} onChange={set("description")} maxLength={8000} />
        </Field>
        <Field id="tin-yeu-cau" label={t("requirements")} error={fields.requirements}>
          <textarea id="tin-yeu-cau" rows={3} className={inputClass("requirements")} value={values.requirements ?? ""} onChange={set("requirements")} maxLength={8000} />
        </Field>
        <Field id="tin-quyen-loi" label={t("benefits")} error={fields.benefits}>
          <textarea id="tin-quyen-loi" rows={3} className={inputClass("benefits")} value={values.benefits ?? ""} onChange={set("benefits")} maxLength={8000} />
        </Field>
        <Field id="tin-luong" label={t("salaryDisplay")} error={fields.salaryDisplay} hint={t("requestRange", { range: rangeText })}>
          <select id="tin-luong" className={inputClass("salaryDisplay")} value={values.salaryDisplay} onChange={set("salaryDisplay")}>
            {salaryDisplays.map((display) => (
              <option key={display} value={display}>
                {t(`salaryDisplay_${display}`)}
              </option>
            ))}
          </select>
        </Field>
        {values.salaryDisplay === "custom_range" && (
          <>
            <Field id="tin-luong-min" label={t("salaryMin")} error={fields.salaryMin}>
              <input id="tin-luong-min" inputMode="numeric" className={inputClass("salaryMin")} value={String(values.salaryMin ?? "")} onChange={set("salaryMin")} />
            </Field>
            <Field id="tin-luong-max" label={t("salaryMax")} error={fields.salaryMax}>
              <input id="tin-luong-max" inputMode="numeric" className={inputClass("salaryMax")} value={String(values.salaryMax ?? "")} onChange={set("salaryMax")} />
            </Field>
          </>
        )}
        <Field id="tin-han" label={t("deadline")} error={fields.deadline}>
          <input id="tin-han" type="date" className={inputClass("deadline")} value={values.deadline} onChange={set("deadline")} />
        </Field>
        <Field id="tin-email" label={t("contactEmail")} error={fields.contactEmail} hint={t("contactEmailHint")}>
          <input id="tin-email" type="email" className={inputClass("contactEmail")} value={values.contactEmail} onChange={set("contactEmail")} />
        </Field>
        <div className="truong">
          <label>
            <input type="checkbox" checked={values.isPublic ?? true} onChange={(event) => setValues({ ...values, isPublic: event.target.checked })} /> {t("isPublic")}
          </label>
        </div>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Nhân sự nhập tay ứng viên kèm bằng chứng đồng ý (MAN_HINH_169, 170; QUYTAC_NGHIEPVU_383).
export function CandidateForm({
  options,
  postingId,
  onClose,
  onSaved,
}: {
  options: RecruitmentOptionsResponse;
  postingId: string | null;
  onClose: () => void;
  onSaved: (candidateId: string) => void;
}) {
  const t = useTranslations("candidates");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState({
    postingId: postingId ?? options.openPostings[0]?.id ?? "",
    fullName: "",
    email: "",
    phone: "",
    province: "",
    educationLevel: "",
    experienceYears: "",
    expectedSalary: "",
    coverLetter: "",
    source: "referral",
    sourceNote: "",
    consentDate: vietnamToday(),
    poolConsentDate: "",
  });
  const [files, setFiles] = useState<{ resume?: File; consentEvidence?: File; poolEvidence?: File }>({});
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const file = (key: keyof typeof files) => (event: { target: { files: FileList | null } }) => setFiles({ ...files, [key]: event.target.files?.[0] });
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
          poolConsentDate: values.poolConsentDate || null,
        }),
      );
      for (const [key, value] of Object.entries(files)) if (value) form.set(key, value);
      const saved = await apiUpload<{ id: string }>("/hr/candidates", form);
      notify(t("created"));
      onSaved(saved.id);
    });
  };
  return (
    <Drawer title={t("create")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="uv-tin" label={t("posting")} error={fields.postingId}>
          <select id="uv-tin" className={inputClass("postingId")} value={values.postingId} onChange={set("postingId")} disabled={postingId !== null}>
            {options.openPostings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="uv-ten" label={t("fullName")} error={fields.fullName}>
          <input id="uv-ten" className={inputClass("fullName")} value={values.fullName} onChange={set("fullName")} maxLength={200} />
        </Field>
        <Field id="uv-email" label={t("email")} error={fields.email}>
          <input id="uv-email" type="email" className={inputClass("email")} value={values.email} onChange={set("email")} />
        </Field>
        <Field id="uv-dt" label={t("phone")} error={fields.phone}>
          <input id="uv-dt" type="tel" className={inputClass("phone")} value={values.phone} onChange={set("phone")} />
        </Field>
        <Field id="uv-tinh" label={t("province")} error={fields.province}>
          <input id="uv-tinh" className={inputClass("province")} value={values.province} onChange={set("province")} maxLength={100} />
        </Field>
        <Field id="uv-trinh-do" label={t("educationLevel")} error={fields.educationLevel}>
          <select id="uv-trinh-do" className={inputClass("educationLevel")} value={values.educationLevel} onChange={set("educationLevel")}>
            <option value="">{t("notSelected")}</option>
            {candidateEducationLevels.map((level) => (
              <option key={level} value={level}>
                {t(`education_${level}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="uv-kinh-nghiem" label={t("experienceYears")} error={fields.experienceYears}>
          <input id="uv-kinh-nghiem" type="number" min={0} max={50} className={inputClass("experienceYears")} value={values.experienceYears} onChange={set("experienceYears")} />
        </Field>
        <Field id="uv-nguon" label={t("source")} error={fields.source}>
          <select id="uv-nguon" className={inputClass("source")} value={values.source} onChange={set("source")}>
            {(["referral", "job_board", "email", "other"] as const).map((source) => (
              <option key={source} value={source}>
                {t(`source_${source}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="uv-ghi-chu" label={t("sourceNote")} error={fields.sourceNote}>
          <input id="uv-ghi-chu" className={inputClass("sourceNote")} value={values.sourceNote} onChange={set("sourceNote")} maxLength={200} />
        </Field>
        <Field id="uv-cv" label={t("resumeFile")} error={fields.resume}>
          <input id="uv-cv" type="file" className={inputClass("resume")} accept=".pdf,.docx" onChange={file("resume")} />
        </Field>
        <Field id="uv-dong-y" label={t("consentEvidence")} error={fields.consentEvidence} hint={t("consentEvidenceHint")}>
          <input id="uv-dong-y" type="file" className={inputClass("consentEvidence")} accept=".pdf,.jpg,.jpeg,.png" onChange={file("consentEvidence")} />
        </Field>
        <Field id="uv-ngay-dong-y" label={t("consentDate")} error={fields.consentDate}>
          <input id="uv-ngay-dong-y" type="date" className={inputClass("consentDate")} value={values.consentDate} onChange={set("consentDate")} />
        </Field>
        <Field id="uv-ngay-kho" label={t("poolConsentDate")} error={fields.poolConsentDate} hint={t("poolConsentHint")}>
          <input id="uv-ngay-kho" type="date" className={inputClass("poolConsentDate")} value={values.poolConsentDate} onChange={set("poolConsentDate")} />
        </Field>
        {values.poolConsentDate && (
          <Field id="uv-bang-chung-kho" label={t("poolEvidence")} error={fields.poolEvidence}>
            <input id="uv-bang-chung-kho" type="file" className={inputClass("poolEvidence")} accept=".pdf,.jpg,.jpeg,.png" onChange={file("poolEvidence")} />
          </Field>
        )}
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function CandidateLink({ id, name }: { id: string; name: string }) {
  return <Link href={`/candidates/${id}`}>{name}</Link>;
}
