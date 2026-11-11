// Dữ liệu thử dùng chung cho kiểm thử bán lẻ tại quầy (CONG_VIEC_53): chi nhánh cửa hàng, kho bán, kênh, quỹ, nhân viên theo vai trò.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { expect } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";

export const retail: string = testIds.retailCompany;

export interface RetailFixture {
  admin: Session;
  storeBranch: string;
  otherStoreBranch: string;
  warehouseId: string;
  otherBranchWarehouse: string;
  retailChannel: string;
  internalChannel: string;
  cashFund: string;
  bankFund: string;
}

export async function assignRetailRole(application: NestExpressApplication, pool: Pool, email: string, name: string, role: string, branchId: string | null, companyId = retail): Promise<Session> {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId: branchId ?? undefined }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    companyId,
    branchId,
  ]);
  return signIn(application, email);
}

export async function createRetailFixture(application: NestExpressApplication, pool: Pool): Promise<RetailFixture> {
  const admin = await signIn(application, "quantri.vcr@vcomm.test");
  const branch = async (code: string, name: string) =>
    (
      await pool.query<{ id: string }>(
        "INSERT INTO core.branches (company_id, code, name, branch_type, province_code, address, phone) VALUES ($1, $2, $3, 'store', '79', '12 Võ Văn Ngân, Thủ Đức', '02838960000') RETURNING id",
        [retail, code, name],
      )
    ).rows[0]!.id;
  const storeBranch = await branch("VCR-TD", "Cửa hàng Thủ Đức");
  const otherStoreBranch = await branch("VCR-Q1", "Cửa hàng Quận 1");
  const warehouse = async (branchId: string, code: string) => {
    const created = await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId, code, name: `Kho ${code}`, usesLocations: false } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  const warehouseId = await warehouse(storeBranch, "KTD");
  const otherBranchWarehouse = await warehouse(otherStoreBranch, "KQ1");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  const fund = async (body: Record<string, unknown>) => {
    const created = await admin.call("post", "/finance/funds", { companyId: retail, body });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  const cashFund = await fund({ code: "TMTD", name: "Tiền mặt Cửa hàng Thủ Đức", kind: "cash" });
  const bankFund = await fund({ code: "NHTD", name: "Vietcombank Thủ Đức", kind: "bank", bankName: "Vietcombank", accountNo: "0123456789", accountHolder: "VComm Bán lẻ" });
  return {
    admin,
    storeBranch,
    otherStoreBranch,
    warehouseId,
    otherBranchWarehouse,
    retailChannel: channels.find((channel) => channel.code === "BAN_LE")!.id,
    internalChannel: channels.find((channel) => channel.code === "NOI_BO")!.id,
    cashFund,
    bankFund,
  };
}

export const storeBody = (fixture: RetailFixture, extra: Record<string, unknown> = {}) => ({
  branchId: fixture.storeBranch,
  warehouseId: fixture.warehouseId,
  channelId: fixture.retailChannel,
  cashFundId: fixture.cashFund,
  bankFundId: fixture.bankFund,
  vietqrBankBin: "970436",
  vietqrAccountName: "CONG TY VCOMM BAN LE",
  returnDays: 7,
  receiptFooter: "Đổi trả trong 7 ngày kèm hóa đơn này.",
  ...extra,
});
