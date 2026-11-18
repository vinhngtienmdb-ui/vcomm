// Cài đặt bán hàng và mã điểm bán (CONG_VIEC_74; MAN_HINH_302; QUYTAC_NGHIEPVU_613, 615, 619, 620; API_352). Chỉ chủ cửa hàng.
import { Inject, Injectable } from "@nestjs/common";
import type { IposSalesSettings, IposSettingsPage, iposSettingsSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { setOutletCode } from "../affiliate/merchants.service";
import type { PortalMember } from "../affiliate/portal.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { requireWritable, type Executor } from "./ipos-catalog.service";

// Mặc định khi cửa hàng chưa lưu cài đặt: thu ngân giảm tối đa 10 %, trả hàng 7 ngày, cho phép tồn âm, khổ 80 mm.
export const defaultSettings: IposSalesSettings = {
  vietqrBankBin: null,
  vietqrAccountNo: null,
  vietqrAccountName: null,
  cashierMaxDiscountPercent: "10",
  returnDays: 7,
  cashierCanReturn: false,
  blockNegativeStock: false,
  receiptFooter: null,
  paperWidth: 80,
  version: null,
};

export async function loadSettings(executor: Executor, merchantId: string): Promise<IposSalesSettings> {
  const row = (
    await executor.execute<{
      vietqr_bank_bin: string | null;
      vietqr_account_no: string | null;
      vietqr_account_name: string | null;
      cashier_max_discount_percent: string;
      return_days: number;
      cashier_can_return: boolean;
      block_negative_stock: boolean;
      receipt_footer: string | null;
      paper_width: 58 | 80;
      version: number;
    }>(sql`
      SELECT vietqr_bank_bin, vietqr_account_no, vietqr_account_name, trim_scale(cashier_max_discount_percent)::text AS cashier_max_discount_percent, return_days,
        cashier_can_return, block_negative_stock, receipt_footer, paper_width, version
      FROM ipos.settings WHERE merchant_id = ${merchantId}`)
  ).rows[0];
  if (!row) return defaultSettings;
  return {
    vietqrBankBin: row.vietqr_bank_bin,
    vietqrAccountNo: row.vietqr_account_no,
    vietqrAccountName: row.vietqr_account_name,
    cashierMaxDiscountPercent: row.cashier_max_discount_percent,
    returnDays: row.return_days,
    cashierCanReturn: row.cashier_can_return,
    blockNegativeStock: row.block_negative_stock,
    receiptFooter: row.receipt_footer,
    paperWidth: row.paper_width,
    version: row.version,
  };
}

@Injectable()
export class IposSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private record(member: PortalMember, action: string, entityType: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      { actorUserId: member.userId, companyId: member.companyId, appCode: "affiliate", action, entityType, entityId, afterData, ip: member.client.ip, userAgent: member.client.userAgent, requestId: member.client.requestId },
      executor,
    );
  }

  async page(member: PortalMember): Promise<IposSettingsPage> {
    const outlets = await this.database.execute<{ id: string; name: string; code: string | null; subscribed: boolean }>(sql`
      SELECT o.id, o.name, o.code, EXISTS (SELECT 1 FROM ipos.subscriptions s WHERE s.outlet_id = o.id AND s.status <> 'cancelled') AS subscribed
      FROM affiliate.outlets o WHERE o.merchant_id = ${member.merchantId} ORDER BY o.name`);
    return { settings: await loadSettings(this.database, member.merchantId), outlets: outlets.rows };
  }

  async save(member: PortalMember, input: z.infer<typeof iposSettingsSchema>): Promise<IposSettingsPage> {
    await this.database.transaction(async (transaction) => {
      await requireWritable(transaction, member.merchantId);
      const current = await transaction.execute<{ version: number }>(sql`SELECT version FROM ipos.settings WHERE merchant_id = ${member.merchantId} FOR UPDATE`);
      if ((current.rows[0]?.version ?? null) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        INSERT INTO ipos.settings (merchant_id, vietqr_bank_bin, vietqr_account_no, vietqr_account_name, cashier_max_discount_percent, return_days, cashier_can_return,
          block_negative_stock, receipt_footer, paper_width, updated_by)
        VALUES (${member.merchantId}, ${input.vietqrBankBin}, ${input.vietqrAccountNo}, ${input.vietqrAccountName}, ${input.cashierMaxDiscountPercent}, ${input.returnDays},
          ${input.cashierCanReturn}, ${input.blockNegativeStock}, ${input.receiptFooter}, ${input.paperWidth}, ${member.userId})
        ON CONFLICT (merchant_id) DO UPDATE SET vietqr_bank_bin = EXCLUDED.vietqr_bank_bin, vietqr_account_no = EXCLUDED.vietqr_account_no,
          vietqr_account_name = EXCLUDED.vietqr_account_name, cashier_max_discount_percent = EXCLUDED.cashier_max_discount_percent, return_days = EXCLUDED.return_days,
          cashier_can_return = EXCLUDED.cashier_can_return, block_negative_stock = EXCLUDED.block_negative_stock, receipt_footer = EXCLUDED.receipt_footer,
          paper_width = EXCLUDED.paper_width, updated_by = EXCLUDED.updated_by, updated_at = now(), version = ipos.settings.version + 1`);
      // Số tài khoản nhận tiền là dữ liệu nhạy cảm: nhật ký chỉ ghi có hay không có tài khoản.
      await this.record(
        member,
        "ipos.settings.update",
        "ipos_settings",
        member.merchantId,
        { ...input, vietqrAccountNo: input.vietqrAccountNo ? "***" : null, vietqrAccountName: input.vietqrAccountName ? "***" : null },
        transaction,
      );
    });
    return this.page(member);
  }

  async saveOutletCode(member: PortalMember, outletId: string, code: string): Promise<IposSettingsPage> {
    await this.database.transaction(async (transaction) => {
      if (!(await setOutletCode(transaction, member.merchantId, outletId, code))) throw new ApiError("BUSINESS_RULE", "iposOutletCodeTaken");
      await this.record(member, "ipos.outlet.code", "affiliate_outlet", outletId, { code }, transaction);
    });
    return this.page(member);
  }
}
