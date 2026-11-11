// API_124, API_125: cửa hàng, giỏ hàng, danh mục tỉnh xã, sổ địa chỉ của người mua trên ứng dụng VComm (CONG_VIEC_24).
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  buyerAddressSchema,
  type BuyerAddressItem,
  cartLineSchema,
  type CartResponse,
  type PageResponse,
  type RegionItem,
  type ShopProductDetail,
  type ShopProductItem,
  shopProductQuerySchema,
  buyerOrderListQuerySchema,
  buyerOrderPlaceSchema,
  buyerOrderPreviewSchema,
  cancelMarketplaceOrderSchema,
  type BuyerOrderDetail,
  type BuyerOrderListItem,
  type BuyerOrderPreview,
  createReturnRequestSchema,
  returnDecisionSchema,
  type ReturnRequestItem,
} from "contracts";
import type { Response } from "express";
import { Public, type AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { clientInfo } from "../auth/auth.controller";
import { MarketplaceOrdersService } from "./marketplace-orders.service";
import { ReturnRequestsService } from "./return-requests.service";
import { ShopService } from "./shop.service";

@Controller("buyer")
export class ShopController {
  constructor(
    private readonly shop: ShopService,
    private readonly orders: MarketplaceOrdersService,
    private readonly returns: ReturnRequestsService,
  ) {}

  // API_129: trả hàng trong 7 ngày.
  @Post("return-requests/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 6 * 1024 * 1024, files: 1 } }))
  uploadReturnImage(@Req() request: AuthenticatedRequest, @UploadedFile() file: { buffer: Buffer; size: number } | undefined): Promise<{ id: string }> {
    return this.returns.uploadImage(request.auth.userId, file);
  }

  @Get("return-requests/images/:id")
  async returnImage(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response): Promise<void> {
    const file = await this.returns.image(id, { buyerUserId: request.auth.userId });
    response.setHeader("content-type", file.contentType);
    response.setHeader("cache-control", "private, max-age=3600");
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Post("orders/:id/return-requests")
  createReturn(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<ReturnRequestItem[]> {
    return this.returns.create(request.auth.userId, id, createReturnRequestSchema.parse(body));
  }

  @Post("return-requests/:id/withdraw")
  @HttpCode(200)
  withdrawReturn(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<ReturnRequestItem[]> {
    return this.returns.withdraw(request.auth.userId, id, returnDecisionSchema.parse(body).version);
  }

  // API_126: đơn của người mua.
  @Post("orders/preview")
  @HttpCode(200)
  previewOrder(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerOrderPreview> {
    return this.orders.preview(request.auth.userId, buyerOrderPreviewSchema.parse(body).lines);
  }

  @Post("orders")
  placeOrder(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerOrderDetail> {
    return this.orders.place(request.auth.userId, clientInfo(request), buyerOrderPlaceSchema.parse(body));
  }

  @Get("orders")
  myOrders(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<BuyerOrderListItem>> {
    return this.orders.buyerList(request.auth.userId, buyerOrderListQuerySchema.parse(query));
  }

  @Get("orders/:id")
  myOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerOrderDetail> {
    return this.orders.buyerDetail(request.auth.userId, id);
  }

  @Post("orders/:id/cancel")
  @HttpCode(200)
  cancelOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerOrderDetail> {
    const input = cancelMarketplaceOrderSchema.parse(body);
    return this.orders.buyerCancel(request.auth.userId, clientInfo(request), id, input.version, input.reason);
  }

  @Get("shop/products")
  products(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<ShopProductItem>> {
    return this.shop.products(request.auth.userId, shopProductQuerySchema.parse(query));
  }

  @Get("shop/products/:id")
  product(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<ShopProductDetail> {
    return this.shop.product(request.auth.userId, id);
  }

  @Public()
  @Get("shop/images/:id")
  async image(@Param("id", UuidPipe) id: string, @Res() response: Response): Promise<void> {
    const file = await this.shop.image(id);
    response.setHeader("content-type", file.contentType);
    response.setHeader("cache-control", "public, max-age=3600");
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Get("cart")
  cart(@Req() request: AuthenticatedRequest): Promise<CartResponse> {
    return this.shop.cart(request.auth.userId);
  }

  @Put("cart/lines")
  setCartLine(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<CartResponse> {
    const input = cartLineSchema.parse(body);
    return this.shop.setCartLine(request.auth.userId, input.variantId, input.quantity);
  }

  @Delete("cart/lines/:variantId")
  removeCartLine(@Req() request: AuthenticatedRequest, @Param("variantId", UuidPipe) variantId: string): Promise<CartResponse> {
    return this.shop.removeCartLine(request.auth.userId, variantId);
  }

  @Get("regions/provinces")
  provinces(): Promise<RegionItem[]> {
    return this.shop.provinces();
  }

  @Get("regions/provinces/:code/wards")
  wards(@Param("code") code: string): Promise<RegionItem[]> {
    return this.shop.wards(code.slice(0, 10));
  }

  @Get("addresses")
  addresses(@Req() request: AuthenticatedRequest): Promise<BuyerAddressItem[]> {
    return this.shop.addresses(request.auth.userId);
  }

  @Post("addresses")
  addAddress(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerAddressItem[]> {
    return this.shop.saveAddress(request.auth.userId, null, buyerAddressSchema.parse(body));
  }

  @Put("addresses/:id")
  updateAddress(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAddressItem[]> {
    return this.shop.saveAddress(request.auth.userId, id, buyerAddressSchema.parse(body));
  }

  @Delete("addresses/:id")
  removeAddress(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerAddressItem[]> {
    return this.shop.removeAddress(request.auth.userId, id);
  }

  @Post("addresses/:id/default")
  setDefault(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerAddressItem[]> {
    return this.shop.setDefaultAddress(request.auth.userId, id);
  }
}
