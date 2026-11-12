// Phiếu điều chỉnh giá trị (CONG_VIEC_45; QUYTAC_NGHIEPVU_291): module Mua hàng gọi khi ghi sổ tờ khai, chứng từ chi phí nhập khẩu.
// Số tiền của mỗi dòng đơn mua chia phần còn tồn (cộng vào giá trị tồn kho) và phần đã xuất (giá vốn hàng bán) tại thời điểm ghi sổ, tại kho nhận của đơn mua.
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { StockLedgerService } from "./stock-ledger.service";

type Executor = Pick<Database, "execute">;

export interface CostShareInput {
  orderLineId: string;
  variantId: string;
  // Số lượng (đơn vị cơ sở) mà số tiền thuộc về: số lượng khai trên tờ khai.
  baseQuantity: string;
  // Số tiền theo tiền tệ công ty, đã làm tròn theo đơn vị nhỏ nhất.
  amount: string;
}
export interface CostShare {
  orderLineId: string;
  // Tồn (đơn vị cơ sở) dùng để chia: serial nhập từ dòng đơn còn trong kho, hoặc tồn của mặt hàng tại kho.
  onHand: string;
  stockValue: string;
  expensedValue: string;
  serialIds: string[];
}

@Injectable()
export class CostAdjustmentsService {
  constructor(private readonly ledger: StockLedgerService) {}

  // Chia phần tồn, phần đã xuất; không ghi gì. Gọi trong giao dịch ghi sổ sau khi đã khóa chứng từ nguồn.
  async shares(executor: Executor, companyId: string, warehouseId: string, lines: CostShareInput[]): Promise<CostShare[]> {
    const units = Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${companyId}) AS units`)).rows[0]!.units);
    const result: CostShare[] = [];
    for (const line of lines) {
      const tracksSerials = (
        await executor.execute<{ tracks_serials: boolean }>(sql`SELECT p.tracks_serials FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${line.variantId}`)
      ).rows[0]!.tracks_serials;
      let onHand: string;
      let serialIds: string[] = [];
      if (tracksSerials) {
        serialIds = (
          await executor.execute<{ id: string }>(sql`
          SELECT DISTINCT s.id FROM inventory.document_line_serials ls JOIN inventory.document_lines dl ON dl.id = ls.line_id JOIN inventory.documents d ON d.id = dl.document_id
          JOIN inventory.serials s ON s.id = ls.serial_id
          WHERE dl.source_line_id = ${line.orderLineId} AND d.type = 'purchase_receipt' AND d.status = 'posted'
            AND s.status = 'in_stock' AND s.warehouse_id = ${warehouseId} AND s.company_id = ${companyId}
          ORDER BY s.id`)
        ).rows.map((row) => row.id);
        onHand = String(serialIds.length);
      } else {
        onHand =
          (
            await executor.execute<{ quantity: string }>(sql`
            SELECT quantity::text FROM inventory.costs WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${line.variantId}`)
          ).rows[0]?.quantity ?? "0";
      }
      const split = (
        await executor.execute<{ stock: string }>(sql`
        SELECT round(${line.amount}::numeric * least(1, ${onHand}::numeric / ${line.baseQuantity}::numeric), ${units})::text AS stock`)
      ).rows[0]!;
      // Giảm giá trị (tờ khai bổ sung giảm thuế, CONG_VIEC_56; QUYTAC_NGHIEPVU_414): phần tồn không làm giá trị tồn âm, phần thiếu vào giá vốn hàng bán.
      if (Number(split.stock) < 0) {
        const available = tracksSerials
          ? ((await executor.execute<{ value: string }>(sql`SELECT coalesce(sum(unit_cost), 0)::text AS value FROM inventory.serials WHERE id = ANY(${`{${serialIds.join(",")}}`}::uuid[])`)).rows[0]!
              .value ?? "0")
          : ((
              await executor.execute<{ value: string }>(sql`
              SELECT value::text FROM inventory.costs WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${line.variantId}`)
            ).rows[0]?.value ?? "0");
        if (-Number(split.stock) > Number(available)) split.stock = (-Math.max(0, Number(available))).toFixed(4);
      }
      const expensed = (await executor.execute<{ value: string }>(sql`SELECT (${line.amount}::numeric - ${split.stock}::numeric)::text AS value`)).rows[0]!.value;
      result.push({ orderLineId: line.orderLineId, onHand, stockValue: split.stock, expensedValue: expensed, serialIds });
    }
    return result;
  }

  // Ghi phiếu điều chỉnh giá trị đã ghi sổ và cộng giá trị tồn; trả về phần tồn, phần đã xuất của từng dòng.
  async post(
    transaction: Executor,
    input: { companyId: string; warehouseId: string; documentNo: string; documentDate: string; sourceType: string; sourceId: string; reason: string; createdBy: string; lines: CostShareInput[] },
  ): Promise<CostShare[]> {
    const shares = await this.shares(transaction, input.companyId, input.warehouseId, input.lines);
    const documentId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.documents (company_id, warehouse_id, type, document_no, document_date, reason_code, reason, status, source_type, source_id, created_by, submitted_at, posted_at)
      VALUES (${input.companyId}, ${input.warehouseId}, 'cost_adjustment', ${input.documentNo}, ${input.documentDate}::date, 'import_cost', ${input.reason}, 'posted', ${input.sourceType},
        ${input.sourceId}, ${input.createdBy}, now(), now())
      RETURNING id`)
    ).rows[0]!.id;
    for (const [index, line] of input.lines.entries()) {
      const share = shares[index]!;
      if (Number(line.amount) === 0) continue;
      const lineId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.document_lines (document_id, line_no, variant_id, unit_id, quantity, base_quantity, cost_value, expensed_value, source_line_id)
        SELECT ${documentId}, ${index + 1}, v.id, p.base_unit_id, ${line.baseQuantity}::numeric, ${line.baseQuantity}::numeric, ${share.stockValue}::numeric, ${share.expensedValue}::numeric,
          ${line.orderLineId}
        FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${line.variantId}
        RETURNING id`)
      ).rows[0]!.id;
      if (Number(share.stockValue) === 0) continue;
      await this.ledger.adjustValue(transaction, {
        warehouseId: input.warehouseId,
        companyId: input.companyId,
        variantId: line.variantId,
        value: share.stockValue,
        serialShares: serialShares(share),
        documentId,
        lineId,
      });
    }
    return shares;
  }
}

// Chia đều phần tồn cho các serial còn trong kho (4 chữ số thập phân), serial cuối nhận phần lẻ để tổng đúng bằng phần tồn.
function serialShares(share: CostShare): { serialId: string; value: string }[] {
  if (share.serialIds.length === 0) return [];
  const total = Math.round(Number(share.stockValue) * 10000);
  const each = Math.floor(total / share.serialIds.length);
  return share.serialIds.map((serialId, index) => ({
    serialId,
    value: ((index === share.serialIds.length - 1 ? total - each * (share.serialIds.length - 1) : each) / 10000).toFixed(4),
  }));
}
