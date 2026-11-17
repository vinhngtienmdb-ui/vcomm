// Trợ lý AI (CONG_VIEC_63, MODULE_16): cài đặt công ty, trạng thái của người dùng, thông báo xử lý dữ liệu cá nhân (API_273, API_278).
import { z } from "zod";

export const aiFeatures = ["chat", "product_content"] as const;
export type AiFeature = (typeof aiFeatures)[number];

// Lý do tính năng chưa dùng được, theo thứ tự kiểm (QUYTAC_NGHIEPVU_510, 513).
export const aiUnavailableReasons = ["no_permission", "not_configured", "disabled", "no_budget", "quota_exceeded", "daily_limit", "notice_required"] as const;
export type AiUnavailableReason = (typeof aiUnavailableReasons)[number];

export const aiPermissions = {
  chat: "ai.chat.use",
  productContent: "ai.product_content.use",
  settings: "ai.settings.manage",
  usage: "ai.usage.view",
} as const;

export interface AiFeatureStatus {
  feature: AiFeature;
  // Có quyền của tính năng ở công ty đang chọn (không có thì giao diện ẩn nút).
  permitted: boolean;
  available: boolean;
  reason: AiUnavailableReason | null;
  // Thời điểm mở lại khi hết hạn mức tháng (ngày 1 tháng sau) hoặc hết lượt hôm nay (0 giờ hôm sau), giờ Việt Nam.
  reopensAt: string | null;
}

// API_273 GET /ai/me
export interface AiMeResponse {
  features: AiFeatureStatus[];
  dailyTurns: number;
  remainingTurnsToday: number;
  notice: { version: number; acknowledged: boolean; provider: string | null };
}

// API_273 POST /ai/me/acknowledge
export const acknowledgeAiNoticeSchema = z.object({ noticeVersion: z.number().int().min(1) }).strict();
export type AcknowledgeAiNoticeRequest = z.infer<typeof acknowledgeAiNoticeSchema>;

// Số tiền USD dạng chuỗi, tối đa hai chữ số thập phân (QUYTAC_NGHIEPVU_511).
const usdAmount = z
  .string()
  .trim()
  .regex(/^\d{1,5}(\.\d{1,2})?$/)
  .refine((value) => Number(value) <= 10_000);

// API_278 PATCH /ai/settings
export const updateAiSettingsSchema = z
  .object({
    chatEnabled: z.boolean(),
    productContentEnabled: z.boolean(),
    monthlyBudgetUsd: usdAmount,
    dailyTurnsPerUser: z.number().int().min(1).max(500),
    version: z.number().int().min(0),
  })
  .strict();
export type UpdateAiSettingsRequest = z.infer<typeof updateAiSettingsSchema>;

// API_278 GET /ai/settings
export interface AiSettingsResponse {
  chatEnabled: boolean;
  productContentEnabled: boolean;
  monthlyBudgetUsd: string;
  dailyTurnsPerUser: number;
  // 0 khi công ty chưa lưu cài đặt lần nào.
  version: number;
  updatedAt: string | null;
  canManage: boolean;
  provider: string | null;
  model: string | null;
  configured: boolean;
  // USD mỗi triệu token.
  prices: { input: string; output: string; cacheRead: string; cacheWrite: string };
  month: string;
  spentThisMonthUsd: string;
  // Tỷ giá bán USD gần nhất (tham khảo, không dùng để tính hạn mức).
  usdToVnd: { rate: string; date: string } | null;
  notice: { version: number; acknowledgedUsers: number };
}

// ---------- L2: hỏi đáp số liệu (API_274 đến API_276; QUYTAC_NGHIEPVU_516 đến 521) ----------

// Công cụ đọc dữ liệu của trợ lý; giao diện dùng tên để hiện nguồn và liên kết màn hình.
export const aiToolNames = [
  "sales_report",
  "inventory_report",
  "debt_report",
  "commission_report",
  "overview_report",
  "sales_orders",
  "sales_order_detail",
  "products",
  "product_detail",
  "stock",
] as const;
export type AiToolName = (typeof aiToolNames)[number];

export interface AiToolCall {
  name: AiToolName;
  // Tham số đã gửi công cụ (đã kiểm).
  input: Record<string, unknown>;
  ok: boolean;
}

export type AiMessageStatus = "ok" | "refusal" | "error" | "max_tokens";
export const aiFeedbackReasons = ["wrong_figures", "not_relevant", "missing_data", "other"] as const;
export type AiFeedbackReason = (typeof aiFeedbackReasons)[number];

export interface AiFeedback {
  rating: "up" | "down";
  reason: AiFeedbackReason | null;
  note: string | null;
}

export interface AiMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: AiToolCall[];
  status: AiMessageStatus;
  createdAt: string;
  feedback: AiFeedback | null;
}

export interface AiConversationItem {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
}

export interface AiConversationDetail extends AiConversationItem {
  messages: AiMessageItem[];
}

export const aiMaxMessagesPerConversation = 40;

// API_275 POST /ai/conversations/messages
export const askAiSchema = z
  .object({
    conversationId: z.uuid().nullable().default(null),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();
export type AskAiRequest = z.input<typeof askAiSchema>;

// Sự kiện của dòng trả lời (text/event-stream): mỗi sự kiện `event: <type>` và `data: <JSON>`.
export type AiStreamEvent =
  | { type: "conversation"; id: string; title: string; userMessageId: string }
  | { type: "tool"; name: AiToolName }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; status: AiMessageStatus; toolCalls: AiToolCall[]; remainingTurnsToday: number }
  | { type: "error"; code: string; message: string };

// API_276 PUT /ai/messages/{id}/feedback
export const aiFeedbackSchema = z
  .object({
    rating: z.enum(["up", "down"]),
    reason: z.enum(aiFeedbackReasons).nullable().default(null),
    note: z.string().trim().max(500).nullable().default(null),
  })
  .strict()
  .refine((value) => (value.rating === "down") === (value.reason !== null), { path: ["reason"] });
export type AiFeedbackRequest = z.input<typeof aiFeedbackSchema>;

export const aiConversationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
