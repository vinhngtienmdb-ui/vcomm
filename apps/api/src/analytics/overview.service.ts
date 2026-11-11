// Tổng quan báo cáo quản trị (CONG_VIEC_50; CHUC_NANG_175; API_175): chỉ tiêu chính của từng nhóm báo cáo người dùng được xem.
import { Injectable } from "@nestjs/common";
import type { AnalyticsOverviewResponse, AnalyticsReportKind, analyticsOverviewQuerySchema } from "contracts";
import type { z } from "zod";
import type { Actor } from "../permissions/roles.service";
import { AnalyticsScopeService, requirePeriod } from "./analytics-scope.service";
import { CommissionReportService } from "./commission-report.service";
import { DebtReportService } from "./debt-report.service";
import { InventoryReportService } from "./inventory-report.service";
import { SalesReportService } from "./sales-report.service";

type OverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;

@Injectable()
export class OverviewService {
  constructor(
    private readonly scopeService: AnalyticsScopeService,
    private readonly sales: SalesReportService,
    private readonly inventory: InventoryReportService,
    private readonly debts: DebtReportService,
    private readonly commissions: CommissionReportService,
  ) {}

  async overview(actor: Actor, query: OverviewQuery): Promise<AnalyticsOverviewResponse> {
    requirePeriod(query.from, query.to);
    const scope = await this.scopeService.scope(actor);
    const visible = new Set(scope.companies.map((company) => company.id));
    if (query.companyIds?.some((id) => !visible.has(id))) {
      // Công ty ngoài mọi phạm vi xem: từ chối như các báo cáo khác.
      await this.scopeService.resolve(actor, "sales", query.companyIds);
    }
    // Mỗi nhóm lấy phần giao giữa công ty đã chọn và công ty được xem của nhóm đó; không còn công ty nào thì bỏ nhóm.
    const companiesOf = (kind: AnalyticsReportKind): string[] | null => {
      const allowed = scope.reports[kind];
      const chosen = query.companyIds ? query.companyIds.filter((id) => allowed.includes(id)) : allowed;
      return chosen.length > 0 ? chosen : null;
    };
    const salesCompanies = companiesOf("sales");
    const inventoryCompanies = companiesOf("inventory");
    const debtCompanies = companiesOf("debt");
    const commissionCompanies = companiesOf("commission");
    const period = { from: query.from, to: query.to, format: "json" as const };
    // Các nhóm chạy song song để tổng quan không chậm hơn báo cáo chậm nhất.
    const [sales, inventory, debt, commission] = await Promise.all([
      salesCompanies ? this.sales.report(actor, { ...period, companyIds: salesCompanies, groupBy: "company", marketplaceOnly: false }) : null,
      inventoryCompanies ? this.inventory.report(actor, { ...period, companyIds: inventoryCompanies, groupBy: "company" }) : null,
      debtCompanies ? this.debts.report(actor, { companyIds: debtCompanies, side: "receivable", groupBy: "company", format: "json" }) : null,
      commissionCompanies ? this.commissions.report(actor, { ...period, companyIds: commissionCompanies, groupBy: "share" }) : null,
    ]);
    return {
      from: query.from,
      to: query.to,
      currency: scope.group.currency,
      sales: sales && { rows: sales.rows, totals: sales.totals },
      inventory: inventory?.totals ?? null,
      debt: debt?.summary ?? null,
      commission: commission && { credited: commission.summary.credited, pending: commission.summary.pending, walletBalance: commission.summary.walletBalance },
    };
  }
}
