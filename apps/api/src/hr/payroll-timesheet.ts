// Đọc bảng công tháng của CONG_VIEC_47 cho tính lương (CONG_VIEC_48 mục 9). Tách riêng để phần tính lương không phụ thuộc chi tiết bảng của chấm công.
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import type { TimesheetFigures } from "./payroll-calculation";

type Executor = Pick<Database, "execute">;
export const PAYROLL_TIMESHEET = Symbol("PAYROLL_TIMESHEET");

export interface MonthTimesheet {
  // Kỳ đã chốt (QUYTAC_NGHIEPVU_311 của CONG_VIEC_47); chưa chốt thì chỉ tính xem trước, không gửi duyệt.
  closed: boolean;
  employees: Map<string, TimesheetFigures>;
}
export interface PayrollTimesheetReader {
  read(executor: Executor, companyId: string, month: string): Promise<MonthTimesheet | null>;
  // Đánh dấu bảng lương đã chốt kỳ công (khóa mở lại bảng công) hoặc bỏ đánh dấu.
  lock(executor: Executor, companyId: string, month: string, locked: boolean): Promise<void>;
}

// Chưa có bảng công của CONG_VIEC_47 trong cơ sở dữ liệu thì trả null: mọi dòng cảnh báo "chưa có bảng công", không gửi duyệt được.
@Injectable()
export class DatabaseTimesheetReader implements PayrollTimesheetReader {
  private async available(executor: Executor): Promise<boolean> {
    return (await executor.execute<{ found: boolean }>(sql`SELECT to_regclass('hr.timesheet_periods') IS NOT NULL AS found`)).rows[0]!.found;
  }

  async read(executor: Executor, _companyId: string, _month: string): Promise<MonthTimesheet | null> {
    if (!(await this.available(executor))) return null;
    // Cấu trúc bảng công tháng do CONG_VIEC_47 làm; đọc khi hợp nhất nhánh chấm công.
    return null;
  }

  async lock(executor: Executor, _companyId: string, _month: string, _locked: boolean): Promise<void> {
    if (!(await this.available(executor))) return;
  }
}
