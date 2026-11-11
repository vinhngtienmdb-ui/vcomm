"use client";

// MAN_HINH_50 Hệ thống tài khoản (CHUC_NANG_69, 70, 75; QUYTAC_NGHIEPVU_93, 94; API_87): khởi tạo kế toán, cây tài khoản, tài khoản chi tiết, định khoản mặc định.
import type { AccountResponse, LedgerSetupResponse, PostingRuleResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

export default function AccountsPage() {
  const t = useTranslations("ledger");
  const { notify } = useAdmin();
  const setup = useApi<LedgerSetupResponse>("/finance/ledger/setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"accounts" | "rules">("accounts");
  async function initialize() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/finance/ledger/setup", { method: "POST" });
      notify(t("initialized"));
      await setup.reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="tieu-de">
        <h1>{t("accountsTitle")}</h1>
        <HistoryLink entityType="account" />
      </div>
      <Loaded state={setup.state} onRetry={() => void setup.reload()}>
        {(status) =>
          !status.initialized ? (
            <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <p>{t("notInitialized", { regime: status.regimeName })}</p>
              <p className="chu-thich">{t("initializeHint")}</p>
              <FormError text={error} />
              {status.canSetup && (
                <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} style={{ justifySelf: "start" }} onClick={() => void initialize()}>
                  {t("initialize")}
                </button>
              )}
            </section>
          ) : (
            <>
              <p className="chu-thich">{t("regimeLine", { regime: status.regimeName })}</p>
              <div className="cac-the" role="tablist">
                {(["accounts", "rules"] as const).map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
                    {t(`tab_${key}`)}
                  </button>
                ))}
              </div>
              {tab === "accounts" ? <Accounts /> : <Rules />}
            </>
          )
        }
      </Loaded>
    </>
  );
}

function Accounts() {
  const t = useTranslations("ledger");
  const { notify } = useAdmin();
  const { state, reload } = useApi<AccountResponse[]>("/finance/accounts");
  const [adding, setAdding] = useState<AccountResponse | null>(null);
  const [editing, setEditing] = useState<AccountResponse | null>(null);
  const headings = [t("code"), t("accountName"), t("nature"), t("status"), ""];
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(accounts) => {
        const depth = new Map<string, number>();
        for (const account of accounts) depth.set(account.id, account.parentId ? (depth.get(account.parentId) ?? 0) + 1 : 0);
        return (
          <>
            {adding && (
              <AccountForm
                parent={adding}
                onDone={() => {
                  setAdding(null);
                  notify(t("accountSaved"));
                  void reload();
                }}
                onCancel={() => setAdding(null)}
              />
            )}
            {editing && (
              <AccountForm
                account={editing}
                onDone={() => {
                  setEditing(null);
                  notify(t("accountSaved"));
                  void reload();
                }}
                onCancel={() => setEditing(null)}
              />
            )}
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={`${heading}-${index}`} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td data-nhan={headings[0]}>
                        <span style={{ paddingLeft: `calc(var(--khoang-3) * ${depth.get(account.id) ?? 0})`, fontWeight: account.parentId ? undefined : 700 }}>{account.code}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {account.name}
                          {account.isLongTerm && <span className="nhan thong-tin"> {t("longTerm")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{t(`nature_${account.nature}`)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span className={`nhan ${account.status === "active" ? (account.postable ? "thanh-cong" : "thong-tin") : "trung-tinh"}`}>
                          {account.status === "inactive" ? t("inactive") : account.postable ? t("postable") : t("summary")}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        {account.canEdit && account.status === "active" && (
                          <span className="nhom-nut">
                            <button type="button" className="nut chu" onClick={() => setAdding(account)}>
                              {t("addDetail")}
                            </button>
                            <button type="button" className="nut chu" onClick={() => setEditing(account)}>
                              {t("edit")}
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      }}
    </Loaded>
  );
}

function AccountForm({ parent, account, onDone, onCancel }: { parent?: AccountResponse; account?: AccountResponse; onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("ledger");
  const [code, setCode] = useState(parent ? parent.code : "");
  const [name, setName] = useState(account?.name ?? "");
  const [active, setActive] = useState(account ? account.status === "active" : true);
  const [longTerm, setLongTerm] = useState(account?.isLongTerm ?? false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (account) {
        await apiFetch(`/finance/accounts/${account.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, status: active ? "active" : "inactive", ...(account.isSystem ? {} : { isLongTerm: longTerm }), version: account.version }),
        });
      } else {
        await apiFetch("/finance/accounts", { method: "POST", body: JSON.stringify({ parentId: parent!.id, code, name }) });
      }
      onDone();
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <strong>{account ? t("editAccount", { code: account.code }) : t("addDetailOf", { code: parent!.code, name: parent!.name })}</strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
        {!account && (
          <Field id="so-hieu-tk" label={`${t("code")} *`} hint={t("codeHint")} error={fields.code}>
            <input id="so-hieu-tk" className={inputClass("code")} value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
        )}
        <Field id="ten-tk" label={`${t("accountName")} *`} error={fields.name}>
          <input id="ten-tk" className={inputClass("name")} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>
      {account && !account.isSystem && (
        <label>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> {t("active")}
        </label>
      )}
      {account && !account.isSystem && (
        <label>
          <input type="checkbox" checked={longTerm} onChange={(event) => setLongTerm(event.target.checked)} /> {t("longTerm")} <span className="chu-thich">{t("longTermHint")}</span>
        </label>
      )}
      {fields.parentId && <span className="loi-o">{fields.parentId}</span>}
      {fields.status && <span className="loi-o">{fields.status}</span>}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function Rules() {
  const t = useTranslations("ledger");
  const { notify } = useAdmin();
  const rules = useApi<PostingRuleResponse[]>("/finance/posting-rules");
  const accounts = useApi<AccountResponse[]>("/finance/accounts");
  const [error, setError] = useState<string | null>(null);
  const postable = accounts.state.kind === "ready" ? accounts.state.data.filter((account) => account.postable) : [];
  async function change(role: string, accountId: string) {
    setError(null);
    try {
      await apiFetch(`/finance/posting-rules/${role}`, { method: "PUT", body: JSON.stringify({ accountId }) });
      notify(t("ruleSaved"));
      await rules.reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }
  const headings = [t("role"), t("account")];
  return (
    <>
      <p className="chu-thich">{t("rulesHint")}</p>
      <FormError text={error} />
      <Loaded state={rules.state} onRetry={() => void rules.reload()}>
        {(items) => (
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
                {items.map((rule) => (
                  <tr key={rule.role}>
                    <td data-nhan={headings[0]}>
                      <span>{rule.description}</span>
                    </td>
                    <td data-nhan={headings[1]}>
                      {rule.canEdit ? (
                        <select aria-label={rule.description} className="o-nhap" value={rule.accountId} onChange={(event) => void change(rule.role, event.target.value)}>
                          {!postable.some((account) => account.id === rule.accountId) && <option value={rule.accountId}>{`${rule.accountCode} · ${rule.accountName}`}</option>}
                          {postable.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} · {account.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {rule.accountCode} · {rule.accountName}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </>
  );
}
