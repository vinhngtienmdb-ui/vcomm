"use client";

// Thêm, sửa quầy thu ngân của cửa hàng (MAN_HINH_166; QUYTAC_NGHIEPVU_368).
import type { RetailRegisterResponse, SaveRetailRegisterRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";

export function RegisterEditor({ storeId, register, onSaved, onCancel }: { storeId: string; register: RetailRegisterResponse | null; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("retailStores");
  const [code, setCode] = useState(register?.code ?? "");
  const [name, setName] = useState(register?.name ?? "");
  const [active, setActive] = useState(register ? register.status === "active" : true);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveRetailRegisterRequest = { code, name, status: active ? "active" : "inactive", ...(register ? { version: register.version } : {}) };
      await apiFetch(register ? `/retail/registers/${register.id}` : `/retail/stores/${storeId}/registers`, { method: register ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  }
  return (
    <form onSubmit={submit} className="bo-loc" style={{ alignItems: "flex-end" }}>
      <Field id={`ma-quay-${register?.id ?? "moi"}`} label={`${t("registerCode")} *`} error={fields.code}>
        <input id={`ma-quay-${register?.id ?? "moi"}`} className={inputClass("code")} maxLength={20} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
      </Field>
      <Field id={`ten-quay-${register?.id ?? "moi"}`} label={`${t("registerName")} *`} error={fields.name}>
        <input id={`ten-quay-${register?.id ?? "moi"}`} className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      {register && (
        <label>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> {t("activeLabel")}
        </label>
      )}
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
        {t("save")}
      </button>
      <button type="button" className="nut phu" onClick={onCancel}>
        {t("cancel")}
      </button>
      <FormError text={formError} />
    </form>
  );
}
