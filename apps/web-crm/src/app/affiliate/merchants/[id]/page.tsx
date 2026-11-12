"use client";

// MAN_HINH_178 Cửa hàng liên kết – chi tiết: hợp đồng, trạng thái, điểm bán, thành viên (CONG_VIEC_55; CHUC_NANG_193; API_206).
import type { AffiliateMember, AffiliateMerchantDetail, AffiliateOutlet } from "contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { merchantStatusClass, TermsFields, termsBody, type TermsForm } from "@/components/AffiliateTerms";

const formOf = (merchant: AffiliateMerchantDetail): TermsForm => ({
  contractNo: merchant.contractNo,
  startsOn: merchant.startsOn,
  endsOn: merchant.endsOn ?? "",
  earnPercent: merchant.earnPercent,
  feePercent: merchant.feePercent,
  creditLimit: merchant.creditLimit,
  transactionCap: merchant.transactionCap,
  paymentTermDays: String(merchant.paymentTermDays),
  autoConfirmDays: String(merchant.autoConfirmDays),
});

function OutletDrawer({ merchantId, outlet, onClose, onSaved }: { merchantId: string; outlet: AffiliateOutlet | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("affiliate");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [name, setName] = useState(outlet?.name ?? "");
  const [address, setAddress] = useState(outlet?.address ?? "");
  const [status, setStatus] = useState(outlet?.status ?? "active");
  return (
    <Drawer title={outlet ? t("editOutlet") : t("addOutlet")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await apiFetch(outlet ? `/affiliate/outlets/${outlet.id}` : `/affiliate/merchants/${merchantId}/outlets`, {
              method: outlet ? "PUT" : "POST",
              body: JSON.stringify(outlet ? { name, address, status } : { name, address }),
            });
            onSaved();
          });
        }}
      >
        <Field id="ten-diem-ban" label={t("outletName")} error={fields.name}>
          <input id="ten-diem-ban" className={inputClass("name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="dia-chi-diem-ban" label={t("outletAddress")} error={fields.address}>
          <input id="dia-chi-diem-ban" className={inputClass("address")} value={address} maxLength={300} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        {outlet && (
          <Field id="trang-thai-diem-ban" label={t("status")}>
            <select id="trang-thai-diem-ban" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
              <option value="active">{t("outlet_active")}</option>
              <option value="inactive">{t("outlet_inactive")}</option>
            </select>
          </Field>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function OwnerDrawer({ merchantId, onClose, onSaved }: { merchantId: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("affiliate");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <Drawer title={t("inviteOwner")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await apiFetch(`/affiliate/merchants/${merchantId}/owner-invitations`, { method: "POST", body: JSON.stringify({ fullName, phone }) });
            onSaved();
          });
        }}
      >
        <Field id="ten-chu" label={t("memberName")} error={fields.fullName}>
          <input id="ten-chu" className={inputClass("fullName")} value={fullName} maxLength={100} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field id="sdt-chu" label={t("memberPhone")} error={fields.phone}>
          <input id="sdt-chu" className={inputClass("phone")} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <p className="chu-thich">{t("inviteHint")}</p>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("sendInvite")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function StatusAction({ merchant, target, onDone }: { merchant: AffiliateMerchantDetail; target: "activate" | "suspend" | "terminate"; onDone: () => void }) {
  const t = useTranslations("affiliate");
  const { submitting, formError, run } = useSubmit();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const send = () =>
    void run(async () => {
      await apiFetch(`/affiliate/merchants/${merchant.id}/${target}`, { method: "POST", body: JSON.stringify({ version: merchant.version, ...(target === "activate" ? {} : { reason }) }) });
      setOpen(false);
      onDone();
    });
  if (target === "activate")
    return (
      <>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={send}>
          {t("action_activate")}
        </button>
        <FormError text={formError} />
      </>
    );
  return (
    <>
      <button type="button" className="nut nguy-hiem" onClick={() => setOpen(true)}>
        {t(`action_${target}`)}
      </button>
      {open && (
        <Drawer title={t(`action_${target}`)} onClose={() => setOpen(false)}>
          <Field id="ly-do-trang-thai" label={t("reason")}>
            <textarea id="ly-do-trang-thai" className="o-nhap" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <FormError text={formError} />
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setOpen(false)}>
              {t("cancel")}
            </button>
            <button type="button" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !reason.trim()} onClick={send}>
              {t(`action_${target}`)}
            </button>
          </div>
        </Drawer>
      )}
    </>
  );
}

function MemberRow({ member, outlets, canManage, onChanged }: { member: AffiliateMember; outlets: AffiliateOutlet[]; canManage: boolean; onChanged: () => void }) {
  const t = useTranslations("affiliate");
  const { submitting, formError, run } = useSubmit();
  const lock = member.status === "locked" ? "unlock" : "lock";
  return (
    <tr>
      <td data-nhan={t("memberName")}>{member.fullName}</td>
      <td data-nhan={t("memberPhone")}>{member.phone}</td>
      <td data-nhan={t("memberRole")}>{t(`role_${member.role}`)}</td>
      <td data-nhan={t("memberOutlets")}>
        {member.role === "owner"
          ? t("allOutlets")
          : outlets
              .filter((outlet) => member.outletIds.includes(outlet.id))
              .map((outlet) => outlet.name)
              .join(", ")}
      </td>
      <td data-nhan={t("status")}>
        <span className={`nhan ${member.status === "active" ? "thanh-cong" : member.status === "locked" ? "loi" : "canh-bao"}`}>{t(`member_${member.status}`)}</span>
        {member.invitationExpiresAt && <div className="chu-thich">{t("invitationExpires", { time: formatDateTime(member.invitationExpiresAt) })}</div>}
        <FormError text={formError} />
      </td>
      <td data-nhan="">
        {canManage && (
          <button
            type="button"
            className={`nut ${lock === "lock" ? "nguy-hiem" : "phu"}${submitting ? " dang-xu-ly" : ""}`}
            disabled={submitting}
            onClick={() =>
              void run(async () => {
                await apiFetch(`/affiliate/members/${member.id}/${lock}`, { method: "POST", body: JSON.stringify({ version: member.version }) });
                onChanged();
              })
            }
          >
            {t(`action_${lock}`)}
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AffiliateMerchantPage() {
  const t = useTranslations("affiliate");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<AffiliateMerchantDetail>(`/affiliate/merchants/${id}`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState<TermsForm | null>(null);
  const [outlet, setOutlet] = useState<AffiliateOutlet | "new" | null>(null);
  const [inviting, setInviting] = useState(false);
  const merchant = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    if (merchant) setForm(formOf(merchant));
  }, [merchant]);
  const done = (message: string) => {
    notify(message);
    void reload();
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
        <>
          <p>
            <Link href="/affiliate/merchants">‹ {t("merchantsTitle")}</Link>
          </p>
          <div className="tieu-de">
            <h1>
              {data.code} · {data.name}
            </h1>
            <span className={`nhan ${merchantStatusClass[data.status]}`}>{t(`status_${data.status}`)}</span>
            {data.canManage && data.status !== "terminated" && (
              <span className="nhom-nut">
                {(data.status === "draft" || data.status === "suspended") && <StatusAction merchant={data} target="activate" onDone={() => done(t("saved"))} />}
                {data.status === "active" && <StatusAction merchant={data} target="suspend" onDone={() => done(t("saved"))} />}
                <StatusAction merchant={data} target="terminate" onDone={() => done(t("saved"))} />
              </span>
            )}
          </div>
          {data.statusReason && <div className="khoi-canh-bao canh-bao">{t("statusReason", { reason: data.statusReason })}</div>}
          <section className="the">
            <h2>{t("contract")}</h2>
            <p className="chu-thich">
              {t("partner")}: {data.partnerCode} · {data.name} {data.taxCode ? `· ${data.taxCode}` : ""}
            </p>
            {form && (
              <form
                style={{ display: "grid", gap: "var(--khoang-3)" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await apiFetch(`/affiliate/merchants/${data.id}`, { method: "PUT", body: JSON.stringify({ ...termsBody(form), version: data.version }) });
                    done(t("saved"));
                  });
                }}
              >
                <TermsFields form={form} setForm={setForm} fields={fields} inputClass={inputClass} disabled={!data.canManage || data.status === "terminated"} />
                <p className="chu-thich">{t("termsApplyHint")}</p>
                <FormError text={formError} />
                {data.canManage && data.status !== "terminated" && (
                  <div className="nhom-nut">
                    <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
                      {t("save")}
                    </button>
                  </div>
                )}
              </form>
            )}
          </section>
          <section className="the">
            <div className="tieu-de">
              <h2>{t("outlets")}</h2>
              {data.canManage && data.status !== "terminated" && (
                <button type="button" className="nut phu" onClick={() => setOutlet("new")}>
                  {t("addOutlet")}
                </button>
              )}
            </div>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("outletName")}</th>
                    <th>{t("outletAddress")}</th>
                    <th>{t("status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.outlets.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={t("outletName")}>{item.name}</td>
                      <td data-nhan={t("outletAddress")}>{item.address}</td>
                      <td data-nhan={t("status")}>
                        <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`outlet_${item.status}`)}</span>
                      </td>
                      <td data-nhan="">
                        {data.canManage && (
                          <button type="button" className="nut chu" onClick={() => setOutlet(item)}>
                            {t("edit")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="the">
            <div className="tieu-de">
              <h2>{t("members")}</h2>
              {data.canManage && data.status !== "terminated" && (
                <button type="button" className="nut phu" onClick={() => setInviting(true)}>
                  {t("inviteOwner")}
                </button>
              )}
            </div>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("memberName")}</th>
                    <th>{t("memberPhone")}</th>
                    <th>{t("memberRole")}</th>
                    <th>{t("memberOutlets")}</th>
                    <th>{t("status")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member) => (
                    <MemberRow key={member.id} member={member} outlets={data.outlets} canManage={data.canManage} onChanged={() => done(t("saved"))} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {outlet && (
            <OutletDrawer
              merchantId={data.id}
              outlet={outlet === "new" ? null : outlet}
              onClose={() => setOutlet(null)}
              onSaved={() => {
                setOutlet(null);
                done(t("saved"));
              }}
            />
          )}
          {inviting && (
            <OwnerDrawer
              merchantId={data.id}
              onClose={() => setInviting(false)}
              onSaved={() => {
                setInviting(false);
                done(t("inviteSent"));
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
