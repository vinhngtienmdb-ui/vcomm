// API_177: điểm của tôi, hạng thành viên trên ứng dụng VComm (CONG_VIEC_51). Người mua chỉ xem ví điểm của chính mình.
import { Controller, Get, Query, Req } from "@nestjs/common";
import { buyerWalletQuerySchema, type BuyerLoyaltyResponse, type LoyaltyEntryItem, type PageResponse } from "contracts";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { LoyaltyAccountsService } from "./accounts.service";

@Controller("buyer/loyalty")
export class BuyerLoyaltyController {
  constructor(private readonly accounts: LoyaltyAccountsService) {}

  @Get()
  async summary(@Req() request: AuthenticatedRequest): Promise<BuyerLoyaltyResponse> {
    return this.accounts.buyerSummary(request.auth.userId);
  }

  @Get("entries")
  async entries(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<LoyaltyEntryItem>> {
    return this.accounts.entries(request.auth.userId, buyerWalletQuerySchema.parse(query));
  }
}
