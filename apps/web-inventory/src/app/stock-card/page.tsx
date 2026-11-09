"use client";

// MAN_HINH_30 Thẻ kho (CHUC_NANG_39; QUYTAC_NGHIEPVU_49; API_64): tồn đầu kỳ, biến động, tồn cuối kỳ của một mặt hàng tại một kho.
import type { StockCardResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatMoney, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function StockCardPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <StockCard />
    </Suspense>
  );
}

function StockCard() {
  const t = useTranslations("stockCard");
  const documents = useTranslations("documents");
  const parameters = useSearchParams();
  const today = vietnamToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const warehouseId = parameters.get("warehouseId");
  const companyId = parameters.get("companyId");
  const variantId = parameters.get("variantId");
  const query = warehouseId && companyId && variantId ? new URLSearchParams({ warehouseId, companyId, variantId, from, to }) : null;
  const { state, reload } = useApi<StockCardResponse>(query ? `/inventory/stock-card?${query}` : null);
  if (!query) return <MessageView text={t("choose")} />;
  const money = (value: string | null) => (value === null ? "—" : formatMoney(value, "VND"));
  const headings = [t("time"), t("document"), t("lot"), t("quantity"), t("unitCost"), t("value"), t("balance")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <Link className="nut phu" href="/stock">
          {t("back")}
        </Link>
      </div>
      <div className="bo-loc">
        <label htmlFor="tu-ngay">{t("from")}</label>
        <input id="tu-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
        <label htmlFor="den-ngay">{t("to")}</label>
        <input id="den-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(card) => (
          <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <h2>
              {card.sku} · {card.productName} ({card.baseUnitName})
            </h2>
            <p>
              {t("opening")}: <strong>{formatNumber(card.opening.quantity)}</strong> · {money(card.opening.value)}
            </p>
            {card.movements.length === 0 ? (
              <p className="chu-thich">{t("noMovements")}</p>
            ) : (
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
                    {card.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td data-nhan={headings[0]}>
                          <span>{formatDateTime(movement.movedAt)}</span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <Link href={`/documents/${movement.documentId}`}>{movement.documentNo ?? documents(`type_${movement.documentType}`)}</Link>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{[movement.lotNo, movement.locationCode].filter(Boolean).join(" · ") || "—"}</span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{formatNumber(movement.quantity)}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>{money(movement.unitCost)}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span>{money(movement.value)}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <span>{formatNumber(movement.balanceAfter)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p>
              {t("closing")}: <strong>{formatNumber(card.closing.quantity)}</strong> · {money(card.closing.value)}
            </p>
          </section>
        )}
      </Loaded>
    </>
  );
}
