"use client";

// Thêm, sửa cửa hàng (MAN_HINH_166; QUYTAC_NGHIEPVU_368): chi nhánh cửa hàng, kho của chi nhánh, kênh, quỹ, VietQR, số ngày trả hàng.
import type { RetailSetupOptions, RetailStoreResponse, SaveRetailStoreRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";

export function StoreEditor({ store, options, onSaved, onCancel }: { store: RetailStoreResponse | null; options: RetailSetupOptions; onSaved: () => void; onCancel: () => void }) {
  const t = useTranslations("retailStores");
  const [kind, setKind] = useState<"store" | "pickup_point">(store?.kind ?? "store");
  const [branchId, setBranchId] = useState(store?.branch.id ?? options.branches.find((branch) => !branch.hasStore && branch.branchType === "store")?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(store?.warehouse.id ?? "");
  const [channelId, setChannelId] = useState(store?.channel.id ?? options.channels.find((channel) => channel.code === "BAN_LE")?.id ?? "");
  const [cashFundId, setCashFundId] = useState(store?.cashFund.id ?? "");
  const [bankFundId, setBankFundId] = useState(store?.bankFund?.id ?? "");
  const [vietqrBankBin, setVietqrBankBin] = useState(store?.vietqrBankBin ?? "");
  const [vietqrAccountName, setVietqrAccountName] = useState(store?.vietqrAccountName ?? "");
  const [returnDays, setReturnDays] = useState(String(store?.returnDays ?? 7));
  const [receiptFooter, setReceiptFooter] = useState(store?.receiptFooter ?? "");
  const [active, setActive] = useState(store ? store.status === "active" : true);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const warehouses = options.warehouses.filter((warehouse) => warehouse.branchId === branchId);
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveRetailStoreRequest = {
        kind,
        branchId,
        warehouseId,
        channelId,
        cashFundId,
        bankFundId: bankFundId || null,
        vietqrBankBin,
        vietqrAccountName,
        returnDays: Number(returnDays),
        receiptFooter,
        status: active ? "active" : "inactive",
        ...(store ? { version: store.version } : {}),
      };
      await apiFetch<RetailStoreResponse>(store ? `/retail/stores/${store.id}` : "/retail/stores", { method: store ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  }
  const select = (id: string, label: string, value: string, setter: (value: string) => void, field: string, items: { id: string; label: string }[], empty: string | null) => (
    <Field id={id} label={label} error={fields[field]}>
      <select id={id} className={inputClass(field)} value={value} onChange={(event) => setter(event.target.value)}>
        {empty !== null && <option value="">{empty}</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <Field id="loai-tram" label={`${t("kind")} *`} error={fields.kind}>
        <select id="loai-tram" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as "store" | "pickup_point")}>
          <option value="store">{t("kind_store")}</option>
          <option value="pickup_point">{t("kind_pickup_point")}</option>
        </select>
      </Field>
      {select(
        "chi-nhanh",
        `${t("branch")} *`,
        branchId,
        (value) => (setBranchId(value), setWarehouseId("")),
        "branchId",
        // Chi nhánh loại "Khác" chỉ cho điểm giao nhận (QUYTAC_NGHIEPVU_418).
        options.branches
          .filter((branch) => (!branch.hasStore || branch.id === store?.branch.id) && (kind === "pickup_point" || branch.branchType === "store"))
          .map((branch) => ({ id: branch.id, label: `${branch.code} – ${branch.name}` })),
        t("choose"),
      )}
      {select(
        "kho-ban",
        `${t("warehouse")} *`,
        warehouseId,
        setWarehouseId,
        "warehouseId",
        warehouses.map((warehouse) => ({ id: warehouse.id, label: `${warehouse.code} – ${warehouse.name}` })),
        t("choose"),
      )}
      {select(
        "kenh-ban",
        `${t("channel")} *`,
        channelId,
        setChannelId,
        "channelId",
        options.channels.map((channel) => ({ id: channel.id, label: `${channel.code} – ${channel.name}` })),
        t("choose"),
      )}
      {select(
        "quy-tien-mat",
        `${t("cashFund")} *`,
        cashFundId,
        setCashFundId,
        "cashFundId",
        options.cashFunds.map((fund) => ({ id: fund.id, label: `${fund.code} – ${fund.name}` })),
        t("choose"),
      )}
      {select(
        "quy-chuyen-khoan",
        t("bankFund"),
        bankFundId,
        setBankFundId,
        "bankFundId",
        options.bankFunds.map((fund) => ({ id: fund.id, label: `${fund.code} – ${[fund.name, fund.accountNo].filter(Boolean).join(" · ")}` })),
        t("noBankFund"),
      )}
      {bankFundId && (
        <>
          <Field id="ma-ngan-hang" label={`${t("vietqrBankBin")} *`} error={fields.vietqrBankBin}>
            <input id="ma-ngan-hang" className={inputClass("vietqrBankBin")} inputMode="numeric" maxLength={6} value={vietqrBankBin} onChange={(event) => setVietqrBankBin(event.target.value)} />
          </Field>
          <Field id="chu-tai-khoan" label={`${t("vietqrAccountName")} *`} error={fields.vietqrAccountName}>
            <input
              id="chu-tai-khoan"
              className={inputClass("vietqrAccountName")}
              maxLength={50}
              value={vietqrAccountName}
              onChange={(event) => setVietqrAccountName(event.target.value.toUpperCase())}
            />
          </Field>
        </>
      )}
      <Field id="so-ngay-tra" label={`${t("returnDays")} *`} error={fields.returnDays} hint={t("returnDaysHint")}>
        <input id="so-ngay-tra" className={inputClass("returnDays")} inputMode="numeric" value={returnDays} onChange={(event) => setReturnDays(event.target.value)} />
      </Field>
      <Field id="chan-hoa-don" label={t("receiptFooter")} error={fields.receiptFooter}>
        <textarea id="chan-hoa-don" className={inputClass("receiptFooter")} rows={2} maxLength={300} value={receiptFooter} onChange={(event) => setReceiptFooter(event.target.value)} />
      </Field>
      {store && (
        <label>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> {t("activeLabel")}
        </label>
      )}
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
