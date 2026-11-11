"use client";

// MAN_HINH_130 Phiếu lương của tôi (CHUC_NANG_170; API_161): danh sách tháng đã duyệt, phiếu chi tiết, in từ trình duyệt.
import type { PayslipListItem, PayslipResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { Table } from "./EmployeeTabs";
import { monthLabel, vnd } from "./PayrollParts";

export function MyPayslips() {
  const t = useTranslations("payroll");
  const list = useApi<PayslipListItem[]>("/hr/me/payslips");
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Loaded state={list.state} onRetry={() => void list.reload()}>
      {(items) =>
        items.length === 0 ? (
          <div className="trang-thai-trong">
            <h2>{t("noPayslips")}</h2>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" }}>
            <div className="the">
              <h2>{t("payslips")}</h2>
              <Table
                headings={[t("month"), t("netPay"), t("status")]}
                rows={items.map((item) => ({
                  key: item.lineId,
                  cells: [
                    <button key="thang" type="button" className="nut phu" aria-pressed={(selected ?? items[0]!.lineId) === item.lineId} onClick={() => setSelected(item.lineId)}>
                      {monthLabel(item.month)}
                    </button>,
                    vnd(item.netPay),
                    <span key="tt" className="nhan thanh-cong">
                      {item.status === "paid" && item.paymentDate ? t("paidOn", { date: formatDate(item.paymentDate) }) : t("payrollStatus_approved")}
                    </span>,
                  ],
                }))}
              />
            </div>
            <Payslip lineId={selected ?? items[0]!.lineId} />
          </div>
        )
      }
    </Loaded>
  );
}

function Payslip({ lineId }: { lineId: string }) {
  const t = useTranslations("payroll");
  const { state, reload } = useApi<PayslipResponse>(`/hr/me/payslips/${lineId}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(slip) => {
        const line = slip.line;
        const allowances = (line.explanation as { allowances?: { name: string; paid: string }[] }).allowances ?? [];
        return (
          <div className="the">
            <div className="tieu-de">
              <h2>{t("payslipTitle", { month: monthLabel(slip.month) })}</h2>
              <button type="button" className="nut phu" onClick={() => window.print()}>
                {t("print")}
              </button>
            </div>
            <dl className="thong-tin-dong">
              <dt>{t("company")}</dt>
              <dd>{slip.companyName}</dd>
              <dt>{t("employeeName")}</dt>
              <dd>
                {slip.employeeName} · {slip.employeeCode}
              </dd>
              <dt>{t("workDays")}</dt>
              <dd>{t("workDaysText", { paid: Number(line.paidDays).toLocaleString("vi-VN"), standard: Number(line.standardDays).toLocaleString("vi-VN") })}</dd>
              <dt>{t("timePay")}</dt>
              <dd>{vnd(line.timePay)}</dd>
              {allowances.map((allowance, index) => (
                <div key={index} style={{ display: "contents" }}>
                  <dt>{allowance.name}</dt>
                  <dd>{vnd(allowance.paid)}</dd>
                </div>
              ))}
              {Number(line.overtimePay) + Number(line.nightPremium) > 0 && (
                <>
                  <dt>{t("overtimePay")}</dt>
                  <dd>{vnd(String(Number(line.overtimePay) + Number(line.nightPremium)))}</dd>
                </>
              )}
              {line.adjustments
                .filter((item) => item.kind === "addition")
                .map((item) => (
                  <div key={item.id} style={{ display: "contents" }}>
                    <dt>{item.description}</dt>
                    <dd>{vnd(item.amount)}</dd>
                  </div>
                ))}
              <dt>{t("grossIncome")}</dt>
              <dd>
                <strong>{vnd(line.grossIncome)}</strong>
              </dd>
              <dt>{t("insurance")}</dt>
              <dd>{vnd(line.employeeInsurance)}</dd>
              <dt>{t("tax")}</dt>
              <dd>{vnd(line.personalIncomeTax)}</dd>
              {line.adjustments
                .filter((item) => item.kind === "deduction")
                .map((item) => (
                  <div key={item.id} style={{ display: "contents" }}>
                    <dt>{item.description}</dt>
                    <dd>−{vnd(item.amount)}</dd>
                  </div>
                ))}
              <dt>{t("netPay")}</dt>
              <dd>
                <strong>{vnd(line.netPay)}</strong>
              </dd>
            </dl>
            <span className="chu-thich">{slip.status === "paid" && slip.paymentDate ? t("paidOn", { date: formatDate(slip.paymentDate) }) : t("notPaidYet")}</span>
          </div>
        );
      }}
    </Loaded>
  );
}
