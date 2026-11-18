// Cổng cửa hàng nhóm iPOS: tồn kho theo điểm bán, phiếu nhập `PN…`, phiếu điều chỉnh `PC…`, lịch sử biến động (CONG_VIEC_74; CHUC_NANG_255; QUYTAC_NGHIEPVU_611; API_347).
// Phiếu ghi xong không sửa. Giá vốn bình quân gia quyền theo (điểm bán, biến thể) cập nhật khi nhập; tồn âm thì phần âm không tham gia bình quân.
import { Inject, Injectable } from "@nestjs/common";
import type { IposStockDocumentDetail, IposStockDocumentInput, IposStockDocumentKind, IposStockDocumentRow, IposStockMove, IposStockRow } from "contracts";
import { sql } from "drizzle-orm";
import type { PortalMember } from "../affiliate/portal.service";
import { searchText } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { nextNumber, type Executor } from "./ipos-catalog.service";

export type ReceiptLine = { variantId: string; quantity: string; unitCost: string };
type AdjustmentLine = { variantId: string; actualQuantity: string };

// Điểm bán phải thuộc cửa hàng và có thuê bao chưa hủy.
export async function requireStockOutlet(executor: Executor, merchantId: string, outletId: string): Promise<void> {
  const found = await executor.execute(sql`SELECT 1 FROM ipos.subscriptions WHERE merchant_id = ${merchantId} AND outlet_id = ${outletId} AND status <> 'cancelled'`);
  if (found.rows.length === 0) throw new ApiError("BUSINESS_RULE", "iposNoSubscription");
}

// Biến thể phải thuộc cửa hàng, của mặt hàng theo dõi tồn kho; không trùng trong một phiếu.
async function checkVariants(executor: Executor, merchantId: string, variantIds: string[]): Promise<void> {
  if (new Set(variantIds).size !== variantIds.length) throw new ApiError("BUSINESS_RULE", "iposStockDuplicateLine");
  const rows = await executor.execute<{ id: string; track_stock: boolean }>(sql`
    SELECT v.id, i.track_stock FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
    WHERE v.merchant_id = ${merchantId} AND v.id IN (${sql.join(variantIds.map((id) => sql`${id}`), sql`, `)})`);
  if (rows.rows.length !== variantIds.length) throw new ApiError("NOT_FOUND", "notFound");
  if (rows.rows.some((row) => !row.track_stock)) throw new ApiError("BUSINESS_RULE", "iposItemNotTracked");
}

// Khóa dòng tồn theo thứ tự biến thể để hai phiếu cùng lúc không khóa chéo; chưa có dòng tồn thì tạo dòng 0.
async function lockBalances(executor: Executor, merchantId: string, outletId: string, variantIds: string[]): Promise<Map<string, { quantity: string; averageCost: string }>> {
  const sorted = [...variantIds].sort();
  await executor.execute(sql`
    INSERT INTO ipos.stock_balances (outlet_id, variant_id, merchant_id)
    SELECT ${outletId}::uuid, id, ${merchantId}::uuid FROM unnest(ARRAY[${sql.join(sorted.map((id) => sql`${id}::uuid`), sql`, `)}]) AS id
    ON CONFLICT (outlet_id, variant_id) DO NOTHING`);
  const rows = await executor.execute<{ variant_id: string; quantity: string; average_cost: string }>(sql`
    SELECT variant_id, quantity::text, average_cost::text FROM ipos.stock_balances
    WHERE outlet_id = ${outletId} AND variant_id IN (${sql.join(sorted.map((id) => sql`${id}`), sql`, `)})
    ORDER BY variant_id FOR UPDATE`);
  return new Map(rows.rows.map((row) => [row.variant_id, { quantity: row.quantity, averageCost: row.average_cost }]));
}

async function createDocument(
  executor: Executor,
  actor: { merchantId: string; userId: string },
  outletId: string,
  kind: IposStockDocumentKind,
  note: string | null,
  source: "manual" | "import",
): Promise<{ id: string; number: string }> {
  const number = `${kind === "receipt" ? "PN" : "PC"}${String(await nextNumber(executor, actor.merchantId, kind)).padStart(6, "0")}`;
  const created = await executor.execute<{ id: string }>(sql`
    INSERT INTO ipos.stock_documents (merchant_id, outlet_id, number, kind, source, note, created_by)
    VALUES (${actor.merchantId}, ${outletId}, ${number}, ${kind}, ${source}, ${note}, ${actor.userId}) RETURNING id`);
  return { id: created.rows[0]!.id, number };
}

// Phiếu nhập: tồn mới = tồn cũ + số nhập; giá vốn mới = (max(tồn cũ, 0) × giá vốn cũ + số nhập × giá nhập) / (max(tồn cũ, 0) + số nhập).
// Dùng chung cho nhập tồn đầu kỳ từ Excel (QUYTAC_NGHIEPVU_610).
export async function applyReceipt(
  executor: Executor,
  actor: { merchantId: string; userId: string },
  outletId: string,
  lines: ReceiptLine[],
  note: string | null,
  source: "manual" | "import",
): Promise<{ id: string; number: string }> {
  const balances = await lockBalances(executor, actor.merchantId, outletId, lines.map((line) => line.variantId));
  const document = await createDocument(executor, actor, outletId, "receipt", note, source);
  for (const line of lines) {
    const before = balances.get(line.variantId)!;
    await executor.execute(sql`
      INSERT INTO ipos.stock_document_lines (document_id, variant_id, quantity, unit_cost, before_quantity)
      VALUES (${document.id}, ${line.variantId}, ${line.quantity}, ${line.unitCost}, ${before.quantity})`);
    const updated = await executor.execute<{ quantity: string }>(sql`
      UPDATE ipos.stock_balances SET
        average_cost = round((GREATEST(quantity, 0) * average_cost + ${line.quantity}::numeric * ${line.unitCost}::numeric) / (GREATEST(quantity, 0) + ${line.quantity}::numeric), 4),
        quantity = quantity + ${line.quantity}::numeric, updated_at = now()
      WHERE outlet_id = ${outletId} AND variant_id = ${line.variantId}
      RETURNING quantity::text`);
    await executor.execute(sql`
      INSERT INTO ipos.stock_moves (merchant_id, outlet_id, variant_id, quantity, unit_cost, balance_after, source_type, source_id, source_number, created_by)
      VALUES (${actor.merchantId}, ${outletId}, ${line.variantId}, ${line.quantity}, ${line.unitCost}, ${updated.rows[0]!.quantity}, 'stock_document', ${document.id}, ${document.number}, ${actor.userId})`);
  }
  return document;
}

// Phiếu điều chỉnh: tồn mới = số lượng thực tế; chênh lệch ghi biến động theo giá vốn bình quân hiện tại (giá vốn không đổi).
async function applyAdjustment(executor: Executor, actor: { merchantId: string; userId: string }, outletId: string, lines: AdjustmentLine[], note: string): Promise<{ id: string; number: string }> {
  const balances = await lockBalances(executor, actor.merchantId, outletId, lines.map((line) => line.variantId));
  const document = await createDocument(executor, actor, outletId, "adjustment", note, "manual");
  for (const line of lines) {
    const before = balances.get(line.variantId)!;
    await executor.execute(sql`
      INSERT INTO ipos.stock_document_lines (document_id, variant_id, actual_quantity, before_quantity)
      VALUES (${document.id}, ${line.variantId}, ${line.actualQuantity}, ${before.quantity})`);
    const difference = await executor.execute<{ difference: string }>(sql`SELECT (${line.actualQuantity}::numeric - ${before.quantity}::numeric)::text AS difference`);
    if (Number(difference.rows[0]!.difference) === 0) continue;
    await executor.execute(sql`UPDATE ipos.stock_balances SET quantity = ${line.actualQuantity}::numeric, updated_at = now() WHERE outlet_id = ${outletId} AND variant_id = ${line.variantId}`);
    await executor.execute(sql`
      INSERT INTO ipos.stock_moves (merchant_id, outlet_id, variant_id, quantity, unit_cost, balance_after, source_type, source_id, source_number, created_by)
      VALUES (${actor.merchantId}, ${outletId}, ${line.variantId}, ${difference.rows[0]!.difference}, ${before.averageCost}, ${line.actualQuantity}, 'stock_document', ${document.id}, ${document.number}, ${actor.userId})`);
  }
  return document;
}

const documentColumns = sql`d.id, d.number, d.kind, d.source, d.outlet_id, o.name AS outlet_name, d.note, u.full_name AS created_by_name, d.created_at,
  (SELECT count(*)::int FROM ipos.stock_document_lines l WHERE l.document_id = d.id) AS line_count,
  (SELECT sum(l.quantity * l.unit_cost)::numeric(18,0)::text FROM ipos.stock_document_lines l WHERE l.document_id = d.id) AS total_cost`;
type DocumentRow = {
  id: string;
  number: string;
  kind: IposStockDocumentKind;
  source: "manual" | "import";
  outlet_id: string;
  outlet_name: string;
  note: string | null;
  created_by_name: string;
  created_at: Date;
  line_count: number;
  total_cost: string | null;
};
const toDocument = (row: DocumentRow): IposStockDocumentRow => ({
  id: row.id,
  number: row.number,
  kind: row.kind,
  source: row.source,
  outletId: row.outlet_id,
  outletName: row.outlet_name,
  note: row.note,
  lineCount: row.line_count,
  totalCost: row.total_cost,
  createdByName: row.created_by_name,
  createdAt: new Date(row.created_at).toISOString(),
});

@Injectable()
export class IposStockService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private async outletOf(member: PortalMember, outletId: string): Promise<void> {
    const found = await this.database.execute(sql`SELECT 1 FROM affiliate.outlets WHERE id = ${outletId} AND merchant_id = ${member.merchantId}`);
    if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  // Tồn theo điểm bán: mọi biến thể đang bán của mặt hàng theo dõi tồn kho, cùng biến thể ngừng bán còn tồn khác 0.
  async stock(member: PortalMember, query: { outletId: string; search?: string; belowMin?: boolean; negative?: boolean }): Promise<IposStockRow[]> {
    await this.outletOf(member, query.outletId);
    const pattern = query.search ? `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%` : null;
    const rows = await this.database.execute<{
      variant_id: string;
      item_id: string;
      item_code: string;
      variant_code: string;
      name: string;
      unit: string;
      quantity: string;
      min_quantity: string | null;
      average_cost: string;
      value: string;
    }>(sql`
      SELECT * FROM (
        SELECT v.id AS variant_id, i.id AS item_id, i.code AS item_code, v.code AS variant_code, i.unit,
          i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
          trim_scale(COALESCE(b.quantity, 0))::text AS quantity, trim_scale(v.min_quantity)::text AS min_quantity,
          round(COALESCE(b.average_cost, 0))::text AS average_cost, round(COALESCE(b.quantity, 0) * COALESCE(b.average_cost, 0))::text AS value,
          COALESCE(b.quantity, 0) AS raw_quantity, v.min_quantity AS raw_min, v.sort_order
        FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
        LEFT JOIN ipos.stock_balances b ON b.variant_id = v.id AND b.outlet_id = ${query.outletId}
        WHERE v.merchant_id = ${member.merchantId} AND i.track_stock
          AND ((v.status = 'active' AND i.status = 'active') OR COALESCE(b.quantity, 0) <> 0)
          ${pattern ? sql`AND (i.search_text LIKE ${pattern} OR lower(v.code) LIKE ${pattern})` : sql``}
      ) s
      WHERE true
        ${query.belowMin ? sql`AND s.raw_min IS NOT NULL AND s.raw_quantity < s.raw_min` : sql``}
        ${query.negative ? sql`AND s.raw_quantity < 0` : sql``}
      ORDER BY s.item_code, s.sort_order
      LIMIT 1000`);
    return rows.rows.map((row) => ({
      variantId: row.variant_id,
      itemId: row.item_id,
      itemCode: row.item_code,
      variantCode: row.variant_code,
      name: row.name,
      unit: row.unit,
      quantity: row.quantity,
      minQuantity: row.min_quantity,
      averageCost: row.average_cost,
      value: row.value,
    }));
  }

  async documents(member: PortalMember, outletId: string | undefined): Promise<IposStockDocumentRow[]> {
    const rows = await this.database.execute<DocumentRow>(sql`
      SELECT ${documentColumns}
      FROM ipos.stock_documents d JOIN affiliate.outlets o ON o.id = d.outlet_id JOIN core.users u ON u.id = d.created_by
      WHERE d.merchant_id = ${member.merchantId} ${outletId ? sql`AND d.outlet_id = ${outletId}` : sql``}
      ORDER BY d.created_at DESC, d.number DESC LIMIT 200`);
    return rows.rows.map(toDocument);
  }

  async document(member: PortalMember, id: string): Promise<IposStockDocumentDetail> {
    const rows = await this.database.execute<DocumentRow>(sql`
      SELECT ${documentColumns}
      FROM ipos.stock_documents d JOIN affiliate.outlets o ON o.id = d.outlet_id JOIN core.users u ON u.id = d.created_by
      WHERE d.id = ${id} AND d.merchant_id = ${member.merchantId}`);
    if (!rows.rows[0]) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{
      variant_id: string;
      item_code: string;
      variant_code: string;
      name: string;
      unit: string;
      quantity: string | null;
      unit_cost: string | null;
      actual_quantity: string | null;
      before_quantity: string;
    }>(sql`
      SELECT l.variant_id, i.code AS item_code, v.code AS variant_code, i.unit,
        i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
        trim_scale(l.quantity)::text AS quantity, trim_scale(l.unit_cost)::text AS unit_cost, trim_scale(l.actual_quantity)::text AS actual_quantity, trim_scale(l.before_quantity)::text AS before_quantity
      FROM ipos.stock_document_lines l JOIN ipos.item_variants v ON v.id = l.variant_id JOIN ipos.items i ON i.id = v.item_id
      WHERE l.document_id = ${id} ORDER BY i.code, v.sort_order`);
    return {
      ...toDocument(rows.rows[0]),
      lines: lines.rows.map((line) => ({
        variantId: line.variant_id,
        itemCode: line.item_code,
        variantCode: line.variant_code,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        unitCost: line.unit_cost,
        actualQuantity: line.actual_quantity,
        beforeQuantity: line.before_quantity,
      })),
    };
  }

  async createDocument(member: PortalMember, input: IposStockDocumentInput): Promise<IposStockDocumentDetail> {
    const id = await this.database.transaction(async (transaction) => {
      await requireStockOutlet(transaction, member.merchantId, input.outletId);
      await checkVariants(transaction, member.merchantId, input.lines.map((line) => line.variantId));
      const document =
        input.kind === "receipt"
          ? await applyReceipt(transaction, member, input.outletId, input.lines, input.note, "manual")
          : await applyAdjustment(transaction, member, input.outletId, input.lines, input.note);
      await this.audit.record(
        {
          actorUserId: member.userId,
          companyId: member.companyId,
          appCode: "affiliate",
          action: `ipos.stock_document.${input.kind}`,
          entityType: "ipos_stock_document",
          entityId: document.id,
          afterData: { number: document.number, outletId: input.outletId, lines: input.lines.length },
          ip: member.client.ip,
          userAgent: member.client.userAgent,
          requestId: member.client.requestId,
        },
        transaction,
      );
      return document.id;
    });
    return this.document(member, id);
  }

  async moves(member: PortalMember, query: { outletId: string; variantId?: string }): Promise<IposStockMove[]> {
    await this.outletOf(member, query.outletId);
    const rows = await this.database.execute<{
      id: string;
      occurred_at: Date;
      variant_id: string;
      item_code: string;
      variant_code: string;
      name: string;
      quantity: string;
      unit_cost: string;
      balance_after: string;
      source_type: "stock_document" | "sale" | "return";
      source_id: string;
      source_number: string;
      created_by_name: string;
    }>(sql`
      SELECT m.id, m.occurred_at, m.variant_id, i.code AS item_code, v.code AS variant_code,
        i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
        trim_scale(m.quantity)::text AS quantity, round(m.unit_cost)::text AS unit_cost, trim_scale(m.balance_after)::text AS balance_after,
        m.source_type, m.source_id, m.source_number, u.full_name AS created_by_name
      FROM ipos.stock_moves m JOIN ipos.item_variants v ON v.id = m.variant_id JOIN ipos.items i ON i.id = v.item_id JOIN core.users u ON u.id = m.created_by
      WHERE m.merchant_id = ${member.merchantId} AND m.outlet_id = ${query.outletId} ${query.variantId ? sql`AND m.variant_id = ${query.variantId}` : sql``}
      ORDER BY m.occurred_at DESC, m.id LIMIT 300`);
    return rows.rows.map((row) => ({
      id: row.id,
      occurredAt: new Date(row.occurred_at).toISOString(),
      variantId: row.variant_id,
      itemCode: row.item_code,
      variantCode: row.variant_code,
      name: row.name,
      quantity: row.quantity,
      unitCost: row.unit_cost,
      balanceAfter: row.balance_after,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceNumber: row.source_number,
      createdByName: row.created_by_name,
    }));
  }
}
