// Chuỗi VietQR chuyển khoản nhanh theo chuẩn EMVCo QR của NAPAS (CONG_VIEC_53; QUYTAC_NGHIEPVU_373): mã ngân hàng, số tài khoản, số tiền, nội dung.
// Mỗi trường dạng mã 2 chữ số + độ dài 2 chữ số + giá trị; cuối chuỗi là mã kiểm tra CRC16-CCITT (đa thức 0x1021, giá trị đầu 0xFFFF).
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Nội dung chuyển khoản chỉ dùng chữ không dấu, số, khoảng trắng, tối đa 25 ký tự.
export function vietQrContent(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, 25);
}

export function vietQrPayload(input: { bankBin: string; accountNo: string; amount: number; content: string }): string {
  const account = field("00", input.bankBin) + field("01", input.accountNo);
  const merchant = field("00", "A000000727") + field("01", account) + field("02", "QRIBFTTA");
  const body =
    field("00", "01") +
    field("01", "12") +
    field("38", merchant) +
    field("53", "704") +
    field("54", String(Math.round(input.amount))) +
    field("58", "VN") +
    field("62", field("08", vietQrContent(input.content))) +
    "6304";
  return body + crc16(body);
}
