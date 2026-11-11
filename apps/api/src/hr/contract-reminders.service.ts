// Nhắc hết hạn hợp đồng (CONG_VIEC_46; CHUC_NANG_164; QUYTAC_NGHIEPVU_301): việc nền `hr-contract-reminders` lúc 7 giờ giờ Việt Nam.
// Mốc: còn 30 ngày, còn 7 ngày; sau ngày kết thúc ngày thứ 1, 8, 15, 22, 29. Chạy trễ một ngày vẫn gửi mốc đang đến; mỗi mốc gửi một lần.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import { hrPermission } from "./hr-context";

type DueRow = {
  id: string;
  company_id: string;
  kind: "probation" | "fixed_term";
  document_no: string;
  employee_code: string;
  employee_name: string;
  end_date: string;
  days_to_end: number;
  department_id: string;
};

// Mốc ứng với số ngày còn lại (âm là đã quá hạn); null là không nhắc.
export function reminderMilestone(daysToEnd: number): string | null {
  if (daysToEnd > 30) return null;
  if (daysToEnd > 7) return "before_30";
  if (daysToEnd >= 0) return "before_7";
  const over = -daysToEnd;
  if (over > 35) return null;
  return `after_${Math.min(1 + 7 * Math.floor((over - 1) / 7), 29)}`;
}

@Injectable()
export class ContractRemindersService {
  private readonly logger = new Logger("HrContractReminders");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  async sendDue(): Promise<number> {
    const today = this.permissionService.today();
    // Hợp đồng còn phải xử lý: đã ký, có ngày kết thúc, hồ sơ đang làm, chưa có hợp đồng tiếp theo đã ký trong 30 ngày sau ngày kết thúc.
    const rows = await this.database.execute<DueRow>(sql`
      SELECT c.id, c.company_id, c.kind, c.document_no, e.code AS employee_code, e.full_name AS employee_name, c.end_date::text, (c.end_date - ${today}::date) AS days_to_end,
        COALESCE((SELECT a.department_id FROM hr.contract_appendices a WHERE a.contract_id = c.id AND a.status = 'signed' AND a.department_id IS NOT NULL AND a.effective_date <= ${today}::date
          ORDER BY a.effective_date DESC LIMIT 1), c.department_id) AS department_id
      FROM hr.contracts c JOIN hr.employees e ON e.id = c.employee_id
      WHERE c.status = 'signed' AND c.end_date IS NOT NULL AND e.status = 'active' AND e.termination_date IS NULL
        AND c.end_date BETWEEN ${today}::date - 35 AND ${today}::date + 30
        AND NOT EXISTS (SELECT 1 FROM hr.contracts n WHERE n.employee_id = c.employee_id AND n.id <> c.id AND n.status IN ('signed', 'terminated')
          AND n.effective_date > c.effective_date AND n.effective_date <= c.end_date + 30)`);
    let sent = 0;
    for (const row of rows.rows) {
      const milestone = reminderMilestone(row.days_to_end);
      if (!milestone) continue;
      try {
        await this.database.transaction(async (transaction) => {
          const claimed = await transaction.execute(sql`
            INSERT INTO hr.contract_reminders (company_id, contract_id, milestone, recipient_count) VALUES (${row.company_id}, ${row.id}, ${milestone}, 0)
            ON CONFLICT (contract_id, milestone) DO NOTHING RETURNING id`);
          if (claimed.rows.length === 0) return;
          // Người nhận: người có quyền quản lý hợp đồng bao trùm công ty, trưởng phòng của phòng ban hiện hành trên hợp đồng.
          const recipients = await transaction.execute<{ user_id: string }>(sql`
            SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id JOIN core.users u ON u.id = a.user_id
            WHERE rp.permission_code = ${hrPermission.contract} AND u.status = 'active' AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)
              AND (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${row.company_id}))
            UNION
            SELECT d.manager_user_id FROM core.departments d JOIN core.users u ON u.id = d.manager_user_id WHERE d.id = ${row.department_id} AND u.status = 'active'`);
          const subject = `${row.document_no} của ${row.employee_code} ${row.employee_name}`;
          const title =
            row.days_to_end >= 0
              ? `Hợp đồng ${subject} hết hạn ngày ${row.end_date.split("-").reverse().join("/")} (còn ${row.days_to_end} ngày)`
              : row.kind === "probation"
                ? `Hợp đồng thử việc ${subject} đã hết hạn ${-row.days_to_end} ngày: cần thông báo kết quả thử việc`
                : `Hợp đồng ${subject} đã hết hạn ${-row.days_to_end} ngày: còn ${Math.max(30 + row.days_to_end, 0)} ngày trước khi theo luật thành hợp đồng không xác định thời hạn`;
          await notify(
            transaction,
            recipients.rows.map((recipient) => ({
              userId: recipient.user_id,
              companyId: row.company_id,
              kind: "hr.contract.expiring",
              title,
              link: `/hr/contracts/${row.id}`,
              payload: { contractId: row.id, milestone, daysToEnd: row.days_to_end },
            })),
          );
          await transaction.execute(sql`UPDATE hr.contract_reminders SET recipient_count = ${recipients.rows.length} WHERE id = ${claimed.rows[0]!.id}`);
          sent += 1;
        });
      } catch (error) {
        this.logger.error(`Không gửi được nhắc hết hạn hợp đồng ${row.id}: ${(error as Error).message}`);
      }
    }
    return sent;
  }
}
