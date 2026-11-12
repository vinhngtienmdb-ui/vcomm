// Giới hạn số yêu cầu theo địa chỉ IP cho API không cần đăng nhập (tài liệu 22 mục 3, LOI_02): 20 yêu cầu mỗi phút mỗi API.
// Đếm theo cửa sổ một phút trên Redis để nhiều tiến trình API dùng chung; không có REDIS_URL thì đếm trong bộ nhớ.
import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { CLOCK, type Clock } from "./clock";

export const RATE_LIMIT = Symbol("RATE_LIMIT");

export interface RateLimitSettings {
  perMinute: number;
}

export const defaultRateLimit: RateLimitSettings = { perMinute: 20 };

@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger("RateLimiter");
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, number>();

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(RATE_LIMIT) private readonly settings: RateLimitSettings,
  ) {
    const url = process.env.REDIS_URL;
    this.redis = url ? new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false }) : null;
    this.redis?.on("error", (error) => this.logger.error(`Redis: ${error.message}`));
  }

  // Trả số giây phải chờ khi vượt giới hạn, null khi còn được gọi.
  async hit(route: string, ip: string): Promise<number | null> {
    return (await this.consume(`${route}:${ip}`, this.settings.perMinute)).retryAfterSeconds;
  }

  // Đếm một lần gọi theo khóa đếm với giới hạn riêng (khóa API đối tác, CONG_VIEC_61; QUYTAC_NGHIEPVU_487).
  async consume(subject: string, perMinute: number): Promise<{ retryAfterSeconds: number | null; remaining: number }> {
    const now = this.clock.now().getTime();
    const window = Math.floor(now / 60_000);
    const key = `gioi-han:${subject}:${window}`;
    let count: number;
    try {
      count = this.redis ? await this.countInRedis(key) : this.countInMemory(key, window);
    } catch (error) {
      // Redis lỗi thì cho qua để không chặn đăng nhập; khóa tài khoản sau 5 lần sai vẫn còn hiệu lực.
      this.logger.error(`Không đếm được số yêu cầu: ${(error as Error).message}`);
      return { retryAfterSeconds: null, remaining: perMinute };
    }
    if (count <= perMinute) return { retryAfterSeconds: null, remaining: perMinute - count };
    return { retryAfterSeconds: Math.ceil(((window + 1) * 60_000 - now) / 1000), remaining: 0 };
  }

  private async countInRedis(key: string): Promise<number> {
    const [[, count]] = (await this.redis!.multi().incr(key).expire(key, 120).exec()) as [[Error | null, number]];
    return count;
  }

  private countInMemory(key: string, window: number): number {
    const count = (this.memory.get(key) ?? 0) + 1;
    this.memory.set(key, count);
    // Bỏ các cửa sổ cũ để bộ nhớ không tăng mãi.
    if (this.memory.size > 10_000) {
      for (const stored of this.memory.keys()) if (!stored.endsWith(`:${window}`)) this.memory.delete(stored);
    }
    return count;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
