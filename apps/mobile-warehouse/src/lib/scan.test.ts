// KICHBAN_KIEMTHU_427: tra mã quét của ứng dụng kho (TIEUCHI_NGHIEMTHU_281; QUYTAC_NGHIEPVU_282).
import type { StockItemOption } from "contracts";
import { describe, expect, it } from "vitest";
import { addItem, addSerial, decide, findLocation, removeSerial } from "./scan";

const option = (overrides: Partial<StockItemOption> = {}): StockItemOption => ({
  variantId: "bien-the-nuoc",
  sku: "NUOC-001",
  productName: "Nước suối",
  optionValues: [],
  tracksLots: false,
  tracksSerials: false,
  baseUnitId: "chai",
  units: [
    { unitId: "chai", unitName: "Chai", factor: "1" },
    { unitId: "thung", unitName: "Thùng", factor: "24" },
  ],
  matchedUnitId: null,
  ...overrides,
});
const shelf = { id: "vi-tri-a", code: "A-01-02" };

describe("KICHBAN_KIEMTHU_427: tra mã quét", () => {
  it("mã vị trí không phân biệt hoa thường; mã khác không phải vị trí", () => {
    expect(findLocation("a-01-02", [shelf])).toEqual(shelf);
    expect(findLocation("8936012345678", [shelf])).toBeNull();
  });

  it("mã vạch của thùng thêm 1 thùng; quét lại cộng dồn vào dòng cùng mặt hàng, đơn vị, vị trí; đổi vị trí thì thêm dòng", () => {
    const carton = option({ matchedUnitId: "thung" });
    const first = addItem([], carton, shelf);
    expect(first.line).toMatchObject({ unitName: "Thùng", factor: 24, quantity: 1, locationCode: "A-01-02" });
    const second = addItem(first.lines, carton, shelf);
    expect(second.lines).toHaveLength(1);
    expect(second.line.quantity).toBe(2);
    const bottle = addItem(second.lines, option({ matchedUnitId: null }), shelf);
    expect(bottle.lines).toHaveLength(2);
    expect(bottle.line).toMatchObject({ unitName: "Chai", quantity: 1 });
    const otherShelf = addItem(bottle.lines, carton, { id: "vi-tri-b", code: "B-01-01" });
    expect(otherShelf.lines).toHaveLength(3);
  });

  it("mã hàng khớp đúng thêm ngay; khớp nhiều mặt hàng thì cho chọn; chỉ khớp gần đúng theo tên thì cho chọn; không khớp thì báo không tìm thấy", () => {
    expect(decide("nuoc-001", [option()], false)).toMatchObject({ kind: "item" });
    expect(decide("8936012345678", [option({ matchedUnitId: "chai" }), option({ variantId: "khac", matchedUnitId: "chai" })], false)).toMatchObject({ kind: "choose" });
    expect(decide("nuoc", [option()], false)).toMatchObject({ kind: "choose" });
    expect(decide("XYZ", [], false)).toEqual({ kind: "notFound" });
  });

  it("hàng serial: quét mã hàng tạo dòng chờ serial; mã không phải hàng ghi vào dòng; serial trùng bị từ chối; bỏ serial giảm số lượng", () => {
    const phone = option({ variantId: "dien-thoai", sku: "DT-01", tracksSerials: true, units: [{ unitId: "cai", unitName: "Cái", factor: "1" }], baseUnitId: "cai" });
    const added = addItem([], phone, null);
    expect(added.line).toMatchObject({ quantity: 0, unitName: "Cái" });
    expect(decide("SN-0001", [], true)).toEqual({ kind: "serial", serial: "SN-0001" });
    // Đang chờ serial mà quét trúng mã hàng thì vẫn là mặt hàng.
    expect(decide("DT-01", [phone], true)).toMatchObject({ kind: "item" });
    const one = addSerial(added.lines, added.line.key, "SN-0001");
    const two = addSerial(one.lines, added.line.key, "SN-0002");
    expect(two.lines[0]).toMatchObject({ quantity: 2, serials: ["SN-0001", "SN-0002"] });
    expect(addSerial(two.lines, added.line.key, "SN-0001").duplicate).toBe(true);
    expect(addItem(two.lines, phone, null).line.quantity).toBe(2);
    expect(removeSerial(two.lines, added.line.key, "SN-0001")[0]).toMatchObject({ quantity: 1, serials: ["SN-0002"] });
  });

  it("theo đơn: quy đổi đơn vị quét sang đơn vị dòng đơn; hai dòng đơn cùng mặt hàng tách riêng", () => {
    const carton = option({ matchedUnitId: "thung" });
    const target = { orderLineId: "dong-don-1", unitId: "chai", unitName: "Chai", factor: 1 };
    const first = addItem([], carton, null, target);
    expect(first.line).toMatchObject({ unitName: "Chai", quantity: 24, orderLineId: "dong-don-1" });
    const second = addItem(first.lines, option(), null, target);
    expect(second.line.quantity).toBe(25);
    const byCarton = addItem(second.lines, option(), null, { orderLineId: "dong-don-2", unitId: "thung", unitName: "Thùng", factor: 24 });
    expect(byCarton.lines).toHaveLength(2);
    expect(byCarton.line.quantity).toBe(0.0417);
  });
});
