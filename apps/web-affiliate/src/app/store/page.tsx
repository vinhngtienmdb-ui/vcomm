"use client";

// MAN_HINH_177 Cửa hàng của tôi (chủ cửa hàng): hợp đồng chỉ xem, điểm bán, nhân viên – mời thu ngân, gán điểm bán, khóa, mở
// (CONG_VIEC_55; CHUC_NANG_193; QUYTAC_NGHIEPVU_393; API_207).
import type { AffiliateMember, AffiliateOutlet, MerchantPortalStore } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { portalFetch, usePortalApi } from "@/lib/portal-api";
import { usePortal } from "@/components/PortalShell";

function CashierDrawer({ outlets, member, onClose, onSaved }: { outlets: AffiliateOutlet[]; member: AffiliateMember | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("merchantPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>(member?.outletIds ?? []);
  return (
    <Drawer title={member ? t("editOutlets", { name: member.fullName }) : t("inviteCashier")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await portalFetch(member ? `/merchant-portal/members/${member.id}` : "/merchant-portal/members", {
              method: member ? "PUT" : "POST",
              body: JSON.stringify(member ? { outletIds, version: member.version } : { fullName, phone, outletIds }),
            });
            onSaved();
          });
        }}
      >
        {!member && (
          <>
            <Field id="ten-thu-ngan" label={t("memberName")} error={fields.fullName}>
              <input id="ten-thu-ngan" className={inputClass("fullName")} value={fullName} maxLength={100} onChange={(event) => setFullName(event.target.value)} />
            </Field>
            <Field id="sdt-thu-ngan" label={t("phone")} error={fields.phone}>
              <input id="sdt-thu-ngan" className={inputClass("phone")} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
          </>
        )}
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13 }}>{t("outlets")}</legend>
          {outlets
            .filter((outlet) => outlet.status === "active")
            .map((outlet) => (
              <label key={outlet.id} style={{ display: "flex", gap: "var(--khoang-2)" }}>
                <input
                  type="checkbox"
                  checked={outletIds.includes(outlet.id)}
                  onChange={(event) => setOutletIds(event.target.checked ? [...outletIds, outlet.id] : outletIds.filter((id) => id !== outlet.id))}
                />
                {outlet.name}
              </label>
            ))}
          {fields.outletIds && <span className="loi-o">{fields.outletIds}</span>}
        </fieldset>
        {!member && <p className="chu-thich">{t("inviteHint")}</p>}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || outletIds.length === 0}>
            {member ? t("save") : t("sendInvite")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function LockButton({ member, onDone }: { member: AffiliateMember; onDone: () => void }) {
  const t = useTranslations("merchantPortal");
  const { submitting, formError, run } = useSubmit();
  const action = member.status === "locked" ? "unlock" : "lock";
  return (
    <>
      <button
        type="button"
        className={`nut ${action === "lock" ? "nguy-hiem" : "phu"}${submitting ? " dang-xu-ly" : ""}`}
        disabled={submitting}
        onClick={() =>
          void run(async () => {
            await portalFetch(`/merchant-portal/members/${member.id}/${action}`, { method: "POST", body: JSON.stringify({ version: member.version }) });
            onDone();
          })
        }
      >
        {t(`action_${action}`)}
      </button>
      <FormError text={formError} />
    </>
  );
}

export default function StorePage() {
  const t = useTranslations("merchantPortal");
  const { notify } = usePortal();
  const { state, reload } = usePortalApi<MerchantPortalStore>("/merchant-portal/store");
  const [editing, setEditing] = useState<AffiliateMember | "new" | null>(null);
  const done = (message: string) => {
    setEditing(null);
    notify(message);
    void reload();
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(store) => (
        <>
          <h1>{t("menu_store")}</h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--khoang-4)" }}>
            <section className="the">
              <h2>{t("contract")}</h2>
              <dl className="thong-tin-dong">
                <dt>{t("merchant")}</dt>
                <dd>
                  {store.code} · {store.name}
                </dd>
                <dt>{t("contractNo")}</dt>
                <dd>
                  {store.contractNo} · {formatDate(store.startsOn)} – {store.endsOn ? formatDate(store.endsOn) : t("noEnd")}
                </dd>
                <dt>{t("earnPercent")}</dt>
                <dd>{t("earnPercentValue", { percent: formatNumber(store.earnPercent, 4) })}</dd>
                <dt>{t("feePercent")}</dt>
                <dd>{t("feePercentValue", { percent: formatNumber(store.feePercent, 4) })}</dd>
                <dt>{t("creditLimit")}</dt>
                <dd>{formatNumber(store.creditLimit, 0)} đ</dd>
                <dt>{t("transactionCap")}</dt>
                <dd>{formatNumber(store.transactionCap, 0)} đ</dd>
                <dt>{t("settlement")}</dt>
                <dd>{t("settlementValue", { confirm: store.autoConfirmDays, pay: store.paymentTermDays })}</dd>
              </dl>
              <p className="chu-thich">{t("contractHint")}</p>
            </section>
            <section className="the">
              <h2>{t("outlets")}</h2>
              <ul style={{ margin: 0, paddingLeft: "var(--khoang-5)" }}>
                {store.outlets.map((outlet) => (
                  <li key={outlet.id}>
                    {outlet.name} – {outlet.address} <span className={`nhan ${outlet.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`outlet_${outlet.status}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="tieu-de">
            <h2>{t("staff")}</h2>
            {store.status !== "terminated" && (
              <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
                {t("inviteCashier")}
              </button>
            )}
          </div>
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  <th>{t("memberName")}</th>
                  <th>{t("phone")}</th>
                  <th>{t("role")}</th>
                  <th>{t("outlets")}</th>
                  <th>{t("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {store.members.map((member) => (
                  <tr key={member.id}>
                    <td data-nhan={t("memberName")}>{member.fullName}</td>
                    <td data-nhan={t("phone")}>{member.phone}</td>
                    <td data-nhan={t("role")}>{t(`roleLabel_${member.role}`)}</td>
                    <td data-nhan={t("outlets")}>
                      {member.role === "owner"
                        ? t("allOutlets")
                        : store.outlets
                            .filter((outlet) => member.outletIds.includes(outlet.id))
                            .map((outlet) => outlet.name)
                            .join(", ")}
                    </td>
                    <td data-nhan={t("status")}>
                      <span className={`nhan ${member.status === "active" ? "thanh-cong" : member.status === "locked" ? "loi" : "canh-bao"}`}>{t(`member_${member.status}`)}</span>
                      {member.invitationExpiresAt && <div className="chu-thich">{t("invitationExpires", { time: formatDateTime(member.invitationExpiresAt) })}</div>}
                    </td>
                    <td data-nhan="">
                      {member.role === "cashier" && (
                        <span className="nhom-nut">
                          <button type="button" className="nut phu" onClick={() => setEditing(member)}>
                            {t("changeOutlets")}
                          </button>
                          <LockButton member={member} onDone={() => done(t("saved"))} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editing && (
            <CashierDrawer
              outlets={store.outlets}
              member={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSaved={() => done(editing === "new" ? t("inviteSent") : t("saved"))}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
