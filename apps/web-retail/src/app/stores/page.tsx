"use client";

// MAN_HINH_166 Cài đặt cửa hàng (CHUC_NANG_186; API_192); cài đặt trạm MAN_HINH_191 (CONG_VIEC_57; API_220): danh sách cửa hàng, ngăn kéo thêm, sửa; quầy của từng cửa hàng.
import type { RetailRegisterResponse, RetailSetupOptions, RetailStoreResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { RegisterEditor } from "@/components/RegisterEditor";
import { StationEditor } from "@/components/StationEditor";
import { StoreEditor } from "@/components/StoreEditor";

function StoreCard({ store, onEdit, onStation, onChanged }: { store: RetailStoreResponse; onEdit: () => void; onStation: () => void; onChanged: (text: string) => void }) {
  const t = useTranslations("retailStores");
  const [editing, setEditing] = useState<RetailRegisterResponse | "new" | null>(null);
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2 style={{ flex: 1 }}>
          {store.branch.name} <span className="chu-thich">{store.branch.code}</span>
        </h2>
        <span className="nhan trung-tinh">{t(`kind_${store.kind}`)}</span>
        <span className={`nhan ${store.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${store.status}`)}</span>
        {store.canSetup && (
          <button type="button" className="nut phu" onClick={onStation}>
            {t("stationEdit")}
          </button>
        )}
        <button type="button" className="nut phu" onClick={onEdit}>
          {t("edit")}
        </button>
      </div>
      <dl className="thong-tin-dong">
        <dt>{t("warehouse")}</dt>
        <dd>
          {store.warehouse.code} – {store.warehouse.name}
        </dd>
        <dt>{t("channel")}</dt>
        <dd>{store.channel.name}</dd>
        <dt>{t("cashFund")}</dt>
        <dd>{store.cashFund.name}</dd>
        <dt>{t("bankFund")}</dt>
        <dd>{store.bankFund ? [store.bankFund.name, store.bankFund.accountNo, store.vietqrBankBin].filter(Boolean).join(" · ") : t("noBankFund")}</dd>
        <dt>{t("returnDays")}</dt>
        <dd>{store.returnDays}</dd>
        <dt>{t("station")}</dt>
        <dd>
          {store.station.pickupEnabled || store.station.deliveryEnabled
            ? [
                store.station.pickupEnabled ? t("pickupEnabled") : null,
                store.station.deliveryEnabled ? `${t("deliveryEnabled")} · ${t("deliveryWards", { count: store.station.deliveryWards.length })}` : null,
                store.station.displayName,
              ]
                .filter(Boolean)
                .join(" · ")
            : t("stationOff")}
        </dd>
      </dl>
      <h3>{t("registers")}</h3>
      {store.registers.length === 0 && <p className="chu-thich">{t("noRegisters")}</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--khoang-2)" }}>
        {store.registers.map((register) =>
          editing !== "new" && editing?.id === register.id ? (
            <li key={register.id}>
              <RegisterEditor storeId={store.id} register={register} onSaved={() => (setEditing(null), onChanged(t("registerSaved")))} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={register.id} className="bo-loc">
              <strong>{register.code}</strong>
              <span>{register.name}</span>
              <span className={`nhan ${register.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${register.status}`)}</span>
              {register.openShift && <span className="nhan thong-tin">{t("openShiftBy", { name: register.openShift.cashierName })}</span>}
              <button type="button" className="nut chu" onClick={() => setEditing(register)}>
                {t("edit")}
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <RegisterEditor storeId={store.id} register={null} onSaved={() => (setEditing(null), onChanged(t("registerSaved")))} onCancel={() => setEditing(null)} />
      ) : (
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={() => setEditing("new")}>
            {t("addRegister")}
          </button>
        </div>
      )}
    </section>
  );
}

export default function StoresPage() {
  const t = useTranslations("retailStores");
  const { notify } = useAdmin();
  const { state, reload } = useApi<RetailStoreResponse[]>("/retail/stores");
  const options = useApi<RetailSetupOptions>("/retail/options");
  const [editing, setEditing] = useState<RetailStoreResponse | "new" | null>(null);
  const [station, setStation] = useState<RetailStoreResponse | null>(null);
  const changed = (text: string) => {
    notify(text);
    void reload();
    void options.reload();
  };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="retail_store" />
        <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
          {t("create")}
        </button>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(stores) =>
          stores.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} onEdit={() => setEditing(store)} onStation={() => setStation(store)} onChanged={changed} />
              ))}
            </div>
          )
        }
      </Loaded>
      {station && (
        <Drawer title={`${t("stationEdit")} · ${station.branch.name}`} onClose={() => setStation(null)}>
          <StationEditor
            store={station}
            onSaved={() => {
              setStation(null);
              changed(t("stationSaved"));
            }}
            onCancel={() => setStation(null)}
          />
        </Drawer>
      )}
      {editing && (
        <Drawer title={editing === "new" ? t("create") : t("edit")} onClose={() => setEditing(null)}>
          <Loaded state={options.state} onRetry={() => void options.reload()}>
            {(loaded) =>
              loaded.branches.length === 0 ? (
                <MessageView text={t("noStoreBranch")} />
              ) : (
                <StoreEditor
                  store={editing === "new" ? null : editing}
                  options={loaded}
                  onSaved={() => {
                    setEditing(null);
                    changed(t("saved"));
                  }}
                  onCancel={() => setEditing(null)}
                />
              )
            }
          </Loaded>
        </Drawer>
      )}
    </>
  );
}
