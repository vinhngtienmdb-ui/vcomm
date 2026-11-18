"use client";

// MAN_HINH_297 Thu ngân: yêu cầu tự đăng ký chờ duyệt (chủ cửa hàng; CONG_VIEC_74; CHUC_NANG_254; QUYTAC_NGHIEPVU_605; API_349).
// Khóa, mở, gán điểm bán cho thu ngân dùng chung chức năng ở Cửa hàng của tôi (MAN_HINH_177).
import type { IposCashierRegistration, IposPortalAccess } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { usePortal } from "@/components/PortalShell";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

const statusClass = { pending: "thong-tin", approved: "thanh-cong", rejected: "trung-tinh", expired: "canh-bao" } as const;

function DecisionDrawer({
  registration,
  action,
  access,
  onClose,
  onDone,
}: {
  registration: IposCashierRegistration;
  action: "approve" | "reject";
  access: IposPortalAccess;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("iposPortal");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const outlets = access.outlets.filter((outlet) => outlet.subscriptionStatus !== "cancelled");
  const [outletIds, setOutletIds] = useState<string[]>(registration.requestedOutlets.map((outlet) => outlet.id).filter((id) => outlets.some((outlet) => outlet.outletId === id)));
  const [reason, setReason] = useState("");
  return (
    <Drawer title={`${t(action === "approve" ? "approveTitle" : "rejectTitle")} · ${registration.fullName}`} onClose={onClose}>
      {action === "approve" ? (
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 13 }}>{t("assignOutlets")}</legend>
          {outlets.map((outlet) => (
            <label key={outlet.outletId} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={outletIds.includes(outlet.outletId)}
                onChange={(event) => setOutletIds((current) => (event.target.checked ? [...current, outlet.outletId] : current.filter((id) => id !== outlet.outletId)))}
              />{" "}
              {outlet.outletName}
            </label>
          ))}
          {fields.outletIds && <span className="loi">{fields.outletIds}</span>}
        </fieldset>
      ) : (
        <Field id="ly-do-tu-choi" label={t("rejectReason")} error={fields.reason}>
          <textarea id="ly-do-tu-choi" className={inputClass("reason")} rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      )}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={`nut ${action === "approve" ? "chinh" : "nguy-hiem"}${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || (action === "approve" && outletIds.length === 0)}
          onClick={() =>
            void run(async () => {
              await portalFetch(`/merchant-portal/ipos/cashier-registrations/${registration.id}/${action}`, {
                method: "POST",
                body: JSON.stringify(action === "approve" ? { outletIds } : { reason: reason.trim() || null }),
              });
              onDone();
            })
          }
        >
          {t(action === "approve" ? "approve" : "reject")}
        </button>
      </div>
    </Drawer>
  );
}

export default function IposCashiersPage() {
  const t = useTranslations("iposPortal");
  const { notify, membership } = usePortal();
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const { state, reload } = usePortalApi<IposCashierRegistration[]>("/merchant-portal/ipos/cashier-registrations");
  const [deciding, setDeciding] = useState<{ registration: IposCashierRegistration; action: "approve" | "reject" } | null>(null);
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <h1>{t("cashiersTitle")}</h1>
            <p className="chu-thich">{t("selfRegisterHint", { code: membership.merchantCode })}</p>
            <Loaded state={state} onRetry={() => void reload()}>
              {(items) =>
                items.length === 0 ? (
                  <MessageView text={t("noRegistrations")} />
                ) : (
                  <div className="khung-bang">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("fullName")}</th>
                          <th>{t("phone")}</th>
                          <th>{t("requestedOutlets")}</th>
                          <th>{t("sentAt")}</th>
                          <th>{t("status")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td data-nhan={t("fullName")}>{item.fullName}</td>
                            <td data-nhan={t("phone")}>{item.phone}</td>
                            <td data-nhan={t("requestedOutlets")}>{item.requestedOutlets.map((outlet) => outlet.name).join(", ") || "—"}</td>
                            <td data-nhan={t("sentAt")}>
                              {formatDateTime(item.createdAt)}
                              {item.status === "pending" && <div className="chu-thich">{t("expiresAt", { date: formatDateTime(item.expiresAt) })}</div>}
                            </td>
                            <td data-nhan={t("status")}>
                              <span className={`nhan ${statusClass[item.status]}`}>{t(`registration_${item.status}`)}</span>
                              {item.reason && <div className="chu-thich">{item.reason}</div>}
                            </td>
                            <td data-nhan="">
                              {item.status === "pending" && (
                                <span className="nhom-nut">
                                  <button type="button" className="nut chinh" onClick={() => setDeciding({ registration: item, action: "approve" })}>
                                    {t("approve")}
                                  </button>
                                  <button type="button" className="nut phu" onClick={() => setDeciding({ registration: item, action: "reject" })}>
                                    {t("reject")}
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </Loaded>
            <p>
              <Link href="/store">{t("manageCashiers")}</Link>
            </p>
            {deciding && (
              <DecisionDrawer
                registration={deciding.registration}
                action={deciding.action}
                access={info}
                onClose={() => setDeciding(null)}
                onDone={() => {
                  notify(t(deciding.action === "approve" ? "approved" : "rejected"));
                  setDeciding(null);
                  void reload();
                  void access.reload();
                }}
              />
            )}
          </>
        )
      }
    </Loaded>
  );
}
