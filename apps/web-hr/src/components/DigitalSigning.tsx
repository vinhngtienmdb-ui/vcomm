"use client";

// Ký số hợp đồng lao động, phụ lục (CONG_VIEC_59, CHUC_NANG_213; API_248): lập phiên ký ở Văn phòng số, xem tiến trình.
import type { HrDigitalSigningInfo, OfficePerson } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Dòng tiến trình phiên ký số gần nhất (mở phiên ở Văn phòng số).
export function DigitalSigningStatus({ path, refreshKey }: { path: string; refreshKey: number }) {
  const t = useTranslations("contracts");
  const { state, reload } = useApi<HrDigitalSigningInfo>(path);
  useEffect(() => {
    if (refreshKey > 0) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  if (state.kind !== "ready" || !state.data.signing) return null;
  const signing = state.data.signing;
  const tone = signing.status === "completed" || signing.status === "signing" || signing.status === "draft" ? "thong-tin" : "canh-bao";
  return (
    <div className={`khoi-canh-bao ${tone}`}>
      {t(`digitalSigningStatus_${signing.status}`, { no: signing.requestNo, reason: signing.endReason ?? "" })} <a href={`/office/signing/${signing.id}`}>{t("digitalSigningOpen")}</a>
    </div>
  );
}

export function DigitalSigningDrawer({ path, title, onClose, onDone }: { path: string; title: string; onClose: () => void; onDone: () => void }) {
  const { state, reload } = useApi<HrDigitalSigningInfo>(path);
  return (
    <Drawer title={title} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(info) => <DigitalSigningForm path={path} info={info} onClose={onClose} onDone={onDone} />}
      </Loaded>
    </Drawer>
  );
}

function DigitalSigningForm({ path, info, onClose, onDone }: { path: string; info: HrDigitalSigningInfo; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("contracts");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<OfficePerson[]>([]);
  const [signer, setSigner] = useState<OfficePerson | null>(null);
  const [dueOn, setDueOn] = useState(addDays(vietnamToday(), 7));
  const [note, setNote] = useState("");
  const [email, setEmail] = useState(info.employeeEmail ?? "");
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  useEffect(() => {
    if (search.trim().length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<OfficePerson[]>(`/office/people?search=${encodeURIComponent(search.trim())}`)
        .then(setOptions)
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  if (!info.canStart) return <p className="chu-thich">{t("digitalSigningUnavailable")}</p>;
  const partner = info.employeeSignsAs === "partner";
  const save = () =>
    run(async () => {
      const form = new FormData();
      form.append("data", JSON.stringify({ companySignerUserId: signer?.id ?? "", dueOn, note: note.trim() || null, ...(partner ? { employeeEmail: email.trim() || null } : {}) }));
      if (file) form.append("file", file);
      await apiUpload(path, form);
      onDone();
    });
  return (
    <>
      <p className="chu-thich">{partner ? t("digitalSigningPartnerHint", { name: info.employeeName, last4: info.identityLast4 ?? "—" }) : t("digitalSigningUserHint", { name: info.employeeName })}</p>
      <FormError text={formError} />
      <Field id="ky-so-tep-hd" label={t("digitalSigningFile")} error={fields.file} hint={t("digitalSigningFileHint")}>
        <input id="ky-so-tep-hd" type="file" className={inputClass("file")} accept=".pdf,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <Field id="ky-so-nguoi-ky" label={t("digitalSigningCompanySigner")} error={fields.companySignerUserId} hint={t("digitalSigningCompanySignerHint")}>
        {signer ? (
          <div className="nhom-nut">
            <span className="nhan thong-tin">{signer.fullName}</span>
            <button type="button" className="nut phu" onClick={() => setSigner(null)}>
              {t("digitalSigningChange")}
            </button>
          </div>
        ) : (
          <>
            <input
              id="ky-so-nguoi-ky"
              className={inputClass("companySignerUserId")}
              placeholder={t("digitalSigningSearch")}
              value={search}
              autoComplete="off"
              onChange={(event) => setSearch(event.target.value)}
            />
            {options.length > 0 && (
              <ul className="the" style={{ listStyle: "none", margin: 0, padding: "var(--khoang-2)" }}>
                {options.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      className="nut phu"
                      style={{ width: "100%", justifyContent: "flex-start" }}
                      onClick={() => {
                        setSigner(option);
                        setSearch("");
                        setOptions([]);
                      }}
                    >
                      {option.fullName}
                      {[option.departmentName, option.companyName].filter(Boolean).length > 0 && ` · ${[option.departmentName, option.companyName].filter(Boolean).join(" · ")}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Field>
      {partner && (
        <Field id="ky-so-thu" label={t("digitalSigningEmail")} error={fields.employeeEmail} hint={t("digitalSigningEmailHint")}>
          <input id="ky-so-thu" type="email" className={inputClass("employeeEmail")} value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      )}
      <Field id="ky-so-han-hd" label={t("digitalSigningDue")} error={fields.dueOn}>
        <input id="ky-so-han-hd" type="date" className={inputClass("dueOn")} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
      </Field>
      <Field id="ky-so-loi-nhan" label={t("digitalSigningNote")}>
        <textarea id="ky-so-loi-nhan" className="o-nhap" rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {t("digitalSigningClose")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !file || !signer} onClick={() => void save()}>
          {t("digitalSigningSend")}
        </button>
      </div>
    </>
  );
}
