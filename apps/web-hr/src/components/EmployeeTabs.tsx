"use client";

// Các thẻ của MAN_HINH_116: Giấy tờ (API_145), Người phụ thuộc, Quá trình công tác (API_146).
import type { DependentItem, DependentRelationship, EmployeeDocumentItem, EmployeeDocumentKind, EmployeeOptionsResponse, EmployeeResponse, WorkEventItem } from "contracts";
import { dependentRelationships, employeeDocumentKinds } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;

function Table({ headings, rows }: { headings: string[]; rows: { key: string; cells: React.ReactNode[] }[] }) {
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

export function DocumentsTab({ employee, onChanged }: { employee: EmployeeResponse; onChanged: () => void }) {
  const t = useTranslations("hr");
  const { can, notify } = useAdmin();
  const { state, reload } = useApi<EmployeeDocumentItem[]>(`/hr/employees/${employee.id}/documents`);
  const [uploading, setUploading] = useState(false);
  const canUpload = can("hr.employee.manage");
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("documents")}</h2>
        {canUpload && (
          <button type="button" className="nut phu" onClick={() => setUploading(true)}>
            {t("upload")}
          </button>
        )}
      </div>
      {employee.consentDate && <div className="khoi-canh-bao thong-tin">{t("consentRecorded", { date: formatDate(employee.consentDate) })}</div>}
      {employee.missingConsent && <div className="khoi-canh-bao canh-bao">{t("missingConsentWarning")}</div>}
      <Loaded state={state} onRetry={() => void reload()}>
        {(documents) =>
          documents.length === 0 ? (
            <MessageView text={t("noDocuments")} />
          ) : (
            <Table
              headings={[t("documentKind"), t("fileName"), t("size"), t("uploaded"), ""]}
              rows={documents.map((document) => ({
                key: document.id,
                cells: [
                  t(`document_${document.kind}`),
                  document.fileName,
                  formatSize(document.sizeBytes),
                  `${formatDateTime(document.uploadedAt)} · ${document.uploadedByName}`,
                  employee.canViewIdentity ? (
                    <button
                      type="button"
                      className="nut phu"
                      onClick={() => void apiDownload(`/hr/documents/${document.id}`, document.fileName).catch((error: unknown) => notify(failureOf(error).message, "loi"))}
                    >
                      {t("download")}
                    </button>
                  ) : (
                    <span className="chu-thich">{t("needIdentityPermission")}</span>
                  ),
                ],
              }))}
            />
          )
        }
      </Loaded>
      {uploading && (
        <UploadDrawer
          employeeId={employee.id}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            notify(t("uploadedDone"));
            void reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function UploadDrawer({ employeeId, onClose, onDone }: { employeeId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("hr");
  const [kind, setKind] = useState<EmployeeDocumentKind>("identity_image");
  const [consentDate, setConsentDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const form = new FormData();
      form.set("kind", kind);
      if (kind === "data_consent" && consentDate) form.set("consentDate", consentDate);
      if (file) form.set("file", file);
      await apiUpload(`/hr/employees/${employeeId}/documents`, form);
      onDone();
    });
  }
  return (
    <Drawer title={t("uploadTitle")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="loai-giay-to" label={t("documentKind")} error={fields.kind}>
          <select id="loai-giay-to" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as EmployeeDocumentKind)}>
            {employeeDocumentKinds.map((value) => (
              <option key={value} value={value}>
                {t(`document_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="tep-giay-to" label={t("file")} error={fields.file}>
          <input id="tep-giay-to" type="file" className={inputClass("file")} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        {kind === "data_consent" && (
          <Field id="ngay-dong-y" label={`${t("consentDate")} *`} error={fields.consentDate}>
            <input id="ngay-dong-y" type="date" className={inputClass("consentDate")} value={consentDate} onChange={(event) => setConsentDate(event.target.value)} />
          </Field>
        )}
        <div className="khoi-canh-bao canh-bao">{t("sensitiveUploadWarning")}</div>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("upload")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function DependentsTab({ employee }: { employee: EmployeeResponse }) {
  const t = useTranslations("hr");
  const { state, reload } = useApi<DependentItem[]>(`/hr/employees/${employee.id}/dependents`);
  const [editing, setEditing] = useState<DependentItem | "new" | null>(null);
  const month = (value: string | null) => (value ? value.slice(0, 7).split("-").reverse().join("/") : "—");
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("dependents")}</h2>
        {employee.canManage && (
          <button type="button" className="nut phu" onClick={() => setEditing("new")}>
            {t("addDependent")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(dependents) =>
          dependents.length === 0 ? (
            <MessageView text={t("noDependents")} />
          ) : (
            <Table
              headings={[t("fullName"), t("relationship"), t("birthDate"), t("dependentIdentity"), t("deductionFrom"), t("deductionTo"), ""]}
              rows={dependents.map((dependent) => ({
                key: dependent.id,
                cells: [
                  dependent.fullName,
                  t(`relationship_${dependent.relationship}`),
                  formatDate(dependent.birthDate),
                  dependent.identityNumber ?? "—",
                  month(dependent.deductionFrom),
                  month(dependent.deductionTo),
                  employee.canManage ? (
                    <button type="button" className="nut phu" onClick={() => setEditing(dependent)}>
                      {t("edit")}
                    </button>
                  ) : (
                    ""
                  ),
                ],
              }))}
            />
          )
        }
      </Loaded>
      {editing && (
        <DependentDrawer
          employeeId={employee.id}
          dependent={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function DependentDrawer({ employeeId, dependent, onClose, onDone }: { employeeId: string; dependent: DependentItem | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("hr");
  const { notify } = useAdmin();
  const [fullName, setFullName] = useState(dependent?.fullName ?? "");
  const [relationship, setRelationship] = useState<DependentRelationship>(dependent?.relationship ?? "child");
  const [birthDate, setBirthDate] = useState(dependent?.birthDate ?? "");
  const [identityNumber, setIdentityNumber] = useState("");
  const [deductionFrom, setDeductionFrom] = useState(dependent?.deductionFrom.slice(0, 7) ?? "");
  const [deductionTo, setDeductionTo] = useState(dependent?.deductionTo?.slice(0, 7) ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body = {
        fullName,
        relationship,
        birthDate,
        identityNumber: dependent && !identityNumber ? undefined : identityNumber || null,
        deductionFrom: deductionFrom ? `${deductionFrom}-01` : "",
        deductionTo: deductionTo ? `${deductionTo}-01` : null,
        ...(dependent ? { version: dependent.version } : {}),
      };
      await apiFetch(dependent ? `/hr/employees/${employeeId}/dependents/${dependent.id}` : `/hr/employees/${employeeId}/dependents`, {
        method: dependent ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      notify(t("dependentSaved"));
      onDone();
    });
  }
  return (
    <Drawer title={dependent ? t("editDependent") : t("addDependent")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="pt-ho-ten" label={`${t("fullName")} *`} error={fields.fullName}>
          <input id="pt-ho-ten" className={inputClass("fullName")} value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field id="pt-quan-he" label={t("relationship")} error={fields.relationship}>
          <select id="pt-quan-he" className={inputClass("relationship")} value={relationship} onChange={(event) => setRelationship(event.target.value as DependentRelationship)}>
            {dependentRelationships.map((value) => (
              <option key={value} value={value}>
                {t(`relationship_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pt-ngay-sinh" label={`${t("birthDate")} *`} error={fields.birthDate}>
          <input id="pt-ngay-sinh" type="date" className={inputClass("birthDate")} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
        </Field>
        <Field id="pt-so" label={t("dependentIdentity")} error={fields.identityNumber} hint={dependent?.identityNumber ? `${dependent.identityNumber} · ${t("protectedHint")}` : undefined}>
          <input id="pt-so" className={inputClass("identityNumber")} autoComplete="off" value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} />
        </Field>
        <Field id="pt-tu" label={`${t("deductionFrom")} *`} error={fields.deductionFrom}>
          <input id="pt-tu" type="month" className={inputClass("deductionFrom")} value={deductionFrom} onChange={(event) => setDeductionFrom(event.target.value)} />
        </Field>
        <Field id="pt-den" label={t("deductionTo")} error={fields.deductionTo}>
          <input id="pt-den" type="month" className={inputClass("deductionTo")} value={deductionTo} onChange={(event) => setDeductionTo(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function WorkEventsList({ events, renderActions }: { events: WorkEventItem[]; renderActions?: (event: WorkEventItem) => React.ReactNode }) {
  const t = useTranslations("hr");
  return (
    <ol className="dong-thoi-gian">
      {events.map((event, index) => (
        <li key={event.id} className={event.effective ? "xong" : "cho"}>
          <span className="cham">{events.length - index}</span>
          <div>
            <strong>
              {formatDate(event.effectiveDate)} · {t(`workKind_${event.kind}`)}
            </strong>{" "}
            {!event.effective && <span className="nhan canh-bao">{t("notEffective")}</span>}
            <div>{[event.departmentName, event.branchName, event.jobTitle, event.decisionNo].filter(Boolean).join(" · ")}</div>
            {event.note && <div className="chu-thich">{event.note}</div>}
            {event.appliedAt && <div className="chu-thich">{t("appliedAt", { time: formatDateTime(event.appliedAt) })}</div>}
            {renderActions?.(event)}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WorkEventsTab({ employee, onChanged }: { employee: EmployeeResponse; onChanged: () => void }) {
  const t = useTranslations("hr");
  const { notify } = useAdmin();
  const { state, reload } = useApi<WorkEventItem[]>(`/hr/employees/${employee.id}/work-events`);
  const [editing, setEditing] = useState<WorkEventItem | "new" | null>(null);
  const [removing, setRemoving] = useState<WorkEventItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void reload();
    onChanged();
  };
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("workEvents")}</h2>
        {employee.canManage && (
          <button type="button" className="nut phu" onClick={() => setEditing("new")}>
            {t("addWorkEvent")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(events) => (
          <WorkEventsList
            events={events}
            renderActions={(event) =>
              employee.canManage && !event.effective && event.sourceType === "manual" ? (
                <div className="nhom-nut">
                  <button type="button" className="nut phu" onClick={() => setEditing(event)}>
                    {t("edit")}
                  </button>
                  <button type="button" className="nut nguy-hiem" onClick={() => setRemoving(event)}>
                    {t("remove")}
                  </button>
                </div>
              ) : null
            }
          />
        )}
      </Loaded>
      {editing && (
        <WorkEventDrawer
          employeeId={employee.id}
          event={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            notify(t("workEventSaved"));
            refresh();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t("removeWorkEventTitle")}
          text={t("removeWorkEventText", { date: formatDate(removing.effectiveDate) })}
          confirmLabel={t("remove")}
          busy={busy}
          error={error}
          onClose={() => {
            setRemoving(null);
            setError(null);
          }}
          onConfirm={() => {
            setBusy(true);
            apiFetch(`/hr/employees/${employee.id}/work-events/${removing.id}`, { method: "DELETE" })
              .then(() => {
                setRemoving(null);
                notify(t("workEventRemoved"));
                refresh();
              })
              .catch((failure: unknown) => setError(failureOf(failure).message))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </div>
  );
}

function WorkEventDrawer({ employeeId, event, onClose, onDone }: { employeeId: string; event: WorkEventItem | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("hr");
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  const [kind, setKind] = useState<"transfer" | "title_change">(event?.kind === "title_change" ? "title_change" : "transfer");
  const [effectiveDate, setEffectiveDate] = useState(event?.effectiveDate ?? "");
  const [decisionNo, setDecisionNo] = useState(event?.decisionNo ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [jobTitle, setJobTitle] = useState(event?.jobTitle ?? "");
  const [note, setNote] = useState(event?.note ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    void run(async () => {
      const body = { kind, effectiveDate, decisionNo, departmentId: departmentId || null, branchId: branchId || null, jobTitle, note, ...(event ? { version: event.version } : {}) };
      await apiFetch(event ? `/hr/employees/${employeeId}/work-events/${event.id}` : `/hr/employees/${employeeId}/work-events`, {
        method: event ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onDone();
    });
  }
  return (
    <Drawer title={event ? t("editWorkEvent") : t("addWorkEvent")} onClose={onClose}>
      <Loaded state={options.state} onRetry={() => void options.reload()}>
        {(loaded) => (
          <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <Field id="qd-loai" label={t("workKind")} error={fields.kind}>
              <select id="qd-loai" className={inputClass("kind")} value={kind} onChange={(change) => setKind(change.target.value as "transfer" | "title_change")}>
                <option value="transfer">{t("workKind_transfer")}</option>
                <option value="title_change">{t("workKind_title_change")}</option>
              </select>
            </Field>
            <Field id="qd-ngay" label={`${t("effectiveDate")} *`} error={fields.effectiveDate}>
              <input id="qd-ngay" type="date" className={inputClass("effectiveDate")} value={effectiveDate} onChange={(change) => setEffectiveDate(change.target.value)} />
            </Field>
            <Field id="qd-so" label={t("decisionNo")} error={fields.decisionNo}>
              <input id="qd-so" className={inputClass("decisionNo")} value={decisionNo} onChange={(change) => setDecisionNo(change.target.value)} />
            </Field>
            <Field id="qd-phong-ban" label={t("department")} error={fields.departmentId}>
              <select id="qd-phong-ban" className={inputClass("departmentId")} value={departmentId} onChange={(change) => setDepartmentId(change.target.value)}>
                <option value="">{t("noChange")}</option>
                {loaded.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qd-chi-nhanh" label={t("branch")} error={fields.branchId}>
              <select id="qd-chi-nhanh" className={inputClass("branchId")} value={branchId} onChange={(change) => setBranchId(change.target.value)}>
                <option value="">{t("noChange")}</option>
                {loaded.branches.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="qd-chuc-danh" label={t("newJobTitle")} error={fields.jobTitle}>
              <input id="qd-chuc-danh" className={inputClass("jobTitle")} value={jobTitle} onChange={(change) => setJobTitle(change.target.value)} />
            </Field>
            <Field id="qd-ghi-chu" label={t("note")} error={fields.note}>
              <textarea id="qd-ghi-chu" className={inputClass("note")} rows={2} value={note} onChange={(change) => setNote(change.target.value)} />
            </Field>
            <div className="khoi-canh-bao thong-tin">{t("workEventHint")}</div>
            <FormError text={formError} />
            <div className="nhom-nut">
              <button type="button" className="nut phu" onClick={onClose}>
                {t("cancel")}
              </button>
              <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
                {t("save")}
              </button>
            </div>
          </form>
        )}
      </Loaded>
    </Drawer>
  );
}
