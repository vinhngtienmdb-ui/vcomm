// Webhook cho phần mềm cửa hàng liên kết (CONG_VIEC_73 lát L7; QUYTAC_NGHIEPVU_591; API_331; MAN_HINH_231, 232).
// Mỗi khóa API một địa chỉ HTTPS, khóa ký riêng (hiện một lần). Sự kiện đơn chờ của khóa ghi vào nhật ký gửi trong cùng giao dịch, việc nền gửi:
// POST JSON, X-VComm-Signature = HMAC-SHA256(khóa ký, thời điểm + "." + thân), X-VComm-Timestamp, X-VComm-Event-Id; 2xx trong 10 giây là thành công;
// thử lại sau 1, 5, 30 phút, 2, 6, 24 giờ, hết lượt thì dừng.
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { AffiliateWebhookDelivery, AffiliateWebhookSecret, WebhookEventType, affiliateWebhookSchema } from "contracts";
import { sql } from "drizzle-orm";
import { createHmac, randomBytes } from "node:crypto";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { decryptSecret, encryptSecret } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { InstoreCheckoutsService } from "../instore/checkouts.service";
import { openCheckoutView } from "../instore/open-checkout-view";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { requireOwner, type PortalMember } from "./portal.service";

type Executor = Pick<Database, "execute">;

// Thử lại sau 1, 5, 30 phút, 2, 6, 24 giờ.
export const webhookRetryMinutes = [1, 5, 30, 120, 360, 1440];
const timeoutMilliseconds = 10_000;

export type WebhookAccess = { kind: "admin"; actor: BuyerAdminActor } | { kind: "owner"; member: PortalMember };
export type WebhookTransport = (url: string, init: { headers: Record<string, string>; body: string; timeoutMs: number }) => Promise<{ status: number }>;

const fetchTransport: WebhookTransport = async (url, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const response = await fetch(url, { method: "POST", headers: init.headers, body: init.body, signal: controller.signal, redirect: "manual" });
    return { status: response.status };
  } finally {
    clearTimeout(timer);
  }
};

export const webhookSignature = (secret: string, timestamp: string, body: string) => createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

type DeliveryRow = {
  id: string;
  event_id: string;
  event_type: WebhookEventType;
  status: "pending" | "succeeded" | "failed";
  attempt_count: number;
  next_attempt_at: Date;
  last_status_code: number | null;
  last_error: string | null;
  delivered_at: Date | null;
  created_at: Date;
};

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

@Injectable()
export class AffiliateWebhooksService implements OnModuleInit {
  private readonly logger = new Logger("AffiliateWebhooks");
  // Kiểm thử thay bằng máy nhận giả.
  transport: WebhookTransport = fetchTransport;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly instore: InstoreCheckoutsService,
  ) {}

  onModuleInit(): void {
    // Đơn tạo qua Open API của khóa đã cài webhook: ghi sự kiện vào nhật ký gửi trong cùng giao dịch đổi trạng thái.
    this.instore.registerEventHook(async (transaction, row, event) => {
      if (row.kind !== "affiliate" || !row.api_key_id) return;
      const key = (
        await transaction.execute<{ ready: boolean }>(sql`
        SELECT (webhook_url IS NOT NULL AND webhook_secret IS NOT NULL) AS ready FROM affiliate.api_keys WHERE api_key_id = ${row.api_key_id}`)
      ).rows[0];
      if (!key?.ready) return;
      const payload = await openCheckoutView(transaction, row);
      await transaction.execute(sql`
        INSERT INTO affiliate.webhook_deliveries (api_key_id, event_type, payload) VALUES (${row.api_key_id}, ${event}, ${JSON.stringify(payload)}::jsonb)`);
    });
  }

  // Khóa của cửa hàng: quản trị (công ty vận hành sàn) hoặc chủ cửa hàng.
  private async keyOf(executor: Executor, access: WebhookAccess, keyId: string, lock = false): Promise<{ merchantId: string; companyId: string; version: number }> {
    if (access.kind === "owner") requireOwner(access.member);
    const row = (
      await executor.execute<{ merchant_id: string; company_id: string; webhook_version: number }>(sql`
      SELECT ak.merchant_id, m.company_id, ak.webhook_version FROM affiliate.api_keys ak JOIN affiliate.merchants m ON m.id = ak.merchant_id
      WHERE ak.api_key_id = ${keyId} ${lock ? sql`FOR UPDATE OF ak` : sql``}`)
    ).rows[0];
    const allowed = row && (access.kind === "admin" ? row.company_id === access.actor.operatorCompanyId : row.merchant_id === access.member.merchantId);
    if (!allowed) throw new ApiError("NOT_FOUND", "notFound");
    return { merchantId: row.merchant_id, companyId: row.company_id, version: row.webhook_version };
  }

  private auditActor(access: WebhookAccess) {
    return access.kind === "admin"
      ? { actorUserId: access.actor.userId, companyId: access.actor.operatorCompanyId, client: access.actor.client }
      : { actorUserId: access.member.userId, companyId: access.member.companyId, client: access.member.client };
  }

  private async record(transaction: Executor & Pick<Database, "insert">, access: WebhookAccess, action: string, keyId: string, afterData: Record<string, unknown>) {
    const actor = this.auditActor(access);
    await this.audit.record(
      {
        actorUserId: actor.actorUserId,
        companyId: actor.companyId,
        appCode: access.kind === "admin" ? "crm" : "affiliate",
        action,
        entityType: "api_key",
        entityId: keyId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      transaction,
    );
  }

  // Địa chỉ nhận (HTTPS); trống để tắt webhook.
  async configure(access: WebhookAccess, keyId: string, input: z.infer<typeof affiliateWebhookSchema>): Promise<{ url: string | null; version: number }> {
    return this.database.transaction(async (transaction) => {
      const key = await this.keyOf(transaction, access, keyId, true);
      if (key.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`UPDATE affiliate.api_keys SET webhook_url = ${input.url}, webhook_version = webhook_version + 1 WHERE api_key_id = ${keyId}`);
      await this.record(transaction, access, "affiliate_api_key.webhook", keyId, { url: input.url });
      return { url: input.url, version: key.version + 1 };
    });
  }

  // Cấp, cấp lại khóa ký: hiện một lần, lưu mã hóa; nhật ký không ghi khóa ký.
  async rotateSecret(access: WebhookAccess, keyId: string): Promise<AffiliateWebhookSecret> {
    const secret = `whsec_${randomBytes(32).toString("base64url")}`;
    const at = await this.database.transaction(async (transaction) => {
      await this.keyOf(transaction, access, keyId, true);
      const updated = (
        await transaction.execute<{ webhook_secret_at: Date }>(sql`
        UPDATE affiliate.api_keys SET webhook_secret = ${encryptSecret(secret)}, webhook_secret_at = now(), webhook_version = webhook_version + 1
        WHERE api_key_id = ${keyId} RETURNING webhook_secret_at`)
      ).rows[0]!;
      await this.record(transaction, access, "affiliate_api_key.webhook_secret", keyId, { rotated: true });
      return updated.webhook_secret_at;
    });
    return { secret, secretAt: new Date(at).toISOString() };
  }

  // Gửi thử: sự kiện webhook.test gửi ngay.
  async test(access: WebhookAccess, keyId: string): Promise<AffiliateWebhookDelivery> {
    await this.keyOf(this.database, access, keyId);
    const id = (
      await this.database.execute<{ id: string }>(sql`
      INSERT INTO affiliate.webhook_deliveries (api_key_id, event_type, payload) VALUES (${keyId}, 'webhook.test', ${JSON.stringify({ message: "Gửi thử từ VComm" })}::jsonb) RETURNING id`)
    ).rows[0]!.id;
    await this.deliver(id);
    return this.delivery(id);
  }

  async deliveries(access: WebhookAccess, keyId: string): Promise<AffiliateWebhookDelivery[]> {
    await this.keyOf(this.database, access, keyId);
    const rows = await this.database.execute<DeliveryRow>(sql`
      SELECT id, event_id, event_type, status, attempt_count, next_attempt_at, last_status_code, last_error, delivered_at, created_at
      FROM affiliate.webhook_deliveries WHERE api_key_id = ${keyId} ORDER BY created_at DESC LIMIT 100`);
    return rows.rows.map((row) => this.itemOf(row));
  }

  // Gửi lại một sự kiện (kể cả đã thành công hoặc đã dừng): đặt lại lượt thử, gửi ngay.
  async resend(access: WebhookAccess, deliveryId: string): Promise<AffiliateWebhookDelivery> {
    const keyId = (await this.database.execute<{ api_key_id: string }>(sql`SELECT api_key_id FROM affiliate.webhook_deliveries WHERE id = ${deliveryId}`)).rows[0]?.api_key_id;
    if (!keyId) throw new ApiError("NOT_FOUND", "notFound");
    await this.keyOf(this.database, access, keyId);
    await this.database.execute(sql`
      UPDATE affiliate.webhook_deliveries SET status = 'pending', attempt_count = 0, next_attempt_at = now(), last_error = NULL WHERE id = ${deliveryId}`);
    await this.deliver(deliveryId);
    return this.delivery(deliveryId);
  }

  private async delivery(id: string): Promise<AffiliateWebhookDelivery> {
    const row = (
      await this.database.execute<DeliveryRow>(sql`
      SELECT id, event_id, event_type, status, attempt_count, next_attempt_at, last_status_code, last_error, delivered_at, created_at FROM affiliate.webhook_deliveries WHERE id = ${id}`)
    ).rows[0]!;
    return this.itemOf(row);
  }

  private itemOf(row: DeliveryRow): AffiliateWebhookDelivery {
    return {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.status === "pending" ? iso(row.next_attempt_at) : null,
      lastStatusCode: row.last_status_code,
      lastError: row.last_error,
      deliveredAt: iso(row.delivered_at),
      createdAt: iso(row.created_at)!,
    };
  }

  // Việc nền mỗi phút: gửi các sự kiện đến giờ.
  async deliverDue(limit = 50): Promise<number> {
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM affiliate.webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= now() ORDER BY next_attempt_at LIMIT ${limit}`);
    for (const row of due.rows) {
      try {
        await this.deliver(row.id);
      } catch (error) {
        this.logger.error(`Gửi webhook ${row.id}: ${(error as Error).message}`);
      }
    }
    return due.rows.length;
  }

  // Một lần gửi: giữ chỗ (tiến trình khác không lấy lại trong 15 phút), gọi ngoài giao dịch, ghi kết quả.
  async deliver(id: string): Promise<void> {
    const claimed = await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{
          event_id: string;
          event_type: string;
          payload: unknown;
          created_at: Date;
          attempt_count: number;
          url: string | null;
          secret: Buffer | null;
        }>(sql`
        SELECT d.event_id, d.event_type, d.payload, d.created_at, d.attempt_count, k.webhook_url AS url, k.webhook_secret AS secret
        FROM affiliate.webhook_deliveries d JOIN affiliate.api_keys k ON k.api_key_id = d.api_key_id
        WHERE d.id = ${id} AND d.status = 'pending' AND d.next_attempt_at <= now() FOR UPDATE OF d SKIP LOCKED`)
      ).rows[0];
      if (!row) return null;
      await transaction.execute(sql`UPDATE affiliate.webhook_deliveries SET next_attempt_at = now() + interval '15 minutes' WHERE id = ${id}`);
      return row;
    });
    if (!claimed) return;
    let status: number | null = null;
    let error: string | null = null;
    if (!claimed.url || !claimed.secret) error = "webhookNotConfigured";
    else {
      const body = JSON.stringify({ id: claimed.event_id, type: claimed.event_type, createdAt: new Date(claimed.created_at).toISOString(), data: claimed.payload });
      const timestamp = String(Math.floor(Date.now() / 1000));
      try {
        const response = await this.transport(claimed.url, {
          headers: {
            "content-type": "application/json",
            "user-agent": "VComm-Webhook/1",
            "x-vcomm-signature": webhookSignature(decryptSecret(Buffer.from(claimed.secret)), timestamp, body),
            "x-vcomm-timestamp": timestamp,
            "x-vcomm-event-id": claimed.event_id,
          },
          body,
          timeoutMs: timeoutMilliseconds,
        });
        status = response.status;
        if (status < 200 || status >= 300) error = `HTTP ${status}`;
      } catch (failure) {
        error = ((failure as Error).name === "AbortError" ? "Hết 10 giây chờ" : (failure as Error).message).slice(0, 500);
      }
    }
    const attempts = claimed.attempt_count + 1;
    const delay = webhookRetryMinutes[attempts - 1];
    await this.database.execute(sql`
      UPDATE affiliate.webhook_deliveries SET attempt_count = ${attempts}, last_status_code = ${status}, last_error = ${error},
        status = ${error === null ? "succeeded" : delay === undefined || !claimed.url ? "failed" : "pending"},
        delivered_at = CASE WHEN ${error === null} THEN now() ELSE delivered_at END,
        next_attempt_at = CASE WHEN ${delay ?? null}::int IS NULL THEN next_attempt_at ELSE now() + make_interval(mins => ${delay ?? 0}) END
      WHERE id = ${id}`);
  }
}
