// Bộ giả lập đối tác liên minh điểm (CONG_VIEC_65; QUYTAC_NGHIEPVU_550): chạy trong máy chủ, lưu thành viên giả, mã OTP (băm) trong cơ sở dữ liệu.
// Chế độ trả lời theo hợp đồng: bình thường, từ chối mọi lệnh, không trả lời (kết quả không rõ), sai lệch đối soát (dùng ở lát đối soát).
// Mã OTP ghi log như SMS_DRIVER=log để thử trên máy phát triển; không bao giờ chạy trên môi trường thật (connector.ts).
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PartnerSimulatorMode } from "contracts";
import { sql } from "drizzle-orm";
import { createHash, randomInt } from "node:crypto";
import { CLOCK, type Clock } from "../../common/clock";
import { DATABASE, type Database } from "../../database/database.module";
import { maskName } from "../smart-otp.service";
import type { ConnectorResult, PartnerConnector, PartnerContractRef } from "./connector";

const otpLifetimeMinutes = 5;
const maximumWrongCodes = 5;
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

@Injectable()
export class PartnerSimulator implements PartnerConnector {
  private readonly logger = new Logger("PartnerSimulator");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async mode(contractId: string): Promise<PartnerSimulatorMode> {
    const row = (await this.database.execute<{ mode: PartnerSimulatorMode }>(sql`SELECT mode FROM loyalty.partner_simulator_settings WHERE contract_id = ${contractId}`)).rows[0];
    return row?.mode ?? "normal";
  }

  // Chế độ từ chối, không trả lời áp cho mọi lệnh; trả kết quả tương ứng hoặc null để xử lý tiếp.
  private async interrupted<T>(contractId: string): Promise<ConnectorResult<T> | null> {
    const mode = await this.mode(contractId);
    if (mode === "reject") return { outcome: "rejected", code: "SIMULATED_REJECT" };
    if (mode === "timeout") return { outcome: "unknown", code: "SIMULATED_TIMEOUT" };
    return null;
  }

  private async member(contractId: string, memberNumber: string): Promise<{ full_name: string } | undefined> {
    return (
      await this.database.execute<{ full_name: string }>(sql`
        SELECT full_name FROM loyalty.partner_simulator_members WHERE contract_id = ${contractId} AND member_number = ${memberNumber}`)
    ).rows[0];
  }

  private async issueOtp(contractId: string, memberNumber: string, reference: string): Promise<void> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const now = this.clock.now();
    await this.database.execute(sql`
      INSERT INTO loyalty.partner_simulator_otps (reference, contract_id, member_number, code_hash, expires_at, created_at)
      VALUES (${reference}, ${contractId}, ${memberNumber}, ${hashCode(code)}, ${new Date(now.getTime() + otpLifetimeMinutes * 60_000)}, ${now})`);
    this.logger.warn(`Bộ giả lập đối tác: mã OTP cho tham chiếu ${reference}: ${code}`);
  }

  // Kiểm mã: giữ trước một lượt thử bằng một lệnh nguyên tử (như PhoneOtpService); sai 5 lần hết hiệu lực.
  private async consumeOtp(reference: string, code: string): Promise<boolean> {
    const now = this.clock.now();
    const reserved = (
      await this.database.execute<{ code_hash: string; wrong_attempts: number }>(sql`
        UPDATE loyalty.partner_simulator_otps SET wrong_attempts = wrong_attempts + 1
        WHERE reference = ${reference} AND consumed_at IS NULL AND expires_at > ${now} AND wrong_attempts < ${maximumWrongCodes}
        RETURNING code_hash, wrong_attempts`)
    ).rows[0];
    if (!reserved) return false;
    if (reserved.code_hash !== hashCode(code)) {
      if (reserved.wrong_attempts >= maximumWrongCodes) await this.database.execute(sql`UPDATE loyalty.partner_simulator_otps SET consumed_at = ${now} WHERE reference = ${reference}`);
      return false;
    }
    await this.database.execute(sql`UPDATE loyalty.partner_simulator_otps SET consumed_at = ${now} WHERE reference = ${reference}`);
    return true;
  }

  async sendLinkOtp(contract: PartnerContractRef, input: { memberNumber: string; reference: string }): Promise<ConnectorResult<null>> {
    const stopped = await this.interrupted<null>(contract.id);
    if (stopped) return stopped;
    if (!(await this.member(contract.id, input.memberNumber))) return { outcome: "rejected", code: "MEMBER_NOT_FOUND" };
    await this.issueOtp(contract.id, input.memberNumber, input.reference);
    return { outcome: "success", value: null };
  }

  async verifyLink(contract: PartnerContractRef, input: { memberNumber: string; reference: string; otp: string }): Promise<ConnectorResult<{ maskedName: string | null }>> {
    const stopped = await this.interrupted<{ maskedName: string | null }>(contract.id);
    if (stopped) return stopped;
    const member = await this.member(contract.id, input.memberNumber);
    if (!member) return { outcome: "rejected", code: "MEMBER_NOT_FOUND" };
    if (!(await this.consumeOtp(input.reference, input.otp))) return { outcome: "rejected", code: "OTP_INVALID" };
    return { outcome: "success", value: { maskedName: maskName(member.full_name) } };
  }
}
