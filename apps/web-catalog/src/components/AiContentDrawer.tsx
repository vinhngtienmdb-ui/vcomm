"use client";

// MAN_HINH_243 Soạn nội dung sản phẩm bằng AI (CONG_VIEC_63; CHUC_NANG_228; API_277; QUYTAC_NGHIEPVU_522, 523).
// Chỉ soạn nháp; "Dùng" điền vào biểu mẫu, người dùng tự bấm Lưu của biểu mẫu sản phẩm.
import { aiContentLengths, aiContentTones, type AiFeatureStatus, type AiMeResponse, type ProductContentRequest, type ProductContentResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";

// Trạng thái tính năng soạn nội dung của người dùng; null khi không có quyền (ẩn nút).
export function useProductContentStatus(): [AiFeatureStatus | null, AiMeResponse | null] {
  const [status, setStatus] = useState<AiMeResponse | null>(null);
  useEffect(() => {
    let active = true;
    apiFetch<AiMeResponse>("/ai/me")
      .then((value) => active && setStatus(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const feature = status?.features.find((item) => item.feature === "product_content" && item.permitted) ?? null;
  return [feature, status];
}

export function AiContentDrawer({
  status,
  me,
  request,
  onUse,
  onClose,
}: {
  status: AiFeatureStatus;
  me: AiMeResponse;
  request: () => Omit<ProductContentRequest, "tone" | "length" | "keywords">;
  onUse: (part: "description" | "highlights", text: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("aiContent");
  const assistant = useTranslations("aiAssistant");
  const [tone, setTone] = useState<(typeof aiContentTones)[number]>("professional");
  const [length, setLength] = useState<(typeof aiContentLengths)[number]>("medium");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<ProductContentResponse | null>(null);
  const [remaining, setRemaining] = useState(me.remainingTurnsToday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function compose() {
    setBusy(true);
    setError(null);
    try {
      const body: ProductContentRequest = {
        ...request(),
        tone,
        length,
        keywords: keywords
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 10),
      };
      const response = await apiFetch<ProductContentResponse>("/ai/product-content", { method: "POST", body: JSON.stringify(body) });
      setResult(response);
      setRemaining(response.remainingTurnsToday);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  const highlightsText = result ? result.highlights.map((item) => `- ${item}`).join("\n") : "";
  const blocked = status.reason && status.reason !== "notice_required" ? assistant(`unavailable_${status.reason}` as "unavailable_disabled", { time: formatDateTime(status.reopensAt) }) : null;

  return (
    <Drawer title={`✦ ${t("title")}`} onClose={onClose}>
      {status.reason === "notice_required" ? (
        <div className="khoi-canh-bao canh-bao" role="status">
          {t("noticeRequired")}
        </div>
      ) : blocked ? (
        <div className="khoi-canh-bao canh-bao" role="status">
          {blocked}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
            <Field id="giong-van" label={t("tone")}>
              <select id="giong-van" className="o-nhap" value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
                {aiContentTones.map((item) => (
                  <option key={item} value={item}>
                    {t(`tone_${item}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="do-dai" label={t("length")}>
              <select id="do-dai" className="o-nhap" value={length} onChange={(event) => setLength(event.target.value as typeof length)}>
                {aiContentLengths.map((item) => (
                  <option key={item} value={item}>
                    {t(`length_${item}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="tu-khoa" label={t("keywords")}>
            <input id="tu-khoa" className="o-nhap" maxLength={550} value={keywords} onChange={(event) => setKeywords(event.target.value)} />
          </Field>
          <div className="nhom-nut" style={{ alignItems: "center" }}>
            <span className="chu-thich" style={{ flex: 1 }}>
              {assistant("remaining", { remaining, total: me.dailyTurns })}
            </span>
            <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void compose()}>
              {result ? t("rewrite") : t("compose")}
            </button>
          </div>
          {error && (
            <div className="khoi-canh-bao loi" role="alert">
              {error}
            </div>
          )}
          {!result && !busy && !error && <div className="chu-thich">{t("hint")}</div>}
          {busy && <div className="chu-thich">{t("composing")}</div>}
          {result && (
            <div style={{ display: "grid", gap: "var(--khoang-3)" }} aria-live="polite">
              <section className="the">
                <div className="nhom-nut" style={{ alignItems: "center" }}>
                  <h3 style={{ margin: 0, flex: 1 }}>{t("description")}</h3>
                  <button type="button" className="nut phu" onClick={() => onUse("description", result.description)}>
                    {t("use")}
                  </button>
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.description}</p>
              </section>
              <section className="the">
                <div className="nhom-nut" style={{ alignItems: "center" }}>
                  <h3 style={{ margin: 0, flex: 1 }}>{t("highlights")}</h3>
                  <button type="button" className="nut phu" onClick={() => onUse("highlights", highlightsText)}>
                    {t("appendHighlights")}
                  </button>
                </div>
                <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
                  {result.highlights.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
              <section className="the">
                <div className="nhom-nut" style={{ alignItems: "center" }}>
                  <h3 style={{ margin: 0, flex: 1 }}>
                    {t("listing")} <span className="chu-thich">{t("characters", { count: result.listingDescription.length })}</span>
                  </h3>
                  <button
                    type="button"
                    className="nut phu"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(result.listingDescription)
                        .then(() => setCopied(true))
                        .catch(() => undefined)
                    }
                  >
                    {copied ? t("copied") : t("copy")}
                  </button>
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.listingDescription}</p>
                <span className="chu-thich">{t("listingHint")}</span>
              </section>
              <div className="khoi-canh-bao canh-bao" role="status">
                {result.missing.length > 0 ? t("missing", { list: result.missing.join(", ") }) : t("review")}
              </div>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
