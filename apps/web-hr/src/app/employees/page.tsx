"use client";

// MAN_HINH_114 Danh sách hồ sơ nhân sự (CHUC_NANG_162; API_144): tìm, lọc phòng ban, chi nhánh, trạng thái; hồ sơ đã nghỉ chỉ người quản lý hồ sơ lọc được.
import type { EmployeeListResponse, EmployeeOptionsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function EmployeesPage() {
  const t = useTranslations("hr");
  const { can } = useAdmin();
  const canManage = can("hr.employee.manage");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const options = useApi<EmployeeOptionsResponse>(canManage || can("hr.contract.manage") ? "/hr/employee-options" : null);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20", status });
  if (search.trim()) parameters.set("search", search.trim());
  if (departmentId) parameters.set("departmentId", departmentId);
  if (branchId) parameters.set("branchId", branchId);
  const { state, reload } = useApi<EmployeeListResponse>(`/hr/employees?${parameters}`);
  const headings = [t("code"), t("fullName"), t("department"), t("jobTitle"), t("branch"), t("hireDate"), t("status_active")];
  const filterOptions = options.state.kind === "ready" ? options.state.data : null;
  const reset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="employee" />
        {canManage && (
          <Link className="nut chinh" href="/employees/new">
            {t("create")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-ho-so">
          {t("searchPlaceholder")}
        </label>
        <input id="tim-ho-so" className="o-nhap" placeholder={t("searchPlaceholder")} value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
        {filterOptions && (
          <>
            <select className="o-nhap" aria-label={t("department")} value={departmentId} onChange={(event) => reset(setDepartmentId)(event.target.value)}>
              <option value="">{t("allDepartments")}</option>
              {filterOptions.departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select className="o-nhap" aria-label={t("branch")} value={branchId} onChange={(event) => reset(setBranchId)(event.target.value)}>
              <option value="">{t("allBranches")}</option>
              {filterOptions.branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </>
        )}
        {canManage && (
          <select className="o-nhap" aria-label={t("status_all")} value={status} onChange={(event) => reset(setStatus)(event.target.value)}>
            {(["active", "terminated", "all"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`status_${value}`)}
              </option>
            ))}
          </select>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col">
                        {index === headings.length - 1 ? "" : heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((employee) => (
                    <tr key={employee.id}>
                      <td data-nhan={headings[0]}>
                        <span>{employee.code}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <Link href={`/employees/${employee.id}`}>{employee.fullName}</Link>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{employee.departmentName ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{employee.jobTitle ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{employee.branchName ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatDate(employee.hireDate)}</span>
                      </td>
                      <td data-nhan="">
                        <span className="nhom-nut">
                          <span className={`nhan ${employee.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${employee.status}`)}</span>
                          {employee.isMinor && <span className="nhan thong-tin">{t("minor")}</span>}
                          {employee.missingConsent && <span className="nhan canh-bao">{t("missingConsent")}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{t("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="‹">
                    ‹
                  </button>
                  <span>{page}</span>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)} aria-label="›">
                    ›
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
