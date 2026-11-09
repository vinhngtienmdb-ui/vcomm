// Nhập sản phẩm từ Excel (CHUC_NANG_33; API_58; TIEUCHI_NGHIEMTHU_59): sản phẩm lỗi bỏ qua, sản phẩm đúng vẫn nhập; tệp dòng lỗi kèm lý do.
import { Inject, Injectable } from "@nestjs/common";
import { productImportColumns, productImportMaximumBytes, productImportMaximumRows, saveProductSchema, type ProductImportResponse, type VatRate } from "contracts";
import { sql } from "drizzle-orm";
import { messages, type Locale } from "i18n";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { ZodError } from "zod";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogPermissions, requireCompanyPermission } from "./catalog-context";
import { ProductsService } from "./products.service";

const xlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Cell = string | number | boolean | Date | null;
const text = (value: Cell | undefined): string => (value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim());

const column = Object.fromEntries(productImportColumns.map((title, index) => [title, index])) as Record<(typeof productImportColumns)[number], number>;
const vatByText: Record<string, VatRate> = { "0": "0", "0%": "0", "5": "5", "5%": "5", "8": "8", "8%": "8", "10": "10", "10%": "10", kct: "exempt", kkknt: "not_declared" };

type Row = { number: number; cells: string[] };

@Injectable()
export class ProductImportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly products: ProductsService,
  ) {}

  // Tệp mẫu: dòng tiêu đề và hai dòng ví dụ của một sản phẩm có phân loại.
  async template(): Promise<Buffer> {
    const header = productImportColumns.map((title) => ({ value: title, fontWeight: "bold" as const }));
    const example = (variant: string, barcode: string) =>
      ["", "Áo thun cổ tròn", "AOTH", "CAI", "8", "", "", "VComm", "Việt Nam", "0,2", "", "THUNG=24", `Màu: ${variant}`, "", "", "", barcode].map((value) => ({ value }));
    return writeXlsxFile([header, example("Đen", "8930000000011"), example("Trắng", "8930000000028")], { sheet: "Sản phẩm" }).toBuffer();
  }

  async import(actor: Actor, file: { buffer: Buffer; size: number } | undefined, locale: Locale): Promise<ProductImportResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > productImportMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
    let sheet: Cell[][];
    try {
      sheet = (await readSheet(file.buffer)) as Cell[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const header = (sheet[0] ?? []).map(text);
    if (productImportColumns.some((title, index) => header[index] !== title)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    const rows: Row[] = sheet
      .slice(1)
      .map((row, index) => ({ number: index + 2, cells: productImportColumns.map((_, position) => text(row[position])) }))
      .filter((row) => row.cells.some(Boolean));
    if (rows.length > productImportMaximumRows) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooManyRows" } });

    // Gộp dòng theo mã sản phẩm, để trống mã thì theo tên.
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row.cells[column["Mã sản phẩm"]] ? `code:${row.cells[column["Mã sản phẩm"]]!.toUpperCase()}` : `name:${row.cells[column["Tên sản phẩm"]]!.toLowerCase()}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const lookups = await this.lookups();
    const errors: { row: number; message: string; cells: string[] }[] = [];
    let createdProducts = 0;
    let createdVariants = 0;
    for (const group of groups.values()) {
      try {
        const input = this.toInput(group, lookups, locale);
        await this.database.transaction(async (transaction) => this.products.insert(transaction, actor, actor.companyId, input));
        createdProducts += 1;
        createdVariants += input.variants.length;
      } catch (error) {
        const message = this.describe(error, group, locale);
        for (const row of group) errors.push({ row: row.number, message, cells: row.cells });
      }
    }
    errors.sort((first, second) => first.row - second.row);
    return {
      createdProducts,
      createdVariants,
      failedRows: errors.length,
      errors: errors.map(({ row, message }) => ({ row, message })),
      errorFileUrl: errors.length > 0 ? await this.errorFile(errors) : null,
    };
  }

  // Chuyển các dòng của một sản phẩm thành dữ liệu như khi lập trên màn hình; thông tin chung lấy ở dòng đầu.
  private toInput(group: Row[], lookups: Awaited<ReturnType<ProductImportService["lookups"]>>, locale: Locale) {
    const text_ = messages[locale].errors;
    const first = group[0]!.cells;
    const value = (title: (typeof productImportColumns)[number], cells = first) => cells[column[title]]!;
    const category = lookups.categories.get(value("Mã ngành hàng").toUpperCase());
    if (!category) throw new Error(`${text_.catalogCodeNotFound} (${productImportColumns[column["Mã ngành hàng"]]})`);
    const baseUnitId = lookups.units.get(value("Mã đơn vị cơ sở").toUpperCase());
    if (!baseUnitId) throw new Error(`${text_.catalogCodeNotFound} (${productImportColumns[column["Mã đơn vị cơ sở"]]})`);
    const vatRate = value("Thuế suất") ? vatByText[value("Thuế suất").toLowerCase()] : "10";
    if (!vatRate) throw new Error(`${text_.invalidValue} (${productImportColumns[column["Thuế suất"]]})`);
    const trackingText = value("Theo dõi").toLowerCase();
    const tracking =
      trackingText === ""
        ? category.tracksLots
          ? "lots"
          : category.tracksSerials
            ? "serials"
            : "none"
        : trackingText === "lô" || trackingText === "lo"
          ? "lots"
          : trackingText === "serial"
            ? "serials"
            : trackingText === "không"
              ? "none"
              : null;
    if (!tracking) throw new Error(`${text_.invalidValue} (${productImportColumns[column["Theo dõi"]]})`);
    // Đơn vị quy đổi dạng "THUNG=24; HOP=6".
    const units = value("Đơn vị quy đổi")
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [code = "", factor = ""] = part.split("=").map((piece) => piece.trim());
        const unitId = lookups.units.get(code.toUpperCase());
        if (!unitId) throw new Error(`${text_.catalogCodeNotFound} (${productImportColumns[column["Đơn vị quy đổi"]]}: ${code})`);
        return { unitId, factor };
      });
    // Phân loại dạng "Màu: Đen": tên thuộc tính lấy theo dòng đầu, giá trị theo từng dòng.
    const optionTitles = ["Phân loại 1", "Phân loại 2", "Phân loại 3"] as const;
    const options: { name: string; values: string[] }[] = [];
    const variants = group.map((row) => {
      const optionValues: string[] = [];
      optionTitles.forEach((title, index) => {
        const cell = value(title, row.cells);
        if (!cell) return;
        const separator = cell.indexOf(":");
        const name = separator > 0 ? cell.slice(0, separator).trim() : (options[index]?.name ?? title);
        const optionValue = separator > 0 ? cell.slice(separator + 1).trim() : cell;
        if (!options[index]) options[index] = { name, values: [] };
        if (!options[index]!.values.includes(optionValue)) options[index]!.values.push(optionValue);
        optionValues.push(optionValue);
      });
      const barcode = value("Mã vạch", row.cells);
      return { sku: value("Mã hàng", row.cells), optionValues, barcodes: barcode ? [{ unitId: baseUnitId, barcode }] : [] };
    });
    return saveProductSchema.parse({
      categoryId: category.id,
      code: value("Mã sản phẩm"),
      name: value("Tên sản phẩm"),
      brand: value("Thương hiệu") || null,
      origin: value("Xuất xứ") || null,
      vatRate,
      tracksLots: tracking === "lots",
      tracksSerials: tracking === "serials",
      warrantyMonths: value("Bảo hành (tháng)") ? Number(value("Bảo hành (tháng)")) : category.warrantyMonths,
      baseUnitId,
      weightKg: value("Trọng lượng (kg)"),
      volumeM3: value("Thể tích (m3)"),
      options: options.filter(Boolean),
      units,
      variants,
    });
  }

  private describe(error: unknown, group: Row[], locale: Locale): string {
    const text_ = messages[locale].errors as Record<string, string>;
    if (error instanceof ApiError) {
      const fields = Object.entries(error.extra.fields ?? {});
      if (fields.length === 0) return text_[error.messageKey] ?? error.messageKey;
      // variants.N.* chỉ ra dòng thứ N của sản phẩm.
      return fields
        .map(([field, key]) => {
          const variantIndex = /^variants\.(\d+)\./.exec(field)?.[1];
          const where = variantIndex !== undefined ? ` (${messages[locale].products.importRow} ${group[Number(variantIndex)]?.number ?? ""})` : "";
          return `${text_[key] ?? key}${where}`;
        })
        .join(" ");
    }
    if (error instanceof ZodError) return `${text_.invalidValue} (${[...new Set(error.issues.map((issue) => issue.path.join(".")))].join(", ")})`;
    return (error as Error).message;
  }

  private async errorFile(errors: { row: number; message: string; cells: string[] }[]): Promise<string> {
    const header = ["Dòng", ...productImportColumns, "Lý do"].map((title) => ({ value: title, fontWeight: "bold" as const }));
    const body = errors.map((error) => [{ value: error.row }, ...error.cells.map((value) => ({ value })), { value: error.message }]);
    const buffer = await writeXlsxFile([header, ...body], { sheet: "Dòng lỗi" }).toBuffer();
    return `data:${xlsxType};base64,${buffer.toString("base64")}`;
  }

  private async lookups() {
    const categories = await this.database.execute<{ id: string; code: string; tracks_lots: boolean; tracks_serials: boolean; warranty_months: number }>(
      sql`SELECT id, code, tracks_lots, tracks_serials, warranty_months FROM catalog.categories WHERE status = 'active'`,
    );
    const units = await this.database.execute<{ id: string; code: string }>(sql`SELECT id, code FROM catalog.units WHERE status = 'active'`);
    return {
      categories: new Map(categories.rows.map((row) => [row.code, { id: row.id, tracksLots: row.tracks_lots, tracksSerials: row.tracks_serials, warrantyMonths: row.warranty_months }])),
      units: new Map(units.rows.map((row) => [row.code, row.id])),
    };
  }
}
