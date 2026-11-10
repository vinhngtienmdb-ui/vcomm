// Báo cáo tài chính hợp nhất (CONG_VIEC_20; CHUC_NANG_92 đến 95; QUYTAC_NGHIEPVU_123 đến 128; API_106 đến API_109).
import { Inject, Injectable } from "@nestjs/common";
import type { AccountingRegime, ConsolidatedStatementResponse, ConsolidationMember, ConsolidationScopeResponse, consolidationPreviewQuerySchema, StatementKind } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { StatementsService, type Ledger } from "../accounting/statements.service";
import { statementTemplates } from "../accounting/statement-templates";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const consolidationPermissions = { view: "finance.consolidation.view", manage: "finance.consolidation.manage" } as const;
// Mẫu hợp nhất: B01-DN, B02-DN Thông tư 99 (quyết định của người dùng ngày 2026-11-10).
const consolidationRegime: AccountingRegime = "TT99_2025";

type MemberRow = {
  id: string;
  code: string;
  short_name: string | null;
  legal_name: string;
  accounting_regime: AccountingRegime;
  base_currency: string;
  fiscal_year_start: number;
  is_root: boolean;
  initialized: boolean;
};

@Injectable()
export class ConsolidationService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly statements: StatementsService,
  ) {}

  // Quyền hợp nhất chỉ có hiệu lực khi gán ở phạm vi tập đoàn.
  async requireGroupPermission(actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" });
    if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
    return granted;
  }

  // Tập đoàn: công ty gốc của công ty đang chọn và mọi công ty con các cấp (QUYTAC_NGHIEPVU_123).
  async members(companyId: string): Promise<MemberRow[]> {
    return (
      await this.database.execute<MemberRow>(sql`
      WITH RECURSIVE up AS (
        SELECT id, parent_id FROM core.companies WHERE id = ${companyId}
        UNION ALL SELECT c.id, c.parent_id FROM core.companies c JOIN up ON c.id = up.parent_id
      ), root AS (SELECT id FROM up WHERE parent_id IS NULL),
      down AS (
        SELECT id FROM root
        UNION ALL SELECT c.id FROM core.companies c JOIN down ON c.parent_id = down.id
      )
      SELECT c.id, c.code, c.short_name, c.legal_name, c.accounting_regime, c.base_currency, c.fiscal_year_start, c.parent_id IS NULL AS is_root,
        EXISTS (SELECT 1 FROM accounting.settings s WHERE s.company_id = c.id) AS initialized
      FROM core.companies c JOIN down ON down.id = c.id
      ORDER BY c.parent_id IS NOT NULL, c.code`)
    ).rows;
  }

  private toMember(row: MemberRow, currency: string): ConsolidationMember {
    return {
      companyId: row.id,
      code: row.code,
      name: row.short_name ?? row.legal_name,
      regime: row.accounting_regime,
      currency: row.base_currency,
      isRoot: row.is_root,
      excludedReason: row.base_currency !== currency ? "other_currency" : !row.initialized ? "ledger_not_initialized" : null,
    };
  }

  async scope(actor: Actor): Promise<ConsolidationScopeResponse> {
    const granted = await this.requireGroupPermission(actor, consolidationPermissions.view, consolidationPermissions.manage);
    const rows = await this.members(actor.companyId);
    const root = rows.find((row) => row.is_root)!;
    return {
      group: { id: root.id, name: root.short_name ?? root.legal_name },
      currency: root.base_currency,
      members: rows.map((row) => this.toMember(row, root.base_currency)),
      canManage: granted.has(consolidationPermissions.manage),
    };
  }

  // Sổ cái cộng gộp các thành viên được hợp nhất; công ty gốc (nếu được hợp nhất) đứng đầu để nhận lợi nhuận chưa phân phối.
  async ledgerOf(companyId: string): Promise<{ ledger: Ledger; root: MemberRow; included: MemberRow[]; units: number }> {
    const rows = await this.members(companyId);
    const root = rows.find((row) => row.is_root)!;
    const included = rows.filter((row) => this.toMember(row, root.base_currency).excludedReason === null);
    if (included.length === 0) throw new ApiError("BUSINESS_RULE", "consolidationNoMembers");
    // Mã tài khoản ghép theo Thông tư 99 kể cả khi chỉ một công ty được hợp nhất.
    const ledger = await this.statements.ledger(
      included.map((row) => ({ id: row.id, regime: row.accounting_regime })),
      true,
    );
    const units = Number((await this.database.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${root.id}) AS units`)).rows[0]!.units);
    return { ledger, root, included, units };
  }

  // Báo cáo hợp nhất: cột cộng gộp (không có dòng bổ sung), cột hợp nhất (có bút toán loại trừ), cột loại trừ là chênh lệch.
  async report(actor: Actor, ledger: Ledger, root: MemberRow, included: MemberRow[], units: number, kind: StatementKind, from: string, to: string): Promise<ConsolidatedStatementResponse> {
    const template = this.statements.templateOf(consolidationRegime, kind);
    const combined = await this.statements.compute(ledger, template, kind, from, to, root.fiscal_year_start, units, false);
    const consolidated = ledger.extras.length > 0 ? await this.statements.compute(ledger, template, kind, from, to, root.fiscal_year_start, units, true) : combined;
    const money = (value: number) => trimDecimal((Math.round(value * 10 ** units) / 10 ** units).toFixed(Math.max(units, 0)));
    return {
      kind,
      form: template.form,
      name: template.name,
      group: { id: root.id, name: root.short_name ?? root.legal_name },
      currency: root.base_currency,
      columns: combined.columns,
      memberNames: included.map((row) => row.short_name ?? row.legal_name),
      lines: template.lines.map((line) => {
        const before = combined.current.get(line.code) ?? 0;
        const after = consolidated.current.get(line.code) ?? 0;
        return {
          code: line.code,
          name: line.name,
          level: line.level,
          note: line.note ?? null,
          combined: money(before),
          eliminations: money(after - before),
          consolidated: money(after),
          previous: money(combined.previous.get(line.code) ?? 0),
        };
      }),
    };
  }

  // Xem trước cộng gộp (lát L0): chưa có bút toán loại trừ.
  async preview(actor: Actor, query: z.output<typeof consolidationPreviewQuerySchema>): Promise<ConsolidatedStatementResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.view, consolidationPermissions.manage);
    if (query.from > query.to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "endBeforeStart" } });
    const { ledger, root, included, units } = await this.ledgerOf(actor.companyId);
    return this.report(actor, ledger, root, included, units, query.kind, query.from, query.to);
  }
}
