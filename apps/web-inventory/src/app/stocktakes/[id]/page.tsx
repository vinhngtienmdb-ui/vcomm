"use client";

// MAN_HINH_34 Kiểm kê, đếm và kết thúc (CHUC_NANG_42; QUYTAC_NGHIEPVU_53; API_67): bắt đầu (khóa mặt hàng), nhập số đếm (quét mã vạch),
// kết thúc sinh phiếu điều chỉnh, ghi người chịu trách nhiệm phần thiếu.
import type { StockItemOption, StocktakeOptionsResponse, StocktakeResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type KeyboardEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function StocktakePage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<StocktakeResponse>(`/inventory/stocktakes/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(stocktake) => <Stocktake key={stocktake.version} stocktake={stocktake} onChanged={() => void reload()} />}
    </Loaded>
  );
}

function Stocktake({ stocktake, onChanged }: { stocktake: StocktakeResponse; onChanged: () => void }) {
  const t = useTranslations("stocktakes");
  const { notify } = useAdmin();
  const counting = stocktake.status === "counting" && stocktake.canManage;
  const options = useApi<StocktakeOptionsResponse>(counting ? `/inventory/stocktake-options?warehouseId=${stocktake.warehouseId}` : null);
  const [counts, setCounts] = useState<Record<string, { quantity: string; serials: string }>>(
    Object.fromEntries(stocktake.lines.map((line) => [line.id, { quantity: line.countedQuantity ?? "", serials: (line.countedSerials ?? []).join("\n") }])),
  );
  const [extra, setExtra] = useState<{ variantId: string; label: string; quantity: string }[]>([]);
  const [responsible, setResponsible] = useState<Record<string, string>>(Object.fromEntries(stocktake.lines.map((line) => [line.id, line.responsibleUserId ?? ""])));
  const [scan, setScan] = useState("");
  const [confirming, setConfirming] = useState<"start" | "finish" | "cancel" | null>(null);
  const { submitting, fields, formError, run } = useSubmit();
  const money = (value: string | null) => (value === null ? "—" : formatMoney(value, "VND"));
  const serialsOf = (text: string) =>
    text
      .split(/[\n,;]/)
      .map((serial) => serial.trim())
      .filter(Boolean);

  // Quét mã: tăng số đếm của dòng có mặt hàng đó; mặt hàng không có trong sổ sách thì thêm dòng mới.
  async function scanItem(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !scan.trim()) return;
    event.preventDefault();
    const found = await apiFetch<StockItemOption[]>(`/inventory/items?${new URLSearchParams({ companyId: stocktake.companyId, search: scan.trim() })}`).catch(() => []);
    setScan("");
    const item = found[0];
    if (!item) return notify(t("itemNotFound"), "loi");
    const line = stocktake.lines.find((candidate) => candidate.variantId === item.variantId && !candidate.tracksSerials);
    if (line) {
      setCounts({ ...counts, [line.id]: { ...counts[line.id]!, quantity: String(Number(counts[line.id]!.quantity || 0) + 1) } });
    } else if (!stocktake.lines.some((candidate) => candidate.variantId === item.variantId)) {
      const existing = extra.find((candidate) => candidate.variantId === item.variantId);
      setExtra(
        existing
          ? extra.map((candidate) => (candidate === existing ? { ...candidate, quantity: String(Number(candidate.quantity) + 1) } : candidate))
          : [...extra, { variantId: item.variantId, label: `${item.sku} · ${item.productName}`, quantity: "1" }],
      );
    }
  }

  function saveCounts(then?: () => void) {
    void run(async () => {
      const body = [
        ...stocktake.lines
          .filter((line) => counts[line.id]!.quantity !== "")
          .map((line) => ({ lineId: line.id, countedQuantity: counts[line.id]!.quantity.replace(",", "."), ...(line.tracksSerials ? { serials: serialsOf(counts[line.id]!.serials) } : {}) })),
        ...extra.map((item) => ({ variantId: item.variantId, countedQuantity: item.quantity })),
      ];
      if (body.length > 0) await apiFetch(`/inventory/stocktakes/${stocktake.id}/counts`, { method: "PUT", body: JSON.stringify({ counts: body }) });
      notify(t("countsSaved"));
      if (then) then();
      else onChanged();
    });
  }

  async function act(action: "start" | "finish" | "cancel") {
    setConfirming(null);
    void run(async () => {
      if (action === "finish") {
        await apiFetch(`/inventory/stocktakes/${stocktake.id}/finish`, {
          method: "POST",
          body: JSON.stringify({
            version: stocktake.version,
            responsibilities: stocktake.lines.filter((line) => responsible[line.id]).map((line) => ({ lineId: line.id, responsibleUserId: responsible[line.id] })),
          }),
        });
      } else {
        await apiFetch(`/inventory/stocktakes/${stocktake.id}/${action}`, { method: "POST" });
      }
      notify(t(`${action}Done`));
      onChanged();
    });
  }

  const headings = [t("item"), t("lot"), t("location"), t("system"), t("counted"), t("difference"), t("differenceValue"), t("responsible")];
  return (
    <>
      <div className="tieu-de">
        <h1>
          {t("title")} {stocktake.stocktakeNo ?? t("draftNo")}
        </h1>
        <span className="nhan thong-tin">{t(`status_${stocktake.status}`)}</span>
        <Link className="nut phu" href="/stocktakes">
          {t("backToList")}
        </Link>
        {stocktake.adjustmentDocumentId && (
          <Link className="nut phu" href={`/documents/${stocktake.adjustmentDocumentId}`}>
            {t("adjustment", { number: stocktake.adjustmentDocumentNo ?? "" })}
          </Link>
        )}
      </div>
      <p className="chu-thich">
        {stocktake.warehouseName} · {stocktake.companyName} · {t(`scope_${stocktake.scopeType}`)}
        {stocktake.note && ` · ${stocktake.note}`}
      </p>
      {stocktake.status === "draft" && stocktake.canManage && (
        <div className="nhom-nut">
          <button type="button" className="nut chinh" onClick={() => setConfirming("start")}>
            {t("start")}
          </button>
          <button type="button" className="nut chu" onClick={() => setConfirming("cancel")}>
            {t("cancel")}
          </button>
        </div>
      )}
      {counting && (
        <div style={{ display: "grid", gap: "var(--khoang-2)", marginBottom: "var(--khoang-4)" }}>
          <label htmlFor="quet-kiem">{t("scan")}</label>
          <input id="quet-kiem" className="o-nhap" autoFocus value={scan} placeholder={t("scanHint")} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => void scanItem(event)} />
        </div>
      )}
      {stocktake.lines.length > 0 && (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {headings.map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocktake.lines.map((line, index) => {
                const counted = counts[line.id]!;
                const difference = counted.quantity === "" ? null : Number(counted.quantity.replace(",", ".")) - Number(line.systemQuantity);
                return (
                  <tr key={line.id}>
                    <td data-nhan={headings[0]}>
                      <span>
                        {line.sku} · {line.productName}
                        {line.optionValues.length > 0 && <span className="chu-thich"> · {line.optionValues.join(" / ")}</span>}
                      </span>
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>{line.lotNo ? `${line.lotNo}${line.expiresOn ? ` · ${formatDate(line.expiresOn)}` : ""}` : "—"}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span>{line.locationCode ?? "—"}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span>
                        {formatNumber(line.systemQuantity)} {line.baseUnitName}
                      </span>
                    </td>
                    <td data-nhan={headings[4]}>
                      {counting ? (
                        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                          <label className="an-nhan" htmlFor={`dem-${index}`}>
                            {t("counted")} {line.sku}
                          </label>
                          <input
                            id={`dem-${index}`}
                            inputMode="decimal"
                            className="o-nhap"
                            style={{ maxWidth: 120 }}
                            value={counted.quantity}
                            onChange={(event) => setCounts({ ...counts, [line.id]: { ...counted, quantity: event.target.value } })}
                          />
                          {line.tracksSerials && (
                            <textarea
                              className="o-nhap"
                              rows={2}
                              aria-label={t("serials")}
                              placeholder={t("serials")}
                              value={counted.serials}
                              onChange={(event) => {
                                const serials = event.target.value;
                                setCounts({ ...counts, [line.id]: { quantity: String(serialsOf(serials).length), serials } });
                              }}
                            />
                          )}
                        </span>
                      ) : (
                        <span>{line.countedQuantity === null ? "—" : formatNumber(line.countedQuantity)}</span>
                      )}
                    </td>
                    <td data-nhan={headings[5]}>
                      <span className={difference !== null && difference !== 0 ? "nhan canh-bao" : ""}>{difference === null ? "—" : formatNumber(difference)}</span>
                    </td>
                    <td data-nhan={headings[6]}>
                      <span>{line.unitCost === null || difference === null ? "—" : money(String(difference * Number(line.unitCost)))}</span>
                    </td>
                    <td data-nhan={headings[7]}>
                      {counting && difference !== null && difference < 0 ? (
                        <select
                          className="o-nhap"
                          aria-label={t("responsible")}
                          value={responsible[line.id] ?? ""}
                          onChange={(event) => setResponsible({ ...responsible, [line.id]: event.target.value })}
                        >
                          <option value="">—</option>
                          {options.state.kind === "ready" &&
                            options.state.data.users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.fullName}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span>{line.compensationAmount ? money(line.compensationAmount) : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {extra.length > 0 && (
        <section className="the" style={{ marginTop: "var(--khoang-4)" }}>
          <h2>{t("extraItems")}</h2>
          <ul>
            {extra.map((item) => (
              <li key={item.variantId}>
                {item.label}: {item.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}
      {Object.keys(fields).length > 0 && <span className="loi-o">{Object.values(fields).join(" ")}</span>}
      <FormError text={formError} />
      {counting && (
        <div className="nhom-nut" style={{ marginTop: "var(--khoang-4)" }}>
          <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => saveCounts()}>
            {t("saveCounts")}
          </button>
          <button type="button" className="nut chinh" disabled={submitting} onClick={() => saveCounts(() => setConfirming("finish"))}>
            {t("finish")}
          </button>
          <button type="button" className="nut chu" onClick={() => setConfirming("cancel")}>
            {t("cancel")}
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title={t(`${confirming}Title`)}
          text={t(`${confirming}Text`)}
          confirmLabel={t(confirming)}
          busy={submitting}
          onConfirm={() => void act(confirming)}
          onClose={() => {
            setConfirming(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
