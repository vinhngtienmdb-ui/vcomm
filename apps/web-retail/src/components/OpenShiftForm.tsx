"use client";

// Mở ca (MAN_HINH_162 phần mở ca; QUYTAC_NGHIEPVU_369): chọn cửa hàng, quầy, tiền đầu ca; gợi ý tiền cuối ca trước, lệch thì ghi chú.
import type { OpenRetailShiftRequest, RetailCounterContext, RetailShiftResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatMoney } from "ui/lib/format";

export function OpenShiftForm({ context, onOpened }: { context: RetailCounterContext; onOpened: (shift: RetailShiftResponse) => void }) {
  const t = useTranslations("retailShifts");
  const firstStore = context.stores[0];
  const [storeId, setStoreId] = useState(firstStore?.id ?? "");
  const store = context.stores.find((item) => item.id === storeId);
  const [registerId, setRegisterId] = useState(firstStore?.registers.find((register) => !register.busy)?.id ?? "");
  const register = store?.registers.find((item) => item.id === registerId);
  const [openingCash, setOpeningCash] = useState(register?.lastClosingCash ?? "0");
  const [openingNote, setOpeningNote] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  if (!firstStore) return <MessageView text={t("noCounter")} />;
  function chooseRegister(id: string) {
    setRegisterId(id);
    setOpeningCash(store?.registers.find((item) => item.id === id)?.lastClosingCash ?? "0");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: OpenRetailShiftRequest = { registerId, openingCash, openingNote };
      onOpened(await apiFetch<RetailShiftResponse>("/retail/shifts", { method: "POST", body: JSON.stringify(body) }));
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)", maxWidth: 520 }}>
      <h2>{t("openTitle")}</h2>
      <Field id="cua-hang" label={t("store")}>
        <select
          id="cua-hang"
          className="o-nhap"
          value={storeId}
          onChange={(event) => {
            setStoreId(event.target.value);
            const next = context.stores.find((item) => item.id === event.target.value)?.registers.find((item) => !item.busy);
            chooseRegister(next?.id ?? "");
          }}
        >
          {context.stores.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="quay" label={t("register")} error={fields.registerId}>
        <select id="quay" className={inputClass("registerId")} value={registerId} onChange={(event) => chooseRegister(event.target.value)}>
          {store?.registers.map((item) => (
            <option key={item.id} value={item.id} disabled={item.busy}>
              {item.code} – {item.name}
              {item.busy ? ` (${t("busy")})` : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id="tien-dau-ca"
        label={t("openingCash")}
        error={fields.openingCash}
        hint={register?.lastClosingCash != null ? t("lastClosing", { amount: formatMoney(register.lastClosingCash, context.currency) }) : undefined}
      >
        <input id="tien-dau-ca" className={inputClass("openingCash")} inputMode="decimal" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
      </Field>
      <Field id="ghi-chu-mo-ca" label={t("openingNote")} error={fields.openingNote}>
        <textarea id="ghi-chu-mo-ca" className={inputClass("openingNote")} rows={2} maxLength={500} value={openingNote} onChange={(event) => setOpeningNote(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !registerId}>
        {t("open")}
      </button>
    </form>
  );
}
