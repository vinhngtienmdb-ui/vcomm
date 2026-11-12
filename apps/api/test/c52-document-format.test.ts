// QUYTAC_NGHIEPVU_366: địa danh, ngày tháng theo Phụ lục I Nghị định 30/2020/NĐ-CP – ngày nhỏ hơn 10 và tháng 1, 2 ghi thêm số 0.
import { describe, expect, it } from "vitest";
import { dateLine, recipientText } from "../src/office/document-format";

describe("CONG_VIEC_52 thể thức ngày tháng, Kính gửi", () => {
  it("ngày 1 đến 9 thêm số 0, ngày 10 trở lên giữ nguyên", () => {
    expect(dateLine("Hà Nội", "2026-03-09", 2026)).toBe("Hà Nội, ngày 09 tháng 3 năm 2026");
    expect(dateLine("Hà Nội", "2026-03-10", 2026)).toBe("Hà Nội, ngày 10 tháng 3 năm 2026");
    expect(dateLine("Hà Nội", "2026-05-01", 2026)).toBe("Hà Nội, ngày 01 tháng 5 năm 2026");
  });

  it("tháng 1, 2 thêm số 0; tháng 3 đến 12 không thêm", () => {
    expect(dateLine("Hà Nội", "2026-01-14", 2026)).toBe("Hà Nội, ngày 14 tháng 01 năm 2026");
    expect(dateLine("Hà Nội", "2026-02-05", 2026)).toBe("Hà Nội, ngày 05 tháng 02 năm 2026");
    expect(dateLine("Hà Nội", "2026-03-31", 2026)).toBe("Hà Nội, ngày 31 tháng 3 năm 2026");
    expect(dateLine("Hà Nội", "2026-09-30", 2026)).toBe("Hà Nội, ngày 30 tháng 9 năm 2026");
    expect(dateLine("Hà Nội", "2026-10-15", 2026)).toBe("Hà Nội, ngày 15 tháng 10 năm 2026");
    expect(dateLine("Hà Nội", "2026-12-31", 2026)).toBe("Hà Nội, ngày 31 tháng 12 năm 2026");
  });

  it("chưa ban hành để trống ngày, tháng", () => {
    expect(dateLine("Hà Nội", null, 2026)).toBe("Hà Nội, ngày     tháng     năm 2026");
  });

  it("công văn có Kính gửi, không lặp khi người soạn đã gõ", () => {
    expect(recipientText("Công ty ABC")).toBe("Kính gửi: Công ty ABC");
    expect(recipientText("  Kính gửi: Cục Thuế ")).toBe("Kính gửi: Cục Thuế");
  });
});
