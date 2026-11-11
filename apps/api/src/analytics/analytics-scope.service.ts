// Phạm vi xem báo cáo quản trị (CONG_VIEC_50; QUYTAC_NGHIEPVU_336, 339, 343; API_170).
import { Injectable } from "@nestjs/common";
import { analyticsMaximumDays, type AnalyticsCompany, type AnalyticsReportKind, type AnalyticsScopeResponse } from "contracts";
import { ApiError } from "../common/api-error";
import { ConsolidationService } from "../consolidation/consolidation.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const analyticsPermissions: Record<AnalyticsReportKind, string> = {
  sales: "analytics.sales.view",
  inventory: "analytics.inventory.view",
  debt: "analytics.debt.view",
  commission: "analytics.commission.view",
};

export interface ReportScope {
  // Công ty gốc của tập đoàn và đồng tiền dùng cho dòng tổng.
  group: AnalyticsScopeResponse["group"];
  // Công ty được chọn cho báo cáo, theo thứ tự công ty gốc trước rồi theo mã.
  companies: AnalyticsCompany[];
  // Mọi công ty của tập đoàn: xác định bán, công nợ nội bộ (QUYTAC_NGHIEPVU_338).
  groupCompanyIds: string[];
}

@Injectable()
export class AnalyticsScopeService {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly consolidation: ConsolidationService,
  ) {}

  private async group(companyId: string): Promise<{ group: ReportScope["group"]; companies: AnalyticsCompany[] }> {
    const rows = await this.consolidation.members(companyId);
    const root = rows.find((row) => row.is_root)!;
    return {
      group: { id: root.id, name: root.short_name ?? root.legal_name, currency: root.base_currency },
      companies: rows.map((row) => ({ id: row.id, code: row.code, name: row.short_name ?? row.legal_name, currency: row.base_currency, inTotal: row.base_currency === root.base_currency })),
    };
  }

  // Quyền phạm vi tập đoàn: mọi công ty của tập đoàn; phạm vi công ty: chỉ công ty đang chọn; phạm vi chi nhánh: không có hiệu lực.
  private async viewable(actor: Actor, companies: AnalyticsCompany[]): Promise<Record<AnalyticsReportKind, string[]>> {
    const groupGranted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" });
    const companyGranted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    const result = {} as Record<AnalyticsReportKind, string[]>;
    for (const [kind, permission] of Object.entries(analyticsPermissions) as [AnalyticsReportKind, string][]) {
      result[kind] = groupGranted.has(permission) ? companies.map((company) => company.id) : companyGranted.has(permission) ? [actor.companyId] : [];
    }
    return result;
  }

  async scope(actor: Actor): Promise<AnalyticsScopeResponse> {
    const { group, companies } = await this.group(actor.companyId);
    const reports = await this.viewable(actor, companies);
    const visible = new Set(Object.values(reports).flat());
    return { group, today: this.permissionService.today(), companies: companies.filter((company) => visible.has(company.id)), reports };
  }

  // Công ty của một báo cáo; yêu cầu chứa công ty ngoài phạm vi thì từ chối cả yêu cầu.
  async resolve(actor: Actor, kind: AnalyticsReportKind, requested: string[] | undefined): Promise<ReportScope> {
    const { group, companies } = await this.group(actor.companyId);
    const allowed = (await this.viewable(actor, companies))[kind];
    if (allowed.length === 0) throw new ApiError("FORBIDDEN", "forbidden");
    if (requested && requested.some((id) => !allowed.includes(id))) throw new ApiError("FORBIDDEN", "forbidden");
    const chosen = new Set(requested && requested.length > 0 ? requested : allowed);
    return { group, companies: companies.filter((company) => chosen.has(company.id)), groupCompanyIds: companies.map((company) => company.id) };
  }

  today(): string {
    return this.permissionService.today();
  }
}

// QUYTAC_NGHIEPVU_343: khoảng ngày bắt buộc, từ ngày không sau đến ngày, tối đa 366 ngày.
export function requirePeriod(from: string, to: string): number {
  // Ngày không có thật (ví dụ 2026-02-30) bị từ chối tại đúng ô thay vì lỗi cơ sở dữ liệu.
  for (const [field, value] of [
    ["from", from],
    ["to", to],
  ] as const) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "invalidValue" } });
  }
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (Number.isNaN(days)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { from: "invalidValue" } });
  if (days < 1) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "analyticsPeriodReversed" } });
  if (days > analyticsMaximumDays) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "analyticsPeriodTooLong" } });
  return days;
}
