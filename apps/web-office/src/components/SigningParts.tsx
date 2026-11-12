"use client";

// Phần dùng chung của ký số (CONG_VIEC_59): nhãn trạng thái, xem PDF, tài khoản ký số của tôi.
import type { MySigningIdentity, SigningCertificateOption, SigningRequestStatus, SigningSignerStatus } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, selectedCompanyId } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const requestTone: Record<SigningRequestStatus, string> = {
  draft: "trung-tinh",
  signing: "thong-tin",
  completed: "thanh-cong",
  rejected: "loi",
  cancelled: "trung-tinh",
  expired: "canh-bao",
};
const signerTone: Record<SigningSignerStatus, string> = { waiting: "trung-tinh", current: "thong-tin", signed: "thanh-cong", rejected: "loi" };

export function SigningStatusBadge({ status }: { status: SigningRequestStatus }) {
  const t = useTranslations("officeSigning");
  return <span className={`nhan ${requestTone[status]}`}>{t(`status_${status}`)}</span>;
}

export function SignerStatusBadge({ status }: { status: SigningSignerStatus }) {
  const t = useTranslations("officeSigning");
  return <span className={`nhan ${signerTone[status]}`}>{t(`signerStatus_${status}`)}</span>;
}

// Tệp PDF tải qua fetch (kèm cookie phiên hoặc mã đường dẫn) rồi hiện bằng trình xem PDF có sẵn của trình duyệt.
export function PdfFrame({ path, version, withCompany = true }: { path: string; version: number | string; withCompany?: boolean }) {
  const t = useTranslations("officeSigning");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    const headers: Record<string, string> = {};
    const companyId = withCompany ? selectedCompanyId() : null;
    if (companyId) headers["x-company-id"] = companyId;
    setFailed(false);
    fetch(`/api/v1${path}`, { credentials: "same-origin", headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        objectUrl = URL.createObjectURL(await response.blob());
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, version, withCompany]);
  if (failed) return <p className="chu-thich">{t("previewFailed")}</p>;
  if (!url) return <p className="chu-thich">{t("previewLoading")}</p>;
  return <iframe title={t("preview")} src={url} style={{ width: "100%", height: "70vh", border: "1px solid var(--mau-vien)", borderRadius: "var(--bo-vua)" }} />;
}

// MAN_HINH_210: ô "Tài khoản ký số của tôi" (QUYTAC_NGHIEPVU_455).
export function MyIdentityCard() {
  const t = useTranslations("officeSigning");
  const { state, reload } = useApi<MySigningIdentity>("/office/signing-identities/me");
  const [open, setOpen] = useState(false);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
        <>
          {!data.configured ? (
            <div className="khoi-canh-bao canh-bao">{t("providerNotConfigured")}</div>
          ) : !data.identity ? (
            <div className="khoi-canh-bao canh-bao">
              {t("identityMissing")}{" "}
              <button type="button" className="nut phu" onClick={() => setOpen(true)}>
                {t("identityDeclare")}
              </button>
            </div>
          ) : (
            <div className="the">
              <div className="tieu-de">
                <h2>{t("myIdentity")}</h2>
                <button type="button" className="nut phu" onClick={() => setOpen(true)}>
                  {t("identityChange")}
                </button>
              </div>
              <dl className="thong-tin-dong">
                <dt>{t("provider")}</dt>
                <dd>{t(`provider_${data.provider ?? "simulator"}`)}</dd>
                <dt>{t("certificate")}</dt>
                <dd>
                  {data.identity.subjectName} · {data.identity.identities.join(", ")}
                </dd>
                <dt>{t("validity")}</dt>
                <dd>
                  {formatDate(data.identity.validFrom.slice(0, 10))} – {formatDate(data.identity.validTo.slice(0, 10))}{" "}
                  <span className={`nhan ${data.identity.usable ? "thanh-cong" : "loi"}`}>{data.identity.usable ? t("usable") : t("notUsable")}</span>
                </dd>
              </dl>
            </div>
          )}
          {open && (
            <CertificateDrawer
              title={t("myIdentity")}
              identityLabel={t("identityCodePerson")}
              listPath="/office/signing-identities/me/certificates"
              selectPath="/office/signing-identities/me"
              initialCode={data.identity?.identityCode ?? ""}
              onClose={() => setOpen(false)}
              onSaved={() => {
                setOpen(false);
                void reload();
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}

// Khai mã định danh tại nhà cung cấp, lấy danh sách chứng thư, chọn một (dùng cho tài khoản của tôi và chữ ký số công ty).
export function CertificateDrawer({
  title,
  identityLabel,
  listPath,
  selectPath,
  initialCode,
  onClose,
  onSaved,
}: {
  title: string;
  identityLabel: string;
  listPath: string;
  selectPath: string;
  initialCode: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("officeSigning");
  const { notify } = useAdmin();
  const [code, setCode] = useState(initialCode);
  const [options, setOptions] = useState<SigningCertificateOption[] | null>(null);
  const [serial, setSerial] = useState("");
  const lookup = useSubmit();
  const save = useSubmit();
  return (
    <Drawer title={title} onClose={onClose}>
      <Field id="ma-dinh-danh" label={identityLabel} error={lookup.fields.identityCode} hint={t("identityCodeHint")}>
        <input id="ma-dinh-danh" className={lookup.inputClass("identityCode")} value={code} onChange={(event) => setCode(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button
          type="button"
          className={`nut phu${lookup.submitting ? " dang-xu-ly" : ""}`}
          disabled={lookup.submitting || !code.trim()}
          onClick={() =>
            void lookup.run(async () => {
              const list = await apiFetch<SigningCertificateOption[]>(listPath, { method: "POST", body: JSON.stringify({ identityCode: code.trim() }) });
              setOptions(list);
              setSerial(list.find((item) => item.usable)?.serialNumber ?? "");
            })
          }
        >
          {t("lookupCertificates")}
        </button>
      </div>
      <FormError text={lookup.formError} />
      {options && (
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{t("chooseCertificate")}</legend>
          {options.map((option) => (
            <label key={option.serialNumber} style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "flex-start" }}>
              <input type="radio" name="chung-thu" value={option.serialNumber} disabled={!option.usable} checked={serial === option.serialNumber} onChange={() => setSerial(option.serialNumber)} />
              <span>
                <strong>{option.subjectName}</strong> · {option.identities.join(", ")}
                <br />
                <span className="chu-thich">
                  {option.issuerName} · {formatDate(option.validFrom.slice(0, 10))} – {formatDate(option.validTo.slice(0, 10))}
                  {!option.usable && ` · ${t("notUsable")}`}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <FormError text={save.formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut chinh${save.submitting ? " dang-xu-ly" : ""}`}
          disabled={save.submitting || !serial}
          onClick={() =>
            void save.run(async () => {
              await apiFetch(selectPath, { method: "PUT", body: JSON.stringify({ identityCode: code.trim(), serialNumber: serial }) });
              notify(t("certificateSaved"));
              onSaved();
            })
          }
        >
          {t("save")}
        </button>
      </div>
    </Drawer>
  );
}
