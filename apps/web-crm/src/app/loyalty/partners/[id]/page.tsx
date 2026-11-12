"use client";

// MAN_HINH_259 Chi tiết đối tác liên minh: hợp đồng, giới hạn, trạng thái, tỷ lệ theo chiều và giai đoạn, bộ giả lập
// (CONG_VIEC_65; CHUC_NANG_236; API_301 đến 303). Khối khóa API, số dư trả trước hoặc dư nợ thêm ở lát L3.
import type { PartnerContractDetail, PartnerDirection, PartnerRate, PartnerSimulatorMode, PartnerSimulatorState } from "contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { partnerBody, partnerDirections, partnerFormOf, partnerStatusClass, PartnerTermsFields, type PartnerForm } from "@/components/LoyaltyPartnerForm";

const rateStatusClass = { upcoming: "thong-tin", active: "thanh-cong", ended: "trung-tinh" } as const;

function StatusAction({ contract, target, onDone }: { contract: PartnerContractDetail; target: "activate" | "suspend" | "terminate"; onDone: () => void }) {
  const t = useTranslations("loyaltyPartner");
  const { submitting, formError, run } = useSubmit();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const send = () =>
    void run(async () => {
      await apiFetch(`/loyalty/partners/${contract.id}/${target}`, { method: "POST", body: JSON.stringify({ version: contract.version, ...(target === "activate" ? {} : { reason }) }) });
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
      <button type="button" className={target === "terminate" ? "nut nguy-hiem" : "nut phu"} onClick={() => setOpen(true)}>
        {t(`action_${target}`)}
      </button>
      {open && (
        <Drawer title={t(`action_${target}`)} onClose={() => setOpen(false)}>
          <Field id="ly-do-lm" label={t("reason")}>
            <textarea id="ly-do-lm" className="o-nhap" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
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

// Thêm giai đoạn tỷ lệ, hoặc sửa: chưa bắt đầu sửa mọi trường, đã bắt đầu chỉ sửa ngày kết thúc (QUYTAC_NGHIEPVU_539).
function RateDrawer({ contract, rate, onClose, onSaved }: { contract: PartnerContractDetail; rate: PartnerRate | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("loyaltyPartner");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [direction, setDirection] = useState<PartnerDirection>(rate?.direction ?? "outbound");
  const [startsOn, setStartsOn] = useState(rate?.startsOn ?? vietnamToday());
  const [endsOn, setEndsOn] = useState(rate?.endsOn ?? "");
  const [vcommPoints, setVcommPoints] = useState(rate?.vcommPoints ? String(rate.vcommPoints) : "");
  const [partnerUnits, setPartnerUnits] = useState(rate?.partnerUnits ? String(rate.partnerUnits) : "");
  const [unitPrice, setUnitPrice] = useState(rate?.unitPrice ?? "");
  const started = rate !== null && rate.status !== "upcoming";
  const gift = direction === "gift";
  return (
    <Drawer title={rate ? t("editRate") : t("addRate")} onClose={onClose}>
      <form
        style={{ display: "grid", gap: "var(--khoang-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const body = {
              startsOn,
              endsOn: endsOn || null,
              vcommPoints: gift ? null : Number(vcommPoints),
              partnerUnits: gift ? null : Number(partnerUnits),
              unitPrice: unitPrice.replace(",", "."),
            };
            await apiFetch(rate ? `/loyalty/partner-rates/${rate.id}` : `/loyalty/partners/${contract.id}/rates`, {
              method: rate ? "PUT" : "POST",
              body: JSON.stringify(rate ? { ...body, version: rate.version } : { ...body, direction }),
            });
            onSaved();
          });
        }}
      >
        {started && <div className="khoi-canh-bao canh-bao">{t("rateStartedHint")}</div>}
        <Field id="ty-le-chieu" label={t("direction")}>
          <select id="ty-le-chieu" className="o-nhap" value={direction} disabled={rate !== null} onChange={(event) => setDirection(event.target.value as PartnerDirection)}>
            {partnerDirections.map((value) => (
              <option key={value} value={value}>
                {t(`direction_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ty-le-tu" label={t("startsOn")} error={fields.startsOn}>
          <input id="ty-le-tu" type="date" className={inputClass("startsOn")} value={startsOn} disabled={started} onChange={(event) => setStartsOn(event.target.value)} />
        </Field>
        <Field id="ty-le-den" label={t("endsOn")} error={fields.endsOn} hint={t("endsOnHint")}>
          <input id="ty-le-den" type="date" className={inputClass("endsOn")} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
        </Field>
        {!gift && (
          <>
            <Field id="ty-le-vcomm" label={t("vcommPoints")} error={fields.vcommPoints}>
              <input id="ty-le-vcomm" inputMode="numeric" className={inputClass("vcommPoints")} value={vcommPoints} disabled={started} onChange={(event) => setVcommPoints(event.target.value)} />
            </Field>
            <Field id="ty-le-doi-tac" label={t("partnerUnits", { unit: contract.unitNameVi })} error={fields.partnerUnits}>
              <input id="ty-le-doi-tac" inputMode="numeric" className={inputClass("partnerUnits")} value={partnerUnits} disabled={started} onChange={(event) => setPartnerUnits(event.target.value)} />
            </Field>
          </>
        )}
        <Field id="ty-le-don-gia" label={gift ? t("giftPrice") : t(`unitPrice_${direction}`, { unit: contract.unitNameVi })} error={fields.unitPrice}>
          <input id="ty-le-don-gia" inputMode="decimal" className={inputClass("unitPrice")} value={unitPrice} disabled={started} onChange={(event) => setUnitPrice(event.target.value)} />
        </Field>
        {!gift && vcommPoints && partnerUnits && <p className="chu-thich">{t("rateExample", { points: Number(vcommPoints) * 3, units: Number(partnerUnits) * 3, unit: contract.unitNameVi })}</p>}
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

function RatesSection({ contract, onChanged }: { contract: PartnerContractDetail; onChanged: (message: string) => void }) {
  const t = useTranslations("loyaltyPartner");
  const { formError, run } = useSubmit();
  const [editing, setEditing] = useState<PartnerRate | "new" | null>(null);
  const editable = contract.canManage && contract.status !== "terminated";
  const ratio = (rate: PartnerRate) => (rate.direction === "gift" ? "—" : t("ratio", { points: rate.vcommPoints ?? 0, units: rate.partnerUnits ?? 0, unit: contract.unitNameVi }));
  const price = (rate: PartnerRate) =>
    rate.direction === "gift"
      ? t("giftPriceValue", { price: formatNumber(rate.unitPrice, 4) })
      : t(`unitPriceValue_${rate.direction}`, { price: formatNumber(rate.unitPrice, 4), unit: contract.unitNameVi });
  return (
    <section className="the">
      <div className="tieu-de">
        <h2>{t("ratesTitle")}</h2>
        {editable && (
          <button type="button" className="nut phu" onClick={() => setEditing("new")}>
            {t("addRate")}
          </button>
        )}
      </div>
      {contract.rates.length === 0 ? (
        <p className="chu-thich">{t("noRates")}</p>
      ) : (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {["direction", "startsOn", "endsOn", "ratio", "unitPrice", "status"].map((key) => (
                  <th key={key}>{t(`rateColumn_${key}`)}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {contract.rates.map((rate) => (
                <tr key={rate.id}>
                  <td data-nhan={t("rateColumn_direction")}>{t(`direction_${rate.direction}`)}</td>
                  <td data-nhan={t("rateColumn_startsOn")}>{formatDate(rate.startsOn)}</td>
                  <td data-nhan={t("rateColumn_endsOn")}>{formatDate(rate.endsOn)}</td>
                  <td data-nhan={t("rateColumn_ratio")}>{ratio(rate)}</td>
                  <td data-nhan={t("rateColumn_unitPrice")}>{price(rate)}</td>
                  <td data-nhan={t("rateColumn_status")}>
                    <span className={`nhan ${rateStatusClass[rate.status]}`}>{t(`rateStatus_${rate.status}`)}</span>
                  </td>
                  <td data-nhan="">
                    {editable && rate.status !== "ended" && (
                      <span className="nhom-nut">
                        <button type="button" className="nut chu" onClick={() => setEditing(rate)}>
                          {rate.status === "active" ? t("editEnd") : t("edit")}
                        </button>
                        {rate.status === "upcoming" && (
                          <button
                            type="button"
                            className="nut chu"
                            onClick={() =>
                              void run(async () => {
                                await apiFetch(`/loyalty/partner-rates/${rate.id}`, { method: "DELETE" });
                                onChanged(t("rateDeleted"));
                              })
                            }
                          >
                            {t("delete")}
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
      <FormError text={formError} />
      <p className="chu-thich">{t("ratesHint")}</p>
      {editing && (
        <RateDrawer
          contract={contract}
          rate={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged(t("saved"));
          }}
        />
      )}
    </section>
  );
}

// Bộ giả lập (QUYTAC_NGHIEPVU_550): chỉ chạy khi máy chủ bật biến môi trường; chế độ trả lời, thành viên giả để xem trước, kiểm thử.
function SimulatorSection({ contract }: { contract: PartnerContractDetail }) {
  const t = useTranslations("loyaltyPartner");
  const { notify } = useAdmin();
  const { state, reload } = useApi<PartnerSimulatorState>(`/loyalty/partners/${contract.id}/simulator`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [mode, setMode] = useState<PartnerSimulatorMode | null>(null);
  const [member, setMember] = useState({ memberNumber: "", fullName: "", phone: "", balanceUnits: "0" });
  const editable = contract.canManage;
  return (
    <section className="the">
      <h2>{t("simulatorTitle")}</h2>
      <Loaded state={state} onRetry={() => void reload()}>
        {(simulator) => (
          <>
            <div className="khoi-canh-bao canh-bao">{simulator.enabled ? t("simulatorHint") : t("simulatorDisabled")}</div>
            {simulator.enabled && (
              <>
                <div className="bo-loc">
                  <label htmlFor="che-do-gia-lap">{t("simulatorMode")}</label>
                  <select id="che-do-gia-lap" className="o-nhap" value={mode ?? simulator.mode} disabled={!editable} onChange={(event) => setMode(event.target.value as PartnerSimulatorMode)}>
                    {(["normal", "reject", "timeout", "statement_mismatch"] as const).map((value) => (
                      <option key={value} value={value}>
                        {t(`simulatorMode_${value}`)}
                      </option>
                    ))}
                  </select>
                  {editable && (
                    <button
                      type="button"
                      className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
                      disabled={submitting}
                      onClick={() =>
                        void run(async () => {
                          await apiFetch(`/loyalty/partners/${contract.id}/simulator`, { method: "PUT", body: JSON.stringify({ mode: mode ?? simulator.mode }) });
                          notify(t("saved"));
                          await reload();
                        })
                      }
                    >
                      {t("saveMode")}
                    </button>
                  )}
                </div>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("memberNumber")}</th>
                        <th>{t("memberName")}</th>
                        <th>{t("memberPhone")}</th>
                        <th>{t("balanceUnits", { unit: contract.unitNameVi })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulator.members.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="chu-thich">
                            {t("noSimulatorMembers")}
                          </td>
                        </tr>
                      ) : (
                        simulator.members.map((item) => (
                          <tr key={item.memberNumber}>
                            <td data-nhan={t("memberNumber")}>{item.memberNumber}</td>
                            <td data-nhan={t("memberName")}>{item.fullName}</td>
                            <td data-nhan={t("memberPhone")}>{item.phone}</td>
                            <td data-nhan={t("balanceUnits", { unit: contract.unitNameVi })}>{formatNumber(item.balanceUnits, 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {editable && (
                  <form
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)", alignItems: "end" }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(async () => {
                        await apiFetch(`/loyalty/partners/${contract.id}/simulator/members`, {
                          method: "POST",
                          body: JSON.stringify({ ...member, balanceUnits: Number(member.balanceUnits.replace(/[.\s]/g, "")) }),
                        });
                        setMember({ memberNumber: "", fullName: "", phone: "", balanceUnits: "0" });
                        notify(t("saved"));
                        await reload();
                      });
                    }}
                  >
                    {(["memberNumber", "fullName", "phone", "balanceUnits"] as const).map((key) => (
                      <Field key={key} id={`gia-lap-${key}`} label={key === "balanceUnits" ? t("balanceUnits", { unit: contract.unitNameVi }) : t(`simulatorField_${key}`)} error={fields[key]}>
                        <input id={`gia-lap-${key}`} className={inputClass(key)} value={member[key]} onChange={(event) => setMember({ ...member, [key]: event.target.value })} />
                      </Field>
                    ))}
                    <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
                      {t("addSimulatorMember")}
                    </button>
                  </form>
                )}
              </>
            )}
            <FormError text={formError} />
          </>
        )}
      </Loaded>
    </section>
  );
}

export default function LoyaltyPartnerPage() {
  const t = useTranslations("loyaltyPartner");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PartnerContractDetail>(`/loyalty/partners/${id}`);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState<PartnerForm | null>(null);
  const contract = state.kind === "ready" ? state.data : null;
  useEffect(() => {
    if (contract) setForm(partnerFormOf(contract));
  }, [contract]);
  const done = (message: string) => {
    notify(message);
    void reload();
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
        <>
          <p>
            <Link href="/loyalty/partners">‹ {t("title")}</Link>
          </p>
          <div className="tieu-de">
            <h1>
              {data.code} · {data.partnerName}
            </h1>
            <span className={`nhan ${partnerStatusClass[data.status]}`}>{t(`status_${data.status}`)}</span>
            {data.canManage && data.status !== "terminated" && (
              <span className="nhom-nut">
                {(data.status === "draft" || data.status === "suspended") && <StatusAction contract={data} target="activate" onDone={() => done(t("saved"))} />}
                {data.status === "active" && <StatusAction contract={data} target="suspend" onDone={() => done(t("saved"))} />}
                <StatusAction contract={data} target="terminate" onDone={() => done(t("saved"))} />
              </span>
            )}
          </div>
          {data.statusReason && <div className="khoi-canh-bao canh-bao">{t("statusReason", { reason: data.statusReason })}</div>}
          <section className="the">
            <h2>{t("contract")}</h2>
            <p className="chu-thich">
              {t("partner")}: {data.partnerCode} · {data.partnerName} {data.taxCode ? `· ${data.taxCode}` : ""} · {t("linkedMembers", { count: data.linkedMembers })}
            </p>
            {form && (
              <form
                style={{ display: "grid", gap: "var(--khoang-3)" }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await apiFetch(`/loyalty/partners/${data.id}`, { method: "PUT", body: JSON.stringify({ ...partnerBody(form), version: data.version }) });
                    done(t("saved"));
                  });
                }}
              >
                <PartnerTermsFields form={form} setForm={setForm} fields={fields} inputClass={inputClass} disabled={!data.canManage || data.status === "terminated"} />
                <p className="chu-thich">{t("termsApplyHint")}</p>
                <FormError text={formError} />
                {data.canManage && data.status !== "terminated" && (
                  <div className="nhom-nut">
                    <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
                      {t("saveContract")}
                    </button>
                  </div>
                )}
              </form>
            )}
          </section>
          <RatesSection contract={data} onChanged={done} />
          {data.connector === "simulator" && <SimulatorSection contract={data} />}
        </>
      )}
    </Loaded>
  );
}
