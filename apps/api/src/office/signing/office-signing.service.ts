// Ký số tài liệu PDF (CONG_VIEC_59 lát L1; CHUC_NANG_210, 211; QUYTAC_NGHIEPVU_454 đến 461; API_241 đến API_245).
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  MySigningIdentity,
  PublicSigningView,
  SaveSigningRequestInput,
  SignatureVerificationResponse,
  SigningCertificateOption,
  SigningEventItem,
  SigningRequestListItem,
  SigningRequestResponse,
  SigningRequestStatus,
  SigningSettingsInput,
  SigningSettingsResponse,
  SigningSignerItem,
  TrustedRootItem,
  signingRequestListQuerySchema,
} from "contracts";
import { signingRequestMaximumDays } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import forge from "node-forge";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { CLOCK, type Clock } from "../../common/clock";
import { FILE_STORAGE, type FileStorage } from "../../common/file-storage";
import { notify } from "../../common/notifications";
import { OUTBOUND_MESSAGES, webOrigin, type OutboundMessages } from "../../common/outbound-messages";
import { decryptSecret, encryptSecret } from "../../common/secret-box";
import { DATABASE, type Database } from "../../database/database.module";
import { PermissionService } from "../../permissions/permission.service";
import type { Actor } from "../../permissions/roles.service";
import { NumberSequencesService, periodKey } from "../../settings/number-sequences.service";
import { activeGroupUsers, groupRootOf, peopleById } from "../office-access";
import { completeSignature, PdfSigningError, prepareSignature } from "./pdf-signing";
import { summarizeCertificate, verifyPdfSignatures } from "./pdf-verification";
import type { SigningProvider, SigningProviderConfig } from "./providers/signing-provider";
import { SigningProviderError, SimulatorSigningProvider } from "./providers/simulator-provider";

type Executor = Pick<Database, "execute">;
export type SigningSource = "document" | "contract" | "contract_appendix";
// Phiên ký của chứng từ khác (hợp đồng, phụ lục): chứng từ nguồn nhận kết quả trong cùng giao dịch.
export interface SigningOutcome {
  requestId: string;
  companyId: string;
  sourceType: SigningSource;
  sourceId: string | null;
  status: "completed" | "rejected" | "cancelled" | "expired";
  currentFileId: string | null;
  reason: string | null;
}
type Upload = { buffer: Buffer; size: number; originalname: string } | undefined;
export interface ClientInfo {
  ip: string | null;
}

// Lần ký chờ xác nhận tối đa 5 phút (QUYTAC_NGHIEPVU_457).
export const signingAttemptTimeoutMilliseconds = 5 * 60_000;
const maximumPdfBytes = 20 * 1024 * 1024;
const signingReason = "Ký số trên VComm";

const iso = (value: string | Date | null): string | null => (value === null ? null : new Date(value).toISOString());
const sha256Hex = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const tokenHash = (token: string) => createHash("sha256").update(token).digest();
// So khớp mã định danh trong chứng thư ("MST:0312345678", "CCCD:079…") với mã đã khai, bỏ tiền tố và gạch ngang.
const identityDigits = (value: string) => value.replace(/^[A-Za-z]+:/, "").replace(/-/g, "");
const vietnamTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

type RequestRow = {
  id: string;
  company_id: string;
  company_name: string;
  request_no: string;
  source_type: SigningSource;
  source_id: string | null;
  title: string;
  note: string | null;
  due_on: string;
  status: SigningRequestStatus;
  original_file_id: string | null;
  current_file_id: string | null;
  copied_from_id: string | null;
  end_reason: string | null;
  sent_at: string | null;
  completed_at: string | null;
  last_reminded_at: string | null;
  created_by: string;
  created_at: string;
  version: number;
};

type SignerRow = {
  id: string;
  request_id: string;
  position: number;
  sign_order: number;
  kind: "user" | "company" | "partner";
  user_id: string | null;
  partner_id: string | null;
  partner_kind: "organization" | "individual" | null;
  partner_name: string | null;
  partner_email: string | null;
  partner_identity: string | null;
  partner_identity_code: string | null;
  page: string;
  corner: SigningSignerItem["corner"];
  status: SigningSignerItem["status"];
  signed_at: string | null;
  signed_by: string | null;
  signer_subject: string | null;
  reject_reason: string | null;
  link_sent_at: string | null;
};

type AttemptRow = {
  id: string;
  request_id: string;
  signer_id: string;
  base_file_id: string;
  prepared_storage_key: string;
  certificate_chain: string[];
  identity_code: string;
  transaction_id: string | null;
  status: "pending" | "signed" | "rejected" | "failed" | "timeout";
  message: string | null;
  started_at: string;
  company_id: string;
};

type SettingsRow = {
  provider: "simulator";
  environment: "test" | "production";
  credentials_encrypted: Buffer | null;
  seal_identity_code: string | null;
  seal_certificate_chain: string[] | null;
  seal_serial_number: string | null;
  seal_subject_name: string | null;
  seal_valid_from: string | null;
  seal_valid_to: string | null;
  version: number;
};

@Injectable()
export class OfficeSigningService {
  private readonly logger = new Logger("OfficeSigning");
  private readonly providers: Record<"simulator", SigningProvider>;
  readonly outcomeHooks: ((executor: Executor, outcome: SigningOutcome) => Promise<void>)[] = [];

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(OUTBOUND_MESSAGES) private readonly outbound: OutboundMessages,
    private readonly permissionService: PermissionService,
    private readonly sequences: NumberSequencesService,
    private readonly auditService: AuditService,
  ) {
    const delay = Number(process.env.SIGNING_SIMULATOR_CONFIRM_MILLISECONDS ?? 2000);
    this.providers = { simulator: new SimulatorSigningProvider(undefined, Number.isFinite(delay) ? delay : 2000) };
  }

  // Bộ giả lập dùng trong kiểm thử để lấy chứng thư gốc làm gốc tin cậy.
  simulator(): SimulatorSigningProvider {
    return this.providers.simulator as SimulatorSigningProvider;
  }

  private audit(actor: Actor, entityType: string) {
    return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "office", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
  }

  private async granted(actor: Actor, companyId = actor.companyId): Promise<Set<string>> {
    return this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId });
  }

  private async require(actor: Actor, permission: string): Promise<void> {
    if (!(await this.granted(actor)).has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  private businessRule(key: ErrorMessageKey): ApiError {
    return new ApiError("BUSINESS_RULE", key);
  }

  // Người đang hoạt động, thành viên công ty, có quyền bao trùm công ty.
  private async permissionHolders(executor: Executor, companyId: string, permission: string): Promise<string[]> {
    const today = this.permissionService.today();
    const rows = await executor.execute<{ user_id: string }>(sql`
      SELECT DISTINCT a.user_id FROM core.user_role_assignments a
      JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN core.role_permissions rp ON rp.role_id = r.id AND rp.permission_code = ${permission}
      JOIN core.users u ON u.id = a.user_id AND u.status = 'active'
      JOIN core.user_company_memberships m ON m.user_id = a.user_id AND m.company_id = ${companyId} AND m.status = 'active'
      WHERE (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${companyId}))
        AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)`);
    return rows.rows.map((row) => row.user_id);
  }

  // ---------- Cài đặt nhà cung cấp, chữ ký số công ty (API_241; QUYTAC_NGHIEPVU_454, 456) ----------

  private async settingsRow(executor: Executor, companyId: string): Promise<SettingsRow | null> {
    return (await executor.execute<SettingsRow>(sql`SELECT * FROM office.signing_settings WHERE company_id = ${companyId}`)).rows[0] ?? null;
  }

  private providerConfig(companyId: string, settings: SettingsRow): SigningProviderConfig {
    const credentials = settings.credentials_encrypted ? (JSON.parse(decryptSecret(settings.credentials_encrypted)) as Record<string, string>) : {};
    return { companyId, environment: settings.environment, credentials };
  }

  // Gọi nhà cung cấp; lỗi của nhà cung cấp đổi thành lỗi nghiệp vụ, không ghi thông tin kết nối vào log.
  private async callProvider<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof SigningProviderError) {
        if (error.reason === "not_allowed") throw this.businessRule("signingSimulatorNotAllowed");
        if (error.reason === "invalid_identity") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { identityCode: "signingIdentityCodeInvalid" } });
        throw this.businessRule("signingCertificateNotFound");
      }
      this.logger.error(`Nhà cung cấp ký số lỗi: ${(error as Error).message}`);
      throw this.businessRule("signingProviderError");
    }
  }

  private async requireSettings(executor: Executor, companyId: string): Promise<{ settings: SettingsRow; provider: SigningProvider; config: SigningProviderConfig }> {
    const settings = await this.settingsRow(executor, companyId);
    if (!settings) throw this.businessRule("signingNotConfigured");
    if (settings.provider === "simulator" && (process.env.NODE_ENV === "production" || settings.environment === "production")) throw this.businessRule("signingSimulatorNotAllowed");
    return { settings, provider: this.providers[settings.provider], config: this.providerConfig(companyId, settings) };
  }

  async settings(actor: Actor): Promise<SigningSettingsResponse> {
    const granted = await this.granted(actor);
    const settings = await this.settingsRow(this.database, actor.companyId);
    const company = (await this.database.execute<{ tax_code: string | null }>(sql`SELECT tax_code FROM core.companies WHERE id = ${actor.companyId}`)).rows[0];
    const groupRoot = await groupRootOf(this.database, actor.companyId);
    const rootGranted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: groupRoot });
    return {
      configured: settings !== null,
      provider: settings?.provider ?? null,
      environment: settings?.environment ?? null,
      hasCredentials: !!settings?.credentials_encrypted,
      seal:
        settings?.seal_identity_code && settings.seal_serial_number
          ? {
              identityCode: settings.seal_identity_code,
              subjectName: settings.seal_subject_name ?? "",
              serialNumber: settings.seal_serial_number,
              validFrom: iso(settings.seal_valid_from)!,
              validTo: iso(settings.seal_valid_to)!,
            }
          : null,
      companyTaxCode: company?.tax_code ?? null,
      simulatorAllowed: process.env.NODE_ENV !== "production",
      version: settings?.version ?? null,
      canManage: granted.has("office.signing.manage"),
      // Chứng thư gốc tin cậy dùng chung tập đoàn: cần quyền quản lý ký số bao trùm công ty gốc (phạm vi tập đoàn).
      canManageRoots: rootGranted.has("office.signing.manage"),
    };
  }

  async saveSettings(actor: Actor, input: SigningSettingsInput): Promise<SigningSettingsResponse> {
    await this.require(actor, "office.signing.manage");
    if (input.provider === "simulator" && (process.env.NODE_ENV === "production" || input.environment === "production")) throw this.businessRule("signingSimulatorNotAllowed");
    const existing = await this.settingsRow(this.database, actor.companyId);
    if (existing && input.version !== existing.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    const credentials = input.credentials && Object.keys(input.credentials).length > 0 ? encryptSecret(JSON.stringify(input.credentials)) : (existing?.credentials_encrypted ?? null);
    const candidate: SettingsRow = {
      provider: input.provider,
      environment: input.environment,
      credentials_encrypted: credentials,
      seal_identity_code: null,
      seal_certificate_chain: null,
      seal_serial_number: null,
      seal_subject_name: null,
      seal_valid_from: null,
      seal_valid_to: null,
      version: 1,
    };
    // Kiểm tra kết nối trước khi lưu.
    await this.callProvider(() => this.providers[input.provider].checkConnection(this.providerConfig(actor.companyId, candidate)));
    // Đổi nhà cung cấp hoặc môi trường thì chữ ký số công ty đã chọn không còn dùng được.
    const keepSeal = existing && existing.provider === input.provider && existing.environment === input.environment;
    await this.database.execute(sql`
      INSERT INTO office.signing_settings (company_id, provider, environment, credentials_encrypted, updated_by)
      VALUES (${actor.companyId}, ${input.provider}, ${input.environment}, ${credentials}, ${actor.userId})
      ON CONFLICT (company_id) DO UPDATE SET provider = EXCLUDED.provider, environment = EXCLUDED.environment, credentials_encrypted = EXCLUDED.credentials_encrypted,
        updated_by = EXCLUDED.updated_by, updated_at = now(), version = office.signing_settings.version + 1
        ${keepSeal ? sql`` : sql`, seal_identity_code = NULL, seal_certificate_chain = NULL, seal_serial_number = NULL, seal_subject_name = NULL, seal_valid_from = NULL, seal_valid_to = NULL`}`);
    await this.auditService.record({
      ...this.audit(actor, "office_signing_settings"),
      action: "office.signing_settings.update",
      afterData: { provider: input.provider, environment: input.environment },
    });
    return this.settings(actor);
  }

  async testConnection(actor: Actor): Promise<void> {
    await this.require(actor, "office.signing.manage");
    const { provider, config } = await this.requireSettings(this.database, actor.companyId);
    await this.callProvider(() => provider.checkConnection(config));
  }

  private toOption(chainPem: string[], now: Date): SigningCertificateOption & { chain: string[] } {
    const certificate = forge.pki.certificateFromPem(chainPem[0]!);
    const summary = summarizeCertificate(certificate);
    const issuer = certificate.issuer.getField("CN") as { value: string; valueTagClass?: number } | null;
    return {
      serialNumber: certificate.serialNumber,
      subjectName: summary.commonName ?? "",
      identities: summary.identities,
      issuerName: issuer ? (issuer.valueTagClass === forge.asn1.Type.UTF8 ? forge.util.decodeUtf8(issuer.value) : issuer.value) : null,
      validFrom: summary.validFrom.toISOString(),
      validTo: summary.validTo.toISOString(),
      usable: summary.validFrom <= now && now <= summary.validTo,
      chain: chainPem,
    };
  }

  private async certificates(companyId: string, identityCode: string): Promise<(SigningCertificateOption & { chain: string[] })[]> {
    const { provider, config } = await this.requireSettings(this.database, companyId);
    const list = await this.callProvider(() => provider.listCertificates(config, identityCode));
    const now = this.clock.now();
    return list.map((item) => this.toOption(item.certificateChainPem, now));
  }

  async sealCertificates(actor: Actor, identityCode: string): Promise<SigningCertificateOption[]> {
    await this.require(actor, "office.signing.manage");
    return (await this.certificates(actor.companyId, identityCode)).map(({ chain: _chain, ...option }) => option);
  }

  async selectSeal(actor: Actor, identityCode: string, serialNumber: string): Promise<SigningSettingsResponse> {
    await this.require(actor, "office.signing.manage");
    const option = (await this.certificates(actor.companyId, identityCode)).find((item) => item.serialNumber === serialNumber);
    if (!option) throw this.businessRule("signingCertificateNotFound");
    if (!option.usable) throw this.businessRule("signingCertificateNotUsable");
    // Chủ thể chứng thư phải có mã số thuế trùng mã số thuế công ty (QUYTAC_NGHIEPVU_456).
    const company = (await this.database.execute<{ tax_code: string | null }>(sql`SELECT tax_code FROM core.companies WHERE id = ${actor.companyId}`)).rows[0];
    const taxCode = company?.tax_code ? identityDigits(company.tax_code) : null;
    if (!taxCode || !option.identities.some((identity) => identity.toUpperCase().startsWith("MST:") && identityDigits(identity) === taxCode)) throw this.businessRule("signingSealTaxCodeMismatch");
    await this.database.execute(sql`
      UPDATE office.signing_settings SET seal_identity_code = ${identityCode}, seal_certificate_chain = ${JSON.stringify(option.chain)}::jsonb, seal_serial_number = ${option.serialNumber},
        seal_subject_name = ${option.subjectName}, seal_valid_from = ${option.validFrom}, seal_valid_to = ${option.validTo}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
      WHERE company_id = ${actor.companyId}`);
    await this.auditService.record({ ...this.audit(actor, "office_signing_settings"), action: "office.signing_settings.seal", afterData: { identityCode, serialNumber } });
    return this.settings(actor);
  }

  // ---------- Tài khoản ký số của tôi (API_242; QUYTAC_NGHIEPVU_455) ----------

  async myIdentity(actor: Actor): Promise<MySigningIdentity> {
    const settings = await this.settingsRow(this.database, actor.companyId);
    const row = (
      await this.database.execute<{ identity_code: string; subject_name: string; serial_number: string; valid_from: string; valid_to: string; subject_identities: string[] }>(sql`
        SELECT identity_code, subject_name, serial_number, valid_from, valid_to, subject_identities FROM office.signing_identities
        WHERE company_id = ${actor.companyId} AND user_id = ${actor.userId} AND status = 'active'`)
    ).rows[0];
    const now = this.clock.now();
    return {
      configured: settings !== null,
      provider: settings?.provider ?? null,
      identity: row
        ? {
            identityCode: row.identity_code,
            subjectName: row.subject_name,
            serialNumber: row.serial_number,
            validFrom: iso(row.valid_from)!,
            validTo: iso(row.valid_to)!,
            identities: row.subject_identities,
            usable: new Date(row.valid_from) <= now && now <= new Date(row.valid_to),
          }
        : null,
    };
  }

  async myCertificates(actor: Actor, identityCode: string): Promise<SigningCertificateOption[]> {
    return (await this.certificates(actor.companyId, identityCode)).map(({ chain: _chain, ...option }) => option);
  }

  async selectMyCertificate(actor: Actor, identityCode: string, serialNumber: string): Promise<MySigningIdentity> {
    const settings = await this.settingsRow(this.database, actor.companyId);
    const option = (await this.certificates(actor.companyId, identityCode)).find((item) => item.serialNumber === serialNumber);
    if (!option || !settings) throw this.businessRule("signingCertificateNotFound");
    if (!option.usable) throw this.businessRule("signingCertificateNotUsable");
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE office.signing_identities SET status = 'replaced' WHERE company_id = ${actor.companyId} AND user_id = ${actor.userId} AND status = 'active'`);
      await transaction.execute(sql`
        INSERT INTO office.signing_identities (company_id, user_id, provider, identity_code, certificate_chain, serial_number, subject_name, subject_identities, valid_from, valid_to)
        VALUES (${actor.companyId}, ${actor.userId}, ${settings.provider}, ${identityCode}, ${JSON.stringify(option.chain)}::jsonb, ${option.serialNumber}, ${option.subjectName},
          ${sql`ARRAY[${sql.join(option.identities.length ? option.identities.map((item) => sql`${item}`) : [sql`NULL`], sql`, `)}]::text[]`}, ${option.validFrom}, ${option.validTo})`);
      await this.auditService.record({ ...this.audit(actor, "office_signing_identity"), action: "office.signing_identity.select", afterData: { identityCode, serialNumber } }, transaction);
    });
    return this.myIdentity(actor);
  }

  // ---------- Chứng thư gốc tin cậy, kiểm tra chữ ký (API_241, API_245; QUYTAC_NGHIEPVU_461) ----------

  private async trustedRootsPem(companyId: string): Promise<string[]> {
    const root = await groupRootOf(this.database, companyId);
    const rows = await this.database.execute<{ certificate_pem: string }>(sql`SELECT certificate_pem FROM office.trusted_roots WHERE group_company_id = ${root} AND status = 'active'`);
    return rows.rows.map((row) => row.certificate_pem);
  }

  async trustedRoots(actor: Actor): Promise<TrustedRootItem[]> {
    const root = await groupRootOf(this.database, actor.companyId);
    const rows = await this.database.execute<{ id: string; subject_name: string; fingerprint: string; valid_from: string; valid_to: string; status: "active" | "inactive"; created_at: string }>(sql`
      SELECT id, subject_name, fingerprint, valid_from, valid_to, status, created_at FROM office.trusted_roots WHERE group_company_id = ${root} ORDER BY created_at`);
    return rows.rows.map((row) => ({
      id: row.id,
      subjectName: row.subject_name,
      fingerprint: row.fingerprint,
      validFrom: iso(row.valid_from)!,
      validTo: iso(row.valid_to)!,
      status: row.status,
      createdAt: iso(row.created_at)!,
    }));
  }

  private async requireGroupManager(actor: Actor): Promise<string> {
    const root = await groupRootOf(this.database, actor.companyId);
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: root });
    if (!granted.has("office.signing.manage")) throw new ApiError("FORBIDDEN", "forbidden");
    return root;
  }

  async addTrustedRoot(actor: Actor, file: Upload): Promise<TrustedRootItem[]> {
    const root = await this.requireGroupManager(actor);
    if (!file || file.size > 64 * 1024) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "signingTrustedRootInvalid" } });
    let certificate: forge.pki.Certificate;
    try {
      const text = file.buffer.toString("latin1");
      certificate = text.includes("-----BEGIN CERTIFICATE-----")
        ? forge.pki.certificateFromPem(text)
        : forge.pki.certificateFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(file.buffer.toString("binary"))));
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "signingTrustedRootInvalid" } });
    }
    // Chỉ nhận chứng thư tự ký (chứng thư gốc); chứng thư của bộ giả lập không thêm được ở môi trường chính thức.
    if (!certificate.isIssuer(certificate)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "signingTrustedRootInvalid" } });
    const pem = forge.pki.certificateToPem(certificate);
    const summary = summarizeCertificate(certificate);
    if (process.env.NODE_ENV === "production" && summary.commonName === "VComm CA giả lập")
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "signingTrustedRootInvalid" } });
    const fingerprint = sha256Hex(Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes(), "binary"));
    await this.database.execute(sql`
      INSERT INTO office.trusted_roots (group_company_id, certificate_pem, fingerprint, subject_name, valid_from, valid_to, created_by)
      VALUES (${root}, ${pem}, ${fingerprint}, ${summary.commonName ?? fingerprint.slice(0, 16)}, ${summary.validFrom.toISOString()}, ${summary.validTo.toISOString()}, ${actor.userId})
      ON CONFLICT (group_company_id, fingerprint) DO UPDATE SET status = 'active'`);
    await this.auditService.record({ ...this.audit(actor, "office_trusted_root"), action: "office.trusted_root.add", afterData: { fingerprint } });
    return this.trustedRoots(actor);
  }

  async setTrustedRootStatus(actor: Actor, id: string, status: "active" | "inactive"): Promise<TrustedRootItem[]> {
    const root = await this.requireGroupManager(actor);
    const updated = await this.database.execute(sql`UPDATE office.trusted_roots SET status = ${status} WHERE id = ${id} AND group_company_id = ${root} RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    await this.auditService.record({ ...this.audit(actor, "office_trusted_root"), action: "office.trusted_root.status", entityId: id, afterData: { status } });
    return this.trustedRoots(actor);
  }

  private checkPdf(file: Upload): Buffer {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > maximumPdfBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "officeFileTooLarge" } });
    if (file.buffer.subarray(0, 4).toString("latin1") !== "%PDF") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "signingPdfInvalid" } });
    return file.buffer;
  }

  private fileName(file: { originalname: string }): string {
    const decoded = Buffer.from(file.originalname, "latin1").toString("utf8");
    const cleaned = decoded
      .replace(/[\\/]/g, "_")
      .replace(/\p{Cc}/gu, "")
      .trim()
      .slice(0, 200);
    return cleaned || "tai-lieu.pdf";
  }

  async verify(actor: Actor, file: Upload): Promise<SignatureVerificationResponse> {
    const pdf = this.checkPdf(file);
    return { fileName: this.fileName(file!), signatures: await this.checkSignatures(actor.companyId, pdf), revocationChecked: false };
  }

  // Kiểm tra một tệp PDF theo gốc tin cậy của tập đoàn (dùng khi lưu tệp hợp đồng đã ký).
  async checkSignatures(companyId: string, pdf: Buffer): Promise<SignatureVerificationResponse["signatures"]> {
    if (pdf.subarray(0, 4).toString("latin1") !== "%PDF") return [];
    const roots = await this.trustedRootsPem(companyId);
    return verifyPdfSignatures(pdf, roots, this.clock.now()).map((check) => ({
      index: check.index,
      signerName: check.signer?.commonName ?? null,
      signerIdentities: check.signer?.identities ?? [],
      issuerName: check.issuerName,
      signingTime: check.signingTime?.toISOString() ?? null,
      integrity: check.integrity,
      validAtSigningTime: check.validAtSigningTime,
      trusted: check.trusted,
      coversWholeFile: check.coversWholeFile,
      conclusion: check.conclusion,
    }));
  }

  // Hủy phiên ký của chứng từ nguồn khi chứng từ bị hủy (không kiểm người lập phiên).
  async cancelForSource(executor: Executor, requestId: string, actorUserId: string, reason: string): Promise<void> {
    const row = await this.lockRequest(executor, requestId, null);
    if (row.status !== "draft" && row.status !== "signing") return;
    await this.end(executor, row, "cancelled", reason);
    await this.event(executor, requestId, actorUserId, "cancelled", { reason });
  }

  // ---------- Phiên ký (API_243; QUYTAC_NGHIEPVU_458, 459) ----------

  private async storePdf(executor: Executor, companyId: string, requestId: string, fileName: string, content: Buffer, userId: string): Promise<string> {
    const fileId = randomUUID();
    const storageKey = `office/${companyId}/signing/${requestId}/${fileId}`;
    await this.storage.put(storageKey, content, "application/pdf");
    await executor.execute(sql`
      INSERT INTO office.files (id, company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by, sha256)
      VALUES (${fileId}, ${companyId}, 'signing_request', ${requestId}, ${fileName}, 'application/pdf', ${content.length}, ${storageKey}, ${userId}, ${sha256Hex(content)})`);
    return fileId;
  }

  private async readFile(fileId: string): Promise<{ fileName: string; content: Buffer }> {
    const row = (await this.database.execute<{ file_name: string; storage_key: string }>(sql`SELECT file_name, storage_key FROM office.files WHERE id = ${fileId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return { fileName: row.file_name, content: await this.storage.get(row.storage_key) };
  }

  private async event(executor: Executor, requestId: string, actorUserId: string | null, kind: string, detail: Record<string, unknown> = {}, actorLabel: string | null = null): Promise<void> {
    await executor.execute(sql`
      INSERT INTO office.signing_events (request_id, actor_user_id, actor_label, kind, detail) VALUES (${requestId}, ${actorUserId}, ${actorLabel}, ${kind}, ${JSON.stringify(detail)}::jsonb)`);
  }

  private dueRange(dueOn: string): void {
    const today = this.permissionService.today();
    const latest = new Date(`${today}T00:00:00Z`);
    latest.setUTCDate(latest.getUTCDate() + signingRequestMaximumDays);
    if (dueOn < today || dueOn > latest.toISOString().slice(0, 10)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { dueOn: "signingDueInvalid" } });
  }

  // Kiểm tra người ký: người dùng thuộc tập đoàn, không trùng người; đối tác lấy từ danh sách đối tác thì đối chiếu (QUYTAC_NGHIEPVU_458).
  private async checkSigners(executor: Executor, companyId: string, input: SaveSigningRequestInput): Promise<void> {
    const userIds = input.signers.flatMap((signer) => (signer.kind === "user" ? [signer.userId] : []));
    if (new Set(userIds).size !== userIds.length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signers: "signingSignerDuplicate" } });
    const active = await activeGroupUsers(executor, companyId, userIds);
    if (userIds.some((id) => !active.has(id))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signers: "officeParticipantOutsideGroup" } });
    if (input.signers.filter((signer) => signer.kind === "company").length > 1) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signers: "signingSignerDuplicate" } });
    for (const signer of input.signers) {
      if (signer.kind !== "partner" || !signer.partnerId) continue;
      const exists = await executor.execute(sql`SELECT 1 FROM crm.partners WHERE id = ${signer.partnerId} AND status = 'active'`);
      if (exists.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signers: "notFound" } });
    }
  }

  private async insertSigners(executor: Executor, requestId: string, input: SaveSigningRequestInput): Promise<void> {
    await executor.execute(sql`DELETE FROM office.signing_signers WHERE request_id = ${requestId}`);
    let position = 0;
    for (const signer of input.signers) {
      position += 1;
      const partner = signer.kind === "partner" ? signer : null;
      await executor.execute(sql`
        INSERT INTO office.signing_signers (request_id, position, sign_order, kind, user_id, partner_id, partner_kind, partner_name, partner_email, partner_identity, partner_identity_code, page, corner)
        VALUES (${requestId}, ${position}, ${signer.signOrder}, ${signer.kind}, ${signer.kind === "user" ? signer.userId : null}, ${partner?.partnerId ?? null}, ${partner?.partnerKind ?? null},
          ${partner?.name ?? null}, ${partner?.email.toLowerCase() ?? null}, ${partner ? identityDigits(partner.identity) : null}, ${partner?.identityCode ?? null}, ${signer.page}, ${signer.corner})`);
    }
  }

  async create(actor: Actor, input: SaveSigningRequestInput, file: Upload, source: { type: SigningSource; id: string } | null = null): Promise<SigningRequestResponse> {
    if (!source) await this.require(actor, "office.signing.use");
    const pdf = this.checkPdf(file);
    this.dueRange(input.dueOn);
    const requestId = randomUUID();
    await this.database.transaction(async (transaction) => {
      await this.checkSigners(transaction, actor.companyId, input);
      // Công ty chưa cấu hình dãy số phiên ký: tạo mặc định trong cùng giao dịch.
      await transaction.execute(sql`
        INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
        SELECT ${actor.companyId}, 'office.signing_request', ${periodKey("year", this.permissionService.today())}, 'KS', 'year', 5, 1
        WHERE NOT EXISTS (SELECT 1 FROM core.number_sequences WHERE company_id = ${actor.companyId} AND document_type_code = 'office.signing_request')
        ON CONFLICT DO NOTHING`);
      const requestNo = await this.sequences.next(actor.companyId, "office.signing_request", transaction);
      await transaction.execute(sql`
        INSERT INTO office.signing_requests (id, company_id, request_no, title, note, due_on, created_by, source_type, source_id)
        VALUES (${requestId}, ${actor.companyId}, ${requestNo}, ${input.title}, ${input.note ?? null}, ${input.dueOn}, ${actor.userId}, ${source?.type ?? "document"}, ${source?.id ?? null})`);
      const fileId = await this.storePdf(transaction, actor.companyId, requestId, this.fileName(file!), pdf, actor.userId);
      await transaction.execute(sql`UPDATE office.signing_requests SET original_file_id = ${fileId}, current_file_id = ${fileId} WHERE id = ${requestId}`);
      await this.insertSigners(transaction, requestId, input);
      await this.event(transaction, requestId, actor.userId, "created");
    });
    return this.get(actor, requestId);
  }

  async update(actor: Actor, id: string, input: SaveSigningRequestInput, file: Upload): Promise<SigningRequestResponse> {
    const pdf = file ? this.checkPdf(file) : null;
    this.dueRange(input.dueOn);
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (row.created_by !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "draft") throw this.businessRule("signingStatusInvalid");
      if (input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.checkSigners(transaction, actor.companyId, input);
      await transaction.execute(sql`
        UPDATE office.signing_requests SET title = ${input.title}, note = ${input.note ?? null}, due_on = ${input.dueOn}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      if (pdf) {
        const fileId = await this.storePdf(transaction, actor.companyId, id, this.fileName(file!), pdf, actor.userId);
        await transaction.execute(sql`UPDATE office.signing_requests SET original_file_id = ${fileId}, current_file_id = ${fileId} WHERE id = ${id}`);
      }
      await this.insertSigners(transaction, id, input);
      await this.event(transaction, id, actor.userId, "updated");
    });
    return this.get(actor, id);
  }

  private async lockRequest(executor: Executor, id: string, companyId: string | null): Promise<RequestRow> {
    const row = (
      await executor.execute<RequestRow>(sql`
        SELECT r.*, r.due_on::text AS due_on, c.short_name AS company_name FROM office.signing_requests r JOIN core.companies c ON c.id = r.company_id
        WHERE r.id = ${id} ${companyId ? sql`AND r.company_id = ${companyId}` : sql``} FOR UPDATE OF r`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async signers(executor: Executor, requestId: string): Promise<SignerRow[]> {
    return (await executor.execute<SignerRow>(sql`SELECT * FROM office.signing_signers WHERE request_id = ${requestId} ORDER BY position`)).rows;
  }

  // Người xem được phiên: người lập, người ký là người dùng, người đóng chữ ký công ty khi phiên có bước chữ ký công ty.
  private async canView(actor: Actor, row: RequestRow, signers: SignerRow[]): Promise<boolean> {
    if (row.created_by === actor.userId) return true;
    if (signers.some((signer) => signer.user_id === actor.userId)) return true;
    if (signers.some((signer) => signer.kind === "company")) return (await this.granted(actor, row.company_id)).has("office.signing.company_seal");
    return false;
  }

  // Người ký đến lượt mà người xem ký được.
  private async mySigner(actor: Actor, row: RequestRow, signers: SignerRow[]): Promise<SignerRow | null> {
    if (row.status !== "signing") return null;
    const mine = signers.find((signer) => signer.status === "current" && signer.kind === "user" && signer.user_id === actor.userId);
    if (mine) return mine;
    const company = signers.find((signer) => signer.status === "current" && signer.kind === "company");
    if (company && (await this.granted(actor, row.company_id)).has("office.signing.company_seal")) return company;
    return null;
  }

  async get(actor: Actor, id: string): Promise<SigningRequestResponse> {
    const row = (
      await this.database.execute<RequestRow>(sql`
        SELECT r.*, r.due_on::text AS due_on, c.short_name AS company_name FROM office.signing_requests r JOIN core.companies c ON c.id = r.company_id
        WHERE r.id = ${id} AND r.company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const signers = await this.signers(this.database, id);
    if (!(await this.canView(actor, row, signers))) throw new ApiError("NOT_FOUND", "notFound");
    const attempts = await this.database.execute<{ signer_id: string; status: AttemptRow["status"]; message: string | null; started_at: string }>(sql`
      SELECT DISTINCT ON (signer_id) signer_id, status, message, started_at FROM office.signing_attempts WHERE request_id = ${id} ORDER BY signer_id, started_at DESC`);
    const lastAttempt = new Map(attempts.rows.map((attempt) => [attempt.signer_id, attempt]));
    const events = await this.database.execute<{ id: string; actor_user_id: string | null; actor_label: string | null; kind: string; detail: Record<string, unknown>; created_at: string }>(sql`
      SELECT id, actor_user_id, actor_label, kind, detail, created_at FROM office.signing_events WHERE request_id = ${id} ORDER BY created_at DESC, id`);
    const people = await peopleById(
      this.database,
      [row.created_by, ...signers.flatMap((signer) => [signer.user_id ?? "", signer.signed_by ?? ""]), ...events.rows.map((event) => event.actor_user_id ?? "")],
      row.company_id,
    );
    const files = await this.database.execute<{ id: string; file_name: string; size_bytes: number; storage_key: string }>(sql`
      SELECT id, file_name, size_bytes, storage_key FROM office.files WHERE id IN (${row.original_file_id ?? randomUUID()}, ${row.current_file_id ?? randomUUID()})`);
    const original = files.rows.find((file) => file.id === row.original_file_id) ?? null;
    const current = files.rows.find((file) => file.id === row.current_file_id) ?? null;
    const signatureCount = signers.filter((signer) => signer.status === "signed").length;
    const mine = await this.mySigner(actor, row, signers);
    const creator = row.created_by === actor.userId;
    const allowed: SigningRequestResponse["allowed"] = [];
    if (creator && row.status === "draft") allowed.push("edit", "send");
    if (mine) allowed.push("sign", "reject");
    if (creator && row.status === "signing") {
      const remindedRecently = row.last_reminded_at && this.clock.now().getTime() - new Date(row.last_reminded_at).getTime() < 24 * 3_600_000;
      if (!remindedRecently) allowed.push("remind");
      if (signers.some((signer) => signer.kind === "partner" && signer.status === "current")) allowed.push("resend");
    }
    if (creator && (row.status === "draft" || row.status === "signing")) allowed.push("cancel");
    if (creator && row.source_type === "document" && ["rejected", "cancelled", "expired"].includes(row.status)) allowed.push("copy");
    const person = (userId: string | null) => (userId ? (people.get(userId) ?? null) : null);
    return {
      ...this.listItem(row, signers, people, false),
      note: row.note,
      companyId: row.company_id,
      companyName: row.company_name,
      originalFile: original ? { fileName: original.file_name, sizeBytes: original.size_bytes } : null,
      currentFile: current ? { fileName: current.file_name, sizeBytes: current.size_bytes, signatureCount } : null,
      signers: signers.map((signer) => {
        const attempt = lastAttempt.get(signer.id);
        return {
          id: signer.id,
          position: signer.position,
          signOrder: signer.sign_order,
          kind: signer.kind,
          user: person(signer.user_id),
          partner:
            signer.kind === "partner"
              ? {
                  name: signer.partner_name!,
                  email: signer.partner_email!,
                  identity: signer.partner_identity!,
                  identityCode: signer.partner_identity_code!,
                  kind: signer.partner_kind!,
                  partnerId: signer.partner_id,
                }
              : null,
          page: signer.page,
          corner: signer.corner,
          status: signer.status,
          signedAt: iso(signer.signed_at),
          signedBy: person(signer.signed_by),
          signerSubject: signer.signer_subject,
          rejectReason: signer.reject_reason,
          linkSentAt: iso(signer.link_sent_at),
          lastAttempt: attempt
            ? {
                status: attempt.status,
                message: attempt.message,
                startedAt: iso(attempt.started_at)!,
                expiresAt: new Date(new Date(attempt.started_at).getTime() + signingAttemptTimeoutMilliseconds).toISOString(),
              }
            : null,
        };
      }),
      events: events.rows.map(
        (event): SigningEventItem => ({ id: event.id, actor: person(event.actor_user_id), actorLabel: event.actor_label, kind: event.kind, detail: event.detail, createdAt: iso(event.created_at)! }),
      ),
      endReason: row.end_reason,
      sentAt: iso(row.sent_at),
      completedAt: iso(row.completed_at),
      createdAt: iso(row.created_at)!,
      copiedFromId: row.copied_from_id,
      version: row.version,
      allowed,
      mySignerId: mine?.id ?? null,
    };
  }

  private listItem(row: RequestRow, signers: SignerRow[], people: Map<string, SigningRequestResponse["createdBy"]>, companySealTurn: boolean): SigningRequestListItem {
    const current = signers
      .filter((signer) => signer.status === "current")
      .map((signer) => (signer.kind === "user" ? (people.get(signer.user_id!)?.fullName ?? "") : signer.kind === "company" ? row.company_name : signer.partner_name!));
    return {
      id: row.id,
      requestNo: row.request_no,
      title: row.title,
      sourceType: row.source_type,
      sourceId: row.source_id,
      status: row.status,
      dueOn: typeof row.due_on === "string" ? row.due_on : new Date(row.due_on).toISOString().slice(0, 10),
      createdBy: people.get(row.created_by) ?? { id: row.created_by, fullName: "", companyId: null, companyName: null, departmentName: null },
      currentSigners: current,
      companySealTurn,
      signedAt: iso(row.completed_at),
    };
  }

  async list(actor: Actor, query: z.infer<typeof signingRequestListQuerySchema>): Promise<{ items: SigningRequestListItem[]; total: number; page: number; pageSize: number }> {
    const pageSize = 20;
    const seal = (await this.granted(actor)).has("office.signing.company_seal");
    const conditions: SQL[] = [sql`r.company_id = ${actor.companyId}`];
    if (query.tab === "to_sign") {
      conditions.push(sql`r.status = 'signing'`);
      conditions.push(sql`EXISTS (SELECT 1 FROM office.signing_signers s WHERE s.request_id = r.id AND s.status = 'current'
        AND ((s.kind = 'user' AND s.user_id = ${actor.userId}) ${seal ? sql`OR s.kind = 'company'` : sql``}))`);
    } else if (query.tab === "sent") {
      conditions.push(sql`r.created_by = ${actor.userId}`);
    } else {
      conditions.push(sql`EXISTS (SELECT 1 FROM office.signing_signers s WHERE s.request_id = r.id AND s.status = 'signed' AND (s.user_id = ${actor.userId} OR s.signed_by = ${actor.userId}))`);
    }
    if (query.status) conditions.push(sql`r.status = ${query.status}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(r.title ILIKE ${pattern} OR r.request_no ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM office.signing_requests r WHERE ${where}`)).rows[0]?.count ?? 0;
    const rows = await this.database.execute<RequestRow>(sql`
      SELECT r.*, r.due_on::text AS due_on, c.short_name AS company_name FROM office.signing_requests r JOIN core.companies c ON c.id = r.company_id
      WHERE ${where} ORDER BY ${query.tab === "to_sign" ? sql`r.due_on, r.created_at` : sql`r.created_at DESC`} LIMIT ${pageSize} OFFSET ${(query.page - 1) * pageSize}`);
    const ids = rows.rows.map((row) => row.id);
    const allSigners = ids.length
      ? (
          await this.database.execute<SignerRow>(
            sql`SELECT * FROM office.signing_signers WHERE request_id IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}) ORDER BY position`,
          )
        ).rows
      : [];
    const people = await peopleById(this.database, [...rows.rows.map((row) => row.created_by), ...allSigners.map((signer) => signer.user_id ?? "")], actor.companyId);
    return {
      items: rows.rows.map((row) => {
        const signers = allSigners.filter((signer) => signer.request_id === row.id);
        const sealTurn = query.tab === "to_sign" && seal && signers.some((signer) => signer.kind === "company" && signer.status === "current");
        return this.listItem(row, signers, people, sealTurn);
      }),
      total,
      page: query.page,
      pageSize,
    };
  }

  async file(actor: Actor, id: string, which: "current" | "original"): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const response = await this.get(actor, id);
    const row = (
      await this.database.execute<{ original_file_id: string | null; current_file_id: string | null }>(sql`SELECT original_file_id, current_file_id FROM office.signing_requests WHERE id = ${id}`)
    ).rows[0];
    const fileId = which === "original" ? row?.original_file_id : row?.current_file_id;
    if (!fileId) throw new ApiError("NOT_FOUND", "notFound");
    const file = await this.readFile(fileId);
    const signedName = which === "current" && response.status === "completed" ? file.fileName.replace(/\.pdf$/i, "") + "-da-ky.pdf" : file.fileName;
    return { fileName: signedName, contentType: "application/pdf", content: file.content };
  }

  // Gửi phiên: kiểm cài đặt, tài khoản ký số của người ký nội bộ, chữ ký công ty (QUYTAC_NGHIEPVU_459).
  async send(actor: Actor, id: string, version: number): Promise<SigningRequestResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (row.created_by !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "draft") throw this.businessRule("signingStatusInvalid");
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.due_on < this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { dueOn: "signingDueInvalid" } });
      const settings = await this.settingsRow(transaction, row.company_id);
      if (!settings) throw this.businessRule("signingNotConfigured");
      const signers = await this.signers(transaction, id);
      if (signers.some((signer) => signer.kind === "company") && !settings.seal_certificate_chain) throw this.businessRule("signingSealMissing");
      const userIds = signers.flatMap((signer) => (signer.kind === "user" ? [signer.user_id!] : []));
      const now = this.clock.now().toISOString();
      const ready = userIds.length
        ? await transaction.execute<{ user_id: string }>(sql`
            SELECT user_id FROM office.signing_identities WHERE company_id = ${row.company_id} AND status = 'active' AND valid_from <= ${now} AND valid_to >= ${now}
              AND user_id IN (${sql.join(
                userIds.map((userId) => sql`${userId}::uuid`),
                sql`, `,
              )})`)
        : { rows: [] };
      const readySet = new Set(ready.rows.map((item) => item.user_id));
      if (userIds.some((userId) => !readySet.has(userId))) throw this.businessRule("signingIdentityMissing");
      await transaction.execute(sql`UPDATE office.signing_requests SET status = 'signing', sent_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, "sent");
      await this.advance(transaction, { ...row, status: "signing" });
    });
    return this.get(actor, id);
  }

  // Mở lượt kế tiếp: người ký có thứ tự nhỏ nhất chưa ký; hết người ký thì phiên đã ký xong.
  private async advance(executor: Executor, row: RequestRow): Promise<void> {
    const signers = await this.signers(executor, row.id);
    const pending = signers.filter((signer) => signer.status !== "signed");
    if (pending.length === 0) {
      await executor.execute(sql`UPDATE office.signing_requests SET status = 'completed', completed_at = now(), updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
      await this.event(executor, row.id, null, "completed");
      const fileRow = (await executor.execute<{ current_file_id: string | null }>(sql`SELECT current_file_id FROM office.signing_requests WHERE id = ${row.id}`)).rows[0];
      for (const hook of this.outcomeHooks) {
        await hook(executor, {
          requestId: row.id,
          companyId: row.company_id,
          sourceType: row.source_type,
          sourceId: row.source_id,
          status: "completed",
          currentFileId: fileRow?.current_file_id ?? null,
          reason: null,
        });
      }
      await notify(executor, [{ userId: row.created_by, companyId: row.company_id, kind: "office_signing", title: `Đã ký xong: ${row.title}`, link: `/office/signing/${row.id}` }]);
      await executor.execute(sql`
        INSERT INTO core.outbox_events (event_type, aggregate_type, aggregate_id, company_id, payload)
        VALUES ('office.signing.completed', 'office_signing_request', ${row.id}, ${row.company_id}, ${JSON.stringify({ requestId: row.id, sourceType: row.source_type })}::jsonb)`);
      return;
    }
    const order = Math.min(...pending.map((signer) => signer.sign_order));
    const opening = pending.filter((signer) => signer.sign_order === order && signer.status === "waiting");
    for (const signer of opening) {
      await executor.execute(sql`UPDATE office.signing_signers SET status = 'current' WHERE id = ${signer.id}`);
      await this.notifyTurn(executor, row, signer);
    }
  }

  private async notifyTurn(executor: Executor, row: RequestRow, signer: SignerRow): Promise<void> {
    const title = `Mời ký số: ${row.title}`;
    const link = `/office/signing/${row.id}`;
    if (signer.kind === "user") await notify(executor, [{ userId: signer.user_id!, companyId: row.company_id, kind: "office_signing", title, link }]);
    if (signer.kind === "company") {
      const holders = await this.permissionHolders(executor, row.company_id, "office.signing.company_seal");
      await notify(
        executor,
        holders.map((userId) => ({ userId, companyId: row.company_id, kind: "office_signing", title: `Đóng chữ ký số công ty: ${row.title}`, link })),
      );
    }
    if (signer.kind === "partner") await this.sendPartnerLink(executor, row, signer);
  }

  // Đường dẫn ký cho đối tác: mã ngẫu nhiên 32 byte, chỉ lưu mã băm; gửi lại thì mã cũ hết dùng (QUYTAC_NGHIEPVU_460).
  private async sendPartnerLink(executor: Executor, row: RequestRow, signer: SignerRow): Promise<void> {
    const token = randomBytes(32).toString("base64url");
    await executor.execute(sql`UPDATE office.signing_signers SET link_token_hash = ${tokenHash(token)}, link_sent_at = now() WHERE id = ${signer.id}`);
    await this.event(executor, row.id, null, "partner_link_sent", { signerId: signer.id, email: signer.partner_email });
    await this.outbound.send({
      channel: "email",
      to: signer.partner_email!,
      subject: `${row.company_name} mời ký số: ${row.title}`,
      body: `Kính gửi ${signer.partner_name}, ${row.company_name} mời quý vị ký số tài liệu "${row.title}" trước ngày ${row.due_on}. Mở đường dẫn: ${webOrigin()}/office/sign/${token}`,
    });
  }

  async remind(actor: Actor, id: string, version: number): Promise<SigningRequestResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (row.created_by !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "signing") throw this.businessRule("signingStatusInvalid");
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.last_reminded_at && this.clock.now().getTime() - new Date(row.last_reminded_at).getTime() < 24 * 3_600_000) throw this.businessRule("signingRemindTooSoon");
      for (const signer of (await this.signers(transaction, id)).filter((item) => item.status === "current")) await this.notifyTurn(transaction, row, signer);
      await transaction.execute(sql`UPDATE office.signing_requests SET last_reminded_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, "reminded");
    });
    return this.get(actor, id);
  }

  async resend(actor: Actor, id: string, signerId: string, version: number): Promise<SigningRequestResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (row.created_by !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "signing") throw this.businessRule("signingStatusInvalid");
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const signer = (await this.signers(transaction, id)).find((item) => item.id === signerId && item.kind === "partner" && item.status === "current");
      if (!signer) throw this.businessRule("signingStatusInvalid");
      await this.sendPartnerLink(transaction, row, signer);
      await transaction.execute(sql`UPDATE office.signing_requests SET version = version + 1 WHERE id = ${id}`);
    });
    return this.get(actor, id);
  }

  async cancel(actor: Actor, id: string, reason: string, version: number): Promise<SigningRequestResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (row.created_by !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "draft" && row.status !== "signing") throw this.businessRule("signingStatusInvalid");
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.end(transaction, row, "cancelled", reason);
      await this.event(transaction, id, actor.userId, "cancelled", { reason });
    });
    return this.get(actor, id);
  }

  // Kết thúc phiên chưa xong: dừng lần ký đang chờ, đường dẫn đối tác hết dùng.
  private async end(executor: Executor, row: RequestRow, status: "cancelled" | "rejected" | "expired", reason: string | null): Promise<void> {
    await executor.execute(sql`UPDATE office.signing_requests SET status = ${status}, end_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
    await executor.execute(sql`UPDATE office.signing_attempts SET status = 'failed', message = 'Phiên ký đã kết thúc.', finished_at = now() WHERE request_id = ${row.id} AND status = 'pending'`);
    await executor.execute(sql`UPDATE office.signing_signers SET link_token_hash = NULL WHERE request_id = ${row.id} AND status NOT IN ('signed', 'rejected')`);
    for (const hook of this.outcomeHooks) {
      await hook(executor, { requestId: row.id, companyId: row.company_id, sourceType: row.source_type, sourceId: row.source_id, status, currentFileId: row.current_file_id, reason });
    }
  }

  async reject(actor: Actor, id: string, reason: string, version: number): Promise<SigningRequestResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const signers = await this.signers(transaction, id);
      const mine = await this.mySigner(actor, row, signers);
      if (!mine) throw this.businessRule("signingStatusInvalid");
      await transaction.execute(sql`UPDATE office.signing_signers SET status = 'rejected', reject_reason = ${reason}, signed_by = ${actor.userId} WHERE id = ${mine.id}`);
      await this.end(transaction, row, "rejected", reason);
      await this.event(transaction, id, actor.userId, "rejected", { signerId: mine.id, reason });
      await notify(transaction, [{ userId: row.created_by, companyId: row.company_id, kind: "office_signing", title: `Bị từ chối ký: ${row.title}`, link: `/office/signing/${id}` }]);
    });
    return this.get(actor, id);
  }

  async copy(actor: Actor, id: string): Promise<SigningRequestResponse> {
    const source = await this.get(actor, id);
    if (!source.allowed.includes("copy")) throw this.businessRule("signingStatusInvalid");
    // Phiên của hợp đồng, phụ lục lập lại từ hợp đồng, không sao chép.
    if (source.sourceType !== "document") throw this.businessRule("signingStatusInvalid");
    const sourceRow = (await this.database.execute<{ original_file_id: string }>(sql`SELECT original_file_id FROM office.signing_requests WHERE id = ${id}`)).rows[0]!;
    const original = await this.readFile(sourceRow.original_file_id);
    const signers = await this.signers(this.database, id);
    const today = this.permissionService.today();
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 14);
    const input: SaveSigningRequestInput = {
      title: source.title,
      note: source.note,
      dueOn: due.toISOString().slice(0, 10),
      signers: signers.map((signer) => {
        const placement = { signOrder: signer.sign_order, page: signer.page, corner: signer.corner };
        if (signer.kind === "user") return { kind: "user" as const, userId: signer.user_id!, ...placement };
        if (signer.kind === "company") return { kind: "company" as const, ...placement };
        return {
          kind: "partner" as const,
          partnerId: signer.partner_id,
          partnerKind: signer.partner_kind!,
          name: signer.partner_name!,
          email: signer.partner_email!,
          identity: signer.partner_identity!,
          identityCode: signer.partner_identity_code!,
          ...placement,
        };
      }),
    };
    const created = await this.create(actor, input, { buffer: original.content, size: original.content.length, originalname: Buffer.from(original.fileName, "utf8").toString("latin1") });
    await this.database.execute(sql`UPDATE office.signing_requests SET copied_from_id = ${id} WHERE id = ${created.id}`);
    return this.get(actor, created.id);
  }

  // ---------- Ký (QUYTAC_NGHIEPVU_457) ----------

  // Bắt đầu một lần ký: chuẩn bị bản PDF có ô chữ ký, gửi mã băm cho nhà cung cấp; kết quả lấy ở tác vụ nền mỗi 5 giây.
  private async startAttempt(
    executor: Executor,
    row: RequestRow,
    signer: SignerRow,
    identity: { identityCode: string; chain: string[] },
    initiatedBy: string | null,
    ip: string | null,
  ): Promise<void> {
    const pending = await executor.execute(sql`SELECT 1 FROM office.signing_attempts WHERE request_id = ${row.id} AND status = 'pending'`);
    if (pending.rows.length > 0) throw this.businessRule("signingAttemptPending");
    const { provider, config } = await this.requireSettings(executor, row.company_id);
    const signers = await this.signers(executor, row.id);
    // Thứ tự ô trong cùng trang, cùng góc theo vị trí người ký.
    const slot = signers.filter((item) => item.position < signer.position && item.page === signer.page && item.corner === signer.corner).length;
    const certificate = forge.pki.certificateFromPem(identity.chain[0]!);
    const subject = summarizeCertificate(certificate).commonName ?? "";
    const signingTime = this.clock.now();
    const lines = [`Ký bởi: ${subject}`];
    if (signer.kind === "company") lines.push(`Ký thay mặt: ${row.company_name}`);
    lines.push(`Thời gian ký: ${vietnamTime.format(signingTime).replace(",", "")}`);
    const base = await this.readFile(row.current_file_id!);
    let prepared;
    try {
      prepared = await prepareSignature({
        pdf: base.content,
        placement: { page: signer.page === "first" || signer.page === "last" ? signer.page : Number(signer.page), corner: signer.corner, slot },
        appearanceLines: lines,
        signerName: subject,
        reason: signingReason,
        signingTime,
        certificateChainPem: identity.chain,
      });
    } catch (error) {
      if (error instanceof PdfSigningError) throw this.businessRule(error.reason === "encrypted" ? "signingPdfEncrypted" : "signingPdfInvalid");
      throw error;
    }
    const attemptId = randomUUID();
    const preparedKey = `office/${row.company_id}/signing/${row.id}/chuan-bi-${attemptId}`;
    await this.storage.put(preparedKey, prepared.preparedPdf, "application/pdf");
    const serial = certificate.serialNumber;
    const { transactionId } = await this.callProvider(() =>
      provider.requestSignature(config, { identityCode: identity.identityCode, serialNumber: serial, digest: prepared.digest, documentTitle: row.title }),
    );
    await executor.execute(sql`
      INSERT INTO office.signing_attempts (id, request_id, signer_id, base_file_id, prepared_storage_key, certificate_chain, identity_code, transaction_id, initiated_by, initiated_ip)
      VALUES (${attemptId}, ${row.id}, ${signer.id}, ${row.current_file_id}, ${preparedKey}, ${JSON.stringify(identity.chain)}::jsonb, ${identity.identityCode}, ${transactionId}, ${initiatedBy}, ${ip})`);
    await this.event(executor, row.id, initiatedBy, "sign_requested", { signerId: signer.id }, initiatedBy ? null : signer.partner_name);
  }

  async sign(actor: Actor, id: string, signerId: string, version: number): Promise<SigningRequestResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, id, actor.companyId);
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const signers = await this.signers(transaction, id);
      const mine = await this.mySigner(actor, row, signers);
      if (!mine || mine.id !== signerId) throw this.businessRule("signingStatusInvalid");
      let identity: { identityCode: string; chain: string[] };
      if (mine.kind === "company") {
        const settings = await this.settingsRow(transaction, row.company_id);
        if (!settings?.seal_certificate_chain || !settings.seal_identity_code) throw this.businessRule("signingSealMissing");
        const now = this.clock.now();
        if (!(new Date(settings.seal_valid_from!) <= now && now <= new Date(settings.seal_valid_to!))) throw this.businessRule("signingCertificateNotUsable");
        identity = { identityCode: settings.seal_identity_code, chain: settings.seal_certificate_chain };
      } else {
        const now = this.clock.now().toISOString();
        const found = (
          await transaction.execute<{ identity_code: string; certificate_chain: string[]; valid_from: string; valid_to: string }>(sql`
            SELECT identity_code, certificate_chain, valid_from, valid_to FROM office.signing_identities WHERE company_id = ${row.company_id} AND user_id = ${actor.userId} AND status = 'active'`)
        ).rows[0];
        if (!found) throw this.businessRule("signingIdentityMissing");
        if (!(new Date(found.valid_from) <= new Date(now) && new Date(now) <= new Date(found.valid_to))) throw this.businessRule("signingCertificateNotUsable");
        identity = { identityCode: found.identity_code, chain: found.certificate_chain };
      }
      await this.startAttempt(transaction, row, mine, identity, actor.userId, actor.client.ip);
      await transaction.execute(sql`UPDATE office.signing_requests SET version = version + 1, updated_at = now() WHERE id = ${id}`);
    });
    return this.get(actor, id);
  }

  // Tác vụ nền mỗi 5 giây: lấy kết quả các lần ký đang chờ.
  async pollAttempts(): Promise<number> {
    const attempts = await this.database.execute<AttemptRow>(sql`
      SELECT a.*, r.company_id FROM office.signing_attempts a JOIN office.signing_requests r ON r.id = a.request_id WHERE a.status = 'pending' ORDER BY a.started_at LIMIT 50`);
    let finished = 0;
    for (const attempt of attempts.rows) {
      try {
        if (await this.pollAttempt(attempt)) finished += 1;
      } catch (error) {
        this.logger.error(`Lần ký ${attempt.id} lỗi: ${(error as Error).message}`);
      }
    }
    return finished;
  }

  private async finishAttempt(executor: Executor, attempt: AttemptRow, status: AttemptRow["status"], message: string | null, label: string | null): Promise<void> {
    await executor.execute(sql`UPDATE office.signing_attempts SET status = ${status}, message = ${message}, finished_at = now() WHERE id = ${attempt.id} AND status = 'pending'`);
    await this.event(executor, attempt.request_id, null, `sign_${status}`, { signerId: attempt.signer_id, message }, label);
    await this.storage.remove(attempt.prepared_storage_key).catch(() => undefined);
  }

  private async pollAttempt(attempt: AttemptRow): Promise<boolean> {
    const settings = await this.settingsRow(this.database, attempt.company_id);
    if (!settings) return false;
    if (this.clock.now().getTime() - new Date(attempt.started_at).getTime() > signingAttemptTimeoutMilliseconds) {
      await this.finishAttempt(this.database, attempt, "timeout", "Quá 5 phút chưa xác nhận trên ứng dụng.", null);
      return true;
    }
    const provider = this.providers[settings.provider];
    const result = await provider.getSignatureResult(this.providerConfig(attempt.company_id, settings), attempt.transaction_id ?? "");
    if (result.status === "pending") return false;
    if (result.status === "rejected" || result.status === "failed") {
      await this.finishAttempt(this.database, attempt, result.status, result.message, null);
      return true;
    }
    const prepared = await this.storage.get(attempt.prepared_storage_key);
    const signed = await completeSignature(prepared, attempt.certificate_chain, result.signatureValue);
    await this.database.transaction(async (transaction) => {
      const row = await this.lockRequest(transaction, attempt.request_id, null);
      const fresh = (await transaction.execute<{ status: string }>(sql`SELECT status FROM office.signing_attempts WHERE id = ${attempt.id} FOR UPDATE`)).rows[0];
      if (fresh?.status !== "pending") return;
      if (row.status !== "signing" || row.current_file_id !== attempt.base_file_id) {
        await this.finishAttempt(transaction, attempt, "failed", "Tài liệu đã thay đổi, cần ký lại.", null);
        return;
      }
      const signer = (await this.signers(transaction, row.id)).find((item) => item.id === attempt.signer_id);
      if (!signer || signer.status !== "current") {
        await this.finishAttempt(transaction, attempt, "failed", "Không còn đến lượt ký.", null);
        return;
      }
      // Tệp sau khi chèn phải giữ nguyên mọi chữ ký trước và chữ ký mới phải toàn vẹn.
      const checks = verifyPdfSignatures(signed, [], this.clock.now());
      const last = checks[checks.length - 1];
      if (!last || checks.some((check) => !check.integrity)) {
        await this.finishAttempt(transaction, attempt, "failed", "Chữ ký nhận về không hợp lệ.", null);
        return;
      }
      // Đối tác: chủ thể chứng thư phải trùng mã số thuế hoặc số định danh đã khai (QUYTAC_NGHIEPVU_460).
      if (signer.kind === "partner" && !(last.signer?.identities ?? []).some((identity) => identityDigits(identity) === signer.partner_identity)) {
        await this.finishAttempt(transaction, attempt, "failed", "Chứng thư không trùng thông tin bên ký đã khai.", signer.partner_name);
        return;
      }
      const base = (await transaction.execute<{ file_name: string }>(sql`SELECT file_name FROM office.files WHERE id = ${row.current_file_id}`)).rows[0]!;
      const fileId = await this.storePdf(transaction, row.company_id, row.id, base.file_name, signed, row.created_by);
      await transaction.execute(sql`UPDATE office.signing_requests SET current_file_id = ${fileId}, updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
      await transaction.execute(sql`
        UPDATE office.signing_signers SET status = 'signed', signed_at = now(), signed_by = ${signer.kind === "partner" ? null : await this.attemptInitiator(transaction, attempt.id)},
          signer_subject = ${last.signer?.commonName ?? null} WHERE id = ${signer.id}`);
      await transaction.execute(sql`UPDATE office.signing_attempts SET status = 'signed', finished_at = now() WHERE id = ${attempt.id}`);
      await this.event(transaction, row.id, null, "signed", { signerId: signer.id, subject: last.signer?.commonName ?? null }, signer.kind === "partner" ? signer.partner_name : null);
      await this.advance(transaction, row);
    });
    await this.storage.remove(attempt.prepared_storage_key).catch(() => undefined);
    return true;
  }

  private async attemptInitiator(executor: Executor, attemptId: string): Promise<string | null> {
    return (await executor.execute<{ initiated_by: string | null }>(sql`SELECT initiated_by FROM office.signing_attempts WHERE id = ${attemptId}`)).rows[0]?.initiated_by ?? null;
  }

  // Tác vụ nền mỗi giờ: phiên quá hạn ký chuyển hết hạn; nhắc người đang đến lượt khi còn 2 ngày (QUYTAC_NGHIEPVU_459, 467).
  async expireAndRemind(): Promise<{ expired: number; reminded: number }> {
    const today = this.permissionService.today();
    const expiredRows = await this.database.execute<{ id: string }>(sql`SELECT id FROM office.signing_requests WHERE status = 'signing' AND due_on < ${today}::date`);
    for (const { id } of expiredRows.rows) {
      await this.database.transaction(async (transaction) => {
        const row = await this.lockRequest(transaction, id, null);
        if (row.status !== "signing") return;
        await this.end(transaction, row, "expired", null);
        await this.event(transaction, id, null, "expired");
        await notify(transaction, [{ userId: row.created_by, companyId: row.company_id, kind: "office_signing", title: `Hết hạn ký: ${row.title}`, link: `/office/signing/${id}` }]);
      });
    }
    const soon = new Date(`${today}T00:00:00Z`);
    soon.setUTCDate(soon.getUTCDate() + 2);
    const dueSoon = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM office.signing_requests WHERE status = 'signing' AND due_on = ${soon.toISOString().slice(0, 10)}::date AND NOT due_soon_notified`);
    for (const { id } of dueSoon.rows) {
      await this.database.transaction(async (transaction) => {
        const row = await this.lockRequest(transaction, id, null);
        const current = (await this.signers(transaction, id)).filter((signer) => signer.status === "current" && signer.kind !== "partner");
        for (const signer of current) await this.notifyTurn(transaction, row, signer);
        await transaction.execute(sql`UPDATE office.signing_requests SET due_soon_notified = true WHERE id = ${id}`);
      });
    }
    return { expired: expiredRows.rows.length, reminded: dueSoon.rows.length };
  }

  // ---------- Trang ký của đối tác (API_244; QUYTAC_NGHIEPVU_460) ----------

  private async partnerContext(executor: Executor, token: string, lock: boolean): Promise<{ row: RequestRow; signer: SignerRow }> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new ApiError("NOT_FOUND", "signingLinkUnavailable");
    const found = (await executor.execute<{ request_id: string; id: string }>(sql`SELECT request_id, id FROM office.signing_signers WHERE link_token_hash = ${tokenHash(token)}`)).rows[0];
    if (!found) throw new ApiError("NOT_FOUND", "signingLinkUnavailable");
    const row = lock
      ? await this.lockRequest(executor, found.request_id, null)
      : (
          await executor.execute<RequestRow>(sql`
            SELECT r.*, r.due_on::text AS due_on, c.short_name AS company_name FROM office.signing_requests r JOIN core.companies c ON c.id = r.company_id WHERE r.id = ${found.request_id}`)
        ).rows[0]!;
    const signer = (await this.signers(executor, row.id)).find((item) => item.id === found.id)!;
    if (row.status !== "signing" || signer.status !== "current" || row.due_on < this.permissionService.today()) throw new ApiError("NOT_FOUND", "signingLinkUnavailable");
    return { row, signer };
  }

  async publicView(token: string): Promise<PublicSigningView> {
    const { row, signer } = await this.partnerContext(this.database, token, false);
    const attempt = (
      await this.database.execute<{ status: AttemptRow["status"]; message: string | null; started_at: string }>(sql`
        SELECT status, message, started_at FROM office.signing_attempts WHERE signer_id = ${signer.id} ORDER BY started_at DESC LIMIT 1`)
    ).rows[0];
    return {
      companyName: row.company_name,
      title: row.title,
      note: row.note,
      dueOn: row.due_on,
      partnerName: signer.partner_name!,
      partnerIdentity: signer.partner_identity!,
      identityCode: signer.partner_identity_code!,
      state: attempt?.status === "pending" ? "awaiting_confirmation" : "ready",
      attemptExpiresAt: attempt?.status === "pending" ? new Date(new Date(attempt.started_at).getTime() + signingAttemptTimeoutMilliseconds).toISOString() : null,
      lastFailure: attempt && attempt.status !== "pending" && attempt.status !== "signed" ? attempt.message : null,
    };
  }

  // Sau khi ký xong hoặc từ chối, đường dẫn không ký được nữa nhưng còn xem được kết quả (mã giữ đến khi phiên kết thúc khác).
  async publicStatus(token: string): Promise<PublicSigningView> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new ApiError("NOT_FOUND", "signingLinkUnavailable");
    const found = (
      await this.database.execute<{
        status: SignerRow["status"];
        request_status: string;
        title: string;
        company_name: string;
        due_on: string;
        partner_name: string;
        partner_identity: string;
        partner_identity_code: string;
      }>(sql`
        SELECT s.status, r.status AS request_status, r.title, c.short_name AS company_name, r.due_on::text AS due_on, s.partner_name, s.partner_identity, s.partner_identity_code
        FROM office.signing_signers s JOIN office.signing_requests r ON r.id = s.request_id JOIN core.companies c ON c.id = r.company_id
        WHERE s.link_token_hash = ${tokenHash(token)}`)
    ).rows[0];
    if (!found) throw new ApiError("NOT_FOUND", "signingLinkUnavailable");
    if (found.status === "current") return this.publicView(token);
    if (found.status !== "signed" && found.status !== "rejected") throw new ApiError("NOT_FOUND", "signingLinkUnavailable");
    return {
      companyName: found.company_name,
      title: found.title,
      note: null,
      dueOn: found.due_on,
      partnerName: found.partner_name,
      partnerIdentity: found.partner_identity,
      identityCode: found.partner_identity_code,
      state: found.status,
      attemptExpiresAt: null,
      lastFailure: null,
    };
  }

  async publicFile(token: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const { row } = await this.partnerContext(this.database, token, false);
    const file = await this.readFile(row.current_file_id!);
    return { fileName: file.fileName, contentType: "application/pdf", content: file.content };
  }

  async publicSign(token: string, client: ClientInfo): Promise<PublicSigningView> {
    await this.database.transaction(async (transaction) => {
      const { row, signer } = await this.partnerContext(transaction, token, true);
      await this.startAttempt(transaction, row, signer, { identityCode: signer.partner_identity_code!, chain: await this.partnerChain(row.company_id, signer) }, null, client.ip);
    });
    return this.publicView(token);
  }

  // Chứng thư của đối tác lấy từ nhà cung cấp theo mã định danh đã khai; chọn chứng thư còn hiệu lực đầu tiên.
  private async partnerChain(companyId: string, signer: SignerRow): Promise<string[]> {
    const options = await this.certificates(companyId, signer.partner_identity_code!);
    const usable = options.find((option) => option.usable);
    if (!usable) throw this.businessRule("signingCertificateNotUsable");
    return usable.chain;
  }

  async publicReject(token: string, reason: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const { row, signer } = await this.partnerContext(transaction, token, true);
      await transaction.execute(sql`UPDATE office.signing_signers SET status = 'rejected', reject_reason = ${reason} WHERE id = ${signer.id}`);
      await this.end(transaction, row, "rejected", reason);
      await this.event(transaction, row.id, null, "rejected", { signerId: signer.id, reason }, signer.partner_name);
      await notify(transaction, [{ userId: row.created_by, companyId: row.company_id, kind: "office_signing", title: `Bị từ chối ký: ${row.title}`, link: `/office/signing/${row.id}` }]);
    });
  }
}
