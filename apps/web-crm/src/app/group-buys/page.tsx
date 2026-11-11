"use client";

// MAN_HINH_138 Mua chung (CONG_VIEC_49; CHUC_NANG_172, 173; API_165, API_166; QUYTAC_NGHIEPVU_328 đến 331; THAY_DOI_22):
// danh sách nhóm, chi tiết (đơn tham gia), mở nhóm, hủy nhóm; cài đặt bậc giá theo biến thể; khóa ví mua sắm toàn hệ thống.
import { groupBuyStatuses, type GroupBuyDetail, type GroupBuyItem, type GroupBuySettingsItem, type GroupBuyStatus, type PageResponse, type ShoppingWalletSettings } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const statusTone: Record<GroupBuyStatus, string> = { open: "thanh-cong", succeeded: "thong-tin", failed: "loi", cancelled: "trung-tinh" };

function GroupDetail({ id, onChanged }: { id: string; onChanged: () => Promise<void> }) {
  const t = useTranslations("groupBuys");
  const orders = useTranslations("marketplaceOrders");
  const { notify, can } = useAdmin();
  const { state, reload } = useApi<GroupBuyDetail>(`/marketplace/group-buys/${id}`);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  async function cancel(detail: GroupBuyDetail) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/group-buys/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), version: detail.version }) });
      notify(t("cancelledSaved"));
      setConfirming(false);
      await Promise.all([reload(), onChanged()]);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(detail) => (
        <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <div style={{ display: "flex", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
            <h2 style={{ flex: 1, minWidth: "220px", overflowWrap: "anywhere" }}>{[detail.productName, detail.variantLabel].filter(Boolean).join(" · ")}</h2>
            <span className={`nhan ${statusTone[detail.status]}`}>{t(`status_${detail.status}`)}</span>
          </div>
          <span className="chu-thich">
            {t("detailLine", {
              opener: detail.openerName,
              start: formatDateTime(detail.startsAt),
              end: formatDateTime(detail.endsAt),
              quantity: detail.quantity,
              max: detail.maxPerBuyer,
            })}
          </span>
          <span>{detail.tiers.map((tier) => t("tierText", { quantity: tier.minQuantity, price: formatNumber(tier.unitPrice, 0) })).join(" · ")}</span>
          {detail.finalPrice ? <strong>{t("finalPrice", { price: formatNumber(detail.finalPrice, 0) })}</strong> : null}
          {detail.cancelReason ? <span className="chu-thich">{`${t("cancelReason")}: ${detail.cancelReason}`}</span> : null}
          {detail.orders.length === 0 ? (
            <MessageView text={t("noOrders")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("order")}</th>
                    <th>{t("buyer")}</th>
                    <th>{t("quantity")}</th>
                    <th>{t("paid")}</th>
                    <th>{t("orderStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.orders.map((order) => (
                    <tr key={order.orderId}>
                      <td data-nhan={t("order")}>
                        <a href={`/crm/orders/${order.orderId}`}>{order.documentNo}</a>
                      </td>
                      <td data-nhan={t("buyer")}>{`${order.buyerName} · ${order.buyerPhone}`}</td>
                      <td data-nhan={t("quantity")}>{order.quantity}</td>
                      <td data-nhan={t("paid")}>{formatNumber(order.paidAmount, 0)}</td>
                      <td data-nhan={t("orderStatus")}>{orders(`status_${order.status}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <FormError text={error} />
          {detail.status === "open" && can("marketplace.order.manage") ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
              <span style={{ display: "grid", gap: "var(--khoang-1)", flex: 1, minWidth: "240px" }}>
                <label htmlFor={`huy-nhom-${id}`}>{t("cancelReason")}</label>
                <input id={`huy-nhom-${id}`} className="o-nhap" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              </span>
              <button type="button" className="nut nguy-hiem" disabled={busy || !reason.trim()} onClick={() => setConfirming(true)}>
                {t("cancelGroup")}
              </button>
            </div>
          ) : null}
          {confirming ? (
            <ConfirmDialog
              title={t("cancelGroup")}
              text={t("cancelConfirm")}
              confirmLabel={t("cancelGroup")}
              busy={busy}
              error={error}
              onConfirm={() => void cancel(detail)}
              onClose={() => setConfirming(false)}
            />
          ) : null}
        </div>
      )}
    </Loaded>
  );
}

function OpenGroupForm({ onOpened }: { onOpened: (id: string) => Promise<void> }) {
  const t = useTranslations("groupBuys");
  const { notify } = useAdmin();
  const { state } = useApi<PageResponse<GroupBuySettingsItem>>("/marketplace/group-buy-settings?pageSize=100");
  const [variantId, setVariantId] = useState("");
  const [hours, setHours] = useState("24");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setError(null);
    try {
      const opened = await apiFetch<GroupBuyDetail>("/marketplace/group-buys", { method: "POST", body: JSON.stringify({ variantId, durationHours: Number(hours) }) });
      notify(t("openedSaved"));
      await onOpened(opened.id);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => undefined}>
      {(result) => {
        const enabled = result.data.filter((item) => item.isEnabled);
        return (
          <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <h2>{t("openTitle")}</h2>
            <FormError text={error} />
            {enabled.length === 0 ? (
              <MessageView text={t("noEnabled")} />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
                <span style={{ display: "grid", gap: "var(--khoang-1)", flex: 1, minWidth: "240px" }}>
                  <label htmlFor="mo-nhom-bien-the">{t("variant")}</label>
                  <select id="mo-nhom-bien-the" className="o-nhap" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                    <option value="">{t("chooseVariant")}</option>
                    {enabled.map((item) => (
                      <option key={item.variantId} value={item.variantId}>
                        {[item.productName, item.variantLabel].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </span>
                <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                  <label htmlFor="mo-nhom-gio">{t("durationHours")}</label>
                  <input id="mo-nhom-gio" className="o-nhap" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} />
                </span>
                <button type="button" className="nut chinh" disabled={busy || !variantId || !Number(hours)} onClick={() => void open()}>
                  {t("openGroup")}
                </button>
              </div>
            )}
          </div>
        );
      }}
    </Loaded>
  );
}

function Groups() {
  const t = useTranslations("groupBuys");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [status, setStatus] = useState<GroupBuyStatus | "">("open");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const { state, reload } = useApi<PageResponse<GroupBuyItem>>(`/marketplace/group-buys?${new URLSearchParams({ page: String(page), pageSize: "20", ...(status ? { status } : {}) })}`);
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "center" }}>
        <label className="an-nhan" htmlFor="nhom-trang-thai">
          {t("status")}
        </label>
        <select
          id="nhom-trang-thai"
          className="o-nhap"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as GroupBuyStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          {groupBuyStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {can("marketplace.order.manage") ? (
          <button type="button" className="nut chinh" onClick={() => setOpening(!opening)}>
            {t("openGroup")}
          </button>
        ) : null}
      </div>
      {opening ? (
        <OpenGroupForm
          onOpened={async (id) => {
            setOpening(false);
            setSelected(id);
            await reload();
          }}
        />
      ) : null}
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("product")}</th>
                    <th>{t("opener")}</th>
                    <th>{t("quantity")}</th>
                    <th>{t("tierReached")}</th>
                    <th>{t("endsAt")}</th>
                    <th>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item) => (
                    <tr key={item.id} aria-selected={selected === item.id}>
                      <td data-nhan={t("product")}>
                        <button type="button" className="nut chu" style={{ whiteSpace: "normal", textAlign: "left" }} onClick={() => setSelected(item.id)}>
                          {[item.productName, item.variantLabel].filter(Boolean).join(" · ")}
                        </button>
                      </td>
                      <td data-nhan={t("opener")}>{`${item.openerName} (${item.openerKind === "staff" ? t("staff") : item.openerLabel ? t(`label_${item.openerLabel}`) : t("collaborator")})`}</td>
                      <td data-nhan={t("quantity")}>{item.quantity}</td>
                      <td data-nhan={t("tierReached")}>
                        {item.finalPrice ? formatNumber(item.finalPrice, 0) : item.currentPrice ? formatNumber(item.currentPrice, 0) : t("belowMinimum", { minimum: item.tiers[0]?.minQuantity ?? 2 })}
                      </td>
                      <td data-nhan={t("endsAt")}>{formatDateTime(item.endsAt)}</td>
                      <td data-nhan={t("status")}>
                        <span className={`nhan ${statusTone[item.status]}`}>{t(`status_${item.status}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      {selected ? <GroupDetail key={selected} id={selected} onChanged={reload} /> : null}
    </>
  );
}

function SettingsEditor({ item, onSaved }: { item: GroupBuySettingsItem; onSaved: () => Promise<void> }) {
  const t = useTranslations("groupBuys");
  const common = useTranslations("common");
  const { notify, can } = useAdmin();
  const [isEnabled, setEnabled] = useState(item.isEnabled);
  const [tiers, setTiers] = useState(item.tiers.length > 0 ? item.tiers.map((tier) => ({ minQuantity: String(tier.minQuantity), unitPrice: tier.unitPrice })) : [{ minQuantity: "2", unitPrice: "" }]);
  const [maxDurationHours, setMaxDuration] = useState(String(item.maxDurationHours));
  const [maxPerBuyer, setMaxPerBuyer] = useState(String(item.maxPerBuyer));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const canManage = can("marketplace.order.manage");
  async function save() {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await apiFetch(`/marketplace/group-buy-settings/${item.variantId}`, {
        method: "PUT",
        body: JSON.stringify({
          isEnabled,
          tiers: tiers.map((tier) => ({ minQuantity: Number(tier.minQuantity), unitPrice: tier.unitPrice })),
          maxDurationHours: Number(maxDurationHours),
          maxPerBuyer: Number(maxPerBuyer),
          version: item.version,
        }),
      });
      notify(t("settingsSaved"));
      await onSaved();
    } catch (failure) {
      const result = failureOf(failure);
      setError(result.message);
      setFields(result.fields ?? {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2 style={{ overflowWrap: "anywhere" }}>{t("settingsTitle", { name: [item.productName, item.variantLabel].filter(Boolean).join(" · ") })}</h2>
      <span className="chu-thich">{item.currentPrice ? t("currentPrice", { price: formatNumber(item.currentPrice, 0) }) : t("noPrice")}</span>
      <FormError text={error} />
      <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
        <input type="checkbox" checked={isEnabled} disabled={!canManage} onChange={(event) => setEnabled(event.target.checked)} />
        {t("enabled")}
      </label>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("tier")}</th>
              <th>{t("fromQuantity")}</th>
              <th>{t("unitPrice")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier, index) => (
              <tr key={index}>
                <td data-nhan={t("tier")}>{index === 0 ? t("firstTier") : index + 1}</td>
                <td data-nhan={t("fromQuantity")}>
                  <input
                    className="o-nhap"
                    aria-label={t("fromQuantityOf", { tier: index + 1 })}
                    inputMode="numeric"
                    style={{ maxWidth: "8rem" }}
                    disabled={!canManage}
                    value={tier.minQuantity}
                    onChange={(event) => setTiers(tiers.map((current, position) => (position === index ? { ...current, minQuantity: event.target.value } : current)))}
                  />
                </td>
                <td data-nhan={t("unitPrice")}>
                  <input
                    className="o-nhap"
                    aria-label={t("unitPriceOf", { tier: index + 1 })}
                    inputMode="numeric"
                    style={{ maxWidth: "10rem" }}
                    disabled={!canManage}
                    value={tier.unitPrice}
                    onChange={(event) => setTiers(tiers.map((current, position) => (position === index ? { ...current, unitPrice: event.target.value } : current)))}
                  />
                  {fields[`tiers.${index}.unitPrice`] ? <div className="loi-o">{fields[`tiers.${index}.unitPrice`]}</div> : null}
                </td>
                <td>
                  {index > 0 && canManage ? (
                    <button type="button" className="nut chu" onClick={() => setTiers(tiers.filter((_, position) => position !== index))}>
                      {t("removeTier")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fields.tiers ? <div className="loi-o">{fields.tiers}</div> : null}
      {canManage && tiers.length < 5 ? (
        <div>
          <button type="button" className="nut phu" onClick={() => setTiers([...tiers, { minQuantity: "", unitPrice: "" }])}>
            {t("addTier")}
          </button>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: "var(--khoang-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="mc-thoi-han">{t("maxDuration")}</label>
          <input id="mc-thoi-han" className="o-nhap" inputMode="numeric" disabled={!canManage} value={maxDurationHours} onChange={(event) => setMaxDuration(event.target.value)} />
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="mc-moi-nguoi">{t("maxPerBuyer")}</label>
          <input id="mc-moi-nguoi" className="o-nhap" inputMode="numeric" disabled={!canManage} value={maxPerBuyer} onChange={(event) => setMaxPerBuyer(event.target.value)} />
        </span>
      </div>
      {canManage ? (
        <span className="nhom-nut">
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void save()}>
            {common("save")}
          </button>
        </span>
      ) : null}
    </div>
  );
}

function Settings() {
  const t = useTranslations("groupBuys");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const { state, reload } = useApi<PageResponse<GroupBuySettingsItem>>(
    `/marketplace/group-buy-settings?${new URLSearchParams({ pageSize: "50", ...(search.trim() ? { search: search.trim() } : {}) })}`,
  );
  return (
    <>
      <label className="an-nhan" htmlFor="mc-tim">
        {t("searchProduct")}
      </label>
      <input id="mc-tim" className="o-nhap" placeholder={t("searchProduct")} value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: "24rem" }} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noVariants")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      <th>{t("product")}</th>
                      <th>{t("currentPriceColumn")}</th>
                      <th>{t("tiers")}</th>
                      <th>{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.variantId} aria-selected={selected === item.variantId}>
                        <td data-nhan={t("product")}>
                          <button type="button" className="nut chu" style={{ whiteSpace: "normal", textAlign: "left" }} onClick={() => setSelected(item.variantId)}>
                            {[item.productName, item.variantLabel].filter(Boolean).join(" · ")}
                          </button>
                        </td>
                        <td data-nhan={t("currentPriceColumn")}>{item.currentPrice ? formatNumber(item.currentPrice, 0) : "—"}</td>
                        <td data-nhan={t("tiers")}>{item.tiers.map((tier) => t("tierText", { quantity: tier.minQuantity, price: formatNumber(tier.unitPrice, 0) })).join(" · ") || "—"}</td>
                        <td data-nhan={t("status")}>
                          <span className={`nhan ${item.isEnabled ? "thanh-cong" : "trung-tinh"}`}>{item.isEnabled ? t("on") : t("off")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected
                ? (() => {
                    const item = result.data.find((row) => row.variantId === selected);
                    return item ? <SettingsEditor key={`${item.variantId}-${item.version}`} item={item} onSaved={reload} /> : null;
                  })()
                : null}
            </>
          )
        }
      </Loaded>
    </>
  );
}

function WalletLock() {
  const t = useTranslations("groupBuys");
  const { notify, can } = useAdmin();
  const { state, reload } = useApi<ShoppingWalletSettings>("/marketplace/shopping-wallet-settings");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  async function toggle(settings: ShoppingWalletSettings) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/marketplace/shopping-wallet-settings", { method: "PUT", body: JSON.stringify({ isLocked: !settings.isLocked, version: settings.version }) });
      notify(settings.isLocked ? t("unlockedSaved") : t("lockedSaved"));
      setConfirming(false);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settings) => (
        <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <h2>{t("walletTitle")}</h2>
          <div className="chu-thich">{t("walletHint")}</div>
          <FormError text={error} />
          <span>
            <span className={`nhan ${settings.isLocked ? "canh-bao" : "thanh-cong"}`}>{settings.isLocked ? t("walletLocked") : t("walletOpen")}</span>
          </span>
          {can("marketplace.order.manage") ? (
            <span className="nhom-nut">
              <button type="button" className={`nut ${settings.isLocked ? "chinh" : "nguy-hiem"}`} disabled={busy} onClick={() => setConfirming(true)}>
                {settings.isLocked ? t("unlock") : t("lock")}
              </button>
            </span>
          ) : null}
          {confirming ? (
            <ConfirmDialog
              title={settings.isLocked ? t("unlock") : t("lock")}
              text={settings.isLocked ? t("unlockConfirm") : t("lockConfirm")}
              confirmLabel={settings.isLocked ? t("unlock") : t("lock")}
              busy={busy}
              error={error}
              onConfirm={() => void toggle(settings)}
              onClose={() => setConfirming(false)}
            />
          ) : null}
        </div>
      )}
    </Loaded>
  );
}

export default function GroupBuysPage() {
  const t = useTranslations("groupBuys");
  const [tab, setTab] = useState<"groups" | "settings" | "wallet">("groups");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="nhom-nut" role="tablist">
        {(["groups", "settings", "wallet"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={`nut ${tab === item ? "chinh" : "phu"}`} onClick={() => setTab(item)}>
            {t(`tab_${item}`)}
          </button>
        ))}
      </div>
      {tab === "groups" ? <Groups /> : tab === "settings" ? <Settings /> : <WalletLock />}
    </>
  );
}
