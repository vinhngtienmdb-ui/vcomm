"use client";

// MAN_HINH_147 Ví điểm – chi tiết (CONG_VIEC_51; CHUC_NANG_181; API_179; QUYTAC_NGHIEPVU_352): số dư, hạng, chi tiêu, lô điểm, sổ cái, lịch sử hạng, lịch sử khóa; khóa, mở.
// MAN_HINH_223 (CONG_VIEC_60; API_252, API_254; QUYTAC_NGHIEPVU_474, 477): thẻ thiết bị, vụ việc gian lận của ví.
import type { LoyaltyAccountDetail, LoyaltyDeviceItem, LoyaltyEntryItem, LoyaltyFraudCaseItem, PageResponse } from "contracts";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

function Ledger({ userId }: { userId: string }) {
  const t = useTranslations("loyalty");
  const common = useTranslations("common");
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<PageResponse<LoyaltyEntryItem>>(`/loyalty/accounts/${userId}/entries?page=${page}&pageSize=20`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(result) => (
        <>
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  {["time", "kind", "points", "balanceAfter", "document"].map((key) => (
                    <th key={key}>{t(`entry_${key}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((entry) => (
                  <tr key={entry.id}>
                    <td data-nhan={t("entry_time")}>{formatDateTime(entry.createdAt)}</td>
                    <td data-nhan={t("entry_kind")}>{t(`entryKind_${entry.kind}`)}</td>
                    <td data-nhan={t("entry_points")}>{entry.points > 0 ? `+${formatNumber(entry.points, 0)}` : formatNumber(entry.points, 0)}</td>
                    <td data-nhan={t("entry_balanceAfter")}>{formatNumber(entry.balanceAfter, 0)}</td>
                    <td data-nhan={t("entry_document")}>{entry.documentNo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        </>
      )}
    </Loaded>
  );
}

function Devices({ userId }: { userId: string }) {
  const t = useTranslations("loyaltyFraud");
  const { state, reload } = useApi<LoyaltyDeviceItem[]>(`/loyalty/accounts/${userId}/devices`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(devices) =>
        devices.length === 0 ? (
          <div className="the chu-thich">{t("noDevices")}</div>
        ) : (
          <>
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {["device", "firstSeen", "lastSeen", "seenCount", "otherAccounts"].map((key) => (
                      <th key={key}>{t(`deviceColumn_${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.device}>
                      <td data-nhan={t("deviceColumn_device")}>{device.device}</td>
                      <td data-nhan={t("deviceColumn_firstSeen")}>{formatDateTime(device.firstSeenAt)}</td>
                      <td data-nhan={t("deviceColumn_lastSeen")}>{formatDateTime(device.lastSeenAt)}</td>
                      <td data-nhan={t("deviceColumn_seenCount")}>{formatNumber(device.seenCount, 0)}</td>
                      <td data-nhan={t("deviceColumn_otherAccounts")}>{device.otherAccounts.length === 0 ? "0" : `${device.otherAccounts.length} · ${device.otherAccounts.join(", ")}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="chu-thich">{t("devicesHint")}</span>
          </>
        )
      }
    </Loaded>
  );
}

function Cases({ userId }: { userId: string }) {
  const t = useTranslations("loyaltyFraud");
  const { state, reload } = useApi<PageResponse<LoyaltyFraudCaseItem>>(`/loyalty/fraud-cases?userId=${userId}&status=open`);
  const closed = useApi<PageResponse<LoyaltyFraudCaseItem>>(`/loyalty/fraud-cases?userId=${userId}&status=violation`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(open) => {
        const items = [...open.data, ...(closed.state.kind === "ready" ? closed.state.data.data : [])];
        return items.length === 0 ? (
          <div className="the chu-thich">{t("noCases")}</div>
        ) : (
          <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
            {items.map((item) => (
              <span key={item.id}>
                <Link href="/loyalty/fraud-cases">{item.documentNo}</Link>
                {` · ${formatDate(item.caseDay)} · ${t(`rule_${item.ruleCode}`)} · ${t(`action_${item.action}`)} · ${t(`status_${item.status}`)}`}
              </span>
            ))}
          </div>
        );
      }}
    </Loaded>
  );
}

export default function LoyaltyAccountPage() {
  const t = useTranslations("loyalty");
  const { notify } = useAdmin();
  const { userId } = useParams<{ userId: string }>();
  const { state, reload } = useApi<LoyaltyAccountDetail>(`/loyalty/accounts/${userId}`);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"ledger" | "lots" | "tiers" | "locks" | "devices" | "cases">("ledger");
  async function toggle(locked: boolean) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/loyalty/accounts/${userId}/${locked ? "unlock" : "lock"}`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
      notify(t(locked ? "unlockedSaved" : "lockedSaved"));
      setReason("");
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(account) => (
        <>
          <div className="tieu-de">
            <h1>{`${account.fullName} · ${account.phone}`}</h1>
            <span className={`nhan ${account.locked ? "loi" : "thong-tin"}`}>{account.locked ? t("stateLocked") : (account.tier?.nameVi ?? "—")}</span>
          </div>
          <Link href="/loyalty/accounts">‹ {t("accountsTitle")}</Link>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
              <span className="chu-thich">{t("balance")}</span>
              <strong style={{ fontSize: "24px" }}>{t("pointsValue", { points: formatNumber(account.balance, 0) })}</strong>
            </div>
            <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
              <span className="chu-thich">{t("spendYear", { year: account.year })}</span>
              <strong>{formatNumber(account.spendCurrentYear, 0)} ₫</strong>
              <span className="chu-thich">
                {t("spendYear", { year: account.year - 1 })}: {formatNumber(account.spendPreviousYear, 0)} ₫
              </span>
            </div>
          </div>
          {account.locked ? <div className="khoi-canh-bao loi">{t("lockedReason", { reason: account.lockReason ?? "" })}</div> : null}
          <div className="nhom-nut" role="tablist">
            {(["ledger", "lots", "tiers", "locks", "devices", "cases"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={tab === item} className={`nut ${tab === item ? "chinh" : "phu"}`} onClick={() => setTab(item)}>
                {t(`accountTab_${item}`)}
              </button>
            ))}
          </div>
          {tab === "ledger" ? <Ledger userId={userId} /> : null}
          {tab === "devices" ? <Devices userId={userId} /> : null}
          {tab === "cases" ? <Cases userId={userId} /> : null}
          {tab === "lots" ? (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {["source", "earnedOn", "expiresOn", "points", "remaining", "pointValue"].map((key) => (
                      <th key={key}>{t(`lot_${key}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {account.lots.map((lot) => (
                    <tr key={lot.id}>
                      <td data-nhan={t("lot_source")}>{`${t(`source_${lot.sourceType}`)}${lot.documentNo ? ` ${lot.documentNo}` : ""}`}</td>
                      <td data-nhan={t("lot_earnedOn")}>{formatDate(lot.earnedOn)}</td>
                      <td data-nhan={t("lot_expiresOn")}>{formatDate(lot.expiresOn)}</td>
                      <td data-nhan={t("lot_points")}>{formatNumber(lot.points, 0)}</td>
                      <td data-nhan={t("lot_remaining")}>{formatNumber(lot.remaining, 0)}</td>
                      <td data-nhan={t("lot_pointValue")}>{`${formatNumber(lot.pointValue)} ₫`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {tab === "tiers" ? (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              {account.tierHistory.length === 0 ? <span className="chu-thich">{t("noHistory")}</span> : null}
              {account.tierHistory.map((item, index) => (
                <span key={index}>{`${formatDateTime(item.createdAt)} · ${item.fromTierName ?? "—"} → ${item.toTierName} · ${t(`tierReason_${item.reason}`)}`}</span>
              ))}
            </div>
          ) : null}
          {tab === "locks" ? (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              {account.lockHistory.length === 0 ? <span className="chu-thich">{t("noHistory")}</span> : null}
              {account.lockHistory.map((item, index) => (
                <span key={index}>{`${formatDateTime(item.createdAt)} · ${t(`lockAction_${item.action}`)} · ${item.actorName ?? t("systemActor")} · ${item.reason}`}</span>
              ))}
            </div>
          ) : null}
          {account.canManage ? (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h2>{t(account.locked ? "unlockTitle" : "lockTitle")}</h2>
              <label htmlFor="ly-do-khoa">{t("lockReason")}</label>
              <textarea id="ly-do-khoa" className="o-nhap" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              {account.locked ? null : <div className="khoi-canh-bao thong-tin">{t("lockHint")}</div>}
              <FormError text={error} />
              <div className="nhom-nut">
                <button type="button" className={`nut ${account.locked ? "chinh" : "nguy-hiem"}`} disabled={busy || !reason.trim()} onClick={() => void toggle(account.locked)}>
                  {t(account.locked ? "unlock" : "lock")}
                </button>
                <Link className="nut phu" href={`/loyalty/adjustments?phone=${account.phone}`}>
                  {t("createAdjustment")}
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Loaded>
  );
}
