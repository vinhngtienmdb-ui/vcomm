// Lớp kết nối mô hình trung lập (CONG_VIEC_63 mục 15; YCAU_NGHIEPVU_183). Phần nghiệp vụ chỉ dùng các kiểu ở đây,
// không nhập SDK của nhà cung cấp. Hai cài đặt: AnthropicModelClient (dịch vụ thật), FakeModelClient (kiểm thử, xem trước).
import type { AiEffort, AiUsage } from "./ai-config";

export const AI_MODEL_CLIENT = Symbol("AI_MODEL_CLIENT");

export interface AiToolDefinition {
  name: string;
  description: string;
  // JSON Schema của đầu vào; máy chủ kiểm lại bằng zod trước khi chạy công cụ.
  inputSchema: Record<string, unknown>;
}

export interface AiTextBlock {
  type: "text";
  text: string;
}

export interface AiToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface AiToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type AiMessage =
  | { role: "user"; content: string | (AiTextBlock | AiToolResultBlock)[] }
  // providerContent: nội dung nguyên bản nhà cung cấp trả (kể cả khối suy nghĩ) để gửi lại không đổi trong cùng một lượt.
  | { role: "assistant"; content: string; providerContent?: unknown };

export interface AiRequest {
  system: string;
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  // Kết quả có cấu trúc theo JSON Schema (soạn nội dung sản phẩm).
  outputSchema?: Record<string, unknown>;
  maxTokens: number;
  effort: AiEffort;
  // Nhận từng đoạn chữ khi trả lời dạng dòng chảy.
  onText?: (delta: string) => void;
}

export type AiStopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface AiResponse {
  text: string;
  toolUses: AiToolUseBlock[];
  stopReason: AiStopReason;
  usage: AiUsage;
  // Mô hình thật sự trả lời (có thể khác mô hình yêu cầu khi nhà cung cấp chuyển sang mô hình dự phòng).
  model: string;
  providerContent: unknown;
}

// Lỗi gọi nhà cung cấp (mạng, quá tải, hết thời gian, khóa sai); `usage` là token đã tính phí nếu biết.
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly usage: AiUsage | null = null,
  ) {
    super(message);
  }
}

export interface AiModelClient {
  readonly provider: string;
  send(request: AiRequest): Promise<AiResponse>;
}

export const emptyUsage = (): AiUsage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
