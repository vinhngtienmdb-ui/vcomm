// API cho đối tác, gốc /api/v1/open (API_260 đến API_264; API_289 đến API_292). Xác thực bằng khóa API (ApiKeyGuard), không dùng cookie, CSRF, X-Company-Id.
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import {
  openCancelSalesOrderSchema,
  openCustomerListQuerySchema,
  openCustomerSchema,
  openCustomerUpdateSchema,
  openProductQuerySchema,
  openSalesOrderListQuerySchema,
  openSalesOrderSchema,
  openStockQuerySchema,
  partnerOrderCodePattern,
  type OpenCustomer,
  type OpenProductItem,
  type OpenSalesOrder,
  type OpenStockItem,
  type PageResponse,
} from "contracts";
import type { Response } from "express";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { ApiKeyGuard, RequireScope, type CallerContext, type OpenApiRequest } from "./api-key.guard";
import { OpenCatalogService } from "./open-catalog.service";
import { OpenSalesOrdersService } from "./open-sales-orders.service";
import { OpenCustomersService } from "./open-customers.service";
import { normalizeIp } from "./ip-allow-list";

const contextOf = (request: OpenApiRequest): CallerContext => ({ ip: request.ip ? normalizeIp(request.ip) : null, requestId: request.header("x-request-id") ?? null });
const orderCode = (value: string): string => {
  if (!partnerOrderCodePattern.test(value)) throw new ApiError("NOT_FOUND", "notFound");
  return value;
};

const customerCode = (value: string): string => {
  if (!/^[A-Za-z0-9]{1,50}$/.test(value)) throw new ApiError("NOT_FOUND", "notFound");
  return value;
};

@Controller("open")
@Public()
@OwnRateLimit()
@UseGuards(ApiKeyGuard)
export class OpenApiController {
  constructor(
    private readonly catalog: OpenCatalogService,
    private readonly salesOrders: OpenSalesOrdersService,
    private readonly customers: OpenCustomersService,
  ) {}

  @Get("products")
  @RequireScope("catalog.read")
  async products(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenProductItem>> {
    return this.catalog.products(request.openApi, openProductQuerySchema.parse(query));
  }

  @Get("stock")
  @RequireScope("catalog.read")
  async stock(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenStockItem>> {
    return this.catalog.stock(request.openApi, openStockQuerySchema.parse(query));
  }

  // Mã đơn đối tác đã có thì trả 200 với đơn cũ; tạo mới trả 201 (QUYTAC_NGHIEPVU_491).
  @Post("sales-orders")
  @RequireScope("sales_order.write")
  async createOrder(@Req() request: OpenApiRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<OpenSalesOrder> {
    const result = await this.salesOrders.create(request.openApi, openSalesOrderSchema.parse(body), contextOf(request));
    response.status(result.created ? 201 : 200);
    return result.order;
  }

  @Get("sales-orders")
  @RequireScope("sales_order.write")
  async listOrders(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenSalesOrder>> {
    return this.salesOrders.list(request.openApi, openSalesOrderListQuerySchema.parse(query));
  }

  @Get("sales-orders/:code")
  @RequireScope("sales_order.write")
  async order(@Req() request: OpenApiRequest, @Param("code") code: string): Promise<OpenSalesOrder> {
    return this.salesOrders.detail(request.openApi, orderCode(code));
  }

  @Post("sales-orders/:code/cancel")
  @HttpCode(200)
  @RequireScope("sales_order.write")
  async cancelOrder(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown): Promise<OpenSalesOrder> {
    const input = openCancelSalesOrderSchema.parse(body);
    return this.salesOrders.cancel(request.openApi, orderCode(code), input.reason, contextOf(request));
  }

  // Khách do đối tác tạo (CONG_VIEC_66; QUYTAC_NGHIEPVU_494): tạo mới trả 201; trùng mã số thuế, căn cước hoặc đã có trong phạm vi trả 200.
  @Post("customers")
  @RequireScope("customer.write")
  async createCustomer(@Req() request: OpenApiRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<OpenCustomer> {
    const result = await this.customers.create(request.openApi, openCustomerSchema.parse(body), contextOf(request));
    response.status(result.created ? 201 : 200);
    return result.customer;
  }

  @Get("customers")
  @RequireScope("customer.write")
  async listCustomers(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenCustomer>> {
    return this.customers.list(request.openApi, openCustomerListQuerySchema.parse(query));
  }

  @Get("customers/:code")
  @RequireScope("customer.write")
  async customer(@Req() request: OpenApiRequest, @Param("code") code: string): Promise<OpenCustomer> {
    return this.customers.detail(request.openApi, customerCode(code));
  }

  @Patch("customers/:code")
  @RequireScope("customer.write")
  async updateCustomer(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown): Promise<OpenCustomer> {
    return this.customers.update(request.openApi, customerCode(code), openCustomerUpdateSchema.parse(body), contextOf(request));
  }
}
