"use client";

// MAN_HINH_213 Trang ký của đối tác (CHUC_NANG_211; API_244; QUYTAC_NGHIEPVU_460): không đăng nhập, không có menu mini app.
import type { PublicSigningView } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSelect } from "ui/components/LanguageSelect";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PdfFrame } from "@/components/SigningParts";

export default function PartnerSigningPage() {
  const t = useTranslations("officeSigning");
  const { token } = useParams<{ token: string }>();
  const { state, reload } = useApi<PublicSigningView>(`/public/signing/${token}`);
  const waiting = state.kind === "ready" && state.data.state === "awaiting_confirmation";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [waiting, reload]);
  return (
    <>
      <header className="thanh-tren">
        <span className="logo">VComm</span>
        <strong>{t("partnerPageBrand")}</strong>
        <span className="gian" />
        <LanguageSelect />
      </header>
      <main className="noi-dung" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
        {state.kind === "notFound" ? (
          <div className="khoi-canh-bao loi" role="alert">
            {t("linkUnavailable")}
          </div>
        ) : (
          <Loaded state={state} onRetry={() => void reload()}>
            {(view) => <PartnerSigning token={token} view={view} onChanged={() => void reload()} />}
          </Loaded>
        )}
      </main>
    </>
  );
}

function PartnerSigning({ token, view, onChanged }: { token: string; view: PublicSigningView; onChanged: () => void }) {
  const t = useTranslations("officeSigning");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  };
  if (view.state === "signed") return <div className="khoi-canh-bao thanh-cong">{t("partnerSigned", { title: view.title })}</div>;
  if (view.state === "rejected") return <div className="khoi-canh-bao canh-bao">{t("partnerRejected", { title: view.title })}</div>;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("partnerInvite", { company: view.companyName })}</h1>
      </div>
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("document")}</dt>
          <dd>{view.title}</dd>
          <dt>{t("partnerSignerLabel")}</dt>
          <dd>
            {view.partnerName} · {view.partnerIdentity}
          </dd>
          <dt>{t("dueOn")}</dt>
          <dd>{formatDate(view.dueOn)}</dd>
          {view.note && (
            <>
              <dt>{t("note")}</dt>
              <dd>{view.note}</dd>
            </>
          )}
        </dl>
      </div>
      {view.state === "awaiting_confirmation" ? (
        <div className="khoi-canh-bao thong-tin" role="status">
          {t("partnerAwaiting", { code: view.identityCode, time: formatDateTime(view.attemptExpiresAt) })}
        </div>
      ) : (
        <div className="khoi-canh-bao thong-tin">{t("partnerSignHint", { code: view.identityCode })}</div>
      )}
      {view.lastFailure && view.state === "ready" && <div className="khoi-canh-bao loi">{t("attemptFailed", { message: view.lastFailure })}</div>}
      {error && (
        <div className="khoi-canh-bao loi" role="alert">
          {error}
        </div>
      )}
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={() => void apiDownload(`/public/signing/${token}/file`, `${view.title}.pdf`).catch((failure) => setError(failureOf(failure).message))}>
          {t("download")}
        </button>
        <button type="button" className="nut nguy-hiem" disabled={busy || view.state !== "ready"} onClick={() => setRejecting(true)}>
          {t("reject")}
        </button>
        <button
          type="button"
          className={`nut chinh${busy ? " dang-xu-ly" : ""}`}
          disabled={busy || view.state !== "ready"}
          onClick={() => void run(() => apiFetch(`/public/signing/${token}/sign`, { method: "POST" }))}
        >
          {t("sign")}
        </button>
      </div>
      {rejecting && (
        <div className="the">
          <div className="truong">
            <label htmlFor="ly-do-doi-tac">{t("reason")}</label>
            <textarea id="ly-do-doi-tac" className="o-nhap" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="nut phu" onClick={() => setRejecting(false)}>
              {t("close")}
            </button>
            <button
              type="button"
              className="nut nguy-hiem"
              disabled={busy || !reason.trim()}
              onClick={() => void run(() => apiFetch(`/public/signing/${token}/reject`, { method: "POST", body: JSON.stringify({ reason }) }))}
            >
              {t("reject")}
            </button>
          </div>
        </div>
      )}
      <div className="the">
        <PdfFrame path={`/public/signing/${token}/file`} version={view.state} withCompany={false} />
      </div>
      <p className="chu-thich">{t("partnerLinkNote")}</p>
    </>
  );
}
