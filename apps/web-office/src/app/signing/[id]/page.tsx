"use client";

// MAN_HINH_212 Chi tiết phiên ký (CHUC_NANG_211; API_243): tiến trình người ký, ký số, từ chối, nhắc, gửi lại thư, hủy, sao chép, tải tệp.
import type { SigningRequestResponse, SigningSignerItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PdfFrame, SignerStatusBadge, SigningSource, SigningStatusBadge } from "@/components/SigningParts";
import { personLabel } from "@/components/PersonPicker";

export default function SigningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<SigningRequestResponse>(`/office/signing-requests/${id}`);
  // Có lần ký đang chờ xác nhận trên ứng dụng: tải lại mỗi 3 giây đến khi có kết quả.
  const waiting = state.kind === "ready" && state.data.signers.some((signer) => signer.lastAttempt?.status === "pending");
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [waiting, reload]);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(request) => <SigningDetail request={request} onChanged={() => void reload()} />}
    </Loaded>
  );
}

function signerName(signer: SigningSignerItem, companyName: string, t: ReturnType<typeof useTranslations>): string {
  if (signer.kind === "user") return signer.user ? personLabel(signer.user) : "—";
  if (signer.kind === "company") return t("companySealOf", { company: companyName });
  return `${signer.partner!.name} · ${t("partnerLabel")}`;
}

function SigningDetail({ request, onChanged }: { request: SigningRequestResponse; onChanged: () => void }) {
  const t = useTranslations("officeSigning");
  const { notify } = useAdmin();
  const router = useRouter();
  const [tab, setTab] = useState<"progress" | "document" | "history">("progress");
  const [dialog, setDialog] = useState<"reject" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = new Set(request.allowed);
  const mine = request.signers.find((signer) => signer.id === request.mySignerId) ?? null;
  const waitingMine = mine?.lastAttempt?.status === "pending";
  const act = async (path: string, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      const result = await apiFetch<SigningRequestResponse>(`/office/signing-requests/${request.id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      notify(message);
      if (path === "copy") router.push(`/signing/${result.id}`);
      else onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  const download = () =>
    void apiDownload(`/office/signing-requests/${request.id}/file`, request.status === "completed" ? `${request.requestNo}-da-ky.pdf` : `${request.requestNo}.pdf`).catch((error) =>
      notify(failureOf(error).message, "loi"),
    );
  return (
    <>
      <p className="chu-thich">
        <Link href="/signing">{t("title")}</Link>
      </p>
      <div className="tieu-de">
        <h1>
          {request.requestNo} · {request.title} <SigningStatusBadge status={request.status} />
        </h1>
        <div className="nhom-nut">
          {allowed.has("sign") && mine && (
            <button
              type="button"
              className={`nut chinh${busy ? " dang-xu-ly" : ""}`}
              disabled={busy || waitingMine}
              onClick={() => void act("sign", { signerId: mine.id, version: request.version }, t("signRequested"))}
            >
              {mine.kind === "company" ? t("applySeal") : t("sign")}
            </button>
          )}
          {allowed.has("reject") && (
            <button type="button" className="nut nguy-hiem" disabled={waitingMine} onClick={() => setDialog("reject")}>
              {t("reject")}
            </button>
          )}
          {allowed.has("edit") && (
            <Link className="nut phu" href={`/signing/${request.id}/edit`}>
              {t("edit")}
            </Link>
          )}
          {allowed.has("send") && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("send", { version: request.version }, t("sent"))}>
              {t("send")}
            </button>
          )}
          {allowed.has("remind") && (
            <button type="button" className="nut phu" disabled={busy} onClick={() => void act("remind", { version: request.version }, t("reminded"))}>
              {t("remind")}
            </button>
          )}
          {allowed.has("copy") && (
            <button type="button" className="nut phu" disabled={busy} onClick={() => void act("copy", {}, t("copied"))}>
              {t("copy")}
            </button>
          )}
          <button type="button" className="nut phu" onClick={download}>
            {request.status === "completed" ? t("downloadSigned") : t("download")}
          </button>
          {allowed.has("cancel") && (
            <button type="button" className="nut nguy-hiem" onClick={() => setDialog("cancel")}>
              {t("cancel")}
            </button>
          )}
        </div>
      </div>
      {waitingMine && mine?.lastAttempt && (
        <div className="khoi-canh-bao thong-tin" role="status">
          {t("awaitingConfirmation", { time: formatDateTime(mine.lastAttempt.expiresAt) })}
        </div>
      )}
      {request.endReason && <div className={`khoi-canh-bao ${request.status === "rejected" ? "loi" : "canh-bao"}`}>{t(`endReason_${request.status}`, { reason: request.endReason })}</div>}
      {request.status === "expired" && <div className="khoi-canh-bao canh-bao">{t("expiredNote")}</div>}
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("source")}</dt>
          <dd>
            <SigningSource sourceType={request.sourceType} sourceId={request.sourceId} link />
          </dd>
          <dt>{t("createdBy")}</dt>
          <dd>
            {personLabel(request.createdBy)} · {formatDateTime(request.createdAt)}
          </dd>
          <dt>{t("dueOn")}</dt>
          <dd>{formatDate(request.dueOn)}</dd>
          {request.note && (
            <>
              <dt>{t("note")}</dt>
              <dd>{request.note}</dd>
            </>
          )}
          <dt>{t("file")}</dt>
          <dd>
            {request.currentFile?.fileName ?? "—"} · {t("signatureCount", { count: request.currentFile?.signatureCount ?? 0 })}
          </dd>
          {request.copiedFromId && (
            <>
              <dt>{t("copiedFrom")}</dt>
              <dd>
                <Link href={`/signing/${request.copiedFromId}`}>{t("openSource")}</Link>
              </dd>
            </>
          )}
        </dl>
      </div>
      <div className="cac-the" role="tablist">
        {(["progress", "document", "history"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`detailTab_${item}`)}
          </button>
        ))}
      </div>
      {tab === "progress" && (
        <div className="the">
          <ol className="dong-thoi-gian">
            {request.signers.map((signer) => (
              <li key={signer.id} className={signer.status === "signed" ? "xong" : ""}>
                <span className="cham">{signer.signOrder}</span>
                <div>
                  <strong>{signerName(signer, request.companyName, t)}</strong> <SignerStatusBadge status={signer.status} />
                  {signer.lastAttempt?.status === "pending" && <span className="nhan canh-bao">{t("attemptPending")}</span>}
                  <div className="chu-thich">
                    {t("placementText", { page: signer.page === "first" || signer.page === "last" ? t(`page_${signer.page}`) : signer.page, corner: t(`corner_${signer.corner}`) })}
                  </div>
                  {signer.signedAt && (
                    <div>
                      {t("signedAtText", { time: formatDateTime(signer.signedAt), subject: signer.signerSubject ?? "" })}
                      {signer.signedBy && signer.kind === "company" && ` · ${signer.signedBy.fullName}`}
                    </div>
                  )}
                  {signer.rejectReason && <div className="loi-o">{t("rejectReasonText", { reason: signer.rejectReason })}</div>}
                  {signer.partner && (
                    <div className="chu-thich">
                      {signer.partner.email} · {signer.partner.identity}
                      {signer.linkSentAt && ` · ${t("linkSentAt", { time: formatDateTime(signer.linkSentAt) })}`}
                    </div>
                  )}
                  {signer.lastAttempt && signer.lastAttempt.status !== "pending" && signer.lastAttempt.status !== "signed" && signer.status === "current" && (
                    <div className="loi-o">{t("attemptFailed", { message: signer.lastAttempt.message ?? t(`attempt_${signer.lastAttempt.status}`) })}</div>
                  )}
                  {allowed.has("resend") && signer.kind === "partner" && signer.status === "current" && (
                    <button type="button" className="nut phu" disabled={busy} onClick={() => void act("resend", { signerId: signer.id, version: request.version }, t("resent"))}>
                      {t("resend")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {tab === "document" && (
        <div className="the">
          <PdfFrame path={`/office/signing-requests/${request.id}/file`} version={request.version} />
        </div>
      )}
      {tab === "history" && (
        <div className="the">
          <ol className="dong-thoi-gian">
            {request.events.map((event, index) => (
              <li key={event.id} className="xong">
                <span className="cham">{request.events.length - index}</span>
                <div>
                  <strong>
                    {formatDateTime(event.createdAt)} · {event.actor?.fullName ?? event.actorLabel ?? t("system")}
                  </strong>
                  <div>{t(`event_${event.kind}`)}</div>
                  {typeof event.detail.message === "string" && <div className="chu-thich">{event.detail.message}</div>}
                  {typeof event.detail.reason === "string" && <div className="chu-thich">{event.detail.reason}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {dialog && (
        <ReasonDrawer
          title={dialog === "reject" ? t("reject") : t("cancel")}
          confirmLabel={dialog === "reject" ? t("reject") : t("cancel")}
          path={`/office/signing-requests/${request.id}/${dialog}`}
          version={request.version}
          onClose={() => setDialog(null)}
          onDone={() => {
            notify(dialog === "reject" ? t("rejected") : t("cancelled"));
            setDialog(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ReasonDrawer({ title, confirmLabel, path, version, onClose, onDone }: { title: string; confirmLabel: string; path: string; version: number; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeSigning");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  return (
    <Drawer title={title} onClose={onClose}>
      <Field id="ly-do" label={t("reason")} error={fields.reason}>
        <textarea id="ly-do" className={inputClass("reason")} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
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
              await apiFetch(path, { method: "POST", body: JSON.stringify({ reason, version }) });
              onDone();
            })
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Drawer>
  );
}
