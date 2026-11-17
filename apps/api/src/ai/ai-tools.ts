// Công cụ đọc dữ liệu của trợ lý hỏi đáp (QUYTAC_NGHIEPVU_516, 517). Chỉ đọc; gọi dịch vụ hiện có bằng chính tác nhân của người hỏi,
// nên dịch vụ tự kiểm quyền, phạm vi công ty, chi nhánh như màn hình. Công cụ chỉ cấp cho mô hình khi người hỏi có quyền tương ứng.
import { Injectable } from "@nestjs/common";
import {
  analyticsCommissionGroupings,
  analyticsCommissionQuerySchema,
  analyticsDebtGroupings,
  analyticsDebtQuerySchema,
  analyticsInventoryGroupings,
  analyticsInventoryQuerySchema,
  analyticsOverviewQuerySchema,
  analyticsSalesGroupings,
  analyticsSalesQuerySchema,
  productListQuerySchema,
  salesOrderListQuerySchema,
  salesOrderStatuses,
  stockListQuerySchema,
  type AiToolName,
} from "contracts";
import { messages } from "i18n";
import { z, ZodError } from "zod";
import { CommissionReportService } from "../analytics/commission-report.service";
import { DebtReportService } from "../analytics/debt-report.service";
import { InventoryReportService } from "../analytics/inventory-report.service";
import { OverviewService } from "../analytics/overview.service";
import { SalesReportService } from "../analytics/sales-report.service";
import { ProductsService } from "../catalog/products.service";
import { ApiError } from "../common/api-error";
import { StockService } from "../inventory/stock.service";
import type { Actor } from "../permissions/roles.service";
import { SalesOrdersService } from "../sales/sales-orders.service";
import type { AiToolDefinition } from "./model-client";
import { redactValue } from "./redact";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Ngày dạng YYYY-MM-DD");
const period = { from: isoDate.describe("Từ ngày, YYYY-MM-DD"), to: isoDate.describe("Đến ngày, YYYY-MM-DD") };
const page = z.number().int().min(1).max(50).optional().describe("Trang, mặc định 1");

interface ToolSpec<Input extends z.ZodType> {
  name: AiToolName;
  description: string;
  // Có một trong các quyền này ở công ty đang chọn thì được cấp công cụ.
  anyOf: string[];
  input: Input;
  run: (actor: Actor, input: z.output<Input>) => Promise<unknown>;
}

// Giới hạn kết quả mỗi lần gọi công cụ (QUYTAC_NGHIEPVU_517).
export const toolRowLimit = 50;
export const toolCharacterLimit = 20_000;
export const toolCallLimit = 8;

// Cắt mảng dài quá 50 phần tử và báo số phần tử bị bỏ cho mô hình.
export function truncateRows(value: unknown): unknown {
  if (Array.isArray(value)) {
    const kept = value.slice(0, toolRowLimit).map(truncateRows);
    return value.length > toolRowLimit ? [...kept, { _ghiChu: `Đã bỏ ${value.length - toolRowLimit} dòng; thu hẹp điều kiện hoặc xem màn hình nguồn` }] : kept;
  }
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, truncateRows(child)]));
  return value;
}

// Chuỗi gửi mô hình: cắt dòng, che dữ liệu cá nhân, giới hạn ký tự.
export function toolResultText(value: unknown): string {
  const text = JSON.stringify(redactValue(truncateRows(value)));
  return text.length > toolCharacterLimit ? `${text.slice(0, toolCharacterLimit)}… [kết quả bị cắt ở ${toolCharacterLimit} ký tự]` : text;
}

export interface ToolOutcome {
  ok: boolean;
  content: string;
  input: Record<string, unknown>;
}

@Injectable()
export class AiToolsService {
  private readonly specs: ToolSpec<z.ZodType>[];

  constructor(
    sales: SalesReportService,
    inventory: InventoryReportService,
    debts: DebtReportService,
    commissions: CommissionReportService,
    overview: OverviewService,
    orders: SalesOrdersService,
    products: ProductsService,
    stock: StockService,
  ) {
    const spec = <Input extends z.ZodType>(value: ToolSpec<Input>) => value as unknown as ToolSpec<z.ZodType>;
    this.specs = [
      spec({
        name: "sales_report",
        description: "Báo cáo bán hàng (doanh thu chưa thuế, giá vốn, lãi gộp, số lượng) của công ty đang chọn trong khoảng ngày, nhóm theo kênh, sản phẩm, ngày, tháng hoặc công ty.",
        anyOf: ["analytics.sales.view"],
        input: z.object({ ...period, groupBy: z.enum(analyticsSalesGroupings).optional(), channelId: z.uuid().optional() }).strict(),
        run: (actor, input) => sales.report(actor, analyticsSalesQuerySchema.parse({ ...input, groupBy: input.groupBy ?? "company" })),
      }),
      spec({
        name: "inventory_report",
        description: "Báo cáo tồn kho và luân chuyển (tồn đầu, nhập, xuất, tồn cuối, giá vốn, vòng quay) trong khoảng ngày, nhóm theo kho, sản phẩm hoặc công ty.",
        anyOf: ["analytics.inventory.view"],
        input: z.object({ ...period, groupBy: z.enum(analyticsInventoryGroupings).optional(), warehouseId: z.uuid().optional() }).strict(),
        run: (actor, input) => inventory.report(actor, analyticsInventoryQuerySchema.parse({ ...input, groupBy: input.groupBy ?? "warehouse" })),
      }),
      spec({
        name: "debt_report",
        description: "Báo cáo công nợ phải thu (receivable) hoặc phải trả (payable) đến hôm nay, chia theo tuổi nợ, nhóm theo đối tác hoặc công ty.",
        anyOf: ["analytics.debt.view"],
        input: z.object({ side: z.enum(["receivable", "payable"]).optional(), groupBy: z.enum(analyticsDebtGroupings).optional() }).strict(),
        run: (actor, input) => debts.report(actor, analyticsDebtQuerySchema.parse({ side: input.side ?? "receivable", groupBy: input.groupBy ?? "partner" })),
      }),
      spec({
        name: "commission_report",
        description: "Báo cáo hoa hồng và ví hoa hồng trong khoảng ngày, nhóm theo phần chia hoặc người nhận.",
        anyOf: ["analytics.commission.view"],
        input: z.object({ ...period, groupBy: z.enum(analyticsCommissionGroupings).optional() }).strict(),
        run: (actor, input) => commissions.report(actor, analyticsCommissionQuerySchema.parse({ ...input, groupBy: input.groupBy ?? "share" })),
      }),
      spec({
        name: "overview_report",
        description: "Tổng quan nhanh (bán hàng, tồn kho, công nợ) trong khoảng ngày; phần nào người hỏi không có quyền thì trống.",
        anyOf: ["analytics.sales.view", "analytics.inventory.view", "analytics.debt.view", "analytics.commission.view"],
        input: z.object({ ...period }).strict(),
        run: (actor, input) => overview.overview(actor, analyticsOverviewQuerySchema.parse(input)),
      }),
      spec({
        name: "sales_orders",
        description: "Danh sách đơn bán của công ty đang chọn (số đơn, khách hàng, ngày, tổng tiền, trạng thái); tìm theo số đơn hoặc tên khách, lọc trạng thái. 20 đơn mỗi trang.",
        anyOf: ["sales.order.view", "sales.order.manage"],
        input: z.object({ search: z.string().trim().max(100).optional(), status: z.enum(salesOrderStatuses).optional(), page }).strict(),
        run: (actor, input) => orders.list(actor, salesOrderListQuerySchema.parse({ ...input, pageSize: 20 })),
      }),
      spec({
        name: "sales_order_detail",
        description: "Chi tiết một đơn bán theo mã định danh (id) lấy từ danh sách đơn bán: dòng hàng, số lượng, giá, thuế, trạng thái, giao hàng.",
        anyOf: ["sales.order.view", "sales.order.manage"],
        input: z.object({ id: z.uuid() }).strict(),
        run: (actor, input) => orders.detail(actor, input.id),
      }),
      spec({
        name: "products",
        description: "Danh sách sản phẩm của công ty đang chọn; tìm theo tên hoặc mã, lọc đang bán (active) hoặc ngừng (inactive). 20 sản phẩm mỗi trang.",
        anyOf: ["catalog.product.view", "catalog.product.manage"],
        input: z.object({ search: z.string().trim().max(100).optional(), status: z.enum(["active", "inactive"]).optional(), page }).strict(),
        run: (actor, input) => products.list(actor, productListQuerySchema.parse({ ...input, pageSize: 20 })),
      }),
      spec({
        name: "product_detail",
        description: "Chi tiết một sản phẩm theo mã định danh (id) lấy từ danh sách sản phẩm: biến thể, đơn vị, thuế suất, mô tả.",
        anyOf: ["catalog.product.view", "catalog.product.manage"],
        input: z.object({ id: z.uuid() }).strict(),
        run: (actor, input) => products.detail(actor, input.id),
      }),
      spec({
        name: "stock",
        description: "Tồn kho hiện tại theo biến thể và kho (tồn, đang giữ, khả dụng); tìm theo tên hoặc mã hàng, lọc kho, chỉ hàng còn tồn. 50 dòng mỗi trang.",
        anyOf: ["inventory.stock.view"],
        input: z
          .object({ search: z.string().trim().max(100).optional(), warehouseId: z.uuid().optional(), onlyInStock: z.boolean().optional(), page })
          .strict(),
        run: (actor, input) =>
          stock.list(
            actor,
            stockListQuerySchema.parse({ search: input.search, warehouseId: input.warehouseId, onlyInStock: input.onlyInStock === undefined ? undefined : String(input.onlyInStock), page: input.page }),
          ),
      }),
    ];
  }

  // Công cụ được cấp theo quyền của người hỏi ở công ty đang chọn.
  definitions(granted: string[]): AiToolDefinition[] {
    return this.specs
      .filter((spec) => spec.anyOf.some((permission) => granted.includes(permission)))
      .map((spec) => {
        const { $schema: _schema, ...inputSchema } = z.toJSONSchema(spec.input, { io: "input" }) as Record<string, unknown>;
        return { name: spec.name, description: spec.description, inputSchema };
      });
  }

  // Chạy một lời gọi công cụ; lỗi trả về mô hình dạng lỗi, không lộ dữ liệu ngoài quyền.
  async run(actor: Actor, granted: string[], name: string, rawInput: unknown): Promise<ToolOutcome> {
    const spec = this.specs.find((item) => item.name === name);
    // Tham số chưa kiểm chỉ lưu lại (để người dùng thấy công cụ đã gọi) khi nhỏ; giao diện không tin các giá trị này.
    const input = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput) && JSON.stringify(rawInput).length <= 2_000 ? (rawInput as Record<string, unknown>) : {};
    if (!spec || !spec.anyOf.some((permission) => granted.includes(permission))) {
      return { ok: false, content: "Không có công cụ này hoặc người hỏi không có quyền xem dữ liệu này.", input };
    }
    try {
      const parsed = spec.input.parse(rawInput);
      return { ok: true, content: toolResultText(await spec.run(actor, parsed)), input: parsed as Record<string, unknown> };
    } catch (error) {
      if (error instanceof ZodError) {
        return { ok: false, content: `Tham số không hợp lệ: ${error.issues.map((issue) => `${issue.path.join(".") || "(gốc)"} ${issue.message}`).join("; ")}`, input };
      }
      if (error instanceof ApiError) {
        return { ok: false, content: `Không lấy được dữ liệu: ${messages.vi.errors[error.messageKey]}`, input };
      }
      throw error;
    }
  }
}
