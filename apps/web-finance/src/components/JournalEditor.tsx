"use client";

// MAN_HINH_51 Soạn phiếu kế toán (CHUC_NANG_72; QUYTAC_NGHIEPVU_96): ngày, diễn giải, các dòng tài khoản, đối tác (tài khoản phải thu, phải trả), Nợ, Có; hiện chênh lệch.
import type { AccountResponse, JournalResponse, SaveJournalRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PartnerPicker } from "@/components/PartnerPicker";

type Line = { accountId: string; partnerId: string | null; partnerLabel: string; debit: string; credit: string; description: string };
const empty = (): Line => ({ accountId: "", partnerId: null, partnerLabel: "", debit: "", credit: "", description: "" });

export function JournalEditor({ journal, onSaved, onCancel }: { journal: JournalResponse | null; onSaved: (saved: JournalResponse) => void; onCancel: () => void }) {
  const t = useTranslations("ledger");
  const accounts = useApi<AccountResponse[]>("/finance/accounts");
  const postable = accounts.state.kind === "ready" ? accounts.state.data.filter((account) => account.postable) : [];
  const codeOf = (id: string) => postable.find((account) => account.id === id)?.code ?? "";
  const [journalDate, setJournalDate] = useState(journal?.journalDate ?? vietnamToday());
  const [description, setDescription] = useState(journal?.description ?? "");
  const [lines, setLines] = useState<Line[]>(
    journal
      ? journal.lines.map((line) => ({
          accountId: line.accountId,
          partnerId: line.partnerId,
          partnerLabel: line.partnerName ?? "",
          debit: line.debit === "0" ? "" : line.debit,
          credit: line.credit === "0" ? "" : line.credit,
          description: line.description ?? "",
        }))
      : [empty(), empty()],
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const set = (index: number, patch: Partial<Line>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  const debit = lines.reduce((total, line) => total + (Number(line.debit) || 0), 0);
  const credit = lines.reduce((total, line) => total + (Number(line.credit) || 0), 0);
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveJournalRequest = {
        journalDate,
        description,
        lines: lines.map((line) => ({ accountId: line.accountId, partnerId: line.partnerId, debit: line.debit || "0", credit: line.credit || "0", description: line.description })),
        ...(journal ? { version: journal.version } : {}),
      };
      onSaved(await apiFetch<JournalResponse>(journal ? `/finance/journals/${journal.id}` : "/finance/journals", { method: journal ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="ngay-but-toan" label={`${t("journalDate")} *`} error={fields.journalDate}>
          <input id="ngay-but-toan" type="date" className={inputClass("journalDate")} value={journalDate} onChange={(event) => setJournalDate(event.target.value)} />
        </Field>
        <Field id="dien-giai" label={`${t("description")} *`} error={fields.description}>
          <input id="dien-giai" className={inputClass("description")} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </div>
      {lines.map((line, index) => {
        const code = codeOf(line.accountId);
        const side = code.startsWith("131") ? "receivable" : code.startsWith("331") ? "payable" : null;
        return (
          <section key={index} style={{ display: "grid", gap: "var(--khoang-2)", borderTop: "1px solid var(--mau-vien)", paddingTop: "var(--khoang-2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--khoang-3)" }}>
              <Field id={`tai-khoan-${index}`} label={`${t("account")} *`} error={fields[`lines.${index}.accountId`]}>
                <select
                  id={`tai-khoan-${index}`}
                  className={inputClass(`lines.${index}.accountId`)}
                  value={line.accountId}
                  onChange={(event) => set(index, { accountId: event.target.value, partnerId: null, partnerLabel: "" })}
                >
                  <option value="">{t("chooseAccount")}</option>
                  {postable.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`no-${index}`} label={t("debit")} error={fields[`lines.${index}.debit`]}>
                <input id={`no-${index}`} className={inputClass(`lines.${index}.debit`)} inputMode="decimal" value={line.debit} onChange={(event) => set(index, { debit: event.target.value })} />
              </Field>
              <Field id={`co-${index}`} label={t("credit")}>
                <input id={`co-${index}`} className="o-nhap" inputMode="decimal" value={line.credit} onChange={(event) => set(index, { credit: event.target.value })} />
              </Field>
            </div>
            {side && (
              <Field id={`doi-tac-${index}`} label={t("partner")} hint={line.partnerLabel || undefined} error={fields[`lines.${index}.partnerId`]}>
                <PartnerPicker id={`doi-tac-${index}`} side={side} onPick={(partner) => set(index, { partnerId: partner.id, partnerLabel: `${partner.code} · ${partner.name}` })} />
              </Field>
            )}
            <div className="nhom-nut">
              <input
                aria-label={t("lineDescription")}
                placeholder={t("lineDescription")}
                className="o-nhap"
                value={line.description}
                onChange={(event) => set(index, { description: event.target.value })}
                style={{ flex: 1 }}
              />
              {lines.length > 2 && (
                <button type="button" className="nut chu" onClick={() => setLines(lines.filter((_, position) => position !== index))}>
                  {t("removeLine")}
                </button>
              )}
            </div>
          </section>
        );
      })}
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={() => setLines([...lines, empty()])}>
          {t("addLine")}
        </button>
        <span>
          {t("totals", { debit: formatNumber(debit), credit: formatNumber(credit) })}
          {Math.abs(debit - credit) > 0.00005 && <span style={{ color: "var(--mau-loi)" }}> · {t("difference", { value: formatNumber(debit - credit) })}</span>}
        </span>
      </div>
      {fields.lines && <span className="loi-o">{fields.lines}</span>}
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
