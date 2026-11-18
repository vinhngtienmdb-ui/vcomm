// Mã thanh toán động (CONG_VIEC_73; QUYTAC_NGHIEPVU_574): 12 chữ số mã thiết bị do máy chủ cấp + 6 chữ số Smart OTP hiện tại.
// Sinh trên máy, không cần mạng; mã thiết bị lưu trong bộ nhớ an toàn cùng Smart OTP, gắn với lần kích hoạt Smart OTP đang có.
import type { PayCodePrefixResponse } from "contracts";
import { api, read, write } from "./api";
import { codeOf } from "./smart-otp";

const storageKey = "vcomm.payCode";

export async function payCodePrefix(activatedAt: string): Promise<string> {
  const stored = await read(storageKey);
  const current = stored ? (JSON.parse(stored) as PayCodePrefixResponse) : null;
  if (current && current.activatedAt === activatedAt) return current.prefix;
  const issued = await api<PayCodePrefixResponse>("/buyer/instore/pay-code", { method: "POST" });
  await write(storageKey, JSON.stringify(issued));
  return issued.prefix;
}

export const payCodeOf = (prefix: string, secret: string, timestamp: number) => `${prefix}${codeOf(secret, timestamp)}`;

// Chia nhóm để đọc, nhập tay: 482 913 075 631 · 284 517.
export const groupPayCode = (code: string) => `${code.slice(0, 12).replace(/(\d{3})(?=\d)/g, "$1 ")} · ${code.slice(12, 15)} ${code.slice(15)}`;

// Code 128 bộ C (mỗi cặp chữ số một ký tự): độ rộng vạch, khoảng xen kẽ bắt đầu bằng vạch, mỗi ký tự 11 đơn vị (ký tự dừng 13).
const patterns = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232",
];
const startC = 105;
const stop = "2331112";

export function code128C(digits: string): number[] {
  if (!/^(\d\d)+$/.test(digits)) throw new Error("Code 128 bộ C cần số chữ số chẵn");
  const values = [startC, ...(digits.match(/\d\d/g) ?? []).map(Number)];
  const checksum = values.reduce((sum, value, index) => sum + value * (index === 0 ? 1 : index), 0) % 103;
  return [...values, checksum]
    .map((value) => patterns[value]!)
    .concat(stop)
    .join("")
    .split("")
    .map(Number);
}

// Mã trong đường dẫn thanh toán của cửa hàng (.../tt/<mã>, QUYTAC_NGHIEPVU_577); mã khác trả null.
export const checkoutToken = (text: string) => text.trim().match(/\/tt\/([A-Za-z0-9_-]{16,64})(?:[?#].*)?$/)?.[1] ?? null;
