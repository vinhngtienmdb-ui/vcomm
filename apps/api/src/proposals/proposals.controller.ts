// API_50 Mẫu đề xuất; API_51 Đề xuất; API_52 Tệp đính kèm; API_53 In đề xuất PDF (CHUC_NANG_27 đến 29).
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  attachmentMaximumBytes,
  createProposalTemplateSchema,
  proposalListQuerySchema,
  saveProposalSchema,
  updateProposalTemplateSchema,
  type AttachmentResponse,
  type PageResponse,
  type ProposalListItem,
  type ProposalResponse,
  type ProposalTemplateResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ProposalPdfService } from "./proposal-pdf.service";
import { ProposalTemplatesService } from "./proposal-templates.service";
import { ProposalsService } from "./proposals.service";

type UploadedAttachment = { buffer: Buffer; size: number; originalname: string };

// Tên tệp trong header: chữ không dấu cho trình duyệt cũ, bản UTF-8 đầy đủ theo RFC 5987.
const contentDisposition = (kind: "inline" | "attachment", fileName: string) =>
  `${kind}; filename="${fileName
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

@Controller()
export class ProposalsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly templates: ProposalTemplatesService,
    private readonly proposals: ProposalsService,
    private readonly pdf: ProposalPdfService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, ...anyOf);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // Người lập đề xuất thấy mẫu đang dùng; quản lý mẫu thấy cả mẫu ngừng dùng (tham số all=true).
  @Get("proposal-templates")
  async listTemplates(@Req() request: AuthenticatedRequest, @Query("all") all: string | undefined, @Headers("x-company-id") companyId?: string): Promise<ProposalTemplateResponse[]> {
    const actor = await this.actor(request, companyId, "platform.proposal.create", "platform.proposal_template.manage");
    return this.templates.list(actor, all === "true" && (await this.templates.canManage(actor)));
  }

  @Post("proposal-templates")
  async createTemplate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProposalTemplateResponse> {
    const actor = await this.actor(request, companyId, "platform.proposal_template.manage");
    return this.templates.create(actor, createProposalTemplateSchema.parse(body));
  }

  @Post("proposal-templates/defaults")
  @HttpCode(200)
  async createDefaults(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ProposalTemplateResponse[]> {
    return this.templates.createDefaults(await this.actor(request, companyId, "platform.proposal_template.manage"));
  }

  @Patch("proposal-templates/:id")
  async updateTemplate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProposalTemplateResponse> {
    const actor = await this.actor(request, companyId, "platform.proposal_template.manage");
    return this.templates.update(actor, id, updateProposalTemplateSchema.parse(body));
  }

  @Get("proposals")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<ProposalListItem>> {
    const input = proposalListQuerySchema.parse(query);
    return this.proposals.list(await this.actor(request, companyId, "platform.proposal.create", "platform.proposal_template.manage"), input);
  }

  @Post("proposals")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProposalResponse> {
    const actor = await this.actor(request, companyId, "platform.proposal.create");
    return this.proposals.create(actor, saveProposalSchema.parse(body));
  }

  // Người duyệt không cần quyền lập đề xuất vẫn xem được đề xuất mình duyệt (QUYTAC_NGHIEPVU_36).
  @Get("proposals/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ProposalResponse> {
    return this.proposals.detail(await this.memberActor(request, companyId), id);
  }

  @Patch("proposals/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProposalResponse> {
    const actor = await this.actor(request, companyId, "platform.proposal.create");
    return this.proposals.update(actor, id, saveProposalSchema.parse(body));
  }

  @Delete("proposals/:id")
  @HttpCode(204)
  async remove(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.proposals.remove(await this.actor(request, companyId, "platform.proposal.create"), id);
  }

  @Post("proposals/:id/submit")
  @HttpCode(200)
  async submit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ProposalResponse> {
    return this.proposals.submit(await this.actor(request, companyId, "platform.proposal.create"), id);
  }

  @Post("proposals/:id/withdraw")
  @HttpCode(200)
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ProposalResponse> {
    return this.proposals.withdraw(await this.actor(request, companyId, "platform.proposal.create"), id);
  }

  // API_52: tệp giữ trong bộ nhớ rồi ghi S3. Giới hạn 10 MB kiểm ở dịch vụ để báo đúng thông báo (QUYTAC_NGHIEPVU_35);
  // multer chỉ cắt tệp quá lớn bất thường.
  @Post("proposals/:id/attachments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: attachmentMaximumBytes * 2, files: 1 } }))
  async addAttachment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedAttachment | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AttachmentResponse> {
    return this.proposals.addAttachment(await this.actor(request, companyId, "platform.proposal.create"), id, file);
  }

  @Get("attachments/:id")
  async download(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    const file = await this.proposals.downloadAttachment(await this.memberActor(request, companyId), id);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", contentDisposition("attachment", file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Delete("attachments/:id")
  @HttpCode(204)
  async removeAttachment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.proposals.removeAttachment(await this.actor(request, companyId, "platform.proposal.create"), id);
  }

  // API_53
  @Get("proposals/:id/pdf")
  async printPdf(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    const file = await this.pdf.render(await this.memberActor(request, companyId), id);
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-disposition", contentDisposition("inline", file.fileName));
    response.send(file.content);
  }

  private async memberActor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "platform.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }
}
