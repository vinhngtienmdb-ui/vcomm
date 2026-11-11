// Cửa hàng, quầy thu ngân (CONG_VIEC_53; CHUC_NANG_186; QUYTAC_NGHIEPVU_368; API_192).
import { Inject, Injectable } from "@nestjs/common";
import type { RetailRegisterResponse, RetailSetupOptions, RetailStoreResponse, saveRetailRegisterSchema, saveRetailStoreSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "../finance/debts.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import { requireRetailSetup, retailAudit, retailPermissions, retailScope, scopeCondition } from "./retail-context";

type StoreInput = z.output<typeof saveRetailStoreSchema>;
type RegisterInput = z.output<typeof saveRetailRegisterSchema>;

type StoreRow = {
  id: string;
  company_id: string;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  branch_address: string | null;
  branch_phone: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  channel_id: string;
  channel_code: string;
  channel_name: string;
  cash_fund_id: string;
  cash_fund_code: string;
  cash_fund_name: string;
  bank_fund_id: string | null;
  bank_fund_code: string | null;
  bank_fund_name: string | null;
  bank_name: string | null;
  account_no: string | null;
  vietqr_bank_bin: string | null;
  vietqr_account_name: string | null;
  return_days: number;
  receipt_footer: string | null;
  status: "active" | "inactive";
  version: number;
};

export type RetailStore = StoreRow;

const storeSelect = sql`
  SELECT s.id, s.company_id, s.branch_id, b.code AS branch_code, b.name AS branch_name, b.address AS branch_address, b.phone AS branch_phone,
    s.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, s.channel_id, ch.code AS channel_code, ch.name AS channel_name,
    s.cash_fund_id, cf.code AS cash_fund_code, cf.name AS cash_fund_name, s.bank_fund_id, bf.code AS bank_fund_code, bf.name AS bank_fund_name, bf.bank_name, bf.account_no,
    s.vietqr_bank_bin, s.vietqr_account_name, s.return_days, s.receipt_footer, s.status, s.version
  FROM retail.stores s
  JOIN core.branches b ON b.id = s.branch_id
  JOIN inventory.warehouses w ON w.id = s.warehouse_id
  JOIN catalog.sales_channels ch ON ch.id = s.channel_id
  JOIN finance.funds cf ON cf.id = s.cash_fund_id
  LEFT JOIN finance.funds bf ON bf.id = s.bank_fund_id`;

@Injectable()
export class RetailStoresService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Cửa hàng của công ty, khóa dòng khi cần (dùng chung cho ca, bán hàng).
  async store(executor: Executor, companyId: string, id: string, lock = false): Promise<RetailStore> {
    const row = (await executor.execute<StoreRow>(sql`${storeSelect} WHERE s.company_id = ${companyId} AND s.id = ${id} ${lock ? sql`FOR UPDATE OF s` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async registers(executor: Executor, storeIds: string[]): Promise<Map<string, RetailRegisterResponse[]>> {
    const result = new Map<string, RetailRegisterResponse[]>();
    if (storeIds.length === 0) return result;
    const rows = await executor.execute<{
      store_id: string;
      id: string;
      code: string;
      name: string;
      status: "active" | "inactive";
      version: number;
      shift_id: string | null;
      cashier_name: string | null;
      opened_at: Date | null;
    }>(sql`
      SELECT r.store_id, r.id, r.code, r.name, r.status, r.version, sh.id AS shift_id, u.full_name AS cashier_name, sh.opened_at
      FROM retail.registers r
      LEFT JOIN retail.shifts sh ON sh.register_id = r.id AND sh.status = 'open'
      LEFT JOIN core.users u ON u.id = sh.cashier_id
      WHERE r.store_id IN (${sql.join(
        storeIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
      ORDER BY r.code`);
    for (const row of rows.rows) {
      const list = result.get(row.store_id) ?? [];
      list.push({
        id: row.id,
        code: row.code,
        name: row.name,
        status: row.status,
        openShift: row.shift_id ? { id: row.shift_id, cashierName: row.cashier_name!, openedAt: new Date(row.opened_at!).toISOString() } : null,
        version: row.version,
      });
      result.set(row.store_id, list);
    }
    return result;
  }

  private toResponse(row: StoreRow, registers: RetailRegisterResponse[], currency: string, canSetup: boolean): RetailStoreResponse {
    return {
      id: row.id,
      branch: { id: row.branch_id, code: row.branch_code, name: row.branch_name, address: row.branch_address, phone: row.branch_phone },
      warehouse: { id: row.warehouse_id, code: row.warehouse_code, name: row.warehouse_name },
      channel: { id: row.channel_id, code: row.channel_code, name: row.channel_name },
      cashFund: { id: row.cash_fund_id, code: row.cash_fund_code, name: row.cash_fund_name },
      bankFund: row.bank_fund_id ? { id: row.bank_fund_id, code: row.bank_fund_code!, name: row.bank_fund_name!, bankName: row.bank_name, accountNo: row.account_no } : null,
      vietqrBankBin: row.vietqr_bank_bin,
      vietqrAccountName: row.vietqr_account_name,
      returnDays: row.return_days,
      receiptFooter: row.receipt_footer,
      status: row.status,
      currency,
      registers,
      version: row.version,
      canSetup,
    };
  }

  private async canSetup(actor: Actor): Promise<boolean> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    return granted.has(retailPermissions.setup);
  }

  // Danh sách cửa hàng: người cài đặt thấy mọi cửa hàng; người bán, quản lý ca thấy cửa hàng trong phạm vi chi nhánh.
  async list(actor: Actor): Promise<RetailStoreResponse[]> {
    const canSetup = await this.canSetup(actor);
    let condition = sql`TRUE`;
    if (!canSetup) {
      const sale = await retailScope(this.permissionService, actor, retailPermissions.sale);
      const manage = await retailScope(this.permissionService, actor, retailPermissions.manageShifts);
      if (!sale && !manage) throw new ApiError("FORBIDDEN", "forbidden");
      condition = sql`(${scopeCondition(sale, sql`s.branch_id`)} OR ${scopeCondition(manage, sql`s.branch_id`)})`;
    }
    const rows = (await this.database.execute<StoreRow>(sql`${storeSelect} WHERE s.company_id = ${actor.companyId} AND ${condition} ORDER BY s.status, b.code`)).rows;
    const registers = await this.registers(
      this.database,
      rows.map((row) => row.id),
    );
    const currency = await companyCurrency(this.database, actor.companyId);
    return rows.map((row) => this.toResponse(row, registers.get(row.id) ?? [], currency, canSetup));
  }

  async detail(actor: Actor, id: string): Promise<RetailStoreResponse> {
    const stores = await this.list(actor);
    const found = stores.find((store) => store.id === id);
    if (!found) throw new ApiError("NOT_FOUND", "notFound");
    return found;
  }

  async options(actor: Actor): Promise<RetailSetupOptions> {
    await requireRetailSetup(this.permissionService, actor);
    const companyId = actor.companyId;
    const [branches, warehouses, channels, funds] = await Promise.all([
      this.database.execute<{ id: string; code: string; name: string; has_store: boolean }>(sql`
        SELECT b.id, b.code, b.name, EXISTS (SELECT 1 FROM retail.stores s WHERE s.branch_id = b.id) AS has_store
        FROM core.branches b WHERE b.company_id = ${companyId} AND b.branch_type = 'store' AND b.status = 'active' ORDER BY b.code`),
      this.database.execute<{ id: string; code: string; name: string; branch_id: string }>(sql`
        SELECT w.id, w.code, w.name, w.branch_id FROM inventory.warehouses w
        JOIN core.branches b ON b.id = w.branch_id AND b.branch_type = 'store'
        WHERE w.company_id = ${companyId} AND w.status = 'active'
          AND EXISTS (SELECT 1 FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id AND o.company_id = ${companyId})
        ORDER BY w.code`),
      this.database.execute<{ id: string; code: string; name: string }>(sql`
        SELECT id, code, name FROM catalog.sales_channels WHERE company_id = ${companyId} AND status = 'active' AND code <> 'NOI_BO' ORDER BY code`),
      this.database.execute<{ id: string; code: string; name: string; kind: "cash" | "bank"; bank_name: string | null; account_no: string | null }>(sql`
        SELECT id, code, name, kind, bank_name, account_no FROM finance.funds WHERE company_id = ${companyId} AND status = 'active' ORDER BY code`),
    ]);
    return {
      branches: branches.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, hasStore: row.has_store })),
      warehouses: warehouses.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, branchId: row.branch_id })),
      channels: channels.rows,
      cashFunds: funds.rows.filter((row) => row.kind === "cash").map((row) => ({ id: row.id, code: row.code, name: row.name })),
      bankFunds: funds.rows.filter((row) => row.kind === "bank").map((row) => ({ id: row.id, code: row.code, name: row.name, bankName: row.bank_name, accountNo: row.account_no })),
    };
  }

  // Kiểm điều kiện cửa hàng (QUYTAC_NGHIEPVU_368).
  private async validate(executor: Executor, companyId: string, input: StoreInput, exceptId: string | null): Promise<void> {
    const fields: Record<string, "retailBranchNotStore" | "retailBranchHasStore" | "retailWarehouseNotInBranch" | "retailChannelInvalid" | "retailFundInvalid" | "required"> = {};
    const branch = (
      await executor.execute<{ ok: boolean; taken: boolean }>(sql`
      SELECT (b.branch_type = 'store' AND b.status = 'active') AS ok,
        EXISTS (SELECT 1 FROM retail.stores s WHERE s.branch_id = b.id AND s.id IS DISTINCT FROM ${exceptId}::uuid) AS taken
      FROM core.branches b WHERE b.id = ${input.branchId} AND b.company_id = ${companyId}`)
    ).rows[0];
    if (!branch?.ok) fields.branchId = "retailBranchNotStore";
    else if (branch.taken) fields.branchId = "retailBranchHasStore";
    const warehouse = await executor.execute(sql`
      SELECT 1 FROM inventory.warehouses w
      WHERE w.id = ${input.warehouseId} AND w.branch_id = ${input.branchId} AND w.status = 'active'
        AND EXISTS (SELECT 1 FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id AND o.company_id = ${companyId})`);
    if (warehouse.rows.length === 0) fields.warehouseId = "retailWarehouseNotInBranch";
    const channel = await executor.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE id = ${input.channelId} AND company_id = ${companyId} AND status = 'active' AND code <> 'NOI_BO'`);
    if (channel.rows.length === 0) fields.channelId = "retailChannelInvalid";
    const fundOk = async (fundId: string, kind: "cash" | "bank") =>
      (await executor.execute(sql`SELECT 1 FROM finance.funds WHERE id = ${fundId} AND company_id = ${companyId} AND kind = ${kind} AND status = 'active'`)).rows.length > 0;
    if (!(await fundOk(input.cashFundId, "cash"))) fields.cashFundId = "retailFundInvalid";
    if (input.bankFundId) {
      if (!(await fundOk(input.bankFundId, "bank"))) fields.bankFundId = "retailFundInvalid";
      if (!input.vietqrBankBin) fields.vietqrBankBin = "required";
      if (!input.vietqrAccountName) fields.vietqrAccountName = "required";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private storeValues(input: StoreInput) {
    const bank = input.bankFundId !== null;
    return {
      bankFundId: input.bankFundId,
      bin: bank ? input.vietqrBankBin : null,
      accountName: bank ? input.vietqrAccountName : null,
    };
  }

  async create(actor: Actor, input: StoreInput): Promise<RetailStoreResponse> {
    await requireRetailSetup(this.permissionService, actor);
    const id = await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input, null);
      const values = this.storeValues(input);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO retail.stores (company_id, branch_id, warehouse_id, channel_id, cash_fund_id, bank_fund_id, vietqr_bank_bin, vietqr_account_name, return_days, receipt_footer, status, created_by)
        VALUES (${actor.companyId}, ${input.branchId}, ${input.warehouseId}, ${input.channelId}, ${input.cashFundId}, ${values.bankFundId}, ${values.bin}, ${values.accountName},
          ${input.returnDays}, ${input.receiptFooter}, ${input.status}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...retailAudit(actor, "retail_store"), action: "retail_store.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: StoreInput): Promise<RetailStoreResponse> {
    await requireRetailSetup(this.permissionService, actor);
    await this.database.transaction(async (transaction) => {
      const before = await this.store(transaction, actor.companyId, id, true);
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validate(transaction, actor.companyId, input, id);
      if (input.status === "inactive" || input.warehouseId !== before.warehouse_id || input.branchId !== before.branch_id) {
        const open = await transaction.execute(sql`SELECT 1 FROM retail.shifts WHERE store_id = ${id} AND status = 'open' LIMIT 1`);
        if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "retailStoreHasOpenShift");
      }
      const values = this.storeValues(input);
      await transaction.execute(sql`
        UPDATE retail.stores SET branch_id = ${input.branchId}, warehouse_id = ${input.warehouseId}, channel_id = ${input.channelId}, cash_fund_id = ${input.cashFundId},
          bank_fund_id = ${values.bankFundId}, vietqr_bank_bin = ${values.bin}, vietqr_account_name = ${values.accountName}, return_days = ${input.returnDays},
          receipt_footer = ${input.receiptFooter}, status = ${input.status}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...retailAudit(actor, "retail_store"), action: "retail_store.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  async createRegister(actor: Actor, storeId: string, input: RegisterInput): Promise<RetailStoreResponse> {
    await requireRetailSetup(this.permissionService, actor);
    await this.database.transaction(async (transaction) => {
      await this.store(transaction, actor.companyId, storeId, true);
      await this.registerCodeFree(transaction, storeId, input.code, null);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO retail.registers (company_id, store_id, code, name, status) VALUES (${actor.companyId}, ${storeId}, ${input.code}, ${input.name}, ${input.status}) RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...retailAudit(actor, "retail_register"), action: "retail_register.create", entityId: created, afterData: { storeId, ...input } }, transaction);
    });
    return this.detail(actor, storeId);
  }

  async updateRegister(actor: Actor, id: string, input: RegisterInput): Promise<RetailStoreResponse> {
    await requireRetailSetup(this.permissionService, actor);
    const storeId = await this.database.transaction(async (transaction) => {
      const before = (
        await transaction.execute<{ store_id: string; code: string; name: string; status: string; version: number }>(sql`
        SELECT store_id, code, name, status, version FROM retail.registers WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.registerCodeFree(transaction, before.store_id, input.code, id);
      if (input.status === "inactive") {
        const open = await transaction.execute(sql`SELECT 1 FROM retail.shifts WHERE register_id = ${id} AND status = 'open'`);
        if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "retailStoreHasOpenShift");
      }
      await transaction.execute(sql`
        UPDATE retail.registers SET code = ${input.code}, name = ${input.name}, status = ${input.status}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...retailAudit(actor, "retail_register"), action: "retail_register.update", entityId: id, beforeData: before, afterData: input }, transaction);
      return before.store_id;
    });
    return this.detail(actor, storeId);
  }

  private async registerCodeFree(executor: Executor, storeId: string, code: string, exceptId: string | null): Promise<void> {
    const taken = await executor.execute(sql`SELECT 1 FROM retail.registers WHERE store_id = ${storeId} AND code = ${code} AND id IS DISTINCT FROM ${exceptId}::uuid`);
    if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "retailRegisterCodeExists" } });
  }
}
