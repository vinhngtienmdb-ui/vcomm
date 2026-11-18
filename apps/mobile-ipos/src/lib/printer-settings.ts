// Cài đặt thiết bị lưu trên máy (MAN_HINH_292; QUYTAC_NGHIEPVU_620 khoản 3, 5): máy in, khổ giấy, in không dấu, số liên, tự in, mở ngăn kéo qua máy in.
import { readValue, writeValue } from "./storage";

// Bluetooth: máy in nhiệt Bluetooth Classic (SPP) đã ghép đôi trong cài đặt Android; chưa kiểm thử trên máy thật.
export type PrinterConnection = "none" | "sunmi" | "lan" | "bluetooth";
export interface PrinterSettings {
  connection: PrinterConnection;
  host: string;
  port: number;
  bluetoothAddress: string;
  bluetoothName: string;
  // Trống: dùng khổ giấy mặc định trong cài đặt bán hàng của cửa hàng.
  paperWidth: 58 | 80 | null;
  ascii: boolean;
  // Bảng ánh xạ bảng mã của dòng máy in rời (quyết định số bảng mã windows1258 trong lệnh ESC/POS).
  codepageMapping: "epson" | "xprinter" | "pos-5890" | "citizen" | "bixolon";
  copies: 1 | 2 | 3;
  autoPrint: boolean;
  drawerViaPrinter: boolean;
}

const key = "ipos.printer";
export const defaultPrinterSettings: PrinterSettings = { connection: "none", host: "", port: 9100, bluetoothAddress: "", bluetoothName: "", paperWidth: null, ascii: false, codepageMapping: "epson", copies: 1, autoPrint: true, drawerViaPrinter: true };

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  try {
    const stored = await readValue(key);
    return stored ? { ...defaultPrinterSettings, ...(JSON.parse(stored) as Partial<PrinterSettings>) } : defaultPrinterSettings;
  } catch {
    return defaultPrinterSettings;
  }
}

export async function savePrinterSettings(value: PrinterSettings): Promise<void> {
  await writeValue(key, JSON.stringify(value));
}
