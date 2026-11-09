"use client";

// MAN_HINH_25 Kênh bán và nhóm khách hàng (CHUC_NANG_35; API_60): danh mục riêng từng công ty.
import type { CatalogItemResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "channels" | "groups";
const paths: Record<Tab, string> = { channels: "/catalog/sales-channels", groups: "/catalog/customer-groups" };

export default function ChannelsPage() {
  const t = useTranslations("channels");
  const [tab, setTab] = useState<Tab>("channels");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType={tab === "channels" ? "channel" : "customer_group"} />
      </div>
      <div className="cac-the" role="tablist">
        {(["channels", "groups"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      <Items key={tab} tab={tab} />
    </>
  );
}

function Items({ tab }: { tab: Tab }) {
  const t = useTranslations("channels");
  const { can, notify } = useAdmin();
  const canManage = can("catalog.price.manage");
  const { state, reload } = useApi<CatalogItemResponse[]>(paths[tab]);
  const [editing, setEditing] = useState<CatalogItemResponse | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      await apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  const headings = [t("code"), t("name"), t("status"), ""];
  return (
    <>
      {canManage && (
        <div className="nhom-nut">
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t(tab === "channels" ? "addChannel" : "addGroup")}
          </button>
          {tab === "channels" && (
            <button type="button" className={`nut phu${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act("/catalog/sales-channels/defaults")}>
              {t("addDefaults")}
            </button>
          )}
        </div>
      )}
      {tab === "channels" && <div className="chu-thich">{t("defaultsHint")}</div>}
      <Loaded state={state} onRetry={() => void reload()}>
        {(items) =>
          items.length === 0 ? (
            <MessageView text={t(tab === "channels" ? "noChannels" : "noGroups")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <span>{item.code}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.name}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(item.status)}</span>
                      </td>
                      <td data-nhan="">
                        {canManage && (
                          <span className="nhom-nut">
                            <button type="button" className="nut chu" onClick={() => setEditing(item)}>
                              {t("edit")}
                            </button>
                            <button
                              type="button"
                              className="nut chu"
                              disabled={busy}
                              onClick={() => void act(`${paths[tab]}/${item.id}/${item.status === "active" ? "deactivate" : "activate"}`, { version: item.version })}
                            >
                              {item.status === "active" ? t("deactivate") : t("activate")}
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
      {editing && (
        <ItemDrawer
          tab={tab}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}

function ItemDrawer({ tab, item, onClose, onSaved }: { tab: Tab; item: CatalogItemResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("channels");
  const common = useTranslations("common");
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (item) await apiFetch(`${paths[tab]}/${item.id}`, { method: "PATCH", body: JSON.stringify({ name, version: item.version }) });
      else await apiFetch(paths[tab], { method: "POST", body: JSON.stringify({ code, name }) });
      onSaved();
    });
  }

  return (
    <Drawer title={item ? `${t("edit")}: ${item.code}` : t(tab === "channels" ? "addChannel" : "addGroup")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="ma-danh-muc" label={`${t("code")} *`} hint={t("codeHint")} error={fields.code}>
          <input id="ma-danh-muc" className={inputClass("code")} value={code} maxLength={20} disabled={Boolean(item)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="ten-danh-muc" label={`${t("name")} *`} error={fields.name}>
          <input id="ten-danh-muc" className={inputClass("name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
