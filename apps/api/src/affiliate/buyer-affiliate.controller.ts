// API_209: người mua trên ứng dụng VComm – quét mã cửa hàng, yêu cầu chờ xác nhận, xác nhận, từ chối, mã thành viên, lịch sử (CONG_VIEC_55).
// Người mua chỉ thấy, xác nhận giao dịch của mình.
import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import {
  buyerAffiliateConfirmSchema,
  buyerAffiliateDeclineSchema,
  buyerAffiliateScanSchema,
  buyerMemberCodeSchema,
  type BuyerAffiliateRequest,
  type BuyerAffiliateTransaction,
  type BuyerMemberCode,
  type BuyerVoucherCode,
  type BuyerVoucherOffer,
} from "contracts";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { AffiliateTransactionsService } from "./transactions.service";
import { AffiliateVouchersService } from "./vouchers.service";

@Controller("buyer/affiliate")
export class BuyerAffiliateController {
  constructor(
    private readonly transactions: AffiliateTransactionsService,
    private readonly vouchers: AffiliateVouchersService,
  ) {}

  @Post("scan")
  @HttpCode(200)
  scan(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerAffiliateRequest> {
    return this.transactions.scan(request.auth.userId, buyerAffiliateScanSchema.parse(body).code);
  }

  @Get("pending")
  pending(@Req() request: AuthenticatedRequest): Promise<BuyerAffiliateRequest[]> {
    return this.transactions.pending(request.auth.userId);
  }

  @Post("transactions/:id/confirm")
  @HttpCode(200)
  confirm(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAffiliateTransaction> {
    const input = buyerAffiliateConfirmSchema.parse(body);
    return this.transactions.confirm(request.auth.userId, id, input.points, input.code, input.voucherCodeId ?? null);
  }

  @Post("transactions/:id/decline")
  @HttpCode(204)
  async decline(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<void> {
    await this.transactions.decline(request.auth.userId, id, buyerAffiliateDeclineSchema.parse(body).code);
  }

  @Post("member-code")
  @HttpCode(200)
  memberCode(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerMemberCode> {
    const input = buyerMemberCodeSchema.parse(body);
    return this.transactions.memberCode(request.auth.userId, input.points, input.voucherCodeId ?? null);
  }

  @Get("transactions")
  history(@Req() request: AuthenticatedRequest): Promise<BuyerAffiliateTransaction[]> {
    return this.transactions.history(request.auth.userId);
  }

  // API_211: voucher đang phát, nhận voucher, voucher của tôi.
  @Get("vouchers")
  offers(@Req() request: AuthenticatedRequest): Promise<BuyerVoucherOffer[]> {
    return this.vouchers.offers(request.auth.userId);
  }

  @Post("vouchers/:id/claim")
  @HttpCode(200)
  claim(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerVoucherCode> {
    return this.vouchers.claim(request.auth.userId, id);
  }

  @Get("my-vouchers")
  myVouchers(@Req() request: AuthenticatedRequest): Promise<BuyerVoucherCode[]> {
    return this.vouchers.myCodes(request.auth.userId);
  }
}
