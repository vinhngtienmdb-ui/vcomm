// API_124, API_125: cửa hàng, giỏ hàng, danh mục tỉnh xã, sổ địa chỉ của người mua trên ứng dụng VComm (CONG_VIEC_24).
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
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
} from "contracts";
import type { Response } from "express";
import { Public, type AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { ShopService } from "./shop.service";

@Controller("buyer")
export class ShopController {
  constructor(private readonly shop: ShopService) {}

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
