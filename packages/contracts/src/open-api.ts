// Open API cho đối tác (CONG_VIEC_61, MODULE_16): khóa API, nhật ký gọi, API sản phẩm, tồn cho đối tác.
import { z } from "zod";

export const apiKeyScopes = ["catalog.read", "sales_order.write", "customer.write", "loyalty.member"] as const;
export type ApiKeyScope = (typeof apiKeyScopes)[number];
export const apiKeyKinds = ["partner", "internal"] as const;
export type ApiKeyKind = (typeof apiKeyKinds)[number];
export type ApiKeyStatus = "active" | "expired" | "revoked";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const keyName = z.string().trim().min(1).max(100);
// Địa chỉ IPv4, IPv6 hoặc dải CIDR; máy chủ kiểm lại bằng node:net.
const ipEntry = z
  .string()
  .trim()
  .min(2)
  .max(49)
  .regex(/^[0-9A-Fa-f:.]+(\/\d{1,3})?$/);

const keySettings = {
  name: keyName,
  scopes: z.array(z.enum(apiKeyScopes)).min(1).max(apiKeyScopes.length),
  channelId: z.uuid(),
  warehouseIds: z.array(z.uuid()).max(50).default([]),
  rateLimitPerMinute: z.number().int().min(1).max(600).default(60),
  expiresOn: isoDate.nullable().default(null),
  allowedIps: z.array(ipEntry).max(20).default([]),
};

export const createApiKeySchema = z
  .object({
    kind: z.enum(apiKeyKinds),
    partnerId: z.uuid().nullable().default(null),
    ...keySettings,
  })
  .strict();
export type CreateApiKeyRequest = z.input<typeof createApiKeySchema>;

export const updateApiKeySchema = z.object({ ...keySettings, version: z.number().int().positive() }).strict();
export type UpdateApiKeyRequest = z.input<typeof updateApiKeySchema>;

export const rotateApiKeySchema = z.object({ version: z.number().int().positive() }).strict();
export const revokeApiKeySchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().positive() }).strict();

export const apiKeyListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(["active", "expired", "revoked"]).optional(),
    kind: z.enum(apiKeyKinds).optional(),
  })
  .strict();
export type ApiKeyListQuery = z.input<typeof apiKeyListQuerySchema>;

export interface ApiKeyItem {
  id: string;
  kind: ApiKeyKind;
  name: string;
  keyPrefix: string;
  partnerId: string | null;
  partnerCode: string | null;
  partnerName: string | null;
  scopes: ApiKeyScope[];
  // Khóa cửa hàng liên kết (chỉ `loyalty.member`, CONG_VIEC_67) không có kênh bán.
  channelId: string | null;
  channelName: string | null;
  rateLimitPerMinute: number;
  expiresOn: string | null;
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  createdAt: string;
  version: number;
}

export interface ApiKeyHistoryItem {
  occurredAt: string;
  actorName: string | null;
  action: string;
  afterData: unknown;
}

export interface ApiKeyDetail extends ApiKeyItem {
  warehouses: { id: string; code: string; name: string }[];
  allowedIps: string[];
  partnerCustomerGroupName: string | null;
  createdByName: string | null;
  revokedReason: string | null;
  revokedAt: string | null;
  stats: { calls24h: number; errors24h: number; rateLimited24h: number; peakPerMinute24h: number; lastIp: string | null };
  history: ApiKeyHistoryItem[];
}

// Kết quả cấp, cấp lại: `secret` chỉ trả đúng một lần (QUYTAC_NGHIEPVU_480).
export interface ApiKeySecretResponse {
  key: ApiKeyDetail;
  secret: string;
}

export interface ApiKeyOptions {
  partners: { id: string; code: string; name: string; customerGroupName: string | null }[];
  channels: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
}

export const apiKeyOptionsQuerySchema = z.object({ partnerSearch: z.string().trim().max(100).optional() }).strict();

export const apiCallResults = ["success", "client_error", "rate_limited", "server_error"] as const;
export type ApiCallResult = (typeof apiCallResults)[number];

export const apiCallLogQuerySchema = z
  .object({
    apiKeyId: z.uuid().optional(),
    result: z.enum(apiCallResults).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    path: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type ApiCallLogQuery = z.input<typeof apiCallLogQuerySchema>;

export interface ApiCallLogItem {
  id: string;
  calledAt: string;
  apiKeyId: string;
  apiKeyName: string;
  method: string;
  path: string;
  statusCode: number;
  errorCode: string | null;
  durationMs: number;
  ip: string | null;
  requestId: string | null;
}

// ---------- API cho đối tác (gốc /api/v1/open) ----------

export const openProductQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    updatedSince: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export interface OpenProductUnit {
  unitCode: string;
  unitName: string;
  factor: string;
  price: string | null;
  priceIncludesVat: boolean | null;
}

export interface OpenProductItem {
  sku: string;
  productCode: string;
  productName: string;
  optionValues: string[];
  vatRate: string;
  baseUnitCode: string;
  barcodes: { barcode: string; unitCode: string }[];
  units: OpenProductUnit[];
  updatedAt: string;
}

export const openStockQuerySchema = z
  .object({
    warehouse: z
      .string()
      .regex(/^[A-Z0-9_-]{1,20}$/)
      .optional(),
    sku: z
      .string()
      .max(4000)
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().max(50)).max(100))
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();

export interface OpenStockItem {
  sku: string;
  warehouseCode: string;
  available: string;
  unitCode: string;
}

// ---------- Đơn bán qua Open API (lát L2; API_262 đến API_264) ----------

export const partnerOrderCodePattern = /^[A-Za-z0-9._-]{1,50}$/;

export const openSalesOrderSchema = z
  .object({
    partnerOrderCode: z.string().regex(partnerOrderCodePattern),
    warehouseCode: z.string().regex(/^[A-Z0-9_-]{1,20}$/),
    orderDate: isoDate.optional(),
    customerCode: z.string().trim().min(1).max(50).optional(),
    buyerName: z.string().trim().min(1).max(200).optional(),
    deliveryAddress: z.string().trim().min(1).max(500).optional(),
    note: z.string().trim().min(1).max(1000).optional(),
    lines: z
      .array(
        z
          .object({
            sku: z.string().trim().min(1).max(50),
            unitCode: z.string().trim().min(1).max(10),
            quantity: z.string().regex(/^\d{1,12}(\.\d{1,4})?$/),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type OpenSalesOrderRequest = z.input<typeof openSalesOrderSchema>;

export const openSalesOrderListQuerySchema = z
  .object({
    status: z.enum(["draft", "pending", "confirmed", "rejected", "withdrawn", "delivered", "cancelled", "closed"]).optional(),
    updatedSince: z.iso.datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const openCancelSalesOrderSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export interface OpenSalesOrderLine {
  lineNo: number;
  sku: string;
  productName: string;
  unitCode: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  isGift: boolean;
  deliveredBaseQuantity: string;
}

export interface OpenSalesOrder {
  partnerOrderCode: string;
  documentNo: string | null;
  status: string;
  orderDate: string;
  warehouseCode: string | null;
  customerCode: string | null;
  buyerName: string | null;
  deliveryAddress: string | null;
  note: string | null;
  currency: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  lines: OpenSalesOrderLine[];
  createdAt: string;
  updatedAt: string;
}
