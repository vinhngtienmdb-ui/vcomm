// Cổng cửa hàng liên kết: thành viên đang đăng nhập, cửa hàng của tôi, nhân viên, kích hoạt lời mời
// (CONG_VIEC_55; CHUC_NANG_193; QUYTAC_NGHIEPVU_393; API_207). Thành viên chỉ thấy dữ liệu cửa hàng của mình.
import { Inject, Injectable } from "@nestjs/common";
import type { AffiliateMember, AffiliateMemberRole, AffiliateMerchantStatus, LoginResponse, MerchantPortalMe, MerchantPortalStore, affiliateCashierInviteSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { AuthService } from "../auth/auth.service";
import { PhoneOtpService } from "../auth/phone-otp.service";
import type { ClientInfo, IssuedSession } from "../auth/auth.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import { inviteMember, membersOf, merchantRow, outletOf, outletsOf, replaceMemberOutlets, setLocked, termsOf } from "./merchants.service";

type Executor = Pick<Database, "execute">;

export interface PortalMember {
  memberId: string;
  userId: string;
  merchantId: string;
  companyId: string;
  role: AffiliateMemberRole;
  merchantStatus: AffiliateMerchantStatus;
  outletIds: string[];
  client: ClientInfo;
}

// Xác định thành viên đang thao tác: thành viên đã kích hoạt của cửa hàng chưa chấm dứt.
// Nhiều cửa hàng thì phải chọn qua `merchantId`; một cửa hàng thì dùng luôn.
export async function resolvePortalMember(executor: Executor, userId: string, merchantId: string | undefined, client: ClientInfo): Promise<PortalMember> {
  const rows = await executor.execute<{
    member_id: string;
    merchant_id: string;
    company_id: string;
    role: AffiliateMemberRole;
    merchant_status: AffiliateMerchantStatus;
    outlet_ids: string[] | null;
  }>(sql`
    SELECT mb.id AS member_id, m.id AS merchant_id, m.company_id, mb.role, m.status AS merchant_status,
      (SELECT array_agg(mo.outlet_id) FROM affiliate.member_outlets mo WHERE mo.member_id = mb.id) AS outlet_ids
    FROM affiliate.members mb JOIN affiliate.merchants m ON m.id = mb.merchant_id
    WHERE mb.user_id = ${userId} AND mb.status = 'active' AND m.status <> 'draft'
      ${merchantId ? sql`AND m.id = ${merchantId}` : sql``}`);
  if (rows.rows.length === 0) throw new ApiError("FORBIDDEN", "forbidden");
  if (rows.rows.length > 1) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { merchantId: "required" } });
  const row = rows.rows[0]!;
  return {
    memberId: row.member_id,
    userId,
    merchantId: row.merchant_id,
    companyId: row.company_id,
    role: row.role,
    merchantStatus: row.merchant_status,
    outletIds: row.outlet_ids ?? [],
    client,
  };
}

export function requireOwner(member: PortalMember): void {
  if (member.role !== "owner") throw new ApiError("FORBIDDEN", "forbidden");
}

@Injectable()
export class MerchantPortalService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly phoneOtp: PhoneOtpService,
    private readonly auth: AuthService,
  ) {}

  member(userId: string, merchantId: string | undefined, client: ClientInfo): Promise<PortalMember> {
    return resolvePortalMember(this.database, userId, merchantId, client);
  }

  private record(member: PortalMember, action: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: member.userId,
        companyId: member.companyId,
        appCode: "affiliate",
        action,
        entityType: "affiliate_merchant",
        entityId: member.merchantId,
        afterData,
        ip: member.client.ip,
        userAgent: member.client.userAgent,
        requestId: member.client.requestId,
      },
      executor,
    );
  }

  // API_207: mọi cửa hàng người đang đăng nhập là thành viên đã kích hoạt; thu ngân chỉ thấy điểm bán được gán, đang hoạt động.
  async me(userId: string): Promise<MerchantPortalMe> {
    const user = (await this.database.execute<{ full_name: string }>(sql`SELECT full_name FROM core.users WHERE id = ${userId}`)).rows[0];
    const rows = await this.database.execute<{
      member_id: string;
      merchant_id: string;
      code: string;
      name: string;
      status: AffiliateMerchantStatus;
      role: AffiliateMemberRole;
    }>(sql`
      SELECT mb.id AS member_id, m.id AS merchant_id, m.code, p.name, m.status, mb.role
      FROM affiliate.members mb JOIN affiliate.merchants m ON m.id = mb.merchant_id JOIN crm.partners p ON p.id = m.partner_id
      WHERE mb.user_id = ${userId} AND mb.status = 'active' AND m.status <> 'draft' ORDER BY p.name`);
    const memberships = [];
    for (const row of rows.rows) {
      const outlets = await this.database.execute<{ id: string; name: string; address: string; status: "active" | "inactive" }>(sql`
        SELECT o.id, o.name, o.address, o.status FROM affiliate.outlets o
        WHERE o.merchant_id = ${row.merchant_id} AND o.status = 'active'
          ${row.role === "cashier" ? sql`AND o.id IN (SELECT outlet_id FROM affiliate.member_outlets WHERE member_id = ${row.member_id})` : sql``}
        ORDER BY o.created_at, o.name`);
      memberships.push({
        memberId: row.member_id,
        merchantId: row.merchant_id,
        merchantCode: row.code,
        merchantName: row.name,
        merchantStatus: row.status,
        role: row.role,
        outlets: outlets.rows.map(outletOf),
      });
    }
    return { userId, fullName: user?.full_name ?? "", memberships };
  }

  // MAN_HINH_177: cửa hàng của tôi (chủ cửa hàng).
  async store(member: PortalMember): Promise<MerchantPortalStore> {
    requireOwner(member);
    const row = await merchantRow(this.database, member.merchantId, member.companyId);
    return {
      merchantId: row.id,
      code: row.code,
      name: row.name,
      status: row.status,
      ...termsOf(row),
      outlets: await outletsOf(this.database, member.merchantId),
      members: await membersOf(this.database, member.merchantId),
    };
  }

  // Chủ cửa hàng mời thu ngân, gán điểm bán (QUYTAC_NGHIEPVU_393).
  async inviteCashier(member: PortalMember, input: z.infer<typeof affiliateCashierInviteSchema>): Promise<AffiliateMember[]> {
    requireOwner(member);
    if (member.merchantStatus === "terminated") throw new ApiError("BUSINESS_RULE", "affiliateMerchantTerminated");
    await this.database.transaction(async (transaction) => {
      await inviteMember(transaction, { merchantId: member.merchantId, fullName: input.fullName, phone: input.phone, role: "cashier", outletIds: input.outletIds, invitedBy: member.userId });
      await this.record(member, "affiliate_member.invite_cashier", { fullName: input.fullName, outletIds: input.outletIds }, transaction);
    });
    return membersOf(this.database, member.merchantId);
  }

  private async cashierRow(executor: Executor, member: PortalMember, memberId: string) {
    const row = (
      await executor.execute<{ status: string; user_id: string | null; version: number; role: string }>(sql`
        SELECT status, user_id, version, role FROM affiliate.members WHERE id = ${memberId} AND merchant_id = ${member.merchantId} FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    // Chủ cửa hàng chỉ quản lý thu ngân; khóa chủ do công ty làm.
    if (row.role !== "cashier") throw new ApiError("FORBIDDEN", "forbidden");
    return row;
  }

  async setCashierOutlets(member: PortalMember, memberId: string, outletIds: string[], version: number): Promise<AffiliateMember[]> {
    requireOwner(member);
    await this.database.transaction(async (transaction) => {
      const row = await this.cashierRow(transaction, member, memberId);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await replaceMemberOutlets(transaction, memberId, member.merchantId, outletIds);
      await transaction.execute(sql`UPDATE affiliate.members SET updated_at = now(), version = version + 1 WHERE id = ${memberId}`);
      await this.record(member, "affiliate_member.outlets", { memberId, outletIds }, transaction);
    });
    return membersOf(this.database, member.merchantId);
  }

  async setCashierLocked(member: PortalMember, memberId: string, locked: boolean, version: number): Promise<AffiliateMember[]> {
    requireOwner(member);
    await this.database.transaction(async (transaction) => {
      const row = await this.cashierRow(transaction, member, memberId);
      await setLocked(transaction, memberId, row, locked, version);
      await this.record(member, locked ? "affiliate_member.lock" : "affiliate_member.unlock", { memberId }, transaction);
    });
    return membersOf(this.database, member.merchantId);
  }

  private async pendingInvitations(executor: Executor, phone: string): Promise<{ id: string; full_name: string }[]> {
    return (
      await executor.execute<{ id: string; full_name: string }>(sql`
        SELECT mb.id, mb.full_name FROM affiliate.members mb JOIN affiliate.merchants m ON m.id = mb.merchant_id
        WHERE mb.phone = ${phone} AND mb.status = 'invited' AND mb.invitation_expires_at > now() AND m.status <> 'terminated'
        ORDER BY mb.invited_at FOR UPDATE OF mb`)
    ).rows;
  }

  // Gửi mã kích hoạt: luôn trả thành công để không lộ số nào được mời; chỉ gửi khi có lời mời còn hạn.
  async sendActivationOtp(phone: string): Promise<void> {
    if ((await this.pendingInvitations(this.database, phone)).length === 0) return;
    await this.phoneOtp.send(phone, (await this.phoneOtp.activeUserByPhone(phone)) ? "login" : "register");
  }

  // Kích hoạt mọi lời mời còn hạn của số điện thoại; chưa có tài khoản thì tạo theo tên trong lời mời; đăng nhập phiên web.
  async activate(phone: string, code: string, client: ClientInfo): Promise<{ response: LoginResponse; session: IssuedSession }> {
    const existing = await this.phoneOtp.activeUserByPhone(phone);
    const invitations = await this.pendingInvitations(this.database, phone);
    if (invitations.length === 0 || !(await this.phoneOtp.consume(phone, code, existing ? "login" : "register"))) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
    const userId = await this.database.transaction(async (transaction) => {
      const locked = await this.pendingInvitations(transaction, phone);
      if (locked.length === 0) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
      const id =
        existing?.id ??
        (await transaction.execute<{ id: string }>(sql`INSERT INTO core.users (phone, full_name, status) VALUES (${phone}, ${locked[0]!.full_name}, 'active') RETURNING id`)).rows[0]!.id;
      await transaction.execute(sql`
        UPDATE affiliate.members SET user_id = ${id}, status = 'active', activated_at = now(), updated_at = now(), version = version + 1
        WHERE id = ANY(${pgArray(locked.map((row) => row.id))}::uuid[])`);
      await transaction.execute(sql`
        INSERT INTO core.user_identities (user_id, provider, provider_subject) VALUES (${id}, 'phone_otp', ${phone})
        ON CONFLICT (provider, provider_subject) DO UPDATE SET user_id = EXCLUDED.user_id`);
      await this.audit.record(
        { actorUserId: id, appCode: "affiliate", action: "affiliate_member.activate", entityType: "affiliate_member", afterData: { members: locked.map((row) => row.id) } },
        transaction,
      );
      return id;
    });
    const user = await this.phoneOtp.activeUserByPhone(phone);
    if (!user || user.id !== userId) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
    return this.auth.completeLogin(user, "phone_otp", phone, client, "web");
  }
}
