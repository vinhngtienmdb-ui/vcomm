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

// Đơn mua dropship (API_267, API_268; QUYTAC_NGHIEPVU_500 đến 502, 504).
export const dropshipStatuses = ["awaiting", "shipping", "delivered", "failed", "cancelled"] as const;
export type DropshipStatus = (typeof dropshipStatuses)[number];
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reasonText = z.string().trim().min(1).max(500);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const dropshipOrderListQuerySchema = z
  .object({
    status: z.enum(dropshipStatuses).optional(),
    supplierId: z.uuid().optional(),
    search: z.string().trim().max(100).optional(),
    overdueOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    missingInvoiceOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const dropshipShippingSchema = z.object({ carrierName: optionalText(100), trackingCode: optionalText(100), version: z.number().int().min(1) }).strict();
export const dropshipDeliveredSchema = z.object({ deliveredOn: isoDay, version: z.number().int().min(1) }).strict();
export const dropshipReasonSchema = z.object({ reason: reasonText, version: z.number().int().min(1) }).strict();
export const dropshipSupplierInvoiceSchema = z.object({ invoiceNo: z.string().trim().min(1).max(50), invoiceDate: isoDay, version: z.number().int().min(1) }).strict();
export type DropshipShippingRequest = z.input<typeof dropshipShippingSchema>;
export type DropshipDeliveredRequest = z.input<typeof dropshipDeliveredSchema>;
export type DropshipReasonRequest = z.input<typeof dropshipReasonSchema>;
export type DropshipSupplierInvoiceRequest = z.input<typeof dropshipSupplierInvoiceSchema>;

export interface DropshipOrderListItem {
  id: string;
  documentNo: string;
  salesOrderId: string;
  salesOrderNo: string | null;
  supplierId: string;
  supplierName: string;
  recipientName: string | null;
  deliveryAddress: string | null;
  lineCount: number;
  totalAmount: string;
  currency: string;
  status: DropshipStatus;
  orderDate: string;
  // Chờ giao quá 2 ngày kể từ ngày đơn.
  overdue: boolean;
  supplierInvoiceNo: string | null;
}

export interface DropshipOrderLine {
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  supplierSku: string | null;
  unitName: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  amount: string;
}

export interface DropshipEventResponse {
  status: DropshipStatus;
  note: string | null;
  actorName: string;
  createdAt: string;
}

export interface DropshipOrderResponse extends DropshipOrderListItem {
  salesOrderStatus: string;
  warehouseName: string;
  recipientPhone: string | null;
  carrierName: string | null;
  trackingCode: string | null;
  deliveredOn: string | null;
  reason: string | null;
  supplierInvoiceDate: string | null;
  taxAmount: string;
  receipt: { id: string; documentNo: string } | null;
  issue: { id: string; documentNo: string } | null;
  lines: DropshipOrderLine[];
  events: DropshipEventResponse[];
  canManage: boolean;
  version: number;
}

// Khối Dropship trong chi tiết đơn bán.
export interface SalesOrderDropshipItem {
  id: string;
  documentNo: string;
  supplierName: string;
  lineCount: number;
  status: DropshipStatus;
  carrierName: string | null;
  trackingCode: string | null;
}
