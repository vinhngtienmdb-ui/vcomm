// Ví mua sắm của người mua, khóa ví mua sắm toàn hệ thống, chặn ví theo tài khoản (CONG_VIEC_49; CHUC_NANG_173; QUYTAC_NGHIEPVU_332; THAY_DOI_22; API_166).
import { Inject, Injectable } from "@nestjs/common";
import type { ShoppingWalletResponse, ShoppingWalletSettings, ShoppingWalletTransactionKind, WalletBlocksResponse, WalletKind } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { BuyerAdminService, type BuyerAdminActor } from "./buyer-admin.service";
import { shoppingWalletLocked, walletBlocked } from "./shopping-wallet";
import { WithdrawalsService } from "./withdrawals.service";

type Executor = Pick<Database, "execute">;

@Injectable()
export class WalletsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly admin: BuyerAdminService,
    private readonly withdrawals: WithdrawalsService,
    private readonly audit: AuditService,
  ) {}

  // API_166: ví mua sắm của chính người gọi; lịch sử mới nhất trước.
  async mine(userId: string, query: { page: number; pageSize: number }): Promise<ShoppingWalletResponse> {
    const companyId = await this.admin.operatorCompanyId();
    const balance = (await this.database.execute<{ balance: string }>(sql`SELECT balance::float::text AS balance FROM marketplace.shopping_wallets WHERE user_id = ${userId}`)).rows[0]?.balance ?? "0";
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.shopping_wallet_transactions WHERE user_id = ${userId}`)).rows[0]!.total;
    const rows = await this.database.execute<{ id: string; kind: ShoppingWalletTransactionKind; amount: string; balance_after: string; order_id: string; document_no: string; created_at: Date }>(sql`
      SELECT t.id, t.kind, t.amount::float::text AS amount, t.balance_after::float::text AS balance_after, t.order_id, so.document_no, t.created_at
      FROM marketplace.shopping_wallet_transactions t JOIN marketplace.orders m ON m.id = t.order_id JOIN sales.orders so ON so.id = m.sales_order_id
      WHERE t.user_id = ${userId} ORDER BY t.created_at DESC, t.id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      balance,
      isLocked: companyId ? await shoppingWalletLocked(this.database, companyId) : false,
      isBlocked: await walletBlocked(this.database, userId, "shopping"),
      transactions: {
        data: rows.rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          amount: row.amount,
          balanceAfter: row.balance_after,
          orderId: row.order_id,
          orderDocumentNo: row.document_no,
          createdAt: new Date(row.created_at).toISOString(),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  }

  // Khóa ví mua sắm toàn hệ thống (THAY_DOI_22).
  async settings(actor: BuyerAdminActor): Promise<ShoppingWalletSettings> {
    const row = (
      await this.database.execute<{ is_locked: boolean; version: number }>(sql`
      SELECT is_locked, version FROM marketplace.shopping_wallet_settings WHERE company_id = ${actor.operatorCompanyId}`)
    ).rows[0];
    return { isLocked: row?.is_locked ?? false, version: row?.version ?? 0 };
  }

  async updateSettings(actor: BuyerAdminActor, input: { isLocked: boolean; version: number }): Promise<ShoppingWalletSettings> {
    await this.database.transaction(async (transaction) => {
      const saved =
        input.version === 0
          ? await transaction.execute(sql`
            INSERT INTO marketplace.shopping_wallet_settings (company_id, is_locked, updated_by) VALUES (${actor.operatorCompanyId}, ${input.isLocked}, ${actor.userId})
            ON CONFLICT (company_id) DO NOTHING RETURNING company_id`)
          : await transaction.execute(sql`
            UPDATE marketplace.shopping_wallet_settings SET is_locked = ${input.isLocked}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
            WHERE company_id = ${actor.operatorCompanyId} AND version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.record(transaction, actor, "marketplace.shopping_wallet_settings.update", actor.operatorCompanyId, null, input);
    });
    return this.settings(actor);
  }

  // Chặn ví theo tài khoản (THAY_DOI_22): người mua của công ty vận hành sàn (có tài khoản người mua).
  async blocks(actor: BuyerAdminActor, userId: string): Promise<WalletBlocksResponse> {
    await this.requireBuyer(this.database, userId);
    const rows = await this.database.execute<{ wallet: WalletKind; is_blocked: boolean; reason: string; updated_at: Date; version: number }>(sql`
      SELECT wallet, is_blocked, reason, updated_at, version FROM marketplace.wallet_blocks WHERE user_id = ${userId}`);
    const history = await this.database.execute<{ wallet: WalletKind; action: "block" | "unblock"; reason: string; name: string; changed_at: Date }>(sql`
      SELECT h.wallet, h.action, h.reason, u.full_name AS name, h.changed_at FROM marketplace.wallet_block_history h JOIN core.users u ON u.id = h.changed_by
      WHERE h.user_id = ${userId} ORDER BY h.changed_at DESC, h.id`);
    return {
      blocks: (["shopping", "commission"] as const).map((wallet) => {
        const row = rows.rows.find((item) => item.wallet === wallet);
        return {
          wallet,
          isBlocked: row?.is_blocked ?? false,
          reason: row?.reason ?? null,
          updatedAt: row ? new Date(row.updated_at).toISOString() : null,
          version: row?.version ?? 0,
        };
      }),
      history: history.rows.map((item) => ({
        wallet: item.wallet,
        action: item.action,
        reason: item.reason,
        changedByName: item.name,
        changedAt: new Date(item.changed_at).toISOString(),
      })),
    };
  }

  // Chặn hoặc gỡ chặn một ví; chặn ví hoa hồng thì yêu cầu rút chờ duyệt tự bị từ chối (THAY_DOI_22).
  async setBlock(actor: BuyerAdminActor, userId: string, wallet: WalletKind, input: { isBlocked: boolean; reason: string; version: number }): Promise<WalletBlocksResponse> {
    await this.database.transaction(async (transaction) => {
      await this.requireBuyer(transaction, userId);
      const current = (
        await transaction.execute<{ is_blocked: boolean; version: number }>(sql`
        SELECT is_blocked, version FROM marketplace.wallet_blocks WHERE user_id = ${userId} AND wallet = ${wallet} FOR UPDATE`)
      ).rows[0];
      if ((current?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if ((current?.is_blocked ?? false) === input.isBlocked) throw new ApiError("BUSINESS_RULE", "walletBlockUnchanged");
      if (current) {
        await transaction.execute(sql`
          UPDATE marketplace.wallet_blocks SET is_blocked = ${input.isBlocked}, reason = ${input.reason}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE user_id = ${userId} AND wallet = ${wallet}`);
      } else {
        await transaction.execute(sql`
          INSERT INTO marketplace.wallet_blocks (user_id, wallet, is_blocked, reason, updated_by) VALUES (${userId}, ${wallet}, ${input.isBlocked}, ${input.reason}, ${actor.userId})`);
      }
      await transaction.execute(sql`
        INSERT INTO marketplace.wallet_block_history (user_id, wallet, action, reason, changed_by)
        VALUES (${userId}, ${wallet}, ${input.isBlocked ? "block" : "unblock"}, ${input.reason}, ${actor.userId})`);
      if (wallet === "commission" && input.isBlocked) await this.withdrawals.rejectPendingWithin(transaction, actor, userId, input.reason);
      const titles: Record<WalletKind, [string, string]> = {
        shopping: ["Ví mua sắm của bạn tạm bị chặn", "Ví mua sắm của bạn đã được mở lại"],
        commission: ["Ví hoa hồng của bạn tạm bị chặn rút tiền", "Ví hoa hồng của bạn đã được mở lại"],
      };
      await notify(transaction, [
        {
          userId,
          companyId: actor.operatorCompanyId,
          kind: `wallet_block.${wallet}.${input.isBlocked ? "block" : "unblock"}`,
          title: titles[wallet][input.isBlocked ? 0 : 1],
          payload: { reason: input.reason },
        },
      ]);
      await this.record(transaction, actor, `marketplace.wallet_block.${input.isBlocked ? "block" : "unblock"}`, userId, { wallet, isBlocked: current?.is_blocked ?? false }, { wallet, ...input });
    });
    return this.blocks(actor, userId);
  }

  private async requireBuyer(executor: Executor, userId: string): Promise<void> {
    const found = await executor.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId}`);
    if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  private record(transaction: Pick<Database, "execute" | "insert">, actor: BuyerAdminActor, action: string, entityId: string, beforeData: unknown, afterData: unknown) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action,
        entityType: "marketplace.wallet_blocks",
        entityId,
        beforeData,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      transaction,
    );
  }
}
