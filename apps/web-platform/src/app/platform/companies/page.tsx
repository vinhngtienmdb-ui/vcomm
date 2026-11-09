"use client";

// MAN_HINH_09 Công ty (CHUC_NANG_01; API_20, API_21).
import { accountingRegimes, type CompanyResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { TreeList } from "ui/components/TreeList";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { HistoryLink } from "ui/components/HistoryLink";

export default function CompaniesPage() {
  const t = useTranslations("companies");
  const org = useTranslations("org");
  const { notify } = useAdmin();
  const { state, reload } = useApi<CompanyResponse[]>("/companies");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="company" />
        <button type="button" className="nut chinh" onClick={() => setDrawer("create")}>
          {t("add")}
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(companies) => {
          const selected = companies.find((company) => company.id === selectedId) ?? null;
          async function deactivate() {
            if (!selected) return;
            setBusy(true);
            setConfirmError(null);
            try {
              await apiFetch(`/companies/${selected.id}/deactivate`, { method: "POST", body: JSON.stringify({ version: selected.version }) });
              setConfirming(false);
              notify(org("deactivated"));
              await reload();
            } catch (error) {
              setConfirmError(failureOf(error).message);
            } finally {
              setBusy(false);
            }
          }
          return (
            <div className="hai-cot">
              <div className="the">
                <TreeList
                  items={companies}
                  selectedId={selectedId}
                  onSelect={(company) => setSelectedId(company.id)}
                  label={(company) => (
                    <>
                      {company.code} · {company.shortName} {company.status === "inactive" && <span className="nhan trung-tinh">{t("inactive")}</span>}
                    </>
                  )}
                />
              </div>
              {selected ? (
                <div className="the">
                  <h2>{selected.legalName}</h2>
                  <dl className="thong-tin-dong">
                    <dt>{t("code")}</dt>
                    <dd>{selected.code}</dd>
                    <dt>{t("parent")}</dt>
                    <dd>{companies.find((company) => company.id === selected.parentId)?.shortName ?? "—"}</dd>
                    <dt>{t("taxCode")}</dt>
                    <dd>{selected.taxCode ?? "—"}</dd>
                    <dt>{t("baseCurrency")}</dt>
                    <dd>{selected.baseCurrency}</dd>
                    <dt>{t("accountingRegime")}</dt>
                    <dd>{t(selected.accountingRegime)}</dd>
                    <dt>{t("fiscalYearStart")}</dt>
                    <dd>{t("month", { month: selected.fiscalYearStart })}</dd>
                    <dt>{t("branchCount")}</dt>
                    <dd>{selected.activeBranchCount}</dd>
                    <dt>{t("status")}</dt>
                    <dd>
                      <span className={`nhan ${selected.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(selected.status)}</span>
                    </dd>
                  </dl>
                  <div className="nhom-nut">
                    <button type="button" className="nut phu" onClick={() => setDrawer("edit")}>
                      {t("edit")}
                    </button>
                    {selected.status === "active" && selected.parentId !== null && (
                      <button
                        type="button"
                        className="nut nguy-hiem"
                        onClick={() => {
                          setConfirmError(null);
                          setConfirming(true);
                        }}
                      >
                        {t("deactivate")}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <MessageView text={t("choose")} />
              )}
              {drawer && (
                <CompanyDrawer
                  company={drawer === "edit" ? selected : null}
                  companies={companies}
                  onClose={() => setDrawer(null)}
                  onSaved={async (saved) => {
                    setDrawer(null);
                    setSelectedId(saved.id);
                    notify(org("saved"));
                    await reload();
                  }}
                />
              )}
              {confirming && selected && (
                <ConfirmDialog
                  title={t("deactivate")}
                  text={t("deactivateConfirm", { name: selected.shortName })}
                  confirmLabel={t("deactivate")}
                  busy={busy}
                  error={confirmError}
                  onConfirm={() => void deactivate()}
                  onClose={() => setConfirming(false)}
                />
              )}
            </div>
          );
        }}
      </Loaded>
    </>
  );
}

function CompanyDrawer({ company, companies, onClose, onSaved }: { company: CompanyResponse | null; companies: CompanyResponse[]; onClose: () => void; onSaved: (company: CompanyResponse) => Promise<void> }) {
  const t = useTranslations("companies");
  const common = useTranslations("common");
  const root = companies.find((item) => item.parentId === null);
  const [values, setValues] = useState({
    parentId: company?.parentId ?? root?.id ?? "",
    code: company?.code ?? "",
    legalName: company?.legalName ?? "",
    shortName: company?.shortName ?? "",
    taxCode: company?.taxCode ?? "",
    address: company?.address ?? "",
    phone: company?.phone ?? "",
    email: company?.email ?? "",
    baseCurrency: company?.baseCurrency ?? "VND",
    accountingRegime: company?.accountingRegime ?? "TT99_2025",
    fiscalYearStart: String(company?.fiscalYearStart ?? 1),
  });
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = {
      ...(company?.parentId === null ? {} : { parentId: values.parentId }),
      code: values.code,
      legalName: values.legalName,
      shortName: values.shortName,
      taxCode: values.taxCode || null,
      address: values.address || null,
      phone: values.phone || null,
      email: values.email || null,
      baseCurrency: values.baseCurrency,
      accountingRegime: values.accountingRegime,
      fiscalYearStart: Number(values.fiscalYearStart),
    };
    void run(async () => {
      const saved = company
        ? await apiFetch<CompanyResponse>(`/companies/${company.id}`, { method: "PATCH", body: JSON.stringify({ ...body, version: company.version }) })
        : await apiFetch<CompanyResponse>("/companies", { method: "POST", body: JSON.stringify(body) });
      await onSaved(saved);
    });
  }

  const text = (key: keyof typeof values, label: string, hint?: string, type = "text") => (
    <Field id={`cong-ty-${key}`} label={label} error={fields[key]} {...(hint ? { hint } : {})}>
      <input id={`cong-ty-${key}`} type={type} className={inputClass(key)} value={values[key]} onChange={set(key)} />
    </Field>
  );

  return (
    <Drawer title={company ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {company?.parentId !== null && (
          <Field id="cong-ty-parentId" label={t("parent")} error={fields.parentId}>
            <select id="cong-ty-parentId" className={inputClass("parentId")} value={values.parentId} onChange={set("parentId")}>
              {companies
                .filter((item) => item.status === "active" && item.id !== company?.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.shortName}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {text("code", t("code"), t("codeHint"))}
        {text("legalName", t("legalName"))}
        {text("shortName", t("shortName"))}
        {text("taxCode", t("taxCode"))}
        {text("address", t("address"))}
        {text("phone", t("phone"), undefined, "tel")}
        {text("email", t("email"), undefined, "email")}
        {text("baseCurrency", t("baseCurrency"))}
        <Field id="cong-ty-accountingRegime" label={t("accountingRegime")} error={fields.accountingRegime}>
          <select id="cong-ty-accountingRegime" className={inputClass("accountingRegime")} value={values.accountingRegime} onChange={set("accountingRegime")}>
            {accountingRegimes.map((regime) => (
              <option key={regime} value={regime}>
                {t(regime)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="cong-ty-fiscalYearStart" label={t("fiscalYearStart")} error={fields.fiscalYearStart}>
          <select id="cong-ty-fiscalYearStart" className={inputClass("fiscalYearStart")} value={values.fiscalYearStart} onChange={set("fiscalYearStart")}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {t("month", { month: index + 1 })}
              </option>
            ))}
          </select>
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
