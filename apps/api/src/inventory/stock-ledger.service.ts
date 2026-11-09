// Ghi sổ kho (QUYTAC_NGHIEPVU_47, 48, 49): mọi thay đổi tồn đi qua đây, trong giao dịch của phiếu.
// Khóa dòng giá vốn rồi dòng tồn theo thứ tự cố định để hai phiếu đồng thời không bế tắc; không cho tồn âm; ghi thẻ kho.
// MODULE_04, MODULE_05 gọi dịch vụ này khi nhập kho từ đơn mua, xuất kho cho đơn bán.
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

export type Executor = Pick<Database, "execute">;
const zero = "00000000-0000-0000-0000-000000000000";

export interface LedgerEntry {
  warehouseId: string;
  companyId: string;
  variantId: string;
  lotId: string | null;
  locationId: string | null;
  // Số lượng theo đơn vị cơ sở, có dấu: dương là tăng, âm là giảm.
  quantity: string;
  // Giá vốn một đơn vị cơ sở khi tăng; để trống thì lấy giá vốn bình quân hiện hành.
  unitCost?: string | null;
  // Tổng giá trị khi tăng (nhập theo đơn vị khác đơn vị cơ sở); ưu tiên hơn giá một đơn vị.
  totalValue?: string | null;
  // Hàng theo dõi serial: danh sách serial tăng hoặc giảm.
  serials?: string[];
  // Trạng thái serial sau khi giảm: đã xuất, hoặc đang vận chuyển (chuyển kho).
  serialStatusAfter?: "issued" | "in_transit";
  // Nhận serial đang vận chuyển: giữ giá đích danh của từng serial.
  keepSerialCost?: boolean;
  documentId: string;
  lineId: string | null;
  // Bỏ kiểm khóa kiểm kê (phiếu điều chỉnh sinh từ chính lần kiểm kê đó).
  ignoreStocktakeLock?: boolean;
}

export interface LedgerResult {
  value: string;
  serialIds: string[];
}

@Injectable()
export class StockLedgerService {
  // Ghi nhiều dòng; sắp xếp theo khóa để thứ tự khóa dòng giống nhau ở mọi giao dịch.
  async postAll(transaction: Executor, entries: LedgerEntry[]): Promise<LedgerResult[]> {
    const order = entries.map((entry, index) => ({ entry, index })).sort((first, second) => key(first.entry).localeCompare(key(second.entry)));
    const results: LedgerResult[] = new Array(entries.length);
    for (const { entry, index } of order) results[index] = await this.post(transaction, entry);
    return results;
  }

  async post(transaction: Executor, entry: LedgerEntry): Promise<LedgerResult> {
    const increase = !entry.quantity.startsWith("-");
    const amount = increase ? entry.quantity : entry.quantity.slice(1);
    if (!entry.ignoreStocktakeLock) await this.checkStocktakeLock(transaction, entry);

    await transaction.execute(sql`
      INSERT INTO inventory.costs (warehouse_id, company_id, variant_id) VALUES (${entry.warehouseId}, ${entry.companyId}, ${entry.variantId}) ON CONFLICT DO NOTHING`);
    const cost = (
      await transaction.execute<{ quantity: string; value: string; average_cost: string }>(sql`
      SELECT quantity::text, value::text, average_cost::text FROM inventory.costs
      WHERE warehouse_id = ${entry.warehouseId} AND company_id = ${entry.companyId} AND variant_id = ${entry.variantId} FOR UPDATE`)
    ).rows[0]!;
    await transaction.execute(sql`
      INSERT INTO inventory.balances (warehouse_id, company_id, variant_id, lot_id, location_id)
      VALUES (${entry.warehouseId}, ${entry.companyId}, ${entry.variantId}, ${entry.lotId}, ${entry.locationId})
      ON CONFLICT (warehouse_id, company_id, variant_id, coalesce(lot_id, ${zero}::uuid), coalesce(location_id, ${zero}::uuid)) DO NOTHING`);
    const balance = (
      await transaction.execute<{ id: string; quantity: string }>(sql`
      SELECT id, quantity::text FROM inventory.balances
      WHERE warehouse_id = ${entry.warehouseId} AND company_id = ${entry.companyId} AND variant_id = ${entry.variantId}
        AND lot_id IS NOT DISTINCT FROM ${entry.lotId} AND location_id IS NOT DISTINCT FROM ${entry.locationId} FOR UPDATE`)
    ).rows[0]!;

    if (!increase && Number(balance.quantity) < Number(amount)) throw new ApiError("BUSINESS_RULE", "insufficientStock");

    let value: string;
    let serialIds: string[] = [];
    if (entry.serials && entry.serials.length > 0) {
      const moved = increase ? await this.receiveSerials(transaction, entry, cost.average_cost) : await this.issueSerials(transaction, entry);
      value = moved.value;
      serialIds = moved.serialIds;
    } else if (increase && entry.totalValue) {
      value = entry.totalValue;
    } else if (increase) {
      value = await scalar(transaction, sql`SELECT round(${amount}::numeric * ${entry.unitCost ?? cost.average_cost}::numeric, 4)::text AS value`);
    } else {
      // Xuất hết thì lấy toàn bộ giá trị còn lại để không dư số lẻ.
      value = await scalar(
        transaction,
        sql`SELECT (CASE WHEN ${amount}::numeric = ${cost.quantity}::numeric THEN ${cost.value}::numeric ELSE round(${amount}::numeric * ${cost.average_cost}::numeric, 4) END)::text AS value`,
      );
    }

    await transaction.execute(sql`UPDATE inventory.balances SET quantity = quantity + ${entry.quantity}::numeric, updated_at = now() WHERE id = ${balance.id}`);
    const signedValue = increase ? value : `-${value}`;
    const updated = (
      await transaction.execute<{ quantity: string }>(sql`
      UPDATE inventory.costs SET quantity = quantity + ${entry.quantity}::numeric, value = value + ${signedValue}::numeric,
        average_cost = CASE WHEN quantity + ${entry.quantity}::numeric > 0 THEN round((value + ${signedValue}::numeric) / (quantity + ${entry.quantity}::numeric), 4) ELSE average_cost END,
        updated_at = now()
      WHERE warehouse_id = ${entry.warehouseId} AND company_id = ${entry.companyId} AND variant_id = ${entry.variantId}
      RETURNING quantity::text`)
    ).rows[0]!;
    await transaction.execute(sql`
      INSERT INTO inventory.movements (warehouse_id, company_id, variant_id, lot_id, location_id, quantity, unit_cost, value, balance_after, document_id, line_id)
      VALUES (${entry.warehouseId}, ${entry.companyId}, ${entry.variantId}, ${entry.lotId}, ${entry.locationId}, ${entry.quantity}::numeric,
        round(${value}::numeric / ${amount}::numeric, 4), ${signedValue}::numeric, ${updated.quantity}::numeric, ${entry.documentId}, ${entry.lineId})`);
    return { value: signedValue, serialIds };
  }

  // Kiểm kê đang đếm khóa mặt hàng (và vị trí) trong phạm vi (QUYTAC_NGHIEPVU_53).
  private async checkStocktakeLock(transaction: Executor, entry: LedgerEntry): Promise<void> {
    const locked = await transaction.execute(sql`
      SELECT 1 FROM inventory.stocktake_lines l JOIN inventory.stocktakes s ON s.id = l.stocktake_id
      WHERE s.status = 'counting' AND s.warehouse_id = ${entry.warehouseId} AND s.company_id = ${entry.companyId} AND l.variant_id = ${entry.variantId}
        AND (${entry.locationId}::uuid IS NULL OR l.location_id IS NULL OR l.location_id = ${entry.locationId}::uuid)
      LIMIT 1`);
    if (locked.rows.length > 0) throw new ApiError("BUSINESS_RULE", "stockLockedByStocktake");
  }

  // Serial nhập: chưa có thì tạo; đã xuất trước đó (hàng trả lại) thì đưa về kho; đang trong kho thì từ chối.
  private async receiveSerials(transaction: Executor, entry: LedgerEntry, averageCost: string): Promise<{ value: string; serialIds: string[] }> {
    if (entry.keepSerialCost) {
      const moved = await transaction.execute<{ id: string }>(sql`
        UPDATE inventory.serials SET warehouse_id = ${entry.warehouseId}, location_id = ${entry.locationId}, status = 'in_stock', updated_at = now()
        WHERE company_id = ${entry.companyId} AND variant_id = ${entry.variantId} AND status = 'in_transit' AND serial_no = ANY(${pgArray(entry.serials!)}::text[]) RETURNING id`);
      if (moved.rows.length !== entry.serials!.length) throw new ApiError("BUSINESS_RULE", "serialNotInStock");
      const ids = moved.rows.map((row) => row.id);
      return { value: await scalar(transaction, sql`SELECT coalesce(sum(unit_cost), 0)::text AS value FROM inventory.serials WHERE id = ANY(${pgArray(ids)}::uuid[])`), serialIds: ids };
    }
    const unitCost = entry.unitCost ?? (entry.totalValue ? await scalar(transaction, sql`SELECT round(${entry.totalValue}::numeric / ${entry.serials!.length}, 4)::text AS value`) : averageCost);
    const serialIds: string[] = [];
    for (const serialNo of entry.serials!) {
      const row = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.serials (company_id, variant_id, serial_no, warehouse_id, location_id, status, unit_cost)
        VALUES (${entry.companyId}, ${entry.variantId}, ${serialNo}, ${entry.warehouseId}, ${entry.locationId}, 'in_stock', ${unitCost}::numeric)
        ON CONFLICT (company_id, serial_no) DO UPDATE SET warehouse_id = EXCLUDED.warehouse_id, location_id = EXCLUDED.location_id, status = 'in_stock',
          unit_cost = EXCLUDED.unit_cost, updated_at = now()
        WHERE inventory.serials.status <> 'in_stock' AND inventory.serials.variant_id = EXCLUDED.variant_id
        RETURNING id`)
      ).rows[0];
      if (!row) throw new ApiError("BUSINESS_RULE", "serialAlreadyInStock");
      serialIds.push(row.id);
    }
    const value = await scalar(transaction, sql`SELECT round(${unitCost}::numeric * ${entry.serials!.length}, 4)::text AS value`);
    return { value, serialIds };
  }

  // Serial xuất: phải đang ở đúng kho, vị trí, biến thể; giá vốn đích danh.
  private async issueSerials(transaction: Executor, entry: LedgerEntry): Promise<{ value: string; serialIds: string[] }> {
    const rows = await transaction.execute<{ id: string; unit_cost: string }>(sql`
      SELECT id, unit_cost::text FROM inventory.serials
      WHERE company_id = ${entry.companyId} AND variant_id = ${entry.variantId} AND warehouse_id = ${entry.warehouseId} AND status = 'in_stock'
        AND location_id IS NOT DISTINCT FROM ${entry.locationId} AND serial_no = ANY(${pgArray(entry.serials!)}::text[])
      FOR UPDATE`);
    if (rows.rows.length !== entry.serials!.length) throw new ApiError("BUSINESS_RULE", "serialNotInStock");
    const after = entry.serialStatusAfter ?? "issued";
    await transaction.execute(sql`
      UPDATE inventory.serials SET status = ${after}, warehouse_id = ${after === "issued" ? null : entry.warehouseId}, location_id = NULL, updated_at = now()
      WHERE id = ANY(${pgArray(rows.rows.map((row) => row.id))}::uuid[])`);
    const value = await scalar(transaction, sql`SELECT coalesce(sum(unit_cost), 0)::text AS value FROM inventory.serials WHERE id = ANY(${pgArray(rows.rows.map((row) => row.id))}::uuid[])`);
    return { value, serialIds: rows.rows.map((row) => row.id) };
  }
}

const key = (entry: LedgerEntry) => [entry.warehouseId, entry.companyId, entry.variantId, entry.lotId ?? "", entry.locationId ?? ""].join("|");

// Mảng PostgreSQL dạng chữ; phần tử được đặt trong ngoặc kép, thoát dấu ngoặc kép và gạch chéo.
export const pgArray = (values: string[]) => `{${values.map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;

async function scalar(transaction: Executor, query: ReturnType<typeof sql>): Promise<string> {
  return (await transaction.execute<{ value: string }>(query)).rows[0]!.value;
}
