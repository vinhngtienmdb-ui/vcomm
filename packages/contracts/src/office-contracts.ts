// Kho hợp đồng (CONG_VIEC_59 lát L2, MODULE_13): hợp đồng dữ liệu API_246, API_247.
import { z } from "zod";
import type { OfficePerson } from "./office";
import { signingSignerInputSchema, type SignatureCheckItem } from "./office-signing";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const version = z.number().int().min(1);
const money = z.string().regex(/^\d{1,18}(\.\d{1,2})?$/);

export const officeContractDirections = ["purchase", "sale", "none"] as const;
export type OfficeContractDirection = (typeof officeContractDirections)[number];
export const officeContractStatuses = ["draft", "pending", "rejected", "withdrawn", "awaiting_signature", "signed", "liquidated", "terminated", "cancelled"] as const;
export type OfficeContractStatus = (typeof officeContractStatuses)[number];
export type OfficeAppendixStatus = "draft" | "pending" | "rejected" | "withdrawn" | "awaiting_signature" | "signed" | "cancelled";
// Nhãn hiệu lực tính theo ngày (QUYTAC_NGHIEPVU_464), không phải trạng thái.
export const officeContractValidityLabels = ["not_effective", "active", "expiring", "expired"] as const;
export type OfficeContractValidity = (typeof officeContractValidityLabels)[number];

export const officeContractTypeSchema = z
  .object({ name: z.string().trim().min(1).max(100), direction: z.enum(officeContractDirections), status: z.enum(["active", "inactive"]).default("active") })
  .strict();
export interface OfficeContractTypeItem {
  id: string;
  name: string;
  direction: OfficeContractDirection;
  status: "active" | "inactive";
}

const reminderDays = z.array(z.number().int().min(1).max(365)).min(1).max(3);

const contractFields = {
  contractNo: z.string().trim().max(100).nullish(),
  name: z.string().trim().min(1).max(300),
  typeId: z.uuid(),
  partnerIds: z.array(z.uuid()).min(1).max(10),
  value: money.nullish(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/)
    .default("VND"),
  effectiveFrom: isoDate,
  expiresOn: isoDate.nullish(),
  ownerUserId: z.uuid().nullish(),
  departmentId: z.uuid().nullish(),
  confidential: z.boolean().default(false),
  description: z.string().trim().max(5000).nullish(),
  reminderDays: reminderDays.default([30, 7]),
};

export const officeSaveContractSchema = z
  .object({ ...contractFields, version: version.optional() })
  .strict()
  .refine((value) => !value.expiresOn || value.expiresOn >= value.effectiveFrom, { path: ["expiresOn"], message: "contractExpiryBeforeEffective" });
export type OfficeSaveContractInput = z.infer<typeof officeSaveContractSchema>;

// Nhập hợp đồng đã ký (QUYTAC_NGHIEPVU_465): thêm ngày ký, tệp đã ký bắt buộc.
export const officeImportContractSchema = z
  .object({ ...contractFields, signedOn: isoDate })
  .strict()
  .refine((value) => !value.expiresOn || value.expiresOn >= value.effectiveFrom, { path: ["expiresOn"], message: "contractExpiryBeforeEffective" });
export type OfficeImportContractInput = z.infer<typeof officeImportContractSchema>;

// Sửa sau khi đã ký: chỉ người phụ trách, phòng ban, mốc nhắc.
export const officeUpdateSignedContractSchema = z.object({ ownerUserId: z.uuid(), departmentId: z.uuid().nullish(), reminderDays, version }).strict();

export const officeContractListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    typeId: z.uuid().optional(),
    status: z.enum(officeContractStatuses).optional(),
    validity: z.enum(officeContractValidityLabels).optional(),
    mine: z.enum(["true", "false"]).optional(),
    expiresFrom: isoDate.optional(),
    expiresTo: isoDate.optional(),
    includeLabor: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();

export interface OfficeContractPartnerItem {
  id: string;
  name: string;
  kind: "organization" | "household" | "individual";
  taxCode: string | null;
  email: string | null;
}

export interface OfficeContractListItem {
  id: string;
  contractCode: string;
  contractNo: string | null;
  name: string;
  typeName: string;
  direction: OfficeContractDirection;
  partners: string[];
  value: string | null;
  currency: string;
  effectiveFrom: string;
  expiresOn: string | null;
  status: OfficeContractStatus;
  validity: OfficeContractValidity | null;
  confidential: boolean;
  owner: OfficePerson;
}

// Hợp đồng lao động hiện trong kho, chỉ đọc, không có lương (QUYTAC_NGHIEPVU_466).
export interface OfficeLaborContractListItem {
  id: string;
  documentNo: string;
  employeeName: string;
  kind: "probation" | "fixed_term" | "indefinite";
  effectiveDate: string;
  endDate: string | null;
  status: string;
  validity: OfficeContractValidity | null;
}

export interface OfficeContractListResponse {
  items: OfficeContractListItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: { active: number; expiring: number; expiredOpen: number; inProgress: number };
  laborContracts: OfficeLaborContractListItem[] | null;
}

export interface OfficeContractFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  role: "content" | "signed" | "end" | "attachment";
  createdAt: string;
}

export interface OfficeContractAppendixItem {
  id: string;
  appendixNo: string;
  summary: string;
  effectiveFrom: string;
  newExpiresOn: string | null;
  newValue: string | null;
  previousExpiresOn: string | null;
  previousValue: string | null;
  status: OfficeAppendixStatus;
  signedOn: string | null;
  imported: boolean;
  signingRequestId: string | null;
  approvalRequestId: string | null;
  decisionNote: string | null;
  contentFileId: string | null;
  signedFileId: string | null;
  allowed: ("edit" | "submit" | "withdraw" | "decide" | "signing" | "cancel")[];
  version: number;
}

export interface OfficeContractEventItem {
  id: string;
  actor: OfficePerson | null;
  kind: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface OfficeContractResponse extends OfficeContractListItem {
  companyId: string;
  typeId: string;
  partnerItems: OfficeContractPartnerItem[];
  departmentId: string | null;
  departmentName: string | null;
  description: string | null;
  reminderDays: number[];
  signedOn: string | null;
  imported: boolean;
  approvalMode: "policy" | "manager" | null;
  approvalRequestId: string | null;
  approvers: OfficePerson[];
  decisionNote: string | null;
  signingRequestId: string | null;
  signatureChecks: SignatureCheckItem[] | null;
  endedOn: string | null;
  endReason: string | null;
  cancelReason: string | null;
  files: OfficeContractFile[];
  appendices: OfficeContractAppendixItem[];
  shares: OfficePerson[];
  viewReasons: string[];
  events: OfficeContractEventItem[];
  createdBy: OfficePerson;
  createdAt: string;
  version: number;
  allowed: ("edit" | "submit" | "withdraw" | "decide" | "signing" | "cancel" | "end" | "appendix" | "share" | "update_signed" | "attach")[];
}

export const officeContractDecisionSchema = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).nullish(), version }).strict();
export const officeContractReasonSchema = z.object({ reason: z.string().trim().min(1).max(1000), version }).strict();
export const officeContractVersionSchema = z.object({ version }).strict();
// Thanh lý, chấm dứt: ngày, lý do, tệp biên bản bắt buộc (multipart).
export const officeEndContractSchema = z.object({ kind: z.enum(["liquidated", "terminated"]), endedOn: isoDate, reason: z.string().trim().min(1).max(1000), version }).strict();
export const officeShareContractSchema = z.object({ userId: z.uuid() }).strict();

// Lập phiên ký từ hợp đồng, phụ lục đã duyệt (QUYTAC_NGHIEPVU_464): người ký như phiên ký thường.
export const officeContractSigningSchema = z.object({ dueOn: isoDate, note: z.string().trim().max(2000).nullish(), signers: z.array(signingSignerInputSchema).min(1).max(10), version }).strict();
export type OfficeContractSigningInput = z.infer<typeof officeContractSigningSchema>;

export const officeSaveAppendixSchema = z
  .object({
    appendixNo: z.string().trim().min(1).max(50),
    summary: z.string().trim().min(1).max(2000),
    effectiveFrom: isoDate,
    newExpiresOn: isoDate.nullish(),
    newValue: money.nullish(),
    version: version.optional(),
  })
  .strict();
export type OfficeSaveAppendixInput = z.infer<typeof officeSaveAppendixSchema>;
export const officeImportAppendixSchema = officeSaveAppendixSchema.extend({ signedOn: isoDate }).omit({ version: true });

export interface OfficeContractOptions {
  types: OfficeContractTypeItem[];
  departments: { id: string; name: string }[];
  currencies: string[];
  canManage: boolean;
  canCreate: boolean;
  canViewAll: boolean;
  canViewLabor: boolean;
}
export const officeContractPartnerQuerySchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();
