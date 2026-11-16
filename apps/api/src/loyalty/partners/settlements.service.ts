// Bảng đối soát tháng với đối tác liên minh điểm (CONG_VIEC_65; CHUC_NANG_239; QUYTAC_NGHIEPVU_547 đến 549; API_305).
// Giao dịch thuộc bảng theo tháng hoàn tất (giờ Việt Nam); chỉ gắn `settlement_id` khi xác nhận, nên bảng chưa xác nhận lập lại được và
// giao dịch của nó vẫn tính là phát sinh chưa chốt (QUYTAC_NGHIEPVU_546). Đối chiếu gọi lớp kết nối lấy số liệu tháng của đối tác.
// Xác nhận: bù trừ Nợ 331 / Có 131, số còn lại ghi một khoản công nợ và khớp ngay với tiền đối tác đã nộp (như CONG_VIEC_55).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  PageResponse,
  PartnerSettlementDetail,
  PartnerSettlementItem,
  PartnerSettlementLine,
  PartnerSettlementLineKind,
  PartnerSettlementMismatch,
  PartnerSettlementStatus,
  PartnerSettlementTotals,
  partnerSettlementConfirmSchema,
  partnerSettlementListQuerySchema,
} from "contracts";
import { type SQL, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { z } from "zod";
import { LedgerService } from "../../accounting/ledger.service";
import { trimDecimal } from "../../catalog/catalog-context";
import { ApiError } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../../common/file-storage";
import { DATABASE, type Database } from "../../database/database.module";
import { DebtsService } from "../../finance/debts.service";
import { PaymentsService } from "../../finance/payments.service";
import type { BuyerAdminActor } from "../../marketplace/buyer-admin.service";
import { vietnamToday } from "../../marketplace/shop.service";
import { NumberSequencesService, periodKey } from "../../settings/number-sequences.service";
import { maskName } from "../smart-otp.service";
import { type PartnerStatementLine, PartnerConnectors } from "./connector";
import { settlementDraft } from "./postings";

type Executor = Pick<Database, "execute">;
type Transactional = Executor & Pick<Database, "insert">;

const documentType = "loyalty.partner_settlement";
const openStatuses: PartnerSettlementStatus[] = ["unreconciled", "mismatched", "matched"];
export const settlementFileMaximumBytes = 10 * 1024 * 1024;
const fileKinds = [
  { extension: "pdf", type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  { extension: "jpg", type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { extension: "jpeg", type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { extension: "png", type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
];
export type SettlementFile = { buffer: Buffer; size: number; originalname: string };

type LineRow = {
  kind: PartnerSettlementLineKind;
  id: string;
  day: string;
  document_no: string;
  reference: string;
  partner_transaction_code: string | null;
  full_name: string;
  points: number;
  units: number | null;
  amount: string;
};

type Figures = {
  lines: LineRow[];
  totals: Record<PartnerSettlementLineKind, { count: number; points: number; units: number; amount: number }>;
  receivable: number;
  payable: number;
  offset: number;
  net: number;
  digest: string;
};

type ContractInfo = { id: string; code: string; company_id: string; partner_id: string; connector: "simulator"; payment_term_days: number };

// Tháng của giao dịch theo giờ Việt Nam.
const inPeriod = (column: SQL, period: string) =>
  sql`(${column} AT TIME ZONE 'Asia/Ho_Chi_Minh') >= ${period}::date AND (${column} AT TIME ZONE 'Asia/Ho_Chi_Minh') < ${period}::date + interval '1 month'`;

// Giao dịch của bảng: đã xác nhận thì theo settlement_id; chưa xác nhận thì giao dịch hoàn tất trong tháng chưa vào bảng nào.
function lineQuery(contractId: string, period: string, settlementId: string | null): SQL {
  const exchangeScope = settlementId ? sql`x.settlement_id = ${settlementId}` : sql`x.settlement_id IS NULL AND x.status = 'completed' AND ${inPeriod(sql`x.completed_at`, period)}`;
  const giftScope = settlementId ? sql`g.settlement_id = ${settlementId}` : sql`g.settlement_id IS NULL AND g.status = 'completed' AND ${inPeriod(sql`g.created_at`, period)}`;
  // Tiền theo đúng số đã hạch toán: làm tròn đến đồng từng giao dịch (postings.ts).
  return sql`
    SELECT x.direction AS kind, x.id, (x.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day, x.document_no, x.reference, NULL::text AS partner_transaction_code,
      u.full_name, x.vcomm_points AS points, x.partner_units AS units,
      (round(x.amount) + CASE WHEN x.direction = 'inbound' THEN round(x.tax_amount) ELSE 0 END)::text AS amount
    FROM loyalty.partner_exchanges x JOIN core.users u ON u.id = x.user_id WHERE x.contract_id = ${contractId} AND ${exchangeScope}
    UNION ALL
    SELECT 'gift', g.id, (g.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text, g.document_no, g.partner_transaction_code, g.partner_transaction_code, u.full_name, g.points, NULL::int,
      (round(g.amount) + round(g.tax_amount))::text
    FROM loyalty.partner_gifts g JOIN core.users u ON u.id = g.user_id WHERE g.contract_id = ${contractId} AND ${giftScope}
    ORDER BY 3 DESC, 4 DESC`;
}

@Injectable()
export class PartnerSettlementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly connectors: PartnerConnectors,
    private readonly sequences: NumberSequencesService,
    private readonly debts: DebtsService,
    private readonly payments: PaymentsService,
    private readonly accounting: LedgerService,
    private readonly audit: AuditService,
  ) {}

  // Phiếu thu, phiếu chi trừ hết công nợ của bảng: chuyển Đã thanh toán trong cùng giao dịch.
  onModuleInit(): void {
    this.payments.postedHooks.push((transaction) => this.refreshPaid(transaction));
  }

  async refreshPaid(executor: Executor): Promise<void> {
    await executor.execute(sql`
      UPDATE loyalty.partner_settlements s SET status = 'paid', paid_at = now(), updated_at = now(), version = s.version + 1
      FROM finance.debt_items d WHERE d.id = s.debt_item_id AND s.status = 'confirmed' AND d.open_amount = 0`);
  }

  private async contract(executor: Executor, contractId: string): Promise<ContractInfo> {
    return (
      await executor.execute<ContractInfo>(sql`
        SELECT id, code, company_id, partner_id, connector, payment_term_days FROM loyalty.partner_contracts WHERE id = ${contractId}`)
    ).rows[0]!;
  }

  private async figures(executor: Executor, contractId: string, period: string, settlementId: string | null): Promise<Figures> {
    const lines = (await executor.execute<LineRow>(lineQuery(contractId, period, settlementId))).rows.map((row) => ({
      ...row,
      points: Number(row.points),
      units: row.units === null ? null : Number(row.units),
    }));
    const totals = { gift: { count: 0, points: 0, units: 0, amount: 0 }, inbound: { count: 0, points: 0, units: 0, amount: 0 }, outbound: { count: 0, points: 0, units: 0, amount: 0 } };
    for (const line of lines) {
      const total = totals[line.kind];
      total.count += 1;
      total.points += line.points;
      total.units += line.units ?? 0;
      total.amount += Number(line.amount);
    }
    const receivable = totals.gift.amount + totals.inbound.amount;
    const payable = totals.outbound.amount;
    const ids = lines.map((line) => `${line.kind}:${line.id}:${line.amount}`).sort();
    return {
      lines,
      totals,
      receivable,
      payable,
      offset: Math.min(receivable, payable),
      net: receivable - payable,
      digest: createHash("sha256").update(ids.join("|")).digest("hex"),
    };
  }

  // So từng giao dịch với số liệu đối tác (QUYTAC_NGHIEPVU_548): đổi ra, đổi vào theo mã tham chiếu VComm, tặng theo mã giao dịch đối tác.
  private compare(lines: LineRow[], statement: PartnerStatementLine[]): PartnerSettlementMismatch[] {
    const kindOf = { outbound: "credit", inbound: "debit", gift: "gift" } as const;
    const lineKindOf = { credit: "outbound", debit: "inbound", gift: "gift" } as const;
    const partner = new Map(statement.map((item) => [`${item.kind}:${item.reference}`, item]));
    const mismatches: PartnerSettlementMismatch[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const key = `${kindOf[line.kind]}:${line.reference}`;
      seen.add(key);
      const found = partner.get(key);
      const ours = line.kind === "gift" ? `${line.points}` : `${line.units}`;
      const base = { lineKind: line.kind, reference: line.reference, documentNo: line.document_no };
      if (!found) mismatches.push({ ...base, kind: "missing_partner", vcomm: ours, partner: null });
      else if (found.status !== "completed") mismatches.push({ ...base, kind: "status", vcomm: "completed", partner: found.status });
      else if (line.kind === "gift" && found.points !== line.points) mismatches.push({ ...base, kind: "points", vcomm: ours, partner: String(found.points) });
      else if (line.kind !== "gift" && found.units !== line.units) mismatches.push({ ...base, kind: "units", vcomm: ours, partner: String(found.units) });
    }
    for (const item of statement) {
      if (item.status !== "completed" || seen.has(`${item.kind}:${item.reference}`)) continue;
      mismatches.push({
        kind: "missing_vcomm",
        lineKind: lineKindOf[item.kind],
        reference: item.reference,
        documentNo: null,
        vcomm: null,
        partner: String(item.kind === "gift" ? item.points : item.units),
      });
    }
    return mismatches;
  }

  private async reconcile(contract: ContractInfo, period: string, lines: LineRow[]): Promise<{ status: PartnerSettlementStatus; mismatches: PartnerSettlementMismatch[]; error: string | null }> {
    let result;
    try {
      result = await this.connectors.of(contract).statement(contract, { period: period.slice(0, 7) });
    } catch (error) {
      if (error instanceof ApiError) return { status: "unreconciled", mismatches: [], error: "connector_unavailable" };
      throw error;
    }
    if (result.outcome !== "success") return { status: "unreconciled", mismatches: [], error: `${result.outcome}:${result.code}`.slice(0, 200) };
    const mismatches = this.compare(lines, result.value);
    return { status: mismatches.length > 0 ? "mismatched" : "matched", mismatches, error: null };
  }

  // Dãy số bảng đối soát của công ty vận hành sàn (tiền tố DM, đặt lại theo năm) khi chưa cấu hình.
  private async ensureSequence(executor: Executor, companyId: string): Promise<void> {
    const today = await vietnamToday(executor);
    await executor.execute(sql`
      INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
      SELECT ${companyId}, ${documentType}, ${periodKey("year", today)}, 'DM', 'year', 6, 1
      WHERE NOT EXISTS (SELECT 1 FROM core.number_sequences WHERE company_id = ${companyId} AND document_type_code = ${documentType})`);
  }

  // Lập hoặc lập lại bảng tháng `period` (ngày đầu tháng) của hợp đồng; bảng đã xác nhận không lập lại.
  async build(contractId: string, period: string, actorId: string | null): Promise<string | null> {
    const contract = await this.contract(this.database, contractId);
    const preview = await this.figures(this.database, contractId, period, null);
    // Gọi đối tác ngoài giao dịch cơ sở dữ liệu; trong giao dịch lập lại số liệu, khác lúc gọi thì đối chiếu lại một lần nữa.
    let reconciled = await this.reconcile(contract, period, preview.lines);
    return this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`partner-settlement:${contractId}:${period}`}))`);
      const existing = (
        await transaction.execute<{ id: string; status: PartnerSettlementStatus }>(sql`
          SELECT id, status FROM loyalty.partner_settlements WHERE contract_id = ${contractId} AND period = ${period}::date FOR UPDATE`)
      ).rows[0];
      if (existing && !openStatuses.includes(existing.status)) throw new ApiError("BUSINESS_RULE", "partnerSettlementClosed");
      const figures = await this.figures(transaction, contractId, period, null);
      if (!existing && figures.lines.length === 0) return null;
      if (figures.digest !== preview.digest) reconciled = await this.reconcile(contract, period, figures.lines);
      const values = sql`gift_count = ${figures.totals.gift.count}, gift_points = ${figures.totals.gift.points}, gift_amount = ${figures.totals.gift.amount},
        inbound_count = ${figures.totals.inbound.count}, inbound_points = ${figures.totals.inbound.points}, inbound_units = ${figures.totals.inbound.units},
        inbound_amount = ${figures.totals.inbound.amount}, outbound_count = ${figures.totals.outbound.count}, outbound_points = ${figures.totals.outbound.points},
        outbound_units = ${figures.totals.outbound.units}, outbound_amount = ${figures.totals.outbound.amount}, receivable_amount = ${figures.receivable},
        payable_amount = ${figures.payable}, offset_amount = ${figures.offset}, net_amount = ${figures.net}, status = ${reconciled.status},
        mismatches = ${JSON.stringify(reconciled.mismatches)}::jsonb, reconcile_error = ${reconciled.error}, lines_digest = ${figures.digest}, built_at = now(), updated_at = now()`;
      let id: string;
      if (existing) {
        await transaction.execute(sql`UPDATE loyalty.partner_settlements SET ${values}, version = version + 1 WHERE id = ${existing.id}`);
        id = existing.id;
      } else {
        await this.ensureSequence(transaction, contract.company_id);
        const documentNo = await this.sequences.next(contract.company_id, documentType, transaction);
        id = (
          await transaction.execute<{ id: string }>(sql`
            INSERT INTO loyalty.partner_settlements (document_no, company_id, contract_id, period, status) VALUES (${documentNo}, ${contract.company_id}, ${contractId}, ${period}::date, ${reconciled.status})
            RETURNING id`)
        ).rows[0]!.id;
        await transaction.execute(sql`UPDATE loyalty.partner_settlements SET ${values} WHERE id = ${id}`);
      }
      await this.audit.record(
        {
          actorUserId: actorId,
          companyId: contract.company_id,
          appCode: "crm",
          action: existing ? "loyalty_partner_settlement.rebuild" : "loyalty_partner_settlement.create",
          entityType: "loyalty_partner_settlement",
          entityId: id,
          afterData: { period, status: reconciled.status, receivable: figures.receivable, payable: figures.payable, mismatches: reconciled.mismatches.length },
        },
        transaction,
      );
      return id;
    });
  }

  // Việc nền 3 giờ ngày 1 hằng tháng (giờ Việt Nam): lập bảng tháng trước cho mỗi đối tác có giao dịch hoàn tất trong tháng.
  async generateMonthly(today?: string): Promise<string[]> {
    const day = today ?? (await vietnamToday(this.database));
    const period = (await this.database.execute<{ value: string }>(sql`SELECT (date_trunc('month', ${day}::date) - interval '1 month')::date::text AS value`)).rows[0]!.value;
    const contracts = await this.database.execute<{ contract_id: string }>(sql`
      SELECT contract_id FROM loyalty.partner_exchanges x WHERE x.settlement_id IS NULL AND x.status = 'completed' AND ${inPeriod(sql`x.completed_at`, period)}
      UNION
      SELECT contract_id FROM loyalty.partner_gifts g WHERE g.settlement_id IS NULL AND g.status = 'completed' AND ${inPeriod(sql`g.created_at`, period)}`);
    const created: string[] = [];
    for (const row of contracts.rows) {
      const exists = await this.database.execute(sql`SELECT 1 FROM loyalty.partner_settlements WHERE contract_id = ${row.contract_id} AND period = ${period}::date`);
      if (exists.rows.length > 0) continue;
      const id = await this.build(row.contract_id, period, null);
      if (id) created.push(id);
    }
    return created;
  }

  private itemOf(row: SettlementRow): PartnerSettlementItem {
    return {
      id: row.id,
      documentNo: row.document_no,
      contractId: row.contract_id,
      contractCode: row.contract_code,
      partnerName: row.partner_name,
      unitNameVi: row.unit_name_vi,
      period: row.period.slice(0, 7),
      receivableAmount: trimDecimal(row.receivable_amount),
      payableAmount: trimDecimal(row.payable_amount),
      offsetAmount: trimDecimal(row.offset_amount),
      netAmount: trimDecimal(row.net_amount),
      status: row.status,
      mismatchCount: row.mismatch_count,
      dueDate: row.due_date,
      overdue: row.overdue,
      version: row.version,
    };
  }

  async list(actor: BuyerAdminActor, query: z.output<typeof partnerSettlementListQuerySchema>): Promise<PageResponse<PartnerSettlementItem>> {
    const conditions: SQL[] = [sql`s.company_id = ${actor.operatorCompanyId}`];
    if (query.contractId) conditions.push(sql`s.contract_id = ${query.contractId}`);
    if (query.status) conditions.push(sql`s.status = ${query.status}`);
    if (query.period) conditions.push(sql`s.period = ${`${query.period}-01`}::date`);
    const where = sql.join(conditions, sql` AND `);
    const today = await vietnamToday(this.database);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM loyalty.partner_settlements s WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<SettlementRow>(sql`
      ${settlementSelect(today)} WHERE ${where} ORDER BY s.period DESC, s.document_no DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.itemOf(row)), page: query.page, pageSize: query.pageSize, total };
  }

  private async row(executor: Executor, actor: BuyerAdminActor, id: string, lock = false): Promise<SettlementRow> {
    const today = await vietnamToday(executor);
    if (lock) await executor.execute(sql`SELECT 1 FROM loyalty.partner_settlements WHERE id = ${id} AND company_id = ${actor.operatorCompanyId} FOR UPDATE`);
    const row = (await executor.execute<SettlementRow>(sql`${settlementSelect(today)} WHERE s.id = ${id} AND s.company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async detail(actor: BuyerAdminActor, id: string, canManage: boolean): Promise<PartnerSettlementDetail> {
    const row = await this.row(this.database, actor, id);
    const confirmed = row.status === "confirmed" || row.status === "paid";
    const lines = (await this.figures(this.database, row.contract_id, row.period, confirmed ? id : null)).lines;
    const totals = (count: number, points: string, units: string | null, amount: string): PartnerSettlementTotals => ({
      count,
      points: Number(points),
      units: units === null ? null : Number(units),
      amount: trimDecimal(amount),
    });
    const lineOf = (line: LineRow): PartnerSettlementLine => ({
      kind: line.kind,
      id: line.id,
      date: line.day,
      documentNo: line.document_no,
      reference: line.reference,
      partnerTransactionCode: line.partner_transaction_code,
      customerMasked: maskName(line.full_name),
      points: line.points,
      units: line.units,
      amount: trimDecimal(line.amount),
    });
    return {
      ...this.itemOf(row),
      gift: totals(row.gift_count, row.gift_points, null, row.gift_amount),
      inbound: totals(row.inbound_count, row.inbound_points, row.inbound_units, row.inbound_amount),
      outbound: totals(row.outbound_count, row.outbound_points, row.outbound_units, row.outbound_amount),
      mismatches: row.mismatches,
      reconcileError: row.reconcile_error,
      builtAt: new Date(row.built_at).toISOString(),
      confirmNote: row.confirm_note,
      confirmFile: row.file_id ? { id: row.file_id, fileName: row.file_name! } : null,
      confirmedByName: row.confirmed_by_name,
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
      paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
      paymentTermDays: row.payment_term_days,
      paymentMode: row.payment_mode,
      debt: row.debt_side ? { side: row.debt_side, amount: trimDecimal(row.debt_amount!), openAmount: trimDecimal(row.debt_open_amount!) } : null,
      lines: lines.map(lineOf),
      canManage,
    };
  }

  async rebuild(actor: BuyerAdminActor, id: string, version: number, canManage: boolean): Promise<PartnerSettlementDetail> {
    const row = await this.row(this.database, actor, id);
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (!openStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "partnerSettlementClosed");
    await this.build(row.contract_id, row.period, actor.userId);
    return this.detail(actor, id, canManage);
  }

  // Kiểm tệp biên bản: PDF, ảnh JPEG, PNG theo đuôi và chữ ký tệp, tối đa 10 MB.
  private fileKind(file: SettlementFile): { type: string; fileName: string } {
    if (file.size > settlementFileMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "attachmentTooLarge" } });
    const extension = file.originalname.split(".").pop()?.toLowerCase();
    const kind = fileKinds.find((item) => item.extension === extension);
    if (!kind || !kind.signature.every((byte, index) => file.buffer[index] === byte)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "attachmentTypeInvalid" } });
    const fileName = Buffer.from(file.originalname, "latin1")
      .toString("utf8")
      .replace(/[\\/\r\n"]/g, "_")
      .slice(-200);
    return { type: kind.type, fileName };
  }

  async confirm(actor: BuyerAdminActor, id: string, input: z.output<typeof partnerSettlementConfirmSchema>, file: SettlementFile | undefined): Promise<PartnerSettlementDetail> {
    const kind = file && file.size > 0 ? this.fileKind(file) : null;
    const storageKey = kind ? `loyalty-partner-settlements/${actor.operatorCompanyId}/${id}/${randomUUID()}` : null;
    if (kind && storageKey) await this.storage.put(storageKey, file!.buffer, kind.type);
    try {
      await this.database.transaction((transaction) => this.confirmWithin(transaction, actor, id, input, kind && storageKey ? { ...kind, storageKey, size: file!.size } : null));
    } catch (error) {
      if (storageKey) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    return this.detail(actor, id, true);
  }

  private async confirmWithin(
    executor: Transactional,
    actor: BuyerAdminActor,
    id: string,
    input: z.output<typeof partnerSettlementConfirmSchema>,
    file: { type: string; fileName: string; storageKey: string; size: number } | null,
  ): Promise<void> {
    const row = await this.row(executor, actor, id, true);
    if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (row.status !== "matched") throw new ApiError("BUSINESS_RULE", row.status === "confirmed" || row.status === "paid" ? "partnerSettlementClosed" : "partnerSettlementNotMatched");
    // Khóa giao dịch của tháng để hủy tặng, chốt tay chạy cùng lúc không lọt; số liệu khác lúc lập thì phải lập lại.
    await executor.execute(sql`
      SELECT 1 FROM loyalty.partner_gifts g WHERE g.contract_id = ${row.contract_id} AND g.settlement_id IS NULL AND ${inPeriod(sql`g.created_at`, row.period)} FOR UPDATE`);
    await executor.execute(sql`
      SELECT 1 FROM loyalty.partner_exchanges x WHERE x.contract_id = ${row.contract_id} AND x.settlement_id IS NULL AND ${inPeriod(sql`x.completed_at`, row.period)} FOR UPDATE`);
    const figures = await this.figures(executor, row.contract_id, row.period, null);
    if (figures.digest !== row.lines_digest) throw new ApiError("BUSINESS_RULE", "partnerSettlementChanged");
    const contract = await this.contract(executor, row.contract_id);
    const today = await vietnamToday(executor);
    const exchangeIds = figures.lines.filter((line) => line.kind !== "gift").map((line) => line.id);
    const giftIds = figures.lines.filter((line) => line.kind === "gift").map((line) => line.id);
    if (exchangeIds.length > 0)
      await executor.execute(
        sql`UPDATE loyalty.partner_exchanges SET settlement_id = ${id} WHERE id IN (${sql.join(
          exchangeIds.map((value) => sql`${value}`),
          sql`, `,
        )})`,
      );
    if (giftIds.length > 0)
      await executor.execute(
        sql`UPDATE loyalty.partner_gifts SET settlement_id = ${id} WHERE id IN (${sql.join(
          giftIds.map((value) => sql`${value}`),
          sql`, `,
        )})`,
      );
    let fileId: string | null = null;
    if (file) {
      fileId = (
        await executor.execute<{ id: string }>(sql`
          INSERT INTO core.attachments (company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
          VALUES (${actor.operatorCompanyId}, 'loyalty_partner_settlement', ${id}, ${file.fileName}, ${file.type}, ${file.size}, ${file.storageKey}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
    }
    const draft = settlementDraft({ companyId: contract.company_id, partnerId: contract.partner_id, id, documentNo: row.document_no, date: today, offset: Math.round(figures.offset) });
    if (draft) await this.accounting.record(executor, draft);
    const dueDate = (await executor.execute<{ value: string }>(sql`SELECT (${today}::date + ${contract.payment_term_days}::int)::text AS value`)).rows[0]!.value;
    let debtItemId: string | null = null;
    if (Math.abs(figures.net) >= 0.5) {
      const side = figures.net > 0 ? "receivable" : "payable";
      // Đối tác là khách hàng và nhà cung cấp của công ty vận hành sàn để lập phiếu thu, phiếu chi (CONG_VIEC_13).
      await executor.execute(sql`
        INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier) VALUES (${contract.company_id}, ${contract.partner_id}, true, true)
        ON CONFLICT (company_id, partner_id) DO UPDATE SET is_customer = true, is_supplier = true`);
      await this.debts.lockPartner(executor, contract.company_id, side, contract.partner_id);
      const amount = Math.abs(figures.net).toFixed(4);
      debtItemId = (
        await executor.execute<{ id: string }>(sql`
          INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount, note)
          VALUES (${contract.company_id}, ${contract.partner_id}, ${side}, 'debit', 'loyalty_partner_settlement', ${id}, ${row.document_no}, ${today}::date,
            ${dueDate}::date, ${amount}::numeric, ${amount}::numeric, 'Đối soát đối tác liên minh điểm')
          RETURNING id`)
      ).rows[0]!.id;
      // Trả trước: khớp ngay với tiền đối tác đã nộp còn mở (cách khớp công nợ hiện có).
      await this.debts.matchDebit(executor, debtItemId);
    }
    await executor.execute(sql`
      UPDATE loyalty.partner_settlements SET status = ${debtItemId ? "confirmed" : "paid"}, confirm_note = ${input.note}, confirm_file_id = ${fileId}, confirmed_by = ${actor.userId},
        confirmed_at = now(), due_date = ${debtItemId ? sql`${dueDate}::date` : sql`NULL`}, debt_item_id = ${debtItemId}, paid_at = ${debtItemId ? null : sql`now()`},
        updated_at = now(), version = version + 1
      WHERE id = ${id}`);
    await this.refreshPaid(executor);
    await this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: contract.company_id,
        appCode: "crm",
        action: "loyalty_partner_settlement.confirm",
        entityType: "loyalty_partner_settlement",
        entityId: id,
        afterData: { note: input.note, fileId, offset: figures.offset, net: figures.net, debtItemId },
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  async file(actor: BuyerAdminActor, id: string): Promise<{ content: Buffer; contentType: string; fileName: string }> {
    const file = (
      await this.database.execute<{ storage_key: string; content_type: string; file_name: string }>(sql`
        SELECT a.storage_key, a.content_type, a.file_name FROM loyalty.partner_settlements s JOIN core.attachments a ON a.id = s.confirm_file_id
        WHERE s.id = ${id} AND s.company_id = ${actor.operatorCompanyId}`)
    ).rows[0];
    if (!file) throw new ApiError("NOT_FOUND", "notFound");
    return { content: await this.storage.get(file.storage_key), contentType: file.content_type, fileName: file.file_name };
  }
}

type SettlementRow = {
  id: string;
  document_no: string;
  contract_id: string;
  contract_code: string;
  partner_name: string;
  unit_name_vi: string;
  payment_term_days: number;
  payment_mode: "prepaid" | "postpaid";
  period: string;
  gift_count: number;
  gift_points: string;
  gift_amount: string;
  inbound_count: number;
  inbound_points: string;
  inbound_units: string;
  inbound_amount: string;
  outbound_count: number;
  outbound_points: string;
  outbound_units: string;
  outbound_amount: string;
  receivable_amount: string;
  payable_amount: string;
  offset_amount: string;
  net_amount: string;
  status: PartnerSettlementStatus;
  mismatches: PartnerSettlementMismatch[];
  mismatch_count: number;
  reconcile_error: string | null;
  lines_digest: string;
  built_at: Date;
  confirm_note: string | null;
  file_id: string | null;
  file_name: string | null;
  confirmed_by_name: string | null;
  confirmed_at: Date | null;
  due_date: string | null;
  paid_at: Date | null;
  debt_side: "receivable" | "payable" | null;
  debt_amount: string | null;
  debt_open_amount: string | null;
  overdue: boolean;
  version: number;
};

const settlementSelect = (today: string) => sql`
  SELECT s.id, s.document_no, s.contract_id, c.code AS contract_code, p.name AS partner_name, c.unit_name_vi, c.payment_term_days, c.payment_mode, s.period::text,
    s.gift_count, s.gift_points::text, s.gift_amount::text, s.inbound_count, s.inbound_points::text, s.inbound_units::text, s.inbound_amount::text,
    s.outbound_count, s.outbound_points::text, s.outbound_units::text, s.outbound_amount::text, s.receivable_amount::text, s.payable_amount::text,
    s.offset_amount::text, s.net_amount::text, s.status, s.mismatches, jsonb_array_length(s.mismatches) AS mismatch_count, s.reconcile_error, s.lines_digest, s.built_at,
    s.confirm_note, a.id AS file_id, a.file_name, cu.full_name AS confirmed_by_name, s.confirmed_at, s.due_date::text, s.paid_at,
    d.side AS debt_side, d.amount::text AS debt_amount, d.open_amount::text AS debt_open_amount,
    coalesce(d.side = 'receivable' AND d.open_amount > 0 AND d.due_date < ${today}::date, false) AS overdue, s.version
  FROM loyalty.partner_settlements s JOIN loyalty.partner_contracts c ON c.id = s.contract_id JOIN crm.partners p ON p.id = c.partner_id
  LEFT JOIN core.attachments a ON a.id = s.confirm_file_id LEFT JOIN core.users cu ON cu.id = s.confirmed_by LEFT JOIN finance.debt_items d ON d.id = s.debt_item_id`;
