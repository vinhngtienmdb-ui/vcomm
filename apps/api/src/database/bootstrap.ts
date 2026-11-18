// Lệnh khởi tạo một lần trên môi trường thật (CONG_VIEC_78): tạo tập đoàn và tài khoản quản trị tập đoàn đầu tiên ở trạng thái
// "Đã mời", in một lần đường dẫn kích hoạt dùng một lần (hết hạn 72 giờ, CHUC_NANG_04, MAN_HINH_03). Cơ sở dữ liệu đã có công ty
// hoặc người dùng thì từ chối. Cờ --reissue-link cấp lại đường dẫn khi tài khoản quản trị còn "Đã mời".
// Chạy trong ảnh api sau database migration:
//   node apps/api/dist/database/bootstrap.js --company-code=VCG --legal-name="..." --short-name="..." [--tax-code=0300000001] \
//     --admin-email=quantri@ten-mien --admin-name="Họ tên"
//   node apps/api/dist/database/bootstrap.js --reissue-link --admin-email=quantri@ten-mien
import { createCompanySchema, inviteUserSchema } from "contracts";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { parseArgs } from "node:util";
import type { Pool } from "pg";
import { z } from "zod";
import { AuditService } from "../common/audit.service";
import { vietnamDate } from "../common/clock";
import { webOrigin } from "../common/outbound-messages";
import { recordEvent } from "../organization/organization-context";
import { syncPermissionCatalog } from "../permissions/permission-catalog";
import { activationHours, issueActivationToken } from "../users/invitations.service";
import { createPool } from "./database.module";
import * as schema from "./schema";

export const bootstrapInputSchema = z.object({
  company: createCompanySchema.pick({ code: true, legalName: true, shortName: true, taxCode: true }),
  admin: z.object({ email: inviteUserSchema.shape.email.unwrap().unwrap(), fullName: inviteUserSchema.shape.fullName }),
});

export type BootstrapInput = z.input<typeof bootstrapInputSchema>;

export interface BootstrapResult {
  companyId: string;
  userId: string;
  activationLink: string;
  expiresAt: Date;
}

// Khóa tư vấn trong giao dịch: hai lần chạy cùng lúc không cùng tạo dữ liệu.
const bootstrapLockKey = 780001;

// Môi trường thật phải có WEB_ORIGIN thật, không tạo đường dẫn tới localhost.
function activationLinkFor(token: string): string {
  if (process.env.NODE_ENV === "production" && !process.env.WEB_ORIGIN?.trim()) throw new Error("Thiếu biến môi trường WEB_ORIGIN (địa chỉ giao diện web) để tạo đường dẫn kích hoạt.");
  return `${webOrigin()}/kich-hoat?token=${encodeURIComponent(token)}`;
}

export async function bootstrapOrganization(pool: Pool, input: BootstrapInput, now = new Date()): Promise<BootstrapResult> {
  const { company, admin } = bootstrapInputSchema.parse(input);
  const database = drizzle(pool, { schema });
  await syncPermissionCatalog(database);
  const audit = new AuditService(database);
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(${bootstrapLockKey})`);
    const existing = await transaction.execute(sql`SELECT EXISTS (SELECT 1 FROM core.companies) OR EXISTS (SELECT 1 FROM core.users) AS has_data`);
    if ((existing.rows[0] as { has_data: boolean }).has_data) throw new Error("Cơ sở dữ liệu đã có công ty hoặc người dùng: không khởi tạo lại. Tài khoản quản trị chưa kích hoạt thì dùng --reissue-link.");
    const role = await transaction.execute<{ id: string }>(sql`SELECT id FROM core.roles WHERE company_id IS NULL AND code = 'group_admin'`);
    const roleId = role.rows[0]?.id;
    if (!roleId) throw new Error("Thiếu vai trò hệ thống group_admin.");

    const companyRow = await transaction.execute<{ id: string }>(sql`
      INSERT INTO core.companies (parent_id, code, legal_name, short_name, tax_code)
      VALUES (NULL, ${company.code}, ${company.legalName}, ${company.shortName}, ${company.taxCode ?? null}) RETURNING id`);
    const companyId = companyRow.rows[0]!.id;
    const userRow = await transaction.execute<{ id: string }>(sql`
      INSERT INTO core.users (email, full_name, status) VALUES (${admin.email}, ${admin.fullName}, 'invited') RETURNING id`);
    const userId = userRow.rows[0]!.id;
    await transaction.execute(sql`INSERT INTO core.user_company_memberships (user_id, company_id, is_default) VALUES (${userId}, ${companyId}, true)`);
    await transaction.execute(sql`
      INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from)
      VALUES (${userId}, ${roleId}, 'group', NULL, NULL, ${vietnamDate(now)})`);
    // QUYTAC_NGHIEPVU_09: vai trò có quyền nhạy cảm thì bắt buộc xác thực hai lớp, như khi gán vai trò qua API.
    await transaction.execute(sql`
      UPDATE core.users SET mfa_required = EXISTS (
        SELECT 1 FROM core.role_permissions rp JOIN core.permissions p ON p.code = rp.permission_code AND p.is_sensitive WHERE rp.role_id = ${roleId})
      WHERE id = ${userId}`);
    await recordEvent(transaction, "core.company.created", "company", companyId, companyId, { companyId });
    await recordEvent(transaction, "core.user.created", "user", userId, companyId, { userId, companyId });
    // Nhật ký thao tác không chứa đường dẫn, mã kích hoạt.
    await audit.record({ actorUserId: null, companyId, appCode: "platform", action: "system.bootstrap", entityType: "company", entityId: companyId, afterData: { company, adminUserId: userId, adminEmail: admin.email } }, transaction);
    const token = await issueActivationToken(transaction, userId, now, null);
    return { companyId, userId, activationLink: activationLinkFor(token), expiresAt: new Date(now.getTime() + activationHours * 3600 * 1000) };
  });
}

export async function reissueActivationLink(pool: Pool, email: string, now = new Date()): Promise<BootstrapResult> {
  const adminEmail = bootstrapInputSchema.shape.admin.shape.email.parse(email);
  const database = drizzle(pool, { schema });
  const audit = new AuditService(database);
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(${bootstrapLockKey})`);
    // Chỉ tài khoản quản trị tập đoàn còn "Đã mời"; tài khoản đã kích hoạt dùng quên mật khẩu.
    const found = await transaction.execute<{ user_id: string; company_id: string | null }>(sql`
      SELECT u.id AS user_id, (SELECT m.company_id FROM core.user_company_memberships m WHERE m.user_id = u.id AND m.is_default LIMIT 1) AS company_id
      FROM core.users u
      WHERE lower(u.email::text) = ${adminEmail} AND u.status = 'invited'
        AND EXISTS (SELECT 1 FROM core.user_role_assignments a JOIN core.roles r ON r.id = a.role_id WHERE a.user_id = u.id AND r.code = 'group_admin' AND r.company_id IS NULL)`);
    const row = found.rows[0];
    if (!row) throw new Error("Không có tài khoản quản trị tập đoàn ở trạng thái Đã mời với email này: không cấp lại đường dẫn.");
    await audit.record({ actorUserId: null, companyId: row.company_id, appCode: "platform", action: "user.invitation.resend", entityType: "user", entityId: row.user_id }, transaction);
    const token = await issueActivationToken(transaction, row.user_id, now, null);
    return { companyId: row.company_id ?? "", userId: row.user_id, activationLink: activationLinkFor(token), expiresAt: new Date(now.getTime() + activationHours * 3600 * 1000) };
  });
}

function readArguments(argv: string[]): { reissue: boolean; input: BootstrapInput } {
  const { values } = parseArgs({
    args: argv,
    options: {
      "reissue-link": { type: "boolean", default: false },
      "company-code": { type: "string" },
      "legal-name": { type: "string" },
      "short-name": { type: "string" },
      "tax-code": { type: "string" },
      "admin-email": { type: "string" },
      "admin-name": { type: "string" },
    },
    strict: true,
  });
  return {
    reissue: values["reissue-link"] ?? false,
    input: {
      company: { code: values["company-code"] ?? "", legalName: values["legal-name"] ?? "", shortName: values["short-name"] ?? "", taxCode: values["tax-code"] || null },
      admin: { email: values["admin-email"] ?? "", fullName: values["admin-name"] ?? "" },
    },
  };
}

// Lỗi kiểm tra dữ liệu: chỉ nêu trường sai, không in giá trị.
export function describeError(error: unknown): string {
  const issues = (error as { issues?: { path: PropertyKey[] }[] }).issues;
  if (Array.isArray(issues)) return `Tham số không hợp lệ: ${issues.map((issue) => issue.path.join(".")).join(", ")}.`;
  return (error as Error).message;
}

export async function runBootstrapCommand(argv: string[], pool: Pool, write: (line: string) => void): Promise<void> {
  const { reissue, input } = readArguments(argv);
  const result = reissue ? await reissueActivationLink(pool, input.admin.email) : await bootstrapOrganization(pool, input);
  write(reissue ? "Đã cấp lại đường dẫn kích hoạt; đường dẫn cũ hết hiệu lực." : `Đã tạo tập đoàn ${input.company.code} và tài khoản quản trị tập đoàn ${input.admin.email} (trạng thái Đã mời).`);
  write(`Đường dẫn kích hoạt dùng một lần, hết hạn lúc ${result.expiresAt.toISOString()} (${activationHours} giờ). Chỉ hiển thị lần này, không được lưu lại:`);
  write(result.activationLink);
}

if (require.main === module) {
  let pool: Pool | undefined;
  Promise.resolve()
    .then(() => {
      pool = createPool();
      return runBootstrapCommand(process.argv.slice(2), pool, (line) => console.log(line));
    })
    .catch((error: unknown) => {
      console.error(describeError(error));
      process.exitCode = 1;
    })
    .finally(() => pool?.end());
}
