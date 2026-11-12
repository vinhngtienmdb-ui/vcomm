// API cho đối tác, gốc /api/v1/open (API_260, API_261). Xác thực bằng khóa API (ApiKeyGuard), không dùng cookie, CSRF, X-Company-Id.
import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { openProductQuerySchema, openStockQuerySchema, type OpenProductItem, type OpenStockItem, type PageResponse } from "contracts";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { ApiKeyGuard, RequireScope, type OpenApiRequest } from "./api-key.guard";
import { OpenCatalogService } from "./open-catalog.service";

@Controller("open")
@Public()
@OwnRateLimit()
@UseGuards(ApiKeyGuard)
export class OpenApiController {
  constructor(private readonly catalog: OpenCatalogService) {}

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
}
