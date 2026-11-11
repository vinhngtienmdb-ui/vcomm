// API_166 ví mua sắm; khóa ví mua sắm toàn hệ thống, chặn ví theo tài khoản (CONG_VIEC_49; CHUC_NANG_173; THAY_DOI_22).
import { Body, Controller, Get, Param, Put, Query, Req } from "@nestjs/common";
import { buyerWalletQuerySchema, shoppingWalletSettingsSchema, walletBlockSchema, walletKinds, type ShoppingWalletResponse, type ShoppingWalletSettings, type WalletBlocksResponse } from "contracts";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService, type MarketplacePermission } from "./buyer-admin.service";
import { WalletsService } from "./wallets.service";

@Controller()
export class WalletsController {
  constructor(
    private readonly wallets: WalletsService,
    private readonly admin: BuyerAdminService,
  ) {}

  private actor(request: AuthenticatedRequest, permission: MarketplacePermission) {
    return this.admin.actor(request.auth.userId, clientInfo(request), permission);
  }

  @Get("buyer/shopping-wallet")
  async mine(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<ShoppingWalletResponse> {
    return this.wallets.mine(request.auth.userId, buyerWalletQuerySchema.parse(query));
  }

  @Get("marketplace/shopping-wallet-settings")
  async settings(@Req() request: AuthenticatedRequest): Promise<ShoppingWalletSettings> {
    return this.wallets.settings(await this.actor(request, "marketplace.order.view"));
  }

  @Put("marketplace/shopping-wallet-settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<ShoppingWalletSettings> {
    return this.wallets.updateSettings(await this.actor(request, "marketplace.order.manage"), shoppingWalletSettingsSchema.parse(body));
  }

  // Xem trạng thái chặn: người xem người mua hoặc người duyệt chi; chặn, gỡ chặn: người duyệt chi (THAY_DOI_22).
  @Get("marketplace/buyers/:id/wallet-blocks")
  async blocks(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<WalletBlocksResponse> {
    const client = clientInfo(request);
    const permission = (await this.admin.allows(request.auth.userId, client, "marketplace.payment.manage")) ? "marketplace.payment.manage" : "marketplace.buyer.view";
    return this.wallets.blocks(await this.actor(request, permission), id);
  }

  @Put("marketplace/buyers/:id/wallet-blocks/:wallet")
  async setBlock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Param("wallet") wallet: string, @Body() body: unknown): Promise<WalletBlocksResponse> {
    return this.wallets.setBlock(await this.actor(request, "marketplace.payment.manage"), id, z.enum(walletKinds).parse(wallet), walletBlockSchema.parse(body));
  }
}
