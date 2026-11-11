"use client";

// MAN_HINH_157 Chi tiết công văn đến (CHUC_NANG_184; API_188): trình lãnh đạo, giao xử lý thành công việc, chuyển, lưu, hủy, vào sổ liên công ty.
import type { DocumentOptions, IncomingResponse, OfficePerson } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { IncomingStatusBadge, UrgencyBadge } from "@/components/DocumentBadges";
import { FileList } from "@/components/FileList";
import { PersonPicker, personLabel } from "@/components/PersonPicker";
import { IncomingForm } from "@/components/IncomingForm";

type Dialog = "edit" | "submit" | "direct" | "void" | "accept" | null;

export default function IncomingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<IncomingResponse>(`/office/incoming/${id}`);
  const options = useApi<DocumentOptions>("/office/document-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(incoming) => (
        <Loaded state={options.state} onRetry={() => void options.reload()}>
          {(data) => <IncomingDetail incoming={incoming} options={data} onChanged={() => void reload()} key={incoming.version} />}
        </Loaded>
      )}
    </Loaded>
  );
}

function IncomingDetail({ incoming, options, onChanged }: { incoming: IncomingResponse; options: DocumentOptions; onChanged: () => void }) {
  const t = useTranslations("officeDocuments");
  const { notify } = useAdmin();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [uploading, setUploading] = useState(false);
  const allowed = new Set(incoming.allowedActions);
  const close = () => setDialog(null);
  const done = (message: string) => {
    notify(message);
    setDialog(null);
    onChanged();
  };
  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      await apiUpload(`/office/incoming/${incoming.id}/files`, form);
      notify(t("fileAdded"));
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setUploading(false);
    }
  };
  const button = (action: Exclude<Dialog, null>, tone: string) =>
    allowed.has(action) && (
      <button type="button" className={`nut ${tone}`} onClick={() => setDialog(action)}>
        {t(`incomingAction_${action}`)}
      </button>
    );
  return (
    <>
      <p className="chu-thich">
        <Link href="/incoming">{t("incomingTitle")}</Link>
      </p>
      <div className="tieu-de">
        <h1>
          {incoming.incomingNo ? t("incomingHeading", { number: incoming.incomingNo }) : t("notRegistered")} <IncomingStatusBadge status={incoming.status} />
        </h1>
        <div className="nhom-nut">
          {button("accept", "chinh")}
          {button("submit", "chinh")}
          {button("direct", "chinh")}
          {button("edit", "phu")}
          {button("void", "nguy-hiem")}
        </div>
      </div>
      {incoming.duplicateOf.length > 0 && (
        <div className="khoi-canh-bao canh-bao">
          {t("duplicateWarning")}{" "}
          {incoming.duplicateOf.map((item) => (
            <Link key={item.id} href={`/incoming/${item.id}`} style={{ marginRight: "var(--khoang-2)" }}>
              {item.incomingNo ? t("incomingHeading", { number: item.incomingNo }) : t("notRegistered")}
            </Link>
          ))}
        </div>
      )}
      {incoming.status === "voided" && incoming.voidReason && <div className="khoi-canh-bao canh-bao">{t("voidedReason", { reason: incoming.voidReason })}</div>}
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("registerName")}</dt>
          <dd>{incoming.registerName ? `${incoming.registerName} · ${incoming.year}` : "—"}</dd>
          <dt>{t("receivedOn")}</dt>
          <dd>{formatDate(incoming.receivedOn)}</dd>
          <dt>{t("channel")}</dt>
          <dd>{t(`channel_${incoming.channel}`)}</dd>
          <dt>{t("sender")}</dt>
          <dd>{incoming.sender}</dd>
          <dt>{t("symbol")}</dt>
          <dd>{incoming.symbol ?? "—"}</dd>
          <dt>{t("documentDate")}</dt>
          <dd>{formatDate(incoming.documentDate)}</dd>
          <dt>{t("documentType")}</dt>
          <dd>{incoming.documentTypeName}</dd>
          <dt>{t("summary")}</dt>
          <dd>{incoming.summary}</dd>
          <dt>{t("urgency")}</dt>
          <dd>
            <UrgencyBadge urgency={incoming.urgency} />
          </dd>
          <dt>{t("dueOn")}</dt>
          <dd>{formatDate(incoming.dueOn)}</dd>
          <dt>{t("leader")}</dt>
          <dd>{incoming.leader ? personLabel(incoming.leader) : "—"}</dd>
          <dt>{t("handler")}</dt>
          <dd>{incoming.handler ? personLabel(incoming.handler) : "—"}</dd>
          {incoming.taskId && (
            <>
              <dt>{t("task")}</dt>
              <dd>
                <Link href={`/tasks/${incoming.taskId}`}>{t("openTask")}</Link>
              </dd>
            </>
          )}
          {incoming.sourceCompanyName && (
            <>
              <dt>{t("sourceCompany")}</dt>
              <dd>{incoming.sourceCompanyName}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="the">
        <div className="tieu-de">
          <h2>{t("files")}</h2>
          {allowed.has("upload") && (
            <label className={`nut phu${uploading ? " dang-xu-ly" : ""}`}>
              {t("addFile")}
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" hidden disabled={uploading} onChange={(event) => void upload(event.target.files)} />
            </label>
          )}
        </div>
        {incoming.files.length === 0 ? <p className="chu-thich">{t("noFiles")}</p> : <FileList files={incoming.files} basePath={`/office/incoming/${incoming.id}/files`} />}
      </div>
      <div className="the">
        <h2>{t("routings")}</h2>
        {incoming.routings.length === 0 ? (
          <p className="chu-thich">{t("noRoutings")}</p>
        ) : (
          <ol className="dong-thoi-gian">
            {incoming.routings.map((routing) => (
              <li key={routing.id} className="xong">
                <span className="cham">{(routing.actor?.fullName ?? "?").slice(0, 1)}</span>
                <div>
                  <strong>{routing.actor?.fullName ?? t("system")}</strong> {t(`routing_${routing.action}`)}
                  {routing.toUser && <> → {routing.toUser.fullName}</>}
                  <div className="chu-thich">{formatDateTime(routing.createdAt)}</div>
                  {routing.note && <div style={{ whiteSpace: "pre-wrap" }}>{routing.note}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {dialog === "edit" && <IncomingForm options={options} incoming={incoming} onClose={close} onSaved={() => (setDialog(null), onChanged())} />}
      {dialog === "submit" && <SubmitDrawer incoming={incoming} leaders={options.leaders} onClose={close} onDone={() => done(t("submitted"))} />}
      {dialog === "direct" && <DirectDrawer incoming={incoming} leaders={options.leaders} onClose={close} onDone={(message) => done(message)} />}
      {dialog === "void" && <VoidDrawer incoming={incoming} onClose={close} onDone={() => done(t("voided"))} />}
      {dialog === "accept" && <AcceptDrawer incoming={incoming} options={options} onClose={close} onDone={() => done(t("accepted"))} />}
    </>
  );
}

function SubmitDrawer({ incoming, leaders, onClose, onDone }: { incoming: IncomingResponse; leaders: OfficePerson[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [leaderUserId, setLeaderUserId] = useState(incoming.leader?.id ?? leaders[0]?.id ?? "");
  const [note, setNote] = useState("");
  const save = () =>
    run(async () => {
      await apiFetch(`/office/incoming/${incoming.id}/submit`, { method: "POST", body: JSON.stringify({ leaderUserId, note: note.trim() || null, version: incoming.version }) });
      onDone();
    });
  return (
    <Drawer title={t("incomingAction_submit")} onClose={onClose}>
      <FormError text={formError} />
      {leaders.length === 0 && <div className="khoi-canh-bao canh-bao">{t("noLeaders")}</div>}
      <Field id="submit-leader" label={t("leader")} error={fields.leaderUserId}>
        <select id="submit-leader" className={inputClass("leaderUserId")} value={leaderUserId} onChange={(event) => setLeaderUserId(event.target.value)}>
          {leaders.map((person) => (
            <option key={person.id} value={person.id}>
              {personLabel(person)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="submit-note" label={t("note")} error={fields.note}>
        <textarea id="submit-note" className={inputClass("note")} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !leaderUserId} onClick={() => void save()}>
          {t("incomingAction_submit")}
        </button>
      </div>
    </Drawer>
  );
}

function DirectDrawer({ incoming, leaders, onClose, onDone }: { incoming: IncomingResponse; leaders: OfficePerson[]; onClose: () => void; onDone: (message: string) => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [action, setAction] = useState<"assign" | "forward" | "archive">("assign");
  const [owner, setOwner] = useState<OfficePerson[]>([]);
  const [collaborators, setCollaborators] = useState<OfficePerson[]>([]);
  const [dueOn, setDueOn] = useState(incoming.dueOn ?? "");
  const [leaderUserId, setLeaderUserId] = useState(leaders.find((person) => person.id !== incoming.leader?.id)?.id ?? "");
  const [note, setNote] = useState("");
  const save = () =>
    run(async () => {
      const body = {
        action,
        note: note.trim() || null,
        version: incoming.version,
        ...(action === "assign" ? { ownerUserId: owner[0]?.id ?? null, collaboratorIds: collaborators.map((person) => person.id), dueAt: dueOn ? `${dueOn}T17:00:00+07:00` : null } : {}),
        ...(action === "forward" ? { leaderUserId } : {}),
      };
      await apiFetch(`/office/incoming/${incoming.id}/direct`, { method: "POST", body: JSON.stringify(body) });
      onDone(t(`directed_${action}`));
    });
  return (
    <Drawer title={t("incomingAction_direct")} onClose={onClose}>
      <FormError text={formError} />
      <div className="cac-the" role="tablist">
        {(["assign", "forward", "archive"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={action === item} className={action === item ? "chon" : ""} onClick={() => setAction(item)}>
            {t(`directAction_${item}`)}
          </button>
        ))}
      </div>
      {action === "assign" && (
        <>
          <p className="chu-thich">{t("assignHint")}</p>
          <Field id="direct-owner" label={t("handler")} error={fields.ownerUserId}>
            <PersonPicker id="direct-owner" value={owner} onChange={setOwner} multiple={false} invalid={Boolean(fields.ownerUserId)} />
          </Field>
          <Field id="direct-collaborators" label={t("collaborators")} error={fields.collaboratorIds}>
            <PersonPicker id="direct-collaborators" value={collaborators} onChange={setCollaborators} multiple />
          </Field>
          <Field id="direct-due" label={t("dueOnOptional")} error={fields.dueAt}>
            <input id="direct-due" type="date" className={inputClass("dueAt")} min={vietnamToday()} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </Field>
        </>
      )}
      {action === "forward" && (
        <Field id="direct-leader" label={t("forwardTo")} error={fields.leaderUserId}>
          <select id="direct-leader" className={inputClass("leaderUserId")} value={leaderUserId} onChange={(event) => setLeaderUserId(event.target.value)}>
            {leaders
              .filter((person) => person.id !== incoming.leader?.id)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {personLabel(person)}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field id="direct-note" label={action === "assign" ? t("directionNote") : t("note")} error={fields.note}>
        <textarea id="direct-note" className={inputClass("note")} rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || (action === "assign" && owner.length === 0) || (action === "forward" && !leaderUserId)}
          onClick={() => void save()}
        >
          {t(`directAction_${action}`)}
        </button>
      </div>
    </Drawer>
  );
}

function VoidDrawer({ incoming, onClose, onDone }: { incoming: IncomingResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  const save = () =>
    run(async () => {
      await apiFetch(`/office/incoming/${incoming.id}/void`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), version: incoming.version }) });
      onDone();
    });
  return (
    <Drawer title={t("incomingAction_void")} onClose={onClose}>
      <FormError text={formError} />
      <p className="chu-thich">{t("voidHint")}</p>
      <Field id="void-reason" label={t("reason")} error={fields.reason}>
        <textarea id="void-reason" className={inputClass("reason")} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !reason.trim()} onClick={() => void save()}>
          {t("incomingAction_void")}
        </button>
      </div>
    </Drawer>
  );
}

function AcceptDrawer({ incoming, options, onClose, onDone }: { incoming: IncomingResponse; options: DocumentOptions; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const registers = options.registers.filter((item) => item.direction === "incoming" && item.status === "active");
  const [registerId, setRegisterId] = useState(registers.find((item) => item.isDefault)?.id ?? registers[0]?.id ?? "");
  const [receivedOn, setReceivedOn] = useState(vietnamToday());
  const save = () =>
    run(async () => {
      await apiFetch(`/office/incoming/${incoming.id}/accept`, { method: "POST", body: JSON.stringify({ registerId, receivedOn, version: incoming.version }) });
      onDone();
    });
  return (
    <Drawer title={t("incomingAction_accept")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="accept-register" label={t("registerName")} error={fields.registerId}>
        <select id="accept-register" className={inputClass("registerId")} value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
          {registers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="accept-received" label={t("receivedOn")} error={fields.receivedOn}>
        <input id="accept-received" type="date" className={inputClass("receivedOn")} value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save()}>
          {t("incomingAction_accept")}
        </button>
      </div>
    </Drawer>
  );
}
