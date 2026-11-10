// Tài khoản người mua VComm: đăng ký bằng số điện thoại và OTP, đăng nhập, quên mật khẩu, giới thiệu
// (CONG_VIEC_23; CHUC_NANG_104 đến 106; QUYTAC_NGHIEPVU_141 đến 147; API_116 đến 118).
import { Inject, Injectable } from "@nestjs/common";
import type { AppLoginResponse, BuyerMeResponse, BuyerReferralItem, BuyerSalesCustomerItem, MySalesTeamResponse } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { minimumPasswordLength } from "../auth/activation.service";
import { AuthService, type ClientInfo, type IssuedSession } from "../auth/auth.service";
import { setPassword } from "../auth/password.service";
import { PhoneOtpService } from "../auth/phone-otp.service";
import { users } from "../database/schema";
import { SalesTeamService, type SalesTeam } from "./sales-team.service";

type Executor = Pick<Database, "execute">;

const appTokens = (session: IssuedSession) => ({
  accessToken: session.accessToken,
  refreshToken: session.refreshToken,
  accessExpiresAt: session.accessExpiresAt.toISOString(),
  refreshExpiresAt: session.refreshExpiresAt.toISOString(),
});

// Số điện thoại lưu dạng +84…; mã giới thiệu, số hiển thị dùng dạng 0… (QUYTAC_NGHIEPVU_142).
export const localPhone = (phone: string) => (phone.startsWith("+84") ? `0${phone.slice(3)}` : phone);
// Che số điện thoại: giữ 4 số đầu, 3 số cuối (QUYTAC_NGHIEPVU_146).
export const maskPhone = (phone: string) => {
  const local = localPhone(phone);
  return local.length <= 7 ? local : `${local.slice(0, 4)}***${local.slice(-3)}`;
};

const invalidField = (field: string, key: ErrorMessageKey) => new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: key } });

@Injectable()
export class BuyerAccountsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly auth: AuthService,
    private readonly phoneOtp: PhoneOtpService,
    private readonly audit: AuditService,
    private readonly salesTeam: SalesTeamService,
  ) {}

  // API_116: gửi mã đăng ký. Số đã có tài khoản thì báo để khách chuyển sang đăng nhập (QUYTAC_NGHIEPVU_141).
  async sendRegisterOtp(phone: string): Promise<void> {
    await this.requirePhoneFree(phone);
    await this.phoneOtp.send(phone, "register");
  }

  // API_116: kiểm tra mã giới thiệu trước khi dùng mã OTP để khách sửa mã mà không phải xin mã OTP mới.
  async register(input: { phone: string; code: string; fullName: string; password: string; referralCode?: string | null }, client: ClientInfo): Promise<AppLoginResponse> {
    await this.requirePhoneFree(input.phone);
    if (input.password.length < minimumPasswordLength) throw invalidField("password", "passwordTooShort");
    const referrerId = input.referralCode ? await this.resolveReferrer(this.database, input.referralCode, null) : null;
    if (!(await this.phoneOtp.consume(input.phone, input.code, "register"))) throw invalidField("code", "otpInvalid");
    const now = this.clock.now();
    let userId: string;
    try {
      userId = await this.database.transaction(async (transaction) => {
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO core.users (phone, full_name, status) VALUES (${input.phone}, ${input.fullName}, 'active') RETURNING id`);
        const id = created.rows[0]!.id;
        await setPassword(transaction, id, input.password);
        await transaction.execute(sql`
          INSERT INTO marketplace.buyer_accounts (user_id, referrer_user_id, registered_at) VALUES (${id}, ${referrerId}, ${now})`);
        if (referrerId) {
          await transaction.execute(sql`
            INSERT INTO marketplace.referrer_history (buyer_user_id, previous_referrer_id, new_referrer_id, source, changed_by, changed_at)
            VALUES (${id}, NULL, ${referrerId}, 'registration', ${id}, ${now})`);
        }
        await this.audit.record(
          {
            actorUserId: id,
            appCode: "marketplace",
            action: "buyer.register",
            entityType: "core.users",
            entityId: id,
            afterData: { referrerId },
            ip: client.ip,
            userAgent: client.userAgent,
            requestId: client.requestId,
          },
          transaction,
        );
        return id;
      });
    } catch (error) {
      // Hai lần đăng ký cùng số cùng lúc: lần sau gặp chỉ mục duy nhất.
      if (isUniqueViolation(error)) throw invalidField("phone", "phoneTaken");
      throw error;
    }
    const user = (
      await this.database
        .select()
        .from(users)
        .where(sql`${users.id} = ${userId}`)
    )[0]!;
    const { response, session } = await this.auth.completeLogin(user, "password", input.phone, client, "vcomm_app");
    return { ...response, tokens: appTokens(session) };
  }

  // API_117: đăng nhập bằng mật khẩu, khóa 15 phút sau 5 lần sai như web (QUYTAC_NGHIEPVU_147).
  async login(phone: string, password: string, client: ClientInfo): Promise<AppLoginResponse> {
    const { response, session } = await this.auth.login({ identifier: phone, password }, client, "vcomm_app");
    await this.ensureAccount(response.user.id);
    return { ...response, tokens: appTokens(session) };
  }

  async sendLoginOtp(phone: string): Promise<void> {
    await this.phoneOtp.send(phone, "login");
  }

  async verifyLoginOtp(phone: string, code: string, client: ClientInfo): Promise<AppLoginResponse> {
    const { response, session } = await this.phoneOtp.verify(phone, code, client, "vcomm_app");
    await this.ensureAccount(response.user.id);
    return { ...response, tokens: appTokens(session) };
  }

  // Luôn trả thành công để không lộ số nào có tài khoản; chỉ gửi mã cho số đang hoạt động.
  async sendPasswordResetOtp(phone: string): Promise<void> {
    await this.phoneOtp.send(phone, "password_reset");
  }

  // Đặt mật khẩu mới bằng mã OTP; thu hồi mọi phiên, bỏ khóa đăng nhập (QUYTAC_NGHIEPVU_147).
  async resetPassword(phone: string, code: string, password: string, client: ClientInfo): Promise<void> {
    if (password.length < minimumPasswordLength) throw invalidField("password", "passwordTooShort");
    // Tài khoản có thư điện tử (nhân viên) đặt lại mật khẩu bằng đường dẫn gửi qua thư điện tử trên web (rà soát CONG_VIEC_23).
    const user = await this.phoneOtp.activeUserByPhone(phone);
    if (!user || user.email || !(await this.phoneOtp.consume(phone, code, "password_reset"))) throw invalidField("code", "otpInvalid");
    await this.database.transaction(async (transaction) => {
      await setPassword(transaction, user.id, password);
      await transaction.execute(sql`UPDATE core.users SET login_locked_until = NULL, updated_at = now() WHERE id = ${user.id}`);
      await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${user.id} AND revoked_at IS NULL`);
      await this.audit.record(
        { actorUserId: user.id, appCode: "marketplace", action: "password.reset", entityType: "user", entityId: user.id, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
    });
  }

  // API_118
  async me(userId: string): Promise<BuyerMeResponse> {
    await this.ensureAccount(userId);
    const row = (
      await this.database.execute<{
        full_name: string;
        phone: string | null;
        registered_at: Date;
        is_sales_staff: boolean;
        referrer_name: string | null;
        referrer_phone: string | null;
        has_history: boolean;
      }>(sql`
      SELECT u.full_name, u.phone, b.registered_at, b.is_sales_staff, r.full_name AS referrer_name, r.phone AS referrer_phone,
             EXISTS (SELECT 1 FROM marketplace.referrer_history h WHERE h.buyer_user_id = b.user_id) AS has_history
      FROM marketplace.buyer_accounts b
      JOIN core.users u ON u.id = b.user_id
      LEFT JOIN core.users r ON r.id = b.referrer_user_id
      WHERE b.user_id = ${userId}`)
    ).rows[0]!;
    // Tài khoản nhân viên tạo bằng thư điện tử có thể chưa có số điện thoại: chưa có mã giới thiệu.
    const phone = row.phone ?? "";
    return {
      id: userId,
      fullName: row.full_name,
      phone: localPhone(phone),
      referralCode: localPhone(phone),
      registeredAt: new Date(row.registered_at).toISOString(),
      referrer: row.referrer_name ? { fullName: row.referrer_name, maskedPhone: maskPhone(row.referrer_phone ?? "") } : null,
      // Chỉ khách chưa từng có người giới thiệu tự nhập được; quản trị đã bỏ người giới thiệu thì khách không tự đặt lại.
      canSetReferrer: !row.referrer_name && !row.has_history,
      isSalesStaff: row.is_sales_staff,
      ...(await this.salesPosition(userId)),
    };
  }

  async referrals(userId: string): Promise<BuyerReferralItem[]> {
    const rows = await this.database.execute<{ full_name: string; phone: string | null; registered_at: Date }>(sql`
      SELECT u.full_name, u.phone, b.registered_at FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id
      WHERE b.referrer_user_id = ${userId} ORDER BY b.registered_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({ fullName: row.full_name, maskedPhone: maskPhone(row.phone ?? ""), registeredAt: new Date(row.registered_at).toISOString() }));
  }

  // Khách chưa có người giới thiệu tự nhập mã một lần (QUYTAC_NGHIEPVU_142).
  async setReferrer(userId: string, referralCode: string, client: ClientInfo): Promise<BuyerMeResponse> {
    await this.ensureAccount(userId);
    // Báo "đã có người giới thiệu" trước khi kiểm mã; trong giao dịch kiểm lại sau khi khóa.
    const state = (await this.me(userId)).canSetReferrer;
    if (!state) throw new ApiError("BUSINESS_RULE", "referrerAlreadySet");
    await this.database.transaction(async (transaction) => {
      // Khóa cả hai tài khoản theo thứ tự: hai người cùng lúc nhập mã của nhau không tạo được vòng (rà soát CONG_VIEC_23).
      await this.lockPair(transaction, userId, await this.resolveReferrer(transaction, referralCode, userId));
      const current = (
        await transaction.execute<{ referrer_user_id: string | null; has_history: boolean }>(sql`
        SELECT referrer_user_id, EXISTS (SELECT 1 FROM marketplace.referrer_history h WHERE h.buyer_user_id = b.user_id) AS has_history
        FROM marketplace.buyer_accounts b WHERE b.user_id = ${userId} FOR UPDATE`)
      ).rows[0]!;
      if (current.referrer_user_id || current.has_history) throw new ApiError("BUSINESS_RULE", "referrerAlreadySet");
      const referrerId = await this.resolveReferrer(transaction, referralCode, userId);
      const now = this.clock.now();
      await transaction.execute(sql`
        UPDATE marketplace.buyer_accounts SET referrer_user_id = ${referrerId}, updated_at = ${now}, version = version + 1 WHERE user_id = ${userId}`);
      await transaction.execute(sql`
        INSERT INTO marketplace.referrer_history (buyer_user_id, previous_referrer_id, new_referrer_id, source, changed_by, changed_at)
        VALUES (${userId}, NULL, ${referrerId}, 'self', ${userId}, ${now})`);
      await this.audit.record(
        {
          actorUserId: userId,
          appCode: "marketplace",
          action: "buyer.referrer.self",
          entityType: "core.users",
          entityId: userId,
          afterData: { referrerId },
          ip: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        },
        transaction,
      );
    });
    return this.me(userId);
  }

  // Khách tôi phụ trách: khách mà tôi là người giới thiệu hiện tại khi tôi đang được đánh dấu nhân viên kinh doanh (QUYTAC_NGHIEPVU_145).
  async salesCustomers(userId: string): Promise<BuyerSalesCustomerItem[]> {
    await this.myTeam(userId);
    return this.customersOf(userId);
  }

  // API_122: nhánh của người quản lý (QUYTAC_NGHIEPVU_150, 151); nhân viên thấy danh sách rỗng.
  async team(userId: string): Promise<MySalesTeamResponse> {
    const team = await this.myTeam(userId);
    const members = team.branch(userId);
    const counts = await this.salesTeam.customerCounts(members.map((member) => member.userId));
    return {
      title: team.titleOf(userId)!,
      unitName: team.unit(team.member(userId)!.departmentId)?.name ?? "",
      members: members.map((member) => ({
        userId: member.userId,
        fullName: member.fullName,
        title: team.titleOf(member.userId)!,
        unitName: team.unit(member.departmentId)?.name ?? "",
        customerCount: counts.get(member.userId) ?? 0,
      })),
    };
  }

  // Khách của một cấp dưới trong nhánh, thông tin đầy đủ (quyết định của người dùng 2026-11-10); ngoài nhánh trả 404.
  async memberCustomers(userId: string, memberId: string): Promise<BuyerSalesCustomerItem[]> {
    const team = await this.myTeam(userId);
    if (!team.branch(userId).some((member) => member.userId === memberId)) throw new ApiError("NOT_FOUND", "notFound");
    return this.customersOf(memberId);
  }

  private async customersOf(userId: string): Promise<BuyerSalesCustomerItem[]> {
    const rows = await this.database.execute<{ id: string; full_name: string; phone: string | null; registered_at: Date }>(sql`
      SELECT u.id, u.full_name, u.phone, b.registered_at FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id
      WHERE b.referrer_user_id = ${userId} ORDER BY b.registered_at DESC LIMIT 1000`);
    return rows.rows.map((row) => ({ id: row.id, fullName: row.full_name, phone: localPhone(row.phone ?? ""), registeredAt: new Date(row.registered_at).toISOString() }));
  }

  // Đội của công ty mà người gọi đang thuộc; không phải thành viên đội thì 403.
  private async myTeam(userId: string): Promise<SalesTeam> {
    const row = (await this.database.execute<{ sales_company_id: string | null }>(sql`SELECT sales_company_id FROM marketplace.buyer_accounts WHERE user_id = ${userId} AND is_sales_staff`)).rows[0];
    if (!row?.sales_company_id) throw new ApiError("FORBIDDEN", "forbidden");
    return this.salesTeam.load(this.database, row.sales_company_id);
  }

  private async salesPosition(userId: string): Promise<{ salesTitle: BuyerMeResponse["salesTitle"]; salesUnitName: string | null }> {
    const row = (await this.database.execute<{ sales_company_id: string | null }>(sql`SELECT sales_company_id FROM marketplace.buyer_accounts WHERE user_id = ${userId} AND is_sales_staff`)).rows[0];
    if (!row?.sales_company_id) return { salesTitle: null, salesUnitName: null };
    const team = await this.salesTeam.load(this.database, row.sales_company_id);
    const member = team.member(userId);
    return { salesTitle: team.titleOf(userId), salesUnitName: member ? (team.unit(member.departmentId)?.name ?? null) : null };
  }

  // Mã giới thiệu là số điện thoại của tài khoản đang hoạt động; không tự giới thiệu, không chọn người mình đã giới thiệu.
  async resolveReferrer(executor: Executor, code: string, buyerUserId: string | null): Promise<string> {
    const digits = code.replace(/[\s.()-]/g, "");
    const phone = /^0\d{9}$/.test(digits) ? `+84${digits.slice(1)}` : /^\+?84\d{9}$/.test(digits) ? `+${digits.replace(/^\+/, "")}` : null;
    if (!phone) throw invalidField("referralCode", "referralCodeInvalid");
    const found = (
      await executor.execute<{ id: string; referrer_user_id: string | null }>(sql`
      SELECT u.id, b.referrer_user_id FROM core.users u LEFT JOIN marketplace.buyer_accounts b ON b.user_id = u.id
      WHERE u.phone = ${phone} AND u.status = 'active'`)
    ).rows[0];
    if (!found) throw invalidField("referralCode", "referralCodeInvalid");
    if (buyerUserId && found.id === buyerUserId) throw invalidField("referralCode", "referralSelf");
    if (buyerUserId && found.referrer_user_id === buyerUserId) throw invalidField("referralCode", "referralCycle");
    return found.id;
  }

  // Khóa dòng của hai tài khoản theo thứ tự mã để không khóa chéo.
  async lockPair(executor: Executor, first: string, second: string): Promise<void> {
    await executor.execute(sql`SELECT user_id FROM marketplace.buyer_accounts WHERE user_id IN (${first}, ${second}) ORDER BY user_id FOR UPDATE`);
  }

  // Tài khoản có sẵn (nhân viên có số điện thoại) dùng ứng dụng lần đầu thì tạo hồ sơ người mua, không có người giới thiệu.
  private async ensureAccount(userId: string): Promise<void> {
    await this.database.execute(sql`INSERT INTO marketplace.buyer_accounts (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`);
  }

  private async requirePhoneFree(phone: string): Promise<void> {
    const taken = await this.database.execute(sql`SELECT 1 FROM core.users WHERE phone = ${phone}`);
    if (taken.rows.length > 0) throw invalidField("phone", "phoneTaken");
  }
}
