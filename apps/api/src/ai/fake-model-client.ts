// Bộ giả lập nhà cung cấp mô hình (YCAU_NGHIEPVU_183): kiểm thử và xem trước không gọi mạng.
// `script` là hàng đợi câu trả lời định trước; hết hàng đợi thì trả câu mặc định. `requests` ghi lại mọi yêu cầu để kiểm.
import type { AiUsage } from "./ai-config";
import { AiProviderError, type AiModelClient, type AiRequest, type AiResponse, type AiStopReason, type AiToolUseBlock } from "./model-client";

export interface FakeReply {
  text?: string;
  toolUses?: { name: string; input: unknown }[];
  stopReason?: AiStopReason;
  usage?: Partial<AiUsage>;
  // Giả lập nhà cung cấp lỗi (mạng, quá tải).
  fail?: boolean;
}

export const fakeDefaultUsage: AiUsage = { inputTokens: 1_000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 };

export class FakeModelClient implements AiModelClient {
  readonly provider = "fake";
  readonly script: FakeReply[] = [];
  readonly requests: AiRequest[] = [];
  private sequence = 0;

  constructor(private readonly model = "fake-model") {}

  reset(): void {
    this.script.length = 0;
    this.requests.length = 0;
  }

  async send(request: AiRequest): Promise<AiResponse> {
    // Chép sâu để kiểm thử thấy đúng nội dung lúc gửi.
    this.requests.push(structuredClone({ ...request, onText: undefined }));
    const reply = this.script.shift() ?? { text: "Đây là câu trả lời giả lập của trợ lý AI." };
    const usage: AiUsage = { ...fakeDefaultUsage, ...reply.usage };
    if (reply.fail) throw new AiProviderError("Nhà cung cấp giả lập lỗi", usage);
    const text = reply.text ?? "";
    // Trả chữ dần theo từng cụm 12 ký tự như dòng chảy thật.
    for (let start = 0; start < text.length && request.onText; start += 12) request.onText(text.slice(start, start + 12));
    const toolUses: AiToolUseBlock[] = (reply.toolUses ?? []).map((use) => ({ type: "tool_use", id: `fake-tool-${++this.sequence}`, name: use.name, input: use.input }));
    return {
      text,
      toolUses,
      stopReason: reply.stopReason ?? (toolUses.length ? "tool_use" : "end_turn"),
      usage,
      model: this.model,
      providerContent: [...(text ? [{ type: "text", text }] : []), ...toolUses],
    };
  }
}
