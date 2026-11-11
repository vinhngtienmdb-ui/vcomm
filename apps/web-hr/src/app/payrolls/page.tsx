"use client";

// MAN_HINH_126 Danh sách bảng lương (CHUC_NANG_169; API_159).
import type { PayrollListResponse, PayrollResponse, PayrollStatus } from "contracts";
import { payrollStatuses } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";
import { Table } from "@/components/EmployeeTabs";
import { PayrollStatusBadge, vnd } from "@/components/PayrollParts";

export default function PayrollsPage() {
  const t = useTranslations("payroll");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState<PayrollStatus | "">("");
  const { state, reload } = useApi<PayrollListResponse>(`/hr/payrolls?year=${year}${status ? `&status=${status}` : ""}`);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Loaded state={state} onRetry={() => void reload()}>
        {(list) => (
          <>
            <div className="tieu-de">
              <h1>{t("payrollsTitle")}</h1>
              {list.canManage && (
                <button type="button" className="nut chinh" onClick={() => setCreating(true)}>
                  {t("createPayroll")}
                </button>
              )}
            </div>
            <div className="bo-loc">
              <label className="an-nhan" htmlFor="bl-nam">
                {t("year")}
              </label>
              <select id="bl-nam" className="o-nhap" value={year} onChange={(event) => setYear(event.target.value)}>
                {[0, 1, 2].map((offset) => {
                  const value = String(new Date().getFullYear() - offset);
                  return (
                    <option key={value} value={value}>
                      {t("yearOption", { year: value })}
                    </option>
                  );
                })}
              </select>
              <label className="an-nhan" htmlFor="bl-trang-thai">
                {t("status")}
              </label>
              <select id="bl-trang-thai" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value as PayrollStatus | "")}>
                <option value="">{t("allStatuses")}</option>
                {payrollStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(`payrollStatus_${value}`)}
                  </option>
                ))}
              </select>
            </div>
            {list.data.length === 0 ? (
              <div className="trang-thai-trong">
                <h2>{t("noPayrolls")}</h2>
              </div>
            ) : (
              <Table
                headings={[t("month"), t("documentNo"), t("employeeCount"), t("grossIncome"), t("netPay"), t("employerCost"), t("status")]}
                rows={list.data.map((item) => ({
                  key: item.id,
                  cells: [
                    <Link key="thang" href={`/payrolls/${item.id}`}>
                      {item.month.slice(5, 7)}/{item.month.slice(0, 4)}
                    </Link>,
                    item.documentNo ?? "—",
                    String(item.employeeCount),
                    vnd(item.grossIncome),
                    vnd(item.netPay),
                    vnd(item.employerCost),
                    <PayrollStatusBadge key="tt" status={item.status} />,
                  ],
                }))}
              />
            )}
          </>
        )}
      </Loaded>
      {creating && <CreateDrawer onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("payroll");
  const router = useRouter();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const created = await apiFetch<PayrollResponse>("/hr/payrolls", { method: "POST", body: JSON.stringify({ month: month ? `${month}-01` : "" }) });
      router.push(`/payrolls/${created.id}`);
    });
  }
  return (
    <Drawer title={t("createPayroll")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="bl-thang" label={`${t("month")} *`} error={fields.month}>
          <input id="bl-thang" type="month" className={inputClass("month")} value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <div className="khoi-canh-bao thong-tin">{t("createHint")}</div>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("createAndCalculate")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
