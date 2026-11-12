"use client";

// MAN_HINH_214 Kiểm tra chữ ký PDF (CHUC_NANG_210; API_245; QUYTAC_NGHIEPVU_461): hệ thống không lưu tệp.
import type { SignatureVerificationResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { MessageView } from "ui/components/StatusViews";
import { apiUpload } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";

const tone = { valid: "thanh-cong", untrusted: "canh-bao", invalid: "loi" } as const;

export default function SignatureCheckPage() {
  const t = useTranslations("officeSigning");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SignatureVerificationResponse | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const yesNo = (value: boolean, yes: string, no: string) => <span className={`nhan ${value ? "thanh-cong" : "loi"}`}>{value ? yes : no}</span>;
  const headings = ["#", t("signerName"), t("issuer"), t("signingTime"), t("integrity"), t("validAtSigningTime"), t("trusted"), t("conclusion")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("checkTitle")}</h1>
      </div>
      <div className="the">
        <Field id="tep-kiem-tra" label={t("checkFile")} error={fields.file} hint={t("checkHint")}>
          <input id="tep-kiem-tra" type="file" accept=".pdf,application/pdf" className={inputClass("file")} onChange={(event) => (setFile(event.target.files?.[0] ?? null), setResult(null))} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button
            type="button"
            className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
            disabled={!file || submitting}
            onClick={() =>
              void run(async () => {
                const form = new FormData();
                form.append("file", file!);
                setResult(await apiUpload<SignatureVerificationResponse>("/office/signature-verifications", form));
              })
            }
          >
            {t("check")}
          </button>
        </div>
      </div>
      {result &&
        (result.signatures.length === 0 ? (
          <MessageView text={t("noSignatures")} />
        ) : (
          <div className="the">
            <h2>{t("checkResult", { file: result.fileName, count: result.signatures.length })}</h2>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.signatures.map((item) => (
                    <tr key={item.index}>
                      <td data-nhan={headings[0]}>
                        <span>{item.index}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {item.signerName ?? "—"}
                          {item.signerIdentities.length > 0 && ` · ${item.signerIdentities.join(", ")}`}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.issuerName ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatDateTime(item.signingTime)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{yesNo(item.integrity, t("integrityYes"), t("integrityNo"))}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{yesNo(item.validAtSigningTime, t("validYes"), t("validNo"))}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{item.trusted ? <span className="nhan thanh-cong">{t("trustedYes")}</span> : <span className="nhan canh-bao">{t("trustedNo")}</span>}</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span className={`nhan ${tone[item.conclusion]}`}>{t(`conclusion_${item.conclusion}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.signatures.some((item) => !item.coversWholeFile && item.index === result.signatures.length) && <div className="khoi-canh-bao canh-bao">{t("appendedAfterLast")}</div>}
            <p className="chu-thich">{t("revocationNotChecked")}</p>
          </div>
        ))}
    </>
  );
}
