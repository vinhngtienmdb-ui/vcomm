// Tải PDF hóa đơn lập theo ủy nhiệm bằng đường dẫn có hạn 10 phút cấp cho khách của giao dịch (CONG_VIEC_73 lát L6).
import { Controller, Get, Param, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { InstoreEinvoicesService } from "./mandated-einvoices.service";

@Controller("public/affiliate-einvoices")
export class PublicAffiliateEinvoicesController {
  constructor(private readonly mandatedEinvoices: InstoreEinvoicesService) {}

  @Public()
  @OwnRateLimit()
  @Get(":token")
  async pdf(@Param("token") token: string, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const file = await this.mandatedEinvoices.publicPdf(token);
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-disposition", `inline; filename="${file.fileName}"`);
    response.setHeader("cache-control", "no-store");
    return new StreamableFile(file.content);
  }
}
