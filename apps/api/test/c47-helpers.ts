// Dữ liệu dùng chung cho kiểm thử CONG_VIEC_47: người dùng nhân sự, trưởng phòng, hồ sơ, ca, lịch.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { expect } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";

export const retail: string = testIds.retailCompany;

export async function userWithRole(application: NestExpressApplication, pool: Pool, email: string, name: string, roleCode: string | null): Promise<{ id: string; session: Session }> {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  if (roleCode) {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [roleCode])).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2020-01-01')", [id, role, retail]);
  }
  return { id, session: await signIn(application, email) };
}

export async function department(pool: Pool, code: string, name: string, managerId: string | null): Promise<string> {
  return (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name, manager_user_id) VALUES ($1, $2, $3, $4) RETURNING id", [retail, code, name, managerId])).rows[0]!.id;
}

let identity = 79100000000;
export async function hrEmployee(
  hr: Session,
  values: { fullName: string; departmentId: string; hireDate?: string; birthDate?: string; userId?: string | null; nationality?: string },
): Promise<string> {
  identity += 1;
  const foreign = values.nationality && values.nationality !== "VN";
  const created = await hr.call("post", "/hr/employees", {
    companyId: retail,
    body: {
      fullName: values.fullName,
      gender: "female",
      birthDate: values.birthDate ?? "1995-01-01",
      nationality: values.nationality ?? "VN",
      identityNumber: foreign ? `P${identity}` : `0${identity}`,
      residence: "Thành phố Hồ Chí Minh",
      hireDate: values.hireDate ?? "2024-01-01",
      departmentId: values.departmentId,
      branchId: testIds.headOfficeBranch,
      jobTitle: "Nhân viên",
      userId: values.userId ?? null,
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.id as string;
}

// Ca hành chính 8:00–17:00 nghỉ trưa 60 phút, thứ bảy nửa ngày; lịch mặc định thứ hai–sáu ca hành chính, thứ bảy nửa ngày.
export async function officeSetup(hr: Session): Promise<{ office: string; saturday: string; schedule: string }> {
  const office = await hr.call("post", "/hr/attendance/shifts", {
    companyId: retail,
    body: { code: "HC", name: "Hành chính", startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakMinutes: 60, breakPaid: false, workUnits: "1" },
  });
  expect(office.status, JSON.stringify(office.body)).toBe(201);
  const saturday = await hr.call("post", "/hr/attendance/shifts", {
    companyId: retail,
    body: { code: "T7", name: "Nửa ngày thứ bảy", startTime: "08:00", endTime: "12:00", breakMinutes: 0, breakPaid: false, workUnits: "0.5" },
  });
  expect(saturday.status, JSON.stringify(saturday.body)).toBe(201);
  const schedule = await hr.call("post", "/hr/attendance/schedules", {
    companyId: retail,
    body: { name: "Văn phòng", isDefault: true, shiftIds: [office.body.id, office.body.id, office.body.id, office.body.id, office.body.id, saturday.body.id, null] },
  });
  expect(schedule.status, JSON.stringify(schedule.body)).toBe(201);
  return { office: office.body.id, saturday: saturday.body.id, schedule: schedule.body.id };
}
