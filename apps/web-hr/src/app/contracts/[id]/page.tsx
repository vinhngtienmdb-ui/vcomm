"use client";

// MAN_HINH_118 Chi tiết hợp đồng, phụ lục (CHUC_NANG_163; API_147, API_148): giá trị gốc, hiện hành; gửi, rút, xác nhận ký, chấm dứt, hủy; phụ lục.
import type { AppendixResponse, ContractAllowance, ContractResponse, ContractTerms, EmployeeOptionsResponse, SalaryPaymentMethod, SaveAppendixRequest } from "contracts";
import { salaryPaymentMethods } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { AllowanceEditor, allowancePayload, AllowanceText, CancelDrawer, ContractStatusBadges, money, SignDrawer, TerminateDrawer } from "@/components/ContractParts";
import { ContractForm } from "@/components/ContractForm";

type Panel =
  | { kind: "edit" }
  | { kind: "sign" }
  | { kind: "cancel" }
  | { kind: "terminate" }
  | { kind: "appendix"; appendix: AppendixResponse | null }
  | { kind: "signAppendix" | "cancelAppendix"; appendix: AppendixResponse };

export default function ContractDetailPage() {
  const t = useTranslations("contracts");
  const { id } = useParams<{ id: string }>();
  const { notify } = useAdmin();
  const { state, reload } = useApi<ContractResponse>(`/hr/contracts/${id}`);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const done = (text: string) => {
    setPanel(null);
    notify(text);
    void reload();
  };
  const action = (path: string, text: string) => {
    setBusy(true);
    apiFetch(path, { method: "POST" })
      .then(() => done(text))
      .catch((error: unknown) => notify(failureOf(error).message, "loi"))
      .finally(() => setBusy(false));
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(contract) => {
        const editable = contract.canManage && ["draft", "rejected", "withdrawn"].includes(contract.status);
        const base = `/hr/contracts/${contract.id}`;
        if (panel?.kind === "edit")
          return (
            <>
              <div className="tieu-de">
                <h1>{t("editTitle")}</h1>
              </div>
              <ContractForm contract={contract} employeeId={contract.employeeId} onSaved={() => done(t("saved"))} onCancel={() => setPanel(null)} />
            </>
          );
        return (
          <>
            <div className="tieu-de">
              <h1>
                {contract.documentNo ?? t("status_draft")} · <Link href={`/employees/${contract.employeeId}`}>{contract.employeeName}</Link>
              </h1>
              {editable && (
                <>
                  <button type="button" className="nut phu" onClick={() => setPanel({ kind: "edit" })}>
                    {t("edit")}
                  </button>
                  <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => action(`${base}/submit`, t("submitted"))}>
                    {t("submit")}
                  </button>
                </>
              )}
              {contract.canWithdraw && (
                <button type="button" className="nut phu" disabled={busy} onClick={() => action(`${base}/withdraw`, t("withdrawn"))}>
                  {t("withdraw")}
                </button>
              )}
              {contract.canManage && contract.status === "approved" && (
                <button type="button" className="nut chinh" onClick={() => setPanel({ kind: "sign" })}>
                  {t("sign")}
                </button>
              )}
              {contract.canManage && contract.status === "signed" && contract.validity !== "expired" && (
                <button type="button" className="nut phu" onClick={() => setPanel({ kind: "appendix", appendix: null })}>
                  {t("addAppendix")}
                </button>
              )}
              {contract.canManage && contract.status === "signed" && (
                <button type="button" className="nut nguy-hiem" onClick={() => setPanel({ kind: "terminate" })}>
                  {t("terminate")}
                </button>
              )}
              {(editable || (contract.canManage && contract.status === "approved")) && (
                <button type="button" className="nut nguy-hiem" onClick={() => setPanel({ kind: "cancel" })}>
                  {t("cancel")}
                </button>
              )}
              <HistoryLink entityType="contract" entityId={contract.id} />
            </div>
            <ContractStatusBadges item={contract} />
            {contract.status === "approved" && <div className="khoi-canh-bao thong-tin">{t("signHint")}</div>}
            {contract.legalExceptionReason && (
              <div className="khoi-canh-bao canh-bao">
                {t("legalException")}: {contract.legalExceptionReason}
              </div>
            )}
            <div className="hai-cot">
              <TermsCard title={contract.appendices.some((item) => item.status === "signed") ? t("current") : t("original")} contract={contract} terms={contract.current} />
              <div className="the">
                <h2>{t("signing")}</h2>
                <dl className="thong-tin-dong">
                  <dt>{t("kind")}</dt>
                  <dd>
                    {t(`kind_${contract.kind}`)}
                    {contract.probationLevel ? ` · ${t(`level_${contract.probationLevel}`)}` : ""}
                  </dd>
                  <dt>{t("effectiveDate")}</dt>
                  <dd>
                    {formatDate(contract.effectiveDate)}
                    {contract.endDate ? ` – ${formatDate(contract.endDate)}` : ""}
                  </dd>
                  {contract.officialSalary && (
                    <>
                      <dt>{t("officialSalary")}</dt>
                      <dd>{money(contract.officialSalary, contract.currency)}</dd>
                    </>
                  )}
                  <dt>{t("signerName")}</dt>
                  <dd>
                    {contract.signerName} · {contract.signerTitle}
                  </dd>
                  <dt>{t("signDate")}</dt>
                  <dd>{formatDate(contract.signDate)}</dd>
                  <dt>{t("signedFileLabel")}</dt>
                  <dd>
                    {contract.hasSignedFile ? (
                      <button
                        type="button"
                        className="nut phu"
                        onClick={() => void apiDownload(`${base}/signed-file`, `${contract.documentNo}.pdf`).catch((error: unknown) => notify(failureOf(error).message, "loi"))}
                      >
                        {t("download")}
                      </button>
                    ) : (
                      "—"
                    )}
                  </dd>
                  {contract.terminationDate && (
                    <>
                      <dt>{t("terminationDate")}</dt>
                      <dd>
                        {formatDate(contract.terminationDate)} · {contract.terminationReason ? t(`reason_${contract.terminationReason}`) : ""}
                      </dd>
                    </>
                  )}
                  {contract.cancelReason && (
                    <>
                      <dt>{t("cancelReason")}</dt>
                      <dd>{cancelReasonText(t, contract.cancelReason)}</dd>
                    </>
                  )}
                  {contract.approvalRequestId && (
                    <>
                      <dt>{t("status")}</dt>
                      <dd>
                        <a href={`/hop-duyet/${contract.approvalRequestId}`}>{t("approvalLink")}</a>
                      </dd>
                    </>
                  )}
                </dl>
                {contract.otherTerms && <p style={{ margin: 0, whiteSpace: "pre-line" }}>{contract.otherTerms}</p>}
              </div>
            </div>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h2>{t("appendices")}</h2>
              {contract.appendices.length === 0 ? <MessageView text={t("noAppendices")} /> : <AppendixTable contract={contract} onAction={(next) => setPanel(next)} onDone={done} />}
            </div>
            {panel?.kind === "sign" && <SignDrawer<ContractResponse> path={`${base}/sign`} onClose={() => setPanel(null)} onDone={() => done(t("signedDone"))} />}
            {panel?.kind === "cancel" && <CancelDrawer<ContractResponse> path={`${base}/cancel`} onClose={() => setPanel(null)} onDone={() => done(t("cancelled"))} />}
            {panel?.kind === "terminate" && (
              <TerminateDrawer<ContractResponse> path={`${base}/terminate`} title={t("terminateTitle")} label={t("terminate")} onClose={() => setPanel(null)} onDone={() => done(t("terminated"))} />
            )}
            {panel?.kind === "appendix" && <AppendixDrawer contract={contract} appendix={panel.appendix} onClose={() => setPanel(null)} onDone={() => done(t("saved"))} />}
            {panel?.kind === "signAppendix" && (
              <SignDrawer<ContractResponse> path={`${base}/appendices/${panel.appendix.id}/sign`} onClose={() => setPanel(null)} onDone={() => done(t("signedDone"))} />
            )}
            {panel?.kind === "cancelAppendix" && (
              <CancelDrawer<ContractResponse> path={`${base}/appendices/${panel.appendix.id}/cancel`} onClose={() => setPanel(null)} onDone={() => done(t("cancelled"))} />
            )}
          </>
        );
      }}
    </Loaded>
  );
}

function cancelReasonText(t: ReturnType<typeof useTranslations<"contracts">>, reason: string): string {
  if (reason === "contract_terminated") return t("cancelReasonContractTerminated");
  if (reason === "employee_terminated") return t("cancelReasonEmployeeTerminated");
  return reason;
}

function TermsCard({ title, contract, terms }: { title: string; contract: ContractResponse; terms: ContractTerms }) {
  const t = useTranslations("contracts");
  return (
    <div className="the">
      <h2>{title}</h2>
      <dl className="thong-tin-dong">
        <dt>{t("jobTitle")}</dt>
        <dd>{terms.jobTitle}</dd>
        <dt>{t("department")}</dt>
        <dd>{terms.departmentName}</dd>
        <dt>{t("branch")}</dt>
        <dd>{terms.branchName}</dd>
        <dt>{t("salary")}</dt>
        <dd>{terms.salary === null ? <span className="chu-thich">{t("noSalaryPermission")}</span> : money(terms.salary, contract.currency)}</dd>
        <dt>{t("allowances")}</dt>
        <dd>
          <AllowanceText allowances={terms.allowances} currency={contract.currency} />
        </dd>
        <dt>{t("paymentMethod")}</dt>
        <dd>{t(`payment_${terms.paymentMethod}`)}</dd>
      </dl>
    </div>
  );
}

function AppendixTable({ contract, onAction, onDone }: { contract: ContractResponse; onAction: (panel: Panel) => void; onDone: (text: string) => void }) {
  const t = useTranslations("contracts");
  const { notify } = useAdmin();
  const base = `/hr/contracts/${contract.id}/appendices`;
  const post = (path: string, text: string) =>
    apiFetch(path, { method: "POST" })
      .then(() => onDone(text))
      .catch((error: unknown) => notify(failureOf(error).message, "loi"));
  const headings = [t("documentNo"), t("effectiveDate"), t("description"), t("status"), ""];
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
          {contract.appendices.map((appendix) => {
            const editable = contract.canManage && ["draft", "rejected", "withdrawn"].includes(appendix.status);
            const changes = [
              appendix.jobTitle && `${t("jobTitle")}: ${appendix.jobTitle}`,
              appendix.departmentName && `${t("department")}: ${appendix.departmentName}`,
              appendix.branchName && `${t("branch")}: ${appendix.branchName}`,
              appendix.salary && `${t("salary")}: ${money(appendix.salary, contract.currency)}`,
            ].filter(Boolean);
            return (
              <tr key={appendix.id}>
                <td data-nhan={headings[0]}>
                  <span>{appendix.documentNo ?? t("status_draft")}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{formatDate(appendix.effectiveDate)}</span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>
                    {appendix.description}
                    {changes.length > 0 && <span className="chu-thich"> · {changes.join(" · ")}</span>}
                  </span>
                </td>
                <td data-nhan={headings[3]}>
                  <span className="nhan trung-tinh">{t(`status_${appendix.status}`)}</span>
                </td>
                <td data-nhan="">
                  <span className="nhom-nut">
                    {editable && (
                      <>
                        <button type="button" className="nut phu" onClick={() => onAction({ kind: "appendix", appendix })}>
                          {t("edit")}
                        </button>
                        <button type="button" className="nut chinh" onClick={() => void post(`${base}/${appendix.id}/submit`, t("submitted"))}>
                          {t("submit")}
                        </button>
                      </>
                    )}
                    {appendix.canWithdraw && (
                      <button type="button" className="nut phu" onClick={() => void post(`${base}/${appendix.id}/withdraw`, t("withdrawn"))}>
                        {t("withdraw")}
                      </button>
                    )}
                    {contract.canManage && appendix.status === "approved" && (
                      <button type="button" className="nut chinh" onClick={() => onAction({ kind: "signAppendix", appendix })}>
                        {t("sign")}
                      </button>
                    )}
                    {(editable || (contract.canManage && appendix.status === "approved")) && (
                      <button type="button" className="nut nguy-hiem" onClick={() => onAction({ kind: "cancelAppendix", appendix })}>
                        {t("cancel")}
                      </button>
                    )}
                    {appendix.hasSignedFile && (
                      <button
                        type="button"
                        className="nut phu"
                        onClick={() => void apiDownload(`${base}/${appendix.id}/signed-file`, `${appendix.documentNo}.pdf`).catch((error: unknown) => notify(failureOf(error).message, "loi"))}
                      >
                        {t("download")}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AppendixDrawer({ contract, appendix, onClose, onDone }: { contract: ContractResponse; appendix: AppendixResponse | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("contracts");
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  const [effectiveDate, setEffectiveDate] = useState(appendix?.effectiveDate ?? "");
  const [jobTitle, setJobTitle] = useState(appendix?.jobTitle ?? "");
  const [departmentId, setDepartmentId] = useState(appendix?.departmentId ?? "");
  const [branchId, setBranchId] = useState(appendix?.branchId ?? "");
  const [salary, setSalary] = useState(appendix?.salary ?? "");
  const [paymentMethod, setPaymentMethod] = useState<SalaryPaymentMethod | "">(appendix?.paymentMethod ?? "");
  const [replace, setReplace] = useState(appendix?.allowances !== null && appendix?.allowances !== undefined);
  const [allowances, setAllowances] = useState<ContractAllowance[]>(appendix?.allowances ?? contract.current.allowances ?? []);
  const [description, setDescription] = useState(appendix?.description ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveAppendixRequest = {
        effectiveDate,
        jobTitle,
        departmentId: departmentId || null,
        branchId: branchId || null,
        salary: salary || null,
        paymentMethod: paymentMethod || null,
        allowances: replace ? allowancePayload(allowances) : null,
        description,
        ...(appendix ? { version: appendix.version } : {}),
      };
      const path = appendix ? `/hr/contracts/${contract.id}/appendices/${appendix.id}` : `/hr/contracts/${contract.id}/appendices`;
      await apiFetch(path, { method: appendix ? "PATCH" : "POST", body: JSON.stringify(body) });
      onDone();
    });
  }
  return (
    <Drawer title={t("appendixTitle")} onClose={onClose}>
      <Loaded state={options.state} onRetry={() => void options.reload()}>
        {(loaded) => (
          <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <div className="khoi-canh-bao thong-tin">{t("appendixHint")}</div>
            <Field id="pl-hieu-luc" label={`${t("effectiveDate")} *`} error={fields.effectiveDate}>
              <input id="pl-hieu-luc" type="date" className={inputClass("effectiveDate")} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
            </Field>
            <Field id="pl-luong" label={t("newSalary")} error={fields.salary}>
              <input id="pl-luong" inputMode="decimal" className={inputClass("salary")} value={salary} onChange={(event) => setSalary(event.target.value)} />
            </Field>
            <Field id="pl-chuc-danh" label={t("newJobTitle")} error={fields.jobTitle}>
              <input id="pl-chuc-danh" className={inputClass("jobTitle")} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
            </Field>
            <Field id="pl-phong-ban" label={t("department")} error={fields.departmentId}>
              <select id="pl-phong-ban" className={inputClass("departmentId")} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                <option value="">{t("noChange")}</option>
                {loaded.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="pl-chi-nhanh" label={t("branch")} error={fields.branchId}>
              <select id="pl-chi-nhanh" className={inputClass("branchId")} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                <option value="">{t("noChange")}</option>
                {loaded.branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="pl-tra-luong" label={t("paymentMethod")} error={fields.paymentMethod}>
              <select id="pl-tra-luong" className={inputClass("paymentMethod")} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as SalaryPaymentMethod | "")}>
                <option value="">{t("noChange")}</option>
                {salaryPaymentMethods.map((value) => (
                  <option key={value} value={value}>
                    {t(`payment_${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            <label>
              <input type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} /> {t("replaceAllowances")}
            </label>
            {replace && <AllowanceEditor value={allowances} onChange={setAllowances} errors={fields} />}
            <Field id="pl-mo-ta" label={`${t("description")} *`} error={fields.description}>
              <textarea id="pl-mo-ta" className={inputClass("description")} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <FormError text={formError} />
            <div className="nhom-nut">
              <button type="button" className="nut phu" onClick={onClose}>
                {t("close")}
              </button>
              <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
                {t("saveDraft")}
              </button>
            </div>
          </form>
        )}
      </Loaded>
    </Drawer>
  );
}
