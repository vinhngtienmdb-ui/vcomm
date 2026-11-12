"use client";

// MAN_HINH_183 Chi tiết đánh giá lại ngoại tệ (CONG_VIEC_56; QUYTAC_NGHIEPVU_412, 413; API_216, API_217): tỷ giá theo tiền tệ (sửa được), dòng quỹ và khoản nợ,
// lãi, lỗ, thuần; lấy lại số dư, lưu, ghi sổ, hủy.
import type { FxRevaluationResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { Field, FormError } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function RevaluationPage() {
  const t = useTranslations("revaluations");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<FxRevaluationResponse>(`/finance/revaluations/${id}`);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const data = state.kind === "ready" ? state.data : null;

  useEffect(() => {
    if (!data) return;
    setRates(Object.fromEntries(data.rates.map((rate) => [rate.currency, rate.rate ?? ""])));
    setNote(data.note ?? "");
  }, [data]);

  async function act(revaluation: FxRevaluationResponse, action: "save" | "refresh" | "post" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      // Ghi sổ lưu tỷ giá, nội dung đang nhập trước.
      let version = revaluation.version;
      if (action === "save" || action === "post") {
        version = (
          await apiFetch<FxRevaluationResponse>(`/finance/revaluations/${revaluation.id}`, {
            method: "PATCH",
            body: JSON.stringify({ note, rates: Object.entries(rates).map(([currency, rate]) => ({ currency, rate })), version }),
          })
        ).version;
      }
      if (action !== "save") await apiFetch(`/finance/revaluations/${revaluation.id}/${action}`, { method: "POST", body: JSON.stringify({ version }) });
      notify(t(action === "save" ? "saved" : action === "refresh" ? "refreshed" : action === "post" ? "posted" : "cancelled"));
      setConfirming(false);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/revaluations">‹ {t("back")}</Link>
      <Loaded state={state} onRetry={() => void reload()}>
        {(revaluation) => {
          const money = (value: string) => formatMoney(value, revaluation.currency);
          const headings = [t("group"), t("item"), t("foreignAmount"), t("bookValue"), t("newValue"), t("difference")];
          const edit = revaluation.canManage;
          return (
            <>
              <div className="tieu-de">
                <h1>
                  {t("title")} {revaluation.documentNo ?? t("draftNo")}
                </h1>
                <span className={`nhan ${revaluation.status === "posted" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${revaluation.status}`)}</span>
                <HistoryLink entityType="fx_revaluation" entityId={revaluation.id} />
                {edit && (
                  <>
                    <button type="button" className="nut nguy-hiem" disabled={busy} onClick={() => void act(revaluation, "cancel")}>
                      {t("cancel")}
                    </button>
                    <button type="button" className="nut phu" disabled={busy} onClick={() => void act(revaluation, "refresh")}>
                      {t("refresh")}
                    </button>
                    <button type="button" className="nut phu" disabled={busy} onClick={() => void act(revaluation, "save")}>
                      {t("save")}
                    </button>
                    <button type="button" className="nut chinh" disabled={busy} onClick={() => setConfirming(true)}>
                      {t("post")}
                    </button>
                  </>
                )}
              </div>
              <FormError text={confirming ? null : error} />
              <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                <div className="thong-tin-dong">
                  <span>
                    {t("revaluationDate")}: <strong>{formatDate(revaluation.revaluationDate)}</strong>
                  </span>
                  <span>
                    {t("createdBy")}: {revaluation.createdByName}
                  </span>
                  {revaluation.postedAt && (
                    <span>
                      {t("postedAt")}: {formatDateTime(revaluation.postedAt)}
                    </span>
                  )}
                </div>
                <strong>{t("rates")}</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
                  {revaluation.rates.map((rate) => {
                    const value = rates[rate.currency] ?? "";
                    const edited = rate.sourceRate !== null && value !== "" && Number(value) !== Number(rate.sourceRate);
                    return (
                      <Field
                        key={rate.currency}
                        id={`ty-gia-${rate.currency}`}
                        label={t("rateOf", { currency: rate.currency, base: revaluation.currency })}
                        hint={rate.sourceRate ? t("sourceRate", { rate: formatNumber(rate.sourceRate) }) : t("noSourceRate")}
                      >
                        <span className="nhom-nut">
                          <input
                            id={`ty-gia-${rate.currency}`}
                            className="o-nhap"
                            inputMode="decimal"
                            disabled={!edit}
                            value={value}
                            onChange={(event) => setRates({ ...rates, [rate.currency]: event.target.value })}
                          />
                          {edited && <span className="nhan canh-bao">{t("edited")}</span>}
                        </span>
                      </Field>
                    );
                  })}
                </div>
                <Field id="noi-dung-danh-gia" label={t("note")}>
                  <input id="noi-dung-danh-gia" className="o-nhap" disabled={!edit} value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
              </section>
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
                    {revaluation.lines.map((line) => {
                      const difference = Number(line.difference ?? 0);
                      return (
                        <tr key={line.id}>
                          <td data-nhan={headings[0]}>
                            <span>{t(`group_${line.kind}`)}</span>
                          </td>
                          <td data-nhan={headings[1]}>
                            {line.fund ? (
                              <Link href={`/funds/${line.fund.id}`}>
                                {line.fund.code} · {line.fund.name}
                              </Link>
                            ) : (
                              <span>
                                {line.debt?.documentNo} · {line.debt?.partnerName}
                              </span>
                            )}
                          </td>
                          <td data-nhan={headings[2]}>
                            <span style={{ whiteSpace: "nowrap" }}>{formatMoney(line.foreignAmount, line.currency)}</span>
                          </td>
                          <td data-nhan={headings[3]}>
                            <span>
                              {money(line.bookValue)}
                              {line.bookRate && <span className="chu-thich"> · {t("bookRate", { rate: formatNumber(line.bookRate, 2) })}</span>}
                            </span>
                          </td>
                          <td data-nhan={headings[4]}>
                            <span>{line.newValue === null ? "—" : money(line.newValue)}</span>
                          </td>
                          <td data-nhan={headings[5]}>
                            <span>
                              {line.difference === null ? "—" : `${difference > 0 ? "+" : ""}${money(line.difference)}`}
                              {line.kind === "payable" && difference !== 0 && ` (${difference > 0 ? t("payableUp") : t("payableDown")})`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <span>
                  {t("gain")}: <strong>{money(revaluation.gain)}</strong> · {t("loss")}: <strong>{money(revaluation.loss)}</strong> ·{" "}
                  <strong>{Number(revaluation.net) >= 0 ? t("netGain", { amount: money(revaluation.net) }) : t("netLoss", { amount: money(String(-Number(revaluation.net))) })}</strong>
                </span>
                <span className="chu-thich">{t("journalHint")}</span>
                <span className="chu-thich">{t("taxHint")}</span>
              </section>
              {confirming && (
                <ConfirmDialog
                  title={t("post")}
                  text={t("postConfirm")}
                  confirmLabel={t("post")}
                  busy={busy}
                  error={error}
                  onConfirm={() => void act(revaluation, "post")}
                  onClose={() => setConfirming(false)}
                />
              )}
            </>
          );
        }}
      </Loaded>
    </>
  );
}
