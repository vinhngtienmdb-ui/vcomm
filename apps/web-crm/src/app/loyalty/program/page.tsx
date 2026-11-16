"use client";

// MAN_HINH_146 Chương trình điểm (CONG_VIEC_51; CHUC_NANG_178; API_176; QUYTAC_NGHIEPVU_345, 351): giai đoạn, bảng hạng.
// CONG_VIEC_60 (CHUC_NANG_214; QUYTAC_NGHIEPVU_468): kiểu chia chi phí theo giai đoạn.
import { loyaltyCostBearers, type LoyaltyCostBearer, type LoyaltyPhase, LoyaltyProgramResponse, LoyaltyTier } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const statusTone = { upcoming: "thong-tin", active: "thanh-cong", ended: "trung-tinh" } as const;

type PhaseDraft = {
  startsOn: string;
  endsOn: string;
  earnPercent: string;
  pointValue: string;
  redeemMaxPercent: string;
  redeemMinPoints: string;
  validityMonths: string;
  orderCapPoints: string;
  monthlyCapPoints: string;
  costBearer: LoyaltyCostBearer;
};

const draftOf = (phase: LoyaltyPhase | null, today: string): PhaseDraft =>
  phase
    ? {
        startsOn: phase.startsOn,
        endsOn: phase.endsOn ?? "",
        earnPercent: phase.earnPercent,
        pointValue: phase.pointValue,
        redeemMaxPercent: phase.redeemMaxPercent,
        redeemMinPoints: String(phase.redeemMinPoints),
        validityMonths: String(phase.validityMonths),
        orderCapPoints: phase.orderCapPoints === null ? "" : String(phase.orderCapPoints),
        monthlyCapPoints: phase.monthlyCapPoints === null ? "" : String(phase.monthlyCapPoints),
        costBearer: phase.costBearer,
      }
    : {
        startsOn: today,
        endsOn: "",
        earnPercent: "1",
        pointValue: "1",
        redeemMaxPercent: "50",
        redeemMinPoints: "1000",
        validityMonths: "12",
        orderCapPoints: "",
        monthlyCapPoints: "",
        costBearer: "earning_company",
      };

const optionalNumber = (value: string) => (value.trim() === "" ? null : Number(value.replaceAll(".", "")));

function PhaseForm({ phase, today, onDone }: { phase: LoyaltyPhase | null; today: string; onDone: () => Promise<void> }) {
  const t = useTranslations("loyalty");
  const { notify } = useAdmin();
  const [draft, setDraft] = useState(draftOf(phase, today));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const started = phase !== null && phase.status !== "upcoming";
  const set = (key: keyof PhaseDraft) => (event: { target: { value: string } }) => setDraft({ ...draft, [key]: event.target.value });
  const body = () => ({
    startsOn: draft.startsOn,
    endsOn: draft.endsOn || null,
    earnPercent: draft.earnPercent.trim().replace(",", "."),
    pointValue: draft.pointValue.trim().replace(",", "."),
    redeemMaxPercent: draft.redeemMaxPercent.trim().replace(",", "."),
    redeemMinPoints: Number(draft.redeemMinPoints.replaceAll(".", "")),
    validityMonths: Number(draft.validityMonths),
    orderCapPoints: optionalNumber(draft.orderCapPoints),
    monthlyCapPoints: optionalNumber(draft.monthlyCapPoints),
    costBearer: draft.costBearer,
  });
  const save = () =>
    run(async () => {
      if (phase) await apiFetch(`/loyalty/phases/${phase.id}`, { method: "PUT", body: JSON.stringify({ ...body(), version: phase.version }) });
      else await apiFetch("/loyalty/phases", { method: "POST", body: JSON.stringify(body()) });
      notify(t("phaseSaved"));
      await onDone();
    });
  const remove = () =>
    run(async () => {
      await apiFetch(`/loyalty/phases/${phase!.id}`, { method: "DELETE" });
      notify(t("phaseDeleted"));
      await onDone();
    });
  const example = Math.floor((500000 * Number(draft.earnPercent.replace(",", ".") || 0) * 1.2) / 100 / Number(draft.pointValue.replace(",", ".") || 1));
  const input = (key: keyof PhaseDraft, type = "text", disabled = started) => (
    <Field id={`gd-${key}`} label={t(`phase_${key}`)} error={fields[key]}>
      <input id={`gd-${key}`} type={type} className={inputClass(key)} value={draft[key]} disabled={disabled} onChange={set(key)} inputMode={type === "text" ? "decimal" : undefined} />
    </Field>
  );
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{phase ? t(started ? "editActivePhase" : "editPhase", { from: formatDate(phase.startsOn) }) : t("newPhase")}</h2>
      {started ? <div className="khoi-canh-bao canh-bao">{t("startedHint")}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
        {input("startsOn", "date")}
        {input("endsOn", "date", false)}
        {input("earnPercent")}
        {input("pointValue")}
        {input("redeemMaxPercent")}
        {input("redeemMinPoints")}
        {input("validityMonths")}
        {input("orderCapPoints")}
        {input("monthlyCapPoints")}
        <Field id="gd-costBearer" label={t("phase_costBearer")} error={fields.costBearer}>
          <select id="gd-costBearer" className={inputClass("costBearer")} value={draft.costBearer} disabled={started} onChange={set("costBearer")}>
            {loyaltyCostBearers.map((bearer) => (
              <option key={bearer} value={bearer}>
                {t(`costBearer_${bearer}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="khoi-canh-bao thong-tin">{t("costBearerHint")}</div>
      {!started ? <div className="khoi-canh-bao thong-tin">{t("example", { points: formatNumber(example, 0) })}</div> : null}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut chinh" disabled={submitting} onClick={() => void save()}>
          {t(started ? "saveEndDate" : "save")}
        </button>
        {phase && !started ? (
          <button type="button" className="nut nguy-hiem" disabled={submitting} onClick={() => void remove()}>
            {t("deletePhase")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TierEditor({ tiers, canManage, onDone }: { tiers: LoyaltyTier[]; canManage: boolean; onDone: () => Promise<void> }) {
  const t = useTranslations("loyalty");
  const { notify } = useAdmin();
  const [rows, setRows] = useState(tiers.map((tier) => ({ nameVi: tier.nameVi, nameEn: tier.nameEn, minAnnualSpend: tier.minAnnualSpend, multiplier: tier.multiplier })));
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const update = (index: number, key: keyof (typeof rows)[number], value: string) => setRows(rows.map((row, position) => (position === index ? { ...row, [key]: value } : row)));
  const save = () =>
    run(async () => {
      await apiFetch("/loyalty/tiers", {
        method: "PUT",
        body: JSON.stringify({ tiers: rows.map((row) => ({ ...row, minAnnualSpend: row.minAnnualSpend.replaceAll(".", ""), multiplier: row.multiplier.replace(",", ".") })) }),
      });
      notify(t("tiersSaved"));
      await onDone();
    });
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("tiers")}</h2>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("tierOrder")}</th>
              <th>{t("tierNameVi")}</th>
              <th>{t("tierNameEn")}</th>
              <th>{t("tierMinSpend")}</th>
              <th>{t("tierMultiplier")}</th>
              {canManage ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td data-nhan={t("tierOrder")}>{index + 1}</td>
                {(["nameVi", "nameEn", "minAnnualSpend", "multiplier"] as const).map((key) => (
                  <td key={key} data-nhan={t(`tier_${key}`)}>
                    {key === "minAnnualSpend" && index === 0 ? (
                      t("lowestTier")
                    ) : (
                      <>
                        <input
                          className={inputClass(`tiers.${index}.${key}`)}
                          aria-label={`${t(`tier_${key}`)} ${index + 1}`}
                          value={row[key]}
                          disabled={!canManage}
                          onChange={(event) => update(index, key, event.target.value)}
                        />
                        {fields[`tiers.${index}.${key}`] ? <span className="loi-o">{fields[`tiers.${index}.${key}`]}</span> : null}
                      </>
                    )}
                  </td>
                ))}
                {canManage ? (
                  <td>
                    {index > 0 && index === rows.length - 1 ? (
                      <button type="button" className="nut chu" onClick={() => setRows(rows.slice(0, -1))}>
                        {t("removeTier")}
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="khoi-canh-bao thong-tin">{t("tiersHint")}</div>
      <FormError text={formError} />
      {canManage ? (
        <div className="nhom-nut">
          {rows.length < 10 ? (
            <button type="button" className="nut phu" onClick={() => setRows([...rows, { nameVi: "", nameEn: "", minAnnualSpend: "", multiplier: "1" }])}>
              {t("addTier")}
            </button>
          ) : null}
          <button type="button" className="nut chinh" disabled={submitting} onClick={() => void save()}>
            {t("saveTiers")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function LoyaltyProgramPage() {
  const t = useTranslations("loyalty");
  const { state, reload } = useApi<LoyaltyProgramResponse>("/loyalty/program");
  // Giai đoạn đang sửa: null là thêm mới, undefined là không mở biểu mẫu.
  const [editing, setEditing] = useState<LoyaltyPhase | null | undefined>(undefined);
  const [tab, setTab] = useState<"phases" | "tiers">("phases");
  const done = async () => {
    setEditing(undefined);
    await reload();
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(program) => (
        <>
          <div className="tieu-de">
            <h1>{t("programTitle")}</h1>
            {program.canManage && tab === "phases" ? (
              <button type="button" className="nut chinh" onClick={() => setEditing(null)}>
                {t("addPhase")}
              </button>
            ) : null}
          </div>
          <div className="nhom-nut" role="tablist">
            {(["phases", "tiers"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} className={`nut ${tab === item ? "chinh" : "phu"}`} onClick={() => setTab(item)}>
                {t(`tab_${item}`)}
              </button>
            ))}
          </div>
          {tab === "phases" ? (
            <>
              {program.phases.length === 0 ? (
                <div className="the">{t("noPhase")}</div>
              ) : (
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {["startsOn", "endsOn", "earnPercent", "pointValue", "redeemMaxPercent", "redeemMinPoints", "validityMonths", "orderCapPoints", "monthlyCapPoints", "costBearer"].map((key) => (
                          <th key={key}>{t(`column_${key}`)}</th>
                        ))}
                        <th>{t("column_status")}</th>
                        {program.canManage ? <th /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {program.phases.map((phase) => (
                        <tr key={phase.id}>
                          <td data-nhan={t("column_startsOn")}>{formatDate(phase.startsOn)}</td>
                          <td data-nhan={t("column_endsOn")}>{phase.endsOn ? formatDate(phase.endsOn) : "—"}</td>
                          <td data-nhan={t("column_earnPercent")}>{`${formatNumber(phase.earnPercent)}%`}</td>
                          <td data-nhan={t("column_pointValue")}>{`${formatNumber(phase.pointValue)} ₫`}</td>
                          <td data-nhan={t("column_redeemMaxPercent")}>{`${formatNumber(phase.redeemMaxPercent)}%`}</td>
                          <td data-nhan={t("column_redeemMinPoints")}>{formatNumber(phase.redeemMinPoints, 0)}</td>
                          <td data-nhan={t("column_validityMonths")}>{t("months", { count: phase.validityMonths })}</td>
                          <td data-nhan={t("column_orderCapPoints")}>{phase.orderCapPoints === null ? "—" : formatNumber(phase.orderCapPoints, 0)}</td>
                          <td data-nhan={t("column_monthlyCapPoints")}>{phase.monthlyCapPoints === null ? "—" : formatNumber(phase.monthlyCapPoints, 0)}</td>
                          <td data-nhan={t("column_costBearer")}>{t(`costBearer_${phase.costBearer}`)}</td>
                          <td data-nhan={t("column_status")}>
                            <span className={`nhan ${statusTone[phase.status]}`}>{t(`status_${phase.status}`)}</span>
                          </td>
                          {program.canManage ? (
                            <td>
                              {phase.status !== "ended" ? (
                                <button type="button" className="nut chu" onClick={() => setEditing(phase)}>
                                  {t("edit")}
                                </button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editing !== undefined ? <PhaseForm key={editing?.id ?? "moi"} phase={editing} today={program.today} onDone={done} /> : null}
            </>
          ) : (
            <TierEditor
              key={program.tiers.map((tier) => `${tier.id}${tier.minAnnualSpend}${tier.multiplier}${tier.nameVi}`).join()}
              tiers={program.tiers}
              canManage={program.canManage}
              onDone={reload}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
