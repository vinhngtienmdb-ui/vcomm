// Chuyển kho hai bước (CHUC_NANG_41; QUYTAC_NGHIEPVU_52; API_66; TIEUCHI_NGHIEMTHU_69).
// Phiếu đã duyệt: kho nguồn xác nhận xuất (trừ tồn, hàng đang vận chuyển, giữ giá vốn); kho đích nhận theo số thực nhận,
// chênh lệch lập biên bản; phần thiếu ghi người chịu trách nhiệm, tiền bồi thường (quyết định ngày 2026-11-10).
import { Inject, Injectable } from "@nestjs/common";
import type { receiveTransferSchema, StockDocumentResponse, TransferDestination } from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { ReservationsService } from "./reservations.service";
import { documentSource, StockDocumentsService } from "./stock-documents.service";
import { StockLedgerService } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

@Injectable()
export class TransfersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly warehouses: WarehousesService,
    private readonly documents: StockDocumentsService,
    private readonly ledger: StockLedgerService,
    private readonly reservations: ReservationsService,
  ) {}

  // Kho đích: kho đang dùng, nhận hàng của công ty chủ hàng (QUYTAC_NGHIEPVU_52).
  async destinations(actor: Actor, companyId: string): Promise<TransferDestination[]> {
    if (!(await this.warehouses.list(actor)).some((warehouse) => warehouse.canOperate)) throw new ApiError("FORBIDDEN", "forbidden");
    const rows = await this.database.execute<{ id: string; code: string; name: string; company_name: string; uses_locations: boolean }>(sql`
      SELECT w.id, w.code, w.name, c.short_name AS company_name, w.uses_locations FROM inventory.warehouses w JOIN core.companies c ON c.id = w.company_id
      WHERE w.status = 'active' AND EXISTS (SELECT 1 FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id AND o.company_id = ${companyId})
      ORDER BY c.short_name, w.code`);
    return rows.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, companyName: row.company_name, usesLocations: row.uses_locations }));
  }

  async ship(actor: Actor, id: string): Promise<StockDocumentResponse> {
    const document = await this.documents.visibleRow(actor, id);
    if (document.type !== "transfer") throw new ApiError("NOT_FOUND", "notFound");
    await this.warehouses.operable(actor.userId, document.warehouse_id, inventoryPermissions.manageDocuments);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'posted' FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("BUSINESS_RULE", "transferNotReadyToShip");
      const lines = await this.documents.lines(id, transaction);
      const results = await this.ledger.postAll(
        transaction,
        lines.map((line) => ({
          warehouseId: document.warehouse_id,
          companyId: document.company_id,
          variantId: line.variant_id,
          lotId: line.lot_id,
          locationId: line.location_id,
          quantity: `-${line.base_quantity}`,
          serials: line.tracks_serials ? line.serials : undefined,
          serialStatusAfter: "in_transit" as const,
          documentId: id,
          lineId: line.id,
        })),
      );
      for (const [index, result] of results.entries()) {
        await transaction.execute(sql`UPDATE inventory.document_lines SET cost_value = ${result.value.replace(/^-/, "")}::numeric WHERE id = ${lines[index]!.id}`);
      }
      await transaction.execute(sql`UPDATE inventory.documents SET status = 'in_transit', shipped_at = now(), shipped_by = ${actor.userId}, updated_at = now() WHERE id = ${id}`);
      await this.reservations.closeBySource(transaction, documentSource, id, "consumed");
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: document.company_id, action: "stock_document.ship", entityId: id }, transaction);
    });
    return this.documents.detail(actor, id);
  }

  // Nhận theo số thực nhận; nhận thiếu, thừa thì lập biên bản chênh lệch với giá trị theo giá vốn lúc xuất.
  async receive(actor: Actor, id: string, input: z.output<typeof receiveTransferSchema>): Promise<StockDocumentResponse> {
    const document = await this.documents.visibleRow(actor, id);
    if (document.type !== "transfer" || !document.destination_warehouse_id) throw new ApiError("NOT_FOUND", "notFound");
    const destination = await this.warehouses.operable(actor.userId, document.destination_warehouse_id, inventoryPermissions.manageDocuments);
    const lines = await this.documents.lines(id);
    const locations = new Set(
      (await this.database.execute<{ id: string }>(sql`SELECT id FROM inventory.locations WHERE warehouse_id = ${destination.id} AND status = 'active'`)).rows.map((row) => row.id),
    );
    const fields: Record<string, keyof Messages["errors"]> = {};
    const received = new Map(input.lines.map((line) => [line.lineId, line]));
    lines.forEach((line, index) => {
      const at = (field: string) => `lines.${index}.${field}`;
      const entry = received.get(line.id);
      if (!entry) {
        fields[at("receivedQuantity")] = "required";
        return;
      }
      if (destination.usesLocations && (!entry.destinationLocationId || !locations.has(entry.destinationLocationId))) fields[at("destinationLocationId")] = "required";
      if (!destination.usesLocations && entry.destinationLocationId) fields[at("destinationLocationId")] = "invalidValue";
      if (line.tracks_serials) {
        if (entry.serials.length !== Number(entry.receivedQuantity)) fields[at("serials")] = "serialCountMismatch";
        else if (entry.serials.some((serial) => !line.serials.includes(serial))) fields[at("serials")] = "serialNotShipped";
      }
    });
    if (input.lines.some((line) => !lines.some((item) => item.id === line.lineId))) fields.lines = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'in_transit' FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("BUSINESS_RULE", "transferNotInTransit");
      const current = await this.documents.lines(id, transaction);
      for (const line of current) {
        const entry = received.get(line.id)!;
        const shipped = Number(line.base_quantity);
        const unitCost = (await transaction.execute<{ value: string }>(sql`SELECT round(${line.cost_value ?? "0"}::numeric / ${line.base_quantity}::numeric, 4)::text AS value`)).rows[0]!.value;
        if (Number(entry.receivedQuantity) > 0) {
          await this.ledger.post(transaction, {
            warehouseId: destination.id,
            companyId: document.company_id,
            variantId: line.variant_id,
            lotId: line.lot_id,
            locationId: entry.destinationLocationId ?? null,
            quantity: entry.receivedQuantity,
            totalValue: Number(entry.receivedQuantity) === shipped ? line.cost_value : null,
            unitCost,
            serials: line.tracks_serials ? entry.serials : undefined,
            keepSerialCost: true,
            documentId: id,
            lineId: line.id,
          });
        }
        await transaction.execute(sql`
          UPDATE inventory.document_lines SET received_base_quantity = ${entry.receivedQuantity}::numeric, destination_location_id = ${entry.destinationLocationId ?? null} WHERE id = ${line.id}`);
        if (Number(entry.receivedQuantity) !== shipped) {
          await transaction.execute(sql`
            INSERT INTO inventory.transfer_discrepancies (document_id, line_id, shipped_quantity, received_quantity, difference, value, note, responsible_user_id, compensation_amount, created_by)
            SELECT ${id}, ${line.id}, ${line.base_quantity}::numeric, ${entry.receivedQuantity}::numeric, d.difference, round(d.difference * ${unitCost}::numeric, 4), ${input.note ?? null},
              CASE WHEN d.difference < 0 THEN ${entry.responsibleUserId ?? null}::uuid END,
              CASE WHEN d.difference < 0 THEN coalesce(${entry.compensationAmount ?? null}::numeric, round(-d.difference * ${unitCost}::numeric, 4)) END,
              ${actor.userId}
            FROM (SELECT ${entry.receivedQuantity}::numeric - ${line.base_quantity}::numeric AS difference) d`);
        }
      }
      await transaction.execute(sql`UPDATE inventory.documents SET status = 'received', received_at = now(), received_by = ${actor.userId}, updated_at = now() WHERE id = ${id}`);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: document.company_id, action: "stock_document.receive", entityId: id, afterData: input }, transaction);
    });
    return this.documents.detail(actor, id);
  }
}
