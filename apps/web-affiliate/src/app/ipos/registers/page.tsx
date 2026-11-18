"use client";

// MAN_HINH_296 Quầy và thiết bị (chủ cửa hàng; CONG_VIEC_74; CHUC_NANG_254; QUYTAC_NGHIEPVU_597, 606; API_348).
import type { IposPairingCode, IposPortalAccess, IposRegisterItem } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

const subscriptionClass = { trial: "thong-tin", active: "thanh-cong", overdue: "canh-bao", locked: "loi", cancelled: "trung-tinh" } as const;

function RegisterDrawer({ access, editing, onClose, onSaved }: { access: IposPortalAccess; editing: IposRegisterItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("iposPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const outlets = access.outlets.filter((outlet) => outlet.subscriptionStatus !== "cancelled");
  const [outletId, setOutletId] = useState(editing?.outletId ?? outlets[0]?.outletId ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [status, setStatus] = useState<IposRegisterItem["status"]>(editing?.status ?? "active");
  return (
    <Drawer title={editing ? `${t("editRegister")} · ${editing.name}` : t("addRegister")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (editing) await portalFetch(`/merchant-portal/ipos/registers/${editing.id}`, { method: "PUT", body: JSON.stringify({ name, status, version: editing.version }) });
            else await portalFetch("/merchant-portal/ipos/registers", { method: "POST", body: JSON.stringify({ outletId, name }) });
            onSaved();
          });
        }}
      >
        {!editing && (
          <Field id="quay-diem-ban" label={t("outlet")} error={fields.outletId}>
            <select id="quay-diem-ban" className={inputClass("outletId")} value={outletId} onChange={(event) => setOutletId(event.target.value)}>
              {outlets.map((outlet) => (
                <option key={outlet.outletId} value={outlet.outletId}>
                  {outlet.outletName} · {t("registersUsed", { used: outlet.activeRegisters, max: outlet.maxRegisters })}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="quay-ten" label={t("registerName")} error={fields.name}>
          <input id="quay-ten" className={inputClass("name")} maxLength={50} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {editing && (
          <Field id="quay-trang-thai" label={t("status")} error={fields.status} hint={t("inactiveHint")}>
            <select id="quay-trang-thai" className={inputClass("status")} value={status} onChange={(event) => setStatus(event.target.value as IposRegisterItem["status"])}>
              <option value="active">{t("register_active")}</option>
              <option value="inactive">{t("register_inactive")}</option>
            </select>
          </Field>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !name.trim() || (!editing && !outletId)}>
            {editing ? t("save") : t("addRegister")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

// Mã ghép hiện một lần, đếm ngược 10 phút (QUYTAC_NGHIEPVU_606).
function PairingDialog({ register, pairing, onClose }: { register: IposRegisterItem; pairing: IposPairingCode; onClose: () => void }) {
  const t = useTranslations("iposPortal");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.floor((new Date(pairing.expiresAt).getTime() - now) / 1000));
  return (
    <Drawer title={`${t("pairTitle")} · ${register.outletName} · ${register.name}`} onClose={onClose}>
      <p>{t("pairText")}</p>
      <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: 4, margin: 0 }} aria-label={t("pairCode")}>
        {pairing.code.slice(0, 4)}-{pairing.code.slice(4)}
      </p>
      <p className="chu-thich">{remaining > 0 ? t("pairExpiresIn", { minutes: Math.floor(remaining / 60), seconds: String(remaining % 60).padStart(2, "0") }) : t("pairExpired")}</p>
      <div className="nhom-nut">
        <button type="button" className="nut chinh" onClick={onClose}>
          {t("done")}
        </button>
      </div>
    </Drawer>
  );
}

export default function IposRegistersPage() {
  const t = useTranslations("iposPortal");
  const { notify } = usePortal();
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const { state, reload } = usePortalApi<IposRegisterItem[]>("/merchant-portal/ipos/registers");
  const [editing, setEditing] = useState<IposRegisterItem | "new" | null>(null);
  const [pairing, setPairing] = useState<{ register: IposRegisterItem; code: IposPairingCode } | null>(null);
  const [revoking, setRevoking] = useState<IposRegisterItem | null>(null);
  const pair = useSubmit();
  const revoke = useSubmit();
  const refresh = (message: string) => {
    notify(message);
    void reload();
    void access.reload();
  };
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("registersTitle")}</h1>
              {info.outlets.some((outlet) => outlet.subscriptionStatus !== "cancelled") && (
                <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
                  {t("addRegister")}
                </button>
              )}
            </div>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("outlet")}</th>
                    <th>{t("plan")}</th>
                    <th>{t("registers")}</th>
                    <th>{t("endsOn")}</th>
                    <th>{t("subscription")}</th>
                  </tr>
                </thead>
                <tbody>
                  {info.outlets.map((outlet) => (
                    <tr key={outlet.outletId}>
                      <td data-nhan={t("outlet")}>{outlet.outletName}</td>
                      <td data-nhan={t("plan")}>{outlet.planName}</td>
                      <td data-nhan={t("registers")}>{t("registersUsed", { used: outlet.activeRegisters, max: outlet.maxRegisters })}</td>
                      <td data-nhan={t("endsOn")}>{formatDate(outlet.endsOn)}</td>
                      <td data-nhan={t("subscription")}>
                        <span className={`nhan ${subscriptionClass[outlet.subscriptionStatus]}`}>{t(`subscription_${outlet.subscriptionStatus}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Loaded state={state} onRetry={() => void reload()}>
              {(registers) =>
                registers.length === 0 ? (
                  <MessageView text={t("noRegisters")} />
                ) : (
                  <div className="khung-bang">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("outlet")}</th>
                          <th>{t("registerName")}</th>
                          <th>{t("device")}</th>
                          <th>{t("lastSeen")}</th>
                          <th>{t("status")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {registers.map((register) => (
                          <tr key={register.id}>
                            <td data-nhan={t("outlet")}>{register.outletName}</td>
                            <td data-nhan={t("registerName")}>{register.name}</td>
                            <td data-nhan={t("device")}>
                              {register.device ? (
                                <>
                                  {register.device.model ?? t("unknownModel")}
                                  <div className="chu-thich">{t("pairedBy", { name: register.device.pairedByName, date: formatDateTime(register.device.pairedAt) })}</div>
                                </>
                              ) : (
                                <span className="chu-thich">{t("notPaired")}</span>
                              )}
                            </td>
                            <td data-nhan={t("lastSeen")}>{register.device ? formatDateTime(register.device.lastSeenAt) : "—"}</td>
                            <td data-nhan={t("status")}>
                              <span className={`nhan ${register.status === "active" ? (register.overLimit ? "canh-bao" : "thanh-cong") : "trung-tinh"}`}>
                                {register.status === "active" && register.overLimit ? t("overLimit") : t(`register_${register.status}`)}
                              </span>
                            </td>
                            <td data-nhan="">
                              <span className="nhom-nut">
                                <button type="button" className="nut phu" onClick={() => setEditing(register)}>
                                  {t("edit")}
                                </button>
                                {register.status === "active" && !register.overLimit && (
                                  <button
                                    type="button"
                                    className={`nut ${register.device ? "phu" : "chinh"}${pair.submitting ? " dang-xu-ly" : ""}`}
                                    disabled={pair.submitting}
                                    onClick={() =>
                                      void pair.run(async () => {
                                        const code = await portalFetch<IposPairingCode>(`/merchant-portal/ipos/registers/${register.id}/pairing-codes`, { method: "POST" });
                                        setPairing({ register, code });
                                      })
                                    }
                                  >
                                    {register.device ? t("repair") : t("pair")}
                                  </button>
                                )}
                                {register.device && (
                                  <button type="button" className="nut nguy-hiem" onClick={() => setRevoking(register)}>
                                    {t("revoke")}
                                  </button>
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Loaded>
            {pair.formError && <div className="khoi-canh-bao loi">{pair.formError}</div>}
            {editing && (
              <RegisterDrawer
                access={info}
                editing={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  refresh(t("saved"));
                }}
              />
            )}
            {pairing && (
              <PairingDialog
                register={pairing.register}
                pairing={pairing.code}
                onClose={() => {
                  setPairing(null);
                  void reload();
                }}
              />
            )}
            {revoking && revoking.device && (
              <ConfirmDialog
                title={`${t("revokeTitle")} · ${revoking.name}`}
                text={t("revokeText")}
                confirmLabel={t("revoke")}
                busy={revoke.submitting}
                error={revoke.formError}
                onClose={() => setRevoking(null)}
                onConfirm={() =>
                  void revoke.run(async () => {
                    await portalFetch(`/merchant-portal/ipos/devices/${revoking.device!.id}/revoke`, { method: "POST" });
                    setRevoking(null);
                    refresh(t("revoked"));
                  })
                }
              />
            )}
          </>
        )
      }
    </Loaded>
  );
}
