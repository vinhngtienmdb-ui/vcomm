// Lớp kết nối đối tác liên minh điểm (CONG_VIEC_65; QUYTAC_NGHIEPVU_550). Mỗi loại kết nối (`connector` của hợp đồng) có một bộ chuyển đổi;
// công việc này chỉ có bộ giả lập, bộ chuyển đổi thật cho từng đối tác viết khi có tài liệu API của đối tác.
// Kết quả mỗi thao tác: thành công, từ chối (kèm mã lỗi đối tác) hoặc không rõ (hết thời gian, lỗi mạng, lỗi máy chủ đối tác).
// Mã OTP, số thành viên đầy đủ không ghi vào log.
import { Inject, Injectable } from "@nestjs/common";
import { ApiError } from "../../common/api-error";
import { PartnerSimulator } from "./simulator";

export type ConnectorResult<T> = { outcome: "success"; value: T } | { outcome: "rejected"; code: string } | { outcome: "unknown"; code: string };

export interface PartnerContractRef {
  id: string;
  connector: "simulator";
}

export interface PartnerConnector {
  // Đối tác gửi OTP tới khách theo thông tin đối tác lưu cho số thành viên; `reference` là mã tham chiếu VComm.
  sendLinkOtp(contract: PartnerContractRef, input: { memberNumber: string; reference: string }): Promise<ConnectorResult<null>>;
  // Đối tác xác minh OTP; thành công trả tên đã che của thành viên.
  verifyLink(contract: PartnerContractRef, input: { memberNumber: string; reference: string; otp: string }): Promise<ConnectorResult<{ maskedName: string | null }>>;
}

export const simulatorEnabled = () => process.env.LOYALTY_PARTNER_SIMULATOR === "on";

@Injectable()
export class PartnerConnectors {
  constructor(@Inject(PartnerSimulator) private readonly simulator: PartnerSimulator) {}

  // Bộ giả lập chỉ chạy khi bật biến môi trường; môi trường thật không bật thì báo lỗi kết nối.
  of(contract: PartnerContractRef): PartnerConnector {
    if (contract.connector === "simulator" && simulatorEnabled()) return this.simulator;
    throw new ApiError("BUSINESS_RULE", "partnerConnectorUnavailable");
  }
}
