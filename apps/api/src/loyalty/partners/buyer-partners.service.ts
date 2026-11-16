// Người mua liên kết số thành viên đối tác liên minh trên ứng dụng VComm (CONG_VIEC_65; CHUC_NANG_237; QUYTAC_NGHIEPVU_541; API_306).
// Gọi đối tác ngoài giao dịch cơ sở dữ liệu; yêu cầu liên kết lưu trước khi gọi để không mất dấu.
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerPartnerItem, BuyerPartnerLinkRequest } from "contracts";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { ApiError } from "../../common/api-error";
import { CLOCK, type Clock } from "../../common/clock";
import { isUniqueViolation } from "../../common/database-errors";
import { DATABASE, type Database } from "../../database/database.module";
import { vietnamToday } from "../../marketplace/shop.service";
import { PartnerConnectors } from "./connector";

type Executor = Pick<Database, "execute">;
const linkLifetimeMinutes = 5;
const maximumLinkRequestsPerHour = 5;

// Số thành viên che, giữ 3 ký tự cuối.
export const maskMemberNumber = (value: string) => `${"*".repeat(Math.max(value.length - 3, 3))}${value.slice(-3)}`;

type OpenContract = { id: string; connector: "simulator"; member_pattern: string };

// Hợp đồng đang hoạt động, trong thời hạn tại hôm nay (QUYTAC_NGHIEPVU_538).
export async function openContract(executor: Executor, contractId: string, today: string): Promise<OpenContract> {
  const row = (
    await executor.execute<OpenContract>(sql`
      SELECT id, connector, member_pattern FROM loyalty.partner_contracts
      WHERE id = ${contractId} AND status = 'active' AND effective_from <= ${today}::date AND (effective_to IS NULL OR effective_to >= ${today}::date)`)
  ).rows[0];
  if (!row) throw new ApiError("BUSINESS_RULE", "partnerNotActive");
  return row;
}

// Chỉ người mua VComm đang hoạt động.
export async function assertBuyer(executor: Executor, userId: string): Promise<void> {
  const row = (await executor.execute(sql`SELECT 1 FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.id = ${userId} AND u.status = 'active'`)).rows[0];
  if (!row) throw new ApiError("FORBIDDEN", "forbidden");
}

@Injectable()
export class BuyerPartnersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly connectors: PartnerConnectors,
  ) {}

  // Đối tác đang hoạt động kèm tỷ lệ hôm nay và liên kết của khách.
  async list(userId: string): Promise<BuyerPartnerItem[]> {
    await assertBuyer(this.database, userId);
    const today = await vietnamToday(this.database);
    const rows = await this.database.execute<{
      id: string;
      partner_name: string;
      program_name: string;
      unit_name_vi: string;
      unit_name_en: string;
      member_pattern: string;
      outbound: { vcomm_points: number; partner_units: number } | null;
      inbound: { vcomm_points: number; partner_units: number } | null;
      member_number: string | null;
      member_name_masked: string | null;
      linked_at: Date | null;
    }>(sql`
      SELECT c.id, p.name AS partner_name, c.program_name, c.unit_name_vi, c.unit_name_en, c.member_pattern,
        CASE WHEN c.outbound_enabled THEN (SELECT json_build_object('vcomm_points', r.vcomm_points, 'partner_units', r.partner_units) FROM loyalty.partner_rates r
          WHERE r.contract_id = c.id AND r.direction = 'outbound' AND r.starts_on <= ${today}::date AND (r.ends_on IS NULL OR r.ends_on >= ${today}::date)) END AS outbound,
        CASE WHEN c.inbound_enabled THEN (SELECT json_build_object('vcomm_points', r.vcomm_points, 'partner_units', r.partner_units) FROM loyalty.partner_rates r
          WHERE r.contract_id = c.id AND r.direction = 'inbound' AND r.starts_on <= ${today}::date AND (r.ends_on IS NULL OR r.ends_on >= ${today}::date)) END AS inbound,
        m.member_number, m.member_name_masked, m.linked_at
      FROM loyalty.partner_contracts c JOIN crm.partners p ON p.id = c.partner_id
      LEFT JOIN loyalty.partner_memberships m ON m.contract_id = c.id AND m.user_id = ${userId} AND m.status = 'linked'
      WHERE c.status = 'active' AND c.effective_from <= ${today}::date AND (c.effective_to IS NULL OR c.effective_to >= ${today}::date)
        AND (c.outbound_enabled OR c.inbound_enabled)
      ORDER BY p.name`);
    const rate = (value: { vcomm_points: number; partner_units: number } | null) => (value ? { vcommPoints: value.vcomm_points, partnerUnits: value.partner_units } : null);
    return rows.rows.map((row) => ({
      id: row.id,
      partnerName: row.partner_name,
      programName: row.program_name,
      unitNameVi: row.unit_name_vi,
      unitNameEn: row.unit_name_en,
      memberPattern: row.member_pattern,
      outbound: rate(row.outbound),
      inbound: rate(row.inbound),
      link: row.member_number ? { memberNumberMasked: maskMemberNumber(row.member_number), memberNameMasked: row.member_name_masked, linkedAt: new Date(row.linked_at!).toISOString() } : null,
    }));
  }

  // Bước 1: lưu yêu cầu rồi gọi đối tác gửi mã OTP tới khách (QUYTAC_NGHIEPVU_541).
  async requestLink(userId: string, contractId: string, memberNumber: string): Promise<BuyerPartnerLinkRequest> {
    await assertBuyer(this.database, userId);
    const today = await vietnamToday(this.database);
    const contract = await openContract(this.database, contractId, today);
    if (!new RegExp(contract.member_pattern).test(memberNumber)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { memberNumber: "partnerMemberNumberInvalid" } });
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + linkLifetimeMinutes * 60_000);
    const reference = `VCL-${randomBytes(9).toString("base64url")}`;
    const requestId = await this.database.transaction(async (transaction) => {
      // Khóa theo khách và đối tác để đếm số lần gửi mã đúng khi gửi cùng lúc.
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`partner-link:${userId}:${contractId}`}))`);
      const linked = await transaction.execute<{ user_id: string }>(sql`
        SELECT user_id FROM loyalty.partner_memberships WHERE contract_id = ${contractId} AND status = 'linked' AND (user_id = ${userId} OR member_number = ${memberNumber})`);
      if (linked.rows.some((row) => row.user_id === userId)) throw new ApiError("BUSINESS_RULE", "partnerAlreadyLinked");
      if (linked.rows.length > 0) throw new ApiError("BUSINESS_RULE", "partnerMemberTaken");
      const recent = await transaction.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM loyalty.partner_link_requests WHERE user_id = ${userId} AND contract_id = ${contractId} AND created_at > ${new Date(now.getTime() - 3_600_000)}`);
      if (recent.rows[0]!.total >= maximumLinkRequestsPerHour) throw new ApiError("RATE_LIMITED", "partnerLinkTooMany");
      await transaction.execute(sql`UPDATE loyalty.partner_link_requests SET status = 'expired' WHERE user_id = ${userId} AND contract_id = ${contractId} AND status = 'pending'`);
      return (
        await transaction.execute<{ id: string }>(sql`
          INSERT INTO loyalty.partner_link_requests (contract_id, user_id, member_number, reference, expires_at, created_at)
          VALUES (${contractId}, ${userId}, ${memberNumber}, ${reference}, ${expiresAt}, ${now}) RETURNING id`)
      ).rows[0]!.id;
    });
    const result = await this.connectors.of(contract).sendLinkOtp(contract, { memberNumber, reference });
    if (result.outcome !== "success") {
      await this.database.execute(sql`UPDATE loyalty.partner_link_requests SET status = 'failed' WHERE id = ${requestId}`);
      throw new ApiError("BUSINESS_RULE", result.outcome === "rejected" ? "partnerMemberRejected" : "partnerConnectionFailed");
    }
    return { requestId, expiresAt: expiresAt.toISOString() };
  }

  // Bước 2: khách nhập mã; đối tác xác nhận thì lưu liên kết kèm tên đã che. Mã sai giữ yêu cầu để nhập lại (đối tác quyết định số lần sai).
  async verifyLink(userId: string, requestId: string, otp: string): Promise<BuyerPartnerItem> {
    await assertBuyer(this.database, userId);
    const request = (
      await this.database.execute<{ contract_id: string; member_number: string; reference: string; status: string; expires_at: Date }>(sql`
        SELECT contract_id, member_number, reference, status, expires_at FROM loyalty.partner_link_requests WHERE id = ${requestId} AND user_id = ${userId}`)
    ).rows[0];
    if (!request) throw new ApiError("NOT_FOUND", "notFound");
    if (request.status !== "pending" || new Date(request.expires_at) <= this.clock.now()) throw new ApiError("BUSINESS_RULE", "partnerOtpInvalid");
    const contract = await openContract(this.database, request.contract_id, await vietnamToday(this.database));
    const result = await this.connectors.of(contract).verifyLink(contract, { memberNumber: request.member_number, reference: request.reference, otp });
    if (result.outcome === "unknown") throw new ApiError("BUSINESS_RULE", "partnerConnectionFailed");
    if (result.outcome === "rejected") {
      if (result.code === "OTP_INVALID") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { otp: "partnerOtpInvalid" } });
      await this.database.execute(sql`UPDATE loyalty.partner_link_requests SET status = 'failed' WHERE id = ${requestId}`);
      throw new ApiError("BUSINESS_RULE", "partnerMemberRejected");
    }
    await this.database
      .transaction(async (transaction) => {
        const claimed = await transaction.execute(sql`UPDATE loyalty.partner_link_requests SET status = 'linked' WHERE id = ${requestId} AND status = 'pending' RETURNING id`);
        if (claimed.rows.length === 0) throw new ApiError("BUSINESS_RULE", "partnerOtpInvalid");
        await transaction.execute(sql`
          INSERT INTO loyalty.partner_memberships (contract_id, user_id, member_number, member_name_masked)
          VALUES (${request.contract_id}, ${userId}, ${request.member_number}, ${result.value.maskedName})`);
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "partnerMemberTaken");
        throw error;
      });
    const item = (await this.list(userId)).find((partner) => partner.id === request.contract_id);
    if (!item) throw new ApiError("BUSINESS_RULE", "partnerNotActive");
    return item;
  }

  // Khách tự hủy liên kết.
  async unlink(userId: string, contractId: string): Promise<void> {
    await assertBuyer(this.database, userId);
    // Còn giao dịch đang chờ với đối tác thì chưa hủy liên kết được (QUYTAC_NGHIEPVU_541).
    const pending = await this.database.execute(sql`
      SELECT 1 FROM loyalty.partner_exchanges WHERE contract_id = ${contractId} AND user_id = ${userId} AND status IN ('sending', 'otp_pending', 'pending_partner', 'needs_review') LIMIT 1`);
    if (pending.rows.length > 0) throw new ApiError("BUSINESS_RULE", "partnerExchangePending");
    const updated = await this.database.execute(sql`
      UPDATE loyalty.partner_memberships SET status = 'unlinked', unlinked_at = now() WHERE contract_id = ${contractId} AND user_id = ${userId} AND status = 'linked' RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "partnerNotLinked");
  }
}
