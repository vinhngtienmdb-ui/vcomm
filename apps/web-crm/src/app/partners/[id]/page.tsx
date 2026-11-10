"use client";

// MAN_HINH_37 Chi tiết đối tác (CHUC_NANG_46 đến 48; API_71, API_72): thông tin chung, người liên hệ, tài khoản ngân hàng, hồ sơ của công ty đang chọn, lịch sử.
import type { PartnerProfileOptionsResponse, PartnerResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PartnerDrawer } from "@/components/PartnerDrawer";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(140px, 200px) 1fr",
        gap: "var(--khoang-3)",
      }}
    >
      <span className="chu-thich">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function PartnerPage() {
  const t = useTranslations("partners");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PartnerResponse>(`/crm/partners/${id}`);
  return (
    <>
      <div>
        <Link href="/partners">‹ {t("back")}</Link>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(partner) => <PartnerDetail partner={partner} reload={reload} />}
      </Loaded>
    </>
  );
}

function PartnerDetail({ partner, reload }: { partner: PartnerResponse; reload: () => Promise<void> }) {
  const t = useTranslations("partners");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [citizenId, setCitizenId] = useState<string | null>(null);

  async function setStatus() {
    setBusy(true);
    try {
      await apiFetch(`/crm/partners/${partner.id}/${partner.status === "active" ? "deactivate" : "activate"}`, { method: "POST", body: JSON.stringify({ version: partner.version }) });
      setConfirming(false);
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  async function showIdentity() {
    try {
      setCitizenId((await apiFetch<{ citizenId: string | null }>(`/crm/partners/${partner.id}/identity`)).citizenId);
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1>
          {partner.code} · {partner.name}
        </h1>
        <span className={`nhan ${partner.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(partner.status)}</span>
        {partner.internalCompanyId && <span className="nhan thong-tin">{t("internal")}</span>}
        <HistoryLink entityId={partner.id} />
        {partner.canManage && (
          <>
            <button type="button" className="nut phu" onClick={() => (partner.status === "active" ? setConfirming(true) : void setStatus())}>
              {partner.status === "active" ? t("deactivate") : t("activate")}
            </button>
            <button type="button" className="nut chinh" onClick={() => setEditing(true)}>
              {t("edit")}
            </button>
          </>
        )}
      </div>
      {partner.internalCompanyId && <div className="khoi-canh-bao thong-tin">{t("internalHint")}</div>}

      <section className="the">
        <h2 style={{ margin: 0 }}>{t("general")}</h2>
        <Row label={t("kind")}>{t(`kind_${partner.kind}`)}</Row>
        {partner.kind === "individual" ? (
          <Row label={t("citizenId")}>
            <span className="nhom-nut" style={{ alignItems: "center" }}>
              <span>{citizenId ?? partner.citizenIdMasked ?? common("none")}</span>
              {partner.canViewIdentity && citizenId === null && (
                <button type="button" className="nut chu" title={t("identityLogged")} onClick={() => void showIdentity()}>
                  {t("showIdentity")}
                </button>
              )}
            </span>
          </Row>
        ) : (
          <Row label={t("taxCode")}>{partner.taxCode ?? common("none")}</Row>
        )}
        <Row label={t("shortName")}>{partner.shortName ?? common("none")}</Row>
        <Row label={t("address")}>{partner.address ?? common("none")}</Row>
        <Row label={t("phone")}>{partner.phone ?? common("none")}</Row>
        <Row label={t("email")}>{partner.email ?? common("none")}</Row>
      </section>

      <section className="the">
        <h2 style={{ margin: 0 }}>{t("contacts")}</h2>
        {partner.contacts.length === 0 ? (
          <span className="chu-thich">{t("noContacts")}</span>
        ) : (
          partner.contacts.map((contact, index) => (
            <div key={index}>
              <strong>{contact.fullName}</strong>
              {contact.position && <span className="chu-thich"> · {contact.position}</span>}
              {contact.isPrimary && <span className="nhan thong-tin"> {t("primary")}</span>}
              <div className="chu-thich">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</div>
            </div>
          ))
        )}
      </section>

      <section className="the">
        <h2 style={{ margin: 0 }}>{t("bankAccounts")}</h2>
        {partner.bankAccounts.length === 0 ? (
          <span className="chu-thich">{t("noBankAccounts")}</span>
        ) : (
          partner.bankAccounts.map((account, index) => (
            <div key={index}>
              <strong>
                {account.bankName} · {account.accountNo}
              </strong>
              {account.isDefault && <span className="nhan thong-tin"> {t("default")}</span>}
              <div className="chu-thich">{[account.accountHolder, account.branch].filter(Boolean).join(" · ")}</div>
            </div>
          ))
        )}
      </section>

      <Profile partner={partner} reload={reload} />

      {editing && (
        <PartnerDrawer
          partner={partner}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
      {confirming && (
        <ConfirmDialog
          title={t("deactivate")}
          text={t("deactivateConfirm", { name: partner.name })}
          confirmLabel={t("deactivate")}
          busy={busy}
          onConfirm={() => void setStatus()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

// Hồ sơ đối tác của công ty đang chọn (CHUC_NANG_48; QUYTAC_NGHIEPVU_60).
function Profile({ partner, reload }: { partner: PartnerResponse; reload: () => Promise<void> }) {
  const t = useTranslations("partners");
  const common = useTranslations("common");
  const { me } = useAdmin();
  const [editing, setEditing] = useState(false);
  const profile = partner.profile;
  const isSelf = partner.internalCompanyId !== null && partner.internalCompanyId === me?.currentCompanyId;
  return (
    <section className="the">
      <div className="tieu-de">
        <h2 style={{ margin: 0 }}>{t("profile")}</h2>
        {partner.canManageProfile && !isSelf && (
          <button type="button" className="nut phu" onClick={() => setEditing(true)}>
            {profile ? t("editProfile") : t("createProfile")}
          </button>
        )}
      </div>
      {isSelf ? (
        <span className="chu-thich">{t("selfProfile")}</span>
      ) : !profile ? (
        <span className="chu-thich">{t("noProfile")}</span>
      ) : (
        <>
          <Row label={t("role")}>
            <span className="nhom-nut">
              {profile.isCustomer && <span className="nhan thanh-cong">{t("role_customer")}</span>}
              {profile.isSupplier && <span className="nhan canh-bao">{t("role_supplier")}</span>}
            </span>
          </Row>
          <Row label={t("paymentTermDays")}>{t("days", { count: profile.paymentTermDays })}</Row>
          <Row label={t("creditLimit")}>{profile.creditLimitHidden ? common("none") : profile.creditLimit === null ? t("unlimited") : formatMoney(profile.creditLimit, profile.currency)}</Row>
          <Row label={t("customerGroup")}>{profile.customerGroupName ?? common("none")}</Row>
          <Row label={t("owner")}>{profile.ownerUserName ?? common("none")}</Row>
          <Row label={t("note")}>{profile.note ?? common("none")}</Row>
          <Row label={t("profileStatus")}>
            <span className={`nhan ${profile.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(profile.status)}</span>
          </Row>
        </>
      )}
      {editing && (
        <ProfileDrawer
          partner={partner}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function ProfileDrawer({ partner, onClose, onSaved }: { partner: PartnerResponse; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("partners");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const options = useApi<PartnerProfileOptionsResponse>("/crm/partner-profile-options");
  const profile = partner.profile;
  const [isCustomer, setIsCustomer] = useState(profile?.isCustomer ?? true);
  const [isSupplier, setIsSupplier] = useState(profile?.isSupplier ?? false);
  const [paymentTermDays, setPaymentTermDays] = useState(String(profile?.paymentTermDays ?? 0));
  const [creditLimit, setCreditLimit] = useState(profile?.creditLimit ?? "");
  const [customerGroupId, setCustomerGroupId] = useState(profile?.customerGroupId ?? "");
  const [ownerUserId, setOwnerUserId] = useState(profile?.ownerUserId ?? "");
  const [note, setNote] = useState(profile?.note ?? "");
  const [status, setStatus] = useState(profile?.status ?? "active");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const choices = options.state.kind === "ready" ? options.state.data : { customerGroups: [], users: [] };

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body = {
        isCustomer,
        isSupplier,
        paymentTermDays: Number(paymentTermDays),
        creditLimit: creditLimit.trim() === "" ? null : creditLimit.replace(/\./g, ""),
        customerGroupId: customerGroupId || null,
        ownerUserId: ownerUserId || null,
        note,
        status,
        version: profile?.version ?? 0,
      };
      await apiFetch(`/crm/partners/${partner.id}/profile`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      notify(t("profileSaved"));
      onSaved();
    });
  }

  return (
    <Drawer title={`${t("profile")}: ${partner.code}`} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <fieldset className="the" style={{ margin: 0 }}>
          <legend className="an-nhan">{t("role")}</legend>
          <label>
            <input type="checkbox" checked={isCustomer} onChange={(event) => setIsCustomer(event.target.checked)} /> {t("isCustomer")}
          </label>
          <label>
            <input type="checkbox" checked={isSupplier} onChange={(event) => setIsSupplier(event.target.checked)} /> {t("isSupplier")}
          </label>
          {fields.isCustomer && <span className="loi-o">{fields.isCustomer}</span>}
        </fieldset>
        <Field id="so-ngay-no" label={`${t("paymentTermDays")} *`} error={fields.paymentTermDays}>
          <input id="so-ngay-no" className={inputClass("paymentTermDays")} type="number" min={0} max={365} value={paymentTermDays} onChange={(event) => setPaymentTermDays(event.target.value)} />
        </Field>
        <Field id="han-muc" label={t("creditLimit")} hint={t("creditLimitHint")} error={fields.creditLimit}>
          <input id="han-muc" className={inputClass("creditLimit")} inputMode="numeric" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} />
        </Field>
        <Field id="nhom-khach" label={t("customerGroup")} error={fields.customerGroupId}>
          <select id="nhom-khach" className={inputClass("customerGroupId")} value={customerGroupId} onChange={(event) => setCustomerGroupId(event.target.value)}>
            <option value="">{common("none")}</option>
            {choices.customerGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="phu-trach" label={t("owner")} error={fields.ownerUserId}>
          {/* Khách đã có nhân viên phụ trách chỉ đổi bằng phiếu giao khách (QUYTAC_NGHIEPVU_134). */}
          <select
            id="phu-trach"
            className={inputClass("ownerUserId")}
            value={ownerUserId}
            disabled={Boolean(profile?.ownerUserId)}
            aria-describedby={profile?.ownerUserId ? "phu-trach-goi-y" : undefined}
            onChange={(event) => setOwnerUserId(event.target.value)}
          >
            <option value="">{common("none")}</option>
            {choices.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
          {profile?.ownerUserId && (
            <span id="phu-trach-goi-y" className="chu-thich">
              {t("ownerChangeHint")}
            </span>
          )}
        </Field>
        <Field id="ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu" className={inputClass("note")} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field id="trang-thai-ho-so" label={t("profileStatus")}>
          <select id="trang-thai-ho-so" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
            <option value="active">{t("active")}</option>
            <option value="inactive">{t("inactive")}</option>
          </select>
        </Field>
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
