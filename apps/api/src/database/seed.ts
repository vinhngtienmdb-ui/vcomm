// Dữ liệu thử cho máy phát triển và kiểm thử (tài liệu 18 mục 5). Không chạy trên môi trường thật.
import * as argon2 from "argon2";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { syncPermissionCatalog } from "../permissions/permission-catalog";
import { createPool, type Database } from "./database.module";
import * as schema from "./schema";
import { roles } from "./schema";

export const testPassword = "MatKhauThu@2026";

export const testIds = {
  groupCompany: "00000000-0000-4000-8000-000000000001",
  retailCompany: "00000000-0000-4000-8000-000000000002",
  tradingCompany: "00000000-0000-4000-8000-000000000003",
  headOfficeBranch: "00000000-0000-4000-8000-000000000011",
  binhDuongWarehouse: "00000000-0000-4000-8000-000000000012",
  groupAdmin: "00000000-0000-4000-8000-000000000101",
  retailAdmin: "00000000-0000-4000-8000-000000000102",
  exchangeRateManager: "00000000-0000-4000-8000-000000000103",
  purchasingManager: "00000000-0000-4000-8000-000000000104",
  warehouseKeeper: "00000000-0000-4000-8000-000000000105",
  purchasingManagerRole: "00000000-0000-4000-8000-000000000201",
  warehouseKeeperRole: "00000000-0000-4000-8000-000000000202",
} as const;

async function systemRoleId(database: Database, code: string): Promise<string> {
  const result = await database.execute<{ id: string }>(sql`SELECT id FROM core.roles WHERE company_id IS NULL AND code = ${code}`);
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`Thiếu vai trò hệ thống ${code}.`);
  return id;
}

export async function seedTestData(pool: Pool): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Không nạp dữ liệu thử trên môi trường thật.");
  }
  const database = drizzle(pool, { schema });
  await syncPermissionCatalog(database);
  const passwordHash = await argon2.hash(testPassword, { type: argon2.argon2id });
  const id = testIds;
  const groupAdminRole = await systemRoleId(database, "group_admin");
  const companyAdminRole = await systemRoleId(database, "company_admin");
  const rateRole = await systemRoleId(database, "exchange_rate_manager");
  const employeeRole = await systemRoleId(database, "employee");

  await database.transaction(async (transaction) => {
    await transaction.execute(sql`
      INSERT INTO core.companies (id, parent_id, code, legal_name, short_name, tax_code) VALUES
        (${id.groupCompany}, NULL, 'VCG', 'Công ty Cổ phần Tập đoàn VComm', 'Tập đoàn VComm', '0300000001'),
        (${id.retailCompany}, ${id.groupCompany}, 'VCR', 'Công ty Cổ phần VComm Bán lẻ Miền Nam', 'VComm Bán lẻ Miền Nam', '0312345678'),
        (${id.tradingCompany}, ${id.groupCompany}, 'VCT', 'Công ty TNHH VComm Thương mại và Dịch vụ Xuất nhập khẩu Miền Bắc', 'VComm Thương mại', '0109876543')
      ON CONFLICT (id) DO NOTHING`);
    await transaction.execute(sql`
      INSERT INTO core.branches (id, company_id, code, name, branch_type, province_code) VALUES
        (${id.headOfficeBranch}, ${id.retailCompany}, 'VCR-HCM', 'Trụ sở Thành phố Hồ Chí Minh', 'head_office', '79'),
        (${id.binhDuongWarehouse}, ${id.retailCompany}, 'VCR-BD', 'Kho tổng Bình Dương', 'warehouse', '74')
      ON CONFLICT (id) DO NOTHING`);

    const people: { userId: string; email: string; fullName: string; companies: string[] }[] = [
      { userId: id.groupAdmin, email: "quantri.tapdoan@vcomm.test", fullName: "Nguyễn Thị Hồng Nhung", companies: [id.groupCompany, id.retailCompany, id.tradingCompany] },
      { userId: id.retailAdmin, email: "quantri.vcr@vcomm.test", fullName: "Trần Minh Quân", companies: [id.retailCompany] },
      { userId: id.exchangeRateManager, email: "tygia@vcomm.test", fullName: "Phạm Thu Trang", companies: [id.groupCompany] },
      { userId: id.purchasingManager, email: "phuc.le@vcomm.test", fullName: "Lê Văn Phúc", companies: [id.retailCompany, id.tradingCompany] },
      { userId: id.warehouseKeeper, email: "thukho.bd@vcomm.test", fullName: "Trần Văn Bảo Long Nguyễn Hoàng", companies: [id.retailCompany] },
    ];
    for (const person of people) {
      // Xác thực hai lớp bắt buộc (QUYTAC_NGHIEPVU_09) được bật ở lát L5; dữ liệu thử L1 để tắt.
      await transaction.execute(sql`
        INSERT INTO core.users (id, email, full_name, status) VALUES (${person.userId}, ${person.email}, ${person.fullName}, 'active')
        ON CONFLICT (id) DO NOTHING`);
      await transaction.execute(sql`
        INSERT INTO core.user_identities (user_id, provider, provider_subject, password_hash)
        VALUES (${person.userId}, 'password', ${person.email}, ${passwordHash})
        ON CONFLICT (provider, provider_subject) DO UPDATE SET password_hash = EXCLUDED.password_hash`);
      for (const [index, companyId] of person.companies.entries()) {
        await transaction.execute(sql`
          INSERT INTO core.user_company_memberships (user_id, company_id, is_default)
          VALUES (${person.userId}, ${companyId}, ${index === 0})
          ON CONFLICT (user_id, company_id) DO NOTHING`);
      }
    }

    // Chi nhánh mặc định trong công ty, dùng để lọc dữ liệu theo phạm vi chi nhánh (QUYTAC_NGHIEPVU_12).
    await transaction.execute(sql`
      UPDATE core.user_company_memberships m SET default_branch_id = v.branch_id::uuid
      FROM (VALUES
        (${id.retailAdmin}::uuid, ${id.headOfficeBranch}),
        (${id.purchasingManager}::uuid, ${id.headOfficeBranch}),
        (${id.warehouseKeeper}::uuid, ${id.binhDuongWarehouse})
      ) AS v(user_id, branch_id)
      WHERE m.user_id = v.user_id AND m.company_id = ${id.retailCompany}`);

    // Vai trò riêng công ty VCR để thử trang chủ theo quyền.
    await transaction
      .insert(roles)
      .values([
        { id: id.purchasingManagerRole, companyId: id.retailCompany, code: "purchasing_manager", nameVi: "Trưởng phòng mua hàng", nameEn: "Purchasing manager", isSystem: false, status: "active" },
        { id: id.warehouseKeeperRole, companyId: id.retailCompany, code: "warehouse_keeper", nameVi: "Thủ kho", nameEn: "Warehouse keeper", isSystem: false, status: "active" },
      ])
      .onConflictDoNothing();
    await transaction.execute(sql`
      INSERT INTO core.role_permissions (role_id, permission_code) VALUES
        (${id.purchasingManagerRole}, 'purchasing.access'), (${id.purchasingManagerRole}, 'catalog.access'), (${id.purchasingManagerRole}, 'inventory.access'),
        (${id.warehouseKeeperRole}, 'inventory.access')
      ON CONFLICT DO NOTHING`);

    await transaction.execute(sql`DELETE FROM core.user_role_assignments WHERE user_id IN (${sql.join(people.map((person) => sql`${person.userId}`), sql`, `)})`);
    await transaction.execute(sql`
      INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES
        (${id.groupAdmin}, ${groupAdminRole}, 'group', NULL, NULL, '2026-01-01'),
        (${id.retailAdmin}, ${companyAdminRole}, 'company', ${id.retailCompany}, NULL, '2026-01-01'),
        (${id.exchangeRateManager}, ${rateRole}, 'group', NULL, NULL, '2026-01-01'),
        (${id.purchasingManager}, ${employeeRole}, 'company', ${id.retailCompany}, NULL, '2026-01-01'),
        (${id.purchasingManager}, ${id.purchasingManagerRole}, 'company', ${id.retailCompany}, NULL, '2026-01-01'),
        (${id.purchasingManager}, ${employeeRole}, 'company', ${id.tradingCompany}, NULL, '2026-01-01'),
        (${id.warehouseKeeper}, ${employeeRole}, 'branch', ${id.retailCompany}, ${id.binhDuongWarehouse}, '2026-01-01'),
        (${id.warehouseKeeper}, ${id.warehouseKeeperRole}, 'branch', ${id.retailCompany}, ${id.binhDuongWarehouse}, '2026-01-01')`);
  });
}

if (require.main === module) {
  const pool = createPool();
  seedTestData(pool)
    .then(() => console.log("Đã nạp dữ liệu thử."))
    .catch((error: Error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
