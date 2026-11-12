// Bộ giả lập đối tác liên minh điểm (CONG_VIEC_65; QUYTAC_NGHIEPVU_550): chạy trong máy chủ, lưu thành viên giả, mã OTP (băm) trong cơ sở dữ liệu.
// Chế độ trả lời theo hợp đồng: bình thường, từ chối mọi lệnh, không trả lời (kết quả không rõ), sai lệch đối soát (dùng ở lát đối soát).
// Mã OTP ghi log như SMS_DRIVER=log để thử trên máy phát triển; không bao giờ chạy trên môi trường thật (connector.ts).
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PartnerSimulatorMode } from "contracts";
import { sql } from "drizzle-orm";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { CLOCK, type Clock } from "../../common/clock";
import { DATABASE, type Database } from "../../database/database.module";
import { maskName } from "../smart-otp.service";
import type { ConnectorResult, PartnerConnector, PartnerContractRef, PartnerTransactionState } from "./connector";

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

  private async transaction(reference: string) {
    return (
      await this.database.execute<{ kind: "credit" | "debit"; units: number; status: "pending" | "completed" | "rejected"; partner_reference: string; member_number: string; contract_id: string }>(sql`
        SELECT kind, units, status, partner_reference, member_number, contract_id FROM loyalty.partner_simulator_transactions WHERE reference = ${reference}`)
    ).rows[0];
  }

  // Chế độ "không trả lời": lệnh vẫn thực hiện ở phía đối tác nhưng VComm không nhận được kết quả (mất phản hồi), để thử hỏi lại trạng thái.
  async creditPoints(contract: PartnerContractRef, input: { memberNumber: string; units: number; reference: string }): Promise<ConnectorResult<{ partnerReference: string }>> {
    const mode = await this.mode(contract.id);
    if (mode === "reject") return { outcome: "rejected", code: "SIMULATED_REJECT" };
    const existing = await this.transaction(input.reference);
    let partnerReference = existing?.partner_reference ?? null;
    if (!existing) {
      if (!(await this.member(contract.id, input.memberNumber))) return { outcome: "rejected", code: "MEMBER_NOT_FOUND" };
      partnerReference = `SIM-${randomBytes(6).toString("hex").toUpperCase()}`;
      await this.database.transaction(async (transaction) => {
        await transaction.execute(sql`
          INSERT INTO loyalty.partner_simulator_transactions (reference, contract_id, member_number, kind, units, status, partner_reference, completed_at)
          VALUES (${input.reference}, ${contract.id}, ${input.memberNumber}, 'credit', ${input.units}, 'completed', ${partnerReference}, now())`);
        await transaction.execute(sql`
          UPDATE loyalty.partner_simulator_members SET balance_units = balance_units + ${input.units} WHERE contract_id = ${contract.id} AND member_number = ${input.memberNumber}`);
      });
    }
    if (mode === "timeout") return { outcome: "unknown", code: "SIMULATED_TIMEOUT" };
    return { outcome: "success", value: { partnerReference: partnerReference! } };
  }

  async requestDebit(contract: PartnerContractRef, input: { memberNumber: string; units: number; reference: string }): Promise<ConnectorResult<null>> {
    const stopped = await this.interrupted<null>(contract.id);
    if (stopped) return stopped;
    const member = (
      await this.database.execute<{ balance_units: number }>(sql`
        SELECT balance_units FROM loyalty.partner_simulator_members WHERE contract_id = ${contract.id} AND member_number = ${input.memberNumber}`)
    ).rows[0];
    if (!member) return { outcome: "rejected", code: "MEMBER_NOT_FOUND" };
    if (member.balance_units < input.units) return { outcome: "rejected", code: "INSUFFICIENT_BALANCE" };
    await this.database.execute(sql`
      INSERT INTO loyalty.partner_simulator_transactions (reference, contract_id, member_number, kind, units, status, partner_reference)
      VALUES (${input.reference}, ${contract.id}, ${input.memberNumber}, 'debit', ${input.units}, 'pending', ${`SIM-${randomBytes(6).toString("hex").toUpperCase()}`})`);
    await this.issueOtp(contract.id, input.memberNumber, input.reference);
    return { outcome: "success", value: null };
  }

  async confirmDebit(contract: PartnerContractRef, input: { reference: string; otp: string }): Promise<ConnectorResult<{ partnerReference: string }>> {
    const mode = await this.mode(contract.id);
    if (mode === "reject") return { outcome: "rejected", code: "SIMULATED_REJECT" };
    const pending = await this.transaction(input.reference);
    if (!pending || pending.kind !== "debit") return { outcome: "rejected", code: "NOT_FOUND" };
    if (pending.status === "pending") {
      if (!(await this.consumeOtp(input.reference, input.otp))) return { outcome: "rejected", code: "OTP_INVALID" };
      const debited = await this.database.execute(sql`
        UPDATE loyalty.partner_simulator_members SET balance_units = balance_units - ${pending.units}
        WHERE contract_id = ${contract.id} AND member_number = ${pending.member_number} AND balance_units >= ${pending.units} RETURNING member_number`);
      const status = debited.rows.length > 0 ? "completed" : "rejected";
      await this.database.execute(sql`UPDATE loyalty.partner_simulator_transactions SET status = ${status}, completed_at = now() WHERE reference = ${input.reference}`);
      if (status === "rejected") return { outcome: "rejected", code: "INSUFFICIENT_BALANCE" };
    } else if (pending.status === "rejected") {
      return { outcome: "rejected", code: "REJECTED" };
    }
    if (mode === "timeout") return { outcome: "unknown", code: "SIMULATED_TIMEOUT" };
    return { outcome: "success", value: { partnerReference: pending.partner_reference } };
  }

  // Hỏi trạng thái: chế độ "không trả lời" vẫn không trả lời; chế độ khác trả trạng thái thật của giao dịch giả.
  async status(contract: PartnerContractRef, input: { reference: string }): Promise<ConnectorResult<PartnerTransactionState>> {
    if ((await this.mode(contract.id)) === "timeout") return { outcome: "unknown", code: "SIMULATED_TIMEOUT" };
    const found = await this.transaction(input.reference);
    if (!found) return { outcome: "success", value: { state: "not_found", partnerReference: null } };
    return { outcome: "success", value: { state: found.status, partnerReference: found.status === "completed" ? found.partner_reference : null } };
  }
}
