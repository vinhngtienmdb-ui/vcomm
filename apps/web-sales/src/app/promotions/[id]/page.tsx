"use client";

// MAN_HINH_45: chi tiết chương trình khuyến mãi; sửa, gửi duyệt, rút, dừng (CHUC_NANG_62, 64; API_83).
import type { PromotionResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PromotionEditor } from "@/components/PromotionEditor";
import { PromotionStatusBadge } from "@/components/PromotionStatusBadge";

export default function PromotionPage() {
  const t = useTranslations("promotions");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PromotionResponse>(`/sales/promotions/${id}`);
  return (
    <>
      <div>
        <Link href="/promotions">‹ {t("back")}</Link>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(promotion) => <Detail key={promotion.version} promotion={promotion} reload={reload} />}
      </Loaded>
    </>
  );
}

function Detail({ promotion, reload }: { promotion: PromotionResponse; reload: () => Promise<void> }) {
  const t = useTranslations("promotions");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const money = (value: string | null) => (value === null ? "—" : formatMoney(value, promotion.currency));

  async function act(path: "submit" | "withdraw") {
    setBusy(true);
    try {
      await apiFetch(`/sales/promotions/${promotion.id}/${path}`, { method: "POST" });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    void run(async () => {
      await apiFetch(`/sales/promotions/${promotion.id}/stop`, { method: "POST", body: JSON.stringify({ reason, version: promotion.version }) });
      notify(t("stopped"));
      await reload();
    });
  }

  if (editing) {
    return (
      <PromotionEditor
        promotion={promotion}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          notify(t("saved"));
          void reload();
        }}
      />
    );
  }

  return (
    <>
      <div className="tieu-de">
        <h1>{promotion.documentNo ?? t("draftNo")}</h1>
        <PromotionStatusBadge status={promotion.status} />
        <HistoryLink entityId={promotion.id} />
        {promotion.canEdit && (
          <button type="button" className="nut phu" onClick={() => setEditing(true)}>
            {t("edit")}
          </button>
        )}
        {promotion.canWithdraw && (
          <button type="button" className="nut phu" disabled={busy} onClick={() => void act("withdraw")}>
            {t("withdraw")}
          </button>
        )}
        {promotion.canSubmit && (
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("submit")}>
            {t("submit")}
          </button>
        )}
      </div>
      <section className="the">
        <strong>{promotion.name}</strong>
        <div className="chu-thich">
          {t(`kind_${promotion.kind}`)} · {formatDate(promotion.validFrom)} – {formatDate(promotion.validTo)} · {t("createdBy")}: {promotion.createdByName}
        </div>
        <div>
          {t("channels")}: {promotion.channels.length > 0 ? promotion.channels.map((channel) => channel.name).join(", ") : t("allChannels")}
        </div>
        <div>
          {t("customerGroups")}: {promotion.customerGroups.length > 0 ? promotion.customerGroups.map((group) => group.name).join(", ") : t("allCustomers")}
        </div>
        {promotion.kind === "product_discount" && (
          <ul style={{ margin: 0 }}>
            {promotion.items.map((item) => (
              <li key={item.variantId}>
                {item.sku} · {item.productName}: {t("percentOff", { percent: formatNumber(item.discountPercent) })}
              </li>
            ))}
          </ul>
        )}
        {promotion.kind === "order_discount" && (
          <div>
            {t("orderRule", {
              threshold: money(promotion.minOrderAmount),
              percent: formatNumber(promotion.orderDiscountPercent ?? "0"),
              cap: promotion.maxOrderDiscount === null ? t("noCap") : money(promotion.maxOrderDiscount),
            })}
          </div>
        )}
        {promotion.kind === "buy_get" && promotion.buy && promotion.gift && (
          <div>
            {t("buyGetRule", {
              buyQuantity: formatNumber(promotion.buy.quantity),
              buyUnit: promotion.buy.baseUnitName,
              buy: `${promotion.buy.sku} · ${promotion.buy.productName}`,
              giftQuantity: formatNumber(promotion.gift.quantity),
              giftUnit: promotion.gift.baseUnitName,
              gift: `${promotion.gift.sku} · ${promotion.gift.productName}`,
            })}
          </div>
        )}
        <strong>
          {promotion.kind === "buy_get"
            ? t("usedSets", { used: promotion.usedGiftSets, limit: promotion.maxGiftSets ?? "∞" })
            : t("usedAmount", { used: money(promotion.usedAmount), limit: promotion.budgetAmount ? money(promotion.budgetAmount) : "∞" })}
        </strong>
        {promotion.note && <div>{promotion.note}</div>}
        {promotion.stoppedReason && <div className="khoi-canh-bao thong-tin">{t("stoppedReason", { reason: promotion.stoppedReason })}</div>}
      </section>
      {promotion.canStop && (
        <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <Field id="ly-do-dung" label={`${t("stopReason")} *`} error={fields.reason}>
            <input id="ly-do-dung" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <FormError text={formError} />
          <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !reason.trim()} style={{ justifySelf: "start" }} onClick={stop}>
            {t("stop")}
          </button>
        </section>
      )}
    </>
  );
}
