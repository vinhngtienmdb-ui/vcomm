"use client";

// MAN_HINH_216 Chi tiết hợp đồng (CHUC_NANG_212; API_246; QUYTAC_NGHIEPVU_463 đến 466): thông tin, tệp, phụ lục, duyệt và ký, chia sẻ, lịch sử.
import type { OfficeContractAppendixItem, OfficeContractOptions, OfficeContractResponse, OfficePerson, SigningSignerInput } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { ContractStatusBadge, ValidityBadge } from "@/components/ContractParts";
import { PersonPicker, personLabel } from "@/components/PersonPicker";

type Dialog =
  | { kind: "decide"; appendix: OfficeContractAppendixItem | null }
  | { kind: "cancel"; appendix: OfficeContractAppendixItem | null }
  | { kind: "signing"; appendix: OfficeContractAppendixItem | null }
  | { kind: "end" }
  | { kind: "appendix"; mode: "create" | "import" | "edit"; appendix: OfficeContractAppendixItem | null }
  | { kind: "share" }
  | { kind: "update_signed" }
  | null;

const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<OfficeContractResponse>(`/office/contracts/${id}`);
  const options = useApi<OfficeContractOptions>("/office/contract-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(contract) => (
        <Loaded state={options.state} onRetry={() => void options.reload()}>
          {(data) => <ContractDetail contract={contract} options={data} onChanged={() => void reload()} />}
        </Loaded>
      )}
    </Loaded>
  );
}

function ContractDetail({ contract, options, onChanged }: { contract: OfficeContractResponse; options: OfficeContractOptions; onChanged: () => void }) {
  const t = useTranslations("officeContracts");
  const { notify } = useAdmin();
  const [tab, setTab] = useState<"files" | "appendices" | "approval" | "shares" | "history">("files");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const allowed = new Set(contract.allowed);
  const post = async (path: string, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await apiFetch(`/office/contracts/${contract.id}${path}`, { method: "POST", body: JSON.stringify(body) });
      notify(message);
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  const done = (message: string) => {
    notify(message);
    setDialog(null);
    onChanged();
  };
  const download = (fileId: string, fileName: string) =>
    void apiDownload(`/office/contracts/${contract.id}/files/${fileId}`, fileName, fileName.toLowerCase().endsWith(".pdf")).catch((error) => notify(failureOf(error).message, "loi"));
  return (
    <>
      <p className="chu-thich">
        <Link href="/contracts">{t("title")}</Link>
      </p>
      <div className="tieu-de">
        <h1>
          {contract.contractCode} · {contract.name} <ContractStatusBadge status={contract.status} /> <ValidityBadge validity={contract.validity} />
          {contract.confidential && <span className="nhan loi">{t("confidentialBadge")}</span>}
        </h1>
        <div className="nhom-nut">
          {allowed.has("submit") && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void post("/submit", { version: contract.version }, t("submitted"))}>
              {t("submit")}
            </button>
          )}
          {allowed.has("decide") && (
            <button type="button" className="nut chinh" onClick={() => setDialog({ kind: "decide", appendix: null })}>
              {t("decide")}
            </button>
          )}
          {allowed.has("signing") && (
            <button type="button" className="nut chinh" onClick={() => setDialog({ kind: "signing", appendix: null })}>
              {t("startSigning")}
            </button>
          )}
          {allowed.has("edit") && (
            <Link className="nut phu" href={`/contracts/${contract.id}/edit`}>
              {t("edit")}
            </Link>
          )}
          {allowed.has("withdraw") && (
            <button type="button" className="nut phu" disabled={busy} onClick={() => void post("/withdraw", { version: contract.version }, t("withdrawn"))}>
              {t("withdraw")}
            </button>
          )}
          {allowed.has("appendix") && (
            <button type="button" className="nut phu" onClick={() => setDialog({ kind: "appendix", mode: "create", appendix: null })}>
              {t("createAppendix")}
            </button>
          )}
          {allowed.has("update_signed") && (
            <button type="button" className="nut phu" onClick={() => setDialog({ kind: "update_signed" })}>
              {t("updateSigned")}
            </button>
          )}
          {allowed.has("end") && (
            <button type="button" className="nut nguy-hiem" onClick={() => setDialog({ kind: "end" })}>
              {t("end")}
            </button>
          )}
          {allowed.has("cancel") && (
            <button type="button" className="nut nguy-hiem" onClick={() => setDialog({ kind: "cancel", appendix: null })}>
              {t("cancel")}
            </button>
          )}
        </div>
      </div>
      {contract.validity === "expiring" && contract.expiresOn && <div className="khoi-canh-bao canh-bao">{t("expiringNote", { date: formatDate(contract.expiresOn) })}</div>}
      {contract.validity === "expired" && <div className="khoi-canh-bao loi">{t("expiredNote")}</div>}
      {contract.status === "rejected" && <div className="khoi-canh-bao loi">{t("rejectedNote", { note: contract.decisionNote ?? "—" })}</div>}
      {contract.status === "cancelled" && contract.cancelReason && <div className="khoi-canh-bao canh-bao">{t("cancelledNote", { reason: contract.cancelReason })}</div>}
      {contract.status === "pending" && (
        <div className="khoi-canh-bao thong-tin">
          {contract.approvalMode === "policy" ? t("pendingPolicy") : t("pendingManager", { names: contract.approvers.map((person) => person.fullName).join(", ") })}
          {contract.approvalRequestId && (
            <>
              {" "}
              <a href={`/hop-duyet/${contract.approvalRequestId}`}>{t("openApproval")}</a>
            </>
          )}
        </div>
      )}
      {contract.status === "awaiting_signature" && contract.signingRequestId && (
        <div className="khoi-canh-bao thong-tin">
          {t("signingInProgress")} <Link href={`/signing/${contract.signingRequestId}`}>{t("openSigning")}</Link>
        </div>
      )}
      {(contract.status === "liquidated" || contract.status === "terminated") && (
        <div className="khoi-canh-bao trung-tinh">{t(`endedNote_${contract.status}`, { date: formatDate(contract.endedOn), reason: contract.endReason ?? "" })}</div>
      )}
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("contractNo")}</dt>
          <dd>{contract.contractNo ?? "—"}</dd>
          <dt>{t("type")}</dt>
          <dd>
            {contract.typeName} · {t(`direction_${contract.direction}`)}
          </dd>
          <dt>{t("partners")}</dt>
          <dd>{contract.partnerItems.map((partner) => [partner.name, partner.taxCode].filter(Boolean).join(" · ")).join("; ")}</dd>
          <dt>{t("value")}</dt>
          <dd>{contract.value ? formatMoney(contract.value, contract.currency) : "—"}</dd>
          <dt>{t("signedOn")}</dt>
          <dd>{formatDate(contract.signedOn)}</dd>
          <dt>{t("validityRange")}</dt>
          <dd>
            {formatDate(contract.effectiveFrom)} – {contract.expiresOn ? formatDate(contract.expiresOn) : t("noExpiry")}
          </dd>
          <dt>{t("owner")}</dt>
          <dd>
            {personLabel(contract.owner)}
            {contract.departmentName && ` · ${contract.departmentName}`}
          </dd>
          <dt>{t("reminderDays")}</dt>
          <dd>{t("reminderText", { days: contract.reminderDays.join(", ") })}</dd>
          {contract.description && (
            <>
              <dt>{t("description")}</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{contract.description}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="cac-the" role="tablist">
        {(["files", "appendices", "approval", "shares", "history"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`tab_${item}`)}
            {item === "appendices" && contract.appendices.length > 0 && ` (${contract.appendices.length})`}
          </button>
        ))}
      </div>
      {tab === "files" && (
        <div className="the">
          <FileTable contract={contract} onDownload={download} />
          {contract.signatureChecks && (
            <div className="khoi-canh-bao thong-tin">
              {t("signatureSummary", {
                count: contract.signatureChecks.length,
                valid: contract.signatureChecks.filter((check) => check.conclusion === "valid").length,
                untrusted: contract.signatureChecks.filter((check) => check.conclusion === "untrusted").length,
                invalid: contract.signatureChecks.filter((check) => check.conclusion === "invalid").length,
                unsupported: contract.signatureChecks.filter((check) => check.conclusion === "unsupported").length,
              })}{" "}
              <Link href="/signature-check">{t("openCheck")}</Link>
            </div>
          )}
          {allowed.has("attach") && (
            <div className="nhom-nut">
              <AttachButton contractId={contract.id} onDone={() => done(t("fileAdded"))} />
            </div>
          )}
        </div>
      )}
      {tab === "appendices" && (
        <div className="the">
          {contract.appendices.length === 0 ? (
            <p className="chu-thich">{t("noAppendices")}</p>
          ) : (
            <ol className="dong-thoi-gian">
              {contract.appendices.map((appendix) => (
                <li key={appendix.id} className={appendix.status === "signed" ? "xong" : ""}>
                  <span className="cham">{appendix.appendixNo}</span>
                  <div>
                    <strong>
                      {t("appendixLabel", { no: appendix.appendixNo })} · {appendix.summary}
                    </strong>{" "}
                    <ContractStatusBadge status={appendix.status} />
                    <div className="chu-thich">
                      {t("appendixChanges", {
                        effective: formatDate(appendix.effectiveFrom),
                        expiry: appendix.newExpiresOn ? formatDate(appendix.newExpiresOn) : "—",
                        value: appendix.newValue ? formatMoney(appendix.newValue, contract.currency) : "—",
                      })}
                    </div>
                    {appendix.status === "signed" && (
                      <div className="chu-thich">
                        {t("appendixPrevious", {
                          expiry: appendix.previousExpiresOn ? formatDate(appendix.previousExpiresOn) : t("noExpiry"),
                          value: appendix.previousValue ? formatMoney(appendix.previousValue, contract.currency) : "—",
                          signedOn: formatDate(appendix.signedOn),
                        })}
                      </div>
                    )}
                    {appendix.decisionNote && <div className="loi-o">{t("rejectedNote", { note: appendix.decisionNote })}</div>}
                    {appendix.signingRequestId && <Link href={`/signing/${appendix.signingRequestId}`}>{t("openSigning")}</Link>}
                    <div className="nhom-nut">
                      {appendix.contentFileId && (
                        <button type="button" className="nut phu" onClick={() => download(appendix.contentFileId!, `phu-luc-${appendix.appendixNo}.pdf`)}>
                          {t("downloadContent")}
                        </button>
                      )}
                      {appendix.signedFileId && (
                        <button type="button" className="nut phu" onClick={() => download(appendix.signedFileId!, `phu-luc-${appendix.appendixNo}-da-ky.pdf`)}>
                          {t("downloadSigned")}
                        </button>
                      )}
                      <AppendixActions appendix={appendix} busy={busy} post={post} open={setDialog} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {allowed.has("appendix") && (
            <div className="nhom-nut">
              <button type="button" className="nut phu" onClick={() => setDialog({ kind: "appendix", mode: "create", appendix: null })}>
                {t("createAppendix")}
              </button>
              <button type="button" className="nut phu" onClick={() => setDialog({ kind: "appendix", mode: "import", appendix: null })}>
                {t("importAppendix")}
              </button>
            </div>
          )}
        </div>
      )}
      {tab === "approval" && (
        <div className="the">
          <dl className="thong-tin-dong">
            <dt>{t("approvalMode")}</dt>
            <dd>{contract.imported ? t("importedNoApproval") : contract.approvalMode ? t(`approvalMode_${contract.approvalMode}`) : "—"}</dd>
            {contract.approvers.length > 0 && (
              <>
                <dt>{t("approvers")}</dt>
                <dd>{contract.approvers.map((person) => person.fullName).join(", ")}</dd>
              </>
            )}
            <dt>{t("signingRequest")}</dt>
            <dd>{contract.signingRequestId ? <Link href={`/signing/${contract.signingRequestId}`}>{t("openSigning")}</Link> : "—"}</dd>
          </dl>
        </div>
      )}
      {tab === "shares" && (
        <div className="the">
          <p className="chu-thich">{contract.confidential ? t("sharesConfidential") : t("sharesNormal")}</p>
          {contract.shares.length === 0 ? (
            <p className="chu-thich">{t("noShares")}</p>
          ) : (
            <ul>
              {contract.shares.map((person) => (
                <li key={person.id}>
                  {personLabel(person)}{" "}
                  {allowed.has("share") && (
                    <button
                      type="button"
                      className="nut phu"
                      onClick={() =>
                        void apiFetch(`/office/contracts/${contract.id}/shares/${person.id}`, { method: "DELETE" })
                          .then(() => done(t("unshared")))
                          .catch((error) => notify(failureOf(error).message, "loi"))
                      }
                    >
                      {t("unshare")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {allowed.has("share") && (
            <button type="button" className="nut phu" onClick={() => setDialog({ kind: "share" })}>
              {t("share")}
            </button>
          )}
        </div>
      )}
      {tab === "history" && (
        <div className="the">
          <ol className="dong-thoi-gian">
            {contract.events.map((event, index) => (
              <li key={event.id} className="xong">
                <span className="cham">{contract.events.length - index}</span>
                <div>
                  <strong>
                    {formatDateTime(event.createdAt)} · {event.actor?.fullName ?? t("system")}
                  </strong>
                  <div>{t(`event_${event.kind}`)}</div>
                  {typeof event.detail.reason === "string" && <div className="chu-thich">{event.detail.reason}</div>}
                  {typeof event.detail.note === "string" && <div className="chu-thich">{event.detail.note}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {dialog?.kind === "decide" && <DecideDrawer contract={contract} appendix={dialog.appendix} onClose={() => setDialog(null)} onDone={(message) => done(message)} />}
      {dialog?.kind === "cancel" && <CancelDrawer contract={contract} appendix={dialog.appendix} onClose={() => setDialog(null)} onDone={() => done(t("cancelled"))} />}
      {dialog?.kind === "signing" && <SigningDrawer contract={contract} appendix={dialog.appendix} onClose={() => setDialog(null)} onDone={() => done(t("signingStarted"))} />}
      {dialog?.kind === "end" && <EndDrawer contract={contract} onClose={() => setDialog(null)} onDone={() => done(t("ended"))} />}
      {dialog?.kind === "appendix" && <AppendixDrawer contract={contract} mode={dialog.mode} appendix={dialog.appendix} onClose={() => setDialog(null)} onDone={() => done(t("appendixSaved"))} />}
      {dialog?.kind === "share" && <ShareDrawer contract={contract} onClose={() => setDialog(null)} onDone={() => done(t("shared"))} />}
      {dialog?.kind === "update_signed" && <UpdateSignedDrawer contract={contract} options={options} onClose={() => setDialog(null)} onDone={() => done(t("saved"))} />}
    </>
  );
}

function FileTable({ contract, onDownload }: { contract: OfficeContractResponse; onDownload: (fileId: string, fileName: string) => void }) {
  const t = useTranslations("officeContracts");
  if (contract.files.length === 0) return <p className="chu-thich">{t("noFiles")}</p>;
  return (
    <ul>
      {contract.files.map((file) => (
        <li key={file.id}>
          <button type="button" className="nut phu" onClick={() => onDownload(file.id, file.fileName)}>
            {file.fileName}
          </button>{" "}
          <span className="nhan trung-tinh">{t(`fileRole_${file.role}`)}</span> <span className="chu-thich">{Math.ceil(file.sizeBytes / 1024)} KB</span>
        </li>
      ))}
    </ul>
  );
}

function AttachButton({ contractId, onDone }: { contractId: string; onDone: () => void }) {
  const t = useTranslations("officeContracts");
  const { notify } = useAdmin();
  return (
    <label className="nut phu" style={{ cursor: "pointer" }}>
      {t("attach")}
      <input
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const form = new FormData();
          form.append("file", file);
          apiUpload(`/office/contracts/${contractId}/files`, form)
            .then(onDone)
            .catch((error) => notify(failureOf(error).message, "loi"));
        }}
      />
    </label>
  );
}

function AppendixActions({
  appendix,
  busy,
  post,
  open,
}: {
  appendix: OfficeContractAppendixItem;
  busy: boolean;
  post: (path: string, body: Record<string, unknown>, message: string) => Promise<void>;
  open: (dialog: Dialog) => void;
}) {
  const t = useTranslations("officeContracts");
  const allowed = new Set(appendix.allowed);
  const base = `/appendices/${appendix.id}`;
  const buttons: ReactNode[] = [];
  if (allowed.has("submit"))
    buttons.push(
      <button key="submit" type="button" className="nut chinh" disabled={busy} onClick={() => void post(`${base}/submit`, { version: appendix.version }, t("submitted"))}>
        {t("submit")}
      </button>,
    );
  if (allowed.has("edit"))
    buttons.push(
      <button key="edit" type="button" className="nut phu" onClick={() => open({ kind: "appendix", mode: "edit", appendix })}>
        {t("edit")}
      </button>,
    );
  if (allowed.has("decide"))
    buttons.push(
      <button key="decide" type="button" className="nut chinh" onClick={() => open({ kind: "decide", appendix })}>
        {t("decide")}
      </button>,
    );
  if (allowed.has("withdraw"))
    buttons.push(
      <button key="withdraw" type="button" className="nut phu" disabled={busy} onClick={() => void post(`${base}/withdraw`, { version: appendix.version }, t("withdrawn"))}>
        {t("withdraw")}
      </button>,
    );
  if (allowed.has("signing"))
    buttons.push(
      <button key="signing" type="button" className="nut chinh" onClick={() => open({ kind: "signing", appendix })}>
        {t("startSigning")}
      </button>,
    );
  if (allowed.has("cancel"))
    buttons.push(
      <button key="cancel" type="button" className="nut nguy-hiem" onClick={() => open({ kind: "cancel", appendix })}>
        {t("cancel")}
      </button>,
    );
  return <>{buttons}</>;
}

function targetPath(contract: OfficeContractResponse, appendix: OfficeContractAppendixItem | null, action: string) {
  return appendix ? `/office/contracts/${contract.id}/appendices/${appendix.id}/${action}` : `/office/contracts/${contract.id}/${action}`;
}

function DecideDrawer({
  contract,
  appendix,
  onClose,
  onDone,
}: {
  contract: OfficeContractResponse;
  appendix: OfficeContractAppendixItem | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("officeContracts");
  const [note, setNote] = useState("");
  const { submitting, formError, run } = useSubmit();
  const decide = (decision: "approved" | "rejected") =>
    run(async () => {
      await apiFetch(targetPath(contract, appendix, "decide"), { method: "POST", body: JSON.stringify({ decision, note: note.trim() || null, version: appendix?.version ?? contract.version }) });
      onDone(decision === "approved" ? t("approved") : t("rejected"));
    });
  return (
    <Drawer title={appendix ? t("decideAppendix", { no: appendix.appendixNo }) : t("decide")} onClose={onClose}>
      <Field id="y-kien-duyet" label={t("decisionNote")}>
        <textarea id="y-kien-duyet" className="o-nhap" rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut nguy-hiem" disabled={submitting} onClick={() => void decide("rejected")}>
          {t("rejectAction")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void decide("approved")}>
          {t("approveAction")}
        </button>
      </div>
    </Drawer>
  );
}

function CancelDrawer({ contract, appendix, onClose, onDone }: { contract: OfficeContractResponse; appendix: OfficeContractAppendixItem | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeContracts");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  return (
    <Drawer title={t("cancel")} onClose={onClose}>
      <Field id="ly-do-huy-hd" label={t("reason")} error={fields.reason}>
        <textarea id="ly-do-huy-hd" className={inputClass("reason")} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {(appendix?.signingRequestId ?? contract.signingRequestId) && <div className="khoi-canh-bao canh-bao">{t("cancelSigningWarning")}</div>}
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || !reason.trim()}
          onClick={() =>
            void run(async () => {
              await apiFetch(targetPath(contract, appendix, "cancel"), { method: "POST", body: JSON.stringify({ reason, version: appendix?.version ?? contract.version }) });
              onDone();
            })
          }
        >
          {t("cancel")}
        </button>
      </div>
    </Drawer>
  );
}

// Lập phiên ký: mặc định chữ ký công ty ký trước, rồi đại diện từng đối tác (QUYTAC_NGHIEPVU_464).
function SigningDrawer({ contract, appendix, onClose, onDone }: { contract: OfficeContractResponse; appendix: OfficeContractAppendixItem | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeContracts");
  const [dueOn, setDueOn] = useState(addDays(vietnamToday(), 14));
  const [note, setNote] = useState("");
  const [withSeal, setWithSeal] = useState(true);
  const [people, setPeople] = useState<OfficePerson[]>([]);
  const [partners, setPartners] = useState(
    contract.partnerItems.map((partner) => ({
      id: partner.id,
      include: true,
      name: partner.name,
      email: partner.email ?? "",
      kind: partner.kind === "individual" ? ("individual" as const) : ("organization" as const),
      identity: partner.taxCode ?? "",
      identityCode: partner.taxCode ?? "",
    })),
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const submit = () =>
    run(async () => {
      let order = 0;
      const signers: SigningSignerInput[] = [];
      if (people.length) {
        order += 1;
        for (const person of people) signers.push({ kind: "user", userId: person.id, signOrder: order, page: "last", corner: "bottom_right" });
      }
      if (withSeal) {
        order += 1;
        signers.push({ kind: "company", signOrder: order, page: "last", corner: "bottom_right" });
      }
      for (const partner of partners.filter((item) => item.include)) {
        order += 1;
        signers.push({
          kind: "partner",
          partnerId: partner.id,
          partnerKind: partner.kind,
          name: partner.name,
          email: partner.email,
          identity: partner.identity,
          identityCode: partner.identityCode,
          signOrder: order,
          page: "last",
          corner: "bottom_left",
        });
      }
      await apiFetch(targetPath(contract, appendix, "signing"), {
        method: "POST",
        body: JSON.stringify({ dueOn, note: note.trim() || null, signers, version: appendix?.version ?? contract.version }),
      });
      onDone();
    });
  return (
    <Drawer title={appendix ? t("signingAppendixTitle", { no: appendix.appendixNo }) : t("startSigning")} onClose={onClose}>
      <p className="chu-thich">{t("signingHint")}</p>
      <Field id="han-ky-hd" label={t("dueOn")} error={fields.dueOn}>
        <input id="han-ky-hd" type="date" className={inputClass("dueOn")} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
      </Field>
      <Field id="ghi-chu-ky-hd" label={t("signingNote")}>
        <textarea id="ghi-chu-ky-hd" className="o-nhap" rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Field id="nguoi-ky-noi-bo" label={t("internalSigners")} hint={t("internalSignersHint")}>
        <PersonPicker id="nguoi-ky-noi-bo" value={people} multiple onChange={setPeople} />
      </Field>
      <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
        <input type="checkbox" checked={withSeal} onChange={(event) => setWithSeal(event.target.checked)} />
        {t("withSeal")}
      </label>
      {partners.map((partner, index) => (
        <div key={partner.id} className="the">
          <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={partner.include}
              onChange={(event) => setPartners(partners.map((item, position) => (position === index ? { ...item, include: event.target.checked } : item)))}
            />
            <strong>{partner.name}</strong>
          </label>
          {partner.include && (
            <>
              <Field id={`email-dt-${index}`} label={t("partnerEmail")} error={partner.email.trim() ? undefined : t("partnerEmailRequired")}>
                <input
                  id={`email-dt-${index}`}
                  type="email"
                  className={`o-nhap${partner.email.trim() ? "" : " loi"}`}
                  value={partner.email}
                  onChange={(event) => setPartners(partners.map((item, position) => (position === index ? { ...item, email: event.target.value } : item)))}
                />
              </Field>
              <Field id={`dinh-danh-dt-${index}`} label={partner.kind === "organization" ? t("partnerTaxCode") : t("partnerPersonalId")}>
                <input
                  id={`dinh-danh-dt-${index}`}
                  className="o-nhap"
                  value={partner.identity}
                  onChange={(event) => setPartners(partners.map((item, position) => (position === index ? { ...item, identity: event.target.value } : item)))}
                />
              </Field>
              <Field id={`ma-ncc-dt-${index}`} label={t("partnerIdentityCode")}>
                <input
                  id={`ma-ncc-dt-${index}`}
                  className="o-nhap"
                  value={partner.identityCode}
                  onChange={(event) => setPartners(partners.map((item, position) => (position === index ? { ...item, identityCode: event.target.value } : item)))}
                />
              </Field>
            </>
          )}
        </div>
      ))}
      {Object.entries(fields)
        .filter(([key]) => key !== "dueOn")
        .map(([key, message]) => (
          <div key={key} className="khoi-canh-bao loi">
            {message}
          </div>
        ))}
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || (!withSeal && people.length === 0 && !partners.some((item) => item.include)) || partners.some((item) => item.include && !item.email.trim())}
          onClick={() => void submit()}
        >
          {t("sendSigning")}
        </button>
      </div>
    </Drawer>
  );
}

function EndDrawer({ contract, onClose, onDone }: { contract: OfficeContractResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeContracts");
  const [kind, setKind] = useState<"liquidated" | "terminated">("liquidated");
  const [endedOn, setEndedOn] = useState(vietnamToday());
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  return (
    <Drawer title={t("end")} onClose={onClose}>
      <Field id="loai-ket-thuc" label={t("endKind")}>
        <select id="loai-ket-thuc" className="o-nhap" value={kind} onChange={(event) => setKind(event.target.value as "liquidated" | "terminated")}>
          <option value="liquidated">{t("endKind_liquidated")}</option>
          <option value="terminated">{t("endKind_terminated")}</option>
        </select>
      </Field>
      <Field id="ngay-ket-thuc" label={t("endedOn")} error={fields.endedOn}>
        <input id="ngay-ket-thuc" type="date" className={inputClass("endedOn")} value={endedOn} onChange={(event) => setEndedOn(event.target.value)} />
      </Field>
      <Field id="ly-do-ket-thuc" label={t("reason")} error={fields.reason}>
        <textarea id="ly-do-ket-thuc" className={inputClass("reason")} rows={2} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Field id="bien-ban" label={t("endFile")} error={fields.file}>
        <input id="bien-ban" type="file" className={inputClass("file")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || !reason.trim() || !file}
          onClick={() =>
            void run(async () => {
              const form = new FormData();
              form.append("data", JSON.stringify({ kind, endedOn, reason, version: contract.version }));
              form.append("file", file!);
              await apiUpload(`/office/contracts/${contract.id}/end`, form);
              onDone();
            })
          }
        >
          {t("confirm")}
        </button>
      </div>
    </Drawer>
  );
}

function AppendixDrawer({
  contract,
  mode,
  appendix,
  onClose,
  onDone,
}: {
  contract: OfficeContractResponse;
  mode: "create" | "import" | "edit";
  appendix: OfficeContractAppendixItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("officeContracts");
  const [appendixNo, setAppendixNo] = useState(appendix?.appendixNo ?? String(contract.appendices.length + 1).padStart(2, "0"));
  const [summary, setSummary] = useState(appendix?.summary ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(appendix?.effectiveFrom ?? vietnamToday());
  const [newExpiresOn, setNewExpiresOn] = useState(appendix?.newExpiresOn ?? "");
  const [newValue, setNewValue] = useState(appendix?.newValue ?? "");
  const [signedOn, setSignedOn] = useState(vietnamToday());
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const path =
    mode === "import" ? `/office/contracts/${contract.id}/appendices/import` : appendix ? `/office/contracts/${contract.id}/appendices/${appendix.id}` : `/office/contracts/${contract.id}/appendices`;
  return (
    <Drawer title={mode === "import" ? t("importAppendix") : appendix ? t("editAppendix", { no: appendix.appendixNo }) : t("createAppendix")} onClose={onClose}>
      <Field id="so-phu-luc" label={t("appendixNo")} error={fields.appendixNo}>
        <input id="so-phu-luc" className={inputClass("appendixNo")} maxLength={50} value={appendixNo} onChange={(event) => setAppendixNo(event.target.value)} />
      </Field>
      <Field id="noi-dung-phu-luc" label={t("appendixSummary")} error={fields.summary}>
        <textarea id="noi-dung-phu-luc" className={inputClass("summary")} rows={2} maxLength={2000} value={summary} onChange={(event) => setSummary(event.target.value)} />
      </Field>
      <Field id="hieu-luc-phu-luc" label={t("effectiveFrom")} error={fields.effectiveFrom}>
        <input id="hieu-luc-phu-luc" type="date" className={inputClass("effectiveFrom")} value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
      </Field>
      <div className="hai-cot">
        <Field id="het-han-moi" label={t("newExpiresOn")} error={fields.newExpiresOn}>
          <input id="het-han-moi" type="date" className={inputClass("newExpiresOn")} value={newExpiresOn} onChange={(event) => setNewExpiresOn(event.target.value)} />
        </Field>
        {contract.direction !== "none" && (
          <Field id="gia-tri-moi" label={t("newValue")} error={fields.newValue}>
            <input id="gia-tri-moi" className={inputClass("newValue")} inputMode="decimal" value={newValue} onChange={(event) => setNewValue(event.target.value)} />
          </Field>
        )}
      </div>
      {mode === "import" && (
        <Field id="ngay-ky-phu-luc" label={t("signedOn")} error={fields.signedOn}>
          <input id="ngay-ky-phu-luc" type="date" className={inputClass("signedOn")} value={signedOn} onChange={(event) => setSignedOn(event.target.value)} />
        </Field>
      )}
      <Field id="tep-phu-luc" label={mode === "import" ? t("signedFile") : t("contentFile")} error={fields.file} hint={mode === "import" ? undefined : t("contentFileHint")}>
        <input
          id="tep-phu-luc"
          type="file"
          accept={mode === "import" ? undefined : ".pdf,application/pdf"}
          className={inputClass("file")}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting}
          onClick={() =>
            void run(async () => {
              const form = new FormData();
              form.append(
                "data",
                JSON.stringify({
                  appendixNo,
                  summary,
                  effectiveFrom,
                  newExpiresOn: newExpiresOn || null,
                  newValue: newValue ? newValue.replace(/[.\s]/g, "").replace(",", ".") : null,
                  ...(mode === "import" ? { signedOn } : {}),
                  ...(appendix ? { version: appendix.version } : {}),
                }),
              );
              if (file) form.append("file", file);
              await apiUpload(path, form);
              onDone();
            })
          }
        >
          {mode === "import" ? t("importAction") : t("saveDraft")}
        </button>
      </div>
    </Drawer>
  );
}

function ShareDrawer({ contract, onClose, onDone }: { contract: OfficeContractResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeContracts");
  const [people, setPeople] = useState<OfficePerson[]>([]);
  const { submitting, fields, formError, run } = useSubmit();
  return (
    <Drawer title={t("share")} onClose={onClose}>
      <Field id="chia-se-hd" label={t("sharePerson")} error={fields.userId} hint={t("shareHint")}>
        <PersonPicker id="chia-se-hd" value={people} multiple={false} onChange={setPeople} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || people.length === 0}
          onClick={() =>
            void run(async () => {
              await apiFetch(`/office/contracts/${contract.id}/shares`, { method: "POST", body: JSON.stringify({ userId: people[0]!.id }) });
              onDone();
            })
          }
        >
          {t("share")}
        </button>
      </div>
    </Drawer>
  );
}

function UpdateSignedDrawer({ contract, options, onClose, onDone }: { contract: OfficeContractResponse; options: OfficeContractOptions; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeContracts");
  const [owner, setOwner] = useState<OfficePerson[]>([contract.owner]);
  const [departmentId, setDepartmentId] = useState(contract.departmentId ?? "");
  const [reminders, setReminders] = useState(contract.reminderDays.join(", "));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  return (
    <Drawer title={t("updateSigned")} onClose={onClose}>
      <Field id="phu-trach-moi" label={t("owner")} error={fields.ownerUserId}>
        <PersonPicker id="phu-trach-moi" value={owner} multiple={false} onChange={setOwner} />
      </Field>
      <Field id="phong-ban-moi" label={t("department")}>
        <select id="phong-ban-moi" className="o-nhap" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">{t("noDepartment")}</option>
          {options.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="moc-nhac-moi" label={t("reminderDays")} error={fields.reminderDays} hint={t("reminderHint")}>
        <input id="moc-nhac-moi" className={inputClass("reminderDays")} value={reminders} onChange={(event) => setReminders(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || owner.length === 0}
          onClick={() =>
            void run(async () => {
              await apiFetch(`/office/contracts/${contract.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  ownerUserId: owner[0]!.id,
                  departmentId: departmentId || null,
                  reminderDays: reminders
                    .split(/[,;\s]+/)
                    .filter(Boolean)
                    .map(Number),
                  version: contract.version,
                }),
              });
              onDone();
            })
          }
        >
          {t("save")}
        </button>
      </div>
    </Drawer>
  );
}
