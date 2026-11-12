// Tạo PDF bằng pdfmake với phông Roboto kèm thư viện (có tiếng Việt); không cho tải tệp ngoài.
import { dirname, join } from "node:path";

// pdfmake 0.3 không kèm khai báo kiểu.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake") as {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(definition: Record<string, unknown>): { getBuffer(): Promise<Buffer> };
};
const fontDirectory = join(dirname(require.resolve("pdfmake/package.json")), "fonts", "Roboto");
// Phông có chân cho văn bản hành chính theo thể thức Nghị định 30 (CONG_VIEC_52): Liberation Serif, giấy phép SIL OFL 1.1,
// kích thước chữ tương đương Times New Roman; đóng gói trong apps/api/assets/fonts (cùng đường dẫn khi chạy từ src và dist).
export const serifFontDirectory = join(__dirname, "..", "..", "assets", "fonts");
pdfmake.setFonts({
  LiberationSerif: {
    normal: join(serifFontDirectory, "LiberationSerif-Regular.ttf"),
    bold: join(serifFontDirectory, "LiberationSerif-Bold.ttf"),
    italics: join(serifFontDirectory, "LiberationSerif-Italic.ttf"),
    bolditalics: join(serifFontDirectory, "LiberationSerif-BoldItalic.ttf"),
  },
  Roboto: {
    normal: join(fontDirectory, "Roboto-Regular.ttf"),
    bold: join(fontDirectory, "Roboto-Medium.ttf"),
    italics: join(fontDirectory, "Roboto-Italic.ttf"),
    bolditalics: join(fontDirectory, "Roboto-MediumItalic.ttf"),
  },
});
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => path.startsWith(fontDirectory) || path.startsWith(serifFontDirectory));

export async function renderPdf(definition: Record<string, unknown>): Promise<Buffer> {
  return Buffer.from(await pdfmake.createPdf(definition).getBuffer());
}
