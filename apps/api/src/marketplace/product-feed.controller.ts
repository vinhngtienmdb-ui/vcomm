// API_316 tệp danh mục Facebook (công khai, có mã bí mật), API_317 quản lý tệp (CONG_VIEC_68; QUYTAC_NGHIEPVU_557 đến 559).
import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res } from "@nestjs/common";
import { type ProductFeedStatus, regenerateProductFeedSchema, updateProductFeedSchema } from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import { type AuthenticatedRequest, Public } from "../auth/auth.guard";
import { BuyerAdminService } from "./buyer-admin.service";
import { ProductFeedService } from "./product-feed.service";

@Controller()
export class ProductFeedController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly feeds: ProductFeedService,
  ) {}

  @Get("marketplace/product-feed")
  async status(@Req() request: AuthenticatedRequest): Promise<ProductFeedStatus> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view");
    return this.feeds.status(actor, await this.admin.allows(request.auth.userId, clientInfo(request), "marketplace.order.manage"));
  }

  @Put("marketplace/product-feed")
  async update(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<ProductFeedStatus> {
    const input = updateProductFeedSchema.parse(body);
    return this.feeds.setEnabled(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), input.enabled, input.version);
  }

  @Post("marketplace/product-feed/regenerate")
  @HttpCode(200)
  async regenerate(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<ProductFeedStatus> {
    const input = regenerateProductFeedSchema.parse(body);
    return this.feeds.regenerate(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), input.version);
  }

  // Facebook tải theo lịch (hằng giờ); mức chung 20 lần mỗi phút mỗi địa chỉ đủ dùng.
  @Public()
  @Get("public/product-feeds/facebook/:file")
  async feed(@Param("file") file: string, @Res() response: Response): Promise<void> {
    const token = file.endsWith(".csv") ? file.slice(0, -4) : "";
    const body = /^[A-Za-z0-9_-]{43}$/.test(token) ? await this.feeds.feed(token) : null;
    response.setHeader("Cache-Control", "no-store").setHeader("X-Content-Type-Options", "nosniff").setHeader("X-Robots-Tag", "noindex");
    if (body === null) {
      response.status(404).type("text").send("Not Found");
      return;
    }
    response.status(200).type("text/csv; charset=utf-8").setHeader("Content-Disposition", 'inline; filename="vcomm-facebook.csv"').send(body);
  }
}
