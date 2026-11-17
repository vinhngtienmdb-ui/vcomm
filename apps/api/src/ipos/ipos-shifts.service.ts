// Máy bán iPOS: điều kiện bán, đồng bộ danh mục, ca và thu chi, giỏ treo, duyệt tại chỗ bằng PIN chủ cửa hàng, nhật ký mở ngăn kéo
// (CONG_VIEC_74; CHUC_NANG_256, 257; QUYTAC_NGHIEPVU_609, 612, 613, 620 đến 623; API_337, 338, 339, 342).
import { Inject, Injectable } from "@nestjs/common";
import type {
  IposApproval,
  IposCashMovement,
  IposCatalog,
  IposCatalogVariant,
  IposCurrentShift,
  IposHeldCart,
  IposPaymentMethod,
  IposShift,
  IposShiftReport,
  IposVatRate,
  iposApprovalSchema,
  iposCashMovementSchema,
  iposCloseShiftSchema,
  iposHeldCartSchema,
  iposOpenShiftSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import * as argon2 from "argon2";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "./ipos-catalog.service";
import { hashSecret, memberForDevice, type IposPosActor } from "./ipos-device-context";
import { overLimitRegisters } from "./ipos-registers.service";
import { openLinks } from "./ipos-checkouts.service";
import { loadSettings } from "./ipos-settings.service";

const maxPinFailures = 5;
const pinLockMinutes = 15;
const approvalMinutes = 2;

// Điều kiện bán (QUYTAC_NGHIEPVU_612): thuê bao dùng thử, hoạt động hoặc quá hạn trong ân hạn; cửa hàng hoạt động trong hạn hợp đồng; điểm bán hoạt động.
export async function requireSelling(executor: Executor, actor: IposPosActor, today: string): Promise<void> {
  const status = actor.device.subscriptionStatus;
  if (!status) throw new ApiError("FORBIDDEN", "iposNoSubscription");
  if (status === "locked") throw new ApiError("BUSINESS_RULE", "iposSubscriptionLocked");
  const merchant = (
    await executor.execute<{ status: string; starts_on: string; ends_on: string | null; outlet_status: string }>(sql`
      SELECT m.status, m.starts_on::text, m.ends_on::text, o.status AS outlet_status
      FROM affiliate.merchants m JOIN affiliate.outlets o ON o.merchant_id = m.id WHERE m.id = ${actor.device.merchantId} AND o.id = ${actor.device.outletId}`)
  ).rows[0]!;
  if (merchant.status !== "active" || merchant.starts_on > today || (merchant.ends_on !== null && merchant.ends_on < today)) throw new ApiError("BUSINESS_RULE", "iposMerchantNotSelling");
  if (merchant.outlet_status !== "active") throw new ApiError("BUSINESS_RULE", "iposOutletInactive");
}

type ShiftRow = {
  id: string;
  register_id: string;
  register_name: string;
  member_id: string;
  member_name: string;
  opened_at: Date;
  opening_cash: string;
  opening_note: string | null;
  closed_at: Date | null;
  closed_by_name: string | null;
};
const shiftColumns = sql`s.id, s.register_id, r.name AS register_name, s.member_id, mb.full_name AS member_name, s.opened_at, s.opening_cash::text, s.opening_note,
  s.closed_at, cb.full_name AS closed_by_name`;
const shiftFrom = sql`ipos.shifts s JOIN ipos.registers r ON r.id = s.register_id JOIN affiliate.members mb ON mb.id = s.member_id LEFT JOIN affiliate.members cb ON cb.id = s.closed_by`;
const toShift = (row: ShiftRow): IposShift => ({
  id: row.id,
  registerId: row.register_id,
  registerName: row.register_name,
  memberId: row.member_id,
  memberName: row.member_name,
  openedAt: new Date(row.opened_at).toISOString(),
  openingCash: row.opening_cash,
  openingNote: row.opening_note,
  closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
  closedByName: row.closed_by_name,
});

// Ca đang mở của người đang đăng nhập tại quầy của thiết bị (QUYTAC_NGHIEPVU_612: người bán có ca đang mở tại quầy).
export async function openShiftOf(executor: Executor, actor: IposPosActor, shiftId: string, lock = false): Promise<IposShift> {
  const row = (
    await executor.execute<ShiftRow>(sql`
      SELECT ${shiftColumns} FROM ${shiftFrom}
      WHERE s.id = ${shiftId} AND s.register_id = ${actor.device.registerId} AND s.member_id = ${actor.memberId} AND s.closed_at IS NULL
      ${lock ? sql`FOR UPDATE OF s` : sql``}`)
  ).rows[0];
  if (!row) throw new ApiError("BUSINESS_RULE", "iposShiftNotOpen");
  return toShift(row);
}

@Injectable()
export class IposShiftsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private today(): string {
    return vietnamDate(this.clock.now());
  }

  // API_337: danh mục cho máy bán; `since` có thì chỉ phần thay đổi sau thời điểm đó (gồm biến thể đã ngừng bán để máy gỡ đi).
  async catalog(actor: IposPosActor, since: Date | null): Promise<IposCatalog> {
    const serverTime = (await this.database.execute<{ now: Date }>(sql`SELECT now() AS now`)).rows[0]!.now;
    const categories = await this.database.execute<{ id: string; parent_id: string | null; name: string; sort_order: number }>(sql`
      SELECT id, parent_id, name, sort_order FROM ipos.categories WHERE merchant_id = ${actor.device.merchantId} AND status = 'active' ORDER BY sort_order, lower(name)`);
    const variants = await this.database.execute<{
      variant_id: string;
      item_id: string;
      item_code: string;
      variant_code: string;
      name: string;
      unit: string;
      price: string;
      vat_rate: IposVatRate;
      track_stock: boolean;
      category_id: string | null;
      barcodes: string[];
      active: boolean;
    }>(sql`
      SELECT v.id AS variant_id, i.id AS item_id, i.code AS item_code, v.code AS variant_code, i.unit, i.vat_rate, i.track_stock, i.category_id,
        i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
        COALESCE(op.price, v.price, i.price)::text AS price,
        COALESCE((SELECT array_agg(b.barcode ORDER BY b.barcode) FROM ipos.item_barcodes b WHERE b.variant_id = v.id), '{}') AS barcodes,
        (v.status = 'active' AND i.status = 'active') AS active
      FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
      LEFT JOIN ipos.outlet_prices op ON op.variant_id = v.id AND op.outlet_id = ${actor.device.outletId}
      WHERE v.merchant_id = ${actor.device.merchantId}
        ${
          since
            ? sql`AND (v.updated_at > ${since} OR i.updated_at > ${since} OR op.updated_at > ${since}
                OR EXISTS (SELECT 1 FROM ipos.item_barcodes b WHERE b.variant_id = v.id AND b.created_at > ${since}))`
            : sql`AND v.status = 'active' AND i.status = 'active'`
        }
      ORDER BY i.code, v.sort_order`);
    const context = (
      await this.database.execute<{ merchant_name: string; outlet_name: string; address: string; code: string | null }>(sql`
        SELECT p.name AS merchant_name, o.name AS outlet_name, o.address, o.code
        FROM affiliate.outlets o JOIN affiliate.merchants m ON m.id = o.merchant_id JOIN crm.partners p ON p.id = m.partner_id WHERE o.id = ${actor.device.outletId}`)
    ).rows[0]!;
    const settings = await loadSettings(this.database, actor.device.merchantId);
    return {
      serverTime: new Date(serverTime).toISOString(),
      full: since === null,
      categories: categories.rows.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name, sortOrder: row.sort_order })),
      variants: variants.rows.map(
        (row): IposCatalogVariant => ({
          variantId: row.variant_id,
          itemId: row.item_id,
          itemCode: row.item_code,
          variantCode: row.variant_code,
          name: row.name,
          unit: row.unit,
          price: row.price,
          vatRate: row.vat_rate,
          trackStock: row.track_stock,
          categoryId: row.category_id,
          barcodes: row.barcodes,
          active: row.active,
        }),
      ),
      context: {
        merchantName: context.merchant_name,
        outletName: context.outlet_name,
        outletAddress: context.address,
        outletCode: context.code,
        registerName: actor.device.registerName,
        cashierMaxDiscountPercent: settings.cashierMaxDiscountPercent,
        blockNegativeStock: settings.blockNegativeStock,
        receiptFooter: settings.receiptFooter,
        paperWidth: settings.paperWidth,
        vietqr: settings.vietqrBankBin && settings.vietqrAccountNo && settings.vietqrAccountName ? { bankBin: settings.vietqrBankBin, accountNo: settings.vietqrAccountNo, accountName: settings.vietqrAccountName } : null,
      },
    };
  }

  // API_338: ca hiện tại của người đăng nhập tại quầy; gợi ý tiền để lại của ca đóng gần nhất ở quầy.
  async current(actor: IposPosActor): Promise<IposCurrentShift> {
    const open = await this.database.execute<ShiftRow>(sql`SELECT ${shiftColumns} FROM ${shiftFrom} WHERE s.register_id = ${actor.device.registerId} AND s.closed_at IS NULL`);
    const mine = open.rows.find((row) => row.member_id === actor.memberId) ?? null;
    const other = open.rows.find((row) => row.member_id !== actor.memberId) ?? null;
    const last = await this.database.execute<{ left_cash: string }>(sql`
      SELECT left_cash::text FROM ipos.shifts WHERE register_id = ${actor.device.registerId} AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 1`);
    return {
      shift: mine ? toShift(mine) : null,
      otherOpenShift: other ? { memberName: other.member_name, openedAt: new Date(other.opened_at).toISOString() } : null,
      suggestedOpeningCash: last.rows[0]?.left_cash ?? null,
      subscriptionStatus: actor.device.subscriptionStatus,
    };
  }

  async open(actor: IposPosActor, input: z.infer<typeof iposOpenShiftSchema>): Promise<IposShift> {
    if (Number(input.openingCash) > 1_000_000_000) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { openingCash: "invalidValue" } });
    const id = await this.database.transaction(async (transaction) => {
      await requireSelling(transaction, actor, this.today());
      // Quầy vượt số quầy của gói (mới nhất trước) không mở ca được (QUYTAC_NGHIEPVU_597).
      const over = await transaction.execute<{ id: string }>(overLimitRegisters(actor.device.outletId));
      if (over.rows.some((row) => row.id === actor.device.registerId)) throw new ApiError("BUSINESS_RULE", "iposRegisterLimit");
      const last = await transaction.execute<{ left_cash: string }>(sql`
        SELECT left_cash::text FROM ipos.shifts WHERE register_id = ${actor.device.registerId} AND closed_at IS NOT NULL ORDER BY closed_at DESC LIMIT 1`);
      const suggested = last.rows[0]?.left_cash;
      if (suggested !== undefined && suggested !== input.openingCash && !input.note) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { note: "iposOpeningNoteRequired" } });
      try {
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO ipos.shifts (merchant_id, outlet_id, register_id, member_id, device_id, opening_cash, opening_note)
          VALUES (${actor.device.merchantId}, ${actor.device.outletId}, ${actor.device.registerId}, ${actor.memberId}, ${actor.device.deviceId}, ${input.openingCash}, ${input.note})
          RETURNING id`);
        return created.rows[0]!.id;
      } catch (error) {
        if ((error as { code?: string; cause?: { code?: string } }).code === "23505" || (error as { cause?: { code?: string } }).cause?.code === "23505") {
          throw new ApiError("BUSINESS_RULE", "iposShiftAlreadyOpen");
        }
        throw error;
      }
    });
    return openShiftOf(this.database, actor, id);
  }

  async addCashMovement(actor: IposPosActor, shiftId: string, input: z.infer<typeof iposCashMovementSchema>): Promise<IposShiftReport> {
    if (Number(input.amount) <= 0 || Number(input.amount) > 1_000_000_000) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      await openShiftOf(transaction, actor, shiftId, true);
      await transaction.execute(sql`
        INSERT INTO ipos.cash_movements (shift_id, direction, category, amount, reason, member_id)
        VALUES (${shiftId}, ${input.direction}, ${input.category}, ${input.amount}, ${input.reason}, ${actor.memberId})`);
    });
    return this.report(actor, shiftId);
  }

  // Tiền hệ thống = đầu ca + tiền mặt bán − tiền mặt hoàn trả + thu − chi (QUYTAC_NGHIEPVU_623 khoản 2). Hoàn trả tiền mặt có từ L5.
  private async totals(executor: Executor, shiftId: string) {
    const row = (
      await executor.execute<{ sales_count: number; revenue: string; cash_sales: string; cash_in: string; cash_out: string; opening_cash: string }>(sql`
        SELECT
          (SELECT count(*)::int FROM ipos.sales WHERE shift_id = s.id AND status = 'completed') AS sales_count,
          (SELECT COALESCE(sum(total), 0)::text FROM ipos.sales WHERE shift_id = s.id AND status = 'completed') AS revenue,
          (SELECT COALESCE(sum(p.amount), 0)::text FROM ipos.sale_payments p JOIN ipos.sales x ON x.id = p.sale_id WHERE x.shift_id = s.id AND x.status = 'completed' AND p.method = 'cash') AS cash_sales,
          (SELECT COALESCE(sum(amount), 0)::text FROM ipos.cash_movements WHERE shift_id = s.id AND direction = 'in') AS cash_in,
          (SELECT COALESCE(sum(amount), 0)::text FROM ipos.cash_movements WHERE shift_id = s.id AND direction = 'out') AS cash_out,
          s.opening_cash::text
        FROM ipos.shifts s WHERE s.id = ${shiftId}`)
    ).rows[0]!;
    const byMethod = await executor.execute<{ method: IposPaymentMethod; amount: string }>(sql`
      SELECT p.method, sum(p.amount)::text AS amount FROM ipos.sale_payments p JOIN ipos.sales x ON x.id = p.sale_id
      WHERE x.shift_id = ${shiftId} AND x.status = 'completed' GROUP BY p.method ORDER BY p.method`);
    const cashRefunds = "0";
    const systemCash = String(Number(row.opening_cash) + Number(row.cash_sales) - Number(cashRefunds) + Number(row.cash_in) - Number(row.cash_out));
    return { ...row, byMethod: byMethod.rows, cashRefunds, systemCash };
  }

  async close(actor: IposPosActor, shiftId: string, input: z.infer<typeof iposCloseShiftSchema>): Promise<IposShiftReport> {
    await this.database.transaction(async (transaction) => {
      await openShiftOf(transaction, actor, shiftId, true);
      if ((await openLinks(transaction, shiftId)) > 0) throw new ApiError("BUSINESS_RULE", "iposShiftOpenPayments");
      const totals = await this.totals(transaction, shiftId);
      const difference = Number(input.countedCash) - Number(totals.systemCash);
      if (difference !== 0 && !input.differenceReason) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { differenceReason: "required" } });
      if (Number(input.leftCash) > Number(input.countedCash)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { leftCash: "iposLeftCashTooHigh" } });
      await transaction.execute(sql`
        UPDATE ipos.shifts SET closed_at = now(), closed_by = ${actor.memberId}, system_cash = ${totals.systemCash}, counted_cash = ${input.countedCash},
          difference = ${String(difference)}, difference_reason = ${difference === 0 ? null : input.differenceReason}, left_cash = ${input.leftCash},
          denominations = ${input.denominations ? JSON.stringify(input.denominations) : null}::jsonb
        WHERE id = ${shiftId}`);
      // Giỏ treo xóa khi đóng ca (QUYTAC_NGHIEPVU_613 khoản 5).
      await transaction.execute(sql`DELETE FROM ipos.held_carts WHERE register_id = ${actor.device.registerId}`);
    });
    return this.report(actor, shiftId);
  }

  // Biên bản ca: người bán xem ca của mình tại quầy của thiết bị (QUYTAC_NGHIEPVU_623 khoản 4).
  async report(actor: IposPosActor, shiftId: string): Promise<IposShiftReport> {
    const row = (
      await this.database.execute<ShiftRow & { counted_cash: string | null; difference: string | null; difference_reason: string | null; left_cash: string | null }>(sql`
        SELECT ${shiftColumns}, s.counted_cash::text, s.difference::text, s.difference_reason, s.left_cash::text
        FROM ${shiftFrom} WHERE s.id = ${shiftId} AND s.register_id = ${actor.device.registerId} AND (s.member_id = ${actor.memberId} OR ${actor.role === "owner"})`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const totals = await this.totals(this.database, shiftId);
    const movements = await this.database.execute<{
      id: string;
      direction: "in" | "out";
      category: IposCashMovement["category"];
      amount: string;
      reason: string;
      member_name: string;
      created_at: Date;
    }>(sql`
      SELECT c.id, c.direction, c.category, c.amount::text, c.reason, mb.full_name AS member_name, c.created_at
      FROM ipos.cash_movements c JOIN affiliate.members mb ON mb.id = c.member_id WHERE c.shift_id = ${shiftId} ORDER BY c.created_at`);
    return {
      shift: toShift(row),
      salesCount: totals.sales_count,
      revenue: totals.revenue,
      revenueByMethod: totals.byMethod,
      cashSales: totals.cash_sales,
      cashRefunds: totals.cashRefunds,
      cashIn: totals.cash_in,
      cashOut: totals.cash_out,
      systemCash: totals.systemCash,
      countedCash: row.counted_cash,
      difference: row.difference,
      differenceReason: row.difference_reason,
      leftCash: row.left_cash,
      handedOver: row.counted_cash !== null && row.left_cash !== null ? String(Number(row.counted_cash) - Number(row.left_cash)) : null,
      movements: movements.rows.map((movement) => ({
        id: movement.id,
        direction: movement.direction,
        category: movement.category,
        amount: movement.amount,
        reason: movement.reason,
        memberName: movement.member_name,
        createdAt: new Date(movement.created_at).toISOString(),
      })),
    };
  }

  // API_339: giỏ treo theo quầy.
  async heldCarts(actor: IposPosActor): Promise<IposHeldCart[]> {
    const rows = await this.database.execute<{ slot: number; label: string; payload: unknown; member_name: string; updated_at: Date }>(sql`
      SELECT h.slot, h.label, h.payload, mb.full_name AS member_name, h.updated_at
      FROM ipos.held_carts h JOIN affiliate.members mb ON mb.id = h.member_id WHERE h.register_id = ${actor.device.registerId} ORDER BY h.slot`);
    return rows.rows.map((row) => ({ slot: row.slot, label: row.label, payload: row.payload, memberName: row.member_name, updatedAt: new Date(row.updated_at).toISOString() }));
  }

  async saveHeldCart(actor: IposPosActor, slot: number, input: z.infer<typeof iposHeldCartSchema>): Promise<IposHeldCart[]> {
    if (JSON.stringify(input.payload).length > 200_000) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { payload: "invalidValue" } });
    await this.database.execute(sql`
      INSERT INTO ipos.held_carts (register_id, slot, label, payload, member_id) VALUES (${actor.device.registerId}, ${slot}, ${input.label}, ${JSON.stringify(input.payload)}::jsonb, ${actor.memberId})
      ON CONFLICT (register_id, slot) DO UPDATE SET label = EXCLUDED.label, payload = EXCLUDED.payload, member_id = EXCLUDED.member_id, updated_at = now()`);
    return this.heldCarts(actor);
  }

  async removeHeldCart(actor: IposPosActor, slot: number): Promise<IposHeldCart[]> {
    await this.database.execute(sql`DELETE FROM ipos.held_carts WHERE register_id = ${actor.device.registerId} AND slot = ${slot}`);
    return this.heldCarts(actor);
  }

  // API_342: chủ cửa hàng nhập PIN của mình trên máy này để duyệt tại chỗ; trả mã 6 số dùng một lần trong 2 phút. Dùng chung bộ đếm sai PIN của đăng nhập.
  async approve(actor: IposPosActor, input: z.infer<typeof iposApprovalSchema>): Promise<IposApproval> {
    const now = this.clock.now();
    const approver = await memberForDevice(this.database, actor.device, { memberId: input.memberId });
    if (!approver || approver.role !== "owner") throw new ApiError("BUSINESS_RULE", "iposApproverNotOwner");
    const pin = (
      await this.database.execute<{ pin_hash: string; failed_count: number; locked_until: Date | null }>(sql`
        SELECT pin_hash, failed_count, locked_until FROM ipos.member_pins WHERE member_id = ${approver.memberId} AND device_id = ${actor.device.deviceId}`)
    ).rows[0];
    if (!pin) throw new ApiError("BUSINESS_RULE", "iposApproverNoPin");
    if (pin.locked_until && new Date(pin.locked_until) > now) {
      throw new ApiError("RATE_LIMITED", "iposPinLocked", { retryAfterSeconds: Math.ceil((new Date(pin.locked_until).getTime() - now.getTime()) / 1000) });
    }
    if (!(await argon2.verify(pin.pin_hash, input.pin))) {
      const failures = pin.failed_count + 1;
      const locked = failures >= maxPinFailures;
      await this.database.execute(sql`
        UPDATE ipos.member_pins SET failed_count = ${locked ? 0 : failures}, locked_until = ${locked ? new Date(now.getTime() + pinLockMinutes * 60_000) : null}, updated_at = now()
        WHERE member_id = ${approver.memberId} AND device_id = ${actor.device.deviceId}`);
      if (locked) throw new ApiError("RATE_LIMITED", "iposPinLocked", { retryAfterSeconds: pinLockMinutes * 60 });
      throw new ApiError("UNAUTHENTICATED", "iposPinWrong");
    }
    await this.database.execute(sql`UPDATE ipos.member_pins SET failed_count = 0, locked_until = NULL, updated_at = now() WHERE member_id = ${approver.memberId} AND device_id = ${actor.device.deviceId}`);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(now.getTime() + approvalMinutes * 60_000);
    await this.database.execute(sql`
      INSERT INTO ipos.approval_codes (device_id, approver_id, purpose, code_hash, expires_at)
      VALUES (${actor.device.deviceId}, ${approver.memberId}, ${input.purpose}, ${hashSecret(`${actor.device.deviceId}:${code}`)}, ${expiresAt})`);
    return { approvalCode: code, approverName: approver.fullName, expiresAt: expiresAt.toISOString() };
  }

  // Chủ cửa hàng bấm "Mở ngăn kéo": ghi người mở, thời điểm (QUYTAC_NGHIEPVU_620 khoản 4).
  async drawerOpened(actor: IposPosActor, reason: string | null): Promise<void> {
    if (actor.role !== "owner") throw new ApiError("FORBIDDEN", "forbidden");
    await this.database.execute(sql`
      INSERT INTO ipos.device_events (merchant_id, device_id, member_id, kind, reason) VALUES (${actor.device.merchantId}, ${actor.device.deviceId}, ${actor.memberId}, 'drawer_open', ${reason})`);
  }
}

// Dùng mã duyệt: đúng thiết bị, đúng mục đích, chưa dùng, còn hạn; đánh dấu đã dùng trong cùng giao dịch ghi hóa đơn.
export async function consumeApproval(executor: Executor, deviceId: string, code: string, purpose: "discount" | "return", now: Date): Promise<string> {
  const row = (
    await executor.execute<{ approver_id: string }>(sql`
      UPDATE ipos.approval_codes SET used_at = ${now}
      WHERE code_hash = ${hashSecret(`${deviceId}:${code}`)} AND device_id = ${deviceId} AND purpose = ${purpose} AND used_at IS NULL AND expires_at > ${now}
      RETURNING approver_id`)
  ).rows[0];
  if (!row) throw new ApiError("BUSINESS_RULE", "iposApprovalInvalid");
  return row.approver_id;
}
