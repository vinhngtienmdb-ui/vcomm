// API_131: người mua mở trang thanh toán; API_132: kết quả VNPAY gửi về (IPN) và trang trả về (CONG_VIEC_25).
import { Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { BuyerPaymentStart } from "contracts";
import type { Request, Response } from "express";
import { clientInfo } from "../../auth/auth.controller";
import { OwnRateLimit, Public, type AuthenticatedRequest } from "../../auth/auth.guard";
import { UuidPipe } from "../../common/uuid.pipe";
import { MarketplacePaymentsService, type IpnReply } from "./payments.service";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
const messages = {
  succeeded: "Thanh toán thành công. Đơn hàng đang chờ giao.",
  failed: "Thanh toán không thành công. Bạn có thể thanh toán lại trong thời hạn của đơn.",
  pending: "VComm đang chờ kết quả từ VNPAY. Mở đơn hàng để xem trạng thái mới nhất.",
  invalid: "Không xác nhận được kết quả thanh toán.",
} as const;

@Controller()
export class PaymentsController {
  constructor(private readonly payments: MarketplacePaymentsService) {}

  @Post("buyer/orders/:id/payments")
  start(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerPaymentStart> {
    return this.payments.start(request.auth.userId, clientInfo(request), id);
  }

  @Public()
  @OwnRateLimit()
  @Get("public/payments/vnpay/ipn")
  ipn(@Req() request: Request, @Query() query: Record<string, unknown>): Promise<IpnReply> {
    return this.payments.vnpayIpn(query, request.ip ?? "khong-ro");
  }

  // Trang trả về chỉ hiển thị kết quả và liên kết mở lại đơn trên ứng dụng.
  @Public()
  @OwnRateLimit()
  @Get("public/payments/vnpay/return")
  async returnPage(@Req() request: Request, @Query() query: Record<string, unknown>, @Res() response: Response): Promise<void> {
    const outcome = await this.payments.vnpayReturn(query, request.ip ?? "khong-ro");
    const base = process.env.VCOMM_APP_LINK_BASE?.trim() || "vcomm://";
    const link = outcome.orderId ? `${base}don-hang/${outcome.orderId}` : base;
    response
      .status(200)
      .type("html")
      .setHeader("Cache-Control", "no-store")
      .send(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VComm</title></head>` +
          `<body style="font-family:system-ui,sans-serif;padding:24px;max-width:480px;margin:auto"><h1 style="font-size:20px">VComm</h1>` +
          `<p>${escapeHtml(messages[outcome.state])}</p><p><a href="${escapeHtml(link)}">Mở đơn hàng trên ứng dụng VComm</a></p></body></html>`,
      );
  }
}
