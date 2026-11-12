"use client";

// MAN_HINH_111 (sửa, CONG_VIEC_56; QUYTAC_NGHIEPVU_415): thuế phải nộp, đã nộp, còn phải nộp, nộp thừa của tờ khai đã ghi sổ; hạn nộp; nút nộp thuế ở mini app Tài chính.
// Người không có quyền xem Tài chính thì không hiện khối này.
import type { CustomsDeclarationTaxes } from "contracts";
import { useTranslations } from "next-intl";
import { useAdmin } from "ui/components/AppShell";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export function CustomsTaxBlock({ declarationId }: { declarationId: string }) {
  const t = useTranslations("importDeclarations");
  const { can } = useAdmin();
  const { state } = useApi<CustomsDeclarationTaxes[]>(can("finance.debt.view") ? `/finance/customs-taxes?declarationId=${declarationId}` : null);
  if (state.kind !== "ready" || state.data.length === 0) return null;
  const data = state.data[0]!;
  const headings = [t("taxType"), t("taxPayable"), t("taxPaid"), t("taxRemaining")];
  const open = data.taxes.some((tax) => Number(tax.remaining) > 0);
  const overpaid = data.taxes.some((tax) => Number(tax.remaining) < 0);
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <div className="nhom-nut">
        <strong>{t("taxesTitle")}</strong>
        <span>
          {t("taxDueDate")}: {formatDate(data.dueDate)}
        </span>
        {can("finance.payment.manage") && open && (
          <a className="nut chinh" href={`/finance/customs-tax-payments/new?declarationId=${declarationId}`}>
            {t("payTaxes")}
          </a>
        )}
        {can("finance.payment.manage") && overpaid && (
          <a className="nut phu" href={`/finance/customs-tax-payments/new?kind=customs_tax_refund&declarationId=${declarationId}`}>
            {t("receiveRefund")}
          </a>
        )}
      </div>
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
            {data.taxes.map((tax) => (
              <tr key={tax.taxType}>
                <td data-nhan={headings[0]}>
                  <span>{t(`taxType_${tax.taxType}`)}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{formatMoney(tax.payable, "VND")}</span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{formatMoney(tax.paid, "VND")}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{Number(tax.remaining) < 0 ? t("overpaid", { amount: formatMoney(String(-Number(tax.remaining)), "VND") }) : formatMoney(tax.remaining, "VND")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
