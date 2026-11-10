"use client";

// MAN_HINH_63 Chi tiết bảng hợp nhất (CHUC_NANG_93 đến 95; QUYTAC_NGHIEPVU_125 đến 128; API_107, API_108): báo cáo, bút toán loại trừ, lãi chưa thực hiện, điều chỉnh tay.
import type { ConsolidationProfitLine, ConsolidationResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CollectionStatusBadge as StatusBadge } from "@/components/CollectionStatusBadge";
import { ConsolidatedStatementTable } from "@/components/ConsolidatedStatementTable";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "balance_sheet" | "income_statement" | "entries" | "profit";

export default function ConsolidationPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<ConsolidationResponse>(`/finance/consolidation/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => <Detail data={data} onChanged={() => void reload()} />}
    </Loaded>
  );
}

function Detail({ data, onChanged }: { data: ConsolidationResponse; onChanged: () => void }) {
  const t = useTranslations("consolidation");
  const errors = useTranslations("errors");
  const { notify } = useAdmin();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("balance_sheet");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  // Thao tác trả câu thông báo riêng thì dùng câu đó thay câu mặc định.
  async function act(action: () => Promise<string | void>, message: string) {
    setBusy(true);
    setError(null);
    try {
      notify((await action()) ?? message);
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="tieu-de">
        <h1>{t("detailTitle", { from: formatDate(data.fromDate), to: formatDate(data.toDate) })}</h1>
        <Link href="/consolidation" className="nut phu">
          {t("back")}
        </Link>
      </div>
      <section className="the" style={{ display: "grid", gap: "var(--khoang-3)", marginBottom: "var(--khoang-4)" }}>
        <div className="nhom-nut">
          <StatusBadge status={data.status} />
          {data.documentNo && <strong>{data.documentNo}</strong>}
          <span className="chu-thich">
            {t("membersLine", { members: data.memberNames.join(", ") })}
            {data.calculatedAt && ` · ${t("calculatedLine", { time: formatDateTime(data.calculatedAt) })}`}
          </span>
        </div>
        {data.warnings.length > 0 && (
          <div className="khoi-canh-bao canh-bao">
            <p style={{ margin: 0 }}>{t("warningsTitle")}</p>
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)" }}>
              {data.warnings.map((warning, index) => (
                <li key={index}>
                  {t("warningLine", {
                    creditor: warning.receivableCompany,
                    debtor: warning.payableCompany,
                    receivable: formatNumber(warning.receivable),
                    payable: formatNumber(warning.payable),
                    difference: formatNumber(warning.difference),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.postError && <div className="khoi-canh-bao loi">{errors.has(data.postError as never) ? errors(data.postError as never) : data.postError}</div>}
        <FormError text={error} />
        <div className="nhom-nut">
          {data.canEdit && (
            <button
              type="button"
              className="nut chinh"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const result = await apiFetch<ConsolidationResponse>(`/finance/consolidation/${data.id}/submit`, { method: "POST", body: JSON.stringify({ version: data.version }) });
                  if (result.status === "pending") return t("submittedPending");
                }, t("submitted"))
              }
            >
              {t("submit")}
            </button>
          )}
          {data.canWithdraw && (
            <button
              type="button"
              className="nut phu"
              disabled={busy}
              onClick={() => void act(async () => void (await apiFetch(`/finance/consolidation/${data.id}/withdraw`, { method: "POST" })), t("withdrawn"))}
            >
              {t("withdraw")}
            </button>
          )}
          {(["balance_sheet", "income_statement"] as const).flatMap((kind) =>
            (["xlsx", "pdf"] as const).map((format) => (
              <button
                key={`${kind}-${format}`}
                type="button"
                className="nut phu"
                disabled={busy}
                onClick={() =>
                  void apiDownload(`/finance/consolidation/${data.id}/export?kind=${kind}&format=${format}`, `HN-${kind}-${data.toDate}.${format}`, format === "pdf").catch((failure) =>
                    setError(failureOf(failure).message),
                  )
                }
              >
                {t(`export_${kind}_${format}`)}
              </button>
            )),
          )}
        </div>
        {data.canEdit && (
          <div className="nhom-nut">
            <button
              type="button"
              className="nut phu"
              disabled={busy}
              onClick={() =>
                void act(async () => void (await apiFetch(`/finance/consolidation/${data.id}/recalculate`, { method: "POST", body: JSON.stringify({ version: data.version }) })), t("recalculated"))
              }
            >
              {t("recalculate")}
            </button>
            {data.status === "draft" && !data.documentNo && (
              <button type="button" className="nut phu" disabled={busy} onClick={() => setDiscarding(true)}>
                {t("discard")}
              </button>
            )}
          </div>
        )}
      </section>
      <div className="cac-the" role="tablist">
        {(["balance_sheet", "income_statement", "entries", "profit"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab === "balance_sheet" && <ConsolidatedStatementTable report={data.balanceSheet} />}
      {tab === "income_statement" && <ConsolidatedStatementTable report={data.incomeStatement} />}
      {tab === "entries" && <Entries data={data} onChanged={onChanged} />}
      {tab === "profit" && <ProfitLines data={data} onChanged={onChanged} />}
      {discarding && (
        <ConfirmDialog
          title={t("discard")}
          text={t("discardText")}
          confirmLabel={t("discard")}
          busy={busy}
          error={error}
          onConfirm={() =>
            void (async () => {
              setBusy(true);
              try {
                await apiFetch(`/finance/consolidation/${data.id}/discard`, { method: "POST", body: JSON.stringify({ version: data.version }) });
                router.push("/consolidation");
              } catch (failure) {
                setError(failureOf(failure).message);
                setBusy(false);
              }
            })()
          }
          onClose={() => setDiscarding(false)}
        />
      )}
    </>
  );
}

function Entries({ data, onChanged }: { data: ConsolidationResponse; onChanged: () => void }) {
  const t = useTranslations("consolidation");
  const { notify } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headings = [t("entry"), t("company"), t("account"), t("partner"), t("debit"), t("credit")];
  async function remove(entryNo: number) {
    try {
      await apiFetch(`/finance/consolidation/${data.id}/entries/${entryNo}?version=${data.version}`, { method: "DELETE" });
      notify(t("entryRemoved"));
      onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }
  return (
    <>
      {data.canEdit && (
        <div className="bo-loc">
          <button type="button" className="nut chinh" onClick={() => setAdding(true)}>
            {t("addManual")}
          </button>
        </div>
      )}
      <FormError text={error} />
      {data.entries.length === 0 ? (
        <MessageView text={t("noEntries")} />
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
              {data.entries.flatMap((entry) =>
                entry.lines.map((line, index) => (
                  <tr key={`${entry.kind}-${entry.entryNo}-${index}`}>
                    <td data-nhan={headings[0]}>
                      {index === 0 ? (
                        <span>
                          <strong>{t(`kind_${entry.kind}`)}</strong>
                          <span className="chu-thich"> · {entry.description}</span>
                          {entry.kind === "manual" && data.canEdit && (
                            <button type="button" className="nut phu" style={{ marginLeft: "var(--khoang-2)" }} onClick={() => void remove(entry.entryNo)}>
                              {t("removeEntry")}
                            </button>
                          )}
                        </span>
                      ) : (
                        <span />
                      )}
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>{line.companyName || "—"}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span>{line.accountCode}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span>{line.partnerName ?? "—"}</span>
                    </td>
                    <td data-nhan={headings[4]}>
                      <span style={{ whiteSpace: "nowrap" }}>{line.debit === "0" ? "" : formatNumber(line.debit)}</span>
                    </td>
                    <td data-nhan={headings[5]}>
                      <span style={{ whiteSpace: "nowrap" }}>{line.credit === "0" ? "" : formatNumber(line.credit)}</span>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
      {adding && <ManualEntryDrawer data={data} onClose={() => setAdding(false)} onSaved={() => (setAdding(false), onChanged())} />}
    </>
  );
}

function ManualEntryDrawer({ data, onClose, onSaved }: { data: ConsolidationResponse; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("consolidation");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [description, setDescription] = useState("");
  const empty = { accountCode: "", companyId: "", partnerId: "", debit: "", credit: "" };
  const [lines, setLines] = useState([empty, empty]);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const update = (index: number, key: "accountCode" | "companyId" | "partnerId" | "debit" | "credit", value: string) =>
    setLines(lines.map((line, position) => (position === index ? { ...line, [key]: value } : line)));
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/finance/consolidation/${data.id}/entries`, {
        method: "POST",
        body: JSON.stringify({
          description,
          lines: lines.map((line) => ({
            accountCode: line.accountCode,
            companyId: line.companyId || null,
            partnerId: line.partnerId || null,
            debit: line.debit || "0",
            credit: line.credit || "0",
          })),
          version: data.version,
        }),
      });
      notify(t("entryAdded"));
      onSaved();
    });
  }
  return (
    <Drawer title={t("addManual")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <p className="chu-thich" style={{ margin: 0 }}>
          {t("manualHint")}
        </p>
        <Field id="dc-dien-giai" label={t("description")} error={fields.description}>
          <input id="dc-dien-giai" className={inputClass("description")} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <datalist id="dc-tai-khoan">
          {data.accountOptions.map((account) => (
            <option key={account.code} value={account.code}>
              {account.name}
            </option>
          ))}
        </datalist>
        {lines.map((line, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "var(--khoang-2)" }}>
            <Field id={`dc-tk-${index}`} label={t("account")} error={fields[`lines.${index}.accountCode`]}>
              <input
                id={`dc-tk-${index}`}
                list="dc-tai-khoan"
                className={inputClass(`lines.${index}.accountCode`)}
                value={line.accountCode}
                onChange={(event) => update(index, "accountCode", event.target.value.trim())}
              />
            </Field>
            <Field id={`dc-no-${index}`} label={t("debit")} error={fields[`lines.${index}.debit`]}>
              <input
                id={`dc-no-${index}`}
                inputMode="decimal"
                className={inputClass(`lines.${index}.debit`)}
                value={line.debit}
                onChange={(event) => update(index, "debit", event.target.value.trim())}
              />
            </Field>
            <Field id={`dc-cty-${index}`} label={t("company")} error={fields[`lines.${index}.companyId`]}>
              <select id={`dc-cty-${index}`} className={inputClass(`lines.${index}.companyId`)} value={line.companyId} onChange={(event) => update(index, "companyId", event.target.value)}>
                <option value="">{t("anyCompany")}</option>
                {data.memberOptions.map((member) => (
                  <option key={member.companyId} value={member.companyId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`dc-dt-${index}`} label={t("partner")} error={fields[`lines.${index}.partnerId`]}>
              <select id={`dc-dt-${index}`} className={inputClass(`lines.${index}.partnerId`)} value={line.partnerId} onChange={(event) => update(index, "partnerId", event.target.value)}>
                <option value="">{data.accountOptions.find((account) => account.code === line.accountCode)?.byPartner ? t("choosePartner") : t("noPartner")}</option>
                {data.partnerOptions.map((partner) => (
                  <option key={partner.partnerId} value={partner.partnerId}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`dc-co-${index}`} label={t("credit")} error={fields[`lines.${index}.credit`]}>
              <input
                id={`dc-co-${index}`}
                inputMode="decimal"
                className={inputClass(`lines.${index}.credit`)}
                value={line.credit}
                onChange={(event) => update(index, "credit", event.target.value.trim())}
              />
            </Field>
          </div>
        ))}
        {fields.lines && <p className="loi-o">{fields.lines}</p>}
        <button type="button" className="nut phu" style={{ justifySelf: "start" }} disabled={lines.length >= 20} onClick={() => setLines([...lines, empty])}>
          {t("addLine")}
        </button>
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

function ProfitLines({ data, onChanged }: { data: ConsolidationResponse; onChanged: () => void }) {
  const t = useTranslations("consolidation");
  const [editing, setEditing] = useState<ConsolidationProfitLine | null>(null);
  const headings = [t("buyer"), t("seller"), t("item"), t("internalQuantity"), t("endingQuantity"), t("unitMargin"), t("estimated"), t("effective"), ""];
  if (data.profitLines.length === 0) return <MessageView text={t("noProfitLines")} />;
  return (
    <>
      <p className="chu-thich">{t("profitHint")}</p>
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
            {data.profitLines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={headings[0]}>
                  <span>{line.buyerName}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{line.sellerName}</span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{line.itemName}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{formatNumber(line.internalQuantity)}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>{formatNumber(line.endingQuantity)}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.unitMargin)}</span>
                </td>
                <td data-nhan={headings[6]}>
                  <span style={{ whiteSpace: "nowrap" }}>{formatNumber(line.estimatedAmount)}</span>
                </td>
                <td data-nhan={headings[7]}>
                  <span style={{ whiteSpace: "nowrap" }}>
                    {formatNumber(line.effectiveAmount)}
                    {line.overrideAmount !== null && <span className="chu-thich"> · {t("overridden", { reason: line.overrideReason ?? "" })}</span>}
                  </span>
                </td>
                <td data-nhan={headings[8]}>
                  {data.canEdit && (
                    <button type="button" className="nut phu" onClick={() => setEditing(line)}>
                      {t("editProfit")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <ProfitDrawer data={data} line={editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), onChanged())} />}
    </>
  );
}

function ProfitDrawer({ data, line, onClose, onSaved }: { data: ConsolidationResponse; line: ConsolidationProfitLine; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("consolidation");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [amount, setAmount] = useState(line.overrideAmount ?? line.estimatedAmount);
  const [reason, setReason] = useState(line.overrideReason ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function save(useEstimate: boolean) {
    void run(async () => {
      await apiFetch(`/finance/consolidation/${data.id}/profit-lines/${line.id}`, {
        method: "PUT",
        body: JSON.stringify({ amount: useEstimate ? null : amount, reason: useEstimate ? null : reason || null, version: data.version }),
      });
      notify(t("profitSaved"));
      onSaved();
    });
  }
  return (
    <Drawer title={t("editProfit")} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
        style={{ display: "grid", gap: "var(--khoang-3)" }}
      >
        <p className="chu-thich" style={{ margin: 0 }}>
          {line.itemName} · {t("estimated")}: {formatNumber(line.estimatedAmount)}
        </p>
        <Field id="lct-so" label={t("effective")} error={fields.amount}>
          <input id="lct-so" inputMode="decimal" className={inputClass("amount")} value={amount} onChange={(event) => setAmount(event.target.value.trim())} />
        </Field>
        <Field id="lct-ly-do" label={t("reason")} error={fields.reason}>
          <input id="lct-ly-do" className={inputClass("reason")} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          {line.overrideAmount !== null && (
            <button type="button" className="nut phu" disabled={submitting} onClick={() => save(true)}>
              {t("useEstimate")}
            </button>
          )}
          <button type="submit" className="nut chinh" disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
