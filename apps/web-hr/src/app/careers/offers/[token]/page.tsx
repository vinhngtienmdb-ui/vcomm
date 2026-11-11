"use client";

// MAN_HINH_171 trang trả lời đề nghị nhận việc qua liên kết riêng, không đăng nhập (CONG_VIEC_54; QUYTAC_NGHIEPVU_386; API_203).
import type { OfferAnswerPageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { CareersFrame } from "@/components/CareersFrame";

export default function OfferAnswerPage() {
  const t = useTranslations("careers");
  const { token } = useParams<{ token: string }>();
  const { state, reload } = useApi<OfferAnswerPageResponse>(`/job-offer-responses/${token}`);
  const [result, setResult] = useState<OfferAnswerPageResponse | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [note, setNote] = useState("");
  const answer = (accepted: boolean) =>
    void run(async () => {
      setResult(await apiFetch<OfferAnswerPageResponse>(`/job-offer-responses/${token}`, { method: "POST", body: JSON.stringify({ accepted, note }) }));
    });
  return (
    <CareersFrame>
      <Loaded state={state} onRetry={() => void reload()}>
        {(loaded) => {
          const offer = result ?? loaded;
          return (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h1>{t("offerTitle", { company: offer.companyName })}</h1>
              <p style={{ margin: 0 }}>{t("offerGreeting", { name: offer.candidateName })}</p>
              <dl className="thong-tin-dong">
                <dt>{t("offerJobTitle")}</dt>
                <dd>{offer.jobTitle}</dd>
                <dt>{t("offerPlace")}</dt>
                <dd>
                  {offer.departmentName} · {offer.branchName}
                </dd>
                <dt>{t("salary")}</dt>
                <dd>
                  {formatNumber(offer.salary, 0)} {t("currencyUnit")}
                </dd>
                <dt>{t("offerStart")}</dt>
                <dd>{formatDate(offer.startDate)}</dd>
                <dt>{t("offerDeadline")}</dt>
                <dd>{formatDate(offer.responseDeadline)}</dd>
              </dl>
              {offer.answered ? (
                <div className="khoi-canh-bao thong-tin">{offer.answered === "accepted" ? t("offerAccepted") : t("offerDeclined")}</div>
              ) : (
                <>
                  <FormError text={formError} />
                  <Field id="tra-loi-ghi-chu" label={t("offerNote")} error={fields.note}>
                    <textarea id="tra-loi-ghi-chu" rows={2} className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
                  </Field>
                  <div className="nhom-nut">
                    <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => answer(true)}>
                      {t("offerAccept")}
                    </button>
                    <button type="button" className="nut nguy-hiem" disabled={submitting} onClick={() => answer(false)}>
                      {t("offerDecline")}
                    </button>
                  </div>
                  <span className="chu-thich">{t("offerOnce")}</span>
                </>
              )}
            </div>
          );
        }}
      </Loaded>
    </CareersFrame>
  );
}
