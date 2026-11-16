"use client";

// MAN_HINH_221 Vụ việc gian lận (CONG_VIEC_60; CHUC_NANG_215; API_252; QUYTAC_NGHIEPVU_477): danh sách (lọc quy tắc, trạng thái, mức), chi tiết, nhận xem xét, kết luận.
import {
  loyaltyFraudActions,
  loyaltyFraudCaseStatuses,
  loyaltyFraudRuleCodes,
  type LoyaltyFraudAction,
  type LoyaltyFraudCaseDetail,
  type LoyaltyFraudCaseItem,
  type LoyaltyFraudCaseStatus,
  type PageResponse,
} from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const statusTone: Record<LoyaltyFraudCaseStatus, string> = { new: "thong-tin", reviewing: "canh-bao", violation: "loi", no_violation: "trung-tinh" };
const actionTone: Record<LoyaltyFraudAction, string> = { alert: "thong-tin", block: "canh-bao", block_and_lock: "loi" };

export default function FraudCasesPage() {
  const t = useTranslations("loyaltyFraud");
  const [filter, setFilter] = useState({ ruleCode: "", status: "open", action: "" });
  const [selected, setSelected] = useState<string | null>(null);
  const query = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, value]) => value)));
  const { state, reload } = useApi<PageResponse<LoyaltyFraudCaseItem> & { canManage: boolean }>(`/loyalty/fraud-cases?${query.toString()}`);
  const subject = (item: LoyaltyFraudCaseItem) =>
    item.subjectKind === "device"
      ? t("subjectDevice", { device: item.device ?? "", count: Number(item.metrics.accounts ?? 0) })
      : item.subjectKind === "staff"
        ? t("subjectStaff", { name: item.staffName ?? "", company: item.companyName ?? "" })
        : `${item.userName ?? ""}${item.userPhone ? ` · ${item.userPhone}` : ""}`;
  const headings = [t("documentNo"), t("day"), t("rule"), t("subject"), t("hits"), t("action"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("casesTitle")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="gl-loc-quy-tac">
          {t("rule")}
        </label>
        <select id="gl-loc-quy-tac" className="o-nhap" style={{ width: "auto" }} value={filter.ruleCode} onChange={(event) => setFilter({ ...filter, ruleCode: event.target.value })}>
          <option value="">{t("allRules")}</option>
          {loyaltyFraudRuleCodes.map((code) => (
            <option key={code} value={code}>
              {t(`rule_${code}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="gl-loc-trang-thai">
          {t("status")}
        </label>
        <select id="gl-loc-trang-thai" className="o-nhap" style={{ width: "auto" }} value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}>
          <option value="open">{t("status_open")}</option>
          {loyaltyFraudCaseStatuses.map((status) => (
            <option key={status} value={status}>
              {t(`status_${status}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="gl-loc-muc">
          {t("action")}
        </label>
        <select id="gl-loc-muc" className="o-nhap" style={{ width: "auto" }} value={filter.action} onChange={(event) => setFilter({ ...filter, action: event.target.value })}>
          <option value="">{t("allActions")}</option>
          {loyaltyFraudActions.map((item) => (
            <option key={item} value={item}>
              {t(`action_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noCases")} />
          ) : (
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <button type="button" className="nut chu" onClick={() => setSelected(item.id)}>
                          {item.documentNo}
                        </button>
                      </td>
                      <td data-nhan={headings[1]}>{formatDate(item.caseDay)}</td>
                      <td data-nhan={headings[2]}>{t(`rule_${item.ruleCode}`)}</td>
                      <td data-nhan={headings[3]}>{subject(item)}</td>
                      <td data-nhan={headings[4]} className="so-tien">
                        {item.hitCount}
                      </td>
                      <td data-nhan={headings[5]}>
                        <span className={`nhan ${actionTone[item.action]}`}>{t(`action_${item.action}`)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className={`nhan ${statusTone[item.status]}`}>{t(`status_${item.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {selected ? <CaseDetail key={selected} id={selected} onChanged={() => void reload()} /> : null}
    </>
  );
}

function CaseDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const t = useTranslations("loyaltyFraud");
  const { notify } = useAdmin();
  const { state, reload } = useApi<LoyaltyFraudCaseDetail & { canManage: boolean }>(`/loyalty/fraud-cases/${id}`);
  const [violation, setViolation] = useState("violation");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(path: string, body: object, message: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/loyalty/fraud-cases/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      notify(message);
      await reload();
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(item) => (
        <div className="the" style={{ display: "grid", gap: "var(--khoang-3)", marginTop: "var(--khoang-4)" }}>
          <h2>{t("detailTitle", { number: item.documentNo, rule: t(`rule_${item.ruleCode}`) })}</h2>
          <div className="khung-bang">
            <table>
              <tbody>
                <tr>
                  <td>{t("metrics")}</td>
                  <td>{t(`metrics_${item.ruleCode}`, Object.fromEntries(Object.entries(item.metrics).map(([key, value]) => [key, String(value ?? "—")])) as never)}</td>
                </tr>
                {item.userId ? (
                  <tr>
                    <td>{t("account")}</td>
                    <td>
                      <Link href={`/loyalty/accounts/${item.userId}`}>{`${item.userName ?? ""}${item.userPhone ? ` · ${item.userPhone}` : ""}`}</Link>
                    </td>
                  </tr>
                ) : null}
                {item.deviceAccounts.length > 0 ? (
                  <tr>
                    <td>{t("deviceAccounts", { device: item.device ?? "" })}</td>
                    <td>{item.deviceAccounts.join(", ")}</td>
                  </tr>
                ) : null}
                {item.staffName ? (
                  <tr>
                    <td>{t("staff")}</td>
                    <td>{`${item.staffName} · ${item.companyName ?? ""}`}</td>
                  </tr>
                ) : null}
                <tr>
                  <td>{t("documents")}</td>
                  <td>
                    {item.documents.map((document, index) => (
                      <div
                        key={index}
                      >{`${formatDateTime(document.createdAt)} · ${document.documentNo ?? t(`source_${document.sourceType}` as never)} · ${t(`effect_${document.effect}` as never)}${document.userName ? ` · ${document.userName}` : ""}`}</div>
                    ))}
                  </td>
                </tr>
                {item.reviewerName ? (
                  <tr>
                    <td>{t("reviewer")}</td>
                    <td>{`${item.reviewerName}${item.conclusionNote ? ` · ${item.conclusionNote}` : ""}`}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <FormError text={error} />
          {item.canManage && item.status === "new" ? (
            <div className="nhom-nut">
              <button type="button" className="nut phu" disabled={busy} onClick={() => void act("review", { version: item.version }, t("reviewing"))}>
                {t("review")}
              </button>
            </div>
          ) : null}
          {item.canManage && (item.status === "new" || item.status === "reviewing") ? (
            <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
                <Field id="gl-ket-luan" label={t("conclusion")}>
                  <select id="gl-ket-luan" className="o-nhap" value={violation} onChange={(event) => setViolation(event.target.value)}>
                    <option value="violation">{t("status_violation")}</option>
                    <option value="no_violation">{t("status_no_violation")}</option>
                  </select>
                </Field>
                <Field id="gl-ghi-chu" label={t("note")}>
                  <textarea id="gl-ghi-chu" className="o-nhap" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
              </div>
              <div className="nhom-nut">
                <button
                  type="button"
                  className="nut chinh"
                  disabled={busy || note.trim() === ""}
                  onClick={() => void act("conclude", { version: item.version, violation: violation === "violation", note }, t("concluded"))}
                >
                  {t("saveConclusion")}
                </button>
              </div>
              <span className="chu-thich">{t("conclusionHint")}</span>
            </div>
          ) : null}
        </div>
      )}
    </Loaded>
  );
}
