// Đơn chờ khách thanh toán qua ứng dụng VComm tại quầy cửa hàng tập đoàn (CONG_VIEC_73 lát L2; QUYTAC_NGHIEPVU_575 đến 580; API_328; MAN_HINH_278).
// Thu ngân lập giỏ như khi bán, tạo đơn chờ (giữ hàng tại kho bán), rồi quét mã thanh toán của khách hoặc cho khách quét mã QR.
// Khách chọn điểm, trả trên ứng dụng; cổng báo thành công thì ghi hóa đơn bán lẻ như bán tại quầy với dòng "Ứng dụng VComm".
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { createRetailCheckoutSchema, InstoreCheckoutLine, InstoreCheckoutLoyalty, RetailCheckoutResponse } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { redeemLockedUntil } from "../auth/account-security";
import { maskName } from "../auth/smart-otp.service";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { InstoreCheckoutsService, type CheckoutKindHandler, type RedeemResult, type CheckoutRow, type DatabaseTransaction } from "../instore/checkouts.service";
import { ReservationsService } from "../inventory/reservations.service";
import { LoyaltyLedgerService, releaseSalePoints } from "../loyalty/ledger.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { retailPermissions, retailPermissionsAt } from "./retail-context";
import { RetailSalesService } from "./retail-sales.service";
import { RetailShiftsService } from "./retail-shifts.service";
import { RetailStoresService } from "./retail-stores.service";

type CheckoutInput = z.output<typeof createRetailCheckoutSchema>;
type SaleInput = Parameters<RetailSalesService["recordWithin"]>[2];
const reservationSource = "instore.checkout";
const appWebBase = () => (process.env.VCOMM_WEB_URL?.trim() || "http://localhost:8083").replace(/\/+$/, "");

@Injectable()
export class RetailCheckoutsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly instore: InstoreCheckoutsService,
    private readonly stores: RetailStoresService,
    private readonly shifts: RetailShiftsService,
    private readonly sales: RetailSalesService,
    private readonly reservations: ReservationsService,
    private readonly loyalty: LoyaltyLedgerService,
  ) {}

  onModuleInit(): void {
    const handler: CheckoutKindHandler = {
      loyalty: (executor, row, userId) => this.loyaltyFor(executor, row, userId),
      vouchers: async () => [],
      redeem: (transaction, row, userId, input) => this.redeem(transaction, row, userId, input),
      platformFeePercent: async (executor, row) =>
        Number((await executor.execute<{ percent: string }>(sql`SELECT platform_fee_percent::text AS percent FROM retail.stores WHERE id = ${row.store_id}`)).rows[0]!.percent),
      release: (transaction, row) => this.release(transaction, row),
      complete: (transaction, row, appAmount) => this.complete(transaction, row, appAmount),
    };
    this.instore.registerHandler("retail", handler);
  }

  // Tạo đơn chờ từ giỏ (QUYTAC_NGHIEPVU_575): tiền tính như bán tại quầy; tổng đổi so với lúc xem thì báo. Gửi lại cùng khóa trả đơn đã tạo.
  async create(actor: Actor, input: CheckoutInput): Promise<RetailCheckoutResponse> {
    const shift = await this.shifts.requireOwnOpenShift(this.database, actor, input.shiftId);
    const store = await this.stores.store(this.database, actor.companyId, shift.store_id);
    if (store.kind === "pickup_point") throw new ApiError("BUSINESS_RULE", "retailPickupPointNoCounterSale");
    if (!store.app_payment_enabled) throw new ApiError("BUSINESS_RULE", "instoreAppPaymentDisabled");
    const operator = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator AND status = 'active'`)).rows[0];
    if (!operator) throw new ApiError("BUSINESS_RULE", "instoreNoGateway");
    const quote = await this.sales.quote(actor, { shiftId: input.shiftId, lines: input.lines });
    if (Math.abs(Number(quote.totalAmount) - Number(input.expectedTotal)) > 0.00005) throw new ApiError("BUSINESS_RULE", "retailTotalChanged");
    await this.sales.prepareNumbering(actor);
    const lines: InstoreCheckoutLine[] = quote.lines.map((line) => ({
      name: line.productName,
      unit: line.unitName,
      quantity: line.quantity,
      unitPrice: line.listPrice,
      amount: line.total,
      gift: line.isGift,
    }));
    const { created, row, qrToken } = await this.database.transaction(async (transaction) => {
      const result = await this.instore.create(transaction, {
        operatorCompanyId: operator.id,
        place: { kind: "retail", companyId: actor.companyId, storeId: store.id, registerId: shift.register_id, shiftId: shift.id },
        creator: { source: "retail_counter", userId: actor.userId },
        idempotencyKey: input.clientKey,
        billAmount: quote.totalAmount,
        lines,
        collectInApp: true,
        saleInput: { ...input, payments: [] },
      });
      if (result.created) {
        // Giữ hàng tại kho bán đến khi hoàn tất, hết hạn hoặc hủy (theo đơn vị cơ sở; hàng dịch vụ không giữ).
        for (const line of quote.lines) {
          const base = (
            await transaction.execute<{ quantity: string | null; service: boolean }>(sql`
              SELECT (${line.quantity}::numeric * CASE WHEN p.base_unit_id = ${line.unitId} THEN 1 ELSE pu.factor END)::text AS quantity, p.kind = 'service' AS service
              FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
              LEFT JOIN catalog.product_units pu ON pu.product_id = p.id AND pu.unit_id = ${line.unitId}
              WHERE v.id = ${line.variantId}`)
          ).rows[0];
          if (!base?.quantity || base.service) continue;
          await this.reservations.reserve(transaction, {
            warehouseId: store.warehouse_id,
            companyId: actor.companyId,
            variantId: line.variantId,
            quantity: base.quantity,
            sourceType: reservationSource,
            sourceId: result.checkout.id,
            sourceNo: result.checkout.document_no,
            expiresAt: null,
            userId: actor.userId,
          });
        }
      }
      return { created: result.created, row: result.checkout, qrToken: result.qrToken };
    });
    return this.response(row, created ? qrToken : null);
  }

  // Thu ngân tạo đơn, Cửa hàng trưởng (quyền quản lý ca tại chi nhánh) xem, thao tác đơn của cửa hàng.
  private async accessible(actor: Actor, id: string, manage = false): Promise<CheckoutRow> {
    const row = await this.instore.find(this.database, id);
    if (!row || row.kind !== "retail" || row.company_id !== actor.companyId) throw new ApiError("NOT_FOUND", "notFound");
    if (!manage && row.created_by_user_id === actor.userId) return row;
    const branch = (await this.database.execute<{ branch_id: string }>(sql`SELECT branch_id FROM retail.stores WHERE id = ${row.store_id}`)).rows[0]!;
    const permissions = await retailPermissionsAt(this.permissionService, actor, branch.branch_id);
    if (permissions.has(retailPermissions.manageShifts)) return row;
    throw new ApiError(row.created_by_user_id === actor.userId || permissions.has(retailPermissions.sale) ? "FORBIDDEN" : "NOT_FOUND", row.created_by_user_id === actor.userId ? "forbidden" : "notFound");
  }

  async get(actor: Actor, id: string): Promise<RetailCheckoutResponse> {
    return this.response(await this.accessible(actor, id), null);
  }

  // Luồng 1: quét mã thanh toán của khách (QUYTAC_NGHIEPVU_576).
  async payCode(actor: Actor, id: string, code: string): Promise<RetailCheckoutResponse> {
    await this.accessible(actor, id);
    const row = await this.instore.attachPayCode(id, code, { subject: `user:${actor.userId}`, companyId: actor.companyId });
    return this.response(row, null);
  }

  // Hủy đơn chưa thanh toán; đơn "Đã thu, lỗi ghi sổ" chỉ Cửa hàng trưởng hủy và hoàn tiền.
  async cancel(actor: Actor, id: string, reason: string): Promise<RetailCheckoutResponse> {
    const current = await this.accessible(actor, id);
    if (current.status === "paid_unposted") await this.accessible(actor, id, true);
    return this.response(await this.instore.cancel(id, actor.userId, reason), null);
  }

  async retryPosting(actor: Actor, id: string): Promise<RetailCheckoutResponse> {
    await this.accessible(actor, id, true);
    return this.response(await this.instore.retryPosting(id), null);
  }

  private async response(row: CheckoutRow, qrToken: string | null): Promise<RetailCheckoutResponse> {
    const buyer = row.buyer_user_id
      ? (await this.database.execute<{ full_name: string }>(sql`SELECT full_name FROM core.users WHERE id = ${row.buyer_user_id}`)).rows[0]
      : undefined;
    const expired = ["awaiting_buyer", "awaiting_payment"].includes(row.status) && new Date(row.expires_at).getTime() <= Date.now();
    return {
      id: row.id,
      documentNo: row.document_no,
      status: expired ? "expired" : row.status,
      totalAmount: row.bill_amount,
      expiresAt: new Date(row.expires_at).toISOString(),
      qrUrl: qrToken ? `${appWebBase()}/tt/${qrToken}` : null,
      buyer: buyer ? { maskedName: maskName(buyer.full_name), tierName: null } : null,
      points: row.points,
      pointsAmount: row.points_amount,
      amountDue: row.amount_due,
      saleId: row.retail_sale_id,
      postingError: row.posting_error,
    };
  }

  // Giới hạn điểm như bán tại quầy (QUYTAC_NGHIEPVU_379): theo tiền hàng gồm thuế của đơn.
  private async loyaltyFor(executor: Pick<Database, "execute">, row: CheckoutRow, userId: string): Promise<InstoreCheckoutLoyalty> {
    const today = this.permissionService.today();
    const quote = await this.loyalty.quoteRedemption(executor, { userId, sourceType: "retail_sale", day: today, goodsAmount: Number(row.bill_amount) });
    return {
      balance: quote.balance,
      minPoints: quote.minPoints,
      maxPoints: quote.maxPoints,
      pointValue: quote.pointValue === null ? null : String(quote.pointValue),
      blockedReason: quote.blockedReason,
      redeemLockedUntil: await redeemLockedUntil(executor, userId),
    };
  }

  // Trừ điểm khi khách bấm thanh toán, theo mã hóa đơn bán lẻ dành trước; sổ cái điểm tự ghi bút toán. Quầy tập đoàn không có voucher.
  private async redeem(transaction: DatabaseTransaction, row: CheckoutRow, userId: string, input: { points: number; voucherCodeId: string | null }): Promise<RedeemResult> {
    if (input.voucherCodeId) throw new ApiError("BUSINESS_RULE", "instoreVoucherUnavailable");
    const points = input.points;
    if (points <= 0) return { points: 0, amount: 0, voucherAmount: 0, reservedSaleId: null, affiliateTransactionId: null };
    const reservedSaleId = randomUUID();
    const redeemed = await this.loyalty.redeemWithin(transaction, {
      userId,
      companyId: row.company_id!,
      sourceType: "retail_sale",
      sourceId: reservedSaleId,
      day: this.permissionService.today(),
      goodsAmount: Number(row.bill_amount),
      points,
    });
    return { points: redeemed.points, amount: redeemed.amount, voucherAmount: 0, reservedSaleId, affiliateTransactionId: null };
  }

  private async release(transaction: DatabaseTransaction, row: CheckoutRow): Promise<void> {
    if (row.reserved_sale_id) await releaseSalePoints(transaction, "retail_sale", row.reserved_sale_id);
    await this.reservations.closeBySource(transaction, reservationSource, row.id, "released");
  }

  // Ghi hóa đơn bán lẻ thay thu ngân tạo đơn (QUYTAC_NGHIEPVU_580): nhả phần giữ rồi xuất kho như bán tại quầy.
  private async complete(transaction: DatabaseTransaction, row: CheckoutRow, appAmount: number): Promise<string> {
    await this.reservations.closeBySource(transaction, reservationSource, row.id, "released");
    const actor: Actor = { userId: row.created_by_user_id!, companyId: row.company_id!, client: { ip: null, userAgent: "instore-checkout", requestId: null } };
    const saved = row.sale_input as SaleInput;
    const invoice = row.buyer_invoice_info;
    const input: SaleInput = invoice ? { ...saved, buyer: { name: invoice.name, taxCode: invoice.taxCode, address: invoice.address, identityNo: null } } : saved;
    return this.sales.recordWithin(transaction, actor, input, {
      saleId: row.reserved_sale_id ?? randomUUID(),
      checkoutId: row.id,
      appAmount,
      redeemed: row.points > 0 ? { points: row.points, amount: Number(row.points_amount) } : null,
      loyaltyUserId: row.buyer_user_id,
    });
  }
}
