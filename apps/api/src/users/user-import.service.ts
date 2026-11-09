// Nhập nhân viên từ tệp Excel theo mẫu (CHUC_NANG_05; QUYTAC_NGHIEPVU_05).
import { Inject, Injectable } from "@nestjs/common";
import { inviteUserSchema, userImportColumns, userImportMaximumBytes, userImportMaximumRows, type UserImportResponse } from "contracts";
import { sql } from "drizzle-orm";
import { messages, type Locale } from "i18n";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { ZodError } from "zod";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { InvitationsService } from "./invitations.service";

const xlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const identifierColumns = [1, 2, 3] as const;

type Cell = string | number | boolean | Date | null;

const text = (value: Cell | undefined): string => (value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim());

@Injectable()
export class UserImportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly invitationsService: InvitationsService,
  ) {}

  // API_28: tệp mẫu chỉ có dòng tiêu đề.
  async template(): Promise<Buffer> {
    return writeXlsxFile([userImportColumns.map((title) => ({ value: title, fontWeight: "bold" as const }))], { sheet: "Nhân viên" }).toBuffer();
  }

  // API_27: dòng đúng thì mời, dòng lỗi bỏ qua; sai mẫu hoặc quá 1.000 dòng thì từ chối cả tệp. Không lưu tệp gốc.
  async import(actor: Actor, file: { buffer: Buffer; size: number; originalname: string } | undefined, locale: Locale): Promise<UserImportResponse> {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > userImportMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
    let rows: Cell[][];
    try {
      rows = (await readSheet(file.buffer)) as Cell[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const header = (rows[0] ?? []).map(text);
    if (userImportColumns.some((title, index) => header[index] !== title)) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => text(cell) !== ""));
    if (dataRows.length > userImportMaximumRows) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooManyRows" } });

    const text_ = messages[locale].errors;
    const lookups = await this.lookups(actor.companyId);
    const seen = new Map<string, number>();
    const errors: { row: number; message: string; cells: string[] }[] = [];
    let invited = 0;
    for (const [index, row] of dataRows.entries()) {
      const rowNumber = index + 2;
      const cells = userImportColumns.map((_, column) => text(row[column]));
      try {
        // Trùng định danh với dòng trước trong cùng tệp thì dòng sau lỗi.
        for (const column of identifierColumns) {
          const key = `${column}:${cells[column]!.toLowerCase()}`;
          if (!cells[column]) continue;
          const earlier = seen.get(key);
          if (earlier) throw new Error(text_.duplicateInFile.replace("{row}", String(earlier)));
        }
        const branchId = cells[4] ? lookups.branches.get(cells[4].toUpperCase()) : null;
        const departmentId = cells[5] ? lookups.departments.get(cells[5].toUpperCase()) : null;
        const roleId = cells[7] ? lookups.roles.get(cells[7].toLowerCase()) : null;
        if (branchId === undefined || departmentId === undefined || roleId === undefined) throw new Error(text_.codeNotFound);
        const input = inviteUserSchema.parse({
          fullName: cells[0],
          email: cells[1] || null,
          phone: cells[2] || null,
          username: cells[3] || null,
          defaultBranchId: branchId,
          departmentId,
          jobTitle: cells[6] || null,
          roleAssignments: roleId ? [{ roleId, scopeType: branchId ? "branch" : "company", branchId, validFrom: new Date().toISOString().slice(0, 10) }] : [],
        });
        await this.invitationsService.invite(actor, input);
        invited += 1;
        for (const column of identifierColumns) if (cells[column]) seen.set(`${column}:${cells[column]!.toLowerCase()}`, rowNumber);
      } catch (error) {
        errors.push({ row: rowNumber, message: this.describe(error, locale), cells });
      }
    }
    return {
      invited,
      failed: errors.length,
      errors: errors.map(({ row, message }) => ({ row, message })),
      errorFileUrl: errors.length > 0 ? await this.errorFile(errors) : null,
    };
  }

  private describe(error: unknown, locale: Locale): string {
    const text_ = messages[locale].errors;
    if (error instanceof ApiError) {
      const fieldKeys = Object.values(error.extra.fields ?? {});
      return (fieldKeys.length > 0 ? fieldKeys.map((key) => text_[key]) : [text_[error.messageKey]]).join(" ");
    }
    if (error instanceof ZodError) return `${text_.invalidValue} (${[...new Set(error.issues.map((issue) => issue.path[0]))].join(", ")})`;
    return (error as Error).message;
  }

  // Tệp dòng lỗi trả về dạng data URL để không phải lưu tệp trên máy chủ.
  private async errorFile(errors: { row: number; message: string; cells: string[] }[]): Promise<string> {
    const header = ["Dòng", ...userImportColumns, "Lý do"].map((title) => ({ value: title, fontWeight: "bold" as const }));
    const body = errors.map((error) => [{ value: error.row }, ...error.cells.map((value) => ({ value })), { value: error.message }]);
    const buffer = await writeXlsxFile([header, ...body], { sheet: "Dòng lỗi" }).toBuffer();
    return `data:${xlsxType};base64,${buffer.toString("base64")}`;
  }

  private async lookups(companyId: string) {
    const branches = await this.database.execute<{ id: string; code: string }>(sql`SELECT id, code FROM core.branches WHERE company_id = ${companyId} AND status = 'active'`);
    const departments = await this.database.execute<{ id: string; code: string }>(sql`SELECT id, code FROM core.departments WHERE company_id = ${companyId} AND status = 'active'`);
    const roles = await this.database.execute<{ id: string; code: string }>(sql`SELECT id, code FROM core.roles WHERE status = 'active' AND (company_id IS NULL OR company_id = ${companyId}) ORDER BY company_id NULLS LAST`);
    return {
      branches: new Map(branches.rows.map((row) => [row.code.toUpperCase(), row.id])),
      departments: new Map(departments.rows.map((row) => [row.code.toUpperCase(), row.id])),
      roles: new Map(roles.rows.map((row) => [row.code.toLowerCase(), row.id])),
    };
  }
}
