// Hạch toán điểm thưởng (CONG_VIEC_51; CHUC_NANG_181; QUYTAC_NGHIEPVU_355). Nghĩa vụ điểm luôn ở công ty vận hành sàn (O); chi phí, phải thu khách ở công ty của chứng từ (C).
// C khác O (bán tại quầy ở công ty con khác): mỗi bên một bút toán, cân bằng bằng phải thu, phải trả nội bộ với đối tác nội bộ của bên kia (quyết định người dùng 2026-11-11).
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { DraftJournal, DraftLine, PostingRole } from "../accounting/postings";
import { LedgerService } from "../accounting/ledger.service";
import { internalPartnerOf } from "../crm/partners.service";
import type { Database } from "../database/database.module";
import { setEntryPoster } from "./ledger.service";

type Executor = Pick<Database, "execute">;
type Side = { role: PostingRole; amount: number; partnerId?: string | null }[];

const round = (value: number) => Math.round(value);
// amount dương: Nợ; âm: Có.
const linesOf = (side: Side): DraftLine[] =>
  side
    .filter((item) => Math.abs(item.amount) >= 1)
    .map((item) => ({ role: item.role, partnerId: item.partnerId ?? null, debit: item.amount > 0 ? item.amount : 0, credit: item.amount < 0 ? -item.amount : 0 }));
const net = (side: Side) => side.reduce((total, item) => total + item.amount, 0);

async function operatorCompanyId(executor: Executor): Promise<string | null> {
  return (await executor.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator`)).rows[0]?.id ?? null;
}

// Hai phía của một nghiệp vụ điểm: phía nghĩa vụ (O) và phía bán (C); gộp một bút toán khi cùng công ty.
async function drafts(
  executor: Executor,
  input: {
    operator: string;
    company: string;
    operatorSide: Side;
    companySide: Side;
    sourceType: "loyalty_entry" | "loyalty_order_redeem";
    sourceId: string;
    journalNo: string;
    date: string;
    description: string;
  },
): Promise<DraftJournal[]> {
  if (input.operator === input.company) {
    return [
      {
        companyId: input.operator,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        journalNo: input.journalNo,
        date: input.date,
        description: input.description,
        lines: linesOf([...input.operatorSide, ...input.companySide]),
      },
    ];
  }
  const operatorNet = net(input.operatorSide);
  const companyNet = net(input.companySide);
  return [
    {
      companyId: input.operator,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      journalNo: input.journalNo,
      date: input.date,
      description: input.description,
      lines: linesOf([...input.operatorSide, { role: "loyalty_intercompany_receivable", amount: -operatorNet, partnerId: await internalPartnerOf(executor, input.company) }]),
    },
    {
      companyId: input.company,
      sourceType: "loyalty_seller_entry",
      sourceId: input.sourceId,
      journalNo: input.journalNo,
      date: input.date,
      description: input.description,
      lines: linesOf([...input.companySide, { role: "loyalty_intercompany_payable", amount: -companyNet, partnerId: await internalPartnerOf(executor, input.operator) }]),
    },
  ];
}

const descriptions: Record<string, string> = {
  earn: "Tích điểm thưởng",
  redeem: "Dùng điểm thưởng",
  redeem_refund: "Hoàn điểm thưởng đã dùng",
  earn_reversal: "Trừ lại điểm thưởng đã tích do trả hàng",
  expire: "Điểm thưởng hết hạn",
  adjust_add: "Điều chỉnh cộng điểm thưởng",
  adjust_subtract: "Điều chỉnh trừ điểm thưởng",
};

// Bút toán của một bút toán điểm. Điểm dùng, hoàn của đơn VComm không ghi ở đây mà gộp khi đơn hoàn tất.
export async function loyaltyEntryDrafts(executor: Executor, entryId: string): Promise<DraftJournal[]> {
  const entry = (
    await executor.execute<{ kind: string; points: number; amount: string; source_type: string | null; company_id: string | null; day: string; value: string; document_no: string | null }>(sql`
    SELECT e.kind, e.points, e.amount::text, e.source_type, e.company_id, (e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day,
      coalesce((SELECT sum(abs(el.points) * el.point_value) FROM loyalty.entry_lots el WHERE el.entry_id = e.id), 0)::text AS value,
      CASE WHEN e.source_type = 'marketplace_order' THEN (SELECT so.document_no FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = e.source_id) END AS document_no
    FROM loyalty.entries e WHERE e.id = ${entryId}`)
  ).rows[0];
  if (!entry) return [];
  if (entry.source_type === "marketplace_order" && (entry.kind === "redeem" || entry.kind === "redeem_refund")) return [];
  const operator = await operatorCompanyId(executor);
  if (!operator) return [];
  const company = entry.company_id ?? operator;
  const value = round(Number(entry.value));
  const amount = round(Number(entry.amount));
  const sides: Record<string, { operatorSide: Side; companySide: Side }> = {
    earn: { operatorSide: [{ role: "loyalty_liability", amount: -value }], companySide: [{ role: "loyalty_expense", amount: value }] },
    // Dùng điểm: giảm nghĩa vụ theo giá trị lúc tích; khách được trừ tiền điểm hiện hành; chênh lệch vào chi phí ở công ty vận hành sàn.
    redeem: {
      operatorSide: [
        { role: "loyalty_liability", amount: value },
        { role: "loyalty_expense", amount: amount - value },
      ],
      companySide: [{ role: "receivable", amount: -amount }],
    },
    redeem_refund: {
      operatorSide: [
        { role: "loyalty_liability", amount: -value },
        { role: "loyalty_expense", amount: value - amount },
      ],
      companySide: [{ role: "receivable", amount }],
    },
    // Trừ lại điểm đã tích: giảm nghĩa vụ phần điểm trừ được; phần thiếu khách bù bằng tiền (giảm tiền hoàn, Nợ 131); giảm chi phí toàn bộ.
    earn_reversal: {
      operatorSide: [{ role: "loyalty_liability", amount: value }],
      companySide: [
        { role: "receivable", amount },
        { role: "loyalty_expense", amount: -(value + amount) },
      ],
    },
    expire: { operatorSide: [{ role: "loyalty_liability", amount: value }], companySide: [{ role: "loyalty_expense", amount: -value }] },
    adjust_add: { operatorSide: [{ role: "loyalty_liability", amount: -value }], companySide: [{ role: "loyalty_expense", amount: value }] },
    adjust_subtract: { operatorSide: [{ role: "loyalty_liability", amount: value }], companySide: [{ role: "loyalty_expense", amount: -value }] },
  };
  const side = sides[entry.kind];
  if (!side) return [];
  // Hết hạn, điều chỉnh: chỉ ở công ty vận hành sàn.
  const sideCompany = entry.kind === "expire" || entry.kind.startsWith("adjust") ? operator : company;
  return drafts(executor, {
    operator,
    company: sideCompany,
    ...side,
    sourceType: "loyalty_entry",
    sourceId: entryId,
    journalNo: entry.document_no ? `${entry.document_no}-DT` : `DT-${entryId.slice(0, 8).toUpperCase()}`,
    date: entry.day,
    description: descriptions[entry.kind]!,
  });
}

// Đơn VComm hoàn tất có dùng điểm (QUYTAC_NGHIEPVU_355): Nợ nghĩa vụ theo giá trị lúc tích của điểm đã dùng còn lại / Có phải thu khách tiền điểm còn lại; chênh lệch vào chi phí.
export async function loyaltyOrderRedeemDraft(executor: Executor, orderId: string): Promise<DraftJournal[]> {
  const row = (
    await executor.execute<{ company_id: string; document_no: string; completed_on: string; amount: string; value: string }>(sql`
    SELECT m.company_id, so.document_no, (m.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS completed_on, (d.redeemed_amount - d.refunded_amount)::text AS amount,
      coalesce((SELECT -sum(el.points * el.point_value) FROM loyalty.entries e JOIN loyalty.entry_lots el ON el.entry_id = e.id
        WHERE e.source_type = 'marketplace_order' AND e.source_id = m.id AND e.kind IN ('redeem', 'redeem_refund')), 0)::text AS value
    FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id
    JOIN loyalty.document_points d ON d.source_type = 'marketplace_order' AND d.source_id = m.id
    WHERE m.id = ${orderId} AND m.status = 'completed'`)
  ).rows[0];
  if (!row || Number(row.amount) <= 0) return [];
  const amount = round(Number(row.amount));
  const value = round(Number(row.value));
  return drafts(executor, {
    operator: row.company_id,
    company: row.company_id,
    operatorSide: [
      { role: "loyalty_liability", amount: value },
      { role: "loyalty_expense", amount: amount - value },
    ],
    companySide: [{ role: "receivable", amount: -amount }],
    sourceType: "loyalty_order_redeem",
    sourceId: orderId,
    journalNo: `${row.document_no}-DD`,
    date: row.completed_on,
    description: `Điểm thưởng dùng cho đơn VComm ${row.document_no}`,
  });
}

@Injectable()
export class LoyaltyPostingsService implements OnModuleInit {
  constructor(private readonly ledger: LedgerService) {}

  onModuleInit(): void {
    setEntryPoster(async (executor, entryId) => {
      for (const draft of await loyaltyEntryDrafts(executor, entryId)) await this.ledger.record(executor, draft);
    });
  }

  async postOrderRedeem(executor: Executor, orderId: string): Promise<void> {
    for (const draft of await loyaltyOrderRedeemDraft(executor, orderId)) await this.ledger.record(executor, draft);
  }
}
