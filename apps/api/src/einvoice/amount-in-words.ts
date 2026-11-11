// Đọc số tiền bằng chữ tiếng Việt cho hóa đơn (Nghị định 254/2026 Điều 10: tổng tiền thanh toán ghi bằng số và bằng chữ).
const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const scales = ["", " nghìn", " triệu", " tỷ"];

function readTriple(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  const parts: string[] = [];
  if (full || hundreds > 0) parts.push(`${digits[hundreds]} trăm`);
  if (tens > 1) {
    parts.push(`${digits[tens]} mươi`);
    if (ones === 1) parts.push("mốt");
    else if (ones === 4) parts.push("tư");
    else if (ones === 5) parts.push("lăm");
    else if (ones > 0) parts.push(digits[ones]!);
  } else if (tens === 1) {
    parts.push("mười");
    if (ones === 5) parts.push("lăm");
    else if (ones > 0) parts.push(digits[ones]!);
  } else if (ones > 0) {
    if (full || hundreds > 0) parts.push("lẻ");
    parts.push(digits[ones]!);
  }
  return parts.join(" ");
}

// Đọc phần nguyên; "tỷ" lặp cho số rất lớn (một nghìn tỷ).
function readInteger(value: number): string {
  if (value === 0) return "không";
  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);
  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index]!;
    if (group === 0) continue;
    const scale = index < 4 ? scales[index]! : scales[(index % 3) + 1]! + " tỷ".repeat(Math.floor(index / 3) - (index % 3 === 0 ? 1 : 0));
    words.push(readTriple(group, index < groups.length - 1) + scale);
  }
  return words.join(" ");
}

export function amountInWords(amount: number, currency: string): string {
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const integer = Math.floor(absolute + 1e-9);
  const cents = Math.round((absolute - integer) * 100);
  const unit = currency === "VND" ? "đồng" : currency;
  let text = `${readInteger(integer)} ${unit}`;
  if (cents > 0) text += ` ${readInteger(cents)} xu`;
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return negative ? `Âm ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}
