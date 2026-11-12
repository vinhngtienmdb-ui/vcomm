// API_253: báo cáo liên minh điểm và báo cáo gian lận theo năm, chia theo tháng giờ Việt Nam (CONG_VIEC_60; CHUC_NANG_216; QUYTAC_NGHIEPVU_478).
// Liên minh: số điểm theo sổ điểm, giá trị lô theo lô điểm, chi phí theo sổ cái (vai trò chi phí điểm), nợ nội bộ theo bảng đối soát tháng.
// Gian lận: theo vụ việc và chứng từ của vụ việc. Xuất Excel dùng chung `reportXlsx` của báo cáo quản trị (CONG_VIEC_50).
import { Inject, Injectable } from "@nestjs/common";
import type { LoyaltyAllianceReport, LoyaltyAllianceReportRow, LoyaltyFraudReport, LoyaltyFraudReportRuleRow, LoyaltyFraudReportTopItem, LoyaltySettlementStatus } from "contracts";
import { sql } from "drizzle-orm";
import { reportXlsx, type ExportTable } from "../analytics/analytics-export";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ruleNames, type FraudRuleCode } from "./fraud";
import { settlementPermissions } from "./settlements.service";
import { maskName, maskPhone } from "./smart-otp.service";

const zone = sql`'Asia/Ho_Chi_Minh'`;
const money = (value: number) => {
  const text = (Math.round(value * 10000) / 10000).toFixed(4).replace(/\.?0+$/, "");
  return text === "" || text === "-0" ? "0" : text;
};
const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
const settlementStatusNames: Record<LoyaltySettlementStatus, string> = {
  pending: "Chờ xác nhận",
  operator_confirmed: "Công ty vận hành sàn đã xác nhận",
  company_confirmed: "Công ty con đã xác nhận",
  disputed: "Khiếu nại",
  mismatched: "Không khớp",
  confirmed: "Đã xác nhận",
  partially_paid: "Đã thanh toán một phần",
  settled: "Đã tất toán",
  carried_forward: "Đã chuyển kỳ sau",
};
const topKindNames = { user: "Tài khoản", device: "Thiết bị", staff: "Thu ngân" } as const;

@Injectable()
export class LoyaltyReportsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  // Công ty vận hành sàn thấy mọi công ty; công ty con chỉ thấy dòng của mình (QUYTAC_NGHIEPVU_479).
  async alliance(actor: Actor, year: number): Promise<LoyaltyAllianceReport> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    if (!granted.has(settlementPermissions.view) && !granted.has(settlementPermissions.manage)) throw new ApiError("FORBIDDEN", "forbidden");
    const operator = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator`)).rows[0]?.id ?? null;
    const isOperator = operator === actor.companyId;
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;
    const scope = (column: ReturnType<typeof sql.raw>) => (isOperator ? sql`TRUE` : sql`${column} = ${actor.companyId}`);
    const rows = await this.database.execute<{
      month: string;
      company_id: string;
      company_name: string;
      earned_points: string;
      lot_value: string;
      cost_amount: string;
      redeemed_points: string;
      redeemed_amount: string;
      settlement_id: string | null;
      settlement_no: string | null;
      settlement_status: LoyaltySettlementStatus | null;
      receivable_movement: string | null;
      payable_movement: string | null;
      offset_amount: string | null;
      paid_amount: string | null;
      net_closing: string | null;
    }>(sql`
      WITH entries AS (
        SELECT to_char(e.created_at AT TIME ZONE ${zone}, 'YYYY-MM') AS month, e.company_id,
          sum(CASE WHEN e.kind = 'earn' THEN e.points ELSE 0 END) AS earned_points,
          sum(CASE WHEN e.kind = 'redeem' THEN -e.points WHEN e.kind = 'redeem_refund' THEN -e.points ELSE 0 END) AS redeemed_points,
          sum(CASE WHEN e.kind = 'redeem' THEN e.amount WHEN e.kind = 'redeem_refund' THEN -e.amount ELSE 0 END) AS redeemed_amount
        FROM loyalty.entries e
        WHERE e.company_id IS NOT NULL AND e.kind IN ('earn', 'redeem', 'redeem_refund') AND ${scope(sql.raw("e.company_id"))}
          AND e.created_at >= (${from}::date AT TIME ZONE ${zone}) AND e.created_at < (${to}::date AT TIME ZONE ${zone})
        GROUP BY 1, 2),
      lots AS (
        SELECT to_char(l.earned_on, 'YYYY-MM') AS month, l.company_id, sum(l.points * l.point_value) AS lot_value
        FROM loyalty.lots l WHERE l.earned_on >= ${from}::date AND l.earned_on < ${to}::date AND ${scope(sql.raw("l.company_id"))}
        GROUP BY 1, 2),
      costs AS (
        SELECT to_char(j.journal_date, 'YYYY-MM') AS month, j.company_id, sum(jl.debit - jl.credit) AS cost_amount
        FROM accounting.journals j JOIN accounting.journal_lines jl ON jl.journal_id = j.id
        JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = jl.account_id AND r.role = 'loyalty_expense'
        WHERE j.status = 'posted' AND j.source_type IN ('loyalty_entry', 'loyalty_seller_entry') AND j.journal_date >= ${from}::date AND j.journal_date < ${to}::date
          AND ${scope(sql.raw("j.company_id"))}
        GROUP BY 1, 2),
      settlements AS (
        SELECT to_char(s.period, 'YYYY-MM') AS month, s.company_id, s.id, s.document_no, s.status, s.receivable_movement, s.payable_movement, s.offset_amount, s.paid_amount,
          s.net_closing
        FROM loyalty.settlements s WHERE s.period >= ${from}::date AND s.period < ${to}::date AND ${scope(sql.raw("s.company_id"))}),
      keys AS (SELECT month, company_id FROM entries UNION SELECT month, company_id FROM lots UNION SELECT month, company_id FROM costs UNION SELECT month, company_id FROM settlements)
      SELECT k.month, k.company_id, c.short_name AS company_name, coalesce(en.earned_points, 0)::text AS earned_points, coalesce(lo.lot_value, 0)::text AS lot_value,
        coalesce(co.cost_amount, 0)::text AS cost_amount, coalesce(en.redeemed_points, 0)::text AS redeemed_points, coalesce(en.redeemed_amount, 0)::text AS redeemed_amount,
        st.id AS settlement_id, st.document_no AS settlement_no, st.status AS settlement_status, st.receivable_movement::text, st.payable_movement::text,
        st.offset_amount::text, st.paid_amount::text, st.net_closing::text
      FROM keys k JOIN core.companies c ON c.id = k.company_id
      LEFT JOIN entries en ON en.month = k.month AND en.company_id = k.company_id
      LEFT JOIN lots lo ON lo.month = k.month AND lo.company_id = k.company_id
      LEFT JOIN costs co ON co.month = k.month AND co.company_id = k.company_id
      LEFT JOIN settlements st ON st.month = k.month AND st.company_id = k.company_id
      ORDER BY k.month DESC, c.is_marketplace_operator DESC, c.short_name`);
    return {
      year,
      isOperator,
      rows: rows.rows.map((row): LoyaltyAllianceReportRow => {
        const settled = row.settlement_id !== null;
        const outstanding = Math.abs(Number(row.net_closing ?? 0));
        return {
          month: row.month,
          companyId: row.company_id,
          companyName: row.company_name,
          isOperator: row.company_id === operator,
          earnedPoints: Number(row.earned_points),
          lotValue: money(Number(row.lot_value)),
          costAmount: money(Number(row.cost_amount)),
          redeemedPoints: Number(row.redeemed_points),
          redeemedAmount: money(Number(row.redeemed_amount)),
          settlementId: row.settlement_id,
          settlementNo: row.settlement_no,
          settlementStatus: row.settlement_status,
          receivable: settled ? money(Number(row.receivable_movement)) : null,
          payable: settled ? money(Number(row.payable_movement)) : null,
          offset: settled ? money(Number(row.offset_amount)) : null,
          paid: settled ? money(Number(row.paid_amount)) : null,
          // Số còn phải thanh toán theo bảng: số thuần cuối kỳ trừ số bên trả đã ghi sổ; bảng đã chuyển kỳ sau: số còn lại nằm ở bảng kỳ sau.
          remaining: settled ? money(row.settlement_status === "carried_forward" ? 0 : Math.max(outstanding - Number(row.paid_amount), 0)) : null,
        };
      }),
    };
  }

  async allianceXlsx(actor: Actor, year: number): Promise<Buffer> {
    const report = await this.alliance(actor, year);
    const table: ExportTable = {
      title: `Báo cáo liên minh điểm năm ${year}`,
      notes: ["Đơn vị tiền: đồng. Nợ nội bộ theo bảng đối soát điểm nội bộ của tháng; công ty vận hành sàn không có dòng nợ nội bộ."],
      columns: [
        { title: "Tháng" },
        { title: "Công ty" },
        { title: "Điểm tích", numeric: true },
        { title: "Giá trị lô", numeric: true },
        { title: "Chi phí điểm ghi nhận", numeric: true },
        { title: "Điểm dùng", numeric: true },
        { title: "Tiền điểm", numeric: true },
        { title: "Phải thu", numeric: true },
        { title: "Phải trả", numeric: true },
        { title: "Đã bù trừ", numeric: true },
        { title: "Đã thanh toán", numeric: true },
        { title: "Còn lại", numeric: true },
        { title: "Bảng đối soát" },
        { title: "Trạng thái" },
      ],
      rows: report.rows.map((row) => [
        monthLabel(row.month),
        row.companyName,
        row.earnedPoints,
        row.lotValue,
        row.costAmount,
        row.redeemedPoints,
        row.redeemedAmount,
        row.receivable,
        row.payable,
        row.offset,
        row.paid,
        row.remaining,
        row.settlementNo,
        row.settlementStatus ? settlementStatusNames[row.settlementStatus] : null,
      ]),
    };
    return reportXlsx([table]);
  }

  // Quyền: loyalty.view tại công ty vận hành sàn (kiểm ở bộ điều khiển).
  async fraud(year: number): Promise<LoyaltyFraudReport> {
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;
    const rules = await this.database.execute<{
      month: string;
      rule_code: FraudRuleCode;
      cases: number;
      alert: number;
      block: number;
      block_and_lock: number;
      violation: number;
      no_violation: number;
      blocked_transactions: number;
      skipped_earns: number;
      skipped_points: number;
      locked_wallets: number;
    }>(sql`
      WITH cases AS (
        SELECT to_char(f.case_day, 'YYYY-MM') AS month, f.rule_code, count(*)::int AS cases,
          count(*) FILTER (WHERE f.action = 'alert')::int AS alert, count(*) FILTER (WHERE f.action = 'block')::int AS block,
          count(*) FILTER (WHERE f.action = 'block_and_lock')::int AS block_and_lock,
          count(*) FILTER (WHERE f.status = 'violation')::int AS violation, count(*) FILTER (WHERE f.status = 'no_violation')::int AS no_violation
        FROM loyalty.fraud_cases f WHERE f.case_day >= ${from}::date AND f.case_day < ${to}::date GROUP BY 1, 2),
      effects AS (
        SELECT to_char(d.created_at AT TIME ZONE ${zone}, 'YYYY-MM') AS month, f.rule_code,
          count(*) FILTER (WHERE d.effect = 'blocked_redeem')::int AS blocked_transactions, count(*) FILTER (WHERE d.effect = 'skipped_earn')::int AS skipped_earns,
          coalesce(sum(dp.expected_points) FILTER (WHERE d.effect = 'skipped_earn'), 0)::int AS skipped_points,
          count(DISTINCT d.user_id) FILTER (WHERE d.effect = 'locked')::int AS locked_wallets
        FROM loyalty.fraud_case_documents d JOIN loyalty.fraud_cases f ON f.id = d.case_id
        LEFT JOIN loyalty.document_points dp ON dp.source_type = d.source_type AND dp.source_id = d.source_id AND dp.skip_reason = 'fraud_rule'
        WHERE d.created_at >= (${from}::date AT TIME ZONE ${zone}) AND d.created_at < (${to}::date AT TIME ZONE ${zone}) GROUP BY 1, 2),
      keys AS (SELECT month, rule_code FROM cases UNION SELECT month, rule_code FROM effects)
      SELECT k.month, k.rule_code, coalesce(c.cases, 0) AS cases, coalesce(c.alert, 0) AS alert, coalesce(c.block, 0) AS block, coalesce(c.block_and_lock, 0) AS block_and_lock,
        coalesce(c.violation, 0) AS violation, coalesce(c.no_violation, 0) AS no_violation, coalesce(e.blocked_transactions, 0) AS blocked_transactions,
        coalesce(e.skipped_earns, 0) AS skipped_earns, coalesce(e.skipped_points, 0) AS skipped_points, coalesce(e.locked_wallets, 0) AS locked_wallets
      FROM keys k LEFT JOIN cases c ON c.month = k.month AND c.rule_code = k.rule_code LEFT JOIN effects e ON e.month = k.month AND e.rule_code = k.rule_code
      ORDER BY k.month DESC, array_position(ARRAY['shared_device', 'redeem_burst', 'earn_return', 'staff_anomaly'], k.rule_code)`);
    // Mười đối tượng nhiều vụ việc nhất mỗi tháng theo từng loại (tài khoản, thiết bị, thu ngân).
    const top = await this.database.execute<{
      month: string;
      kind: "user" | "device" | "staff";
      user_name: string | null;
      user_phone: string | null;
      device_hash: string | null;
      staff_name: string | null;
      cases: number;
    }>(sql`
      SELECT month, kind, user_name, user_phone, device_hash, staff_name, cases FROM (
        SELECT g.*, row_number() OVER (PARTITION BY g.month, g.kind ORDER BY g.cases DESC, g.subject) AS rank FROM (
          SELECT to_char(f.case_day, 'YYYY-MM') AS month, f.subject_kind AS kind, f.subject_key AS subject, count(*)::int AS cases,
            max(u.full_name) AS user_name, max(u.phone) AS user_phone, max(f.device_hash) AS device_hash, max(st.full_name) AS staff_name
          FROM loyalty.fraud_cases f LEFT JOIN core.users u ON f.subject_kind = 'user' AND u.id = f.user_id
          LEFT JOIN core.users st ON f.subject_kind = 'staff' AND st.id = f.staff_user_id
          WHERE f.case_day >= ${from}::date AND f.case_day < ${to}::date GROUP BY 1, 2, 3) g) ranked
      WHERE rank <= 10 ORDER BY month DESC, array_position(ARRAY['user', 'device', 'staff'], kind), cases DESC`);
    return {
      year,
      rules: rules.rows.map(
        (row): LoyaltyFraudReportRuleRow => ({
          month: row.month,
          ruleCode: row.rule_code,
          cases: row.cases,
          alert: row.alert,
          block: row.block,
          blockAndLock: row.block_and_lock,
          violation: row.violation,
          noViolation: row.no_violation,
          blockedTransactions: row.blocked_transactions,
          skippedEarns: row.skipped_earns,
          skippedPoints: row.skipped_points,
          lockedWallets: row.locked_wallets,
        }),
      ),
      top: top.rows.map(
        (row): LoyaltyFraudReportTopItem => ({
          month: row.month,
          kind: row.kind,
          label:
            row.kind === "user"
              ? [row.user_name ? maskName(row.user_name) : null, row.user_phone ? maskPhone(row.user_phone) : null].filter(Boolean).join(" · ")
              : row.kind === "device"
                ? (row.device_hash ?? "").slice(0, 8)
                : (row.staff_name ?? ""),
          cases: row.cases,
        }),
      ),
    };
  }

  async fraudXlsx(year: number): Promise<Buffer> {
    const report = await this.fraud(year);
    return reportXlsx([
      {
        title: `Báo cáo gian lận điểm năm ${year}`,
        notes: ["Vụ việc theo ngày bắt; giao dịch bị chặn, điểm không tích, ví tự khóa theo thời điểm áp dụng."],
        columns: [
          { title: "Tháng" },
          { title: "Quy tắc" },
          { title: "Vụ việc", numeric: true },
          { title: "Cảnh báo", numeric: true },
          { title: "Chặn", numeric: true },
          { title: "Chặn và khóa", numeric: true },
          { title: "Vi phạm", numeric: true },
          { title: "Không vi phạm", numeric: true },
          { title: "Giao dịch bị chặn", numeric: true },
          { title: "Chứng từ không tích", numeric: true },
          { title: "Điểm không tích", numeric: true },
          { title: "Ví tự khóa", numeric: true },
        ],
        rows: report.rules.map((row) => [
          monthLabel(row.month),
          ruleNames[row.ruleCode],
          row.cases,
          row.alert,
          row.block,
          row.blockAndLock,
          row.violation,
          row.noViolation,
          row.blockedTransactions,
          row.skippedEarns,
          row.skippedPoints,
          row.lockedWallets,
        ]),
      },
      {
        title: "Nhiều vụ việc nhất",
        notes: ["Mười tài khoản, thiết bị (8 ký tự đầu mã băm), thu ngân có nhiều vụ việc nhất mỗi tháng."],
        columns: [{ title: "Tháng" }, { title: "Loại" }, { title: "Đối tượng" }, { title: "Vụ việc", numeric: true }],
        rows: report.top.map((row) => [monthLabel(row.month), topKindNames[row.kind], row.label, row.cases]),
      },
    ]);
  }
}
