"use client";

// Thêm, sửa thông tin chung của đối tác (CHUC_NANG_46; API_71): kiểm trùng mã số thuế, số Căn cước công dân ngay khi gõ xong.
import type { PartnerKind, PartnerLookupResponse, PartnerResponse, SavePartnerRequest } from "contracts";
import { partnerKinds } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";

type Contact = SavePartnerRequest["contacts"] extends (infer Item)[] | undefined ? Item : never;
type BankAccount = SavePartnerRequest["bankAccounts"] extends (infer Item)[] | undefined ? Item : never;

export function PartnerDrawer({ partner, onClose, onSaved }: { partner: PartnerResponse | null; onClose: () => void; onSaved: (saved: PartnerResponse) => void }) {
  const t = useTranslations("partners");
  const common = useTranslations("common");
  const [kind, setKind] = useState<PartnerKind>(partner?.kind ?? "organization");
  const [name, setName] = useState(partner?.name ?? "");
  const [shortName, setShortName] = useState(partner?.shortName ?? "");
  const [taxCode, setTaxCode] = useState(partner?.taxCode ?? "");
  // Khi sửa, số Căn cước công dân để trống nghĩa là giữ nguyên số đã lưu: người sửa không cần xem số đầy đủ.
  const [citizenId, setCitizenId] = useState("");
  const [address, setAddress] = useState(partner?.address ?? "");
  const [phone, setPhone] = useState(partner?.phone ?? "");
  const [email, setEmail] = useState(partner?.email ?? "");
  const [contacts, setContacts] = useState<Contact[]>(partner?.contacts ?? []);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(partner?.bankAccounts ?? []);
  const [existing, setExisting] = useState<PartnerLookupResponse["partner"]>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  async function lookup(parameter: "taxCode" | "citizenId", value: string) {
    setExisting(null);
    if (!value.trim()) return;
    const result = await apiFetch<PartnerLookupResponse>(`/crm/partners/lookup?${parameter}=${encodeURIComponent(value.trim())}`).catch(() => ({ partner: null }));
    if (result.partner && result.partner.id !== partner?.id) setExisting(result.partner);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePartnerRequest = {
        kind,
        name,
        shortName,
        taxCode: kind === "individual" ? null : taxCode,
        citizenId: kind === "individual" ? citizenId || (partner ? undefined : null) : null,
        address,
        phone,
        email,
        contacts,
        bankAccounts,
        ...(partner ? { version: partner.version } : {}),
      };
      const saved = await apiFetch<PartnerResponse>(partner ? `/crm/partners/${partner.id}` : "/crm/partners", { method: partner ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved(saved);
    });
  }

  const setContact = (index: number, change: Partial<Contact>) => setContacts(contacts.map((item, position) => (position === index ? { ...item, ...change } : item)));
  const setAccount = (index: number, change: Partial<BankAccount>) => setBankAccounts(bankAccounts.map((item, position) => (position === index ? { ...item, ...change } : item)));

  return (
    <Drawer title={partner ? `${t("edit")}: ${partner.code}` : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="loai-doi-tac" label={`${t("kind")} *`} error={fields.kind}>
          <select id="loai-doi-tac" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as PartnerKind)}>
            {partnerKinds.map((item) => (
              <option key={item} value={item}>
                {t(`kind_${item}`)}
              </option>
            ))}
          </select>
        </Field>
        {kind === "individual" ? (
          <Field
            id="so-can-cuoc"
            label={`${t("citizenId")}${partner?.citizenIdMasked || partner?.createdViaOpenApi ? "" : " *"}`}
            hint={partner?.citizenIdMasked ? partner.citizenIdMasked : partner?.createdViaOpenApi ? t("citizenIdOpenApiHint") : t("citizenIdHint")}
            error={fields.citizenId}
          >
            <input
              id="so-can-cuoc"
              className={inputClass("citizenId")}
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={citizenId}
              onChange={(event) => setCitizenId(event.target.value)}
              onBlur={() => void lookup("citizenId", citizenId)}
            />
          </Field>
        ) : (
          <Field id="ma-so-thue" label={`${t("taxCode")} *`} hint={t("taxCodeHint")} error={fields.taxCode}>
            <input
              id="ma-so-thue"
              className={inputClass("taxCode")}
              maxLength={14}
              value={taxCode}
              onChange={(event) => setTaxCode(event.target.value)}
              onBlur={() => void lookup("taxCode", taxCode)}
            />
          </Field>
        )}
        {existing && (
          <div className="khoi-canh-bao canh-bao" role="status">
            {t("exists", { code: existing.code, name: existing.name })}{" "}
            <Link href={`/partners/${existing.id}`} onClick={onClose}>
              {t("open")}
            </Link>
          </div>
        )}
        <Field id="ten-doi-tac" label={`${t("name")} *`} error={fields.name}>
          <input id="ten-doi-tac" className={inputClass("name")} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="ten-viet-tat" label={t("shortName")} error={fields.shortName}>
          <input id="ten-viet-tat" className={inputClass("shortName")} value={shortName} onChange={(event) => setShortName(event.target.value)} />
        </Field>
        <Field id="dia-chi" label={t("address")} error={fields.address}>
          <input id="dia-chi" className={inputClass("address")} value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Field id="dien-thoai" label={t("phone")} error={fields.phone}>
          <input id="dien-thoai" className={inputClass("phone")} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field id="thu-dien-tu" label={t("email")} error={fields.email}>
          <input id="thu-dien-tu" className={inputClass("email")} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>

        <h3 style={{ margin: 0 }}>{t("contacts")}</h3>
        {contacts.map((contact, index) => (
          <fieldset key={index} className="the" style={{ margin: 0 }}>
            <Field id={`lien-he-ten-${index}`} label={`${t("contactName")} *`} error={fields[`contacts.${index}.fullName`]}>
              <input
                id={`lien-he-ten-${index}`}
                className={inputClass(`contacts.${index}.fullName`)}
                value={contact.fullName}
                onChange={(event) => setContact(index, { fullName: event.target.value })}
              />
            </Field>
            <Field id={`lien-he-chuc-vu-${index}`} label={t("position")}>
              <input id={`lien-he-chuc-vu-${index}`} className="o-nhap" value={contact.position ?? ""} onChange={(event) => setContact(index, { position: event.target.value })} />
            </Field>
            <Field id={`lien-he-dien-thoai-${index}`} label={t("phone")}>
              <input id={`lien-he-dien-thoai-${index}`} className="o-nhap" type="tel" value={contact.phone ?? ""} onChange={(event) => setContact(index, { phone: event.target.value })} />
            </Field>
            <Field id={`lien-he-email-${index}`} label={t("email")}>
              <input id={`lien-he-email-${index}`} className="o-nhap" type="email" value={contact.email ?? ""} onChange={(event) => setContact(index, { email: event.target.value })} />
            </Field>
            <span className="nhom-nut">
              <label>
                <input type="checkbox" checked={contact.isPrimary ?? false} onChange={(event) => setContact(index, { isPrimary: event.target.checked })} /> {t("primary")}
              </label>
              <button type="button" className="nut chu" onClick={() => setContacts(contacts.filter((_, position) => position !== index))}>
                {t("remove")}
              </button>
            </span>
          </fieldset>
        ))}
        <button type="button" className="nut phu" onClick={() => setContacts([...contacts, { fullName: "", isPrimary: contacts.length === 0 }])}>
          {t("addContact")}
        </button>

        <h3 style={{ margin: 0 }}>{t("bankAccounts")}</h3>
        {bankAccounts.map((account, index) => (
          <fieldset key={index} className="the" style={{ margin: 0 }}>
            <Field id={`ngan-hang-${index}`} label={`${t("bankName")} *`} error={fields[`bankAccounts.${index}.bankName`]}>
              <input
                id={`ngan-hang-${index}`}
                className={inputClass(`bankAccounts.${index}.bankName`)}
                value={account.bankName}
                onChange={(event) => setAccount(index, { bankName: event.target.value })}
              />
            </Field>
            <Field id={`so-tai-khoan-${index}`} label={`${t("accountNo")} *`} error={fields[`bankAccounts.${index}.accountNo`]}>
              <input
                id={`so-tai-khoan-${index}`}
                className={inputClass(`bankAccounts.${index}.accountNo`)}
                value={account.accountNo}
                onChange={(event) => setAccount(index, { accountNo: event.target.value })}
              />
            </Field>
            <Field id={`chu-tai-khoan-${index}`} label={`${t("accountHolder")} *`} error={fields[`bankAccounts.${index}.accountHolder`]}>
              <input
                id={`chu-tai-khoan-${index}`}
                className={inputClass(`bankAccounts.${index}.accountHolder`)}
                value={account.accountHolder}
                onChange={(event) => setAccount(index, { accountHolder: event.target.value })}
              />
            </Field>
            <Field id={`chi-nhanh-ngan-hang-${index}`} label={t("branch")}>
              <input id={`chi-nhanh-ngan-hang-${index}`} className="o-nhap" value={account.branch ?? ""} onChange={(event) => setAccount(index, { branch: event.target.value })} />
            </Field>
            <span className="nhom-nut">
              <label>
                <input type="checkbox" checked={account.isDefault ?? false} onChange={(event) => setAccount(index, { isDefault: event.target.checked })} /> {t("default")}
              </label>
              <button type="button" className="nut chu" onClick={() => setBankAccounts(bankAccounts.filter((_, position) => position !== index))}>
                {t("remove")}
              </button>
            </span>
          </fieldset>
        ))}
        <button
          type="button"
          className="nut phu"
          onClick={() =>
            setBankAccounts([
              ...bankAccounts,
              {
                bankName: "",
                accountNo: "",
                accountHolder: name.toUpperCase(),
                isDefault: bankAccounts.length === 0,
              },
            ])
          }
        >
          {t("addBankAccount")}
        </button>

        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting}>
            {common("save")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
