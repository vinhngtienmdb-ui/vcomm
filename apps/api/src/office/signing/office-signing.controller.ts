// API_241 Cài đặt ký số, chứng thư gốc tin cậy; API_242 Tài khoản ký số của tôi; API_243 Phiên ký; API_244 Trang ký của đối tác; API_245 Kiểm tra chữ ký (CONG_VIEC_59).
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import {
  publicSigningRejectSchema,
  saveSigningRequestSchema,
  selectSigningCertificateSchema,
  signingCertificateQuerySchema,
  signingReasonSchema,
  signingRequestListQuerySchema,
  signingResendSchema,
  signingSettingsSchema,
  signingSignActionSchema,
  signingVersionSchema,
  trustedRootStatusSchema,
  type MySigningIdentity,
  type PublicSigningView,
  type SignatureVerificationResponse,
  type SigningCertificateOption,
  type SigningRequestListItem,
  type SigningRequestResponse,
  type SigningSettingsResponse,
  type TrustedRootItem,
} from "contracts";
import type { Request, Response } from "express";
import { clientInfo } from "../../auth/auth.controller";
import { OwnRateLimit, Public, type AuthenticatedRequest } from "../../auth/auth.guard";
import { ApiError } from "../../common/api-error";
import { RateLimiter } from "../../common/rate-limiter";
import { UuidPipe } from "../../common/uuid.pipe";
import { PermissionService } from "../../permissions/permission.service";
import type { Actor } from "../../permissions/roles.service";
import { officeContentDisposition } from "../office.controller";
import { OfficeFileUpload } from "../office-upload";
import { OfficeSigningService } from "./office-signing.service";
import { jsonField } from "../office-documents.controller";

type Upload = { buffer: Buffer; size: number; originalname: string };

function sendFile(response: Response, file: { fileName: string; contentType: string; content: Buffer }, kind: "inline" | "attachment") {
  response.setHeader("content-type", file.contentType);
  response.setHeader("content-disposition", officeContentDisposition(kind, file.fileName));
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("cache-control", "no-store");
  response.send(file.content);
}

@Controller("office")
export class OfficeSigningController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly signing: OfficeSigningService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, permission = "office.access"): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, permission);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // API_241
  @Get("signing-settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<SigningSettingsResponse> {
    return this.signing.settings(await this.actor(request, companyId));
  }

  @Put("signing-settings")
  async saveSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningSettingsResponse> {
    return this.signing.saveSettings(await this.actor(request, companyId, "office.signing.manage"), signingSettingsSchema.parse(body));
  }

  @Post("signing-settings/test")
  @HttpCode(204)
  async test(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.signing.testConnection(await this.actor(request, companyId, "office.signing.manage"));
  }

  @Post("signing-settings/seal-certificates")
  @HttpCode(200)
  async sealCertificates(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningCertificateOption[]> {
    return this.signing.sealCertificates(await this.actor(request, companyId, "office.signing.manage"), signingCertificateQuerySchema.parse(body).identityCode);
  }

  @Put("signing-settings/seal")
  async selectSeal(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningSettingsResponse> {
    const input = selectSigningCertificateSchema.parse(body);
    return this.signing.selectSeal(await this.actor(request, companyId, "office.signing.manage"), input.identityCode, input.serialNumber);
  }

  @Get("trusted-roots")
  async trustedRoots(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<TrustedRootItem[]> {
    return this.signing.trustedRoots(await this.actor(request, companyId));
  }

  @Post("trusted-roots")
  @UseInterceptors(OfficeFileUpload())
  async addTrustedRoot(@Req() request: AuthenticatedRequest, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string): Promise<TrustedRootItem[]> {
    return this.signing.addTrustedRoot(await this.actor(request, companyId), file);
  }

  @Patch("trusted-roots/:id")
  async trustedRootStatus(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<TrustedRootItem[]> {
    return this.signing.setTrustedRootStatus(await this.actor(request, companyId), id, trustedRootStatusSchema.parse(body).status);
  }

  // API_242
  @Get("signing-identities/me")
  async myIdentity(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MySigningIdentity> {
    return this.signing.myIdentity(await this.actor(request, companyId));
  }

  @Post("signing-identities/me/certificates")
  @HttpCode(200)
  async myCertificates(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningCertificateOption[]> {
    return this.signing.myCertificates(await this.actor(request, companyId), signingCertificateQuerySchema.parse(body).identityCode);
  }

  @Put("signing-identities/me")
  async selectMyCertificate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<MySigningIdentity> {
    const input = selectSigningCertificateSchema.parse(body);
    return this.signing.selectMyCertificate(await this.actor(request, companyId), input.identityCode, input.serialNumber);
  }

  // API_245
  @Post("signature-verifications")
  @HttpCode(200)
  @UseInterceptors(OfficeFileUpload())
  async verify(@Req() request: AuthenticatedRequest, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string): Promise<SignatureVerificationResponse> {
    const actor = await this.actor(request, companyId, "office.signing.use");
    // Kiểm tra tốn tính toán (băm tệp tới 20 MB): tối đa 20 lần mỗi phút mỗi người dùng.
    const limited = await this.rateLimiter.consume(`kiem-tra-chu-ky:${actor.userId}`, 20);
    if (limited.retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds: limited.retryAfterSeconds });
    return this.signing.verify(actor, file);
  }

  // API_243
  @Get("signing-requests")
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<{ items: SigningRequestListItem[]; total: number; page: number; pageSize: number }> {
    return this.signing.list(await this.actor(request, companyId), signingRequestListQuerySchema.parse(query));
  }

  // Lập phiên: multipart gồm "data" (JSON) và tệp PDF "file".
  @Post("signing-requests")
  @UseInterceptors(OfficeFileUpload())
  async create(
    @Req() request: AuthenticatedRequest,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<SigningRequestResponse> {
    return this.signing.create(await this.actor(request, companyId, "office.signing.use"), saveSigningRequestSchema.parse(jsonField(data)), file);
  }

  // Sửa nháp: multipart, tệp không bắt buộc (POST vì trình duyệt gửi multipart bằng POST).
  @Post("signing-requests/:id")
  @UseInterceptors(OfficeFileUpload())
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<SigningRequestResponse> {
    return this.signing.update(await this.actor(request, companyId), id, saveSigningRequestSchema.parse(jsonField(data)), file);
  }

  @Get("signing-requests/:id")
  async get(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    return this.signing.get(await this.actor(request, companyId), id);
  }

  @Get("signing-requests/:id/file")
  async file(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Query("which") which: string | undefined,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ) {
    const file = await this.signing.file(await this.actor(request, companyId), id, which === "original" ? "original" : "current");
    sendFile(response, file, "inline");
  }

  @Post("signing-requests/:id/send")
  @HttpCode(200)
  async send(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    return this.signing.send(await this.actor(request, companyId), id, signingVersionSchema.parse(body).version);
  }

  @Post("signing-requests/:id/sign")
  @HttpCode(200)
  async sign(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    const input = signingSignActionSchema.parse(body);
    return this.signing.sign(await this.actor(request, companyId), id, input.signerId, input.version);
  }

  @Post("signing-requests/:id/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    const input = signingReasonSchema.parse(body);
    return this.signing.reject(await this.actor(request, companyId), id, input.reason, input.version);
  }

  @Post("signing-requests/:id/remind")
  @HttpCode(200)
  async remind(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    return this.signing.remind(await this.actor(request, companyId), id, signingVersionSchema.parse(body).version);
  }

  @Post("signing-requests/:id/resend")
  @HttpCode(200)
  async resend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    const input = signingResendSchema.parse(body);
    return this.signing.resend(await this.actor(request, companyId), id, input.signerId, input.version);
  }

  @Post("signing-requests/:id/cancel")
  @HttpCode(200)
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    const input = signingReasonSchema.parse(body);
    return this.signing.cancel(await this.actor(request, companyId), id, input.reason, input.version);
  }

  @Post("signing-requests/:id/copy")
  async copy(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<SigningRequestResponse> {
    return this.signing.copy(await this.actor(request, companyId, "office.signing.use"), id);
  }
}

// API_244: không đăng nhập; giới hạn 10 yêu cầu mỗi phút cho mỗi đường dẫn, 60 mỗi phút cho mỗi địa chỉ IP (QUYTAC_NGHIEPVU_460).
@Controller("public/signing")
export class PublicSigningController {
  constructor(
    private readonly signing: OfficeSigningService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  private async limit(request: Request, token: string): Promise<void> {
    const byLink = await this.rateLimiter.consume(`ky-so-duong-dan:${token.slice(0, 16)}`, 10);
    const byAddress = await this.rateLimiter.consume(`ky-so-dia-chi:${request.ip ?? "khong-ro"}`, 60);
    const retryAfterSeconds = byLink.retryAfterSeconds ?? byAddress.retryAfterSeconds;
    if (retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds });
  }

  @Public()
  @OwnRateLimit()
  @Get(":token")
  async view(@Req() request: Request, @Param("token") token: string): Promise<PublicSigningView> {
    await this.limit(request, token);
    return this.signing.publicStatus(token);
  }

  @Public()
  @OwnRateLimit()
  @Get(":token/file")
  async file(@Req() request: Request, @Param("token") token: string, @Res() response: Response) {
    await this.limit(request, token);
    sendFile(response, await this.signing.publicFile(token), "inline");
  }

  @Public()
  @OwnRateLimit()
  @Post(":token/sign")
  @HttpCode(200)
  async sign(@Req() request: Request, @Param("token") token: string): Promise<PublicSigningView> {
    await this.limit(request, token);
    return this.signing.publicSign(token, { ip: request.ip ?? null });
  }

  @Public()
  @OwnRateLimit()
  @Post(":token/reject")
  @HttpCode(204)
  async reject(@Req() request: Request, @Param("token") token: string, @Body() body: unknown): Promise<void> {
    await this.limit(request, token);
    await this.signing.publicReject(token, publicSigningRejectSchema.parse(body).reason);
  }
}
