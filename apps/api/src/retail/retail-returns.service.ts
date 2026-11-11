// Trả hàng theo hóa đơn bán lẻ (CONG_VIEC_53; CHUC_NANG_188; QUYTAC_NGHIEPVU_376, 377; API_197).
// Nhập lại kho bằng phiếu nhận hàng trả lại của module Kho (giá vốn lúc xuất); bút toán, việc chờ xử lý hóa đơn điện tử chạy qua móc nối ghi sổ phiếu kho.
import { Inject, Injectable } from "@nestjs/common";
import type { createRetailReturnSchema, RetailPaymentMethod, RetailReturnableResponse, RetailReturnQuoteResponse, retailReturnQuoteSchema, RetailReturnResponse } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "../finance/debts.service";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { retailAudit, retailPermissions, retailPermissionsAt } from "./retail-context";
import { RetailShiftsService, type RetailShift } from "./retail-shifts.service";

type QuoteInput = z.output<typeof retailReturnQuoteSchema>;
type ReturnInput = z.output<typeof createRetailReturnSchema>;

const returnTypeCode = "retail.return";

type SaleRow = {
  id: string;
  company_id: string;
  store_id: string;
  branch_id: string;
  document_no: string;
  sold_at: Date;
  sale_date: string;
  store_name: string;
  register_code: string;
  cashier_name: string;
  buyer_name: string | null;
  return_days: number;
  sales_order_id: string;
  stock_document_id: string;
};

type LineRow = {
  order_line_id: string;
  product_name: string;
  sku: string;
  unit_name: string;
  is_gift: boolean;
  tracks_serials: boolean;
  quantity: string;
  base_quantity: string;
  total: string;
  returned_base: string;
  returned_amount: string;
};

type PlannedLine = { orderLineId: string; baseQuantity: number; quantity: string; amount: number; serials: string[] };

@Injectable()
export class RetailReturnsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly shifts: RetailShiftsService,
    private readonly deliveries: SalesDeliveriesService,
  ) {}

  private async sale(executor: Executor, companyId: string, saleId: string, lock = false): Promise<SaleRow> {
    const row = (
      await executor.execute<SaleRow>(sql`
      SELECT s.id, s.company_id, s.store_id, st.branch_id, s.document_no, s.sold_at, s.sale_date::text, b.name AS store_name, r.code AS register_code, u.full_name AS cashier_name,
        s.buyer_name, st.return_days, s.sales_order_id, s.stock_document_id
      FROM retail.sales s JOIN retail.stores st ON st.id = s.store_id JOIN core.branches b ON b.id = st.branch_id JOIN retail.registers r ON r.id = s.register_id
        JOIN core.users u ON u.id = s.cashier_id
      WHERE s.company_id = ${companyId} AND s.id = ${saleId} ${lock ? sql`FOR UPDATE OF s` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async lines(executor: Executor, sale: SaleRow): Promise<LineRow[]> {
    return (
      await executor.execute<LineRow>(sql`
      SELECT l.id AS order_line_id, p.name AS product_name, v.sku, u.name_vi AS unit_name, l.is_gift, p.tracks_serials, l.quantity::text, l.base_quantity::text, l.total_amount::text AS total,
        coalesce((SELECT sum(rl.base_quantity) FROM retail.return_lines rl WHERE rl.order_line_id = l.id), 0)::text AS returned_base,
        coalesce((SELECT sum(rl.amount) FROM retail.return_lines rl WHERE rl.order_line_id = l.id), 0)::text AS returned_amount
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.order_id = ${sale.sales_order_id} ORDER BY l.line_no`)
    ).rows;
  }

  // Serial đã bán của dòng đơn chưa trả lại.
  private async soldSerials(executor: Executor, sale: SaleRow, orderLineId: string): Promise<string[]> {
    return (
      await executor.execute<{ serial_no: string }>(sql`
      SELECT ds.serial_no FROM inventory.document_line_serials ds JOIN inventory.document_lines dl ON dl.id = ds.line_id
      WHERE dl.document_id = ${sale.stock_document_id} AND dl.source_line_id = ${orderLineId}
        AND NOT EXISTS (SELECT 1 FROM inventory.document_line_serials rs JOIN inventory.document_lines rl ON rl.id = rs.line_id JOIN inventory.documents r ON r.id = rl.document_id
                        WHERE rl.source_line_id = dl.id AND r.type = 'sales_return' AND r.status = 'posted' AND rs.serial_no = ds.serial_no)
      ORDER BY ds.serial_no`)
    ).rows.map((row) => row.serial_no);
  }

  private returnUntil(sale: SaleRow): string {
    const until = new Date(`${sale.sale_date}T00:00:00Z`);
    until.setUTCDate(until.getUTCDate() + sale.return_days);
    return until.toISOString().slice(0, 10);
  }

  // Hóa đơn trả được tại ca đang mở: cùng cửa hàng, trong hạn, cửa hàng có nhận trả (QUYTAC_NGHIEPVU_376).
  private blockedReason(sale: SaleRow, shift: RetailShift): RetailReturnableResponse["blockedReason"] {
    if (sale.store_id !== shift.store_id) return "otherStore";
    if (sale.return_days === 0) return "returnsDisabled";
    if (this.permissionService.today() > this.returnUntil(sale)) return "expired";
    return null;
  }

  private async openShift(executor: Executor, actor: Actor, shiftId: string): Promise<RetailShift> {
    return this.shifts.requireOwnOpenShift(executor, actor, shiftId, retailPermissions.return);
  }

  // Hóa đơn của cửa hàng khác: người trả không có quyền ở chi nhánh đó thì coi như không thấy.
  private async visibleSale(executor: Executor, actor: Actor, saleId: string): Promise<SaleRow> {
    const sale = await this.sale(executor, actor.companyId, saleId);
    const granted = await retailPermissionsAt(this.permissionService, actor, sale.branch_id);
    if (!granted.has(retailPermissions.return) && !granted.has(retailPermissions.sale)) throw new ApiError("NOT_FOUND", "notFound");
    return sale;
  }

  async returnable(actor: Actor, saleId: string, shiftId: string): Promise<RetailReturnableResponse> {
    return this.database.transaction(async (transaction) => {
      const shift = await this.openShift(transaction, actor, shiftId);
      const sale = await this.visibleSale(transaction, actor, saleId);
      const lines = await this.lines(transaction, sale);
      const result = [];
      for (const line of lines) {
        const factor = Number(line.base_quantity) / Number(line.quantity);
        const returned = Number(line.returned_base) / factor;
        result.push({
          orderLineId: line.order_line_id,
          productName: line.product_name,
          sku: line.sku,
          unitName: line.unit_name,
          isGift: line.is_gift,
          tracksSerials: line.tracks_serials,
          soldQuantity: trimDecimal(line.quantity),
          returnedQuantity: trimDecimal(returned.toFixed(4)),
          remainingQuantity: trimDecimal((Number(line.quantity) - returned).toFixed(4)),
          lineTotal: trimDecimal(line.total),
          serials: line.tracks_serials ? await this.soldSerials(transaction, sale, line.order_line_id) : [],
        });
      }
      return {
        saleId: sale.id,
        documentNo: sale.document_no,
        soldAt: new Date(sale.sold_at).toISOString(),
        storeName: sale.store_name,
        registerCode: sale.register_code,
        cashierName: sale.cashier_name,
        buyerName: sale.buyer_name,
        returnUntil: this.returnUntil(sale),
        blockedReason: this.blockedReason(sale, shift),
        lines: result,
        currency: await companyCurrency(transaction, actor.companyId),
      };
    });
  }

  // Tiền hoàn mỗi dòng = tiền dòng bán × số trả / số bán, làm tròn; trả hết dòng thì lấy phần còn lại (QUYTAC_NGHIEPVU_376).
  private async plan(executor: Executor, actor: Actor, sale: SaleRow, input: QuoteInput["lines"]): Promise<PlannedLine[]> {
    const units = Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${actor.companyId}) AS units`)).rows[0]!.units);
    const lines = new Map((await this.lines(executor, sale)).map((line) => [line.order_line_id, line]));
    const fields: Record<string, "invalidValue" | "salesReturnExceeded" | "retailSerialCount"> = {};
    const planned: PlannedLine[] = [];
    const seen = new Map<string, number>();
    for (const [index, item] of input.entries()) {
      const line = lines.get(item.orderLineId);
      if (!line) {
        fields[`lines.${index}.orderLineId`] = "invalidValue";
        continue;
      }
      const factor = Number(line.base_quantity) / Number(line.quantity);
      const baseQuantity = Number(item.quantity) * factor;
      const already = Number(line.returned_base) + (seen.get(item.orderLineId) ?? 0);
      seen.set(item.orderLineId, (seen.get(item.orderLineId) ?? 0) + baseQuantity);
      if (already + baseQuantity > Number(line.base_quantity) + 0.00005) {
        fields[`lines.${index}.quantity`] = "salesReturnExceeded";
        continue;
      }
      if (line.tracks_serials) {
        const sold = new Set(await this.soldSerials(executor, sale, item.orderLineId));
        if (item.serials.length !== baseQuantity || new Set(item.serials).size !== item.serials.length || item.serials.some((serial) => !sold.has(serial))) {
          fields[`lines.${index}.serials`] = "retailSerialCount";
          continue;
        }
      }
      const full = already + baseQuantity >= Number(line.base_quantity) - 0.00005;
      const amount = full ? Number(line.total) - Number(line.returned_amount) : Number(((Number(line.total) * baseQuantity) / Number(line.base_quantity)).toFixed(units));
      planned.push({ orderLineId: item.orderLineId, baseQuantity, quantity: item.quantity, amount: Math.max(0, amount), serials: item.serials });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return planned;
  }

  async quote(actor: Actor, input: QuoteInput): Promise<RetailReturnQuoteResponse> {
    return this.database.transaction(async (transaction) => {
      const shift = await this.openShift(transaction, actor, input.shiftId);
      const sale = await this.visibleSale(transaction, actor, input.saleId);
      const blocked = this.blockedReason(sale, shift);
      if (blocked) throw new ApiError("BUSINESS_RULE", blockedMessage[blocked]);
      const planned = await this.plan(transaction, actor, sale, input.lines);
      const goods = planned.reduce((sum, line) => sum + line.amount, 0);
      return {
        lines: planned.map((line) => ({ orderLineId: line.orderLineId, quantity: line.quantity, amount: trimDecimal(line.amount.toFixed(4)) })),
        goodsAmount: trimDecimal(goods.toFixed(4)),
        refundAmount: trimDecimal(goods.toFixed(4)),
        currency: await companyCurrency(transaction, actor.companyId),
      };
    });
  }

  // Phân dòng trả theo dòng phiếu xuất gốc (hàng theo lô có thể nhiều dòng phiếu cho một dòng đơn): theo serial nếu có, không thì lấp dần phần còn trả được.
  private async issueLines(executor: Executor, sale: SaleRow, planned: PlannedLine[]): Promise<{ issueLineId: string; quantity: string; serials: string[] }[]> {
    const result: { issueLineId: string; quantity: string; serials: string[] }[] = [];
    for (const line of planned) {
      const rows = (
        await executor.execute<{ id: string; remaining: string; serials: string[] }>(sql`
        SELECT dl.id, (abs(dl.base_quantity) - coalesce((SELECT sum(rl.base_quantity) FROM inventory.document_lines rl JOIN inventory.documents r ON r.id = rl.document_id
                         WHERE rl.source_line_id = dl.id AND r.type = 'sales_return' AND r.status = 'posted'), 0))::text AS remaining,
          array(SELECT ds.serial_no FROM inventory.document_line_serials ds WHERE ds.line_id = dl.id) AS serials
        FROM inventory.document_lines dl WHERE dl.document_id = ${sale.stock_document_id} AND dl.source_line_id = ${line.orderLineId} ORDER BY dl.line_no`)
      ).rows;
      if (line.serials.length > 0) {
        for (const row of rows) {
          const serials = line.serials.filter((serial) => row.serials.includes(serial));
          if (serials.length > 0) result.push({ issueLineId: row.id, quantity: String(serials.length), serials });
        }
        continue;
      }
      let needed = line.baseQuantity;
      for (const row of rows) {
        if (needed <= 0.00005) break;
        const taken = Math.min(needed, Number(row.remaining));
        if (taken <= 0.00005) continue;
        result.push({ issueLineId: row.id, quantity: taken.toFixed(4), serials: [] });
        needed -= taken;
      }
      if (needed > 0.00005) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { lines: "salesReturnExceeded" } });
    }
    return result;
  }

  // Ghi trả hàng (QUYTAC_NGHIEPVU_377): phiếu trả hàng bán lẻ, phiếu nhận hàng trả lại đã ghi sổ, cách hoàn; gửi lại cùng khóa không ghi trùng.
  async create(actor: Actor, input: ReturnInput): Promise<RetailReturnResponse> {
    await ensureSequence(this.database, this.sequences, actor, returnTypeCode, "TL");
    await this.deliveries.ensureSequences(actor, actor.companyId);
    const id = await this.database.transaction(async (transaction) => {
      const shift = await this.openShift(transaction, actor, input.shiftId);
      const existing = (await transaction.execute<{ id: string }>(sql`SELECT id FROM retail.returns WHERE register_id = ${shift.register_id} AND client_key = ${input.clientKey}`)).rows[0];
      if (existing) return existing.id;
      const sale = await this.visibleSale(transaction, actor, input.saleId);
      await this.sale(transaction, actor.companyId, sale.id, true);
      const blocked = this.blockedReason(sale, shift);
      if (blocked) throw new ApiError("BUSINESS_RULE", blockedMessage[blocked]);
      const planned = await this.plan(transaction, actor, sale, input.lines);
      const goods = Number(planned.reduce((sum, line) => sum + line.amount, 0).toFixed(4));
      if (Math.abs(goods - Number(input.expectedRefund)) > 0.00005) throw new ApiError("BUSINESS_RULE", "retailTotalChanged");
      const store = (await transaction.execute<{ cash_fund_id: string; bank_fund_id: string | null }>(sql`SELECT cash_fund_id, bank_fund_id FROM retail.stores WHERE id = ${shift.store_id}`)).rows[0]!;
      const fundId = input.refund.method === "cash" ? store.cash_fund_id : store.bank_fund_id;
      if (!fundId) throw new ApiError("BUSINESS_RULE", "retailNoBankFund");
      if (input.refund.method === "bank_transfer" && !input.refund.recipient) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { "refund.recipient": "required" } });
      // Hoàn tiền mặt không vượt tiền mặt đang có trong két theo hệ thống.
      if (input.refund.method === "cash" && goods > Number(await this.shifts.expectedCash(transaction, shift)) + 0.00005) throw new ApiError("BUSINESS_RULE", "retailCashInsufficient");
      const today = this.permissionService.today();
      const documentId = await this.deliveries.returnAsSystem(transaction, actor, {
        issueId: sale.stock_document_id,
        documentDate: today,
        reason: `Trả hàng bán lẻ ${sale.document_no}: ${input.reason}`.slice(0, 500),
        lines: await this.issueLines(transaction, sale, planned),
      });
      const documentNo = await this.sequences.next(actor.companyId, returnTypeCode, transaction);
      const returnId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO retail.returns (company_id, store_id, register_id, shift_id, sale_id, document_no, returned_at, return_date, cashier_id, reason, stock_document_id, goods_amount,
          refund_amount, client_key)
        VALUES (${actor.companyId}, ${shift.store_id}, ${shift.register_id}, ${shift.id}, ${sale.id}, ${documentNo}, ${this.clock.now()}, ${today}::date, ${actor.userId}, ${input.reason},
          ${documentId}, ${goods.toFixed(4)}::numeric, ${goods.toFixed(4)}::numeric, ${input.clientKey})
        RETURNING id`)
      ).rows[0]!.id;
      for (const [index, line] of planned.entries()) {
        await transaction.execute(sql`
          INSERT INTO retail.return_lines (return_id, line_no, order_line_id, base_quantity, amount)
          VALUES (${returnId}, ${index + 1}, ${line.orderLineId}, ${line.baseQuantity.toFixed(4)}::numeric, ${line.amount.toFixed(4)}::numeric)`);
      }
      if (goods > 0) {
        await transaction.execute(sql`
          INSERT INTO retail.return_refunds (return_id, line_no, method, amount, fund_id, bank_reference, recipient)
          VALUES (${returnId}, 1, ${input.refund.method}, ${goods.toFixed(4)}::numeric, ${fundId}, ${input.refund.bankReference}, ${input.refund.method === "cash" ? null : input.refund.recipient})`);
      }
      await this.auditService.record(
        { ...retailAudit(actor, "retail_return"), action: "retail_return.create", entityId: returnId, afterData: { documentNo, saleId: sale.id, goods, refund: input.refund } },
        transaction,
      );
      return returnId;
    });
    return this.detail(actor, id);
  }

  async detail(actor: Actor, id: string): Promise<RetailReturnResponse> {
    const row = (
      await this.database.execute<{
        id: string;
        document_no: string;
        returned_at: Date;
        sale_id: string;
        sale_no: string;
        branch_id: string;
        store_name: string;
        store_address: string | null;
        store_phone: string | null;
        legal_name: string;
        tax_code: string | null;
        company_address: string | null;
        register_code: string;
        cashier_name: string;
        reason: string;
        goods_amount: string;
        refund_amount: string;
        stock_document_id: string;
        stock_document_no: string;
        sales_order_id: string;
      }>(sql`
      SELECT rt.id, rt.document_no, rt.returned_at, s.id AS sale_id, s.document_no AS sale_no, st.branch_id, b.name AS store_name, b.address AS store_address, b.phone AS store_phone,
        c.legal_name, c.tax_code, c.address AS company_address, r.code AS register_code, u.full_name AS cashier_name, rt.reason, rt.goods_amount::text, rt.refund_amount::text,
        rt.stock_document_id, d.document_no AS stock_document_no, s.sales_order_id
      FROM retail.returns rt JOIN retail.sales s ON s.id = rt.sale_id JOIN retail.stores st ON st.id = rt.store_id JOIN core.branches b ON b.id = st.branch_id
        JOIN core.companies c ON c.id = rt.company_id JOIN retail.registers r ON r.id = rt.register_id JOIN core.users u ON u.id = rt.cashier_id
        JOIN inventory.documents d ON d.id = rt.stock_document_id
      WHERE rt.company_id = ${actor.companyId} AND rt.id = ${id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
    if (![retailPermissions.sale, retailPermissions.return, retailPermissions.manageShifts].some((permission) => granted.has(permission))) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{ product_name: string; unit_name: string; quantity: string; amount: string }>(sql`
      SELECT p.name AS product_name, u.name_vi AS unit_name, (rl.base_quantity * l.quantity / l.base_quantity)::text AS quantity, rl.amount::text
      FROM retail.return_lines rl JOIN sales.order_lines l ON l.id = rl.order_line_id JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
        JOIN catalog.units u ON u.id = l.unit_id
      WHERE rl.return_id = ${id} ORDER BY rl.line_no`);
    const refunds = await this.database.execute<{ method: RetailPaymentMethod; amount: string; bank_reference: string | null; recipient: string | null; points: string | null }>(sql`
      SELECT method, amount::text, bank_reference, recipient, points::text FROM retail.return_refunds WHERE return_id = ${id} ORDER BY line_no`);
    return {
      id: row.id,
      documentNo: row.document_no,
      returnedAt: new Date(row.returned_at).toISOString(),
      sale: { id: row.sale_id, documentNo: row.sale_no },
      store: { name: row.store_name, address: row.store_address, phone: row.store_phone },
      company: { legalName: row.legal_name, taxCode: row.tax_code, address: row.company_address },
      registerCode: row.register_code,
      cashierName: row.cashier_name,
      reason: row.reason,
      lines: lines.rows.map((line) => ({ productName: line.product_name, unitName: line.unit_name, quantity: trimDecimal(Number(line.quantity).toFixed(4)), amount: trimDecimal(line.amount) })),
      goodsAmount: trimDecimal(row.goods_amount),
      refundAmount: trimDecimal(row.refund_amount),
      refunds: refunds.rows.map((refund) => ({
        method: refund.method,
        amount: trimDecimal(refund.amount),
        bankReference: refund.bank_reference,
        recipient: refund.recipient,
        points: refund.points === null ? null : trimDecimal(refund.points),
      })),
      stockDocument: { id: row.stock_document_id, documentNo: row.stock_document_no },
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }
}

const blockedMessage = { expired: "retailReturnExpired", otherStore: "retailReturnOtherStore", returnsDisabled: "retailReturnsDisabled" } as const;
