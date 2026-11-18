// Lớp in trên bản web xem trước: không có máy in thật; màn hình hiện bản xem trước hóa đơn thay cho in (QUYTAC_NGHIEPVU_620 khoản 5).
// Trên Android dùng printer-driver.native.ts (dịch vụ in Sunmi, máy in mạng LAN, máy in Bluetooth).
import type { PrinterSettings } from "./printer-settings";
import type { ReceiptLine } from "./receipt";

export const hasPhysicalPrinter = false;

export async function printLines(_lines: ReceiptLine[], _settings: PrinterSettings, _paperWidth: 58 | 80, _openDrawer: boolean): Promise<void> {
  throw new Error("preview");
}

export async function pulseDrawer(_settings: PrinterSettings): Promise<void> {
  throw new Error("preview");
}

export async function bluetoothPrinters(): Promise<{ address: string; name: string }[]> {
  return [];
}
