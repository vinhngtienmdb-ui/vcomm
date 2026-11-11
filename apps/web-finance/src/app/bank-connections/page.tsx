"use client";

// MAN_HINH_59 Kết nối ngân hàng (CHUC_NANG_84; QUYTAC_NGHIEPVU_113; API_95 đến API_97): quỹ ngân hàng, dịch vụ trung gian, địa chỉ webhook, khóa, gửi giao dịch thử.
import { bankProviders, type BankConnectionItem, type BankConnectionsResponse, type BankProvider, type BankTransactionItem, type SaveBankConnectionResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const webhookUrl = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

export default function BankConnectionsPage() {
  const t = useTranslations("bankConnections");
  const { state, reload } = useApi<BankConnectionsResponse>("/finance/bank-connections");
  const [editing, setEditing] = useState<BankConnectionItem | null>(null);
  const [simulating, setSimulating] = useState<BankConnectionItem | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const headings = [t("fund"), t("account"), t("provider"), t("webhook"), t("lastReceived"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="bank_connection" />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) => (
          <>
            {!result.canSetup && <p className="chu-thich">{t("readOnly")}</p>}
            {secret && (
              <div className="khoi-canh-bao canh-bao" role="status">
                <p style={{ margin: 0 }}>{t("secretOnce")}</p>
                <code style={{ wordBreak: "break-all" }}>{secret}</code>
                <div className="nhom-nut" style={{ marginTop: "var(--khoang-2)" }}>
                  <button type="button" className="nut phu" onClick={() => void navigator.clipboard?.writeText(secret)}>
                    {t("copy")}
                  </button>
                  <button type="button" className="nut phu" onClick={() => setSecret(null)}>
                    {t("hideSecret")}
                  </button>
                </div>
              </div>
            )}
            {result.funds.length === 0 ? (
              <MessageView text={t("noFunds")} />
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {headings.map((heading, index) => (
                        <th key={index} scope="col">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.funds.map((item) => (
                      <tr key={item.fundId}>
                        <td data-nhan={headings[0]}>
                          <span>
                            {item.fundName}
                            <span className="chu-thich"> · {item.fundCode}</span>
                          </span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>
                            {item.bankName ?? "—"}
                            {item.accountNo && <span className="chu-thich"> · {item.accountNo}</span>}
                          </span>
                        </td>
                        <td data-nhan={headings[2]}>
                          {item.connection ? (
                            <span className="nhom-nut">
                              <span>{t(`provider_${item.connection.provider}`)}</span>
                              <span className={`nhan ${item.connection.enabled ? "thanh-cong" : "trung-tinh"}`}>{item.connection.enabled ? t("enabled") : t("disabled")}</span>
                            </span>
                          ) : (
                            <span className="nhan trung-tinh">{t("notConnected")}</span>
                          )}
                        </td>
                        <td data-nhan={headings[3]}>
                          {item.connection ? (
                            <span>
                              <code style={{ wordBreak: "break-all" }}>{webhookUrl(item.connection.webhookPath)}</code>
                              <span className="chu-thich"> · {t("secretHint", { hint: item.connection.secretHint })}</span>
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>{item.connection?.lastReceivedAt ? formatDateTime(item.connection.lastReceivedAt) : "—"}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          {result.canSetup && (
                            <span className="nhom-nut">
                              <button type="button" className="nut phu" onClick={() => setEditing(item)}>
                                {item.connection ? t("edit") : t("connect")}
                              </button>
                              {item.connection?.provider === "simulator" && result.simulatorAllowed && (
                                <button type="button" className="nut phu" onClick={() => setSimulating(item)}>
                                  {t("simulate")}
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editing && (
              <ConnectionEditor
                item={editing}
                simulatorAllowed={result.simulatorAllowed}
                onClose={() => setEditing(null)}
                onSaved={(saved) => {
                  setEditing(null);
                  if (saved.secret) setSecret(saved.secret);
                  void reload();
                }}
              />
            )}
            {simulating && <Simulator item={simulating} onClose={() => setSimulating(null)} onSent={() => void reload()} />}
          </>
        )}
      </Loaded>
    </>
  );
}

function ConnectionEditor({
  item,
  simulatorAllowed,
  onClose,
  onSaved,
}: {
  item: BankConnectionItem;
  simulatorAllowed: boolean;
  onClose: () => void;
  onSaved: (saved: SaveBankConnectionResponse) => void;
}) {
  const t = useTranslations("bankConnections");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [provider, setProvider] = useState<BankProvider>(item.connection?.provider ?? (simulatorAllowed ? "simulator" : "sepay"));
  const [enabled, setEnabled] = useState(item.connection?.enabled ?? true);
  const [rotateSecret, setRotateSecret] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const providers = bankProviders.filter((value) => value !== "simulator" || simulatorAllowed || item.connection?.provider === "simulator");
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const saved = await apiFetch<SaveBankConnectionResponse>(`/finance/bank-connections/${item.fundId}`, {
        method: "PUT",
        body: JSON.stringify({ provider, enabled, rotateSecret, version: item.connection?.version ?? null }),
      });
      notify(t("saved"));
      onSaved(saved);
    });
  }
  return (
    <Drawer title={t("editorTitle", { fund: item.fundName })} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="nh-dich-vu" label={t("provider")} error={fields.provider}>
          <select id="nh-dich-vu" className={inputClass("provider")} value={provider} onChange={(event) => setProvider(event.target.value as BankProvider)}>
            {providers.map((value) => (
              <option key={value} value={value}>
                {t(`provider_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <p className="chu-thich" style={{ margin: 0 }}>
          {t(`providerHint_${provider}`)}
        </p>
        <label>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> {t("enabled")}
        </label>
        {item.connection && (
          <label>
            <input type="checkbox" checked={rotateSecret} onChange={(event) => setRotateSecret(event.target.checked)} /> {t("rotateSecret")}
          </label>
        )}
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh" disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function Simulator({ item, onClose, onSent }: { item: BankConnectionItem; onClose: () => void; onSent: () => void }) {
  const t = useTranslations("bankConnections");
  const common = useTranslations("common");
  const transactions = useTranslations("bankTransactions");
  const { notify } = useAdmin();
  const [form, setForm] = useState({ direction: "in" as "in" | "out", amount: "", content: "", transactionDate: "" });
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const sent = await apiFetch<BankTransactionItem>(`/finance/bank-connections/${item.fundId}/simulate`, {
        method: "POST",
        body: JSON.stringify({ direction: form.direction, amount: form.amount, content: form.content, ...(form.transactionDate ? { transactionDate: form.transactionDate } : {}) }),
      });
      notify(sent.status === "matched" ? t("simulatedMatched", { document: sent.payment?.documentNo ?? "" }) : t("simulatedUnmatched"));
      onSent();
      onClose();
    });
  }
  return (
    <Drawer title={t("simulateTitle", { fund: item.fundName })} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="gl-chieu" label={transactions("direction")} error={fields.direction}>
          <select id="gl-chieu" className={inputClass("direction")} value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as "in" | "out" })}>
            <option value="in">{transactions("direction_in")}</option>
            <option value="out">{transactions("direction_out")}</option>
          </select>
        </Field>
        <Field id="gl-so-tien" label={transactions("amount")} error={fields.amount}>
          <input id="gl-so-tien" inputMode="decimal" className={inputClass("amount")} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.trim() })} />
        </Field>
        <Field id="gl-noi-dung" label={transactions("content")} error={fields.content}>
          <input id="gl-noi-dung" className={inputClass("content")} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
        </Field>
        <Field id="gl-ngay" label={transactions("transactionDate")} hint={t("todayHint")} error={fields.transactionDate}>
          <input id="gl-ngay" type="date" className={inputClass("transactionDate")} value={form.transactionDate} onChange={(event) => setForm({ ...form, transactionDate: event.target.value })} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh" disabled={submitting}>
            {t("send")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
