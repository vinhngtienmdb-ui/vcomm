// Cấu hình trợ lý AI đọc từ biến môi trường (CONG_VIEC_63 mục 15). Khóa nhà cung cấp không đi qua đây và không ghi ra đâu.
import type { AiFeature } from "contracts";

export type AiProviderName = "anthropic" | "fake";
export type AiEffort = "low" | "medium" | "high";

export interface AiPrices {
  // USD mỗi triệu token.
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface AiConfig {
  provider: AiProviderName | null;
  model: string;
  effort: Record<AiFeature, AiEffort>;
  prices: AiPrices;
  noticeVersion: number;
}

export const AI_CONFIG = Symbol("AI_CONFIG");

// Mô hình mặc định do người dùng chọn ngày 2026-11-17; đơn giá theo bảng giá hiện hành của nhà cung cấp.
export const defaultModel = "claude-sonnet-5-5";
const defaultPrices: AiPrices = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 };

const efforts: AiEffort[] = ["low", "medium", "high"];
const effortOf = (value: string | undefined, fallback: AiEffort): AiEffort => (efforts.includes(value?.trim() as AiEffort) ? (value!.trim() as AiEffort) : fallback);

function priceOf(value: string | undefined, fallback: number): number {
  const parsed = Number(value?.trim());
  return value?.trim() && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function readAiConfig(environment: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = environment.AI_PROVIDER?.trim();
  const version = Number(environment.AI_NOTICE_VERSION?.trim());
  return {
    // Thiếu khóa thì coi như chưa cấu hình, không báo lỗi lúc khởi động.
    provider: provider === "fake" ? "fake" : provider === "anthropic" && environment.ANTHROPIC_API_KEY?.trim() ? "anthropic" : null,
    model: environment.AI_MODEL?.trim() || defaultModel,
    effort: { chat: effortOf(environment.AI_CHAT_EFFORT, "medium"), product_content: effortOf(environment.AI_CONTENT_EFFORT, "low") },
    prices: {
      input: priceOf(environment.AI_PRICE_INPUT, defaultPrices.input),
      output: priceOf(environment.AI_PRICE_OUTPUT, defaultPrices.output),
      cacheRead: priceOf(environment.AI_PRICE_CACHE_READ, defaultPrices.cacheRead),
      cacheWrite: priceOf(environment.AI_PRICE_CACHE_WRITE, defaultPrices.cacheWrite),
    },
    noticeVersion: Number.isInteger(version) && version >= 1 ? version : 1,
  };
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

// Chi phí một lượt, USD, làm tròn 6 chữ số thập phân như cột cost_usd (QUYTAC_NGHIEPVU_512).
export function costOf(usage: AiUsage, prices: AiPrices): number {
  const micro =
    usage.inputTokens * prices.input + usage.outputTokens * prices.output + usage.cacheReadTokens * prices.cacheRead + usage.cacheWriteTokens * prices.cacheWrite;
  return Math.round(micro) / 1_000_000;
}
