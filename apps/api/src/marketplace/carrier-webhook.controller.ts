// API_128: webhook trạng thái vận đơn của đơn vị vận chuyển (CONG_VIEC_24; QUYTAC_NGHIEPVU_160). Xác thực bằng khóa trên đường dẫn.
import { Body, Controller, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { ShipmentsService } from "./shipments.service";

@Controller("public/carriers")
export class CarrierWebhookController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Public()
  @OwnRateLimit()
  @Post(":code/webhook/:key")
  @HttpCode(200)
  receive(@Req() request: Request, @Param("code") code: string, @Param("key") key: string, @Body() body: unknown): Promise<unknown> {
    return this.shipments.webhook(code, key, body, request.ip ?? "khong-ro");
  }
}
