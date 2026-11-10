"use client";

// MAN_HINH_62 Hợp nhất (CHUC_NANG_92, 93, 95; QUYTAC_NGHIEPVU_123, 124, 128; API_106): phạm vi thành viên, bảng hợp nhất theo kỳ, xem nhanh số cộng gộp.
import type { ConsolidatedStatementResponse, ConsolidationResponse, ConsolidationScopeResponse, ConsolidationsResponse, StatementKind } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CollectionStatusBadge as StatusBadge } from "@/components/CollectionStatusBadge";
import { FormError, useSubmit } from "ui/components/Form";
import { MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { ConsolidatedStatementTable } from "@/components/ConsolidatedStatementTable";
import { Loaded } from "ui/components/StatusViews";
import { vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function ConsolidationPage() {
  const t = useTranslations("consolidation");
  const statements = useTranslations("statements");
  const today = vietnamToday();
  const scope = useApi<ConsolidationScopeResponse>("/finance/consolidation/scope");
  const [view, setView] = useState<"statements" | "preview">("statements");
  const [kind, setKind] = useState<StatementKind>("balance_sheet");
  const [from, setFrom] = useState(`${today.slice(0, 5)}01-01`);
  const [to, setTo] = useState(today);
  const valid = Boolean(from) && Boolean(to) && from <= to;
  const preview = useApi<ConsolidatedStatementResponse>(valid && scope.state.kind === "ready" ? `/finance/consolidation/preview?kind=${kind}&from=${from}&to=${to}` : null);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <Loaded state={scope.state} onRetry={() => void scope.reload()}>
        {(result) => (
          <section className="the" style={{ marginBottom: "var(--khoang-4)" }} aria-label={t("members")}>
            <h2 style={{ marginTop: 0 }}>{t("groupTitle", { name: result.group.name, currency: result.currency })}</h2>
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)", display: "grid", gap: "var(--khoang-1)" }}>
              {result.members.map((member) => (
                <li key={member.companyId}>
                  <strong>{member.name}</strong>
                  <span className="chu-thich">
                    {" "}
                    · {member.code} · {t(`regime_${member.regime}`)} · {member.currency}
                    {member.isRoot && ` · ${t("root")}`}
                  </span>{" "}
                  {member.excludedReason ? <span className="nhan canh-bao">{t(`excluded_${member.excludedReason}`)}</span> : <span className="nhan thanh-cong">{t("included")}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </Loaded>
      <div className="cac-the" role="tablist">
        {(["statements", "preview"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? "chon" : ""} onClick={() => setView(key)}>
            {t(`view_${key}`)}
          </button>
        ))}
      </div>
      {view === "statements" ? <Consolidations /> : null}
      {view === "preview" && (
        <>
          <div className="cac-the" role="tablist">
            {(["balance_sheet", "income_statement"] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={kind === key} className={kind === key ? "chon" : ""} onClick={() => setKind(key)}>
                {statements(`kind_${key}`)}
              </button>
            ))}
          </div>
          <div className="bo-loc">
            <label htmlFor="hn-tu-ngay">{statements("from")}</label>
            <input id="hn-tu-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
            <label htmlFor="hn-den-ngay">{statements("to")}</label>
            <input id="hn-den-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          {!valid && <p className="loi-o">{statements("invalidRange")}</p>}
          {valid && scope.state.kind === "ready" && (
            <Loaded state={preview.state} onRetry={() => void preview.reload()}>
              {(report) => (
                <>
                  <p className="chu-thich">
                    <strong>
                      {report.name} ({report.form})
                    </strong>{" "}
                    · {t("previewHint", { members: report.memberNames.join(", ") })}
                  </p>
                  <ConsolidatedStatementTable report={report} />
                </>
              )}
            </Loaded>
          )}
        </>
      )}
    </>
  );
}

function Consolidations() {
  const t = useTranslations("consolidation");
  const statements = useTranslations("statements");
  const router = useRouter();
  const today = vietnamToday();
  const { state, reload } = useApi<ConsolidationsResponse>("/finance/consolidation");
  const [period, setPeriod] = useState({ from: `${today.slice(0, 5)}01-01`, to: today });
  const { submitting, formError, run } = useSubmit();
  function create(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await apiFetch<ConsolidationResponse>("/finance/consolidation", { method: "POST", body: JSON.stringify(period) });
      router.push(`/consolidation/${created.id}`);
    });
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(result) => (
        <>
          {result.canManage && (
            <form className="bo-loc" onSubmit={create}>
              <label htmlFor="hn-lap-tu">{statements("from")}</label>
              <input id="hn-lap-tu" type="date" className="o-nhap" style={{ width: "auto" }} value={period.from} onChange={(event) => setPeriod({ ...period, from: event.target.value })} />
              <label htmlFor="hn-lap-den">{statements("to")}</label>
              <input id="hn-lap-den" type="date" className="o-nhap" style={{ width: "auto" }} value={period.to} onChange={(event) => setPeriod({ ...period, to: event.target.value })} />
              <button type="submit" className="nut chinh" disabled={submitting}>
                {t("create")}
              </button>
            </form>
          )}
          <FormError text={formError} />
          {result.data.length === 0 ? (
            <MessageView text={t("noConsolidations")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("period")}</th>
                    <th scope="col">{t("documentNo")}</th>
                    <th scope="col">{t("status")}</th>
                    <th scope="col">{t("calculatedAt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("period")}>
                        <Link href={`/consolidation/${item.id}`}>
                          {formatDate(item.fromDate)} – {formatDate(item.toDate)}
                        </Link>
                      </td>
                      <td data-nhan={t("documentNo")}>
                        <span>{item.documentNo ?? "—"}</span>
                      </td>
                      <td data-nhan={t("status")}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td data-nhan={t("calculatedAt")}>
                        <span>{item.calculatedAt ? formatDateTime(item.calculatedAt) : "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Loaded>
  );
}
