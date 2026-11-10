"use client";

// MAN_HINH_62 Hợp nhất (CHUC_NANG_92, 93, 95; QUYTAC_NGHIEPVU_123, 124; API_106): phạm vi thành viên, báo cáo cộng gộp theo kỳ.
import type { ConsolidatedStatementResponse, ConsolidationScopeResponse, StatementKind } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConsolidatedStatementTable } from "@/components/ConsolidatedStatementTable";
import { Loaded } from "ui/components/StatusViews";
import { vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function ConsolidationPage() {
  const t = useTranslations("consolidation");
  const statements = useTranslations("statements");
  const today = vietnamToday();
  const scope = useApi<ConsolidationScopeResponse>("/finance/consolidation/scope");
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
  );
}
