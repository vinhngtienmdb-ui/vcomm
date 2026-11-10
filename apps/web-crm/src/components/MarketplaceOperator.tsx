"use client";

// Công ty vận hành sàn VComm (QUYTAC_NGHIEPVU_147; API_119): chỉ quản trị tập đoàn chọn được.
import type { MarketplaceSettingsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";

export function MarketplaceOperator({ settings, onSaved }: { settings: MarketplaceSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("buyers");
  const { notify } = useAdmin();
  const [companyId, setCompanyId] = useState(settings.operatorCompany?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/marketplace/operator-company", { method: "PUT", body: JSON.stringify({ companyId }) });
      notify(t("operatorSaved"));
      setEditing(false);
      onSaved();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  if (settings.operatorCompany && !editing)
    return (
      <div className="chu-thich" style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center", flexWrap: "wrap" }}>
        <span>{t("operatorCurrent", { name: settings.operatorCompany.shortName })}</span>
        {settings.canSetOperator && (
          <button type="button" className="nut phu" onClick={() => setEditing(true)}>
            {t("chooseOperator")}
          </button>
        )}
      </div>
    );
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <strong>{t("operatorTitle")}</strong>
      {!settings.operatorCompany && <div className="khoi-canh-bao canh-bao">{t("operatorNotSet")}</div>}
      {settings.canSetOperator ? (
        <>
          <label className="an-nhan" htmlFor="ss-cong-ty">
            {t("chooseOperator")}
          </label>
          <select id="ss-cong-ty" className="o-nhap" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">{t("chooseOperator")}</option>
            {settings.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.shortName}
              </option>
            ))}
          </select>
          <FormError text={error} />
          <div className="nhom-nut">
            <button type="button" className="nut chinh" disabled={!companyId || busy} onClick={() => void save()}>
              {t("saveOperator")}
            </button>
          </div>
        </>
      ) : (
        <span className="chu-thich">{t("operatorAskAdmin")}</span>
      )}
    </div>
  );
}
