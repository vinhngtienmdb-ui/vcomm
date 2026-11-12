// CONG_VIEC_62: Dropship – sản phẩm dropship, tồn nhà cung cấp khai báo (API_265, API_266).
import { z } from "zod";

// Tồn khai báo: số nguyên không âm theo đơn vị cơ bản (QUYTAC_NGHIEPVU_498); nhận số hoặc chuỗi.
export const dropshipQuantity = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim();
  if (!/^\d{1,12}$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});

export const dropshipProductListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    supplierId: z.uuid().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    unavailableOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const createDropshipProductSchema = z.object({ variantId: z.uuid(), supplierId: z.uuid(), unitId: z.uuid(), declaredQuantity: dropshipQuantity.default("0") }).strict();
export type CreateDropshipProductRequest = z.input<typeof createDropshipProductSchema>;

export const updateDropshipProductSchema = z.object({ supplierId: z.uuid(), unitId: z.uuid(), status: z.enum(["active", "inactive"]), version: z.number().int().min(1) }).strict();
export type UpdateDropshipProductRequest = z.input<typeof updateDropshipProductSchema>;

export const updateDropshipStockSchema = z.object({ declaredQuantity: dropshipQuantity, version: z.number().int().min(1) }).strict();
export type UpdateDropshipStockRequest = z.input<typeof updateDropshipStockSchema>;

export interface DropshipProductResponse {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  baseUnitName: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  unitId: string;
  unitName: string;
  // Giá mua hiệu lực hôm nay theo bảng giá mua; null khi chưa có (QUYTAC_NGHIEPVU_497).
  purchasePrice: string | null;
  declaredQuantity: string;
  reservedQuantity: string;
  availableQuantity: string;
  declaredAt: string;
  // Người hoặc khóa API đổi tồn lần cuối.
  declaredByName: string | null;
  status: "active" | "inactive";
  version: number;
}

export interface DropshipStockChangeResponse {
  id: string;
  oldQuantity: string;
  newQuantity: string;
  source: "manual" | "import" | "open_api";
  changedByName: string;
  createdAt: string;
}

export interface DropshipProductDetailResponse extends DropshipProductResponse {
  changes: DropshipStockChangeResponse[];
}

export interface DropshipOptionsResponse {
  // Kho Dropship đang hoạt động của công ty; null khi chưa tạo.
  warehouse: { id: string; code: string; name: string } | null;
  suppliers: { id: string; code: string; name: string }[];
}

export interface DropshipStockImportResponse {
  updated: number;
  errors: { row: number; message: string }[];
}

// Cột tệp Excel nhập tồn (dòng đầu là tiêu đề).
export const dropshipStockImportColumns = ["Mã biến thể", "Tồn khai báo"] as const;
