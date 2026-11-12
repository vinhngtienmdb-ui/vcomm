// Cửa hàng, quầy thu ngân (CONG_VIEC_53; CHUC_NANG_186; QUYTAC_NGHIEPVU_368; API_192).
import { Inject, Injectable } from "@nestjs/common";
import type {
  RetailRegionItem,
  RetailRegisterResponse,
  RetailSetupOptions,
  RetailStationResponse,
  RetailStoreResponse,
  saveRetailRegisterSchema,
  saveRetailStationSchema,
  saveRetailStoreSchema,
} from "contracts";
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
type StationInput = z.output<typeof saveRetailStationSchema>;

type StoreRow = {
  id: string;
  kind: "store" | "pickup_point";
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
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  display_name: string | null;
  province_code: string | null;
  province_name: string | null;
  ward_code: string | null;
  ward_name: string | null;
  street_address: string | null;
  station_phone: string | null;
  opening_hours: string | null;
  hold_days: number;
  delivery_fee: string;
  free_delivery_threshold: string | null;
  station_version: number;
  is_marketplace_operator: boolean;
};

export type RetailStore = StoreRow;

const storeSelect = sql`
  SELECT s.id, s.kind, s.company_id, s.branch_id, b.code AS branch_code, b.name AS branch_name, b.address AS branch_address, b.phone AS branch_phone,
    s.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name, s.channel_id, ch.code AS channel_code, ch.name AS channel_name,
    s.cash_fund_id, cf.code AS cash_fund_code, cf.name AS cash_fund_name, s.bank_fund_id, bf.code AS bank_fund_code, bf.name AS bank_fund_name, bf.bank_name, bf.account_no,
    s.vietqr_bank_bin, s.vietqr_account_name, s.return_days, s.receipt_footer, s.status, s.version,
    s.pickup_enabled, s.delivery_enabled, s.display_name, s.province_code, pv.name AS province_name, s.ward_code, wd.name AS ward_name, s.street_address,
    s.phone AS station_phone, s.opening_hours, s.hold_days, s.delivery_fee::text, s.free_delivery_threshold::text, s.station_version, c.is_marketplace_operator
  FROM retail.stores s
  JOIN core.companies c ON c.id = s.company_id
  LEFT JOIN marketplace.provinces pv ON pv.code = s.province_code
  LEFT JOIN marketplace.wards wd ON wd.code = s.ward_code
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

  // Xã trạm giao của từng cửa hàng (QUYTAC_NGHIEPVU_420).
  private async deliveryWards(executor: Executor, storeIds: string[]): Promise<Map<string, RetailStationResponse["deliveryWards"]>> {
    const result = new Map<string, RetailStationResponse["deliveryWards"]>();
    if (storeIds.length === 0) return result;
    const rows = await executor.execute<{ store_id: string; code: string; name: string; province_code: string; province_name: string }>(sql`
      SELECT sw.store_id, w.code, w.name, p.code AS province_code, p.name AS province_name
      FROM retail.station_wards sw JOIN marketplace.wards w ON w.code = sw.ward_code JOIN marketplace.provinces p ON p.code = w.province_code
      WHERE sw.store_id IN (${sql.join(
        storeIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
      ORDER BY p.name, w.name`);
    for (const row of rows.rows) result.set(row.store_id, [...(result.get(row.store_id) ?? []), { code: row.code, name: row.name, provinceCode: row.province_code, provinceName: row.province_name }]);
    return result;
  }

  private station(row: StoreRow, deliveryWards: RetailStationResponse["deliveryWards"]): RetailStationResponse {
    return {
      pickupEnabled: row.pickup_enabled,
      deliveryEnabled: row.delivery_enabled,
      displayName: row.display_name,
      province: row.province_code ? { code: row.province_code, name: row.province_name! } : null,
      ward: row.ward_code ? { code: row.ward_code, name: row.ward_name! } : null,
      streetAddress: row.street_address,
      phone: row.station_phone,
      openingHours: row.opening_hours,
      holdDays: row.hold_days,
      deliveryFee: row.delivery_fee,
      freeDeliveryThreshold: row.free_delivery_threshold,
      deliveryWards,
      version: row.station_version,
    };
  }

  private toResponse(row: StoreRow, registers: RetailRegisterResponse[], deliveryWards: RetailStationResponse["deliveryWards"], currency: string, canSetup: boolean): RetailStoreResponse {
    return {
      id: row.id,
      kind: row.kind,
      station: this.station(row, deliveryWards),
      isMarketplaceOperator: row.is_marketplace_operator,
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
    const ids = rows.map((row) => row.id);
    const [registers, wards] = await Promise.all([this.registers(this.database, ids), this.deliveryWards(this.database, ids)]);
    const currency = await companyCurrency(this.database, actor.companyId);
    return rows.map((row) => this.toResponse(row, registers.get(row.id) ?? [], wards.get(row.id) ?? [], currency, canSetup));
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
      // Chi nhánh loại "Khác" chỉ dùng cho điểm giao nhận (QUYTAC_NGHIEPVU_418).
      this.database.execute<{ id: string; code: string; name: string; branch_type: "store" | "other"; has_store: boolean }>(sql`
        SELECT b.id, b.code, b.name, b.branch_type, EXISTS (SELECT 1 FROM retail.stores s WHERE s.branch_id = b.id) AS has_store
        FROM core.branches b WHERE b.company_id = ${companyId} AND b.branch_type IN ('store', 'other') AND b.status = 'active' ORDER BY b.code`),
      this.database.execute<{ id: string; code: string; name: string; branch_id: string }>(sql`
        SELECT w.id, w.code, w.name, w.branch_id FROM inventory.warehouses w
        JOIN core.branches b ON b.id = w.branch_id AND b.branch_type IN ('store', 'other')
        WHERE w.company_id = ${companyId} AND w.status = 'active' AND NOT w.uses_locations
          AND EXISTS (SELECT 1 FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id AND o.company_id = ${companyId})
        ORDER BY w.code`),
      this.database.execute<{ id: string; code: string; name: string }>(sql`
        SELECT id, code, name FROM catalog.sales_channels WHERE company_id = ${companyId} AND status = 'active' AND code <> 'NOI_BO' ORDER BY code`),
      this.database.execute<{ id: string; code: string; name: string; kind: "cash" | "bank"; bank_name: string | null; account_no: string | null }>(sql`
        SELECT id, code, name, kind, bank_name, account_no FROM finance.funds WHERE company_id = ${companyId} AND status = 'active' ORDER BY code`),
    ]);
    return {
      branches: branches.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, branchType: row.branch_type, hasStore: row.has_store })),
      warehouses: warehouses.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, branchId: row.branch_id })),
      channels: channels.rows,
      cashFunds: funds.rows.filter((row) => row.kind === "cash").map((row) => ({ id: row.id, code: row.code, name: row.name })),
      bankFunds: funds.rows.filter((row) => row.kind === "bank").map((row) => ({ id: row.id, code: row.code, name: row.name, bankName: row.bank_name, accountNo: row.account_no })),
    };
  }

  // Kiểm điều kiện cửa hàng (QUYTAC_NGHIEPVU_368); điểm giao nhận gắn được chi nhánh loại "Khác" (QUYTAC_NGHIEPVU_418).
  private async validate(executor: Executor, companyId: string, input: StoreInput, exceptId: string | null): Promise<void> {
    const fields: Record<
      string,
      "retailBranchNotStore" | "retailBranchNotStation" | "retailBranchHasStore" | "retailWarehouseNotInBranch" | "retailChannelInvalid" | "retailFundInvalid" | "required"
    > = {};
    const branch = (
      await executor.execute<{ ok: boolean; taken: boolean }>(sql`
      SELECT (b.status = 'active' AND (b.branch_type = 'store' OR (${input.kind} = 'pickup_point' AND b.branch_type = 'other'))) AS ok,
        EXISTS (SELECT 1 FROM retail.stores s WHERE s.branch_id = b.id AND s.id IS DISTINCT FROM ${exceptId}::uuid) AS taken
      FROM core.branches b WHERE b.id = ${input.branchId} AND b.company_id = ${companyId}`)
    ).rows[0];
    if (!branch?.ok) fields.branchId = input.kind === "pickup_point" ? "retailBranchNotStation" : "retailBranchNotStore";
    else if (branch.taken) fields.branchId = "retailBranchHasStore";
    const warehouse = await executor.execute(sql`
      SELECT 1 FROM inventory.warehouses w
      WHERE w.id = ${input.warehouseId} AND w.branch_id = ${input.branchId} AND w.status = 'active' AND NOT w.uses_locations
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
        INSERT INTO retail.stores (kind, company_id, branch_id, warehouse_id, channel_id, cash_fund_id, bank_fund_id, vietqr_bank_bin, vietqr_account_name, return_days, receipt_footer, status, created_by)
        VALUES (${input.kind}, ${actor.companyId}, ${input.branchId}, ${input.warehouseId}, ${input.channelId}, ${input.cashFundId}, ${values.bankFundId}, ${values.bin}, ${values.accountName},
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
      // Ca đang mở dùng kho, kênh giá, quỹ của cửa hàng đến khi đóng ca (chứng từ quỹ lập theo quỹ của cửa hàng).
      if (
        input.status === "inactive" ||
        input.warehouseId !== before.warehouse_id ||
        input.branchId !== before.branch_id ||
        input.channelId !== before.channel_id ||
        input.cashFundId !== before.cash_fund_id ||
        (input.bankFundId ?? null) !== before.bank_fund_id
      ) {
        const open = await transaction.execute(sql`SELECT 1 FROM retail.shifts WHERE store_id = ${id} AND status = 'open' LIMIT 1`);
        if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "retailStoreHasOpenShift");
      }
      const values = this.storeValues(input);
      await transaction.execute(sql`
        UPDATE retail.stores SET kind = ${input.kind}, branch_id = ${input.branchId}, warehouse_id = ${input.warehouseId}, channel_id = ${input.channelId}, cash_fund_id = ${input.cashFundId},
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

  // Cài đặt trạm giao hàng O2O (API_220; QUYTAC_NGHIEPVU_418, 419, 420).
  async saveStation(actor: Actor, id: string, input: StationInput): Promise<RetailStoreResponse> {
    await requireRetailSetup(this.permissionService, actor);
    await this.database.transaction(async (transaction) => {
      const before = await this.store(transaction, actor.companyId, id, true);
      if (before.station_version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const enabled = input.pickupEnabled || input.deliveryEnabled;
      // Chỉ công ty vận hành sàn VComm có trạm (quyết định người dùng 2026-11-11).
      if (enabled && !before.is_marketplace_operator) throw new ApiError("BUSINESS_RULE", "retailStationNotOperator");
      const fields: Record<string, "required" | "invalidValue"> = {};
      if (enabled) {
        for (const key of ["displayName", "provinceCode", "wardCode", "streetAddress", "phone", "openingHours"] as const) if (input[key] === null) fields[key] = "required";
      }
      if (input.provinceCode !== null) {
        const province = await transaction.execute(sql`SELECT 1 FROM marketplace.provinces WHERE code = ${input.provinceCode}`);
        if (province.rows.length === 0) fields.provinceCode = "invalidValue";
        else if (input.wardCode !== null) {
          const ward = await transaction.execute(sql`SELECT 1 FROM marketplace.wards WHERE code = ${input.wardCode} AND province_code = ${input.provinceCode}`);
          if (ward.rows.length === 0) fields.wardCode = "invalidValue";
        }
      } else if (input.wardCode !== null) fields.wardCode = "invalidValue";
      const wardCodes = [...new Set(input.deliveryWardCodes)];
      if (wardCodes.length > 0) {
        const known = await transaction.execute<{ code: string }>(
          sql`SELECT code FROM marketplace.wards WHERE code IN (${sql.join(
            wardCodes.map((code) => sql`${code}`),
            sql`, `,
          )})`,
        );
        if (known.rows.length !== wardCodes.length) fields.deliveryWardCodes = "invalidValue";
      } else if (input.deliveryEnabled) fields.deliveryWardCodes = "required";
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      await transaction.execute(sql`
        UPDATE retail.stores SET pickup_enabled = ${input.pickupEnabled}, delivery_enabled = ${input.deliveryEnabled}, display_name = ${input.displayName},
          province_code = ${input.provinceCode}, ward_code = ${input.wardCode}, street_address = ${input.streetAddress}, phone = ${input.phone}, opening_hours = ${input.openingHours},
          hold_days = ${input.holdDays}, delivery_fee = ${input.deliveryFee}, free_delivery_threshold = ${input.freeDeliveryThreshold},
          updated_at = now(), station_version = station_version + 1
        WHERE id = ${id}`);
      await transaction.execute(sql`DELETE FROM retail.station_wards WHERE store_id = ${id}`);
      for (const code of wardCodes) await transaction.execute(sql`INSERT INTO retail.station_wards (store_id, ward_code) VALUES (${id}, ${code})`);
      await this.auditService.record(
        { ...retailAudit(actor, "retail_store"), action: "retail_store.station", entityId: id, beforeData: this.station(before, []), afterData: { ...input, deliveryWardCodes: wardCodes } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Danh mục tỉnh, xã của VComm cho cài đặt trạm.
  async provinces(actor: Actor): Promise<RetailRegionItem[]> {
    await requireRetailSetup(this.permissionService, actor);
    return (await this.database.execute<{ code: string; name: string }>(sql`SELECT code, name FROM marketplace.provinces ORDER BY name`)).rows;
  }

  async wards(actor: Actor, provinceCode: string): Promise<RetailRegionItem[]> {
    await requireRetailSetup(this.permissionService, actor);
    return (await this.database.execute<{ code: string; name: string }>(sql`SELECT code, name FROM marketplace.wards WHERE province_code = ${provinceCode} ORDER BY name`)).rows;
  }

  private async registerCodeFree(executor: Executor, storeId: string, code: string, exceptId: string | null): Promise<void> {
    const taken = await executor.execute(sql`SELECT 1 FROM retail.registers WHERE store_id = ${storeId} AND code = ${code} AND id IS DISTINCT FROM ${exceptId}::uuid`);
    if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "retailRegisterCodeExists" } });
  }
}
