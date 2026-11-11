"use client";

// MAN_HINH_113 Chi tiết chi phí nhập khẩu (CHUC_NANG_161; API_142, API_143): khoản chi phí, phân bổ theo dòng tờ khai (xem trước hoặc đã ghi sổ), sửa, hủy, ghi sổ.
import type { LandedCostAllocation, LandedCostResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch, ApiFailure } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DeclarationStatus } from "@/components/DeclarationStatus";
import { LandedCostEditor } from "@/components/LandedCostEditor";

export default function LandedCostPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<LandedCostResponse>(`/purchasing/landed-costs/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(cost) => <LandedCost key={cost.version} cost={cost} reload={() => void reload()} />}
    </Loaded>
  );
}

function LandedCost({ cost, reload }: { cost: LandedCostResponse; reload: () => void }) {
  const t = useTranslations("landedCosts");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allocation = useApi<LandedCostAllocation>(cost.status === "cancelled" ? null : `/purchasing/landed-costs/${cost.id}/allocation`);
  const money = (amount: string) => formatMoney(amount, cost.companyCurrency);
  const foreign = cost.currency !== cost.companyCurrency;

  async function act(action: "post" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/purchasing/landed-costs/${cost.id}/${action}`, { method: "POST", body: JSON.stringify({ version: cost.version }) });
      notify(t(action === "post" ? "posted" : "cancelled"));
      setConfirm(null);
      reload();
    } catch (failure) {
      setError(failure instanceof ApiFailure ? [failure.message, ...Object.values(failure.body?.fields ?? {})].join(" ") : common("error"));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <>
        <div className="tieu-de">
          <h1>{t("edit")}</h1>
        </div>
        <LandedCostEditor
          cost={cost}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            notify(t("saved"));
            setEditing(false);
            reload();
          }}
        />
      </>
    );
  }

  const lineHeadings = [t("kind"), t("description"), t("amount"), t("vatRate"), t("vatAmount"), t("basis")];
  return (
    <>
      <Link href="/landed-costs">‹ {t("back")}</Link>
      <div className="tieu-de">
        <h1>{cost.documentNo ? t("heading", { number: cost.documentNo }) : t("draftHeading")}</h1>
        <DeclarationStatus status={cost.status} />
        <HistoryLink entityType="landed_cost" entityId={cost.id} />
        {cost.canEdit && (
          <>
            <button type="button" className="nut nguy-hiem" onClick={() => setConfirm("cancel")}>
              {t("cancel")}
            </button>
            <button type="button" className="nut phu" onClick={() => setEditing(true)}>
              {t("editButton")}
            </button>
          </>
        )}
        {cost.canPost && (
          <button type="button" className="nut chinh" disabled={busy} onClick={() => setConfirm("post")}>
            {t("post")}
          </button>
        )}
      </div>
      <section className="the">
        <dl className="thong-tin-dong">
          <dt>{t("declaration")}</dt>
          <dd>
            <Link href={`/import-declarations/${cost.declarationId}`}>{cost.declarationNo}</Link>
          </dd>
          <dt>{t("supplier")}</dt>
          <dd>{cost.supplierName}</dd>
          <dt>{t("invoiceNo")}</dt>
          <dd>{cost.invoiceNo}</dd>
          <dt>{t("documentDate")}</dt>
          <dd>{formatDate(cost.documentDate)}</dd>
          {foreign && (
            <>
              <dt>{t("exchangeRate")}</dt>
              <dd>{t("exchangeRateValue", { currency: cost.currency, rate: formatNumber(cost.exchangeRate) })}</dd>
            </>
          )}
          {cost.note && (
            <>
              <dt>{t("note")}</dt>
              <dd>{cost.note}</dd>
            </>
          )}
        </dl>
        <strong>{t("totals", { net: money(cost.netAmount), vat: money(cost.vatAmount), gross: money(String(Number(cost.netAmount) + Number(cost.vatAmount))) })}</strong>
      </section>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {lineHeadings.map((heading, index) => (
                <th key={index} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cost.lines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={lineHeadings[0]}>
                  <span>{t(`kind_${line.kind}`)}</span>
                </td>
                <td data-nhan={lineHeadings[1]}>
                  <span>{line.description ?? "—"}</span>
                </td>
                <td data-nhan={lineHeadings[2]}>
                  <span>{money(line.amountConverted)}</span>
                  {foreign && (
                    <span className="chu-thich" style={{ display: "block" }}>
                      {formatMoney(line.amount, cost.currency)}
                    </span>
                  )}
                </td>
                <td data-nhan={lineHeadings[3]}>
                  <span>{t(`vat_${line.vatRate}`)}</span>
                </td>
                <td data-nhan={lineHeadings[4]}>
                  <span>{money(line.vatAmount)}</span>
                </td>
                <td data-nhan={lineHeadings[5]}>
                  <span>{t(`basis_${line.basis}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cost.status !== "cancelled" && (
        <>
          <h2 style={{ margin: 0 }}>{cost.status === "posted" ? t("allocationPosted") : t("allocationPreview")}</h2>
          <p className="chu-thich" style={{ margin: 0 }}>
            {cost.status === "posted" ? t("allocationPostedHint") : t("allocationPreviewHint")}
          </p>
          <Loaded state={allocation.state} onRetry={() => void allocation.reload()}>
            {(result) => <AllocationTable cost={cost} allocation={result} money={money} />}
          </Loaded>
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === "post" ? t("postTitle") : t("cancelTitle")}
          text={confirm === "post" ? t("postMessage") : t("cancelMessage")}
          confirmLabel={confirm === "post" ? t("post") : t("cancel")}
          busy={busy}
          error={error}
          onConfirm={() => void act(confirm)}
          onClose={() => {
            setConfirm(null);
            setError(null);
          }}
        />
      )}
    </>
  );
}

function AllocationTable({ cost, allocation, money }: { cost: LandedCostResponse; allocation: LandedCostAllocation; money: (amount: string) => string }) {
  const t = useTranslations("landedCosts");
  const headings = [t("item"), t("convertedValue"), t("quantity"), ...cost.lines.map((line) => t(`kind_${line.kind}`)), t("lineTotal"), t("stockValue"), t("expensedValue")];
  const sum = (pick: (line: LandedCostAllocation["lines"][number]) => string) => String(allocation.lines.reduce((total, line) => total + Number(pick(line)), 0));
  return (
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
          {allocation.lines.map((line) => (
            <tr key={line.declarationLineId}>
              <td data-nhan={headings[0]}>
                <span>
                  {line.sku} · {line.productName}
                </span>
              </td>
              <td data-nhan={headings[1]}>
                <span>{money(line.customsValueConverted)}</span>
              </td>
              <td data-nhan={headings[2]}>
                <span>{formatNumber(line.baseQuantity)}</span>
              </td>
              {line.byCostLine.map((amount, index) => (
                <td key={index} data-nhan={headings[3 + index]}>
                  <span>{money(amount)}</span>
                </td>
              ))}
              <td data-nhan={headings[3 + cost.lines.length]}>
                <span>{money(line.amount)}</span>
              </td>
              <td data-nhan={headings[4 + cost.lines.length]}>
                <span>{money(line.stockValue)}</span>
                {line.onHand !== null && (
                  <span className="chu-thich" style={{ display: "block" }}>
                    {t("onHandOf", { onHand: formatNumber(line.onHand), quantity: formatNumber(line.baseQuantity) })}
                  </span>
                )}
              </td>
              <td data-nhan={headings[5 + cost.lines.length]}>
                <span>{money(line.expensedValue)}</span>
              </td>
            </tr>
          ))}
          <tr>
            <td data-nhan="">
              <strong>{t("total")}</strong>
            </td>
            <td data-nhan="" />
            <td data-nhan="" />
            {cost.lines.map((_, index) => (
              <td key={index} data-nhan={headings[3 + index]}>
                <strong>{money(sum((line) => line.byCostLine[index] ?? "0"))}</strong>
              </td>
            ))}
            <td data-nhan={headings[3 + cost.lines.length]}>
              <strong>{money(sum((line) => line.amount))}</strong>
            </td>
            <td data-nhan={headings[4 + cost.lines.length]}>
              <strong>{money(sum((line) => line.stockValue))}</strong>
            </td>
            <td data-nhan={headings[5 + cost.lines.length]}>
              <strong>{money(sum((line) => line.expensedValue))}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
