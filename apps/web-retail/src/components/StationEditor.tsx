"use client";

// MAN_HINH_191 Cài đặt trạm giao hàng O2O (CHUC_NANG_200; QUYTAC_NGHIEPVU_419, 420; API_220).
import type { RetailRegionItem, RetailStationResponse, RetailStoreResponse, SaveRetailStationRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

type DeliveryWard = RetailStationResponse["deliveryWards"][number];

// Xã của một tỉnh, tải khi chọn tỉnh.
function useWards(provinceCode: string): RetailRegionItem[] {
  const [wards, setWards] = useState<RetailRegionItem[]>([]);
  useEffect(() => {
    if (!provinceCode) return setWards([]);
    let current = true;
    void apiFetch<RetailRegionItem[]>(`/retail/regions/provinces/${provinceCode}/wards`).then((loaded) => current && setWards(loaded));
    return () => {
      current = false;
    };
  }, [provinceCode]);
  return wards;
}

export function StationEditor({ store, onSaved, onCancel }: { store: RetailStoreResponse; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("retailStores");
  const station = store.station;
  const provinces = useApi<RetailRegionItem[]>("/retail/regions/provinces");
  const [pickupEnabled, setPickupEnabled] = useState(station.pickupEnabled);
  const [deliveryEnabled, setDeliveryEnabled] = useState(station.deliveryEnabled);
  const [displayName, setDisplayName] = useState(station.displayName ?? store.branch.name);
  const [provinceCode, setProvinceCode] = useState(station.province?.code ?? "");
  const [wardCode, setWardCode] = useState(station.ward?.code ?? "");
  const [streetAddress, setStreetAddress] = useState(station.streetAddress ?? "");
  const [phone, setPhone] = useState(station.phone ?? store.branch.phone ?? "");
  const [openingHours, setOpeningHours] = useState(station.openingHours ?? "");
  const [holdDays, setHoldDays] = useState(String(station.holdDays));
  const [deliveryFee, setDeliveryFee] = useState(String(Number(station.deliveryFee)));
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(station.freeDeliveryThreshold === null ? "" : String(Number(station.freeDeliveryThreshold)));
  const [deliveryWards, setDeliveryWards] = useState<DeliveryWard[]>(station.deliveryWards);
  const [deliveryProvince, setDeliveryProvince] = useState(station.province?.code ?? "");
  const [deliveryWard, setDeliveryWard] = useState("");
  const wards = useWards(provinceCode);
  const deliveryWardOptions = useWards(deliveryProvince);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const provinceList = provinces.state.kind === "ready" ? provinces.state.data : [];

  function addWard() {
    const ward = deliveryWardOptions.find((item) => item.code === deliveryWard);
    const province = provinceList.find((item) => item.code === deliveryProvince);
    if (!ward || !province || deliveryWards.some((item) => item.code === ward.code)) return;
    setDeliveryWards([...deliveryWards, { code: ward.code, name: ward.name, provinceCode: province.code, provinceName: province.name }]);
    setDeliveryWard("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveRetailStationRequest = {
        pickupEnabled,
        deliveryEnabled,
        displayName,
        provinceCode,
        wardCode,
        streetAddress,
        phone,
        openingHours,
        holdDays: Number(holdDays),
        deliveryFee: deliveryFee || "0",
        freeDeliveryThreshold,
        deliveryWardCodes: deliveryWards.map((ward) => ward.code),
        version: station.version,
      };
      await apiFetch<RetailStoreResponse>(`/retail/stores/${store.id}/station`, { method: "PATCH", body: JSON.stringify(body) });
      onSaved();
    });
  }

  const text = (
    id: string,
    field: string,
    label: string,
    value: string,
    setter: (value: string) => void,
    extra: { maxLength?: number; inputMode?: "numeric" | "decimal" | "tel"; hint?: string } = {},
  ) => (
    <Field id={id} label={label} error={fields[field]} {...(extra.hint ? { hint: extra.hint } : {})}>
      <input id={id} className={inputClass(field)} value={value} maxLength={extra.maxLength} inputMode={extra.inputMode} onChange={(event) => setter(event.target.value)} />
    </Field>
  );
  const required = pickupEnabled || deliveryEnabled ? " *" : "";

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
      {!store.isMarketplaceOperator && <p className="khoi canh-bao">{t("stationNotOperator")}</p>}
      <div className="nhom-nut">
        <label>
          <input type="checkbox" checked={pickupEnabled} onChange={(event) => setPickupEnabled(event.target.checked)} /> {t("pickupEnabled")}
        </label>
        <label>
          <input type="checkbox" checked={deliveryEnabled} onChange={(event) => setDeliveryEnabled(event.target.checked)} /> {t("deliveryEnabled")}
        </label>
      </div>
      {text("so-ngay-giu", "holdDays", `${t("holdDays")} *`, holdDays, setHoldDays, { inputMode: "numeric", hint: t("holdDaysHint") })}
      <h3>{t("stationCustomerInfo")}</h3>
      {text("ten-hien-thi", "displayName", `${t("displayName")}${required}`, displayName, setDisplayName, { maxLength: 100 })}
      <Field id="tinh-tram" label={`${t("province")}${required}`} error={fields.provinceCode}>
        <select id="tinh-tram" className={inputClass("provinceCode")} value={provinceCode} onChange={(event) => (setProvinceCode(event.target.value), setWardCode(""))}>
          <option value="">{t("choose")}</option>
          {provinceList.map((province) => (
            <option key={province.code} value={province.code}>
              {province.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="xa-tram" label={`${t("ward")}${required}`} error={fields.wardCode}>
        <select id="xa-tram" className={inputClass("wardCode")} value={wardCode} onChange={(event) => setWardCode(event.target.value)}>
          <option value="">{provinceCode ? t("choose") : t("chooseProvinceFirst")}</option>
          {wards.map((ward) => (
            <option key={ward.code} value={ward.code}>
              {ward.name}
            </option>
          ))}
        </select>
      </Field>
      {text("dia-chi-tram", "streetAddress", `${t("streetAddress")}${required}`, streetAddress, setStreetAddress, { maxLength: 200 })}
      {text("dien-thoai-tram", "phone", `${t("phone")}${required}`, phone, setPhone, { maxLength: 20, inputMode: "tel" })}
      {text("gio-mo-cua", "openingHours", `${t("openingHours")}${required}`, openingHours, setOpeningHours, { maxLength: 200 })}
      <h3>{t("deliverySection")}</h3>
      {text("phi-giao", "deliveryFee", t("deliveryFee"), deliveryFee, setDeliveryFee, { inputMode: "decimal" })}
      {text("mien-phi-giao", "freeDeliveryThreshold", t("freeDeliveryThreshold"), freeDeliveryThreshold, setFreeDeliveryThreshold, { inputMode: "decimal", hint: t("freeDeliveryHint") })}
      <Field id="xa-giao" label={`${t("deliveryWards", { count: deliveryWards.length })}${deliveryEnabled ? " *" : ""}`} error={fields.deliveryWardCodes}>
        <div className="bo-loc">
          <select aria-label={t("province")} value={deliveryProvince} onChange={(event) => (setDeliveryProvince(event.target.value), setDeliveryWard(""))}>
            <option value="">{t("province")}</option>
            {provinceList.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </select>
          <select id="xa-giao" className={inputClass("deliveryWardCodes")} value={deliveryWard} onChange={(event) => setDeliveryWard(event.target.value)}>
            <option value="">{deliveryProvince ? t("ward") : t("chooseProvinceFirst")}</option>
            {deliveryWardOptions
              .filter((ward) => !deliveryWards.some((item) => item.code === ward.code))
              .map((ward) => (
                <option key={ward.code} value={ward.code}>
                  {ward.name}
                </option>
              ))}
          </select>
          <button type="button" className="nut phu" onClick={addWard} disabled={!deliveryWard}>
            {t("addWard")}
          </button>
        </div>
      </Field>
      {deliveryWards.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)" }}>
          {deliveryWards.map((ward) => (
            <li key={ward.code} className="nhan thong-tin">
              {ward.name} · {ward.provinceName}{" "}
              <button type="button" className="nut chu" aria-label={`${t("removeWard")} ${ward.name}`} onClick={() => setDeliveryWards(deliveryWards.filter((item) => item.code !== ward.code))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="chu-thich">{t("stationWarning")}</p>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
