// Giữ hàng (CHUC_NANG_43; QUYTAC_NGHIEPVU_54): tồn khả dụng = tồn thực − hàng đang giữ. Không giữ quá tồn khả dụng.
// Phiếu kho làm giảm tồn giữ hàng khi gửi duyệt; MODULE_05 giữ hàng cho đơn bán đã xác nhận.
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Executor } from "./stock-ledger.service";

export interface ReservationRequest {
  warehouseId: string;
  companyId: string;
  variantId: string;
  quantity: string;
  sourceType: string;
  sourceId: string;
  sourceNo: string | null;
  expiresAt: string | null;
  userId: string | null;
}

@Injectable()
export class ReservationsService {
  // Khóa dòng giá vốn của mặt hàng để hai lần giữ đồng thời không vượt tồn khả dụng.
  async available(transaction: Executor, warehouseId: string, companyId: string, variantId: string, excludeSource?: { type: string; id: string }): Promise<string> {
    await transaction.execute(sql`INSERT INTO inventory.costs (warehouse_id, company_id, variant_id) VALUES (${warehouseId}, ${companyId}, ${variantId}) ON CONFLICT DO NOTHING`);
    const row = (
      await transaction.execute<{ available: string }>(sql`
      WITH locked AS (SELECT quantity FROM inventory.costs WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${variantId} FOR UPDATE)
      SELECT ((SELECT quantity FROM locked) - coalesce((
        SELECT sum(quantity) FROM inventory.reservations
        WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${variantId} AND status = 'active'
          AND NOT (source_type = ${excludeSource?.type ?? ""} AND source_id IS NOT DISTINCT FROM ${excludeSource?.id ?? null}::uuid)), 0))::text AS available`)
    ).rows[0]!;
    return row.available;
  }

  async reserve(transaction: Executor, request: ReservationRequest): Promise<string> {
    const available = await this.available(transaction, request.warehouseId, request.companyId, request.variantId, { type: request.sourceType, id: request.sourceId });
    if (Number(available) < Number(request.quantity)) throw new ApiError("BUSINESS_RULE", "insufficientAvailableStock");
    const row = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.reservations (warehouse_id, company_id, variant_id, quantity, source_type, source_id, source_no, expires_at, created_by)
      VALUES (${request.warehouseId}, ${request.companyId}, ${request.variantId}, ${request.quantity}::numeric, ${request.sourceType}, ${request.sourceId}, ${request.sourceNo},
        ${request.expiresAt}::timestamptz, ${request.userId}) RETURNING id`)
    ).rows[0]!;
    return row.id;
  }

  // Nguồn kết thúc: đã dùng (xuất kho) hoặc nhả (từ chối, rút, hủy).
  async closeBySource(transaction: Executor, sourceType: string, sourceId: string, status: "released" | "consumed"): Promise<void> {
    await transaction.execute(sql`
      UPDATE inventory.reservations SET status = ${status}, released_at = now(), version = version + 1
      WHERE source_type = ${sourceType} AND source_id = ${sourceId} AND status = 'active'`);
  }
}
