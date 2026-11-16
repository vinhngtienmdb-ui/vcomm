// API_314 trang chia sẻ sản phẩm, API_315 tệp liên kết ứng dụng (CONG_VIEC_68; QUYTAC_NGHIEPVU_552 đến 556).
// Hai đường dẫn nằm ngoài tiền tố /api/v1 (main.ts) vì mạng xã hội, hệ điều hành đọc theo đường dẫn cố định.
import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { resolveLocale } from "i18n";
import type { Request, Response } from "express";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { RateLimiter } from "../common/rate-limiter";
import { renderSharePage, renderUnavailablePage, shareCodes, shareLinks, sharePageSecurityPolicy } from "./share-page";
import { ShareService } from "./share.service";

// Máy đọc của Facebook, Zalo kiểm nhiều sản phẩm từ cùng địa chỉ; giới hạn riêng rộng hơn mức chung 20 lần mỗi phút.
const sharePagePerMinute = 300;
const appIdentifier = "vn.vcomm.app";

@Controller()
export class ShareController {
  constructor(
    private readonly share: ShareService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  @Public()
  @OwnRateLimit()
  @Get("s/:productId")
  async sharePage(@Req() request: Request, @Param("productId") productId: string, @Query("ref") ref: unknown, @Query("ctv") ctv: unknown, @Res() response: Response): Promise<void> {
    const limited = await this.rateLimiter.consume(`chia-se:${request.ip ?? "khong-ro"}`, sharePagePerMinute);
    if (limited.retryAfterSeconds !== null) {
      response.status(429).setHeader("Retry-After", String(limited.retryAfterSeconds)).type("text").send("Too Many Requests");
      return;
    }
    const locale = resolveLocale(request.header("accept-language"));
    const links = shareLinks();
    const found = await this.share.product(productId);
    response.setHeader("Content-Security-Policy", sharePageSecurityPolicy(links)).setHeader("X-Content-Type-Options", "nosniff").setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (!found.product) {
      response
        .status(404)
        .setHeader("Cache-Control", "public, max-age=60")
        .type("html")
        .send(renderUnavailablePage(locale, links, found.storeName));
      return;
    }
    response
      .status(200)
      .setHeader("Cache-Control", "public, max-age=300")
      .setHeader("Vary", "Accept-Language")
      .type("html")
      .send(renderSharePage({ locale, links, storeName: found.storeName, currency: found.currency, product: found.product, codes: shareCodes(ref, ctv) }));
  }

  // Tệp liên kết ứng dụng: chưa cấu hình thì 404 (QUYTAC_NGHIEPVU_556).
  @Public()
  @Get(".well-known/apple-app-site-association")
  appleAssociation(@Res() response: Response): void {
    const teamId = process.env.APPLE_TEAM_ID?.trim();
    if (!teamId) {
      response.status(404).type("text").send("Not Found");
      return;
    }
    response
      .status(200)
      .type("application/json")
      .send(JSON.stringify({ applinks: { details: [{ appIDs: [`${teamId}.${appIdentifier}`], components: [{ "/": "/s/*" }] }] } }));
  }

  @Public()
  @Get(".well-known/assetlinks.json")
  androidAssociation(@Res() response: Response): void {
    const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    if (fingerprints.length === 0) {
      response.status(404).type("text").send("Not Found");
      return;
    }
    response
      .status(200)
      .type("application/json")
      .send(JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: appIdentifier, sha256_cert_fingerprints: fingerprints } }]));
  }
}
