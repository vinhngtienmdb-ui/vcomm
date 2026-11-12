"use client";

// MAN_HINH_89 Yêu cầu trả hàng (CHUC_NANG_118; API_129; QUYTAC_NGHIEPVU_161): lọc trạng thái; duyệt, từ chối, đã nhận hàng trả, không nhận được hàng.
import { returnRequestStatuses, type PageResponse, type ReturnRequestAdminItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const tone = { pending: "canh-bao", approved: "thong-tin", rejected: "loi", withdrawn: "trung-tinh", received: "thanh-cong", not_received: "trung-tinh" } as const;
type Action = "approve" | "reject" | "receive" | "not-received";

function RequestCard({ item, onChanged }: { item: ReturnRequestAdminItem; onChanged: () => Promise<void> }) {
  const t = useTranslations("returnRequests");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [noting, setNoting] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(action: Action) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/return-requests/${item.id}/${action}`, { method: "POST", body: JSON.stringify({ note: note.trim() || null, version: item.version }) });
      notify(t(`done_${action}`));
      setNoting(null);
      setNote("");
      await onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const needsNote = noting === "reject" || noting === "not-received";
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
        <strong>
          <Link href={`/orders/${item.orderId}`}>{item.documentNo}</Link> · {item.buyerName} · {item.buyerPhone}
        </strong>
        <span className={`nhan ${tone[item.status]}`}>{t(`status_${item.status}`)}</span>
      </div>
      <span>
        <strong>{t(`reason_${item.reason}`)}</strong>: {item.description}
      </span>
      {item.returnStation && <span className="chu-thich">{t("returnStation", { station: `${item.returnStation.name} · ${item.returnStation.address}` })}</span>}
      <span className="chu-thich">{item.lines.map((line) => `${line.quantity} × ${line.productName}${line.variantLabel ? ` (${line.variantLabel})` : ""}`).join(", ")}</span>
      {item.images.length > 0 && (
        <div style={{ display: "flex", gap: "var(--khoang-2)", flexWrap: "wrap" }}>
          {item.images.map((image, index) => (
            <a key={image} href={image} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={t("image", { number: index + 1 })} width={72} height={72} style={{ objectFit: "cover", border: "1px solid var(--mau-vien)" }} />
            </a>
          ))}
        </div>
      )}
      <span className="chu-thich">
        {t("createdAt", { time: formatDateTime(item.createdAt) })}
        {item.decidedAt ? ` · ${t("decidedAt", { time: formatDateTime(item.decidedAt) })}` : ""}
        {item.closedAt ? ` · ${t("closedAt", { time: formatDateTime(item.closedAt) })}` : ""}
      </span>
      {item.decisionNote && <span className="chu-thich">{t("note", { note: item.decisionNote })}</span>}
      <FormError text={error} />
      {noting ? (
        <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <label htmlFor={`ghi-chu-${item.id}`}>{needsNote ? t("noteRequired") : t("noteOptional")}</label>
          <textarea id={`ghi-chu-${item.id}`} className="o-nhap" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          <span className="nhom-nut">
            <button type="button" className="nut chinh" disabled={busy || (needsNote && !note.trim())} onClick={() => void act(noting)}>
              {t(`action_${noting}`)}
            </button>
            <button type="button" className="nut phu" onClick={() => setNoting(null)}>
              {common("cancel")}
            </button>
          </span>
        </div>
      ) : (
        (item.canDecide || item.canClose) && (
          <span className="nhom-nut">
            {item.canDecide && (
              <>
                <button type="button" className="nut chinh" disabled={busy} onClick={() => setNoting("approve")}>
                  {t("action_approve")}
                </button>
                <button type="button" className="nut phu" disabled={busy} onClick={() => setNoting("reject")}>
                  {t("action_reject")}
                </button>
              </>
            )}
            {item.canClose && (
              <>
                {item.canReceive && (
                  <button type="button" className="nut chinh" disabled={busy} onClick={() => window.confirm(t("receiveConfirm")) && void act("receive")}>
                    {t("action_receive")}
                  </button>
                )}
                <button type="button" className="nut phu" disabled={busy} onClick={() => setNoting("not-received")}>
                  {t("action_not-received")}
                </button>
              </>
            )}
          </span>
        )
      )}
    </div>
  );
}

export default function ReturnRequestsPage() {
  const t = useTranslations("returnRequests");
  const common = useTranslations("common");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<ReturnRequestAdminItem>>(`/marketplace/return-requests?${parameters}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="th-trang-thai">
          {t("status")}
        </label>
        <select
          id="th-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {returnRequestStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
              {result.data.map((item) => (
                <RequestCard key={`${item.id}-${item.version}`} item={item} onChanged={reload} />
              ))}
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
    </>
  );
}
