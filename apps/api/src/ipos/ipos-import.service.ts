// Nhập mặt hàng iPOS từ Excel (CONG_VIEC_74; QUYTAC_NGHIEPVU_610; TIEUCHI_NGHIEMTHU_570; API_346).
// Kiểm toàn bộ tệp trước, báo lỗi theo dòng; chỉ ghi khi không có lỗi, ghi tất cả trong một giao dịch.
// Mỗi dòng là một mặt hàng không thuộc tính (một biến thể mặc định); dòng trùng mã cập nhật tên, nhóm, đơn vị, giá, thuế, mã vạch.
import { Inject, Injectable } from "@nestjs/common";
import { iposImportColumns, iposImportMaximumBytes, iposImportMaximumRows, type IposImportError, type IposImportResult, type IposVatRate } from "contracts";
import { sql } from "drizzle-orm";
import { messages, type Locale } from "i18n";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import type { PortalMember } from "../affiliate/portal.service";
import { searchText } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { activeVariants, itemLimit, lockCatalog, requireWritable, type Executor } from "./ipos-catalog.service";
import { applyReceipt, requireStockOutlet } from "./ipos-stock.service";

type Cell = string | number | boolean | Date | null;
type Column = (typeof iposImportColumns)[number];
const column = Object.fromEntries(iposImportColumns.map((title, index) => [title, index])) as Record<Column, number>;
const vatByText: Record<string, IposVatRate> = { "0": "0", "5": "5", "8": "8", "10": "10", "không chịu thuế": "exempt", kct: "exempt" };
const text = (value: Cell | undefined): string => (value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim());

// Dòng đã kiểm: mã trống thì sinh khi ghi.
interface PlannedRow {
  number: number;
  code: string | null;
  name: string;
  group: string | null;
  subgroup: string | null;
  unit: string;
  price: string;
  vatRate: IposVatRate;
  trackStock: boolean;
  barcodes: string[];
  openingQuantity: string | null;
  openingCost: string | null;
  existingId: string | null;
}

interface Plan {
  rows: PlannedRow[];
  errors: IposImportError[];
}

// Giá: số nguyên đồng; chuỗi bỏ dấu chấm, dấu phẩy, khoảng trắng phân cách hàng nghìn.
function money(value: Cell | undefined): string | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 && value < 1e13 ? String(value) : null;
  const cleaned = text(value).replace(/[\s.,]/g, "");
  return /^\d{1,13}$/.test(cleaned) ? String(Number(cleaned)) : null;
}

// Số lượng, giá nhập: số thập phân không âm (dấu phẩy thập phân được chấp nhận).
function decimal(value: Cell | undefined, scale: number): string | null {
  if (typeof value === "number") return value >= 0 && Number.isFinite(value) ? String(Number(value.toFixed(scale))) : null;
  const cleaned = text(value).replace(/\s/g, "").replace(",", ".");
  return new RegExp(`^\\d{1,13}(\\.\\d{1,${scale}})?$`).test(cleaned) ? cleaned : null;
}

@Injectable()
export class IposImportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  // Tệp mẫu: dòng tiêu đề và hai dòng ví dụ.
  async template(): Promise<Buffer> {
    const header = iposImportColumns.map((title) => ({ value: title, fontWeight: "bold" as const }));
    const example = (values: string[]) => values.map((value) => ({ value }));
    return writeXlsxFile(
      [
        header,
        example(["", "Sữa tươi ít đường hộp 180ml", "Đồ uống", "Sữa", "Hộp", "8000", "8", "Có", "8934673102435", "48", "6500"]),
        example(["DV0001", "Phí gói quà", "Dịch vụ", "", "Lần", "10000", "Không chịu thuế", "Không", "", "", ""]),
      ],
      { sheet: "Hàng hóa" },
    ).toBuffer();
  }

  private async read(file: { buffer: Buffer; size: number } | undefined): Promise<{ number: number; cells: Cell[] }[]> {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > iposImportMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
    let sheet: Cell[][];
    try {
      sheet = (await readSheet(file.buffer)) as Cell[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const header = (sheet[0] ?? []).map(text);
    if (iposImportColumns.some((title, index) => header[index] !== title)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    const rows = sheet
      .slice(1)
      .map((cells, index) => ({ number: index + 2, cells: iposImportColumns.map((_, position) => cells[position] ?? null) }))
      .filter((row) => row.cells.some((cell) => text(cell) !== ""));
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileEmpty" } });
    if (rows.length > iposImportMaximumRows) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooManyRowsIpos" } });
    return rows;
  }

  // Kiểm toàn bộ tệp với dữ liệu hiện có của cửa hàng.
  private async plan(executor: Executor, member: PortalMember, rows: { number: number; cells: Cell[] }[], outletId: string | null, locale: Locale): Promise<Plan> {
    const words = messages[locale].iposImport;
    const errors: IposImportError[] = [];
    const fail = (row: number, name: Column | null, message: string) => errors.push({ row, column: name, message });
    const items = await executor.execute<{ id: string; code: string; has_attributes: boolean }>(sql`
      SELECT id, upper(code) AS code, attribute1_name IS NOT NULL AS has_attributes FROM ipos.items WHERE merchant_id = ${member.merchantId}`);
    const itemByCode = new Map(items.rows.map((row) => [row.code, row]));
    const barcodes = await executor.execute<{ barcode: string; item_id: string; code: string }>(sql`
      SELECT b.barcode, i.id AS item_id, i.code FROM ipos.item_barcodes b JOIN ipos.item_variants v ON v.id = b.variant_id JOIN ipos.items i ON i.id = v.item_id
      WHERE b.merchant_id = ${member.merchantId}`);
    const barcodeOwner = new Map(barcodes.rows.map((row) => [row.barcode, row]));
    const seenCodes = new Map<string, number>();
    const seenBarcodes = new Map<string, number>();
    const planned: PlannedRow[] = [];
    for (const { number, cells } of rows) {
      const cell = (name: Column) => cells[column[name]];
      const before = errors.length;
      const code = text(cell("Mã")).toUpperCase() || null;
      if (code && code.length > 30) fail(number, "Mã", words.tooLong.replace("{max}", "30"));
      if (code && seenCodes.has(code)) fail(number, "Mã", words.duplicateInFile.replace("{row}", String(seenCodes.get(code))));
      if (code) seenCodes.set(code, seenCodes.get(code) ?? number);
      const existing = code ? (itemByCode.get(code) ?? null) : null;
      const name = text(cell("Tên"));
      if (!name) fail(number, "Tên", words.required);
      else if (name.length > 200) fail(number, "Tên", words.tooLong.replace("{max}", "200"));
      const group = text(cell("Nhóm")) || null;
      const subgroup = text(cell("Nhóm con")) || null;
      if (group && group.length > 100) fail(number, "Nhóm", words.tooLong.replace("{max}", "100"));
      if (subgroup && subgroup.length > 100) fail(number, "Nhóm con", words.tooLong.replace("{max}", "100"));
      if (subgroup && !group) fail(number, "Nhóm con", words.subgroupWithoutGroup);
      const unit = text(cell("Đơn vị tính"));
      if (!unit) fail(number, "Đơn vị tính", words.required);
      else if (unit.length > 20) fail(number, "Đơn vị tính", words.tooLong.replace("{max}", "20"));
      const price = money(cell("Giá bán"));
      if (price === null) fail(number, "Giá bán", words.price);
      const vatRate = vatByText[text(cell("Thuế suất")).replace("%", "").trim().toLowerCase()];
      if (!vatRate) fail(number, "Thuế suất", words.vatRate);
      const trackText = text(cell("Theo dõi tồn kho")).toLowerCase();
      const trackStock = trackText === "" || trackText === "có" ? true : trackText === "không" ? false : null;
      if (trackStock === null) fail(number, "Theo dõi tồn kho", words.yesNo);
      const rowBarcodes = text(cell("Mã vạch"))
        .split(/[;,]/)
        .map((value) => value.trim())
        .filter(Boolean);
      for (const barcode of rowBarcodes) {
        if (barcode.length > 50) fail(number, "Mã vạch", words.tooLong.replace("{max}", "50"));
        const owner = barcodeOwner.get(barcode);
        if (seenBarcodes.has(barcode)) fail(number, "Mã vạch", words.duplicateInFile.replace("{row}", String(seenBarcodes.get(barcode))));
        else if (owner && owner.item_id !== existing?.id) fail(number, "Mã vạch", words.barcodeTaken.replace("{code}", owner.code));
        seenBarcodes.set(barcode, seenBarcodes.get(barcode) ?? number);
      }
      if (existing?.has_attributes && rowBarcodes.length > 0) fail(number, "Mã vạch", words.hasVariants);
      const quantityText = text(cell("Tồn đầu kỳ"));
      const openingQuantity = quantityText ? decimal(cell("Tồn đầu kỳ"), 3) : null;
      let openingCost: string | null = null;
      if (quantityText && openingQuantity === null) fail(number, "Tồn đầu kỳ", words.quantity);
      if (openingQuantity !== null && Number(openingQuantity) > 0) {
        openingCost = decimal(cell("Giá nhập"), 4);
        if (openingCost === null) fail(number, "Giá nhập", words.cost);
        if (trackStock === false) fail(number, "Tồn đầu kỳ", words.notTracked);
        if (existing?.has_attributes) fail(number, "Tồn đầu kỳ", words.hasVariants);
        if (!outletId) fail(number, "Tồn đầu kỳ", words.outletRequired);
      }
      if (errors.length > before) continue;
      planned.push({
        number,
        code,
        name,
        group,
        subgroup,
        unit,
        price: price!,
        vatRate: vatRate!,
        trackStock: trackStock!,
        barcodes: rowBarcodes,
        openingQuantity: openingQuantity !== null && Number(openingQuantity) > 0 ? openingQuantity : null,
        openingCost,
        existingId: existing?.id ?? null,
      });
    }
    // Giới hạn mặt hàng của gói: mặt hàng mới thêm một biến thể đang bán (QUYTAC_NGHIEPVU_608 khoản 6).
    const creates = planned.filter((row) => !row.existingId).length;
    const { maxItems } = await itemLimit(executor, member.merchantId);
    if (maxItems !== null && creates > 0) {
      const current = await activeVariants(executor, member.merchantId);
      if (current + creates > maxItems) fail(0, null, words.itemLimit.replace("{count}", String(creates)).replace("{left}", String(Math.max(maxItems - current, 0))));
    }
    errors.sort((left, right) => left.row - right.row);
    return { rows: planned, errors };
  }

  private result(plan: Plan, total: number, committed: boolean, receiptNumber: string | null): IposImportResult {
    return {
      rows: total,
      creates: plan.rows.filter((row) => !row.existingId).length,
      updates: plan.rows.filter((row) => row.existingId).length,
      openingStockRows: plan.rows.filter((row) => row.openingQuantity).length,
      errors: plan.errors.slice(0, 500),
      committed,
      receiptNumber,
    };
  }

  async validate(member: PortalMember, file: { buffer: Buffer; size: number } | undefined, outletId: string | null, locale: Locale): Promise<IposImportResult> {
    const rows = await this.read(file);
    if (outletId) await requireStockOutlet(this.database, member.merchantId, outletId);
    return this.result(await this.plan(this.database, member, rows, outletId, locale), rows.length, false, null);
  }

  async commit(member: PortalMember, file: { buffer: Buffer; size: number } | undefined, outletId: string | null, locale: Locale): Promise<IposImportResult> {
    const rows = await this.read(file);
    return this.database.transaction(async (transaction) => {
      await requireWritable(transaction, member.merchantId);
      if (outletId) await requireStockOutlet(transaction, member.merchantId, outletId);
      await lockCatalog(transaction, member.merchantId);
      const plan = await this.plan(transaction, member, rows, outletId, locale);
      if (plan.errors.length > 0) return this.result(plan, rows.length, false, null);
      const categories = await this.categories(transaction, member, plan.rows);
      await this.assignCodes(transaction, member, plan.rows);
      const variantByCode = await this.write(transaction, member, plan.rows, categories);
      const opening = plan.rows.filter((row) => row.openingQuantity);
      let receiptNumber: string | null = null;
      if (opening.length > 0 && outletId) {
        const receipt = await applyReceipt(
          transaction,
          member,
          outletId,
          opening.map((row) => ({ variantId: variantByCode.get(row.code!)!, quantity: row.openingQuantity!, unitCost: row.openingCost! })),
          messages[locale].iposImport.openingNote,
          "import",
        );
        receiptNumber = receipt.number;
      }
      const result = this.result(plan, rows.length, true, receiptNumber);
      await this.audit.record(
        {
          actorUserId: member.userId,
          companyId: member.companyId,
          appCode: "affiliate",
          action: "ipos.item.import",
          entityType: "ipos_merchant",
          entityId: member.merchantId,
          afterData: { rows: result.rows, creates: result.creates, updates: result.updates, receiptNumber },
          ip: member.client.ip,
          userAgent: member.client.userAgent,
          requestId: member.client.requestId,
        },
        transaction,
      );
      return result;
    });
  }

  // Nhóm, nhóm con theo tên (không phân biệt hoa thường); chưa có thì tạo.
  private async categories(executor: Executor, member: PortalMember, rows: PlannedRow[]): Promise<Map<string, string>> {
    const existing = await executor.execute<{ id: string; parent_id: string | null; name: string }>(sql`SELECT id, parent_id, name FROM ipos.categories WHERE merchant_id = ${member.merchantId}`);
    const key = (parentId: string | null, name: string) => `${parentId ?? ""}|${name.toLowerCase()}`;
    const byKey = new Map(existing.rows.map((row) => [key(row.parent_id, row.name), row.id]));
    const ensure = async (parentId: string | null, name: string): Promise<string> => {
      const found = byKey.get(key(parentId, name));
      if (found) return found;
      const created = await executor.execute<{ id: string }>(sql`INSERT INTO ipos.categories (merchant_id, parent_id, name) VALUES (${member.merchantId}, ${parentId}, ${name}) RETURNING id`);
      byKey.set(key(parentId, name), created.rows[0]!.id);
      return created.rows[0]!.id;
    };
    const result = new Map<string, string>();
    for (const row of rows) {
      if (!row.group) continue;
      const parent = await ensure(null, row.group);
      result.set(`${row.number}`, row.subgroup ? await ensure(parent, row.subgroup) : parent);
    }
    return result;
  }

  // Mã trống: lấy một khối số liền nhau từ bộ đếm, bỏ qua số đã có người tự đặt.
  private async assignCodes(executor: Executor, member: PortalMember, rows: PlannedRow[]): Promise<void> {
    const blank = rows.filter((row) => !row.code);
    if (blank.length === 0) return;
    const taken = new Set(
      (await executor.execute<{ code: string }>(sql`SELECT upper(code) AS code FROM ipos.items WHERE merchant_id = ${member.merchantId}`)).rows.map((row) => row.code),
    );
    for (const row of rows) if (row.code) taken.add(row.code);
    const counter = await executor.execute<{ last_number: number }>(sql`
      INSERT INTO ipos.number_counters (merchant_id, kind, last_number) VALUES (${member.merchantId}, 'item', 0)
      ON CONFLICT (merchant_id, kind) DO UPDATE SET last_number = ipos.number_counters.last_number
      RETURNING last_number`);
    let next = counter.rows[0]!.last_number;
    for (const row of blank) {
      let code: string;
      do {
        next += 1;
        code = `SP${String(next).padStart(6, "0")}`;
      } while (taken.has(code));
      taken.add(code);
      row.code = code;
    }
    await executor.execute(sql`UPDATE ipos.number_counters SET last_number = ${next} WHERE merchant_id = ${member.merchantId} AND kind = 'item'`);
  }

  // Ghi theo lô qua jsonb_to_recordset; trả biến thể mặc định theo mã mặt hàng.
  private async write(executor: Executor, member: PortalMember, rows: PlannedRow[], categories: Map<string, string>): Promise<Map<string, string>> {
    const payload = rows.map((row) => ({
      code: row.code,
      name: row.name,
      search_text: searchText(row.name, row.code),
      category_id: categories.get(`${row.number}`) ?? null,
      unit: row.unit,
      price: row.price,
      vat_rate: row.vatRate,
      track_stock: row.trackStock,
      existing: row.existingId !== null,
    }));
    const json = JSON.stringify(payload);
    const recordset = sql`jsonb_to_recordset(${json}::jsonb) AS x(code text, name text, search_text text, category_id uuid, unit text, price numeric, vat_rate text, track_stock boolean, existing boolean)`;
    await executor.execute(sql`
      UPDATE ipos.items i SET name = x.name, search_text = x.search_text, category_id = x.category_id, unit = x.unit, price = x.price, vat_rate = x.vat_rate,
        updated_by = ${member.userId}, updated_at = now(), version = i.version + 1
      FROM ${recordset}
      WHERE x.existing AND i.merchant_id = ${member.merchantId} AND upper(i.code) = x.code`);
    await executor.execute(sql`
      INSERT INTO ipos.items (merchant_id, code, name, search_text, category_id, unit, price, vat_rate, track_stock, created_by, updated_by)
      SELECT ${member.merchantId}, x.code, x.name, x.search_text, x.category_id, x.unit, x.price, x.vat_rate, x.track_stock, ${member.userId}, ${member.userId}
      FROM ${recordset} WHERE NOT x.existing`);
    await executor.execute(sql`
      INSERT INTO ipos.item_variants (merchant_id, item_id, code)
      SELECT ${member.merchantId}, i.id, i.code FROM ipos.items i JOIN ${recordset} ON upper(i.code) = x.code
      WHERE NOT x.existing AND i.merchant_id = ${member.merchantId}`);
    const variants = await executor.execute<{ code: string; variant_id: string }>(sql`
      SELECT DISTINCT ON (i.id) upper(i.code) AS code, v.id AS variant_id
      FROM ipos.items i JOIN ipos.item_variants v ON v.item_id = i.id
      WHERE i.merchant_id = ${member.merchantId} AND upper(i.code) IN (SELECT x.code FROM ${recordset}) AND i.attribute1_name IS NULL
      ORDER BY i.id, v.sort_order, v.code`);
    const variantByCode = new Map(variants.rows.map((row) => [row.code, row.variant_id]));
    // Mã vạch: dòng có cột mã vạch thì thay toàn bộ mã vạch của biến thể mặc định; cột trống thì giữ nguyên.
    const withBarcodes = rows.filter((row) => row.barcodes.length > 0);
    if (withBarcodes.length > 0) {
      const variantIds = withBarcodes.map((row) => variantByCode.get(row.code!)!);
      await executor.execute(sql`DELETE FROM ipos.item_barcodes WHERE variant_id IN (SELECT unnest(${`{${variantIds.join(",")}}`}::uuid[]))`);
      const barcodes = JSON.stringify(withBarcodes.flatMap((row) => row.barcodes.map((barcode) => ({ variant_id: variantByCode.get(row.code!)!, barcode }))));
      await executor.execute(sql`
        INSERT INTO ipos.item_barcodes (merchant_id, variant_id, barcode)
        SELECT ${member.merchantId}, b.variant_id, b.barcode FROM jsonb_to_recordset(${barcodes}::jsonb) AS b(variant_id uuid, barcode text)`);
    }
    return variantByCode;
  }
}
