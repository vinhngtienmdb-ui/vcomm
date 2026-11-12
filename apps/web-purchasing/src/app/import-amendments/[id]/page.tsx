"use client";

// MAN_HINH_186 Chi tiết tờ khai bổ sung (CONG_VIEC_56; CHUC_NANG_199; API_219): so sánh thuế trước, sau bổ sung; xem trước phân bổ chênh lệch; sửa, hủy, ghi sổ nháp.
import type { ImportAllocationPreview, ImportAmendmentBase, ImportAmendmentResponse, ImportAmendmentTaxes } from "contracts";
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
import { AmendmentEditor } from "@/components/AmendmentEditor";
import { DeclarationStatus } from "@/components/DeclarationStatus";

const taxKeys = ["importDuty", "exciseTax", "environmentalTax", "vatAmount"] as const;
const taxLabel = { importDuty: "tax_import_duty", exciseTax: "tax_excise_tax", environmentalTax: "tax_environmental_tax", vatAmount: "tax_vat_amount" } as const;

export default function ImportAmendmentPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<ImportAmendmentResponse>(`/purchasing/import-amendments/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(amendment) => <Amendment amendment={amendment} reload={() => void reload()} />}
    </Loaded>
  );
}

function Amendment({ amendment, reload }: { amendment: ImportAmendmentResponse; reload: () => void }) {
  const t = useTranslations("importAmendments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useApi<ImportAmendmentBase>(editing ? `/purchasing/import-amendments/current?declarationId=${amendment.declarationId}` : null);
  const preview = useApi<ImportAllocationPreview>(amendment.status === "draft" ? `/purchasing/import-amendments/${amendment.id}/allocation-preview` : null);
  const money = (amount: string) => formatMoney(amount, amendment.companyCurrency);
  const signed = (amount: string) => (Number(amount) > 0 ? `+${money(amount)}` : money(amount));

  async function act(action: "post" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/purchasing/import-amendments/${amendment.id}/${action}`, { method: "POST", body: JSON.stringify({ version: amendment.version }) });
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
          <h1>{t("editHeading", { number: amendment.amendmentNo })}</h1>
        </div>
        <Loaded state={base.state} onRetry={() => void base.reload()}>
          {(data) => (
            <AmendmentEditor
              base={data}
              amendment={amendment}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                notify(t("saved"));
                setEditing(false);
                reload();
              }}
            />
          )}
        </Loaded>
      </>
    );
  }

  // Mỗi dòng tờ khai × loại thuế có số; luôn hiện nhập khẩu, giá trị gia tăng.
  const rows = amendment.lines.flatMap((line) =>
    taxKeys
      .filter((key) => key === "importDuty" || key === "vatAmount" || Number(line.before[key]) !== 0 || Number(line.after[key]) !== 0)
      .map((key) => ({
        key: `${line.declarationLineId}-${key}`,
        item: `${line.sku} · ${line.productName}`,
        tax: t(taxLabel[key]),
        rate: key === "importDuty" ? `${formatNumber(line.importDutyRate)}%` : key === "vatAmount" ? `${formatNumber(line.vatRate)}%` : "",
        before: line.before[key],
        after: line.after[key],
        difference: line.difference[key],
      })),
  );
  const total = (taxes: ImportAmendmentTaxes) => taxKeys.reduce((sum, key) => sum + Number(taxes[key]), 0);
  const headings = [t("item"), t("taxType"), t("before"), t("rate"), t("after"), t("difference")];
  return (
    <>
      <Link href={`/import-declarations/${amendment.declarationId}`}>‹ {t("back", { number: amendment.declarationNo })}</Link>
      <div className="tieu-de">
        <h1>{t("heading", { number: amendment.amendmentNo })}</h1>
        <DeclarationStatus status={amendment.status} />
        <HistoryLink entityType="import_amendment" entityId={amendment.id} />
        {amendment.canEdit && (
          <>
            <button type="button" className="nut nguy-hiem" onClick={() => setConfirm("cancel")}>
              {t("cancel")}
            </button>
            <button type="button" className="nut phu" onClick={() => setEditing(true)}>
              {t("edit")}
            </button>
            <button type="button" className="nut chinh" disabled={busy} onClick={() => setConfirm("post")}>
              {t("post")}
            </button>
          </>
        )}
      </div>
      <section className="the">
        <dl className="thong-tin-dong">
          <dt>{t("registeredOn")}</dt>
          <dd>{formatDate(amendment.registeredOn)}</dd>
          <dt>{t("postingDate")}</dt>
          <dd>{formatDate(amendment.postingDate)}</dd>
          {amendment.reason && (
            <>
              <dt>{t("reason")}</dt>
              <dd>{amendment.reason}</dd>
            </>
          )}
          <dt>{t("createdBy")}</dt>
          <dd>{amendment.createdByName}</dd>
        </dl>
      </section>
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
                  <span>{row.tax}</span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{money(row.before)}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{row.rate}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>{money(row.after)}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <strong>{signed(row.difference)}</strong>
                </td>
              </tr>
            ))}
            <tr>
              <td data-nhan="">
                <strong>{t("total")}</strong>
              </td>
              <td data-nhan="" />
              <td data-nhan="" />
              <td data-nhan="" />
              <td data-nhan="" />
              <td data-nhan={headings[5]}>
                <strong>{signed(String(total(amendment.totalDifference)))}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <h2 style={{ margin: 0 }}>{amendment.status === "posted" ? t("allocationPosted") : t("allocationPreview")}</h2>
      {amendment.status === "posted" ? (
        <AllocationTable
          rows={amendment.lines.map((line) => ({
            key: line.declarationLineId,
            item: `${line.sku} · ${line.productName}`,
            amount: String(Number(line.difference.importDuty) + Number(line.difference.exciseTax) + Number(line.difference.environmentalTax)),
            onHand: null,
            stockValue: line.stockValue ?? "0",
            expensedValue: line.expensedValue ?? "0",
          }))}
          money={money}
        />
      ) : amendment.status === "draft" ? (
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
      ) : null}
      <div className="khoi-canh-bao">{t("postHint")}</div>
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
  const t = useTranslations("importAmendments");
  const headings = [t("item"), t("taxIntoCost"), t("onHand"), t("stockValue"), t("expensedValue")];
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
                <span>{row.onHand ?? ""}</span>
              </td>
              <td data-nhan={headings[3]}>
                <span>{money(row.stockValue)}</span>
              </td>
              <td data-nhan={headings[4]}>
                <span>{money(row.expensedValue)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
