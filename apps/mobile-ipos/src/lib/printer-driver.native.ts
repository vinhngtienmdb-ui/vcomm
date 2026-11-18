// Lớp in trên Android (QUYTAC_NGHIEPVU_620 khoản 2, 4, 5; thư viện người dùng duyệt 2026-11-17):
// - Máy Sunmi (máy in gắn sẵn): in chữ qua dịch vụ in Sunmi (tự vẽ phông Unicode nên tiếng Việt có dấu in đúng), mở ngăn kéo bằng lệnh ESC/POS thô.
// - Máy in rời qua mạng LAN: dựng lệnh ESC/POS bằng @point-of-sale/receipt-printer-encoder (bảng mã windows1258, hoặc in không dấu), gửi qua cổng 9100.
// - Máy in rời Bluetooth Classic (SPP) đã ghép đôi: cùng lệnh ESC/POS, gửi qua react-native-bluetooth-classic. Chưa kiểm thử trên máy thật.
import * as Sunmi from "@mitsuharu/react-native-sunmi-printer-library";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { PermissionsAndroid, Platform } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import TcpSocket from "react-native-tcp-socket";
import type { PrinterSettings } from "./printer-settings";
import { columnsOf, columnsText, withoutDiacritics, type ReceiptLine } from "./receipt";

export const hasPhysicalPrinter = true;

// Lệnh mở ngăn kéo ESC p 0 25 250 (chân 2), dạng base64 cho dịch vụ in Sunmi.
const drawerPulseBase64 = "G3AAGfo=";

function toBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!;
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    output += alphabet[a >> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    output += b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    output += c === undefined ? "=" : alphabet[c & 63]!;
  }
  return output;
}

// Android 12 trở lên cần quyền kết nối Bluetooth lúc chạy.
async function bluetoothReady(): Promise<void> {
  if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error("bluetoothPermission");
  }
  if (!(await RNBluetoothClassic.isBluetoothEnabled())) throw new Error("bluetoothOff");
}

export async function bluetoothPrinters(): Promise<{ address: string; name: string }[]> {
  await bluetoothReady();
  return (await RNBluetoothClassic.getBondedDevices()).map((device) => ({ address: device.address, name: device.name }));
}

async function sendBluetooth(settings: PrinterSettings, bytes: Uint8Array): Promise<void> {
  if (!settings.bluetoothAddress) throw new Error("noPrinter");
  await bluetoothReady();
  const device = await RNBluetoothClassic.connectToDevice(settings.bluetoothAddress);
  try {
    // Gửi từng khối 512 byte để máy in nhiệt có bộ đệm nhỏ không mất lệnh.
    for (let offset = 0; offset < bytes.length; offset += 512) await device.write(toBase64(bytes.slice(offset, offset + 512)), "base64");
  } finally {
    await device.disconnect().catch(() => false);
  }
}

async function printSunmi(lines: ReceiptLine[], paperWidth: 58 | 80, openDrawer: boolean): Promise<void> {
  await Sunmi.prepare();
  const width = columnsOf(paperWidth);
  for (const line of lines) {
    if (line.kind === "feed") await Sunmi.lineWrap(1);
    else if (line.kind === "rule") {
      await Sunmi.setAlignment("left");
      await Sunmi.printText(`${"-".repeat(width)}\n`);
    } else if (line.kind === "columns") {
      await Sunmi.setAlignment("left");
      await Sunmi.setTextStyle("bold", Boolean(line.bold));
      for (const text of columnsText(line.left, line.right, width)) await Sunmi.printText(`${text}\n`);
      await Sunmi.setTextStyle("bold", false);
    } else {
      await Sunmi.setAlignment(line.align);
      await Sunmi.setTextStyle("bold", Boolean(line.bold));
      await Sunmi.setFontSize(line.large ? 32 : 24);
      await Sunmi.printText(`${line.text}\n`);
      await Sunmi.setFontSize(24);
      await Sunmi.setTextStyle("bold", false);
    }
  }
  await Sunmi.lineWrap(3);
  await Sunmi.cutPaper().catch(() => undefined);
  if (openDrawer) await Sunmi.sendRAWData(drawerPulseBase64);
}

function encode(lines: ReceiptLine[], settings: PrinterSettings, paperWidth: 58 | 80, openDrawer: boolean): Uint8Array {
  const width = columnsOf(paperWidth);
  const text = (value: string) => (settings.ascii ? withoutDiacritics(value) : value);
  let encoder = new ReceiptPrinterEncoder({ language: "esc-pos", columns: width, codepageMapping: settings.codepageMapping, feedBeforeCut: 4 }).initialize().codepage("auto");
  for (const line of lines) {
    if (line.kind === "feed") encoder = encoder.newline();
    else if (line.kind === "rule") encoder = encoder.rule();
    else if (line.kind === "columns") {
      encoder = encoder.bold(Boolean(line.bold));
      for (const part of columnsText(text(line.left), text(line.right), width)) encoder = encoder.line(part);
      encoder = encoder.bold(false);
    } else {
      encoder = encoder.align(line.align).bold(Boolean(line.bold));
      if (line.large) encoder = encoder.size(2, 2);
      encoder = encoder.line(text(line.text));
      if (line.large) encoder = encoder.size(1, 1);
      encoder = encoder.bold(false).align("left");
    }
  }
  encoder = encoder.cut();
  if (openDrawer) encoder = encoder.pulse();
  return encoder.encode();
}

function sendLan(settings: PrinterSettings, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error("timeout")), 8000);
    const client = TcpSocket.createConnection({ host: settings.host, port: settings.port }, () => {
      client.write(bytes as unknown as string, undefined, (error) => finish(error ?? undefined));
    });
    client.on("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
  });
}

export async function printLines(lines: ReceiptLine[], settings: PrinterSettings, paperWidth: 58 | 80, openDrawer: boolean): Promise<void> {
  if (settings.connection === "sunmi") return printSunmi(lines, paperWidth, openDrawer && settings.drawerViaPrinter);
  if (settings.connection === "lan") return sendLan(settings, encode(lines, settings, paperWidth, openDrawer && settings.drawerViaPrinter));
  if (settings.connection === "bluetooth") return sendBluetooth(settings, encode(lines, settings, paperWidth, openDrawer && settings.drawerViaPrinter));
  throw new Error("noPrinter");
}

export async function pulseDrawer(settings: PrinterSettings): Promise<void> {
  if (!settings.drawerViaPrinter) throw new Error("noDrawer");
  if (settings.connection === "sunmi") return Sunmi.sendRAWData(drawerPulseBase64);
  if (settings.connection === "lan") return sendLan(settings, new ReceiptPrinterEncoder({ language: "esc-pos" }).initialize().pulse().encode());
  if (settings.connection === "bluetooth") return sendBluetooth(settings, new ReceiptPrinterEncoder({ language: "esc-pos" }).initialize().pulse().encode());
  throw new Error("noPrinter");
}

