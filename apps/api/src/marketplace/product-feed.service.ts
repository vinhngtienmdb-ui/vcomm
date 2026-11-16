// Tệp danh mục sản phẩm cho Facebook Commerce Manager (CONG_VIEC_68; CHUC_NANG_241; QUYTAC_NGHIEPVU_557 đến 559; API_316, API_317).
import { Inject, Injectable } from "@nestjs/common";
import type { ProductFeedStatus } from "contracts";
import { sql } from "drizzle-orm";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "./buyer-admin.service";
import { shareLinks } from "./share-page";
import type { PublicCatalog, PublicProduct } from "./share.service";
import { ShareService } from "./share.service";
import { shopImagePath } from "./shop.service";

type FeedRow = { enabled: boolean; token: string | null; token_created_at: string | null; fetched_at: string | null; version: number };

// Giữ tạm 5 phút để chống tải lặp (QUYTAC_NGHIEPVU_559).
const cacheMilliseconds = 5 * 60_000;
const maximumAdditionalImages = 10;
export const feedColumns = [
  "id",
  "item_group_id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "additional_variant_attribute",
] as const;

// Ô CSV theo RFC 4180: có dấu phẩy, ngoặc kép, xuống dòng hoặc khoảng trắng đầu cuối thì bọc ngoặc kép, nhân đôi ngoặc kép.
export const csvCell = (value: string) => (/[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const limit = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value);
// Tên, giá trị phân loại trong additional_variant_attribute không được chứa dấu hai chấm, dấu phẩy (định dạng "Tên:Giá trị,Tên:Giá trị").
const attributePart = (value: string) => value.replace(/[:,]/g, " ").replace(/\s+/g, " ").trim();
export const feedPrice = (amount: string, currency: string) => `${currency === "VND" ? Math.round(Number(amount)).toString() : Number(amount).toFixed(2)} ${currency}`;

export function feedRows(catalog: PublicCatalog, shareBase: string): string[][] {
  const rows: string[][] = [];
  for (const product of catalog.products) {
    if (product.imageIds.length === 0) continue;
    const images = product.imageIds.map((id) => `${shareBase}${shopImagePath(id)}`);
    const description = (product.description ?? "").trim() || product.name;
    for (const variant of product.variants) {
      const optionText = variant.optionValues.filter(Boolean).join(" / ");
      const attributes = product.options
        .map((option, index) => (variant.optionValues[index] ? `${attributePart(option.name)}:${attributePart(variant.optionValues[index]!)}` : ""))
        .filter((part) => part && !part.startsWith(":") && !part.endsWith(":"))
        .join(",");
      rows.push([
        limit(variant.sku || variant.variantId, 100),
        product.id,
        limit(optionText ? `${product.name} - ${optionText}` : product.name, 200),
        limit(description, 9999),
        Number(variant.available) > 0 ? "in stock" : "out of stock",
        "new",
        feedPrice(variant.grossPrice, catalog.currency),
        `${shareBase}/s/${product.id}`,
        images[0]!,
        images.slice(1, 1 + maximumAdditionalImages).join(","),
        limit(product.brand ?? catalog.storeName, 100),
        attributes,
      ]);
    }
  }
  return rows;
}

export const feedCsv = (rows: string[][]) => [feedColumns.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n") + "\r\n";

const countWithoutImage = (products: PublicProduct[]) => products.filter((product) => product.imageIds.length === 0).length;

@Injectable()
export class ProductFeedService {
  private cache: { token: string; body: string; expiresAt: number } | null = null;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly share: ShareService,
    private readonly audit: AuditService,
  ) {}

  private async read(executor: Pick<Database, "execute">, companyId: string, lock = false): Promise<FeedRow | null> {
    return (
      (
        await executor.execute<FeedRow>(sql`
        SELECT facebook_feed_enabled AS enabled, facebook_feed_token AS token, facebook_feed_token_created_at::text AS token_created_at,
          facebook_feed_fetched_at::text AS fetched_at, version
        FROM marketplace.store_settings WHERE company_id = ${companyId} ${lock ? sql`FOR UPDATE` : sql``}`)
      ).rows[0] ?? null
    );
  }

  async status(actor: BuyerAdminActor, canManage: boolean): Promise<ProductFeedStatus> {
    const row = await this.read(this.database, actor.operatorCompanyId);
    const catalog = await this.share.catalog();
    const products = catalog?.products ?? [];
    const iso = (value: string | null) => (value ? new Date(value).toISOString() : null);
    return {
      enabled: row?.enabled ?? false,
      url: canManage && row?.enabled && row.token ? `${shareLinks().shareBase}/api/v1/public/product-feeds/facebook/${row.token}.csv` : null,
      tokenCreatedAt: iso(row?.token_created_at ?? null),
      lastFetchedAt: iso(row?.fetched_at ?? null),
      productCount: products.length - countWithoutImage(products),
      skippedWithoutImage: countWithoutImage(products),
      version: row?.version ?? 0,
      canManage,
    };
  }

  // Bật lần đầu tự tạo mã; tắt giữ mã để bật lại dùng đường dẫn cũ (QUYTAC_NGHIEPVU_558).
  async setEnabled(actor: BuyerAdminActor, enabled: boolean, version: number): Promise<ProductFeedStatus> {
    await this.database.transaction(async (transaction) => {
      const row = await this.locked(transaction, actor, version);
      const token = enabled && !row.token ? newToken() : null;
      await transaction.execute(sql`
        UPDATE marketplace.store_settings SET facebook_feed_enabled = ${enabled},
          facebook_feed_token = coalesce(${token}, facebook_feed_token),
          facebook_feed_token_created_at = CASE WHEN ${token}::text IS NULL THEN facebook_feed_token_created_at ELSE now() END,
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE company_id = ${actor.operatorCompanyId}`);
      await this.record(transaction, actor, enabled ? "marketplace.product_feed.enable" : "marketplace.product_feed.disable", { enabled: row.enabled }, { enabled, tokenCreated: token !== null });
    });
    this.cache = null;
    return this.status(actor, true);
  }

  async regenerate(actor: BuyerAdminActor, version: number): Promise<ProductFeedStatus> {
    await this.database.transaction(async (transaction) => {
      await this.locked(transaction, actor, version);
      await transaction.execute(sql`
        UPDATE marketplace.store_settings SET facebook_feed_token = ${newToken()}, facebook_feed_token_created_at = now(),
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE company_id = ${actor.operatorCompanyId}`);
      await this.record(transaction, actor, "marketplace.product_feed.regenerate", null, { tokenCreated: true });
    });
    this.cache = null;
    return this.status(actor, true);
  }

  // API_316: trả null khi tắt, mã sai, cửa hàng chưa cài đặt (cùng một mã 404, không lộ lý do).
  async feed(token: string): Promise<string | null> {
    const operator = (
      await this.database.execute<{ company_id: string }>(sql`
      SELECT s.company_id FROM marketplace.store_settings s JOIN core.companies c ON c.id = s.company_id WHERE c.is_marketplace_operator AND c.status = 'active'`)
    ).rows[0];
    if (!operator) return null;
    const row = await this.read(this.database, operator.company_id);
    if (!row?.enabled || !row.token || !sameToken(row.token, token)) return null;
    const now = this.clock.now().getTime();
    let body = this.cache && this.cache.token === row.token && this.cache.expiresAt > now ? this.cache.body : null;
    if (!body) {
      const catalog = await this.share.catalog();
      if (!catalog) return null;
      body = feedCsv(feedRows(catalog, shareLinks().shareBase));
      this.cache = { token: row.token, body, expiresAt: now + cacheMilliseconds };
    }
    await this.database.execute(sql`UPDATE marketplace.store_settings SET facebook_feed_fetched_at = now() WHERE company_id = ${operator.company_id}`);
    return body;
  }

  private async locked(transaction: Pick<Database, "execute">, actor: BuyerAdminActor, version: number): Promise<FeedRow> {
    const row = await this.read(transaction, actor.operatorCompanyId, true);
    if (!row) throw new ApiError("BUSINESS_RULE", "storeNotReady");
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return row;
  }

  // Nhật ký thao tác không chứa mã bí mật (QUYTAC_NGHIEPVU_558).
  private record(transaction: Pick<Database, "execute" | "insert">, actor: BuyerAdminActor, action: string, beforeData: unknown, afterData: unknown) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action,
        entityType: "marketplace.store_settings",
        entityId: actor.operatorCompanyId,
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

const newToken = () => randomBytes(32).toString("base64url");
function sameToken(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}
