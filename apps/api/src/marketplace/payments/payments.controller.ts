// API_131: người mua mở thanh toán; API_132: kết quả cổng gửi về và trang trả về (CONG_VIEC_25, CONG_VIEC_32); kế toán xác nhận tiền chuyển khoản (CONG_VIEC_36).
import { All, Body, Controller, Get, HttpCode, Param, Post, Req, Res } from "@nestjs/common";
import { type BuyerPaymentStart, confirmBankTransferSchema, type MarketplaceOrderDetail } from "contracts";
import type { Request, Response } from "express";
import { clientInfo } from "../../auth/auth.controller";
import { OwnRateLimit, Public, type AuthenticatedRequest } from "../../auth/auth.guard";
import { escapeHtml } from "../../common/html";
import { UuidPipe } from "../../common/uuid.pipe";
import { BuyerAdminService } from "../buyer-admin.service";
import { MarketplaceOrdersService } from "../marketplace-orders.service";
import { BankTransferService } from "./bank-transfer.service";
import type { GatewayRequest } from "./payment-gateway";
import { MarketplacePaymentsService } from "./payments.service";

const messages = {
  succeeded: "Thanh toán thành công. Đơn hàng đang chờ giao.",
  failed: "Thanh toán không thành công. Bạn có thể thanh toán lại trong thời hạn của đơn.",
  pending: "VComm đang chờ kết quả từ cổng thanh toán. Mở đơn hàng để xem trạng thái mới nhất.",
  invalid: "Không xác nhận được kết quả thanh toán.",
} as const;
const gatewayRequest = (request: Request): GatewayRequest => ({
  method: request.method,
  query: request.query as Record<string, unknown>,
  body: request.body as unknown,
  headers: request.headers,
  ip: request.ip,
});

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: MarketplacePaymentsService,
    private readonly bankTransfers: BankTransferService,
    private readonly admin: BuyerAdminService,
    private readonly orders: MarketplaceOrdersService,
  ) {}

  @Post("buyer/orders/:id/payments")
  start(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerPaymentStart> {
    return this.payments.start(request.auth.userId, clientInfo(request), id);
  }

  // Kế toán xác nhận đã nhận tiền chuyển khoản khi không tự ghép được (CONG_VIEC_36; QUYTAC_NGHIEPVU_242).
  @Post("marketplace/orders/:id/transfer-received")
  @HttpCode(200)
  async transferReceived(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<MarketplaceOrderDetail> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.payment.manage");
    await this.bankTransfers.confirmManually(actor, id, confirmBankTransferSchema.parse(body));
    return this.orders.adminDetail(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "marketplace.order.manage"), true);
  }

  // Đường dẫn IPN đã đăng ký với VNPAY (CONG_VIEC_25).
  @Public()
  @OwnRateLimit()
  @Get("public/payments/vnpay/ipn")
  async vnpayIpn(@Req() request: Request, @Res() response: Response): Promise<void> {
    const reply = await this.payments.notify("vnpay", gatewayRequest(request), request.ip ?? "khong-ro");
    response.status(reply.status).json(reply.body);
  }

  // Đường dẫn nhận kết quả chung của mọi cổng (CONG_VIEC_32): mã cổng trên đường dẫn, xác thực bằng chữ ký hoặc khóa của từng cổng.
  @Public()
  @OwnRateLimit()
  @All("public/payments/:gateway/notify")
  async notify(@Req() request: Request, @Param("gateway") gateway: string, @Res() response: Response): Promise<void> {
    const reply = await this.payments.notify(gateway, gatewayRequest(request), request.ip ?? "khong-ro");
    response.status(reply.status).json(reply.body);
  }

  // BIDV thu hộ qua tài khoản định danh gọi hai hàm vấn tin và gạch nợ trên cùng đường dẫn gốc đăng ký với BIDV (CONG_VIEC_37).
  @Public()
  @OwnRateLimit()
  @Post("public/payments/bidv/getbill")
  async bidvInquiry(@Req() request: Request, @Res() response: Response): Promise<void> {
    const reply = await this.payments.inquire("bidv", gatewayRequest(request), request.ip ?? "khong-ro");
    response.status(reply.status).json(reply.body);
  }

  @Public()
  @OwnRateLimit()
  @Post("public/payments/bidv/paybill")
  async bidvPayment(@Req() request: Request, @Res() response: Response): Promise<void> {
    const reply = await this.payments.notify("bidv", gatewayRequest(request), request.ip ?? "khong-ro");
    response.status(reply.status).json(reply.body);
  }

  // Trang trả về chỉ hiển thị kết quả và liên kết mở lại đơn trên ứng dụng.
  @Public()
  @OwnRateLimit()
  @Get("public/payments/:gateway/return")
  async returnPage(@Req() request: Request, @Param("gateway") gateway: string, @Res() response: Response): Promise<void> {
    const outcome = await this.payments.returnOutcome(gateway, gatewayRequest(request), request.ip ?? "khong-ro");
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
