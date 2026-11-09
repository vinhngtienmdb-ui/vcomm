// Gửi tin qua eSMS.vn (QUYTAC_NGHIEPVU_32): Zalo ZNS theo mẫu, mã OTP đa kênh Zalo rồi SMS, danh sách Zalo OA để kiểm tra kết nối.
// Tài liệu nhà cung cấp: developers.esms.vn. Mã kết quả "100" là eSMS đã nhận yêu cầu.
import { Injectable } from "@nestjs/common";

export const MESSAGE_GATEWAY = Symbol("MESSAGE_GATEWAY");

export interface EsmsCredentials {
  apiKey: string;
  secretKey: string;
  sandbox: boolean;
}

export interface GatewayResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
}

export interface MessageGateway {
  sendZns(credentials: EsmsCredentials, input: { phone: string; oaId: string; templateId: string; data: Record<string, string>; requestId: string }): Promise<GatewayResult>;
  sendOtp(credentials: EsmsCredentials, input: { phone: string; code: string; oaId: string | null; templateId: string | null; brandname: string; requestId: string }): Promise<GatewayResult>;
  listOfficialAccounts(credentials: EsmsCredentials): Promise<{ ok: boolean; error: string | null; accounts: { id: string; name: string }[] }>;
}

const base = "https://rest.esms.vn/MainService.svc/json";
type EsmsResponse = { CodeResult?: string; SMSID?: string; ErrorMessage?: string; ZOAList?: { OAID: string; OAName: string }[] };

// eSMS nhận số điện thoại dạng 09...; hệ thống lưu dạng +84...
export const toLocalPhone = (phone: string) => (phone.startsWith("+84") ? `0${phone.slice(3)}` : phone);

@Injectable()
export class EsmsGateway implements MessageGateway {
  async sendZns(credentials: EsmsCredentials, input: { phone: string; oaId: string; templateId: string; data: Record<string, string>; requestId: string }): Promise<GatewayResult> {
    return this.result(
      await this.post("/SendZaloMessage_V5_post/", {
        ApiKey: credentials.apiKey,
        SecretKey: credentials.secretKey,
        OAID: input.oaId,
        Phone: toLocalPhone(input.phone),
        TempID: input.templateId,
        TempData: Object.entries(input.data).map(([key, value]) => ({ key, value })),
        RequestId: input.requestId,
        Sandbox: credentials.sandbox ? "1" : "0",
      }),
    );
  }

  // Có mẫu ZNS thì gửi đa kênh Zalo trước, SMS sau; chưa có thì chỉ SMS.
  async sendOtp(credentials: EsmsCredentials, input: { phone: string; code: string; oaId: string | null; templateId: string | null; brandname: string; requestId: string }): Promise<GatewayResult> {
    const sms = {
      Content: `${input.code} la ma dang nhap VComm cua ban, hieu luc 5 phut. Khong chia se ma nay.`,
      IsUnicode: "0",
      SmsType: "2",
      Brandname: input.brandname,
      RequestId: `${input.requestId}-sms`,
      Sandbox: credentials.sandbox ? "1" : "0",
    };
    const phone = toLocalPhone(input.phone);
    if (input.oaId && input.templateId) {
      return this.result(
        await this.post("/MultiChannelMessage/", {
          ApiKey: credentials.apiKey,
          SecretKey: credentials.secretKey,
          Phone: phone,
          Channels: ["zalo", "sms"],
          Data: [{ TempID: input.templateId, Params: [input.code], OAID: input.oaId, RequestId: input.requestId, Sandbox: credentials.sandbox ? "1" : "0" }, sms],
        }),
      );
    }
    return this.result(await this.post("/SendMultipleMessage_V4_post_json/", { ApiKey: credentials.apiKey, SecretKey: credentials.secretKey, Phone: phone, ...sms }));
  }

  async listOfficialAccounts(credentials: EsmsCredentials): Promise<{ ok: boolean; error: string | null; accounts: { id: string; name: string }[] }> {
    const response = await this.post("/ZNS/GetListZOA/", { ApiKey: credentials.apiKey, SecretKey: credentials.secretKey });
    const ok = response.CodeResult === "100";
    return {
      ok,
      error: ok ? null : (response.ErrorMessage ?? `Mã lỗi ${response.CodeResult ?? "không rõ"}`),
      accounts: (response.ZOAList ?? []).map((item) => ({ id: item.OAID, name: item.OAName })),
    };
  }

  private result(response: EsmsResponse): GatewayResult {
    const ok = response.CodeResult === "100";
    return { ok, messageId: response.SMSID ?? null, error: ok ? null : `${response.CodeResult ?? "?"}: ${response.ErrorMessage ?? "eSMS từ chối yêu cầu"}` };
  }

  private async post(path: string, body: unknown): Promise<EsmsResponse> {
    try {
      const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
      return (await response.json()) as EsmsResponse;
    } catch (error) {
      return { CodeResult: "network", ErrorMessage: (error as Error).message };
    }
  }
}
