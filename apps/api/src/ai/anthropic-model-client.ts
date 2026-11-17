// Cài đặt lớp kết nối bằng SDK chính hãng của Anthropic (@anthropic-ai/sdk, Apache-2.0).
// Dùng dòng chảy (messages.stream) để trả chữ dần cho người dùng; bật mô hình dự phòng phía nhà cung cấp khi mô hình chính từ chối.
import Anthropic from "@anthropic-ai/sdk";
import type { AiConfig } from "./ai-config";
import { AiProviderError, emptyUsage, type AiModelClient, type AiRequest, type AiResponse, type AiStopReason, type AiToolUseBlock } from "./model-client";

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaTool = Anthropic.Beta.Messages.BetaTool;
type BetaContentBlock = Anthropic.Beta.Messages.BetaContentBlock;

const stopReasons: Record<string, AiStopReason> = { end_turn: "end_turn", tool_use: "tool_use", max_tokens: "max_tokens", refusal: "refusal" };

export class AnthropicModelClient implements AiModelClient {
  readonly provider = "anthropic";
  private readonly client: Anthropic;

  constructor(private readonly config: AiConfig) {
    // SDK đọc ANTHROPIC_API_KEY từ biến môi trường; 60 giây mỗi lần gọi, thử lại 2 lần cho lỗi tạm thời (mặc định SDK).
    this.client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
  }

  private messages(request: AiRequest): BetaMessageParam[] {
    return request.messages.map((message): BetaMessageParam => {
      if (message.role === "assistant") {
        // Trong cùng một lượt gửi lại nguyên nội dung nhà cung cấp trả (khối suy nghĩ phải giữ nguyên).
        if (message.providerContent !== undefined) return { role: "assistant", content: message.providerContent as BetaContentBlock[] };
        return { role: "assistant", content: message.content };
      }
      if (typeof message.content === "string") return { role: "user", content: message.content };
      return {
        role: "user",
        content: message.content.map((block) =>
          block.type === "text" ? { type: "text" as const, text: block.text } : { type: "tool_result" as const, tool_use_id: block.toolUseId, content: block.content, is_error: block.isError ?? false },
        ),
      };
    });
  }

  private tools(request: AiRequest): BetaTool[] | undefined {
    if (!request.tools?.length) return undefined;
    return request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as BetaTool["input_schema"],
      strict: true,
      // Đầu vào công cụ đến ngay khi sinh; máy chủ kiểm lại bằng zod trước khi chạy nên không cần API kiểm hộ.
      eager_input_streaming: true,
    }));
  }

  async send(request: AiRequest): Promise<AiResponse> {
    try {
      const stream = this.client.beta.messages.stream({
        model: this.config.model,
        max_tokens: request.maxTokens,
        // Lời nhắc hệ thống cố định để dùng bộ nhớ đệm của nhà cung cấp.
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: this.messages(request),
        tools: this.tools(request),
        output_config: { effort: request.effort, ...(request.outputSchema ? { format: { type: "json_schema" as const, schema: request.outputSchema } } : {}) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (request.onText) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") request.onText(event.delta.text);
        }
      }
      const message = await stream.finalMessage();
      const text = message.content
        .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      const toolUses: AiToolUseBlock[] = message.content
        .filter((block): block is Anthropic.Beta.Messages.BetaToolUseBlock => block.type === "tool_use")
        .map((block) => ({ type: "tool_use", id: block.id, name: block.name, input: block.input }));
      return {
        text,
        toolUses,
        stopReason: stopReasons[message.stop_reason ?? ""] ?? "other",
        // Số token tính phí của cả lượt gọi (gồm phần mô hình dự phòng nếu có); đơn giá áp theo mô hình cấu hình.
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
        model: message.model,
        providerContent: message.content,
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError || error instanceof Error) {
        // Không đưa thông điệp gốc ra người dùng; tầng gọi ghi log và trả AI_PROVIDER_ERROR.
        throw new AiProviderError(error instanceof Anthropic.APIError ? `Anthropic ${error.status ?? "kết nối"}: ${error.name}` : error.name, emptyUsage());
      }
      throw error;
    }
  }
}
