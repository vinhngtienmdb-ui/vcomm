"use client";

// MAN_HINH_111 Chi tiết tờ khai (CHUC_NANG_160, 161; API_140, API_141): sửa nháp, xem trước phân bổ, ghi sổ, hủy; sau ghi sổ hiện phần vào tồn, vào giá vốn hàng bán.
import type { ImportAllocationPreview, ImportDeclarationResponse, ImportOrderOption } from "contracts";
import { useTranslations } from "next-intl";
import { CustomsTaxBlock } from "@/components/CustomsTaxBlock";
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
import { DeclarationEditor } from "@/components/DeclarationEditor";
import { DeclarationStatus } from "@/components/DeclarationStatus";

export default function ImportDeclarationPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<ImportDeclarationResponse>(`/purchasing/import-declarations/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(declaration) => <Declaration declaration={declaration} reload={() => void reload()} />}
    </Loaded>
  );
}

function Declaration({ declaration, reload }: { declaration: ImportDeclarationResponse; reload: () => void }) {
  const t = useTranslations("importDeclarations");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const order = useApi<ImportOrderOption[]>(editing ? `/purchasing/import-orders?orderId=${declaration.orderId}` : null);
  const preview = useApi<ImportAllocationPreview>(declaration.status === "draft" ? `/purchasing/import-declarations/${declaration.id}/allocation-preview` : null);
  const money = (amount: string) => formatMoney(amount, declaration.companyCurrency);

  async function act(action: "post" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/purchasing/import-declarations/${declaration.id}/${action}`, { method: "POST", body: JSON.stringify({ version: declaration.version }) });
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
          <h1>{t("edit", { number: declaration.declarationNo })}</h1>
        </div>
        <Loaded state={order.state} onRetry={() => void order.reload()}>
          {(orders) =>
            orders[0] ? (
              <DeclarationEditor
                order={orders[0]}
                declaration={declaration}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  notify(t("saved"));
                  setEditing(false);
                  reload();
                }}
              />
            ) : (
              <div className="khoi-canh-bao loi">{t("orderUnavailable")}</div>
            )
          }
        </Loaded>
      </>
    );
  }

  const totals = declaration.lines.reduce(
    (sum, line) => ({
      importDuty: sum.importDuty + Number(line.importDuty),
      exciseTax: sum.exciseTax + Number(line.exciseTax),
      environmentalTax: sum.environmentalTax + Number(line.environmentalTax),
      vatAmount: sum.vatAmount + Number(line.vatAmount),
    }),
    { importDuty: 0, exciseTax: 0, environmentalTax: 0, vatAmount: 0 },
  );
  const headings = [t("item"), t("quantityShort"), t("customsValue", { currency: declaration.currency }), t("convertedShort"), t("importDuty"), t("exciseTax"), t("environmentalTax"), t("vatAmount")];
  return (
    <>
      <Link href="/import-declarations">‹ {t("back")}</Link>
      <div className="tieu-de">
        <h1>{t("heading", { number: declaration.declarationNo })}</h1>
        <DeclarationStatus status={declaration.status} />
        <HistoryLink entityType="import_declaration" entityId={declaration.id} />
        {declaration.canEdit && (
          <>
            <button type="button" className="nut nguy-hiem" onClick={() => setConfirm("cancel")}>
              {t("cancel")}
            </button>
            <button type="button" className="nut phu" onClick={() => setEditing(true)}>
              {t("editButton")}
            </button>
          </>
        )}
        {declaration.canPost && (
          <button type="button" className="nut chinh" disabled={busy} onClick={() => setConfirm("post")}>
            {t("post")}
          </button>
        )}
      </div>
      <section className="the">
        <dl className="thong-tin-dong">
          <dt>{t("order")}</dt>
          <dd>
            <Link href={`/orders/${declaration.orderId}`}>{declaration.orderNo}</Link> · {declaration.currency} · {declaration.warehouseName}
          </dd>
          <dt>{t("supplier")}</dt>
          <dd>{declaration.supplierName}</dd>
          <dt>{t("registeredOn")}</dt>
          <dd>{formatDate(declaration.registeredOn)}</dd>
          <dt>{t("postingDate")}</dt>
          <dd>{formatDate(declaration.postingDate)}</dd>
          <dt>{t("customsRateLabel")}</dt>
          <dd>{t("customsRateValue", { currency: declaration.currency, rate: formatNumber(declaration.customsRate) })}</dd>
          {declaration.customsOffice && (
            <>
              <dt>{t("customsOffice")}</dt>
              <dd>{declaration.customsOffice}</dd>
            </>
          )}
          {declaration.note && (
            <>
              <dt>{t("note")}</dt>
              <dd>{declaration.note}</dd>
            </>
          )}
        </dl>
      </section>
      {declaration.status === "posted" && <CustomsTaxBlock declarationId={declaration.id} />}
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
            {declaration.lines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={headings[0]}>
                  <span>
                    {line.sku} · {line.productName}
                  </span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>
                    {formatNumber(line.quantity)} {line.unitName}
                  </span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{formatMoney(line.customsValue, declaration.currency)}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{money(line.customsValueConverted)}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>
                    {money(line.importDuty)} ({formatNumber(line.importDutyRate)}%)
                  </span>
                  {line.importDutyEdited && <span className="nhan canh-bao">{t("edited", { amount: money(line.suggestedImportDuty) })}</span>}
                </td>
                <td data-nhan={headings[5]}>
                  <span>{money(line.exciseTax)}</span>
                </td>
                <td data-nhan={headings[6]}>
                  <span>{money(line.environmentalTax)}</span>
                </td>
                <td data-nhan={headings[7]}>
                  <span>
                    {money(line.vatAmount)} ({formatNumber(line.vatRate)}%)
                  </span>
                  {line.vatEdited && <span className="nhan canh-bao">{t("edited", { amount: money(line.suggestedVatAmount) })}</span>}
                </td>
              </tr>
            ))}
            <tr>
              <td data-nhan="">
                <strong>{t("total")}</strong>
              </td>
              <td data-nhan="" />
              <td data-nhan={headings[2]}>
                <strong>{formatMoney(declaration.customsValue, declaration.currency)}</strong>
              </td>
              <td data-nhan={headings[3]}>
                <strong>{money(declaration.customsValueConverted)}</strong>
              </td>
              <td data-nhan={headings[4]}>
                <strong>{money(String(totals.importDuty))}</strong>
              </td>
              <td data-nhan={headings[5]}>
                <strong>{money(String(totals.exciseTax))}</strong>
              </td>
              <td data-nhan={headings[6]}>
                <strong>{money(String(totals.environmentalTax))}</strong>
              </td>
              <td data-nhan={headings[7]}>
                <strong>{money(String(totals.vatAmount))}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2 style={{ margin: 0 }}>{declaration.status === "posted" ? t("allocationPosted") : t("allocationPreview")}</h2>
      <p className="chu-thich" style={{ margin: 0 }}>
        {declaration.status === "posted" ? t("allocationPostedHint") : t("allocationPreviewHint")}
      </p>
      {declaration.status === "posted" ? (
        <AllocationTable
          rows={declaration.lines.map((line) => ({
            key: line.id,
            item: `${line.sku} · ${line.productName}`,
            amount: String(Number(line.importDuty) + Number(line.exciseTax) + Number(line.environmentalTax)),
            onHand: null,
            stockValue: line.stockValue ?? "0",
            expensedValue: line.expensedValue ?? "0",
          }))}
          money={money}
        />
      ) : (
        <Loaded state={preview.state} onRetry={() => void preview.reload()}>
          {(result) => (
            <AllocationTable
              rows={result.lines.map((line, index) => ({
                key: `${line.orderLineId}-${index}`,
                item: `${line.sku} · ${line.productName}`,
                amount: line.amount,
                onHand: t("onHandOf", { onHand: formatNumber(line.onHand), quantity: formatNumber(line.baseQuantity) }),
                stockValue: line.stockValue,
                expensedValue: line.expensedValue,
              }))}
              money={money}
            />
          )}
        </Loaded>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === "post" ? t("postTitle") : t("cancelTitle")}
          text={confirm === "post" ? t("postMessage") : t("cancelMessage")}
          error={error}
          confirmLabel={confirm === "post" ? t("post") : t("cancel")}
          busy={busy}
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

function AllocationTable({
  rows,
  money,
}: {
  rows: { key: string; item: string; amount: string; onHand: string | null; stockValue: string; expensedValue: string }[];
  money: (amount: string) => string;
}) {
  const t = useTranslations("importDeclarations");
  const headings = [t("item"), t("taxIntoCost"), t("stockValue"), t("expensedValue")];
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
          {rows.map((row) => (
            <tr key={row.key}>
              <td data-nhan={headings[0]}>
                <span>{row.item}</span>
              </td>
              <td data-nhan={headings[1]}>
                <span>{money(row.amount)}</span>
              </td>
              <td data-nhan={headings[2]}>
                <span>{money(row.stockValue)}</span>
                {row.onHand && (
                  <span className="chu-thich" style={{ display: "block" }}>
                    {row.onHand}
                  </span>
                )}
              </td>
              <td data-nhan={headings[3]}>
                <span>{money(row.expensedValue)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
