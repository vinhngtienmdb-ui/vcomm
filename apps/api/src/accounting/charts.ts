// Hệ thống tài khoản, định khoản mặc định theo chế độ kế toán (CONG_VIEC_14; QUYTAC_NGHIEPVU_93, 94).
// Danh mục lấy từ phụ lục hệ thống tài khoản của Thông tư 99/2025/TT-BTC và Thông tư 133/2016/TT-BTC; đang đối chiếu văn bản, chưa nạp.
import type { AccountingRegime } from "contracts";
import type { PostingRole } from "./postings";

export interface ChartAccount {
  code: string;
  name: string;
  parent: string | null;
  nature: "debit" | "credit" | "both";
}

export const charts: Record<AccountingRegime, { name: string; accounts: ChartAccount[] }> = {
  tt99: { name: "Thông tư 99/2025/TT-BTC", accounts: [] },
  tt133: { name: "Thông tư 133/2016/TT-BTC", accounts: [] },
};

export const defaultPostingRules = {} as Record<AccountingRegime, Record<PostingRole, string>>;

export const roleDescriptions = {} as Record<PostingRole, string>;
