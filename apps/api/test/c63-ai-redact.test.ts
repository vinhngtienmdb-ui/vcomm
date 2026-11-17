// CONG_VIEC_63 L1: che dữ liệu cá nhân trước khi gửi mô hình (TIEUCHI_NGHIEMTHU_471; KICHBAN_KIEMTHU_655). Kiểm thử đơn vị, không cần cơ sở dữ liệu.
import { describe, expect, it } from "vitest";
import { costOf } from "../src/ai/ai-config";
import { redactText, redactValue } from "../src/ai/redact";

const che = {
  phone: "[ĐIỆN THOẠI]",
  email: "[EMAIL]",
  identity: "[SỐ ĐỊNH DANH]",
  bank: "[SỐ TÀI KHOẢN]",
};

describe("KICHBAN_KIEMTHU_655: bảng mẫu che dữ liệu", () => {
  const masked: [string, string][] = [
    ["Gọi 0912345678 nhé", `Gọi ${che.phone} nhé`],
    ["SĐT: 0912 345 678", `SĐT: ${che.phone}`],
    ["sđt 091.234.5678", `sđt ${che.phone}`],
    ["liên hệ +84912345678", `liên hệ ${che.phone}`],
    ["liên hệ +84 912 345 678", `liên hệ ${che.phone}`],
    ["di động 84-912-345-678", `di động ${che.phone}`],
    ["máy bàn 02838123456", `máy bàn ${che.phone}`],
    ["máy bàn 028 3812 3456", `máy bàn ${che.phone}`],
    ["0385123456,0705123456", `${che.phone},${che.phone}`],
    ["Email lan.nguyen@gmail.com", `Email ${che.email}`],
    ["mail: ketoan+hd@cong-ty.com.vn.", `mail: ${che.email}.`],
    ["CCCD 001203004567", `CCCD ${che.identity}`],
    ["CMND 012345678 cấp 2015", `CMND ${che.identity} cấp 2015`],
    ["hộ chiếu C1234567", `hộ chiếu ${che.identity}`],
    ["Số tài khoản 0071000123456 Vietcombank", `Số tài khoản ${che.bank} Vietcombank`],
    ["STK: 19033 4455 6677", `STK: ${che.bank}`],
    ["tài khoản số 123456789012", `tài khoản số ${che.bank}`],
    ["account no. 1234567890", `account no. ${che.bank}`],
  ];
  it.each(masked)("che %s", (input, expected) => {
    expect(redactText(input)).toBe(expected);
  });

  const kept = [
    "Tổng tiền 48.600.000 ₫",
    "48600000",
    "Đơn DB-2026-001502 ngày 12/11/2026",
    "Mã vạch 8930000000611",
    "Số lượng 1.250 cái, giá 9.900",
    "Sản phẩm SP-00412 thuế 10%",
    "Doanh số 4.812.600.000 tăng 12,4%",
    "Kho KHO-HN có 120 hộp",
    "Mã số thuế 0101234567-001",
    "Năm 2026 tháng 11",
    "Giờ 10:41:07",
    "Tỷ lệ 0,05 USD",
  ];
  it.each(kept)("không che nhầm %s", (input) => {
    expect(redactText(input)).toBe(input);
  });

  it("che theo tên trường trong kết quả công cụ, giữ số tiền dạng chuỗi", () => {
    const result = redactValue({
      rows: [
        { customerName: "Nguyễn Thị Lan", phone: "0912345678", email: "lan@x.vn", total: "18450000", address: "12 Trần Phú, Hà Đông" },
        { customerName: "Công ty Minh Long", contact_phone: "024 3812 3456", bank_account: "0071000123456", identityNumber: null, note: "gọi 0987654321 trước khi giao" },
      ],
      totalRows: 2,
    });
    expect(result).toEqual({
      rows: [
        { customerName: "Nguyễn Thị Lan", phone: che.phone, email: che.email, total: "18450000", address: "12 Trần Phú, Hà Đông" },
        { customerName: "Công ty Minh Long", contact_phone: che.phone, bank_account: che.bank, identityNumber: null, note: `gọi ${che.phone} trước khi giao` },
      ],
      totalRows: 2,
    });
  });
});

describe("Chi phí một lượt (QUYTAC_NGHIEPVU_512)", () => {
  it("tính theo đơn giá mỗi triệu token", () => {
    const prices = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 };
    expect(costOf({ inputTokens: 25_000, outputTokens: 1_000, cacheReadTokens: 0, cacheWriteTokens: 0 }, prices)).toBe(0.06);
    expect(costOf({ inputTokens: 1_000, outputTokens: 200, cacheReadTokens: 10_000, cacheWriteTokens: 4_000 }, prices)).toBe(0.015);
  });
});
