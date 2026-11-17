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
