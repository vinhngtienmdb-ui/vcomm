// Thu ngân tự đăng ký trên ứng dụng iPOS, chủ cửa hàng duyệt hoặc từ chối (CONG_VIEC_74; CHUC_NANG_254; QUYTAC_NGHIEPVU_605; API_336, API_349).
import { Inject, Injectable } from "@nestjs/common";
import type { IposCashierRegistration, IposRegistrationCreated, IposRegistrationOutlet, IposRegistrationStatus, iposRegistrationSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { activateInvitedMember, inviteMember } from "../affiliate/merchants.service";
import type { PortalMember } from "../affiliate/portal.service";
import { PhoneOtpService } from "../auth/phone-otp.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";

type Executor = Pick<Database, "execute">;
const registrationDays = 7;
const perPhonePerDay = 3;

// Che số điện thoại trên cổng: giữ 4 số đầu và 3 số cuối.
const maskPhone = (phone: string) => `0${phone.slice(3, 6)} *** ${phone.slice(-3)}`;

@Injectable()
export class IposRegistrationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly phoneOtp: PhoneOtpService,
    private readonly audit: AuditService,
  ) {}

  // Cửa hàng nhận đăng ký: đang hoạt động, có ít nhất một thuê bao chưa hủy.
  private async merchantByCode(executor: Executor, merchantCode: string): Promise<{ id: string; company_id: string } | null> {
    const row = (
      await executor.execute<{ id: string; company_id: string }>(sql`
        SELECT m.id, m.company_id FROM affiliate.merchants m
        WHERE m.code = ${merchantCode} AND m.status = 'active'
          AND EXISTS (SELECT 1 FROM ipos.subscriptions s WHERE s.merchant_id = m.id AND s.status <> 'cancelled')`)
    ).rows[0];
    return row ?? null;
  }

  // Điểm bán có thuê bao để người đăng ký chọn (tên, địa chỉ là thông tin công khai của cửa hàng).
  async outlets(merchantCode: string): Promise<IposRegistrationOutlet[]> {
    const merchant = await this.merchantByCode(this.database, merchantCode);
    if (!merchant) throw new ApiError("NOT_FOUND", "iposMerchantCodeUnknown");
    const rows = await this.database.execute<{ id: string; name: string; address: string }>(sql`
      SELECT o.id, o.name, o.address FROM affiliate.outlets o
      WHERE o.merchant_id = ${merchant.id} AND o.status = 'active'
        AND EXISTS (SELECT 1 FROM ipos.subscriptions s WHERE s.outlet_id = o.id AND s.status <> 'cancelled')
      ORDER BY o.name`);
    return rows.rows;
  }

  // Gửi mã xác minh số điện thoại; mã cửa hàng sai thì báo để người đăng ký sửa (mã cửa hàng do chủ cửa hàng đưa).
  async sendOtp(merchantCode: string, phone: string): Promise<void> {
    if (!(await this.merchantByCode(this.database, merchantCode))) throw new ApiError("NOT_FOUND", "iposMerchantCodeUnknown");
    await this.limitPerPhone(phone);
    await this.phoneOtp.send(phone, "ipos_register");
  }

  private async limitPerPhone(phone: string): Promise<void> {
    const today = await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM ipos.cashier_registrations WHERE phone = ${phone} AND created_at > ${new Date(this.clock.now().getTime() - 86_400_000)}`);
    if (today.rows[0]!.total >= perPhonePerDay) throw new ApiError("RATE_LIMITED", "iposRegistrationTooMany");
  }

  async register(input: z.infer<typeof iposRegistrationSchema>): Promise<IposRegistrationCreated> {
    const merchant = await this.merchantByCode(this.database, input.merchantCode);
    if (!merchant) throw new ApiError("NOT_FOUND", "iposMerchantCodeUnknown");
    await this.limitPerPhone(input.phone);
    if (!(await this.phoneOtp.consume(input.phone, input.code, "ipos_register"))) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + registrationDays * 86_400_000);
    const id = await this.database.transaction(async (transaction) => {
      const member = await transaction.execute(sql`SELECT 1 FROM affiliate.members WHERE merchant_id = ${merchant.id} AND phone = ${input.phone} AND status <> 'invited'`);
      if (member.rows.length > 0) throw new ApiError("BUSINESS_RULE", "iposAlreadyMember");
      const outletIds = [...new Set(input.outletIds)];
      if (outletIds.length > 0) {
        const valid = await transaction.execute<{ total: number }>(sql`
          SELECT count(*)::int AS total FROM affiliate.outlets WHERE merchant_id = ${merchant.id} AND status = 'active' AND id = ANY(${pgArray(outletIds)}::uuid[])`);
        if (valid.rows[0]!.total !== outletIds.length) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { outletIds: "invalidValue" } });
      }
      // Hết hạn các yêu cầu cũ của số này trước khi kiểm yêu cầu đang chờ.
      await transaction.execute(sql`UPDATE ipos.cashier_registrations SET status = 'expired' WHERE merchant_id = ${merchant.id} AND phone = ${input.phone} AND status = 'pending' AND expires_at <= ${now}`);
      const pending = await transaction.execute(sql`SELECT 1 FROM ipos.cashier_registrations WHERE merchant_id = ${merchant.id} AND phone = ${input.phone} AND status = 'pending'`);
      if (pending.rows.length > 0) throw new ApiError("BUSINESS_RULE", "iposRegistrationPending");
      const existing = await this.phoneOtp.activeUserByPhone(input.phone);
      // Chưa có tài khoản VComm thì tạo theo họ tên như lời mời của QUYTAC_NGHIEPVU_393.
      const userId =
        existing?.id ??
        (await transaction.execute<{ id: string }>(sql`INSERT INTO core.users (phone, full_name, status) VALUES (${input.phone}, ${input.fullName}, 'active') RETURNING id`)).rows[0]!.id;
      if (!existing) {
        await transaction.execute(sql`
          INSERT INTO core.user_identities (user_id, provider, provider_subject) VALUES (${userId}, 'phone_otp', ${input.phone})
          ON CONFLICT (provider, provider_subject) DO UPDATE SET user_id = EXCLUDED.user_id`);
      }
      // Vai trò luôn là thu ngân: không có trường vai trò trong dữ liệu gửi lên (chống tự nâng quyền).
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO ipos.cashier_registrations (merchant_id, user_id, phone, full_name, requested_outlet_ids, expires_at)
        VALUES (${merchant.id}, ${userId}, ${input.phone}, ${input.fullName}, ${pgArray(outletIds)}::uuid[], ${expiresAt})
        RETURNING id`);
      const registrationId = inserted.rows[0]!.id;
      await this.audit.record(
        { actorUserId: userId, companyId: merchant.company_id, appCode: "affiliate", action: "ipos_registration.create", entityType: "ipos_registration", entityId: registrationId, afterData: { outletIds } },
        transaction,
      );
      return registrationId;
    });
    return { id, status: "pending", expiresAt: expiresAt.toISOString() };
  }

  // Chủ cửa hàng xem yêu cầu; quá 7 ngày hiện hết hạn.
  async list(member: PortalMember): Promise<IposCashierRegistration[]> {
    const now = this.clock.now();
    await this.database.execute(sql`UPDATE ipos.cashier_registrations SET status = 'expired' WHERE merchant_id = ${member.merchantId} AND status = 'pending' AND expires_at <= ${now}`);
    const rows = await this.database.execute<{
      id: string;
      full_name: string;
      phone: string;
      requested: { id: string; name: string }[] | null;
      status: IposRegistrationStatus;
      created_at: Date;
      expires_at: Date;
      reason: string | null;
    }>(sql`
      SELECT r.id, r.full_name, r.phone, r.status, r.created_at, r.expires_at, r.reason,
        (SELECT json_agg(json_build_object('id', o.id, 'name', o.name) ORDER BY o.name) FROM affiliate.outlets o WHERE o.id = ANY(r.requested_outlet_ids)) AS requested
      FROM ipos.cashier_registrations r
      WHERE r.merchant_id = ${member.merchantId} AND (r.status = 'pending' OR r.created_at > ${new Date(now.getTime() - 30 * 86_400_000)})
      ORDER BY r.status <> 'pending', r.created_at DESC
      LIMIT 200`);
    return rows.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      phone: maskPhone(row.phone),
      requestedOutlets: row.requested ?? [],
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      reason: row.reason,
    }));
  }

  private async lockPending(executor: Executor, member: PortalMember, registrationId: string) {
    const row = (
      await executor.execute<{ user_id: string; phone: string; full_name: string; status: string; expires_at: Date }>(sql`
        SELECT user_id, phone, full_name, status, expires_at FROM ipos.cashier_registrations WHERE id = ${registrationId} AND merchant_id = ${member.merchantId} FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "pending" || new Date(row.expires_at) <= this.clock.now()) throw new ApiError("BUSINESS_RULE", "iposRegistrationClosed");
    return row;
  }

  // Duyệt: tạo thành viên thu ngân đang hoạt động, gán điểm bán (QUYTAC_NGHIEPVU_605).
  async approve(member: PortalMember, registrationId: string, outletIds: string[]): Promise<IposCashierRegistration[]> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lockPending(transaction, member, registrationId);
      const existing = (
        await transaction.execute<{ id: string; status: string }>(sql`SELECT id, status FROM affiliate.members WHERE merchant_id = ${member.merchantId} AND phone = ${row.phone} FOR UPDATE`)
      ).rows[0];
      if (existing && existing.status !== "invited") throw new ApiError("BUSINESS_RULE", "iposAlreadyMember");
      // Dùng lại cách mời của cổng cửa hàng (kiểm điểm bán, gán điểm bán), rồi kích hoạt ngay vì số điện thoại đã xác minh bằng OTP.
      const memberId = await inviteMember(transaction, { merchantId: member.merchantId, fullName: row.full_name, phone: row.phone, role: "cashier", outletIds, invitedBy: member.userId });
      await activateInvitedMember(transaction, memberId, row.user_id);
      await transaction.execute(sql`
        UPDATE ipos.cashier_registrations SET status = 'approved', decided_by = ${member.userId}, decided_at = now() WHERE id = ${registrationId}`);
      await this.audit.record(
        { actorUserId: member.userId, companyId: member.companyId, appCode: "affiliate", action: "ipos_registration.approve", entityType: "ipos_registration", entityId: registrationId, afterData: { outletIds }, ip: member.client.ip, userAgent: member.client.userAgent, requestId: member.client.requestId },
        transaction,
      );
    });
    return this.list(member);
  }

  async reject(member: PortalMember, registrationId: string, reason: string | null): Promise<IposCashierRegistration[]> {
    await this.database.transaction(async (transaction) => {
      await this.lockPending(transaction, member, registrationId);
      await transaction.execute(sql`
        UPDATE ipos.cashier_registrations SET status = 'rejected', reason = ${reason}, decided_by = ${member.userId}, decided_at = now() WHERE id = ${registrationId}`);
      await this.audit.record(
        { actorUserId: member.userId, companyId: member.companyId, appCode: "affiliate", action: "ipos_registration.reject", entityType: "ipos_registration", entityId: registrationId, afterData: { reason }, ip: member.client.ip, userAgent: member.client.userAgent, requestId: member.client.requestId },
        transaction,
      );
    });
    return this.list(member);
  }
}
