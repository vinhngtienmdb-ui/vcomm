// Tra mã quét trên màn hình phiếu, đếm kiểm kê (QUYTAC_NGHIEPVU_282). Hàm thuần, không gọi API, để kiểm thử đơn vị.
import type { StockItemOption } from "contracts";

export type ScanLocation = { id: string; code: string };

// Dòng quét: số lượng theo đơn vị của dòng; hàng serial thì số lượng bằng số serial (đơn vị cơ sở).
export type ScanLine = {
  key: string;
  variantId: string;
  sku: string;
  productName: string;
  tracksLots: boolean;
  tracksSerials: boolean;
  unitId: string;
  unitName: string;
  factor: number;
  quantity: number;
  locationId: string | null;
  locationCode: string | null;
  lotId: string | null;
  lotNo: string | null;
  expiresOn: string | null;
  serials: string[];
  // Dòng theo đơn mua, đơn bán: dòng đơn; số lượng theo đơn vị của dòng đơn.
  orderLineId: string | null;
  // Nhập khác: đơn giá theo đơn vị của dòng; xuất theo lô khác gợi ý: lý do.
  unitCost: string;
  lotOverrideReason: string;
};

// Dòng đơn đích khi quét theo đơn: đơn vị, hệ số quy đổi của dòng đơn.
export type OrderTarget = { orderLineId: string; unitId: string; unitName: string; factor: number };

export const normalizeCode = (raw: string) => raw.trim();

// Bước 1: mã vị trí của kho đang chọn (không phân biệt hoa thường).
export function findLocation(code: string, locations: ScanLocation[]): ScanLocation | null {
  const wanted = code.toUpperCase();
  return locations.find((location) => location.code.toUpperCase() === wanted) ?? null;
}

// Bước 2: mặt hàng khớp đúng mã vạch hoặc mã hàng. Kết quả tìm gần đúng theo tên chỉ dùng khi gõ tay để chọn.
export function exactMatches(code: string, options: StockItemOption[]): StockItemOption[] {
  const upper = code.toUpperCase();
  return options.filter((option) => option.matchedUnitId !== null || option.sku.toUpperCase() === upper);
}

export type ScanDecision = { kind: "item"; option: StockItemOption } | { kind: "choose"; options: StockItemOption[] } | { kind: "serial"; serial: string } | { kind: "notFound" };

// Bước 3: không khớp mặt hàng mà đang chờ serial thì là serial; còn kết quả gần đúng thì cho chọn.
export function decide(code: string, options: StockItemOption[], awaitingSerial: boolean): ScanDecision {
  const exact = exactMatches(code, options);
  if (exact.length === 1) return { kind: "item", option: exact[0]! };
  if (exact.length > 1) return { kind: "choose", options: exact };
  if (awaitingSerial) return { kind: "serial", serial: code };
  if (options.length > 0) return { kind: "choose", options };
  return { kind: "notFound" };
}

// Thêm một đơn vị quét: đơn vị khớp mã vạch, không khớp thì đơn vị cơ sở. Cộng vào dòng gần nhất cùng mặt hàng, đơn vị, vị trí; chưa có thì thêm dòng.
// Hàng serial: không cộng số lượng, trả dòng để chờ quét serial.
// Theo đơn: quy đổi đơn vị quét sang đơn vị của dòng đơn (1 thùng 24 chai quét vào dòng đơn tính theo chai thì cộng 24).
export function addItem(lines: ScanLine[], option: StockItemOption, location: ScanLocation | null, target?: OrderTarget): { lines: ScanLine[]; line: ScanLine } {
  const scannedUnitId = option.tracksSerials ? option.baseUnitId : (option.matchedUnitId ?? option.baseUnitId);
  const scannedFactor = Number(option.units.find((item) => item.unitId === scannedUnitId)?.factor ?? "1");
  const unitId = target?.unitId ?? scannedUnitId;
  const unit = target ? { unitName: target.unitName, factor: String(target.factor) } : option.units.find((item) => item.unitId === unitId);
  const increment = option.tracksSerials ? 0 : target ? round(scannedFactor / target.factor) : 1;
  const locationId = location?.id ?? null;
  const index = findLastIndex(lines, (line) => line.variantId === option.variantId && line.unitId === unitId && line.locationId === locationId && line.orderLineId === (target?.orderLineId ?? null));
  if (index >= 0) {
    const existing = lines[index]!;
    const line = { ...existing, quantity: round(existing.quantity + increment) };
    return { lines: lines.map((item, position) => (position === index ? line : item)), line };
  }
  const line: ScanLine = {
    key: `${option.variantId}|${unitId}|${locationId ?? ""}|${lines.length}`,
    variantId: option.variantId,
    sku: option.sku,
    productName: option.productName,
    tracksLots: option.tracksLots,
    tracksSerials: option.tracksSerials,
    unitId,
    unitName: unit?.unitName ?? "",
    factor: Number(unit?.factor ?? "1"),
    quantity: increment,
    locationId,
    locationCode: location?.code ?? null,
    lotId: null,
    lotNo: null,
    expiresOn: null,
    serials: [],
    orderLineId: target?.orderLineId ?? null,
    unitCost: "",
    lotOverrideReason: "",
  };
  return { lines: [...lines, line], line };
}

// Ghi serial vào dòng đang chờ; serial đã có trên bất kỳ dòng nào thì từ chối.
export function addSerial(lines: ScanLine[], key: string, serial: string): { lines: ScanLine[]; duplicate: boolean } {
  if (lines.some((line) => line.serials.includes(serial))) return { lines, duplicate: true };
  return {
    lines: lines.map((line) => (line.key === key ? { ...line, serials: [...line.serials, serial], quantity: line.serials.length + 1 } : line)),
    duplicate: false,
  };
}

export function removeSerial(lines: ScanLine[], key: string, serial: string): ScanLine[] {
  return lines.map((line) => {
    if (line.key !== key) return line;
    const serials = line.serials.filter((item) => item !== serial);
    return { ...line, serials, quantity: serials.length };
  });
}

const round = (value: number) => Math.round(value * 10000) / 10000;

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) if (predicate(items[index]!)) return index;
  return -1;
}
