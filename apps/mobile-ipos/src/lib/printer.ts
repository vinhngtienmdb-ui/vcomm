// In hóa đơn, in thử, mở ngăn kéo (QUYTAC_NGHIEPVU_620). Lỗi máy in không chặn bán: hóa đơn đã ghi, màn hình báo "Không in được: <nguyên nhân>", cho in lại.
// Bản web xem trước không có máy in: trả nội dung chữ để màn hình hiện bản xem trước.
import type { IposReturn, IposSale } from "contracts";
import { t } from "./i18n";
import { hasPhysicalPrinter, printLines, pulseDrawer } from "./printer-driver";
import { loadPrinterSettings, type PrinterSettings } from "./printer-settings";
import { buildReceipt, buildReturnReceipt, columnsOf, receiptText, type ReceiptLine } from "./receipt";

export interface PrintOutcome {
  printed: boolean;
  error: string | null;
  preview: string[] | null;
}

const reasonOf = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error);
  if (text === "noPrinter") return t("printerNotConfigured");
  if (text === "timeout") return t("printerTimeout");
  if (text === "bluetoothOff") return t("bluetoothOff");
  if (text === "bluetoothPermission") return t("bluetoothPermission");
  return text;
};

async function output(lines: ReceiptLine[], settings: PrinterSettings, paperWidth: 58 | 80, openDrawer: boolean, copies: number): Promise<PrintOutcome> {
  if (!hasPhysicalPrinter || settings.connection === "none") {
    return { printed: false, error: hasPhysicalPrinter ? t("printerNotConfigured") : null, preview: receiptText(lines, columnsOf(paperWidth)) };
  }
  try {
    for (let copy = 0; copy < copies; copy += 1) await printLines(lines, settings, paperWidth, openDrawer && copy === 0);
    return { printed: true, error: null, preview: null };
  } catch (error) {
    return { printed: false, error: t("printFailed", { reason: reasonOf(error) }), preview: null };
  }
}

export async function printSale(sale: IposSale, options: { storePaperWidth: 58 | 80; reprintNumber: number | null; openDrawer: boolean; automatic?: boolean }): Promise<PrintOutcome> {
  const settings = await loadPrinterSettings();
  // Tắt tự in sau thanh toán: chỉ mở ngăn kéo, người bán bấm In lại khi cần.
  if (options.automatic && !settings.autoPrint) {
    if (options.openDrawer && hasPhysicalPrinter && settings.connection !== "none") await pulseDrawer(settings).catch(() => undefined);
    return { printed: false, error: null, preview: null };
  }
  const paperWidth = settings.paperWidth ?? options.storePaperWidth;
  return output(buildReceipt(sale, { reprintNumber: options.reprintNumber }), settings, paperWidth, options.openDrawer, options.reprintNumber ? 1 : settings.copies);
}

// In phiếu trả; có hoàn tiền mặt thì mở ngăn kéo.
export async function printReturn(item: IposReturn, storePaperWidth: 58 | 80): Promise<PrintOutcome> {
  const settings = await loadPrinterSettings();
  return output(buildReturnReceipt(item), settings, settings.paperWidth ?? storePaperWidth, Number(item.refundCash) > 0, 1);
}

export async function printTest(settings: PrinterSettings, storePaperWidth: 58 | 80): Promise<PrintOutcome> {
  const lines: ReceiptLine[] = [
    { kind: "text", text: t("testPrintTitle"), align: "center", bold: true, large: true },
    { kind: "text", text: "Tiếng Việt có dấu: ăâđêôơư ÁÀẢÃẠ Ệ Ữ", align: "left" },
    { kind: "columns", left: t("receiptTotal"), right: "123.456" },
    { kind: "rule" },
    { kind: "feed" },
  ];
  return output(lines, settings, settings.paperWidth ?? storePaperWidth, false, 1);
}

export async function openDrawer(): Promise<string | null> {
  const settings = await loadPrinterSettings();
  if (!hasPhysicalPrinter) return null;
  try {
    await pulseDrawer(settings);
    return null;
  } catch (error) {
    return t("drawerFailed", { reason: reasonOf(error) });
  }
}
