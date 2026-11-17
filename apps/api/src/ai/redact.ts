// Che dữ liệu cá nhân trước khi gửi ra mô hình (QUYTAC_NGHIEPVU_514). Mọi chuỗi đi ra lớp kết nối phải qua đây.
// Che một chiều, không khôi phục. Không che tên người, địa chỉ (người dùng chọn ngày 2026-11-17).

export const redactionLabels = {
  phone: "[ĐIỆN THOẠI]",
  email: "[EMAIL]",
  identity: "[SỐ ĐỊNH DANH]",
  bankAccount: "[SỐ TÀI KHOẢN]",
} as const;

// Email.
const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Số điện thoại Việt Nam: đầu 0 hoặc +84/84, di động (3, 5, 7, 8, 9 + 8 chữ số) hoặc cố định (2 + 9 chữ số); cho phép dấu cách, chấm, gạch giữa các nhóm.
const phonePattern = /(?<![\p{L}\p{N}])(?:\+?84|0)[\s.-]?(?:[35789](?:[\s.-]?\d){8}|2(?:[\s.-]?\d){9})(?![\p{L}\p{N}])/gu;
// Số tài khoản ngân hàng: 6 đến 19 chữ số ngay sau các từ khóa.
const bankAccountPattern = /((?:số\s+tài\s+khoản|stk|tài\s+khoản\s+số|tk\s+số|account\s+(?:no\.?|number))\s*[:.]?\s*)\d(?:[\s.-]?\d){5,18}(?![\p{L}\p{N}])/giu;
// CCCD 12 chữ số, CMND 9 chữ số, hộ chiếu (1 chữ cái + 7 hoặc 8 chữ số) đứng riêng.
const identityPattern = /(?<![\p{L}\p{N}.,-])(?:\d{12}|\d{9}|[A-Z]\d{7,8})(?![\p{L}\p{N}.,-])/gu;

export function redactText(value: string): string {
  return value
    .replace(emailPattern, redactionLabels.email)
    .replace(bankAccountPattern, (_match, prefix: string) => `${prefix}${redactionLabels.bankAccount}`)
    .replace(phonePattern, redactionLabels.phone)
    .replace(identityPattern, redactionLabels.identity);
}

// Tên trường chứa dữ liệu cá nhân trong kết quả công cụ (so không phân biệt hoa thường, bỏ gạch dưới).
const fieldLabels: [RegExp, string][] = [
  [/^(phone|phonenumber|mobile|telephone|tel|recipientphone|contactphone|buyerphone|customerphone|otherphone)$/, redactionLabels.phone],
  [/^(email|emailaddress|contactemail|buyeremail|customeremail|personalemail)$/, redactionLabels.email],
  [/^(identitynumber|idnumber|nationalid|citizenid|cccd|cmnd|passport|passportnumber|identity)$/, redactionLabels.identity],
  [/^(bankaccount|bankaccountnumber|accountnumber|banknumber)$/, redactionLabels.bankAccount],
];

function labelForField(name: string): string | null {
  const key = name.replaceAll("_", "").toLowerCase();
  return fieldLabels.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

// Che theo tên trường rồi theo mẫu cho mọi chuỗi còn lại; giữ nguyên số, boolean, null.
export function redactValue(value: unknown): unknown {
  // Chuỗi toàn chữ số (số tiền, số lượng, mã vạch dạng chuỗi) không che theo mẫu số định danh; vẫn che nếu là số điện thoại.
  if (typeof value === "string" && /^\d+$/.test(value) && !/^(0|84)/.test(value)) return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const label = labelForField(key);
        if (label && child !== null && child !== undefined && child !== "") return [key, label];
        return [key, redactValue(child)];
      }),
    );
  }
  return value;
}
