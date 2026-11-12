// In tem PDF khổ tem nhiệt 50 × 30 mm (CHUC_NANG_45; API_70; TIEUCHI_NGHIEMTHU_73): tem sản phẩm (mã vạch của đơn vị cơ sở, không có thì mã hàng), tem vị trí.
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { renderPdf } from "../common/pdf";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { code128Widths } from "./code128";
import { inventoryPermissions } from "./inventory-context";
import { pgArray } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

const millimetre = 72 / 25.4;
export const labelSize = { width: 50 * millimetre, height: 30 * millimetre };
const margin = 2 * millimetre;
type Label = { title: string; subtitle: string; code: string };

@Injectable()
export class LabelsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly warehouses: WarehousesService,
  ) {}

  async products(actor: Actor, companyId: string, variantIds: string[], copies: number): Promise<Buffer> {
    const { operable } = await this.warehouses.stockScope(actor);
    const accepted = await this.database.execute(sql`SELECT 1 FROM inventory.warehouse_owners WHERE company_id = ${companyId} AND warehouse_id = ANY(${pgArray(operable)}::uuid[]) LIMIT 1`);
    if (operable.length === 0 || accepted.rows.length === 0) throw new ApiError("FORBIDDEN", "forbidden");
    const rows = await this.database.execute<{ sku: string; product_name: string; option_values: string[]; barcode: string | null }>(sql`
      SELECT v.sku, p.name AS product_name, v.option_values,
        (SELECT b.barcode FROM catalog.barcodes b WHERE b.variant_id = v.id AND b.unit_id = p.base_unit_id ORDER BY b.barcode LIMIT 1) AS barcode
      FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
      WHERE v.company_id = ${companyId} AND v.id = ANY(${pgArray(variantIds)}::uuid[]) ORDER BY v.sku`);
    if (rows.rows.length !== new Set(variantIds).size) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { variantIds: "stockItemNotOwned" } });
    const labels = rows.rows.flatMap((row) =>
      Array.from({ length: copies }, () => ({ title: row.product_name, subtitle: [row.sku, ...row.option_values].join(" · "), code: asciiCode(row.barcode ?? row.sku) })),
    );
    return this.render(labels);
  }

  async locations(actor: Actor, warehouseId: string): Promise<Buffer> {
    await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.access);
    const rows = await this.database.execute<{ code: string; name: string | null; warehouse_name: string }>(sql`
      SELECT l.code, l.name, w.name AS warehouse_name FROM inventory.locations l JOIN inventory.warehouses w ON w.id = l.warehouse_id
      WHERE l.warehouse_id = ${warehouseId} AND l.status = 'active' ORDER BY l.code`);
    if (rows.rows.length === 0) throw new ApiError("BUSINESS_RULE", "noLocationsToPrint");
    return this.render(rows.rows.map((row) => ({ title: row.warehouse_name, subtitle: row.name ?? "", code: asciiCode(row.code) })));
  }

  // Mỗi tem một trang; mã vạch co giãn theo chiều rộng tem, chữ dưới mã vạch là chính mã đó.
  private async render(labels: Label[]): Promise<Buffer> {
    const width = labelSize.width - 2 * margin;
    const content = labels.map((label, index) => {
      const widths = code128Widths(label.code);
      const modules = widths.reduce((sum, value) => sum + value, 0) + 20;
      const unit = width / modules;
      let x = 10 * unit;
      const bars: Record<string, unknown>[] = [];
      widths.forEach((value, position) => {
        if (position % 2 === 0) bars.push({ type: "rect", x, y: 0, w: value * unit, h: 11 * millimetre, color: "black" });
        x += value * unit;
      });
      return [
        { text: label.title, bold: true, fontSize: 7, maxHeight: 9, margin: [0, 0, 0, 1], ...(index > 0 ? { pageBreak: "before" } : {}) },
        { text: label.subtitle, fontSize: 6, margin: [0, 0, 0, 2] },
        { canvas: bars },
        { text: label.code, fontSize: 7, alignment: "center", margin: [0, 1, 0, 0] },
      ];
    });
    // Dùng bảng phông chung (common/pdf): đăng ký lại phông ở đây sẽ ghi đè phông của nơi khác (văn bản hành chính) tùy thứ tự nạp module.
    return renderPdf({ pageSize: { width: labelSize.width, height: labelSize.height }, pageMargins: [margin, margin, margin, margin], content, defaultStyle: { font: "Roboto" } });
  }
}

// Code 128 B chỉ in được ký tự ASCII: bỏ dấu tiếng Việt, ký tự khác thay bằng dấu gạch.
function asciiCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, "-");
}
